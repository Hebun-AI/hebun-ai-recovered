/*
 * organization-authority/write-structure.server.ts — THE ORGANIZATION STRUCTURE AUTHORITY (OSA-1).
 *
 * This module owns exactly three facts and four transitions over ONE table:
 *
 *     NONEXISTENT DEPARTMENT   ->  RECORDED DEPARTMENT          create
 *     RECORDED DEPARTMENT      ->  RECORDED UNDER A NEW NAME    rename
 *     IN SERVICE               ->  RETIRED                      retire
 *     OWNERSHIP                ->  A DIFFERENT ACCOUNTABLE HUMAN set owner
 *
 * There is no delete, no restore, no un-retire and no merge. Those verbs are ABSENT rather than
 * guarded, which is the stronger claim: a caller cannot reach a capability that was never written.
 *
 * ── WHAT THIS AUTHORITY IS NOT ───────────────────────────────────────────────
 *
 * It writes `departments` and `audit_log`, and no other table. In particular it never writes
 * `companies`, `memberships`, `roles`, `agents`, `agent_mandates`, `decision_records`,
 * `governance_sessions`, any knowledge table, or `organizations`. A firewall test walks this file's
 * real import graph and asserts it.
 *
 * ── OWNERSHIP GRANTS NOTHING ─────────────────────────────────────────────────
 *
 *   DEPARTMENT OWNER != GOVERNANCE AUTHORITY   DEPARTMENT OWNER != APPROVER
 *   DEPARTMENT OWNER != PERMIT HOLDER          DEPARTMENT       != ROLE
 *
 * `resolveGovernanceAuthority` reads `decision_records.bootstrap` and active delegations, and
 * consults no department. Every approve/authorize surface stays CHECK-constrained to a human
 * resolved that way. Nothing in this repository reads `departments.owner_actor_id` to decide
 * anything — this authority publishes attribution, and attribution is not authority.
 *
 * ── THE GATE, AND WHY IT WRITES NO DECISION ──────────────────────────────────
 *
 * The administrative gate is the tenant's EXISTING Governance authority holder — bootstrap human or
 * active delegate — consumed through `resolveGovernanceAuthority` as PERMISSION TO WRITE STRUCTURE
 * and never as a decision. No `decision_records` row is written by any path here, and no
 * `governance_domain` value was added. See `structure-contracts.ts` for the measured reason; the
 * released precedent is R6D, which mutates Knowledge under its own band and writes audit alone.
 *
 * ── THE OWNER MUST BE A REAL, ACTIVE MEMBER OF THIS TENANT ───────────────────
 *
 * Verified inside the transaction against `memberships`, by a predicate over ONE supplied id. That
 * is not a roster: it cannot enumerate anybody, returns no name and no email, and L3's rule — "a
 * COUNT, never a roster" — is untouched. A caller who does not already know a member's id learns
 * nothing from a refusal, because `owner-not-active-member` is returned identically for "not a
 * member of this tenant" and "not a member of any tenant".
 *
 * ── ONE TRANSACTION, OR NOTHING ──────────────────────────────────────────────
 *
 * Every mutation and its audit row commit together or neither does. `departments` and `audit_log`
 * live in the same control-plane database, so this needs no distributed-transaction machinery and
 * invents none — exactly as K3, K4 and R6D already arrange it.
 *
 * Server-only.
 */
import { and, eq, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { departments } from "@/db/schema/department";
import { memberships } from "@/db/schema/membership";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import { recordDepartmentEventWithin } from "@/features/governance-audit/organization-structure-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { ACTIVE_LIFECYCLE_STATUS, RETIRED_LIFECYCLE_STATUS } from "./read-structure.server";
import {
  DEPARTMENT_AUDIT_CREATED,
  DEPARTMENT_AUDIT_OWNER_SET,
  DEPARTMENT_AUDIT_RENAMED,
  DEPARTMENT_AUDIT_RETIRED,
  isWellFormedDepartmentName,
  isWellFormedDepartmentSlug,
  type DepartmentRefusal,
} from "./structure-contracts";

export interface StructureWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
}

/** What a caller learns on success. Narrow on purpose: the identity, and what it now says. */
export interface RecordedDepartment {
  readonly departmentId: string;
  readonly name: string;
  readonly slug: string;
  readonly lifecycleStatus: string;
  readonly ownerActorId: string | null;
}

