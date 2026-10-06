"use client";

/*
 * heby-origination-affordance.tsx — WF-1: under a human's own Heby message, a quiet way to ask the
 * organization's durable agent to PROPOSE that message as organizational work.
 *
 * NOT A CLASSIFIER. Heby does not decide that a message "is" work; there is no intent detector and
 * this control claims none. It is offered under every settled human message and the human decides.
 *
 * FOUR SEPARATE STEPS, never collapsed:
 *   1. closed      — a small text button. Rendering it reads nothing and calls nothing.
 *   2. checked     — on click, the server's READ projection says whether the option can be offered
 *                    now, naming the real agent and its effective mandate. Point-in-time only.
 *   3. requested   — on an explicit confirmation, the released origination seam runs ONCE with the
 *                    message exactly as the human wrote it. It re-checks every authority and wins.
 *   4. outcome     — at most a PENDING proposal for /approvals, or the seam's own refusal sentence.
 * Nothing here approves, authorizes, records or executes anything, and nothing retries.
 *
 * The browser sends the goal and nothing else: no tenant, no agent, no scope, no availability.
 */
import { useState, useTransition } from "react";
import Link from "next/link";
import { originateHebyActionProposalAction } from "@/app/(dashboard)/heby/actions";
import { readAgentOriginationAvailabilityAction } from "@/app/(dashboard)/heby/origination-availability-actions";
import type { AgentOriginationAvailability, OriginationUnavailableReason } from "@/features/origination-availability/contracts";
import type { AgentOriginableActionKind, OriginationRefusal } from "@/features/agent-origination";
import {
  ALREADY_PENDING_DETAIL,
  PROPOSED_KIND_WORDING,
  REFUSAL_WORDING,
} from "@/components/decision-workspace/agent-proposal-request";

/* The released sentence says "below" — true on /approvals, false here — so this surface has its own. */
const ALREADY_PENDING_WORDING =
  "This exact proposal is already waiting for review in Approvals. Nothing was filed again.";

const UNAVAILABLE_WORDING: Readonly<Record<OriginationUnavailableReason, string>> = {
  "tenant-unavailable": "Sign in to ask an agent for a proposal.",
  "no-agent": "This organization has no durable agent, so nothing can propose this as work.",
  "agent-retired": "This organization's agent has been retired and cannot propose new work.",
  "multiple-agents": "More than one agent is in service, and explicit agent selection does not exist yet.",
  "mandate-unavailable": "The agent has no mandate in effect, so it cannot propose anything.",
  "proposal-scope-unavailable": "The agent's mandate does not admit recording organizational work.",
  "model-unavailable": "Heby's model runtime is not available right now, so the agent cannot be asked.",
  "external-ai-not-authorized": "This organization has not authorized the external model use that agent origination needs.",
  "temporarily-unavailable": "Hebun could not confirm the agent's current authority, so it is not offering this right now.",
};

type State =
  | { readonly kind: "closed" }
  | { readonly kind: "checking" }
  | { readonly kind: "checked"; readonly availability: AgentOriginationAvailability }
  | { readonly kind: "asking"; readonly agentName: string }
  | { readonly kind: "proposed"; readonly agentName: string; readonly action: AgentOriginableActionKind; readonly reason: string }
  | { readonly kind: "refused"; readonly reason: OriginationRefusal; readonly detail?: string };

const TEXT_BUTTON =
  "rounded text-[0.72rem] text-fg-muted transition-colors hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight disabled:opacity-50";
const PANEL = "max-w-[80%] rounded-xl border border-border bg-surface px-3 py-2.5 text-xs leading-5 text-fg-secondary";

export function HebyOriginationAffordance({ goal }: { readonly goal: string }) {
  const [state, setState] = useState<State>({ kind: "closed" });
  const [, startTransition] = useTransition();

  /* A slash command is an instruction to Heby's UI, not a goal anyone wrote. */
  if (goal.trimStart().startsWith("/")) return null;

  const check = () => {
    setState({ kind: "checking" });
    startTransition(async () => {
      setState({ kind: "checked", availability: await readAgentOriginationAvailabilityAction() });
    });
  };

  const confirm = (agentName: string) => {
    setState({ kind: "asking", agentName });
    startTransition(async () => {
      const result = await originateHebyActionProposalAction({ goal });
      setState(
        result.status === "proposed"
          ? { kind: "proposed", agentName, action: result.kind, reason: result.reason }
          : { kind: "refused", reason: result.reason, detail: result.detail },
      );
    });
  };

  if (state.kind === "closed" || state.kind === "checking") {
    return (
      <button type="button" className={TEXT_BUTTON} disabled={state.kind === "checking"} onClick={check}>
        {state.kind === "checking" ? "Checking the agent's current authority…" : "Propose as organizational work…"}
      </button>
    );
  }

  if (state.kind === "checked" && state.availability.status === "unavailable") {
    return (
      <div className={PANEL} role="status">
        {UNAVAILABLE_WORDING[state.availability.reason]}{" "}
        <button type="button" className={TEXT_BUTTON} onClick={() => setState({ kind: "closed" })}>
          Close
        </button>
      </div>
    );
  }

  if (state.kind === "checked" && state.availability.status === "available") {
    const { agent, mandate } = state.availability;
    return (
      <div className={PANEL} data-wf1-offer="">
        <p className="text-fg">
          <span className="font-medium">{agent.name}</span> can be asked to propose this message as organizational work.
        </p>
        <p className="mt-1">
          Mandate revision {mandate.revision} · stated purpose: {mandate.purpose}
        </p>
        <p className="mt-1">From here it may only propose recording organizational work.</p>
        <p className="mt-1">
          Asking may make one external model call. If {agent.name} proposes, the result is one pending proposal in
          Approvals. Nothing is approved or executed automatically. This was checked just now and is checked again
          when you ask.
        </p>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-fg"
            onClick={() => confirm(agent.name)}
          >
            Ask {agent.name} to propose
          </button>
          <button type="button" className={TEXT_BUTTON} onClick={() => setState({ kind: "closed" })}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state.kind === "asking") {
    return (
      <div className={PANEL} aria-live="polite">
        {state.agentName} is considering this. Nothing has been filed yet.
      </div>
    );
  }

  if (state.kind === "proposed") {
    return (
      <div className={PANEL} role="status">
        <p className="text-fg">
          <span className="font-medium">
            {state.agentName} proposed one action: {PROPOSED_KIND_WORDING[state.action]}.
          </span>{" "}
          It is waiting for review in{" "}
          <Link href="/approvals" className="underline">
            Approvals
          </Link>{" "}
          — nothing has been authorized, recorded or executed.
        </p>
        <p className="mt-1">Stated reason: {state.reason}</p>
      </div>
    );
  }

  if (state.kind === "refused") {
    return (
      <div className={PANEL} role="status">
        {state.reason === "proposal-refused" && state.detail === ALREADY_PENDING_DETAIL
          ? ALREADY_PENDING_WORDING
          : REFUSAL_WORDING[state.reason]}
        {state.detail && state.detail !== ALREADY_PENDING_DETAIL ? (
          <span className="mt-1 block">Stated reason: {state.detail}</span>
        ) : null}
      </div>
    );
  }

  return null;
}
