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
import { readWorkRegister } from "@/features/organizational-work/read-work.server";
import { StandingMutationEnvelopes } from "@/components/decision-workspace/standing-mutation-envelopes";
import { readStandingMutations } from "@/features/standing-mutation-authority/read-standing-mutations.server";
import {
  STANDING_MUTATION_MAX_ACTS_CEILING,
  STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES,
} from "@/features/standing-mutation-authority/authorize-standing-mutation.server";
import { readDurableAgentIdentityState } from "@/features/agent-identity/read-durable-agent-identity.server";

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
   * PBGA-1 — THE WORK A HUMAN MAY DECLARE A PENDING ACT SERVES.
   *
   * A FIFTH read with its own availability, for the same reason the four above have theirs: an
   * unreadable Work register must leave the authorization queue fully usable. When it cannot be
   * read the picker is simply absent, and no decision control is affected — declaring a purpose is
   * not a precondition of deciding anything.
   *
   * Only IN-SERVICE work is offered. Declaring that an act serves retired work would be recording
   * an intention against something the organization has withdrawn.
   */
  const workRegister = await readWorkRegister(tenant);
  const workOptions =
    workRegister.status === "available"
      ? workRegister.items
          .filter((item) => item.inService)
          .map((item) => ({ workItemId: item.workItemId, title: item.title }))
      : [];

  /*
   * DH-1 — a FIFTH read, and the only one that answers the question this whole surface is named
   * after. The four above are all Action Authorization's; this one asks EVERY authority that owns
   * a human decision, and carries its own completeness verdict. Its own availability, like the
   * others: a partial horizon must never render as a complete one.
   */
  const horizon = await readDecisionHorizon(tenant);

  /*
   * RUNG 2 — THE ENVELOPES THIS ORGANIZATION HAS GRANTED, and the agents one could name.
   *
   * A SIXTH and SEVENTH read, each with its own availability, for the same reason the others have
   * theirs: an unreadable envelope register must leave the authorization queue fully usable, and an
   * unreadable agent register must not make the envelope register look empty.
   *
   * Only IN-SERVICE agents are offered. An envelope naming a retired agent is refused by the writer
   * and would authorize nothing, so offering one would only manufacture a refusal.
   */
  const [standing, agentState] = await Promise.all([
    readStandingMutations(tenant),
    readDurableAgentIdentityState(tenant),
  ]);
  const agentOptions =
    agentState.status === "known"
      ? agentState.identities
          .filter((identity) => identity.inService)
          .map((identity) => ({ agentId: identity.agentId, name: identity.name }))
      : [];
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
          {/*
           * RUNG 2 — STANDING ENVELOPES, ABOVE the queue and ABOVE the ask.
           *
           * It sits first because it is the only control here that authorizes acts that have not
           * happened yet: a Director scrolling a queue of individual decisions must meet the one
           * control whose consequences are NOT individual decisions before they meet the rest.
           * It offers no execution and no issuance — it cannot, the firewall forbids this file's
           * whole directory from naming the issuing seam.
           */}
          <StandingMutationEnvelopes
            items={standing.status === "read" ? standing.items : []}
            connected={standing.status === "read"}
            agentOptions={agentOptions}
            maxActsCeiling={STANDING_MUTATION_MAX_ACTS_CEILING}
            minIntervalCeilingMinutes={STANDING_MUTATION_MIN_INTERVAL_CEILING_MINUTES}
          />
          <AgentProposalRequest />
          <ActionAuthorizations
            requests={requests.status === "read" ? requests.items : []}
            permits={permits.status === "read" ? permits.items : []}
            connected={connected}
            workOptions={workOptions}
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
