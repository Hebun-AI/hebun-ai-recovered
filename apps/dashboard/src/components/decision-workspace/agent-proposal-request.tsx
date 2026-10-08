"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DecisionRegion } from "./decision-region";
import { WorkScopeSelect, workScopeFromChoice, type WorkScopeChoice } from "@/components/work-domain/work-scope-select";
import { originateHebyActionProposalAction } from "@/app/(dashboard)/heby/actions";
import {
  AgentChoiceSelect,
  agentChoiceRequired,
  agentNameFor,
  agentSelectionFor,
  type AgentOption,
} from "@/components/agents/agent-choice-select";
import type { AgentOriginableActionKind, OriginationRefusal } from "@/features/agent-origination";

/*
 * Ask Heby for a proposal (AGENT-PROPOSAL-2) — the Director's entry to bounded agent origination.
 *
 * ── WHY IT LIVES ON THIS SURFACE ─────────────────────────────────────────────
 *
 * The result of asking is a PENDING PROPOSAL, and this page is where pending proposals are read and
 * decided. Putting the question anywhere else would mean a Director asks in one place and discovers
 * the answer in another. It is not a second Heby UI: there is no conversation here, no history, no
 * model prose rendered as an answer — one goal, at most one proposal, then stop.
 *
 * ── WHY THE SERVER ACTION BELONGS TO HEBY, NOT TO THIS ROUTE ─────────────────
 *
 * `approvals/actions.ts` states its own boundary: "THERE IS ALSO NO PROPOSE ACTION… letting a
 * browser post an arbitrary action request would make the proposal channel the weakest link", and
 * "Heby cannot reach this file". Both stay true. The proposal channel is written by the Heby
 * lifecycle server-side, so the action this component calls is exported there — and what the
 * browser posts is not an action request at all. It is a sentence.
 *
 * ── WHAT THE BROWSER MAY SAY ─────────────────────────────────────────────────
 *
 *   { goal: string }
 *
 * There is no field here for an agent, an actor type, a tenant, an action kind, a recipient or a
 * draft — and adding one would not be a feature, it would flip the attribution. If the browser
 * chose the action and its arguments, the proposer would be the human who chose them, and this
 * whole surface would be a slower way to type `/send`.
 *
 * ── EVERY OUTCOME IS ITS OWN SENTENCE ────────────────────────────────────────
 *
 * "Nothing warranted a proposal" is a successful piece of reasoning. "The model is unavailable",
 * "the model answered off-contract", "this organization has no agent" and "that exact proposal is
 * already waiting" are four different facts. Collapsing them into "something went wrong" would tell
 * a Director nothing about what to do next, and would hide a refusal that is working correctly.
 */

const MIN_GOAL = 12;
const MAX_GOAL = 2000;

