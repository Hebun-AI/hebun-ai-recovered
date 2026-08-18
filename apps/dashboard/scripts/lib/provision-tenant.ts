/*
 * Tenant bootstrap — the R4A ceremony, separated from the CLI so a real database can prove its
 * semantics without driving an interactive prompt.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * Until R4A the only thing in this repository that could create a tenant was `scripts/r1-seed.mjs`,
 * a two-fixture seed that raw-inserts `companies`, `users`, `auth_identities`, `roles` and
 * `memberships` in one block. Every authority the program built — I1, I1.2, G2, G2.1, G3,
 * tenant-role-baseline — was bypassed by it. This ceremony replaces the tenant half of that with a
 * single audited-by-shape transaction, and refuses to do the identity half at all.
 *
 * ── THE BOOTSTRAP EXCEPTION, AND WHY IT IS NARROW ────────────────────────────
 *
 * The normal writers cannot enter the bootstrap cycle, and the cycle is closed by foreign keys, not
 * by convention:
 *
 *   memberships   ← only `accept-invitation` writes it, and it needs an invitation
 *   invitations   ← needs a membership_authorization
 *   membership_authorizations
 *                 ← `governance_decision_id` and `governance_session_id` are BOTH NOT NULL
 *   decision_records / governance_sessions
 *                 ← only G2 writes them, and G2 needs an ACCEPTED genesis nomination
 *   genesis_nominations
 *                 ← composite FK (tenant_id, nominated_user_id) → memberships (tenant_id, user_id)
 *
 * So a brand-new tenant can never reach Genesis, because Genesis needs a membership that needs an
 * invitation that needs a Governance decision that needs Genesis. The cut point cannot be moved
 * later than `memberships`: everything after it is structurally reachable, everything before it is
 * not.
 *
 * This ceremony therefore writes EXACTLY THREE TABLES — `companies`, `roles`, `memberships` — and
 * that is the whole exception. It is not a membership writer, not role administration, not an
 * organization writer, not an invitation or enrollment bypass, and not an application API. After it
 * commits, every later human, membership and role operation returns to the authorities that own
 * them.
 *
 * ── WHY IT LIVES UNDER `scripts/` ────────────────────────────────────────────
 *
 * `tsconfig.json` maps `@/*` to `./src/*` only, so nothing under `scripts/` is reachable from a
 * server action, a route or a component. Placing the exception here makes "this must never become a
 * runtime writer" a build-graph fact rather than a promise — the same reason G2.1's nomination and
 * D1.1's credential provisioning live here. A test enforces it anyway.
 *
 * ── THE ROOT OF TRUST, STATED HONESTLY ───────────────────────────────────────
 *
 * Authority to run this is POSSESSION OF THE LOCAL DEPLOYMENT. Hebun cannot cryptographically
 * identify the human at the terminal, so the row records WHICH ROOT produced it
 * (`provisioning_source`) and never claims WHO operated it. Not a platform admin, not a certified
 * operator, not a Governance authority. `created_by` stays NULL on everything this writes, because
 * there is no honest actor to name — the same reason no `audit_log` row is written.
 *
 * ── WHAT IT DELIBERATELY CANNOT DO ───────────────────────────────────────────
 *
 *   - create a user, an auth identity or a credential (Decision 1: the human must already exist)
 *   - nominate or accept genesis, establish G2, or create a governance session
 *   - provision the `member` baseline role, authorize a membership, or issue an invitation
 *   - write audit_log, provider controls, knowledge, actions, recipients or artifacts
 *   - modify an existing tenant — a duplicate slug is refused, never updated
 *   - run against a non-local database (the CLI refuses; see scripts/tenant-provision.ts)
 */
import type { Client } from "pg";
import type { CeremonySource } from "./production-possession";

/** Mirrors the value the schema's CHECK constraint permits. */
export const TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony";

