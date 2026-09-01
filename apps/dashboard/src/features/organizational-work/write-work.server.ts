/*
 * organizational-work/write-work.server.ts — THE ORGANIZATIONAL WORK AUTHORITY (WORK-1).
 *
 * The ONE place a row in `work_items` is created or changed. Five mutations, no delete, and nothing
 * else in the repository writes this table.
 *
 * ── WHAT IT OWNS, AND WHAT IT ONLY REFERENCES ────────────────────────────────
 *
 * OWNS: that the work exists, its title, its lifecycle, its declared state, and the ASSIGNMENT of
 * an accountable human.
 *
 * REFERENCES: the department (Organization Structure Authority owns it) and the human (Identity and
 * Membership Authority own them). This module reads each one only to VERIFY a value the caller
 * already supplied — never to discover, list or page anybody. It cannot learn a name: no column
 * carrying one is selected anywhere below.
 *
 * ── THE SHAPE OF EVERY MUTATION, AND WHY IT IS NOT THE PERMIT CHAIN ──────────
 *
 *   authenticated tenant context
 *     -> resolveGovernanceAuthority
 *       -> db.transaction
 *         -> SELECT ... FOR UPDATE (tenant-scoped)
 *           -> authoritative mutation
 *             -> audit row, IN THE SAME TRANSACTION
 *               -> typed result, never a throw
 *
 * Recording work MOVES NO AUTHORITY. It grants no permission, reaches nothing outside Hebun,
 * touches no provider, and is reversible by the same authority that performed it. The permit chain
 * — `heby_action_requests` -> `action_permits` -> `action_execution_attempts` — exists for
 * consequential IRREVERSIBLE acts in the world. Manufacturing a decision record for an
 * administrative state change would make Governance a workflow step instead of an authority, and
 * would put rows in `decision_records` that decide nothing. So this module follows the released
 * OSA-1 and R6D pattern instead: authorized human -> authoritative mutation -> audit, and NO
 * `decision_records` row anywhere.
 *
 * ── ELIGIBILITY IS NOT REDEFINED HERE ────────────────────────────────────────
 *
 * The accountable human is checked with `eligibleTenantMemberWhere` — the shared six-condition
 * predicate Identity owns, the same one the department owner writer and the product's member picker
 * both consume. WORK-1 invents no second definition, because the last time two call sites re-typed
 * this rule they drifted, and an authority accepted a human whose membership had been revoked.
 *
 *     THE UI HIDING SOMEBODY IS NOT ENFORCEMENT. THIS IS.
 *
 * ── AN AGENT CANNOT BE ACCOUNTABLE, AND NOT BECAUSE OF THIS FILE ─────────────
 *
 * `accountableActorType` is written as the literal `"human"` here and nowhere accepts input, and
 * `work_items_human_accountable_chk` rejects any other value at the database. Deleting every line
 * of this module would not make an agent accountable for organizational work.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { departments } from "@/db/schema/department";
import { memberships } from "@/db/schema/membership";
import { users } from "@/db/schema/user";
import { workItems } from "@/db/schema/work-item";
import {
  eligibleTenantMemberWhere,
  joinUsersToMemberships,
} from "@/features/auth-runtime/member-eligibility";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  auditActorFrom,
  recordWorkEventWithin,
} from "@/features/governance-audit/organizational-work-audit.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  isWellFormedWorkTitle,
  isWorkDeclaredState,
  WORK_AUDIT_ACCOUNTABLE_SET,
  WORK_AUDIT_RECORDED,
  WORK_AUDIT_RETIRED,
  WORK_AUDIT_RETITLED,
  WORK_AUDIT_STATE_DECLARED,
  type WorkDeclaredState,
  type WorkRefusal,
} from "./work-contracts";
import { ACTIVE_LIFECYCLE_STATUS, RETIRED_LIFECYCLE_STATUS } from "./read-work.server";

export interface WorkWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveAuthority?: (
    tenant: TenantContext | null,
  ) => Promise<{ readonly authorized: boolean }>;
  readonly now?: () => Date;
}

/** What the writer returns on success — the canonical row, as recorded. */
export interface RecordedWorkItem {
  readonly workItemId: string;
  readonly title: string;
  readonly declaredState: WorkDeclaredState;
  readonly lifecycleStatus: string;
  readonly departmentId: string | null;
  readonly accountableActorId: string | null;
}

