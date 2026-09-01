/*
 * organizational-work/read-work.server.ts — reading this organization's recorded work (WORK-1).
 *
 * READ-ONLY, and read-only in the way that can be proved: this module contains no insert, no
 * update, no delete and no transaction. It grants nothing, decides nothing, and starts nothing.
 *
 * ── THE THREE STATES ARE THE POINT ───────────────────────────────────────────
 *
 *   unavailable        the authority could not be reached. NOT "no work".
 *   available, empty   looked, found none. A real, measured answer about the organization.
 *   available, items   the recorded work.
 *
 * A read that fails returns `unavailable` and never an empty list, because a surface must not tell
 * a human "you have no work" when the truth is that Hebun could not look. The same three states
 * `readOrganizationStructure` established, for the same reason.
 *
 * ── IT COMPOSES; IT RESOLVES NO NAME ─────────────────────────────────────────
 *
 * A work item holds two identifiers that belong to other authorities: a `department_id` owned by
 * the Organization Structure Authority and an accountable `user id` owned by Identity. This module
 * resolves NEITHER into a label. It returns a DEPARTMENT NAME because that name is a column of a
 * table this same authority is already permitted to join within its own tenant, and it returns the
 * accountable human as an IDENTIFIER ONLY.
 *
 * The human label is Identity's answer, resolved by the released Human Legibility Reach projection
 * at the PAGE, composed beside this read and never merged into it — exactly what
 * `/director/organization` does with department owners. So:
 *
 *     THE LABEL IS NOT THE KEY.      A READABLE NAME GRANTS NOTHING.
 *     RESOLVED != AUTHORIZED.        UNRESOLVED != NOBODY.
 *
 * No `WorkItemView` field holds a human name, and no human name is persisted by any WORK-1 path.
 *
 * ── ACCOUNTABILITY IS HISTORICAL TRUTH; MEMBERSHIP IS CURRENT ────────────────
 *
 * Work keeps naming the human recorded as accountable even after their membership ends — erasing
 * them would destroy the record that anyone ever was. What changes is a SEPARATE derived flag,
 * `accountableCurrentlyActiveMember`, resolved by a per-id predicate against `memberships`.
 *
 * That predicate is NOT A ROSTER. It answers "is THIS id an active member" for ids the register
 * already names; it cannot enumerate the organization's people and carries no name and no email.
 *
 * IT IS A STRICT SUBSET OF THE WRITER'S CHECK, deliberately, and the difference is stated rather
 * than implied: the writer also requires a live identity, and this module does not read `users` at
 * all. So an accountable human whose IDENTITY was soft-deleted while their membership stayed active
 * still reads `accountableCurrentlyActiveMember: true` here. That is a known bound of a flag
 * derived from `memberships`, not a claim that the identity is live. `read-structure.server.ts`
 * records the same bound about department owners.
 *
 * NOTHING HISTORICAL IS REWRITTEN. There is no automatic retirement, no accountability erasure and
 * no state transition anywhere in this module.
 *
 * ── THE BOUND IS DECLARED, NEVER SILENT ──────────────────────────────────────
 *
 * At most `MAX_WORK_ITEMS_READ` rows come back, and `truncated` says when that bound was reached. A
 * list that quietly stops is a list that lies about what the organization holds.
 *
 * Server-only.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
/*
 * The MEMBERSHIP HALF of the shared eligibility rule. This module does not name `users`, so it
 * takes the subset that reads `memberships` alone, and says above exactly what that subset cannot
 * see. The rule itself is owned by Identity and is never re-stated here.
 */
import { activeMembershipOnlyConditions } from "@/features/auth-runtime/member-eligibility";
import { departments } from "@/db/schema/department";
import { memberships } from "@/db/schema/membership";
import { workItems } from "@/db/schema/work-item";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  MAX_WORK_ITEMS_READ,
  WORK_REGISTER_EMPTY_DETAIL,
  WORK_REGISTER_UNAVAILABLE_DETAIL,
  type WorkDeclaredState,
} from "./work-contracts";

export interface WorkReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

/** The lifecycle value every governed read in this repository treats as in service. */
export const ACTIVE_LIFECYCLE_STATUS = "active" as const;

/**
 * THE COLUMN VALUE RETIRED WORK CARRIES, and the naming mismatch stated rather than hidden.
 *
 * The product word is RETIRED. The column value is `archived`, because `work_items` uses the
 * GENERIC `lifecycle_status` enum — `active | archived | deleted` — and WORK-1 adds no value to it:
 * widening a shared enum for one table's vocabulary would change every table that uses it. This is
 * the identical decision, and the identical constant, that `read-structure.server.ts` records for
 * departments.
 *
 * `deleted` is deliberately NOT used: WORK-1 retires in place and deletes nothing.
 */
export const RETIRED_LIFECYCLE_STATUS = "archived" as const;

/**
 * ONE recorded work item, as a reader sees it.
 *
 * `accountableActorId` is an IDENTIFIER. There is no name field here and there never will be one:
 * a label is Identity's answer, composed beside this read.
 */
