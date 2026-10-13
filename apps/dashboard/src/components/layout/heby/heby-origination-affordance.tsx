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
 * HEBY-REQUEST-LIFECYCLE — after step 4, an explicit "Check what happened" READS the filed request's
 * decision, permit and execution rows and says what they state, so the human who asked learns the
 * outcome here. Only on a click; reading changes nothing.
 *
 * The browser sends the goal and nothing else: no tenant, no scope, no availability. AP-1: when the
 * organization has more than one agent in service, the human chooses one, and only THEN does the
 * browser also send that agent's id — a lookup key the server verifies. With a single agent nothing
 * extra is sent, so that path is exactly what it was.
 */
import { useState, useTransition, useId } from "react";
import Link from "next/link";
import { originateHebyActionProposalAction } from "@/app/(dashboard)/heby/actions";
import { originateKnowledgeGroundedProposalAction } from "@/app/(dashboard)/heby/knowledge-origination-actions";
import { readAgentOriginationAvailabilityAction } from "@/app/(dashboard)/heby/origination-availability-actions";
import {
  readHebyRequestLifecycleAction,
  type ActionRequestLifecycleRead,
  type ActionRequestLifecycleView,
} from "@/app/(dashboard)/heby/request-lifecycle-actions";
import { PLACE_HUMAN_ACTION_KIND, RECORD_WORK_ACTION_KIND } from "@/features/heby-action-inlet/contracts";
import type { AgentOriginationAvailability, OriginationUnavailableReason } from "@/features/origination-availability/contracts";
import type { AgentOriginableActionKind, OriginationRefusal } from "@/features/agent-origination";
import { WorkScopeSelect, workScopeFromChoice, choiceFromWorkScope } from "@/components/work-domain/work-scope-select";
import { PLAN_FOLLOW_UP_LABEL } from "@/features/heby-commands/plan-follow-up";
import {
  ALREADY_PENDING_DETAIL,
  PROPOSED_KIND_WORDING,
  refusalWordingFor,
} from "@/components/decision-workspace/agent-proposal-request";

/* The released sentence says "below" — true on /approvals, false here — so this surface has its own. */
const ALREADY_PENDING_WORDING =
  "This exact proposal is already waiting for review in Approvals. Nothing was filed again.";

const UNAVAILABLE_WORDING: Readonly<Record<OriginationUnavailableReason, string>> = {
  "tenant-unavailable": "Sign in to ask an agent for a proposal.",
  "no-agent": "This organization has no durable agent, so nothing can propose this as work.",
  /* L-2b — the code predates suspension; it means "not in service", which is retired OR suspended. */
  "agent-retired": "This organization's agent is not in service (retired or suspended) and cannot propose new work.",
  "multiple-agents": "More than one agent is in service. Choose which one to ask:",
  "selected-agent-unresolvable": "That agent is not one of this organization's agents, so it cannot be asked.",
  "mandate-unavailable": "The agent has no mandate in effect, so it cannot propose anything.",
  "proposal-scope-unavailable": "The agent's mandate does not admit recording organizational work.",
  "no-work-responsibility":
    "The agent's mandate grants it responsibility for no work scope in service, so it cannot propose work.",
  "model-unavailable": "The model runtime is not available right now, so the agent cannot be asked.",
  "external-ai-not-authorized": "This organization has not authorized the external model use that agent origination needs.",
  "temporarily-unavailable": "Hebun could not confirm the agent's current authority, so it is not offering this right now.",
};

type State =
  | { readonly kind: "closed" }
  | { readonly kind: "checking" }
  | { readonly kind: "checked"; readonly availability: AgentOriginationAvailability }
  | { readonly kind: "asking"; readonly agentName: string }
  | {
      readonly kind: "proposed";
      readonly agentName: string;
      readonly action: AgentOriginableActionKind;
      readonly reason: string;
      readonly requestId: string;
      readonly lifecycle?: ActionRequestLifecycleRead | "checking";
    }
  | { readonly kind: "unknown"; readonly agentName: string }
  | { readonly kind: "refused"; readonly agentName: string; readonly reason: OriginationRefusal; readonly detail?: string };

/* Internal acts: spending the permit and making the change are one transaction (GIA-1). */
const INTERNAL_ACTION_KINDS: readonly string[] = [RECORD_WORK_ACTION_KIND, PLACE_HUMAN_ACTION_KIND];
const when = (iso: string | null) => (iso ? ` ${new Date(iso).toUTCString()}` : "");
const PROPOSER_WORDING: Readonly<Record<string, string>> = { agent: "an agent", human: "a person" };