/**
 * G4. The root is now a PARAMETER, and deliberately not an argument, a flag or a default.
 *
 * It is derived by `resolveCeremonyPosture()` from the deployment possession signal and cannot be
 * chosen at the command line: a ceremony that could be told to claim it was a production ceremony
 * would make `provisioning_source` — the ONLY evidence tenant birth leaves — a value the caller
 * picks rather than a fact about which deployment was possessed.
 *
 * Note what did NOT change. The row still records a SOURCE and never an ACTOR, `created_by` still
 * stays NULL, and no `audit_log` row is written in either posture, for the same reason as before:
 * a terminal has no honest actor to name.
 */

/**
 * The band the bootstrap role carries.
 *
 * `owner` is existing canonical vocabulary (`roleTypeEnum`), not a new one. It is also the ONLY
 * band this ceremony may write: `ONBOARDING_EXCLUDED_ROLE_TYPES` keeps `owner` off the invitation
 * path forever, so bootstrap is the only possible origin of an owner role — which is exactly why
 * this exception is needed and exactly why it stays one literal.
 *
 * IT GRANTS REAL PRODUCT AUTHORITY BEFORE GENESIS, and that is deliberate rather than overlooked.
 * `roles.type` is consulted for NOTHING by Governance (`decision-authority.server.ts` says so
 * explicitly), but `PROVIDER_CONTROL_ROLE_TYPES` and `KNOWLEDGE_AUTHOR_ROLE_TYPES` both admit
 * `owner`. The first human can therefore author Knowledge and reach the provider control the moment
 * they sign in — and that control is global across tenants, which is recorded R5 debt.
 */
export const BOOTSTRAP_ROLE_TYPE = "owner";
/** Matches the name `scripts/r1-seed.mjs` already gives the seeded owner role. */
export const BOOTSTRAP_ROLE_NAME = "Owner";

export interface ProvisionTenantInput {
  readonly slug: string;
  readonly displayName: string;
  readonly identityEmail: string;
  /**
   * Which deployment root produced this tenant. Supplied by the CLI from the resolved posture.
   * Defaults to the local root so every released caller and test keeps its exact prior behaviour.
   */
  readonly provisioningSource?: CeremonySource;
}

/** An existing human, resolved before anything is written. */
export interface ResolvedHuman {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly email: string;
}

export interface ProvisionedTenant {
  readonly tenantId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly roleId: string;
  readonly membershipId: string;
  readonly human: ResolvedHuman;
}

export type ProvisionRefusal =
  /** The slug, display name or email is empty or malformed. Nothing was read. */
  | "invalid-input"
  /** No ACTIVE human with that email holds an ACTIVE local identity. Nothing was written. */
  | "identity-not-found"
  /** A tenant already occupies this slug. It was NOT modified. */
  | "slug-already-taken";

export type ProvisionOutcome =
  | { readonly status: "provisioned"; readonly tenant: ProvisionedTenant }
  | { readonly status: "refused"; readonly reason: ProvisionRefusal };

/** The most a slug or display name may carry. Bounds, not policy. */
export const MAX_SLUG_CHARACTERS = 64;
export const MAX_DISPLAY_NAME_CHARACTERS = 200;

/**
 * Slugs are lowercase alphanumeric with single internal hyphens.
 *
 * Deliberately NOT a sanitizer: a slug that does not match is REFUSED, never rewritten. Silently
 * turning `Acme Corp` into `acme-corp` would mean the operator confirmed one identifier and the
 * database received another, and the confirmation prompt exists precisely so that cannot happen.
 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** All C0 controls and DEL. A display name is one line. */
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F]/;

function refused(reason: ProvisionRefusal): ProvisionOutcome {
  return { status: "refused", reason };
}