/** One honest sentence per outcome. Nothing here implies an act occurred. */
export const REFUSAL_WORDING: Readonly<Record<OriginationRefusal, string>> = {
  "no-action-proposed":
    "{agent} considered the goal and proposed no action. Nothing was filed.",
  "no-candidates":
    "There is nothing to propose about yet: this organization's structure could not be read for recording work. Try again once the organization reads.",
  "observation-not-admitted":
    "An outside observation cannot be shown to {agent}'s model yet, so nothing was asked. Nothing was filed.",
  "model-unavailable":
    "{agent}'s model runtime is not available, so no reasoning happened. Nothing was filed.",
  "goal-rejected": "That goal was not accepted. State it as a sentence and try again.",
  "invalid-work-scope":
    "Choose what kind of work this is — organization-level or one work domain — before asking. Nothing was asked or filed.",
  /*
   * TWO KEYS, ONE SENTENCE — and deliberately so. `unauthenticated` and
   * `no-authorized-tenant-context` are different internal facts (the seam refused before the
   * proposer resolver, or inside it) that mean exactly one thing to a person: sign in. This is the
   * only pair permitted to share wording, and the surface test names the exception.
   */
  unauthenticated: "Sign in to ask Heby for a proposal.",
  "no-authorized-tenant-context": "Sign in to ask Heby for a proposal.",
  "no-durable-agent-identity":
    "This organization has no durable agent, so nothing could have originated a proposal. Create one on the Agents surface.",
  "durable-agent-identity-retired":
    "This organization's durable agent has been retired and cannot propose new work.",
  "ambiguous-durable-agent-identity":
    "More than one agent is in service, so Hebun cannot tell which one would be proposing. Choose the agent above before asking.",
  "selected-agent-unresolvable":
    "The chosen agent is not one of this organization's agents, so nothing was asked. Nothing was filed.",
  "selected-agent-retired":
    "The chosen agent has been retired and cannot propose new work. Nothing was filed.",
  "agent-identity-authority-unavailable":
    "The agent identity authority could not be reached, so Hebun cannot say which agent would propose. Nothing was filed.",
  "not-a-structured-object":
    "{agent} answered with prose rather than a structured proposal, so nothing was filed.",
  "unexpected-shape": "{agent}'s answer did not match the proposal contract, so nothing was filed.",
  "unsupported-action-kind":
    "{agent} named an action it is not permitted to propose, so nothing was filed.",
  "invalid-arguments":
    "{agent}'s proposal was missing arguments, carried unexpected ones, or named neither of the two organizational truths a work record may declare. Nothing was filed.",
  "malformed-reference": "{agent} named a reference that is not well formed. Nothing was filed.",
  "reference-not-offered":
    "{agent} named a recipient, draft or department that was not among the ones this organization offered it. Nothing was filed.",
  "invalid-reason": "{agent} gave no usable reason for its proposal, so nothing was filed.",
  "duplicate-knowledge-reference": "{agent} cited the same Knowledge twice, so nothing was filed.",
  "no-knowledge-reference": "{agent} cited no organizational Knowledge, so no Knowledge-grounded proposal was filed.",
  "knowledge-unavailable": "Hebun could not confirm which Knowledge is eligible right now, so nothing was asked or filed.",
  "no-eligible-knowledge": "This organization has no ratified Knowledge eligible for grounding yet, so nothing was asked or filed.",
  "knowledge-universe-exceeds-bound": "More than 20 Knowledge statements are eligible, which is more than one request may carry, so nothing was asked or filed.",
  "knowledge-candidate-too-large": "An eligible Knowledge statement is longer than one request may carry, so nothing was asked or filed.",
  "knowledge-reference-stale": "Knowledge {agent} cited changed or is no longer eligible, so nothing was filed.",
  "proposal-refused":
    "What {agent} chose could not be filed — a reference may have been retired or superseded since, or its mandate does not admit that action. Nothing was filed.",
};

/*
 * AP-5A — WHICH AGENT A SENTENCE IS ABOUT. The sentences above name `{agent}`, filled from the agent
 * the human chose (or the single one in service), as the server's identity read listed it. A display
 * name only: it never reaches a model and decides nothing. Unknown, the sentence says "the agent".
 */
export function withAgentName(sentence: string, agentName: string | null | undefined): string {
  const filled = sentence.replaceAll("{agent}", agentName && agentName.length > 0 ? agentName : "the agent");
  return filled.charAt(0).toUpperCase() + filled.slice(1);
}

/** One honest sentence per outcome, about the agent it concerns. */
export function refusalWordingFor(reason: OriginationRefusal, agentName: string | null | undefined): string {
  return withAgentName(REFUSAL_WORDING[reason], agentName);
}

/*
 * THE DUPLICATE IS ITS OWN SENTENCE. The inlet's `already-pending` arrives as the DETAIL of a
 * `proposal-refused`, and rendering it as "the references could not be filed" would be wrong in a
 * way a Director would act on: nothing is broken, the exact proposal is already in the queue below.
 */
export const ALREADY_PENDING_DETAIL = "already-pending";
export const ALREADY_PENDING_WORDING =
  "{agent} proposed exactly this action already, and it is still waiting for your review below. Nothing was filed again.";

/*
 * WHICH ACTION WAS PROPOSED (TRH-17).
 *
 * Two admitted kinds means "Heby proposed one action" no longer says enough: recording work and
 * sending an external communication are different consequences, and a Director deciding below
 * should read which one they are about to consider before they scroll.
 */
export const PROPOSED_KIND_WORDING: Readonly<Record<AgentOriginableActionKind, string>> = {
  send: "sending an external communication",
  "record-work": "recording organizational work",
};

type Outcome =
  | { readonly kind: "idle" }
  | { readonly kind: "proposed"; readonly action: AgentOriginableActionKind; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: OriginationRefusal; readonly detail?: string };