/** What the request's own rows state, in order. Never a sentence the rows do not support. */
/**
 * HEBY-VERIFIED-WORK-OUTCOMES — the work a spent `record-work` authorization produced, exactly as
 * Organizational Work links and names it. When that authority cannot name it, say so; never
 * substitute the request's own title, which is what was asked for, not what exists.
 */
function describeWorkOutcome(outcome: ActionRequestLifecycleView["workOutcome"]): readonly string[] {
  if (outcome === null) return [];
  if (outcome.status === "reference-unavailable") return ["Execution recorded. Work item reference unavailable."];
  const scope =
    outcome.scope === null
      ? "Work scope not recorded"
      : outcome.scope.kind === "organization"
        ? "Organization-level work"
        : `Work domain: ${outcome.scope.name}`;
  return [`Work item recorded: ${outcome.title}.`, `${scope} · work item ${outcome.workItemId}.`];
}

export function describeRequestLifecycle(view: ActionRequestLifecycleView): readonly string[] {
  const out = [`Proposed${when(view.proposedAt)} by ${PROPOSER_WORDING[view.proposedByActorType] ?? "the system"}.`];
  const { decision, permit, execution } = view;
  if (decision.status === "pending") {
    out.push("Waiting for a human decision in Approvals. Nothing is authorized or executed yet.");
    return out;
  }
  if (decision.status === "rejected") {
    out.push(`Rejected${when(decision.at)}. Nothing will be executed. The reason is recorded with the decision.`);
    return out;
  }
  out.push(
    decision.standing
      ? `Approved${when(decision.at)} under a standing authorization a human signed in advance.`
      : `Approved${when(decision.at)} by a human decision.`,
  );
  if (permit === null || permit.state === "none") {
    out.push("No usable authorization is recorded for it, so nothing can be executed.");
  } else if (permit.state === "active") {
    out.push(`Authorized and not yet executed. The authorization expires${when(permit.expiresAt)}.`);
  } else if (permit.state === "expired") {
    out.push(`The authorization expired${when(permit.expiresAt)} without being used. Nothing was executed.`);
  } else if (permit.state === "revoked") {
    out.push(`The authorization was revoked${when(permit.revokedAt)}. Nothing was executed under it.`);
  } else if (INTERNAL_ACTION_KINDS.includes(view.actionKind)) {
    out.push(
      `Executed${when(permit.consumedAt)}. Using the authorization and making the change are one transaction, so the change is recorded.`,
    );
    out.push(...describeWorkOutcome(view.workOutcome));
  } else if (execution === null) {
    out.push("The authorization was used, but no delivery attempt is recorded, so no effect can be claimed.");
  } else if (execution.status === "accepted" && execution.providerAccepted) {
    out.push("Delivered: the provider accepted it.");
  } else if (execution.status === "pending") {
    out.push("Delivery started; its outcome is not recorded yet.");
  } else if (execution.status === "refused") {
    out.push("Hebun refused it before contacting the provider. Nothing was sent.");
  } else if (execution.status === "failed") {
    out.push("Delivery was attempted and did not take effect.");
  } else {
    out.push("The outcome is unknown: Hebun cannot prove whether the provider received it.");
  }
  return out;
}

const LIFECYCLE_UNREADABLE: Readonly<Record<"not-found" | "unavailable", string>> = {
  "not-found": "That request is not readable in this organization.",
  unavailable: "Hebun could not read the request's current state right now. Nothing was changed.",
};

const TEXT_BUTTON =
  "rounded text-[0.72rem] text-fg-muted transition-colors hover:text-fg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight disabled:opacity-50";
const PANEL = "max-w-[80%] rounded-xl border border-border bg-surface px-3 py-2.5 text-xs leading-5 text-fg-secondary";

/*
 * HEBY-PLAN-DELEGATION-1 — `followUp` marks an offer under an accepted AI plan recommendation. The goal
 * is then one of the fixed `PLAN_FOLLOW_UP_GOALS`; the flow, the server action and its input are the
 * same released ones. Only the wording changes, and the Knowledge mode is not offered: a follow-up
 * discloses nothing beyond the fixed goal and the organization structure origination already sends.
 */