export type WorkWriteResult =
  | { readonly status: "recorded"; readonly workItem: RecordedWorkItem }
  | { readonly status: "refused"; readonly reason: WorkRefusal };

function refuse(reason: WorkRefusal): WorkWriteResult {
  return { status: "refused", reason };
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Organizational work mutations are server-only.");
  }
}

function resolveDbOrNull(deps: WorkWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * THE GATE, and there is exactly one.
 *
 * Server-only, an authenticated tenant AND human from the session, this tenant's own Governance
 * authority, and a reachable control plane. Any of the four missing is a typed refusal, never a
 * partial write and never a fallback to memory.
 */
async function gate(
  tenant: TenantContext | null,
  deps: WorkWriteDeps,
): Promise<
  | { readonly ok: true; readonly db: ControlPlaneDatabase; readonly now: Date }
  | { readonly ok: false; readonly result: WorkWriteResult }
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
 * Is this id a CURRENTLY ELIGIBLE human member of this tenant?
 *
 * ONE id, this tenant, inside the caller's transaction. It answers a yes/no about a value the caller
 * already holds; it cannot list, page or discover anybody — which is why WORK-1 ships no roster and
 * still refuses an accountable human who does not belong here.
 *
 * The predicate is the SHARED one. All six conditions apply: the tenant, the membership status, the
 * membership revocation timestamp, the membership lifecycle, the identity lifecycle and the identity
 * soft-delete. The projection is `memberships.id`: no name, no display name and no email is
 * selected, so this check buys the writer no ability to describe anybody.
 */
async function isEligibleMember(
  tx: { select: ControlPlaneDatabase["select"] },
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: memberships.id })
    .from(users)
    .innerJoin(memberships, joinUsersToMemberships())
    .where(eligibleTenantMemberWhere(tenantId, userId))
    .limit(1);
  return rows.length > 0;
}

/**
 * Does this tenant have an ACTIVE department with this id?
 *
 * The composite foreign key already makes a cross-tenant department unrepresentable, so this check
 * is not the tenant boundary — it is the LIFECYCLE one the FK cannot express: work should not be
 * filed against a department the organization has retired. A retired department keeps its existing
 * references; it just stops accepting new ones.
 */
