import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import { toOperationalSection } from "@/features/operations/operational-view";
import { HealthChip } from "@/components/command-center/command-region";
import { OperationsRegion, SystemViewMarker } from "./operations-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Operational State (Phase 10 §9) — the primary operational surface.
 *
 * REAL, non-authoritative data: the eight Executive Overview sections re-framed as
 * operational rows — each with its health, the count of records the runtime
 * reported, and the widget source state (ready / no records / unavailable /
 * failed). This is the operational DETAIL the Command Center only summarizes;
 * Command shows a three-row pulse, Operations shows every section with its source
 * state. No count is invented; zero and unavailable are shown honestly.
 */

const SOURCE_TONE: Record<string, string> = {
  Ready: "text-fg-secondary",
  "No records": "text-fg-muted",
  Unavailable: "text-fg-muted",
  Failed: "text-error",
  Loading: "text-fg-muted",
};

export function OperationalSections({ overview }: { overview: ExecutiveOverview }) {
  const sections = overview.sections.map(toOperationalSection);

  return (
    <OperationsRegion
      eyebrow="What is running"
      title="Operational State"
      accent
      action={<SystemViewMarker label="Live system view" />}
    >
      <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
        {sections.map((section) => (
          <li key={section.sectionId} className="flex items-center gap-3 p-3 sm:gap-4">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{section.label}</span>
              <span className="block truncate text-[0.7rem] leading-5 text-fg-muted">{section.describes}</span>
            </span>
            <span className="inline-flex shrink-0 items-baseline gap-1.5">
              <span className="text-sm font-semibold tabular-nums text-fg">{section.recordCount}</span>
              <span className="hidden text-[0.65rem] uppercase tracking-wide text-fg-muted sm:inline">records</span>
            </span>
            <span
              className={`hidden w-24 shrink-0 text-[0.7rem] sm:inline ${SOURCE_TONE[section.sourceStateLabel] ?? "text-fg-muted"}`}
            >
              {section.sourceStateLabel}
            </span>
            <span className="shrink-0">
              <HealthChip state={section.health} />
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">What do these states mean?</span>
        <HebyWhy label="Ask Heby" variant="text" />
      </div>
    </OperationsRegion>
  );
}