export function HebyOriginationAffordance({ goal, followUp = false }: { readonly goal: string; readonly followUp?: boolean }) {
  const [state, setState] = useState<State>({ kind: "closed" });
  /* AP-1 — set only by an explicit human choice among `multiple-agents` candidates. */
  const [chosenAgentId, setChosenAgentId] = useState<string | undefined>(undefined);
  /* AP-4B — the work scope the HUMAN chooses. No default, even when only one is eligible. */
  const [workScope, setWorkScope] = useState("");
  const [, startTransition] = useTransition();
  /* More than one offer can be open at once (one per plan recommendation): each needs its own id. */
  const scopeSelectId = useId();

  /* A slash command is an instruction to Heby's UI, not a goal anyone wrote. */
  if (goal.trimStart().startsWith("/")) return null;

  const check = (agentId?: string) => {
    setChosenAgentId(agentId);
    setState({ kind: "checking" });
    startTransition(async () => {
      setState({
        kind: "checked",
        availability: await readAgentOriginationAvailabilityAction(agentId ? { agentId } : undefined),
      });
    });
  };

  /* WF-3C — the Knowledge mode is a separate, explicit choice: a different action, never a flag. */
  const confirm = (agentName: string, withKnowledge = false) => {
    setState({ kind: "asking", agentName });
    startTransition(async () => {
      const scope = workScopeFromChoice(workScope);
      const input = chosenAgentId ? { goal, agentId: chosenAgentId, workScope: scope } : { goal, workScope: scope };
      try {
        const result = withKnowledge
          ? await originateKnowledgeGroundedProposalAction(input)
          : await originateHebyActionProposalAction(input);
        setState(
          result.status === "proposed"
            ? {
                kind: "proposed",
                agentName,
                action: result.kind,
                reason: result.reason,
                requestId: result.proposal.receipt.requestId,
              }
            : { kind: "refused", agentName, reason: result.reason, detail: result.detail },
        );
      } catch {
        /* The call did not answer. Whether a proposal was filed is not known here, so say exactly that. */
        setState({ kind: "unknown", agentName });
      }
    });
  };

  /* HEBY-REQUEST-LIFECYCLE — a read, on an explicit click only. */
  const readLifecycle = (current: Extract<State, { kind: "proposed" }>) => {
    setState({ ...current, lifecycle: "checking" });
    startTransition(async () => {
      let lifecycle: ActionRequestLifecycleRead;
      try {
        lifecycle = await readHebyRequestLifecycleAction({ requestId: current.requestId });
      } catch {
        lifecycle = { status: "unavailable", reason: "read-failed" };
      }
      setState({ ...current, lifecycle });
    });
  };

  if (state.kind === "closed" || state.kind === "checking") {
    return (
      <button type="button" className={TEXT_BUTTON} disabled={state.kind === "checking"} onClick={() => check()}>
        {state.kind === "checking"
          ? "Checking the agent's current authority…"
          : followUp
            ? PLAN_FOLLOW_UP_LABEL
            : "Propose as organizational work…"}
      </button>
    );
  }

  if (state.kind === "checked" && state.availability.status === "unavailable") {
    return (
      <div className={PANEL} role="status">
        {UNAVAILABLE_WORDING[state.availability.reason]}{" "}
        {state.availability.reason === "multiple-agents" && state.availability.candidates ? (
          <span className="mt-1 flex flex-wrap gap-2" data-ap1-agent-choice="">
            {state.availability.candidates.map((candidate) => (
              <button
                key={candidate.agentId}
                type="button"
                className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-fg"
                onClick={() => check(candidate.agentId)}
              >
                {candidate.name}
                {/* AP-4B — what each candidate is responsible for: a projection, never a ranking. */}
                {state.availability.workScopes ? (
                  <span className="ml-1 font-normal text-fg-muted">
                    (
                    {state.availability.workScopes
                      .filter((o) => o.eligibleAgentIds.includes(candidate.agentId))
                      .map((o) => o.label)
                      .join(", ") || "no work scope"}
                    )
                  </span>
                ) : null}
              </button>
            ))}
          </span>
        ) : null}
        <button type="button" className={TEXT_BUTTON} onClick={() => setState({ kind: "closed" })}>
          Close
        </button>
      </div>
    );
  }

  if (state.kind === "checked" && state.availability.status === "available") {
    const { agent, mandate, workScopes } = state.availability;
    const choices = workScopes.map((o) => ({
      value: choiceFromWorkScope(o.scope),
      label: o.eligibleAgentIds.includes(agent.agentId) ? o.label : `${o.label} — not ${agent.name}'s responsibility`,
      disabled: !o.eligibleAgentIds.includes(agent.agentId),
    }));
    return (
      <div className={PANEL} data-wf1-offer="">
        {followUp ? (
          <>
            <p className="text-fg">
              <span className="font-medium">{agent.name}</span> can be asked to propose a NEW follow-up work item.
            </p>
            <p className="mt-1 text-fg" data-plan-follow-up-notice="">
              Yeni bir takip işi önerilir. Önerinin ilgili olduğu iş kayıtları değiştirilmez.
            </p>
            <p className="mt-1">
              The task {agent.name} is given, exactly: &ldquo;{goal}&rdquo; It names no work title, identifier or
              department.
            </p>
          </>
        ) : (
          <p className="text-fg">
            <span className="font-medium">{agent.name}</span> can be asked to propose this message as organizational work.
          </p>
        )}
        <p className="mt-1">
          Mandate revision {mandate.revision} · stated purpose: {mandate.purpose}
        </p>
        <p className="mt-1">From here it may only propose recording organizational work.</p>
        <p className="mt-1">
          Asking may make one external model call. If {agent.name} proposes, the result is a pending proposal for
          human review. Nothing is approved or executed automatically. This was checked just now and is checked again
          when you ask.
        </p>
        {followUp ? null : (
        <p className="mt-1">
          Grounded in Knowledge: {agent.name}{" "}is also shown this organization&apos;s ratified Knowledge eligible for
          grounding (at most 20 statements) and must cite at least one; nothing is filed otherwise.
        </p>
        )}
        <label className="mt-2 block" htmlFor={scopeSelectId}>
          Work-domain scope — what kind of work this is, not which department it belongs to. You choose it; the agent does not.
          <WorkScopeSelect id={scopeSelectId} value={workScope} onChange={setWorkScope} choices={choices} />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-fg"
            disabled={workScope === ""}
            onClick={() => confirm(agent.name)}
          >
            {followUp ? `Ask ${agent.name} to propose this follow-up` : `Ask ${agent.name} to propose`}
          </button>
          {followUp ? null : (
            <button
              type="button"
              className="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-fg"
              disabled={workScope === ""}
              onClick={() => confirm(agent.name, true)}
            >
              Ask, grounded in Knowledge
            </button>
          )}
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
          {/* Point-in-time at filing; once its current state is read, that reading replaces it. */}
          {state.lifecycle && state.lifecycle !== "checking" && state.lifecycle.status === "read" ? null : (
            <>
              When filed, it was waiting for review in{" "}
              <Link href="/approvals" className="underline">
                Approvals
              </Link>{" "}
              — nothing had been authorized, recorded or executed.
            </>
          )}
        </p>
        <p className="mt-1">Stated reason: {state.reason}</p>
        {state.lifecycle && state.lifecycle !== "checking" ? (
          <div className="mt-2 border-t border-border pt-2" data-heby-request-lifecycle="">
            {state.lifecycle.status === "read" ? (
              describeRequestLifecycle(state.lifecycle.lifecycle).map((line) => (
                <p key={line} className="text-fg">
                  {line}
                </p>
              ))
            ) : (
              <p>{LIFECYCLE_UNREADABLE[state.lifecycle.status]}</p>
            )}
          </div>
        ) : null}
        <button
          type="button"
          className={`mt-2 ${TEXT_BUTTON}`}
          disabled={state.lifecycle === "checking"}
          onClick={() => readLifecycle(state)}
        >
          {state.lifecycle === "checking"
            ? "Reading its current state…"
            : state.lifecycle
              ? "Check again"
              : "Check what happened"}
        </button>
      </div>
    );
  }

  if (state.kind === "unknown") {
    return (
      <div className={PANEL} role="status">
        The request to {state.agentName} did not complete, so Hebun cannot say here whether a proposal was filed.
        Approvals shows every pending proposal.
      </div>
    );
  }

  if (state.kind === "refused") {
    return (
      <div className={PANEL} role="status">
        {state.reason === "proposal-refused" && state.detail === ALREADY_PENDING_DETAIL
          ? ALREADY_PENDING_WORDING
          : refusalWordingFor(state.reason, state.agentName)}
        {state.detail && state.detail !== ALREADY_PENDING_DETAIL ? (
          <span className="mt-1 block">Stated reason: {state.detail}</span>
        ) : null}
      </div>
    );
  }

  return null;
}
