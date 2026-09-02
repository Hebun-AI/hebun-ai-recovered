import { DecisionWorkspace } from "@/components/decision-workspace/decision-workspace";
import { ActionAuthorizations } from "@/components/decision-workspace/action-authorizations";
import { AgentProposalRequest } from "@/components/decision-workspace/agent-proposal-request";
import { ExecutionLedger } from "@/components/decision-workspace/execution-ledger";
import { DecisionHorizonPanel } from "@/components/decision-workspace/decision-horizon-panel";
import { getDecisionWorkspaceModel } from "@/features/decisions/workspace-model";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  readActionPermits,
  readPendingActionRequests,
} from "@/features/action-authorization/read-action-authorizations.server";
import { elapsedSince } from "@/features/attention-observation/contracts";
import { readAwaitingDecisionAggregate } from "@/features/action-authorization/awaiting-decision-aggregate.server";
import { readExecutionLedger } from "@/features/action-execution/execution-ledger-projection.server";
import { readDecisionHorizon } from "@/features/decision-horizon/read-decision-horizon.server";

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
 *
 * GOVERNED-EXECUTION-1 MADE THAT RECORD SURVIVE A RELOAD. Until it, an outcome was visible only in
 * the response to the click that produced it — so the one state a human must never miss, an
 * `unknown` whose external effect may already have occurred, vanished when the page was refreshed
 * while the row that recorded it sat unread. The ledger below reads that row. It adds NO control:
 * it cannot retry, replay, reconcile or resolve anything, and a second send still requires a new
 * proposal, a new Governance decision and a new permit.
 */

export default async function ApprovalsPage() {
  const model = getDecisionWorkspaceModel();
  const tenant = await resolveTenantContext();

  const [requests, permits, ledger, awaiting] = await Promise.all([
    readPendingActionRequests(tenant),
    readActionPermits(tenant),
    /*
     * GOVERNED-EXECUTION-1 — the durable record of acts already performed. Read here, with the
     * same tenant the other two are given, because a component on this surface may not resolve one
     * of its own. It is a THIRD read with its own availability, not a field on either of the
     * others: an unreadable ledger must not make the authorization queue look unavailable, and an
     * unreadable queue must not hide an irreversible act that already happened.
     */
    readExecutionLedger(tenant),
    /*
     * E2-4 — a FOURTH read, and the only honest source for "oldest" and for a true total: the
     * queue reader above is `orderBy desc(created_at) limit 50`, so the oldest pending proposal is
     * the first row it drops. Its own availability, like the other three.
     */
    readAwaitingDecisionAggregate(tenant),
  ]);

  /*
   * DH-1 — a FIFTH read, and the only one that answers the question this whole surface is named
   * after. The four above are all Action Authorization's; this one asks EVERY authority that owns
   * a human decision, and carries its own completeness verdict. Its own availability, like the
   * others: a partial horizon must never render as a complete one.
   */
  const horizon = await readDecisionHorizon(tenant);
  /* ONE instant for every duration this page renders, resolved on the server. */
  const evaluatedAt = new Date().toISOString();

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
        <>
          {/*
           * AGENT-PROPOSAL-2 — asking sits directly above the queue the answer lands in, inside the
           * EXISTING slot. No eighth workspace, no new route, no navigation change: the Director
           * asks and reviews in one place because the proposal is the same object in both.
           */}
          {/*
           * DH-1 — the whole shape of what is waiting, ABOVE the queue that is one third of it.
           * A Director reading a full-looking action queue had no way to learn that hypotheses and
           * Knowledge versions were waiting on other surfaces.
           */}
          <DecisionHorizonPanel horizon={horizon} />
          <AgentProposalRequest />
          <ActionAuthorizations
            requests={requests.status === "read" ? requests.items : []}
            permits={permits.status === "read" ? permits.items : []}
            connected={connected}
            evaluatedAt={evaluatedAt}
            awaitingCount={awaiting.status === "read" ? awaiting.value.awaiting : null}
            oldestWaiting={
              awaiting.status === "read"
                ? elapsedSince(
                    awaiting.value.oldestFiledAt,
                    evaluatedAt,
                    "action-request.created_at",
                  )
                : null
            }
          />
          {/*
           * The ledger sits BELOW the queue on purpose: what is still to be decided comes first,
           * and what has already been done is the record beneath it. It offers no control — every
           * act it shows is finished, and a second one would need a new decision.
           */}
          <ExecutionLedger
            entries={ledger.status === "read" ? ledger.entries : []}
            needsAttention={ledger.status === "read" ? ledger.needsAttention : []}
            connected={ledger.status === "read"}
            historyTruncated={ledger.status === "read" ? ledger.historyTruncated : false}
            attentionTruncated={ledger.status === "read" ? ledger.attentionTruncated : false}
          />
        </>
      }
    />
  );
}