/** Normalize only what is a lookup key. The display name is stored as the operator typed it. */
export function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Validate the input shape. Pure — no database, no clock. */
export function validateProvisionInput(input: ProvisionTenantInput): boolean {
  const slug = normalizeSlug(input?.slug ?? "");
  const displayName = (input?.displayName ?? "").trim();
  const email = normalizeEmail(input?.identityEmail ?? "");

  if (slug.length === 0 || slug.length > MAX_SLUG_CHARACTERS) return false;
  if (!SLUG_PATTERN.test(slug)) return false;
  if (displayName.length === 0 || displayName.length > MAX_DISPLAY_NAME_CHARACTERS) return false;
  if (CONTROL_CHARACTERS.test(displayName)) return false;
  /* Deliberately minimal: an address must be present and single-line. Whether it is deliverable is
   * not this ceremony's question — the identity authority already decided the human exists. */
  if (email.length === 0 || !email.includes("@") || CONTROL_CHARACTERS.test(email)) return false;
  return true;
}

/**
 * Resolve an EXISTING active human by email.
 *
 * The predicate is the identity half of `resolveNominationTarget`, minus the tenant and membership
 * joins that cannot exist yet. It creates nothing: Director Decision 1 is that R4A requires a
 * pre-existing human, so `users`, `auth_identities` and `auth_credentials` remain owned by D1/I1.2
 * and no fallback exists here.
 *
 * `users_email_uq` is a GLOBAL unique, so one address names at most one human installation-wide.
 * The `order by` is a determinism guarantee for a human who somehow holds several active identities,
 * not a preference.
 */
export async function resolveExistingHuman(
  client: Client,
  email: string,
): Promise<ResolvedHuman | undefined> {
  const result = await client.query<{
    user_id: string;
    auth_identity_id: string;
    email: string;
  }>(
    `select u.id as user_id,
            i.id as auth_identity_id,
            u.email as email
       from users u
       join auth_identities i on i.user_id = u.id
      where lower(u.email) = $1
        and u.lifecycle_status = 'active'
        and i.status = 'active'
        and i.lifecycle_status = 'active'
        and i.revoked_at is null
      order by i.created_at asc
      limit 1`,
    [normalizeEmail(email)],
  );
  const row = result.rows[0];
  return row
    ? { userId: row.user_id, authIdentityId: row.auth_identity_id, email: row.email }
    : undefined;
}

/**
 * The tenant already occupying this slug, if any.
 *
 * Reported so the operator gets a truthful message instead of a raw constraint error. It is NOT the
 * protection: `companies_slug_uq` is, and a concurrent ceremony that slips past this read is still
 * refused by Postgres and rolled back whole.
 */
export async function findTenantBySlug(
  client: Client,
  slug: string,
): Promise<{ readonly tenantId: string; readonly name: string } | undefined> {
  const result = await client.query<{ id: string; name: string }>(
    `select id, name from companies where lower(slug) = $1 limit 1`,
    [normalizeSlug(slug)],
  );
  const row = result.rows[0];
  return row ? { tenantId: row.id, name: row.name } : undefined;
}

/**
 * The whole ceremony, in ONE transaction.
 *
 *   1. resolve the existing active identity   (refuse before any write if absent)
 *   2. check the slug is unclaimed            (courtesy read; the unique index is the invariant)
 *   3. insert companies, tenant_status='provisioning'
 *   4. insert the owner role
 *   5. insert the bootstrap membership
 *   6. move the company to 'active'
 *
 * Any failure rolls back all of it. `provisioning` is transient INSIDE the transaction and is never
 * observable by any reader, so there is no incomplete tenant to recover and deliberately no recovery
 * state machine — the operator simply re-runs the command.
 *
 * There is no `on conflict` anywhere. `scripts/r1-seed.mjs` uses one because it is a re-runnable
 * fixture; a ceremony that silently renamed an existing tenant on re-run would be a cross-tenant
 * mutation wearing an idempotency label.
 */
