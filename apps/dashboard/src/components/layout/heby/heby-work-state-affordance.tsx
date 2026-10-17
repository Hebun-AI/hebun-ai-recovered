"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { AgentChoiceSelect, agentChoiceRequired, type AgentOption } from "@/components/agents/agent-choice-select";
import {
  proposeWorkStateChangeAction,
  readWorkStateAgentChoicesAction,
} from "@/app/(dashboard)/heby/work-state-origination-actions";
import type { OriginateWorkStateResult } from "@/features/agent-origination/originate-work-state.server";
import type { WorkStateAgentChoices } from "@/features/origination-availability/contracts";
import { WORK_DECLARED_STATES, type WorkDeclaredState } from "@/features/organizational-work/work-contracts";

/*
 * WORK-UPDATE V1 — ASK HEBY TO PROPOSE A DECLARED-STATE CHANGE FOR THIS ITEM.
 *
 * The human chooses the state; this item is the target. The agent is not shown the item or its
 * state — only a fixed sentence naming the state chosen here — and may propose or decline. A
 * proposal waits in /approvals; nothing changes until a person approves AND executes it. Only a work
 * item recorded in a work domain can be the target, because responsibility is checked against it.
 */
/** Shown beside an in-service agent the server said is not responsible for this item's work domain. */
export const NOT_RESPONSIBLE_NOTE = "not responsible for this work domain";

/*
 * WORK-UPDATE-AGENT-SELECTION-1 — what the person must choose, from what the server listed.
 *
 * With one in-service agent (or none, or an unreadable list) there is no choice and nothing is sent:
 * the server's single-agent rule answers exactly as it did before. With several, nobody is chosen
 * by default, an agent not responsible for the item cannot be chosen, and the id sent is only ever
 * one the server listed. The server resolves and re-checks it; this decides nothing.
 */
export function workStateAgentChoice(choices: WorkStateAgentChoices | null, chosenAgentId: string) {
  const agents: AgentOption[] =
    choices?.status === "read"
      ? choices.agents.map((agent) => ({
          agentId: agent.agentId,
          name: agent.name,
          ...(agent.responsible ? {} : { unavailableNote: NOT_RESPONSIBLE_NOTE }),
        }))
      : [];
  const required = agentChoiceRequired(agents);
  const chosen = required ? agents.find((agent) => agent.agentId === chosenAgentId && agent.unavailableNote === undefined) : undefined;
  return {
    agents,
    required,
    noneResponsible: required && agents.every((agent) => agent.unavailableNote !== undefined),
    ready: !required || chosen !== undefined,
    selection: chosen ? { agentId: chosen.agentId } : {},
    agentName: required ? (chosen?.name ?? null) : "Heby",
  };
}

export function HebyWorkStateAffordance({
  workItemId,
  declaredState,
}: {
  readonly workItemId: string;
  readonly declaredState: WorkDeclaredState;
}) {
  const [toState, setToState] = useState<WorkDeclaredState | "">("");
  const [result, setResult] = useState<OriginateWorkStateResult | null>(null);
  const [pending, start] = useTransition();
  const [agentChoices, setAgentChoices] = useState<WorkStateAgentChoices | null>(null);
  const [chosenAgentId, setChosenAgentId] = useState("");
  const [proposerName, setProposerName] = useState("Heby");
  useEffect(() => {
    let live = true;
    readWorkStateAgentChoicesAction({ workItemId })
      .then((read) => {
        if (live) setAgentChoices(read);
      })
      .catch(() => {
        if (live) setAgentChoices({ status: "unavailable" });
      });
    return () => {
      live = false;
    };
  }, [workItemId]);
  const agent = workStateAgentChoice(agentChoices, chosenAgentId);
  const choices = WORK_DECLARED_STATES.filter((state) => state !== declaredState);
  return (
    <details className="mt-2 rounded-md border border-border bg-bg">
      <summary className="cursor-pointer px-2.5 py-1.5 text-xs text-fg-secondary">
        Ask Heby to propose a state change
      </summary>
      <div className="space-y-2 border-t border-border p-2.5 text-xs leading-5">
        <p className="text-fg-muted">
          Heby is asked whether to propose declaring this work item with the state you choose. It is not
          shown the item or its title. A proposal waits for approval in /approvals and changes nothing
          until a person executes it, and only if the item still holds “{declaredState}”.
        </p>
        <AgentChoiceSelect
          id={`heby-work-state-agent-${workItemId}`}
          value={chosenAgentId}
          onChange={setChosenAgentId}
          agents={agent.agents}
          disabled={pending}
        />
        {agent.noneResponsible ? (
          <p className="text-fg-secondary">
            No agent in service is responsible for this item’s work domain, so no state change can be proposed.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={toState}
            onChange={(event) => setToState(event.target.value as WorkDeclaredState | "")}
            className="rounded-md border border-border bg-surface p-1.5 text-xs text-fg-primary"
            aria-label="New declared state"
          >
            <option value="">Choose a state</option>
            {choices.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            disabled={pending || toState === "" || !agent.ready}
            onClick={() =>
              start(async () => {
                if (toState === "" || !agent.ready) return;
                setProposerName(agent.agentName ?? "The chosen agent");
                setResult(await proposeWorkStateChangeAction({ workItemId, toState, ...agent.selection }));
              })
            }
          >
            {pending ? "Asking Heby…" : "Ask Heby to propose"}
          </Button>
        </div>
        {result === null ? null : result.status === "proposed" ? (
          <p className="text-fg-secondary">
            {proposerName} proposed declaring this item {result.toState} (from {result.fromState}). It is waiting
            for review in /approvals; nothing has been approved, executed or changed. Stated reason: {result.reason}
          </p>
        ) : (
          <p className="text-fg-secondary">
            No proposal was filed ({result.detail ? `${result.reason}: ${result.detail}` : result.reason}).
            Nothing was changed.
          </p>
        )}
      </div>
    </details>
  );
}

