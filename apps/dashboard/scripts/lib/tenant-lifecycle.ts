/*
 * Tenant lifecycle — the R4B ceremony, separated from the CLI so a real database can prove its
 * semantics without driving an interactive prompt.
 *
 * ── WHAT THIS IS, EXHAUSTIVELY ───────────────────────────────────────────────
 *
 * Two transitions, and no others:
 *
 *   active     → suspended
 *   suspended  → active
 *
 * It is NOT a tenant lifecycle system. `provisioning` belongs to R4A and exists only inside that
 * ceremony's transaction; `deleting` and `deleted` belong to R5 along with retention, erasure and
 * audit redaction, and an enum value is not authorization to implement any of them. Neither state
 * is reachable through this module: the target is a closed two-value union, so a third transition
 * has no representation rather than merely being unimplemented.
 *
 * ── WHY DEPLOYMENT POSSESSION, AND NOT TENANT GOVERNANCE ─────────────────────
 *
 * Suspension makes every tenant-scoped authority unreachable. `resolveSessionFromReference` re-reads
 * company state on EVERY request and refuses anything but `active`, so the moment a tenant is
 * suspended its owner cannot sign in, the dashboard layout redirects to `/login`, and every
 * Governance writer refuses a null `TenantContext`. An in-tenant suspension writer would therefore
 * destroy the authority needed to reverse it and strand the tenant permanently — the stranded
 * enrollment lesson, in a place where the stranded thing is the whole organization.
 *
 * Deployment possession never depended on the tenant being active, so it can move the tenant in
 * BOTH directions. It is the same root R4A, G2.1 and D1.1 already rest on, and it claims no more
 * than they do: it records WHICH root acted, and never who operated the terminal.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ───────────────────────────────────────────
 *
 *   - create, delete or rename a tenant (R4A owns birth; nobody owns deletion)
 *   - write `authentication_disabled_at` — authentication POLICY is a different concern, and
 *     collapsing it into lifecycle would make the two indistinguishable forever
 *   - write `deleting_at`, `lifecycle_status`, `provisioning_source`, `created_by`, or `plan`
 *   - touch users, identities, credentials, memberships, roles, sessions, providers or permits
 *   - revoke a session — suspension is live-state enforcement, not session destruction
 *   - write `audit_log` — a terminal has no actor, and inventing one would put a claim in a
 *     tenant's ledger that no human made
 *   - run in production, or against a non-local database (the CLI refuses; see the sibling file)
 */
import type { Client } from "pg";

/**
 * The closed set of transitions. A third value has no representation here, which is what keeps
 * `deleting`/`deleted` out of R4B structurally rather than by convention.
 */
export type LifecycleTransition = "suspend" | "reactivate";

export const LIFECYCLE_TRANSITIONS: readonly LifecycleTransition[] = Object.freeze([
  "suspend",
  "reactivate",
]);

/** The only two statuses this module reads or writes. `provisioning`/`deleting`/`deleted` never appear. */
export const TENANT_STATUS_ACTIVE = "active";
export const TENANT_STATUS_SUSPENDED = "suspended";

/**
 * The most a suspension reason may carry.
 *
 * 128, mirroring `genesis_nominations.revocation_reason` — the repository's existing bounded
 * operator-entered reason. `companies.suspension_reason` is `varchar(256)`, so this is deliberately
 * NARROWER than the column: the bound is a policy, and being inside the schema's width means an
 * over-long reason is refused with a sentence rather than truncated or turned into a constraint
 * violation. Widening it later is a decision, not an accident.
 */
export const MAX_SUSPENSION_REASON_CHARACTERS = 128;

/** All C0 controls and DEL. A reason is one line, exactly as every other bounded reason here is. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

export interface TenantSummary {
  readonly tenantId: string;
  readonly name: string;
  readonly slug: string;
  readonly tenantStatus: string | null;
  readonly version: number;
  readonly suspensionReason: string | null;
}

export type LifecycleRefusal =
  /** The slug is empty or malformed, or a suspension carries no usable reason. */
  | "invalid-input"
  /** No tenant holds that slug. */
  | "tenant-not-found"
  /**
   * The tenant is not in the state this transition starts from — already suspended, already active,
   * or in a state R4B does not manage at all (`provisioning`, `deleting`, `deleted`). ONE reason,
   * because the operator's next step is the same in every case: look at the tenant.
   */
  | "not-in-expected-state";

export type LifecycleOutcome =
  | { readonly status: "changed"; readonly tenant: TenantSummary }
  | { readonly status: "refused"; readonly reason: LifecycleRefusal };

export function normalizeSlug(slug: string): string {
  return (slug ?? "").trim().toLowerCase();
}

/**
 * Validate a suspension reason. Required for suspend, unused for reactivate.
 *
 * Reactivation deliberately needs none: the row records the reason a tenant WAS suspended, and
 * clearing that field is the whole point of coming back. Inventing a second reason field to explain
 * the return would be a generalized reason framework, which R4B is not.
 */
