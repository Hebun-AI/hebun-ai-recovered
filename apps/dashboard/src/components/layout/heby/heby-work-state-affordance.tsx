"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { proposeWorkStateChangeAction } from "@/app/(dashboard)/heby/work-state-origination-actions";
import type { OriginateWorkStateResult } from "@/features/agent-origination/originate-work-state.server";
import { WORK_DECLARED_STATES, type WorkDeclaredState } from "@/features/organizational-work/work-contracts";

/*
 * WORK-UPDATE V1 — ASK HEBY TO PROPOSE A DECLARED-STATE CHANGE FOR THIS ITEM.
 *
 * The human chooses the state; this item is the target. The agent is not shown the item or its
 * state — only a fixed sentence naming the state chosen here — and may propose or decline. A
 * proposal waits in /approvals; nothing changes until a person approves AND executes it. Only a work
 * item recorded in a work domain can be the target, because responsibility is checked against it.
 */
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
            disabled={pending || toState === ""}
            onClick={() =>
              start(async () => {
                if (toState === "") return;
                setResult(await proposeWorkStateChangeAction({ workItemId, toState }));
              })
            }
          >
            {pending ? "Asking Heby…" : "Ask Heby to propose"}
          </Button>
        </div>
        {result === null ? null : result.status === "proposed" ? (
          <p className="text-fg-secondary">
            Heby proposed declaring this item {result.toState} (from {result.fromState}). It is waiting
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

