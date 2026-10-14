/*
 * action-authorization/read-work-state-conflict.server.ts — HAS THE ITEM MOVED SINCE THIS WAS
 * PROPOSED? (WORK-UPDATE V1, U6)
 *
 * A READ, and only a read. For one `set-work-declared-state` request of THIS tenant it compares the
 * `fromState` the proposal froze with the item's declared state now, so a human deciding or executing
 * it can see in advance what the Work Authority will refuse anyway. It decides nothing, blocks
 * nothing and notifies nobody: the refusal under the row lock remains the only enforcement.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { SET_WORK_DECLARED_STATE_ACTION_KIND } from "@/features/heby-action-inlet/contracts";
import { readWorkStateTarget } from "@/features/organizational-work/read-work.server";
import {
  isWorkDeclaredState,
  parseWorkItemRef,
  type WorkDeclaredState,
} from "@/features/organizational-work/work-contracts";

export type WorkStateConflictRead =
  /** The item still holds the state the proposal was made from. */
  | { readonly status: "current"; readonly fromState: WorkDeclaredState }
  /** It does not: executing will be refused and nothing will change. */
  | { readonly status: "changed"; readonly fromState: WorkDeclaredState; readonly currentState: WorkDeclaredState }
  /** The item is retired or no longer this tenant's: executing will be refused. */
  | { readonly status: "gone" }
  | { readonly status: "unavailable" };

export async function readWorkStateConflict(
  tenant: TenantContext | null,
  requestId: unknown,
  deps: { readonly getDb?: () => ControlPlaneDatabase | null } = {},
): Promise<WorkStateConflictRead> {
  if (typeof window !== "undefined") throw new Error("Work state conflict reads are server-only.");
  if (!tenant?.tenantId || typeof requestId !== "string" || requestId.length === 0) return { status: "unavailable" };
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable" };
  try {
    const rows = await db
      .select({ payload: hebyActionRequests.canonicalPayload })
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.tenantId, tenant.tenantId),
          eq(hebyActionRequests.id, requestId),
          eq(hebyActionRequests.actionKind, SET_WORK_DECLARED_STATE_ACTION_KIND),
        ),
      )
      .limit(1);
    const payload = rows[0]?.payload as Record<string, unknown> | undefined;
    const item = parseWorkItemRef(payload?.["workItemRef"]);
    const fromState = payload?.["fromState"];
    if (!item || !isWorkDeclaredState(fromState)) return { status: "unavailable" };
    const read = await readWorkStateTarget(tenant, item.workItemId, { getDb: () => db });
    if (read.status === "unavailable") return { status: "unavailable" };
    if (read.status === "unresolved" || !read.target.inService) return { status: "gone" };
    return read.target.declaredState === fromState
      ? { status: "current", fromState }
      : { status: "changed", fromState, currentState: read.target.declaredState };
  } catch {
    return { status: "unavailable" };
  }
}
