import {
  CommandRegion,
  OperatingStatement,
  QuietLink,
  ordinaryDate,
} from "@/components/command-overview/region";
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
  return (
    <CommandRegion
      id="work-in-motion"
      title="Active Work"
      question="What work has this organization recorded, and what state did a human declare it in?"
      provenance="authoritative"
      provenanceDetail="the organizational work register, scoped to this tenant"
      weight="card"
      className={className}
      eyebrow={
        state.status === "recorded"
          ? `${state.inServiceShown}${state.truncated ? "+" : ""} in service`
          : undefined
      }
    >
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
        <div className="flex min-w-0 flex-col gap-3">
          <ul className="flex min-w-0 flex-col divide-y divide-border">
            {state.items.map((item) => (
              <li key={item.workItemId} className="flex min-w-0 items-start justify-between gap-3 py-2.5 first:pt-0">
                <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="min-w-0 text-meta font-semibold text-fg">{item.title}</span>
                  {item.departmentName ? (
                    <span className="text-label text-fg-secondary">{item.departmentName}</span>
                  ) : null}
                </div>
                {/*
                  "Declared" is not decoration and never moves to a tooltip. A bare state word here
                  would read as something Hebun measured, which is exactly the claim WORK-1 refuses
                  to let any surface make on its behalf.
                */}
                <p className="mt-0.5 text-label leading-4 text-fg-secondary">
                  Declared <span className="font-medium text-fg">{item.declaredState}</span> by a human
                </p>
                </div>
                <span className="shrink-0 text-label text-fg-muted">{ordinaryDate(item.recordedAt)}</span>
              </li>
            ))}
          </ul>
          {state.inServiceShown > state.items.length ? (
            <p className="text-meta text-fg-muted">
              {state.items.length} of {state.inServiceShown}
              {state.truncated ? " or more" : ""} shown
            </p>
          ) : null}
          {state.retiredShown > 0 ? (
            <p className="text-meta text-fg-muted">
              {state.retiredShown} retired {state.retiredShown === 1 ? "item" : "items"} kept in the
              register
            </p>
          ) : null}
        </div>
      )}

      <QuietLink href="/operations">Open Operations</QuietLink>
    </CommandRegion>
  );
}