export function validateSuspensionReason(reason: string): boolean {
  const trimmed = (reason ?? "").trim();
  if (trimmed.length === 0) return false;
  if (Array.from(trimmed).length > MAX_SUSPENSION_REASON_CHARACTERS) return false;
  if (CONTROL_CHARACTERS.test(trimmed)) return false;
  return true;
}

/** Read one tenant by slug. Read-only; used by the CLI to show the operator what they are about to do. */
export async function findTenantBySlug(
  client: Client,
  slug: string,
): Promise<TenantSummary | undefined> {
  const result = await client.query<{
    id: string;
    name: string;
    slug: string;
    tenant_status: string | null;
    version: number;
    suspension_reason: string | null;
  }>(
    `select id, name, slug, tenant_status, version, suspension_reason
       from companies
      where lower(slug) = $1
      limit 1`,
    [normalizeSlug(slug)],
  );
  const row = result.rows[0];
  return row
    ? {
        tenantId: row.id,
        name: row.name,
        slug: row.slug,
        tenantStatus: row.tenant_status,
        version: row.version,
        suspensionReason: row.suspension_reason,
      }
    : undefined;
}

function summarize(row: {
  id: string;
  name: string;
  slug: string;
  tenant_status: string | null;
  version: number;
  suspension_reason: string | null;
}): TenantSummary {
  return {
    tenantId: row.id,
    name: row.name,
    slug: row.slug,
    tenantStatus: row.tenant_status,
    version: row.version,
    suspensionReason: row.suspension_reason,
  };
}

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  tenant_status: string | null;
  version: number;
  suspension_reason: string | null;
};

/**
 * `active → suspended`.
 *
 * THE PREDICATE IS THE INVARIANT, not the read. `where tenant_status = 'active'` is part of the
 * UPDATE rather than a read-then-write, so two concurrent suspensions cannot both report success:
 * the loser updates zero rows and refuses. The same shape `retireExternalRecipient` already uses.
 *
 * Exactly five columns move, and the set is the whole contract: the status, when it changed, when it
 * was suspended, why, and the version. `authentication_disabled_at`, `deleting_at`,
 * `lifecycle_status`, `provisioning_source`, `plan` and every actor column stay exactly as they were.
 */
export async function suspendTenant(
  client: Client,
  input: { readonly slug: string; readonly reason: string },
): Promise<LifecycleOutcome> {
  const slug = normalizeSlug(input?.slug ?? "");
  const reason = (input?.reason ?? "").trim();
  if (slug.length === 0 || !validateSuspensionReason(reason)) {
    return { status: "refused", reason: "invalid-input" };
  }

  const existing = await findTenantBySlug(client, slug);
  if (!existing) return { status: "refused", reason: "tenant-not-found" };

  const updated = await client.query<CompanyRow>(
    `update companies
        set tenant_status = $1,
            tenant_status_changed_at = now(),
            suspended_at = now(),
            suspension_reason = $2,
            version = version + 1,
            updated_at = now()
      where id = $3
        and tenant_status = $4
      returning id, name, slug, tenant_status, version, suspension_reason`,
    [TENANT_STATUS_SUSPENDED, reason, existing.tenantId, TENANT_STATUS_ACTIVE],
  );

  const row = updated.rows[0];
  if (!row) return { status: "refused", reason: "not-in-expected-state" };
  return { status: "changed", tenant: summarize(row) };
}

/**
 * `suspended → active`.
 *
 * Clears the suspension evidence, because it describes a state the tenant is no longer in — the row
 * records the CURRENT state, and a stale "suspended because X" beside an active tenant would be a
 * lie. Recovering the history of suspensions would need a ledger, and R4B deliberately builds none.
 *
 * REACTIVATION RESTORES ELIGIBILITY, NOTHING ELSE. It creates no membership, no role, no session and
 * no permission. Sessions that were refused while suspended resume only if they independently remain
 * valid under their own TTL, membership-version and revocation rules — none of which this touches.
 */
export async function reactivateTenant(
  client: Client,
  input: { readonly slug: string },
): Promise<LifecycleOutcome> {
  const slug = normalizeSlug(input?.slug ?? "");
  if (slug.length === 0) return { status: "refused", reason: "invalid-input" };

  const existing = await findTenantBySlug(client, slug);
  if (!existing) return { status: "refused", reason: "tenant-not-found" };

  const updated = await client.query<CompanyRow>(
    `update companies
        set tenant_status = $1,
            tenant_status_changed_at = now(),
            suspended_at = null,
            suspension_reason = null,
            version = version + 1,
            updated_at = now()
      where id = $2
        and tenant_status = $3
      returning id, name, slug, tenant_status, version, suspension_reason`,
    [TENANT_STATUS_ACTIVE, existing.tenantId, TENANT_STATUS_SUSPENDED],
  );

  const row = updated.rows[0];
  if (!row) return { status: "refused", reason: "not-in-expected-state" };
  return { status: "changed", tenant: summarize(row) };
}