export type DepartmentWriteResult =
  | { readonly status: "recorded"; readonly department: RecordedDepartment }
  | { readonly status: "refused"; readonly reason: DepartmentRefusal };

const refuse = (reason: DepartmentRefusal): DepartmentWriteResult => ({
  status: "refused",
  reason,
});

/** PostgreSQL's `unique_violation`. The partial slug index is the concurrency guarantee. */
const UNIQUE_VIOLATION = "23505";

/**
 * Drizzle WRAPS a driver error, and the wrapper carries no `code` of its own — the SQLSTATE lives
 * on `cause`. Checking only the outer object silently classifies every duplicate slug as
 * `authority-unavailable`, which is the wrong refusal AND an untrue one: the authority was reached
 * and answered. Both positions are read, so the check survives an unwrapped error too.
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const shaped = error as { code?: unknown; cause?: { code?: unknown } };
  return shaped.code === UNIQUE_VIOLATION || shaped.cause?.code === UNIQUE_VIOLATION;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Organization structure writes are server-only.");
  }
}

function resolveDbOrNull(deps: StructureWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * The gate, applied identically by every mutation.
 *
 * ORDER IS THE GUARANTEE, and it is K2's order for K2's reason: authorization BEFORE the subject is
 * looked at, so an unauthorized caller cannot use the refusals as an oracle for which departments a
 * tenant holds.
 */
async function gate(
  tenant: TenantContext | null,
  deps: StructureWriteDeps,
): Promise<
  | { readonly ok: true; readonly db: ControlPlaneDatabase; readonly now: Date }
  | { readonly ok: false; readonly result: DepartmentWriteResult }
> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) {
    return { ok: false, result: refuse("no-authorized-tenant-context") };
  }

  const authority = await (deps.resolveAuthority ?? resolveGovernanceAuthority)(tenant);
  if (!authority.authorized) return { ok: false, result: refuse("not-authorized") };

  const db = resolveDbOrNull(deps);
  if (!db) return { ok: false, result: refuse("authority-unavailable") };

  return { ok: true, db, now: (deps.now ?? (() => new Date()))() };
}

/**
 * Is this id an ACTIVE human member of this tenant?
 *
 * ONE id, this tenant, inside the caller's transaction. It answers a yes/no about a value the caller
 * already holds; it cannot list, page or discover anybody. This is why OSA-1 ships no roster and
 * still refuses an owner who does not belong here.
 */