export interface WorkItemView {
  readonly workItemId: string;
  readonly title: string;
  readonly declaredState: WorkDeclaredState;
  readonly lifecycleStatus: string;
  readonly inService: boolean;
  /** The department this work names, or `null`. The name is this authority's own join. */
  readonly department: { readonly departmentId: string; readonly name: string } | null;
  /** The human recorded accountable, as an identifier. `null` when nobody is recorded. */
  readonly accountableActorId: string | null;
  /**
   * Derived, never stored: is that id an active member of this tenant TODAY? A strict subset of the
   * writer's eligibility check — see the module header.
   */
  readonly accountableCurrentlyActiveMember: boolean | null;
  readonly recordedAt: string;
  readonly updatedAt: string;
}

export type WorkRegister =
  | { readonly status: "unavailable"; readonly detail: string }
  | {
      readonly status: "available";
      readonly items: readonly WorkItemView[];
      readonly truncated: boolean;
      readonly detail: string;
    };

export const WORK_REGISTER_UNAVAILABLE: WorkRegister = Object.freeze({
  status: "unavailable" as const,
  detail: WORK_REGISTER_UNAVAILABLE_DETAIL,
});

function resolveDbOrNull(deps: WorkReadDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/** The sentence for a register that holds work. Counts, never a list of titles. */
function recordedDetail(total: number, retired: number, truncated: boolean): string {
  const live = total - retired;
  const parts = [
    `${live} work item${live === 1 ? "" : "s"} in service`,
    retired > 0 ? `${retired} retired` : null,
  ].filter(Boolean);
  const bound = truncated
    ? ` Only the ${MAX_WORK_ITEMS_READ} most recent are shown; this organization holds more.`
    : "";
  return (
    `This organization has recorded ${parts.join(", ")}. Every state shown is DECLARED by a human — ` +
    `Hebun observed nothing, verified nothing, and holds no record of any outcome.${bound}`
  );
}

/**
 * Read this organization's recorded work.
 *
 * Tenant-scoped by the authority's own predicate. There is no work id, department id or tenant
 * parameter, so a caller cannot point this at another organization — a cross-organization read is
 * not refused here; it is UNREPRESENTABLE.
 *
 * Retired work is RETURNED, not hidden, and carries `inService: false`. A surface that wants only
 * live work filters; a surface that hides retired work by omission would make a retirement look
 * like a deletion, and WORK-1 retires in place.
 */
export async function readWorkRegister(
  tenant: TenantContext | null,
  deps: WorkReadDeps = {},
): Promise<WorkRegister> {
  if (typeof window !== "undefined") {
    throw new Error("Organizational work reads are server-only.");
  }
  if (!tenant?.tenantId) return WORK_REGISTER_UNAVAILABLE;

  const db = resolveDbOrNull(deps);
  if (!db) return WORK_REGISTER_UNAVAILABLE;

  try {
    /*
     * The department name comes from a LEFT JOIN inside this tenant's own predicate. It is not a
     * second organization read: the composite FK already guarantees the department belongs to this
     * tenant, and the join reads exactly one column that this authority is permitted to render
     * beside the reference it holds. No owner, no slug, no lifecycle of the department travels.
     */
    const rows = await db
      .select({
        id: workItems.id,
        title: workItems.title,
        declaredState: workItems.declaredState,
        lifecycleStatus: workItems.lifecycleStatus,
        departmentId: workItems.departmentId,
        departmentName: departments.name,
        accountableActorId: workItems.accountableActorId,
        createdAt: workItems.createdAt,
        updatedAt: workItems.updatedAt,
      })
      .from(workItems)
      .leftJoin(departments, eq(departments.id, workItems.departmentId))
      .where(eq(workItems.tenantId, tenant.tenantId))
      .orderBy(desc(workItems.createdAt))
      .limit(MAX_WORK_ITEMS_READ + 1);

    if (rows.length === 0) {
      return {
        status: "available",
        items: [],
        truncated: false,
        detail: WORK_REGISTER_EMPTY_DETAIL,
      };
    }

    const truncated = rows.length > MAX_WORK_ITEMS_READ;
    const bounded = truncated ? rows.slice(0, MAX_WORK_ITEMS_READ) : rows;

    /*
     * ONE predicate, for the accountable ids this register already names. Scoped to this tenant and
     * to those exact ids — it can neither list the organization's members nor reach another
     * tenant's.
     */
    const accountableIds = [
      ...new Set(
        bounded.map((row) => row.accountableActorId).filter((id): id is string => Boolean(id)),
      ),
    ];
    const activeAccountableIds = new Set<string>();
    if (accountableIds.length > 0) {
      const memberRows = await db
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            ...activeMembershipOnlyConditions(tenant.tenantId),
            inArray(memberships.userId, accountableIds),
          ),
        );
      for (const member of memberRows) activeAccountableIds.add(member.userId);
    }

    const items: WorkItemView[] = bounded.map((row) => ({
      workItemId: row.id,
      title: row.title,
      declaredState: row.declaredState,
      lifecycleStatus: row.lifecycleStatus,
      inService: row.lifecycleStatus === ACTIVE_LIFECYCLE_STATUS,
      department:
        row.departmentId && row.departmentName
          ? { departmentId: row.departmentId, name: row.departmentName }
          : null,
      accountableActorId: row.accountableActorId,
      accountableCurrentlyActiveMember: row.accountableActorId
        ? activeAccountableIds.has(row.accountableActorId)
        : null,
      recordedAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));

    const retired = items.filter((item) => !item.inService).length;
    return {
      status: "available",
      items,
      truncated,
      detail: recordedDetail(items.length, retired, truncated),
    };
  } catch {
    return WORK_REGISTER_UNAVAILABLE;
  }
}