async function isActiveDepartment(
  tx: { select: ControlPlaneDatabase["select"] },
  tenantId: string,
  departmentId: string,
): Promise<boolean> {
  const rows = await tx
    .select({ id: departments.id })
    .from(departments)
    .where(
      and(
        eq(departments.tenantId, tenantId),
        eq(departments.id, departmentId),
        eq(departments.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

function viewOf(row: {
  id: string;
  title: string;
  declaredState: WorkDeclaredState;
  lifecycleStatus: string;
  departmentId: string | null;
  accountableActorId: string | null;
}): RecordedWorkItem {
  return {
    workItemId: row.id,
    title: row.title,
    declaredState: row.declaredState,
    lifecycleStatus: row.lifecycleStatus,
    departmentId: row.departmentId,
    accountableActorId: row.accountableActorId,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. RECORD
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * RECORD THAT A UNIT OF WORK EXISTS.
 *
 * `departmentId` and `accountableUserId` are both OPTIONAL: an organization can record work before
 * deciding which part of itself carries it and before making anybody accountable, and both of those
 * are real organizational states rather than missing data. When supplied, each must resolve — the
 * department to an ACTIVE department of this tenant, the human to a currently eligible member.
 *
 * There is NO uniqueness constraint on the title, and that is deliberate: two work items may
 * legitimately share one ("Q3 audit", twice, two years apart). A work item is identified by its id,
 * not by what it is called.
 */
export async function recordWork(
  tenant: TenantContext | null,
  input: {
    readonly title: string;
    readonly declaredState?: WorkDeclaredState;
    readonly departmentId?: string | null;
    readonly accountableUserId?: string | null;
  },
  deps: WorkWriteDeps = {},
): Promise<WorkWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  const { db, now } = gated;
  const authenticated = tenant as TenantContext;

  if (!isWellFormedWorkTitle(input?.title)) return refuse("malformed-work-title");
  if (input?.declaredState !== undefined && !isWorkDeclaredState(input.declaredState)) {
    return refuse("malformed-declared-state");
  }
  const departmentId = input.departmentId ?? null;
  const accountableUserId = input.accountableUserId ?? null;

  try {
    let outcome: WorkWriteResult | null = null;

    await db.transaction(async (tx) => {
      if (departmentId !== null) {
        if (!(await isActiveDepartment(tx, authenticated.tenantId, departmentId))) {
          outcome = refuse("department-unresolved");
          return;
        }
      }
      if (accountableUserId !== null) {
        if (!(await isEligibleMember(tx, authenticated.tenantId, accountableUserId))) {
          outcome = refuse("accountable-not-eligible-member");
          return;
        }
      }

      const inserted = await tx
        .insert(workItems)
        .values({
          tenantId: authenticated.tenantId,
          title: input.title,
          ...(input.declaredState === undefined ? {} : { declaredState: input.declaredState }),
          departmentId,
          accountableActorType: accountableUserId === null ? null : "human",
          accountableActorId: accountableUserId,
          createdBy: authenticated.userId,
          createdByType: "human",
          updatedBy: authenticated.userId,
          updatedByType: "human",
        })
        .returning({
          id: workItems.id,
          title: workItems.title,
          declaredState: workItems.declaredState,
          lifecycleStatus: workItems.lifecycleStatus,
          departmentId: workItems.departmentId,
          accountableActorId: workItems.accountableActorId,
        });

      const row = inserted[0]!;
      await recordWorkEventWithin(
        tx,
        auditActorFrom(authenticated),
        {
          action: WORK_AUDIT_RECORDED,
          workItemId: row.id,
          declaredState: row.declaredState,
          accountableActorId: row.accountableActorId,
          departmentId: row.departmentId,
        },
        now,
      );

      outcome = { status: "recorded", workItem: viewOf(row) };
    });

    return outcome ?? refuse("authority-unavailable");
  } catch {
    return refuse("authority-unavailable");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2-5. MUTATIONS ON AN EXISTING ROW
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The shared mutation frame: gate, transaction, tenant-scoped row lock, live-work precondition.
 *
 * `FOR UPDATE` is the concurrency guarantee — two simultaneous state declarations serialize on the
 * row rather than racing to a last-writer-wins result, and the `version` column from
 * `tenantColumns` moves under it. The lock is taken with the tenant in the predicate, so a lock on
 * another organization's row is not refused here; it is unreachable.
 */
async function mutateWork(
  tenant: TenantContext | null,
  workItemId: string,
  deps: WorkWriteDeps,
  apply: (context: {
    readonly tx: Parameters<Parameters<ControlPlaneDatabase["transaction"]>[0]>[0];
    readonly tenantId: string;
    readonly userId: string;
    readonly now: Date;
    readonly current: {
      readonly id: string;
      readonly title: string;
      readonly declaredState: WorkDeclaredState;
      readonly lifecycleStatus: string;
      readonly departmentId: string | null;
      readonly accountableActorId: string | null;
    };
  }) => Promise<WorkWriteResult>,
): Promise<WorkWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  const { db, now } = gated;
  const authenticated = tenant as TenantContext;

  if (typeof workItemId !== "string" || workItemId.length === 0) {
    return refuse("work-unresolved");
  }

  try {
    let outcome: WorkWriteResult | null = null;

    await db.transaction(async (tx) => {
      const rows = await tx
        .select({
          id: workItems.id,
          title: workItems.title,
          declaredState: workItems.declaredState,
          lifecycleStatus: workItems.lifecycleStatus,
          departmentId: workItems.departmentId,
          accountableActorId: workItems.accountableActorId,
        })
        .from(workItems)
        .where(and(eq(workItems.tenantId, authenticated.tenantId), eq(workItems.id, workItemId)))
        .for("update")
        .limit(1);

      const current = rows[0];
      if (!current) {
        outcome = refuse("work-unresolved");
        return;
      }
      if (current.lifecycleStatus !== ACTIVE_LIFECYCLE_STATUS) {
        outcome = refuse("work-retired");
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
  } catch {
    return refuse("authority-unavailable");
  }
}

/** Change what a unit of work is called. Nothing else about it moves. */
export async function retitleWork(
  tenant: TenantContext | null,
  input: { readonly workItemId: string; readonly title: string },
  deps: WorkWriteDeps = {},
): Promise<WorkWriteResult> {
  if (!isWellFormedWorkTitle(input?.title)) return refuse("malformed-work-title");

  return mutateWork(tenant, input.workItemId, deps, async (ctx) => {
    const updated = await ctx.tx
      .update(workItems)
      .set({
        title: input.title,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
        updatedByType: "human",
      })
      .where(and(eq(workItems.tenantId, ctx.tenantId), eq(workItems.id, ctx.current.id)))
      .returning({
        id: workItems.id,
        title: workItems.title,
        declaredState: workItems.declaredState,
        lifecycleStatus: workItems.lifecycleStatus,
        departmentId: workItems.departmentId,
        accountableActorId: workItems.accountableActorId,
      });

    const row = updated[0]!;
    await recordWorkEventWithin(
      ctx.tx,
      auditActorFrom(tenant as TenantContext),
      { action: WORK_AUDIT_RETITLED, workItemId: row.id },
      ctx.now,
    );
    return { status: "recorded", workItem: viewOf(row) };
  });
}

/**
 * DECLARE THE STATE OF A UNIT OF WORK.
 *
 * Any value in the closed vocabulary may follow any other, because a transition graph would encode
 * a process the organization never told Hebun about. Re-declaring the state it already holds is
 * legal and is recorded: a human restating that work is still blocked is a real act.
 *
 *     THIS RECORDS A DECLARATION. It verifies nothing, observes nothing and measures nothing.
 *     DECLARED COMPLETE != VERIFIED != SUCCESSFUL != OUTCOME ACHIEVED.
 */
export async function setWorkDeclaredState(
  tenant: TenantContext | null,
  input: { readonly workItemId: string; readonly declaredState: WorkDeclaredState },
  deps: WorkWriteDeps = {},
): Promise<WorkWriteResult> {
  if (!isWorkDeclaredState(input?.declaredState)) return refuse("malformed-declared-state");

  return mutateWork(tenant, input.workItemId, deps, async (ctx) => {
    const updated = await ctx.tx
      .update(workItems)
      .set({
        declaredState: input.declaredState,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
        updatedByType: "human",
      })
      .where(and(eq(workItems.tenantId, ctx.tenantId), eq(workItems.id, ctx.current.id)))
      .returning({
        id: workItems.id,
        title: workItems.title,
        declaredState: workItems.declaredState,
        lifecycleStatus: workItems.lifecycleStatus,
        departmentId: workItems.departmentId,
        accountableActorId: workItems.accountableActorId,
      });

    const row = updated[0]!;
    await recordWorkEventWithin(
      ctx.tx,
      auditActorFrom(tenant as TenantContext),
      {
        action: WORK_AUDIT_STATE_DECLARED,
        workItemId: row.id,
        declaredState: row.declaredState,
      },
      ctx.now,
    );
    return { status: "recorded", workItem: viewOf(row) };
  });
}

/**
 * NAME THE HUMAN ACCOUNTABLE FOR THIS WORK, or clear it.
 *
 * `null` clears accountability, which is a real organizational state and not a deletion. A supplied
 * id must be a currently eligible human member of this tenant — the full shared predicate, checked
 * here inside the transaction, with no surface in the way.
 *
 *     ACCOUNTABILITY GRANTS NOTHING. No permission, no Governance authority, no approval right.
 */
export async function setWorkAccountableHuman(
  tenant: TenantContext | null,
  input: { readonly workItemId: string; readonly accountableUserId: string | null },
  deps: WorkWriteDeps = {},
): Promise<WorkWriteResult> {
  const accountableUserId = input?.accountableUserId ?? null;

  return mutateWork(tenant, input.workItemId, deps, async (ctx) => {
    if (accountableUserId !== null) {
      if (!(await isEligibleMember(ctx.tx, ctx.tenantId, accountableUserId))) {
        return refuse("accountable-not-eligible-member");
      }
    }

    const updated = await ctx.tx
      .update(workItems)
      .set({
        accountableActorType: accountableUserId === null ? null : "human",
        accountableActorId: accountableUserId,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
        updatedByType: "human",
      })
      .where(and(eq(workItems.tenantId, ctx.tenantId), eq(workItems.id, ctx.current.id)))
      .returning({
        id: workItems.id,
        title: workItems.title,
        declaredState: workItems.declaredState,
        lifecycleStatus: workItems.lifecycleStatus,
        departmentId: workItems.departmentId,
        accountableActorId: workItems.accountableActorId,
      });

    const row = updated[0]!;
    await recordWorkEventWithin(
      ctx.tx,
      auditActorFrom(tenant as TenantContext),
      {
        action: WORK_AUDIT_ACCOUNTABLE_SET,
        workItemId: row.id,
        accountableActorId: row.accountableActorId,
      },
      ctx.now,
    );
    return { status: "recorded", workItem: viewOf(row) };
  });
}

/**
 * TAKE A UNIT OF WORK OUT OF SERVICE.
 *
 * Retirement is IN PLACE: the row stays, its title stays, its accountable human stays named, and
 * its last declared state stays exactly as it was. Nothing is deleted and nothing is rewritten,
 * because a retired record must still say what it said.
 *
 * It is terminal for this authority. A retired item refuses every further mutation with
 * `work-retired`, and WORK-1 ships no un-retire: reviving work is a different act with a different
 * meaning, and inventing it here would have been scope this milestone was not given.
 */
export async function retireWork(
  tenant: TenantContext | null,
  input: { readonly workItemId: string },
  deps: WorkWriteDeps = {},
): Promise<WorkWriteResult> {
  return mutateWork(tenant, input.workItemId, deps, async (ctx) => {
    const updated = await ctx.tx
      .update(workItems)
      .set({
        lifecycleStatus: RETIRED_LIFECYCLE_STATUS,
        updatedAt: ctx.now,
        updatedBy: ctx.userId,
        updatedByType: "human",
      })
      .where(and(eq(workItems.tenantId, ctx.tenantId), eq(workItems.id, ctx.current.id)))
      .returning({
        id: workItems.id,
        title: workItems.title,
        declaredState: workItems.declaredState,
        lifecycleStatus: workItems.lifecycleStatus,
        departmentId: workItems.departmentId,
        accountableActorId: workItems.accountableActorId,
      });

    const row = updated[0]!;
    await recordWorkEventWithin(
      ctx.tx,
      auditActorFrom(tenant as TenantContext),
      { action: WORK_AUDIT_RETIRED, workItemId: row.id },
      ctx.now,
    );
    return { status: "recorded", workItem: viewOf(row) };
  });
}
