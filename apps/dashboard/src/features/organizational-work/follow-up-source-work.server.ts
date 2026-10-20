/*
 * organizational-work/follow-up-source-work.server.ts — THE ONE DEFINITION OF "A WORK ITEM A
 * FOLLOW-UP MAY NAME AS ITS SOURCE" (PLAN-FOLLOW-UP-REFERENCE-V1).
 *
 * A source must be a work item of THIS tenant that is still in service. The Work authority owns
 * what "in service" means, so the rule lives here and every boundary that checks it — origination
 * before the model call, the request writer inside its transaction, and the work writer inside the
 * spend transaction — calls this one function rather than restating it.
 *
 * Server-only. Reads only; the writers are the request writer and `write-work.server.ts`.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { workItems } from "@/db/schema/work-item";
import { workItemFollowUpSources } from "@/db/schema/follow-up-source-work";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { ACTIVE_LIFECYCLE_STATUS, type WorkItemView } from "./read-work.server";
import type { WorkDeclaredState } from "./work-contracts";

export type FollowUpSourceReadHandle = Pick<ControlPlaneDatabase, "select">;

/**
 * True exactly when every id is a distinct, in-service work item of `tenantId`. An empty list is
 * not a source set and is false: a linked follow-up names at least one item, or it is not linked.
 */
export async function allFollowUpSourcesInService(
  handle: FollowUpSourceReadHandle,
  tenantId: string,
  workItemIds: readonly string[],
): Promise<boolean> {
  if (workItemIds.length === 0 || new Set(workItemIds).size !== workItemIds.length) return false;
  const rows = await handle
    .select({ id: workItems.id })
    .from(workItems)
    .where(
      and(
        eq(workItems.tenantId, tenantId),
        inArray(workItems.id, [...workItemIds]),
        eq(workItems.lifecycleStatus, ACTIVE_LIFECYCLE_STATUS),
      ),
    );
  return rows.length === workItemIds.length;
}

/* ── READ — what the Work authority recorded when a governed follow-up was executed ───────────── */


export interface WorkFollowUpLink {
  /** The follow-up work item a governed act created. */
  readonly workItemId: string;
  /** A work item it follows up. */
  readonly sourceWorkItemId: string;
}

export type WorkFollowUpLinksRead =
  | { readonly status: "read"; readonly links: readonly WorkFollowUpLink[]; readonly truncated: boolean }
  | { readonly status: "unavailable" };

export const WORK_FOLLOW_UP_LINK_READ_LIMIT = 500;

/** Every recorded follow-up relationship of THIS tenant, oldest first, bounded and said so. */
export async function readWorkFollowUpLinks(
  tenant: TenantContext | null,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<WorkFollowUpLinksRead> {
  if (typeof window !== "undefined") throw new Error("Work follow-up reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };
  try {
    const rows = await db
      .select({ workItemId: workItemFollowUpSources.workItemId, sourceWorkItemId: workItemFollowUpSources.sourceWorkItemId })
      .from(workItemFollowUpSources)
      .where(eq(workItemFollowUpSources.tenantId, tenant.tenantId))
      .orderBy(asc(workItemFollowUpSources.createdAt), asc(workItemFollowUpSources.ordinal))
      .limit(WORK_FOLLOW_UP_LINK_READ_LIMIT + 1);
    return {
      status: "read",
      links: rows.slice(0, WORK_FOLLOW_UP_LINK_READ_LIMIT),
      truncated: rows.length > WORK_FOLLOW_UP_LINK_READ_LIMIT,
    };
  } catch {
    return { status: "unavailable" };
  }
}

/* ── PLAN-FOLLOW-UP-LINEAGE-1 — which recorded follow-ups are still OPEN ──────────────────────── */

/** A recorded follow-up is OPEN while it is in service and not declared complete. Work's rule, said once. */
export function isOpenFollowUp(item: Pick<WorkItemView, "inService" | "declaredState">): boolean {
  return item.inService && item.declaredState !== "complete";
}

export type ExistingFollowUps =
  | { readonly status: "known"; readonly open: readonly { readonly title: string; readonly declaredState: WorkDeclaredState }[] }
  | { readonly status: "unknown" };

/**
 * The OPEN follow-ups Work recorded for any of `sourceWorkItemIds`, from this tenant's own reads.
 * `unknown` — never "none" — when the relationship read did not answer or was truncated, when the
 * register is not a complete read, or when a recorded follow-up is not in it: missing evidence is not
 * a negative claim. Pure; the caller supplies both tenant-scoped reads.
 */
export function existingFollowUpsFor(
  sourceWorkItemIds: readonly string[],
  links: WorkFollowUpLinksRead,
  registerItems: readonly WorkItemView[] | null,
): ExistingFollowUps {
  if (links.status !== "read" || links.truncated || registerItems === null) return { status: "unknown" };
  const sources = new Set(sourceWorkItemIds);
  const followUpIds = [...new Set(links.links.filter((l) => sources.has(l.sourceWorkItemId)).map((l) => l.workItemId))];
  const byId = new Map(registerItems.map((item) => [item.workItemId, item]));
  const followUps = followUpIds.map((id) => byId.get(id));
  if (followUps.some((item) => item === undefined)) return { status: "unknown" };
  return {
    status: "known",
    open: (followUps as WorkItemView[])
      .filter(isOpenFollowUp)
      .map((item) => ({ title: item.title, declaredState: item.declaredState })),
  };
}
