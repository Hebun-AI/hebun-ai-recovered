import { BriefcaseBusiness } from "lucide-react";

import { CardHeading, HIDE_REGION_HEADING } from "@/components/command-overview/command-surface";
import {
  CommandRegion,
  OperatingStatement,
  QuietLink,
} from "@/components/command-overview/region";
import { cn } from "@/lib/utils";
import { type WorkInMotionState } from "@/features/command-overview/workspace-model";

/**
 * WORK IN MOTION — what this organization is carrying, as its own authority recorded it.
 *
 * ── IT WAS A SIBLING; IT IS NOW A DECLARED REGION ────────────────────────────
 *
 * CMD-W composed this on the route, below the Overview, because CMD-B1 pinned that composition at
 * exactly three sections. The Director retired that pin in CMD-V2, so this is now a declared region
 * in `COMMAND_REGIONS` like every other. Same id, same question, same seam, same refusals.
 *
 * ── THE WORD THAT TRAVELS WITH EVERY NUMBER HERE ─────────────────────────────
 *
 * DECLARED. WORK-1's register records what humans STATED about their work; Hebun observed nothing
 * and verified nothing. So a state word is never printed as though Hebun measured it — it is
 * attributed, in three words, on the row that carries it.
 *
 *     RECORDED != OBSERVED        DECLARED != VERIFIED        A STATE != AN OUTCOME
 *
 * V2.1 keeps that attribution and drops the paragraphs around it: the released card explained that
 * Hebun does not create work, that retirement is recorded in place rather than deleted, and that a
 * bounded read is a lower bound. The first belongs to Operations, and the other two are now single
 * lines that appear only when they are true.
 */
export function WorkInMotion({
  state,
  className,
}: {
  state: WorkInMotionState;
  className?: string;
}) {
  const count = state.status === "recorded" ? `${state.inServiceShown}${state.truncated ? "+" : ""}` : null;
  return (
    <CommandRegion
      id="work-in-motion"
      title="Work in motion"
      question="What work has this organization recorded, and what state did a human declare it in?"
      provenance="authoritative"
      provenanceDetail="the organizational work register, scoped to this tenant"
      readState={state.status === "unavailable" ? "unavailable" : state.status === "empty" ? "empty" : "available"}
      provenanceNonClaims="progress, execution, completion, or success"
      weight="bare"
      className={cn(className, HIDE_REGION_HEADING)}
    >
      <CardHeading
        icon={BriefcaseBusiness}
        tone="work"
        title={count !== null ? <><span className="tabular-nums">{count}</span> work in motion</> : "Work in motion"}
        subtitle="in service, as your team declared it"
      />
      {state.status === "unavailable" ? (
        <OperatingStatement
          tone="unavailable"
          compact
          title="Your work register is unavailable"
          detail="Hebun could not read it, so it does not know what work this organization is carrying."
        />
      ) : state.status === "empty" ? (
        <OperatingStatement
          tone="empty"
          compact
          title="No work recorded yet"
          detail="Record work in Operations to see it here."
        />
      ) : (
        <ul className="flex min-w-0 flex-col divide-y divide-border">
          {state.items.slice(0, 3).map((item) => (
            <li key={item.workItemId} className="flex min-w-0 items-center justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-meta font-semibold text-fg">{item.title}</p>
                {/*
                  "Declared" is not decoration and never moves to a tooltip. A bare state word here
                  would read as something Hebun measured, which is exactly the claim WORK-1 refuses
                  to let any surface make on its behalf.
                */}
                <p className="truncate text-label text-fg-muted">
                  Declared by a human{item.departmentName ? ` · ${item.departmentName}` : ""}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-primary-subtle px-2.5 py-1 text-label font-semibold capitalize text-primary">{item.declaredState}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-auto flex min-w-0 items-center justify-between gap-3">
        <span className="min-w-0 truncate text-label text-fg-muted">
          {state.status === "recorded" && state.inServiceShown > Math.min(3, state.items.length)
            ? `+${state.inServiceShown - Math.min(3, state.items.length)}${state.truncated ? " or more" : ""} more · progress lives in Operations`
            : "Progress lives in Operations"}
          {state.status === "recorded" && state.retiredShown > 0 ? ` · ${state.retiredShown} retired kept` : ""}
        </span>
        <QuietLink href="/operations">Open Operations</QuietLink>
      </div>
    </CommandRegion>
  );
}
