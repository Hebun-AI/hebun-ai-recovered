import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { WorkforceRegion, WorkforceEmptyState } from "./workforce-region";

/*
 * Assignments & Availability (Phase 11 §14/§15) — the bridge to Operations.
 *
 * Workforce owns WHO is assigned; Operations owns WHAT is happening during
 * execution. No real assignment record exists, so this region is honestly empty and
 * drills through to Operations rather than duplicating the execution timeline.
 * Capacity/availability is not fabricated: operational health is not workforce
 * capacity, so no utilization %, busy/idle, or task count is shown.
 */

export function WorkforceAssignments() {
  return (
    <WorkforceRegion
      variant="plain"
      eyebrow="Who is assigned to what"
      title="Assignments & Availability"
      action={
        <Link
          href="/operations"
          className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
        >
          Operations
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      }
    >
      <div className="flex flex-col gap-2">
        <WorkforceEmptyState
          title="No assignments surfaced"
          detail="An assignment delegates specific work to a worker. None is surfaced, and none is fabricated. What is happening during execution lives in Operations; Workforce owns who is assigned, not the running detail."
          compact
        />
        <p className="text-[0.7rem] leading-5 text-fg-muted">
          Availability and capacity are not shown: operational health is not workforce capacity, and no
          honest utilization measure is available.
        </p>
      </div>
    </WorkforceRegion>
  );
}