async function isActiveMember(
  tx: { select: ControlPlaneDatabase["select"] },
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: memberships.id })
    .from(memberships)
    .where(
      and(
        eq(memberships.tenantId, tenantId),
        eq(memberships.userId, userId),
        eq(memberships.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * RECORD THAT A DEPARTMENT EXISTS.
 *
 * `ownerUserId` is OPTIONAL: a department can be recorded before anyone is made accountable for it,
 * and "no owner recorded" is a real organizational state. When supplied it must resolve to an
 * active human member of this tenant.
 *
 * Duplicate ACTIVE slugs are refused by `departments_tenant_slug_active_uq` rather than by a
 * pre-check — under concurrency a pre-check is not uniqueness, and two callers would both read zero
 * and both insert. The index makes one commit and one `unique_violation`, with no table lock.
 */
export async function recordDepartment(
  tenant: TenantContext | null,
  input: {
    readonly name: string;
    readonly slug: string;
    readonly ownerUserId?: string | null;
  },
  deps: StructureWriteDeps = {},
): Promise<DepartmentWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  const { db, now } = gated;
  const authenticated = tenant as TenantContext;

  if (!isWellFormedDepartmentName(input?.name)) return refuse("malformed-department-name");
  if (!isWellFormedDepartmentSlug(input?.slug)) return refuse("malformed-department-slug");
  const ownerUserId = input.ownerUserId ?? null;

  try {
    let outcome: DepartmentWriteResult | null = null;

    await db.transaction(async (tx) => {
      if (ownerUserId !== null) {
        const active = await isActiveMember(tx, authenticated.tenantId, ownerUserId);
        if (!active) {
          outcome = refuse("owner-not-active-member");
          return;
        }
      }

      const inserted = await tx
        .insert(departments)
        .values({
          tenantId: authenticated.tenantId,
          name: input.name,
          slug: input.slug,
          /* Legacy, and unrepresentable by CHECK. Stated here so nobody has to guess. */
          organizationId: null,
          ownerActorType: ownerUserId === null ? null : "human",
          ownerActorId: ownerUserId,
          createdBy: authenticated.userId,
          createdByType: "human",
          updatedBy: authenticated.userId,
          updatedByType: "human",
        })
        .returning({
          id: departments.id,
          name: departments.name,
          slug: departments.slug,
          lifecycleStatus: departments.lifecycleStatus,
          ownerActorId: departments.ownerActorId,
        });

      const row = inserted[0]!;
      await recordDepartmentEventWithin(
        tx,
        auditActorFrom(authenticated),
        {
          action: DEPARTMENT_AUDIT_CREATED,
          departmentId: row.id,
          slug: row.slug,
          ownerActorId: row.ownerActorId,
        },
        now,
      );

      outcome = {
        status: "recorded",
        department: {
          departmentId: row.id,
          name: row.name,
          slug: row.slug,
          lifecycleStatus: row.lifecycleStatus,
          ownerActorId: row.ownerActorId,
        },
      };
    });

    return outcome ?? refuse("authority-unavailable");
  } catch (error) {
    if (isUniqueViolation(error)) return refuse("duplicate-active-slug");
    return refuse("authority-unavailable");
  }
}

/**
 * The shared update path. Locks the target row FOR UPDATE inside the transaction, so a concurrent
 * rename and retire cannot interleave into a state neither caller intended.
 *
 * `department-unresolved` is returned for another tenant's department exactly as it is for one that
 * never existed — the two are indistinguishable to a caller, which is the point.
 */
async function mutateDepartment(
  tenant: TenantContext | null,
  departmentId: string,
  deps: StructureWriteDeps,
  apply: (context: {
    readonly tx: Parameters<Parameters<ControlPlaneDatabase["transaction"]>[0]>[0];
    readonly tenantId: string;
    readonly userId: string;
    readonly now: Date;
    readonly current: {
      readonly id: string;
      readonly name: string;
      readonly slug: string;
      readonly lifecycleStatus: string;
      readonly ownerActorId: string | null;
    };
  }) => Promise<DepartmentWriteResult>,
): Promise<DepartmentWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  const { db, now } = gated;
  const authenticated = tenant as TenantContext;

  if (typeof departmentId !== "string" || departmentId.length === 0) {
    return refuse("department-unresolved");
  }

  try {
    let outcome: DepartmentWriteResult | null = null;

    await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: departments.id,
          name: departments.name,
          slug: departments.slug,
          lifecycleStatus: departments.lifecycleStatus,
          ownerActorId: departments.ownerActorId,
        })
        .from(departments)
        .where(
          and(eq(departments.tenantId, authenticated.tenantId), eq(departments.id, departmentId)),
        )
        .for("update")
        .limit(1);

      const current = rows[0];
      if (!current) {
        outcome = refuse("department-unresolved");
        return;
      }
      if (current.lifecycleStatus !== ACTIVE_LIFECYCLE_STATUS) {
        outcome = refuse("department-retired");
        return;
      }

      outcome = await apply({
        tx,
        tenantId: authenticated.tenantId,
        userId: authenticated.userId,
        now,
        current,
      });
    });

    return outcome ?? refuse("authority-unavailable");
  } catch (error) {
    if (isUniqueViolation(error)) return refuse("duplicate-active-slug");
    return refuse("authority-unavailable");
  }
}

/** Change what a department is called, and optionally its identifier. */
export async function renameDepartment(
  tenant: TenantContext | null,
  input: { readonly departmentId: string; readonly name: string; readonly slug?: string },
  deps: StructureWriteDeps = {},
): Promise<DepartmentWriteResult> {
  if (!isWellFormedDepartmentName(input?.name)) return refuse("malformed-department-name");
  if (input?.slug !== undefined && !isWellFormedDepartmentSlug(input.slug)) {
    return refuse("malformed-department-slug");
  }

  return mutateDepartment(tenant, input.departmentId, deps, async (ctx) => {
    const slug = input.slug ?? ctx.current.slug;
    const updated = await ctx.tx
      .update(departments)
      .set({
        name: input.name,
        slug,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
        updatedByType: "human",
        version: sql`${departments.version} + 1`,
      })
      .where(and(eq(departments.tenantId, ctx.tenantId), eq(departments.id, ctx.current.id)))
      .returning({
        id: departments.id,
        name: departments.name,
        slug: departments.slug,
        lifecycleStatus: departments.lifecycleStatus,
        ownerActorId: departments.ownerActorId,
      });

    const row = updated[0]!;
    await recordDepartmentEventWithin(
      ctx.tx,
      auditActorFrom(tenant as TenantContext),
      { action: DEPARTMENT_AUDIT_RENAMED, departmentId: row.id, slug: row.slug },
      ctx.now,
    );

    return {
      status: "recorded",
      department: {
        departmentId: row.id,
        name: row.name,
        slug: row.slug,
        lifecycleStatus: row.lifecycleStatus,
        ownerActorId: row.ownerActorId,
      },
    };
  });
}

