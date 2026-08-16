import { DecisionWorkspace } from "@/components/decision-workspace/decision-workspace";
import { ActionAuthorizations } from "@/components/decision-workspace/action-authorizations";
import { getDecisionWorkspaceModel } from "@/features/decisions/workspace-model";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  readActionPermits,
  readPendingActionRequests,
} from "@/features/action-authorization/read-action-authorizations.server";

export const metadata = { title: "Decisions — Hebun AI" };

/*
 * Decision & Approval Experience — the human authority surface, reachable at the established
 * `/approvals` route (labelled "Decisions" in navigation).
 *
 * PHASE 14 built the structural regions from the immutable Heby Core Phase 6 approval CONTRACT
 * VOCABULARY, with honest empty states, because no real server-authorized decision-mutation path
 * existed. Its own note read: *"no real, safe, server-authorized decision-mutation path exists"*.
 *
 * R3A IS THAT PATH, for exactly one class of decision. Pending consequential action requests and
 * their permits are now read from the durable store and are approvable, refusable and revocable
 * here. Everything else on this page is unchanged and still renders the honest empty states its
 * own data sources justify — a real approval queue for actions does not make the briefing,
 * recommendation or history sources connected, and none of them is presented as though it were.
 *
 * R3B MADE THIS THE ONE PAGE THAT CAN EXECUTE — with a SECOND, separate click. Authorizing still
 * only issues a bounded, revocable, single-spend permit; a Director then chooses to spend it, and
 * an authorization nobody clicks simply expires. There is no auto-execution and no worker.
 *
 * Every execution outcome shown here is derived from a durable attempt row. The page never says
 * "sent" or "delivered": the strongest available claim is that a provider accepted the operation,
 * and it appears only next to that provider's own message id.
 */

export default async function ApprovalsPage() {
  const model = getDecisionWorkspaceModel();
  const tenant = await resolveTenantContext();

  const [requests, permits] = await Promise.all([
    readPendingActionRequests(tenant),
    readActionPermits(tenant),
  ]);

  /*
   * "Connected" means the durable read actually answered — not that rows exist. An empty queue and
   * an unconfigured store are different truths, and collapsing them is the exact class of lie this
   * surface was built to avoid.
   */
  const connected = requests.status === "read" && permits.status === "read";

  return (
    <DecisionWorkspace
      model={model}
      actionAuthorizations={
        <ActionAuthorizations
          requests={requests.status === "read" ? requests.items : []}
          permits={permits.status === "read" ? permits.items : []}
          connected={connected}
        />
      }
    />
  );
}