export function AgentProposalRequest({
  workScopeChoices,
  agentOptions = [],
}: {
  readonly workScopeChoices: readonly WorkScopeChoice[];
  /*
   * AP-5A — the in-service agents, read by the page from the Agent Identity Authority. With several,
   * the human names one (no default) and its id travels as a LOOKUP KEY the origination seam
   * verifies. With one, nothing extra is sent: the path is exactly what it was.
   */
  readonly agentOptions?: readonly AgentOption[];
}) {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [agentId, setAgentId] = useState("");
  const agentName = agentNameFor(agentOptions, agentId);
  /* AP-4B — the work scope the HUMAN chooses; the agent never does. No default. */
  const [workScope, setWorkScope] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const ready =
    goal.trim().length >= MIN_GOAL &&
    goal.length <= MAX_GOAL &&
    workScope !== "" &&
    (!agentChoiceRequired(agentOptions) || agentId !== "");

  const ask = () =>
    startTransition(async () => {
      setOutcome({ kind: "idle" });
      const result = await originateHebyActionProposalAction({
        goal,
        workScope: workScopeFromChoice(workScope),
        ...agentSelectionFor(agentOptions, agentId),
      });
      if (result.status === "proposed") {
        setOutcome({ kind: "proposed", action: result.kind, reason: result.reason });
        /*
         * The queue below is server-rendered, and the Heby boundary is forbidden from invalidating
         * routes. Refreshing from the client is how the new pending row appears — it re-reads the
         * same seam the page already uses rather than inserting anything locally.
         */
        router.refresh();
        return;
      }
      setOutcome({ kind: "refused", reason: result.reason, detail: result.detail });
    });

  return (
    <DecisionRegion title="Ask Heby for a proposal" eyebrow="Agent origination">
      <div className="flex flex-col gap-3">
        <p className="text-xs text-fg-secondary">
          State a goal. The agent may propose one bounded action for you to review below — recording
          organizational work, or sending an external communication — and it cannot approve,
          authorize or perform anything. What its mandate does not admit is refused.
        </p>
        <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="heby-goal">
          Goal
          <textarea
            id="heby-goal"
            value={goal}
            onChange={(event) => setGoal(event.target.value)}
            rows={3}
            maxLength={MAX_GOAL}
            placeholder="What do you want handled? For example: Ayşe is waiting on the quarterly summary."
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-fg-primary"
          />
        </label>

        <AgentChoiceSelect id="heby-agent" value={agentId} onChange={setAgentId} agents={agentOptions} />

        <label className="flex flex-col gap-1 text-xs text-fg-secondary" htmlFor="heby-work-scope">
          Work scope — what kind of work this is. You choose it; the agent does not.
          <WorkScopeSelect id="heby-work-scope" value={workScope} onChange={setWorkScope} choices={workScopeChoices} />
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready || pending}
            onClick={ask}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg-primary disabled:opacity-50"
          >
            {pending ? `${withAgentName("{agent}", agentName)} is considering…` : `Ask ${agentName ?? "the agent"}`}
          </button>
          <span className="text-xs text-fg-secondary">
            Heby proposes. A human authorizes. Execution is a separate, later act.
          </span>
        </div>

        {outcome.kind === "proposed" ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
            <span className="font-medium">
              {withAgentName("{agent}", agentName)} proposed one action: {PROPOSED_KIND_WORDING[outcome.action]}.
            </span>{" "}
            It is waiting for your review below — nothing has been authorized, nothing has been
            recorded, and nothing has been sent.
            <span className="mt-1 block text-xs text-fg-secondary">
              {withAgentName("{agent}", agentName)}&rsquo;s stated reason: {outcome.reason}
            </span>
          </p>
        ) : null}

        {outcome.kind === "refused" ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
            {outcome.reason === "proposal-refused" && outcome.detail === ALREADY_PENDING_DETAIL
              ? withAgentName(ALREADY_PENDING_WORDING, agentName)
              : refusalWordingFor(outcome.reason, agentName)}
            {outcome.detail && outcome.detail !== ALREADY_PENDING_DETAIL ? (
              <span className="mt-1 block text-xs text-fg-secondary">
                {withAgentName("{agent}", agentName)}&rsquo;s stated reason: {outcome.detail}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </DecisionRegion>
  );
}
