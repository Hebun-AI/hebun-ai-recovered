import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { OperationsRegion, OperationsEmptyState } from "./operations-region";

/*
 * Operational detail (Phase 10 §9–14) — Active Executions, Waiting / Human Gates,
 * Failures, and Recent Events.
 *
 * No individual execution, gate, failure, or event record is surfaced through a
 * real read model, so each region is honestly empty, explains what it would show
 * and why it is empty, and drills through to the existing detail route rather than
 * embedding it. NOTHING is fabricated: no execution rows, no waiting states, no
 * failure severities, no event timeline, no timestamps.
 *
 * Human gates are observed, never acted on: "waiting for Director approval" routes
 * to the dedicated decision surface. Operations carries no inline Approve/Reject.
 */

interface DetailRegion {
  readonly eyebrow: string;
  readonly title: string;
  readonly emptyTitle: string;
  readonly emptyDetail: string;
  readonly tone?: "calm" | "blocked";
  readonly href: string;
  readonly hrefLabel: string;
}

const REGIONS: readonly DetailRegion[] = [
  {
    eyebrow: "Running now",
    title: "Active Executions",
    emptyTitle: "No active executions surfaced",
    emptyDetail:
      "Individual execution records are not surfaced through a real read model yet. None is fabricated. The live execution monitor holds the detail.",
    href: "/director/execution-center",
    hrefLabel: "Execution monitor",
  },
  {
    eyebrow: "Waiting on a human",
    title: "Waiting & Human Gates",
    emptyTitle: "No waiting work surfaced",
    emptyDetail:
      "Work paused for approval, input, or a dependency would appear here. None is surfaced. Operations observes gates; the human authority act lives on the decision surface — there is no inline approve here.",
    tone: "blocked",
    href: "/approvals",
    hrefLabel: "Approvals & Decisions",
  },
  {
    eyebrow: "What failed",
    title: "Failures & Exceptions",
    emptyTitle: "No failures surfaced",
    emptyDetail:
      "Failed operations, their failure kind, and retryability would appear here. None is surfaced, and no severity or business impact is inferred.",
    href: "/director/execution-center/failures",
    hrefLabel: "Failed runs",
  },
  {
    eyebrow: "What happened",
    title: "Recent Events",
    emptyTitle: "No operational events surfaced",
    emptyDetail:
      "A curated operational timeline (started · paused · approval requested · failed · completed) would appear here from real event records. None is surfaced, and the internal event stream is not dumped raw.",
    href: "/events",
    hrefLabel: "Event stream",
  },
];

export function OperationsDetail() {
  return (
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {REGIONS.map((region) => (
        <OperationsRegion
          key={region.title}
          variant="plain"
          eyebrow={region.eyebrow}
          title={region.title}
          action={
            <Link
              href={region.href}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
            >
              {region.hrefLabel}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Link>
          }
        >
          <OperationsEmptyState
            title={region.emptyTitle}
            detail={region.emptyDetail}
            tone={region.tone}
            compact
          />
        </OperationsRegion>
      ))}
    </div>
  );
}