export async function provisionTenant(
  client: Client,
  input: ProvisionTenantInput,
): Promise<ProvisionOutcome> {
  if (!validateProvisionInput(input)) return refused("invalid-input");

  const slug = normalizeSlug(input.slug);
  const displayName = input.displayName.trim();
  const email = normalizeEmail(input.identityEmail);

  const human = await resolveExistingHuman(client, email);
  if (!human) return refused("identity-not-found");

  await client.query("begin");
  try {
    const claimed = await findTenantBySlug(client, slug);
    if (claimed) {
      await client.query("rollback");
      return refused("slug-already-taken");
    }

    /*
     * THE TENANT. `plan` is omitted so the column keeps its own default — R4A assigns it no
     * meaning, and writing 'free' here would be this ceremony quietly claiming a billing concept
     * that has no consumer. `created_by` / `created_by_type` are omitted for the same reason they
     * are omitted everywhere below: there is no honest actor.
     */
    const company = await client.query<{ id: string }>(
      `insert into companies (name, slug, tenant_status, provisioning_source)
       values ($1, $2, 'provisioning', $3)
       returning id`,
      [displayName, slug, input.provisioningSource ?? TENANT_PROVISIONING_SOURCE_LOCAL_OPERATOR],
    );
    const tenantId = company.rows[0]!.id;

    /*
     * THE OWNER ROLE. Shape copied from the one existing role writer
     * (`tenant-role-baseline/provision-member-role.server.ts`): `system_role` false because this is
     * an ordinary tenant role and not a built-in, `authority_rank` and `policy_refs` left NULL
     * because no runtime reads them and populating them would invent an authority.
     *
     * It does not collide with the later `member` baseline: `roles_one_member_per_tenant_uq` is
     * PARTIAL on `type = 'member'`, so the privileged bands are unconstrained and
     * `provision-member-role` guards only on its own band.
     */
    const role = await client.query<{ id: string }>(
      `insert into roles (tenant_id, name, type, system_role)
       values ($1, $2, $3, false)
       returning id`,
      [tenantId, BOOTSTRAP_ROLE_NAME, BOOTSTRAP_ROLE_TYPE],
    );
    const roleId = role.rows[0]!.id;

    /*
     * THE BOOTSTRAP MEMBERSHIP. `status` is written because the column is nullable and every read
     * seam filters `status = 'active'` — a NULL membership is invisible to sign-in.
     *
     * `accepted_invitation_id` stays NULL, and that is the truthful value: no invitation exists.
     * `memberships_accepted_invitation_uq` is a plain UNIQUE, and Postgres treats NULLs as distinct,
     * so any number of bootstrap memberships coexist with invited ones. Nothing is fabricated here —
     * no invitation id, no authorization id, no delegating actor, no created-by.
     */
    const membership = await client.query<{ id: string }>(
      `insert into memberships (tenant_id, user_id, role_id, status, status_changed_at)
       values ($1, $2, $3, 'active', now())
       returning id`,
      [tenantId, human.userId, roleId],
    );
    const membershipId = membership.rows[0]!.id;

    /*
     * ACTIVE, in the same transaction as the membership. There is therefore no window in which a
     * tenant is active and memberless, and none in which `provisioning` is durable.
     *
     * The predicate names the id created above, so this statement is structurally incapable of
     * touching another tenant's row.
     */
    await client.query(
      `update companies
          set tenant_status = 'active', tenant_status_changed_at = now(), updated_at = now()
        where id = $1`,
      [tenantId],
    );

    await client.query("commit");
    return {
      status: "provisioned",
      tenant: { tenantId, slug, displayName, roleId, membershipId, human },
    };
  } catch (error) {
    await client.query("rollback");
    /*
     * A unique violation here is `companies_slug_uq` deciding a race the courtesy read could not.
     * The database refusing a second tenant on one slug is the expected, correct outcome — not an
     * error condition — and the rollback has already removed the losing role and membership.
     */
    if (isUniqueViolation(error)) return refused("slug-already-taken");
    throw error;
  }
}

/** Postgres unique_violation. The database enforcing one tenant per slug. */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
