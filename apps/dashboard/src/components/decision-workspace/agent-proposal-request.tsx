"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DecisionRegion } from "./decision-region";
import { originateHebyActionProposalAction } from "@/app/(dashboard)/heby/actions";
import type { OriginationRefusal } from "@/features/agent-origination";

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
const REFUSAL_WORDING: Readonly<Record<OriginationRefusal, string>> = {
  "no-action-proposed":
    "Heby considered the goal and proposed no action. Nothing was filed.",
  "no-candidates":
    "There is nothing to propose about yet: this organization has no recorded recipient and prepared draft to choose between. Record them in Operations first.",
  "model-unavailable":
    "Heby's model runtime is not available, so no reasoning happened. Nothing was filed.",
  "goal-rejected": "That goal was not accepted. State it as a sentence and try again.",
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
    "More than one agent is in service, so Hebun cannot tell which one would be proposing. Explicit agent selection does not exist yet.",
  "agent-identity-authority-unavailable":
    "The agent identity authority could not be reached, so Hebun cannot say which agent would propose. Nothing was filed.",
  "not-a-structured-object":
    "Heby answered with prose rather than a structured proposal, so nothing was filed.",
  "unexpected-shape": "Heby's answer did not match the proposal contract, so nothing was filed.",
  "unsupported-action-kind":
    "Heby named an action it is not permitted to propose, so nothing was filed.",
  "invalid-arguments": "Heby's proposal was missing or carried unexpected arguments. Nothing was filed.",
  "malformed-reference": "Heby named a reference that is not well formed. Nothing was filed.",
  "reference-not-offered":
    "Heby named a recipient or draft that was not among the ones this organization offered it. Nothing was filed.",
  "invalid-reason": "Heby gave no usable reason for its proposal, so nothing was filed.",
  "proposal-refused":
    "The references Heby chose could not be filed — they may have been retired or superseded since. Nothing was filed.",
};

/*
 * THE DUPLICATE IS ITS OWN SENTENCE. The inlet's `already-pending` arrives as the DETAIL of a
 * `proposal-refused`, and rendering it as "the references could not be filed" would be wrong in a
 * way a Director would act on: nothing is broken, the exact proposal is already in the queue below.
 */
const ALREADY_PENDING_DETAIL = "already-pending";
const ALREADY_PENDING_WORDING =
  "Heby proposed exactly this action already, and it is still waiting for your review below. Nothing was filed again.";

type Outcome =
  | { readonly kind: "idle" }
  | { readonly kind: "proposed"; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: OriginationRefusal; readonly detail?: string };

export function AgentProposalRequest() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [outcome, setOutcome] = useState<Outcome>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  const ready = goal.trim().length >= MIN_GOAL && goal.length <= MAX_GOAL;

  const ask = () =>
    startTransition(async () => {
      setOutcome({ kind: "idle" });
      const result = await originateHebyActionProposalAction({ goal });
      if (result.status === "proposed") {
        setOutcome({ kind: "proposed", reason: result.reason });
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
          State a goal. Heby may propose one bounded action for you to review below — it cannot
          approve, authorize or perform anything.
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

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!ready || pending}
            onClick={ask}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-fg-primary disabled:opacity-50"
          >
            {pending ? "Heby is considering…" : "Ask Heby"}
          </button>
          <span className="text-xs text-fg-secondary">
            Heby proposes. A human authorizes. Execution is a separate, later act.
          </span>
        </div>

        {outcome.kind === "proposed" ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
            <span className="font-medium">Heby proposed one action.</span> It is waiting for your
            review below — nothing has been authorized, and nothing has been sent.
            <span className="mt-1 block text-xs text-fg-secondary">
              Heby&rsquo;s stated reason: {outcome.reason}
            </span>
          </p>
        ) : null}

        {outcome.kind === "refused" ? (
          <p className="rounded-lg border border-border bg-surface p-3 text-sm text-fg-primary">
            {outcome.reason === "proposal-refused" && outcome.detail === ALREADY_PENDING_DETAIL
              ? ALREADY_PENDING_WORDING
              : REFUSAL_WORDING[outcome.reason]}
            {outcome.detail && outcome.detail !== ALREADY_PENDING_DETAIL ? (
              <span className="mt-1 block text-xs text-fg-secondary">
                Heby&rsquo;s stated reason: {outcome.detail}
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </DecisionRegion>
  );
}
