/*
 * organization-authority/write-placement.server.ts — THE DEPARTMENTAL PLACEMENT AUTHORITY.
 *
 * This module owns ONE fact and three transitions over ONE table:
 *
 *     UNPLACED  ->  PLACED                       place
 *     PLACED    ->  PLACED IN A DIFFERENT ONE    place  (same row, department changes)
 *     PLACED    ->  UNPLACED                     withdraw
 *
 * There is no delete, no restore, no merge and no bulk assignment. Those verbs are ABSENT rather
 * than guarded, which is the stronger claim: a caller cannot reach a capability that was never
 * written.
 *
 * ── WHAT THIS AUTHORITY IS NOT, AND WHICH BOUNDARY DECIDED IT ────────────────
 *
 * It writes `department_placements` and `audit_log`, and no other table. In particular it never
 * writes `memberships`, `departments`, `users`, `roles`, `agents`, `decision_records`,
 * `work_items`, or any knowledge table. A firewall walks this file's real import graph and asserts
 * it.
 *
 * `memberships` is the load-bearing one. The obvious shape for this fact was a
 * `memberships.department_id` column, and it was REFUSED: `write-structure.server.ts` states, and
 * its own firewall asserts, that the structural authority never writes `memberships` — the row a
 * session reads to build a `TenantContext`. Honouring that boundary is why this fact lives in its
 * own table with its own blast radius, and why `write-structure.server.ts` is untouched by this
 * capability.
 *
 * ── PLACEMENT GRANTS NOTHING ─────────────────────────────────────────────────
 *
 *   PLACEMENT != ROLE            PLACEMENT != AUTHORITY       PLACEMENT != PERMISSION
 *   PLACEMENT != REPORTING LINE  PLACEMENT != MANAGER         PLACEMENT != WORK ASSIGNMENT
 *
 * `resolveGovernanceAuthority` reads `decision_records.bootstrap` and active delegations, and
 * consults no placement. Nothing in this repository reads `department_placements` to decide
 * anything — this authority publishes a recorded fact, and a recorded fact is not an authorization.
 *
 * ── THE GATE, AND WHY IT WRITES NO DECISION ──────────────────────────────────
 *
 * The administrative gate is the tenant's EXISTING Governance authority holder, consumed through
 * `resolveGovernanceAuthority` as PERMISSION TO WRITE STRUCTURE and never as a decision. No
 * `decision_records` row is written by any path here and no `governance_domain` value was added —
 * the released precedents are OSA-1 and R6D, which mutate under their own band and write audit
 * alone.
 *
 * Authorization happens BEFORE any subject is looked at, so an unauthorized caller cannot use the
 * refusals as an oracle for which departments or which people a tenant holds.
 *
 * ── THE HUMAN MUST BE A CURRENTLY ELIGIBLE MEMBER OF THIS TENANT ─────────────
 *
 * Verified inside the transaction by the SHARED eligibility rule — the same one the owner picker,
 * the owner writer and the placement read's standing probe use — so a control can never offer
 * somebody this writer refuses. `human-not-active-member` is returned identically for a revoked
 * membership, a soft-deleted identity, another tenant's human and nobody at all.
 *
 * It is not a roster: it answers a yes/no about ONE id the caller already holds, selects no name
 * and no email, and cannot enumerate anybody.
 *
 * ── ONE TRANSACTION, OR NOTHING ──────────────────────────────────────────────
 *
 * Every mutation and its audit row commit together or neither does. `department_placements` and
 * `audit_log` live in the same control-plane database, so this needs no distributed-transaction
 * machinery and invents none.
 *
 * Server-only.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { departmentPlacements } from "@/db/schema/department-placement";
import { departments } from "@/db/schema/department";
import { memberships } from "@/db/schema/membership";
import { users } from "@/db/schema/user";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
/*
 * The eligibility rule, imported rather than re-typed. PURE — drizzle conditions, no database
 * handle, no query — so it adds no server module to this writer's reachable graph.
 */
import {
  eligibleTenantMemberWhere,
  joinUsersToMemberships,
} from "@/features/auth-runtime/member-eligibility";
import { auditActorFrom } from "@/features/governance-audit/knowledge-mutation-audit.server";
import { recordPlacementEventWithin } from "@/features/governance-audit/departmental-placement-audit.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { ACTIVE_LIFECYCLE_STATUS, RETIRED_LIFECYCLE_STATUS } from "./read-structure.server";
import {
  PLACEMENT_AUDIT_SET,
  PLACEMENT_AUDIT_WITHDRAWN,
  type PlacementRefusal,
} from "./placement-contracts";