/**
 * WITHDRAW A DEPARTMENT FROM SERVICE.
 *
 * A withdrawal, not a deletion: the row, the name, the slug, the ownership and the creation record
 * all survive, and the department stays readable with `inService: false`. Retiring releases the
 * slug for re-use, because the uniqueness index is partial on `active` — recording "finance" again
 * later is a legitimate organizational act.
 *
 * There is no un-retire. Nothing in this module returns a retired department to service.
 */
export async function retireDepartment(
  tenant: TenantContext | null,
  input: { readonly departmentId: string },
  deps: StructureWriteDeps = {},
): Promise<DepartmentWriteResult> {
  return mutateDepartment(tenant, input.departmentId, deps, async (ctx) => {
    const updated = await ctx.tx
      .update(departments)
      .set({
        lifecycleStatus: RETIRED_LIFECYCLE_STATUS,
        deletedAt: ctx.now,
        deletedBy: ctx.userId,
        deletedByType: "human",
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
        updatedByType: "human",
        version: sql`${departments.version} + 1`,
      })
      .where(and(eq(departments.tenantId, ctx.tenantId), eq(departments.id, ctx.current.id)))
      .returning({
        id: departments.id,
        name: departments.name,
        slug: departments.slug,
        lifecycleStatus: departments.lifecycleStatus,
        ownerActorId: departments.ownerActorId,
      });

    const row = updated[0]!;
    await recordDepartmentEventWithin(
      ctx.tx,
      auditActorFrom(tenant as TenantContext),
      { action: DEPARTMENT_AUDIT_RETIRED, departmentId: row.id, slug: row.slug },
      ctx.now,
    );

    return {
      status: "recorded",
      department: {
        departmentId: row.id,
        name: row.name,
        slug: row.slug,
        lifecycleStatus: row.lifecycleStatus,
        ownerActorId: row.ownerActorId,
      },
    };
  });
}

/**
 * NAME THE ACCOUNTABLE HUMAN, or clear the record of one.
 *
 * `ownerUserId: null` clears ownership — "nobody is currently accountable" is a real state and must
 * stay recordable. A non-null id must resolve to an active human member of THIS tenant, verified
 * inside the transaction.
 *
 * This grants the named human nothing. See the module header.
 */
export async function setDepartmentOwner(
  tenant: TenantContext | null,
  input: { readonly departmentId: string; readonly ownerUserId: string | null },
  deps: StructureWriteDeps = {},
): Promise<DepartmentWriteResult> {
  return mutateDepartment(tenant, input.departmentId, deps, async (ctx) => {
    const ownerUserId = input.ownerUserId ?? null;
    if (ownerUserId !== null) {
      const active = await isActiveMember(ctx.tx, ctx.tenantId, ownerUserId);
      if (!active) return refuse("owner-not-active-member");
    }

    const updated = await ctx.tx
      .update(departments)
      .set({
        ownerActorType: ownerUserId === null ? null : "human",
        ownerActorId: ownerUserId,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
        updatedByType: "human",
        version: sql`${departments.version} + 1`,
      })
      .where(and(eq(departments.tenantId, ctx.tenantId), eq(departments.id, ctx.current.id)))
      .returning({
        id: departments.id,
        name: departments.name,
        slug: departments.slug,
        lifecycleStatus: departments.lifecycleStatus,
        ownerActorId: departments.ownerActorId,
      });

    const row = updated[0]!;
    await recordDepartmentEventWithin(
      ctx.tx,
      auditActorFrom(tenant as TenantContext),
      {
        action: DEPARTMENT_AUDIT_OWNER_SET,
        departmentId: row.id,
        slug: row.slug,
        ownerActorId: row.ownerActorId,
      },
      ctx.now,
    );

    return {
      status: "recorded",
      department: {
        departmentId: row.id,
        name: row.name,
        slug: row.slug,
        lifecycleStatus: row.lifecycleStatus,
        ownerActorId: row.ownerActorId,
      },
    };
  });
}
