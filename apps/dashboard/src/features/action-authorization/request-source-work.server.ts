/*
 * action-authorization/request-source-work.server.ts — READ what a request was recorded as following
 * up (PLAN-FOLLOW-UP-REFERENCE-V1).
 *
 * Two reads of the request's own provenance rows, both tenant-scoped by predicate:
 *
 *   readRequestSourceWorkIdsWithin   inside a spend transaction, for the executor. The ids come from
 *                                    the row the request was written with — never from the payload,
 *                                    the permit, the model or a caller — so they cannot be swapped.
 *   readRequestSourceWork            for an approval surface: titles and whether each is in service.
 *
 * Read-only. The writer is `record-action-request.server.ts`, in the request's own transaction.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { hebyActionRequestSourceWorkItems } from "@/db/schema/follow-up-source-work";
import { workItems } from "@/db/schema/work-item";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { ACTIVE_LIFECYCLE_STATUS } from "@/features/organizational-work/read-work.server";

export interface RequestSourceWork {
  readonly workItemId: string;
  readonly title: string;
  readonly inService: boolean;
}

/** Ordered source ids for one request; empty for every request that is not a linked follow-up. */
export async function readRequestSourceWorkIdsWithin(
  handle: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  actionRequestId: string,
): Promise<readonly string[]> {
  const rows = await handle
    .select({ workItemId: hebyActionRequestSourceWorkItems.workItemId })
    .from(hebyActionRequestSourceWorkItems)
    .where(
      and(
        eq(hebyActionRequestSourceWorkItems.tenantId, tenantId),
        eq(hebyActionRequestSourceWorkItems.actionRequestId, actionRequestId),
      ),
    )
    .orderBy(asc(hebyActionRequestSourceWorkItems.ordinal));
  return rows.map((r) => r.workItemId);
}

export type RequestSourceWorkRead =
  | { readonly status: "read"; readonly byRequest: ReadonlyMap<string, readonly RequestSourceWork[]> }
  | { readonly status: "unavailable" };

/** Source work for the given requests of THIS tenant, in plan order. Requests without rows are absent. */
export async function readRequestSourceWork(
  tenant: TenantContext | null,
  actionRequestIds: readonly string[],
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<RequestSourceWorkRead> {
  if (typeof window !== "undefined") throw new Error("Request source work reads are server-only.");
  if (!tenant?.tenantId) return { status: "unavailable" };
  if (actionRequestIds.length === 0) return { status: "read", byRequest: new Map() };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };
  try {
    const rows = await db
      .select({
        actionRequestId: hebyActionRequestSourceWorkItems.actionRequestId,
        workItemId: workItems.id,
        title: workItems.title,
        lifecycleStatus: workItems.lifecycleStatus,
      })
      .from(hebyActionRequestSourceWorkItems)
      .innerJoin(
        workItems,
        and(
          eq(workItems.tenantId, hebyActionRequestSourceWorkItems.tenantId),
          eq(workItems.id, hebyActionRequestSourceWorkItems.workItemId),
        ),
      )
      .where(
        and(
          eq(hebyActionRequestSourceWorkItems.tenantId, tenant.tenantId),
          inArray(hebyActionRequestSourceWorkItems.actionRequestId, [...actionRequestIds]),
        ),
      )
      .orderBy(asc(hebyActionRequestSourceWorkItems.actionRequestId), asc(hebyActionRequestSourceWorkItems.ordinal));
    const byRequest = new Map<string, RequestSourceWork[]>();
    for (const r of rows) {
      const list = byRequest.get(r.actionRequestId) ?? [];
      list.push({ workItemId: r.workItemId, title: r.title, inService: r.lifecycleStatus === ACTIVE_LIFECYCLE_STATUS });
      byRequest.set(r.actionRequestId, list);
    }
    return { status: "read", byRequest };
  } catch {
    return { status: "unavailable" };
  }
}