export interface PlacementWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly resolveAuthority?: typeof resolveGovernanceAuthority;
}

/** What a caller learns on success. Identifiers, and what the record now says. */
export interface RecordedPlacement {
  readonly placementId: string;
  readonly userId: string;
  readonly departmentId: string;
}

export type PlacementWriteResult =
  | { readonly status: "recorded"; readonly placement: RecordedPlacement }
  | { readonly status: "withdrawn"; readonly placement: RecordedPlacement }
  | { readonly status: "refused"; readonly reason: PlacementRefusal };

const refuse = (reason: PlacementRefusal): PlacementWriteResult => ({
  status: "refused",
  reason,
});

/** PostgreSQL's `unique_violation`. The partial active index is the concurrency guarantee. */
const UNIQUE_VIOLATION = "23505";

/**
 * Drizzle WRAPS a driver error and the wrapper carries no `code` of its own — the SQLSTATE lives on
 * `cause`. Both positions are read, so the check survives an unwrapped error too. Classifying a
 * duplicate as `authority-unavailable` would be the wrong refusal AND an untrue one: the authority
 * was reached and answered.
 */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const shaped = error as { code?: unknown; cause?: { code?: unknown } };
  return shaped.code === UNIQUE_VIOLATION || shaped.cause?.code === UNIQUE_VIOLATION;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Departmental placement writes are server-only.");
  }
}

