import Link from "next/link";
import { ArrowRight, Briefcase } from "lucide-react";

import {
  CommandRegion,
  OperatingStatement,
  ordinaryDate,
} from "@/components/command-overview/command-overview";
import { TONES } from "@/components/ui/state-block";
import { type WorkInMotionState } from "@/features/command-overview/workspace-model";

/**
 * WORK IN MOTION — what this organization is carrying, as its own authority recorded it.
 *
 * ── WHY THIS IS A SIBLING AND NOT A FOURTH REGION ────────────────────────────
 *
 * CMD-B1 pins the Command Overview at exactly three sections with exactly three provenance chips,
 * and four released suites assert that count. That pin is not an accident and it is not stale: the
 * Overview's grammar answers three DIFFERENT semantic roles — an operating STATE, an ACTION, and a
 * COVERAGE LIMIT — and CMD-V5 proved that restyling one skeleton cannot express more than it was
 * built for.
 *
 * The repository already settled how a new concern joins Command: LMX-1 wanted an awareness band,
 * found the same pin, and composed itself as a SIBLING on the route rather than as a fourth region
 * inside a composition whose grammar was settled over five phases. This follows that precedent
 * exactly. `CommandOverview` renders unchanged, its three sections and three chips intact, and not
 * one of its assertions was edited to make room for this.
 *
 *     A NEW QUESTION EARNS A NEW REGION. IT DOES NOT EARN A REWRITE OF A SETTLED ONE.
 *
 * It borrows the region scaffold, the state block and the date formatter so it cannot drift into a
 * second visual grammar — the same three primitives the Overview uses, imported rather than copied.
 *
 * ── THE WORD THAT TRAVELS WITH EVERY NUMBER HERE ─────────────────────────────
 *
 * DECLARED. WORK-1's register records what humans STATED about their work; Hebun observed nothing,
 * verified nothing, and holds no record of any outcome. So this region never says "in progress" on
 * its own account — it says a human declared that state and that Hebun has not verified it.
 *
 *     RECORDED != OBSERVED        DECLARED != VERIFIED        A STATE != AN OUTCOME
 *
 * The eyebrow counts what was READ, never what the organization holds: the seam is capped, so when
 * it comes back full every figure here is a lower bound and says so.
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
      title="Work in motion"
      question="What work has this organization recorded, and what state did a human declare it in?"
      provenance="authoritative"
      provenanceDetail="the organizational work register, scoped to this tenant"
      className={className}
      actions={
        <span className="text-meta font-medium uppercase tracking-[0.08em] text-fg-muted">
          {state.status === "recorded"
            ? `${state.inServiceShown}${state.truncated ? "+" : ""} in service`
            : TONES[state.status === "unavailable" ? "unavailable" : "empty"].eyebrow}
        </span>
      }
    >
      {state.status === "unavailable" ? (
        <OperatingStatement
          tone="unavailable"
          compact
          title="Hebun could not read your work register"
          detail="The durable read did not answer. This is not an empty register — Hebun does not currently know what work this organization has recorded."
        />
      ) : state.status === "empty" ? (
        <OperatingStatement
          tone="empty"
          compact
          title="No work has been recorded yet"
          detail="The work register answered, and this organization has recorded none. Work is recorded by a human through Operations; Hebun does not create it."
        />
      ) : (
        <div className="flex min-w-0 flex-col gap-3">
          <ul className="flex min-w-0 flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {state.items.map((item) => (
              <li key={item.workItemId} className="flex min-w-0 flex-col gap-1 p-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="min-w-0 text-body font-semibold text-fg">{item.title}</span>
                  {item.departmentName ? (
                    <span className="text-meta text-fg-secondary">{item.departmentName}</span>
                  ) : null}
                  <span className="text-meta text-fg-muted">{ordinaryDate(item.recordedAt)}</span>
                </div>
                {/*
                  "Declared" is not decoration and never moves to a tooltip. A bare state word here
                  would read as something Hebun measured, which is exactly the claim WORK-1 refuses
                  to let any surface make on its behalf.
                */}
                <p className="text-meta leading-5 text-fg-secondary">
                  Declared <span className="font-medium text-fg">{item.declaredState}</span> by a
                  human. Hebun has not verified it.
                </p>
              </li>
            ))}
          </ul>
          {state.inServiceShown > state.items.length ? (
            <p className="text-meta text-fg-muted">
              {state.items.length} of {state.inServiceShown}
              {state.truncated ? " or more" : ""} in service shown. Operations holds the register.
            </p>
          ) : null}
          {state.retiredShown > 0 ? (
            <p className="text-meta text-fg-muted">
              {state.retiredShown} retired {state.retiredShown === 1 ? "item is" : "items are"} kept
              in the register and not listed here. Retirement is recorded in place, never deleted.
            </p>
          ) : null}
          {state.truncated ? (
            <p className="text-meta text-fg-muted">
              This read is bounded and came back full, so every count here is a lower bound — this
              organization holds more work than is shown.
            </p>
          ) : null}
        </div>
      )}

      <Link
        href="/operations"
        className="group inline-flex min-w-0 items-center gap-1.5 self-start rounded-md text-meta font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
      >
        <Briefcase className="size-3.5 shrink-0" aria-hidden="true" />
        Open Operations
        <ArrowRight
          className="size-3.5 shrink-0 transition-transform duration-(--dur-fast) group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </Link>
    </CommandRegion>
  );
}
