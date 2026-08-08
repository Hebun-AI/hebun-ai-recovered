import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CommandRegion, NonAuthoritativeMarker } from "./command-region";
import { HebyWhy } from "./heby-why";

/*
 * Context & Upcoming — the lower-priority regions grouped into ONE compact
 * section instead of three large empty cards (Phase 7 §13). Each row stays
 * honest: what belongs there, why it is unavailable, and a legitimate drill-down
 * where one exists. Semantic ownership is unchanged; no data is fabricated.
 */

interface ContextRow {
  readonly label: string;
  readonly reason: string;
  readonly href?: string;
  readonly hrefLabel?: string;
  readonly heby?: boolean;
}

const ROWS: readonly ContextRow[] = [
  {
    label: "Executive Briefing",
    reason: "Heby-composed synthesis with evidence and confidence. No live composer connected — nothing is generated.",
    heby: true,
  },
  {
    label: "Recent Significant Changes",
    reason: "Derived from differences between system snapshots. No snapshot history retained yet, so no changes to show.",
  },
  {
    label: "Strategic Goals",
    reason: "No real goal read model is populated. Counts and risk are withheld to avoid presenting mock data as real.",
    href: "/director/goals",
    hrefLabel: "Goals surface",
  },
];

export function ContextStrip() {
  return (
    <CommandRegion
      variant="plain"
      eyebrow="Context"
      title="Advisory & Upcoming"
      action={<NonAuthoritativeMarker label="Not yet connected" />}
    >
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
        {ROWS.map((row) => (
          <li key={row.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0">
              <span className="size-1.5 shrink-0 rounded-full bg-fg-muted" aria-hidden="true" />
              <span className="truncate text-sm font-medium text-fg">{row.label}</span>
            </div>
            <p className="min-w-0 flex-1 text-[0.7rem] leading-5 text-fg-muted">{row.reason}</p>
            <div className="flex shrink-0 items-center gap-2">
              {row.href && (
                <Link
                  href={row.href}
                  className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                >
                  {row.hrefLabel}
                  <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              )}
              {row.heby && <HebyWhy label="Ask Heby" variant="icon" />}
            </div>
          </li>
        ))}
      </ul>
    </CommandRegion>
  );
}