function resolveDbOrNull(deps: PlacementWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * The gate, applied identically by both acts. ORDER IS THE GUARANTEE — authorization before any
 * subject is looked at.
 */
async function gate(
  tenant: TenantContext | null,
  deps: PlacementWriteDeps,
): Promise<
  | { readonly ok: true; readonly db: ControlPlaneDatabase; readonly now: Date }
  | { readonly ok: false; readonly result: PlacementWriteResult }
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
 * ONE id, this tenant, inside the caller's transaction. It answers a yes/no about a value the
 * caller already holds; it cannot list, page or discover anybody, and it selects `memberships.id`
 * rather than anything that could describe a person.
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
 * RECORD THAT A HUMAN WORKS IN A DEPARTMENT.
 *
 * Covers first placement and a move. Idempotence is REFUSED rather than silent: placing somebody
 * where they are already placed returns `already-placed`, because a caller that believes it changed
 * something when it did not is how a surface starts lying about the organization.
 *
 * The department is locked FOR UPDATE, so a concurrent retirement cannot interleave between the
 * check and the write. The placement row is located under the same lock.
 */
export async function placeHumanInDepartment(
  tenant: TenantContext | null,
  input: { readonly userId: string; readonly departmentId: string },
  deps: PlacementWriteDeps = {},
): Promise<PlacementWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  const { db, now } = gated;
  const authenticated = tenant as TenantContext;

  const userId = typeof input?.userId === "string" ? input.userId : "";
  const departmentId = typeof input?.departmentId === "string" ? input.departmentId : "";
  if (userId.length === 0) return refuse("human-not-active-member");
  if (departmentId.length === 0) return refuse("department-unresolved");

  try {
    let outcome: PlacementWriteResult | null = null;

    await db.transaction(async (tx) => {
      /*
       * THE DEPARTMENT FIRST, AND UNDER A LOCK. Another tenant's department is `department-
       * unresolved` exactly as one that never existed — the two are indistinguishable to a caller.
       */
      const departmentRows = await tx
        .select({ id: departments.id, lifecycleStatus: departments.lifecycleStatus })
        .from(departments)
        .where(and(eq(departments.tenantId, authenticated.tenantId), eq(departments.id, departmentId)))
        .for("update")
        .limit(1);

      const department = departmentRows[0];
      if (!department) {
        outcome = refuse("department-unresolved");
        return;
      }
      if (department.lifecycleStatus !== ACTIVE_LIFECYCLE_STATUS) {
        outcome = refuse("department-retired");
        return;
      }

      if (!(await isEligibleMember(tx, authenticated.tenantId, userId))) {
        outcome = refuse("human-not-active-member");
        return;
      }

      const existingRows = await tx
        .select({ id: departmentPlacements.id, departmentId: departmentPlacements.departmentId })
        .from(departmentPlacements)
        .where(
          and(
            eq(departmentPlacements.tenantId, authenticated.tenantId),
            eq(departmentPlacements.userId, userId),
            eq(departmentPlacements.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
            isNull(departmentPlacements.deletedAt),
          ),
        )
        .for("update")
        .limit(1);

      const existing = existingRows[0];
      if (existing && existing.departmentId === department.id) {
        outcome = refuse("already-placed");
        return;
      }

      const row = existing
        ? (
            await tx
              .update(departmentPlacements)
              .set({
                departmentId: department.id,
                updatedAt: now,
                updatedBy: authenticated.userId,
                updatedByType: "human",
                version: sql`${departmentPlacements.version} + 1`,
              })
              .where(
                and(
                  eq(departmentPlacements.tenantId, authenticated.tenantId),
                  eq(departmentPlacements.id, existing.id),
                ),
              )
              .returning({
                id: departmentPlacements.id,
                userId: departmentPlacements.userId,
                departmentId: departmentPlacements.departmentId,
              })
          )[0]!
        : (
            await tx
              .insert(departmentPlacements)
              .values({
                tenantId: authenticated.tenantId,
                userId,
                departmentId: department.id,
                createdBy: authenticated.userId,
                createdByType: "human",
                updatedBy: authenticated.userId,
                updatedByType: "human",
                createdAt: now,
                updatedAt: now,
              })
              .returning({
                id: departmentPlacements.id,
                userId: departmentPlacements.userId,
                departmentId: departmentPlacements.departmentId,
              })
          )[0]!;

      await recordPlacementEventWithin(
        tx,
        auditActorFrom(authenticated),
        {
          action: PLACEMENT_AUDIT_SET,
          placementId: row.id,
          userId: row.userId,
          departmentId: row.departmentId,
        },
        now,
      );

      outcome = {
        status: "recorded",
        placement: { placementId: row.id, userId: row.userId, departmentId: row.departmentId },
      };
    });

    return outcome ?? refuse("authority-unavailable");
  } catch (error) {
    /*
     * Two concurrent first-placements of one human: one commits, the other hits
     * `department_placements_tenant_user_active_uq`. The loser is told the truth — somebody else
     * placed them — rather than an infrastructure refusal.
     */
    if (isUniqueViolation(error)) return refuse("already-placed");
    return refuse("authority-unavailable");
  }
}

/**
 * WITHDRAW A PLACEMENT. The human is no longer recorded as working anywhere.
 *
 * Lifecycle, never a delete: the row is archived so the record that they once worked there
 * survives, and the PARTIAL unique index then frees the human to be placed again. This is the
 * retirement shape `departments` already uses, for the same reason.
 */
export async function withdrawPlacement(
  tenant: TenantContext | null,
  input: { readonly userId: string },
  deps: PlacementWriteDeps = {},
): Promise<PlacementWriteResult> {
  const gated = await gate(tenant, deps);
  if (!gated.ok) return gated.result;
  const { db, now } = gated;
  const authenticated = tenant as TenantContext;

  const userId = typeof input?.userId === "string" ? input.userId : "";
  if (userId.length === 0) return refuse("not-placed");

  try {
    let outcome: PlacementWriteResult | null = null;

    await db.transaction(async (tx) => {
      const rows = await tx
        .select({ id: departmentPlacements.id, departmentId: departmentPlacements.departmentId })
        .from(departmentPlacements)
        .where(
          and(
            eq(departmentPlacements.tenantId, authenticated.tenantId),
            eq(departmentPlacements.userId, userId),
            eq(departmentPlacements.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
            isNull(departmentPlacements.deletedAt),
          ),
        )
        .for("update")
        .limit(1);

      const current = rows[0];
      if (!current) {
        outcome = refuse("not-placed");
        return;
      }

      const updated = await tx
        .update(departmentPlacements)
        .set({
          lifecycleStatus: RETIRED_LIFECYCLE_STATUS,
          updatedAt: now,
          updatedBy: authenticated.userId,
          updatedByType: "human",
          version: sql`${departmentPlacements.version} + 1`,
        })
        .where(
          and(
            eq(departmentPlacements.tenantId, authenticated.tenantId),
            eq(departmentPlacements.id, current.id),
          ),
        )
        .returning({
          id: departmentPlacements.id,
          userId: departmentPlacements.userId,
          departmentId: departmentPlacements.departmentId,
        });

      const row = updated[0]!;
      await recordPlacementEventWithin(
        tx,
        auditActorFrom(authenticated),
        {
          action: PLACEMENT_AUDIT_WITHDRAWN,
          placementId: row.id,
          userId: row.userId,
          departmentId: row.departmentId,
        },
        now,
      );

      outcome = {
        status: "withdrawn",
        placement: { placementId: row.id, userId: row.userId, departmentId: row.departmentId },
      };
    });

    return outcome ?? refuse("authority-unavailable");
  } catch {
    return refuse("authority-unavailable");
  }
}
