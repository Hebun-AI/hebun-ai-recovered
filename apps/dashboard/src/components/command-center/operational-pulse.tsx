import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type {
  ExecutiveOverview,
  ExecutiveSection,
  ExecutiveSectionId,
} from "@/features/director-dashboard-executive-overview";
import { CommandRegion, HealthChip, RegionEmptyState } from "./command-region";

/*
 * Operational Pulse — "what is currently active?" (Phase 7 §12).
 *
 * REAL counts + states from the Executive Overview sections. Compact rows, no
 * KPI cards, no trend arrows/sparklines/percentages (no history exists). Zero
 * records renders an honest "no active work" line, never a fabricated number.
 * Summary only — Operations / Workforce own investigation.
 */

const PULSE_ROWS: readonly {
  sectionId: ExecutiveSectionId;
  label: string;
  href: string;
}[] = [
  { sectionId: "active-agents", label: "Agents", href: "/workforce" },
  { sectionId: "active-workflows", label: "Workflows", href: "/operations" },
  { sectionId: "runtime-status", label: "Runtime", href: "/operations" },
];

function sectionById(overview: ExecutiveOverview, id: ExecutiveSectionId): ExecutiveSection | undefined {
  return overview.sections.find((section) => section.sectionId === id);
}

export function OperationalPulse({ overview }: { overview: ExecutiveOverview }) {
  const rows = PULSE_ROWS.map((row) => ({ ...row, section: sectionById(overview, row.sectionId) })).filter(
    (row) => row.section,
  );
  const anyRecords = rows.some((row) => (row.section?.recordCount ?? 0) > 0);

  return (
    <CommandRegion variant="plain" eyebrow="Live work" title="Operational Pulse">
      {rows.length === 0 || !anyRecords ? (
        <RegionEmptyState
          compact
          title="No active operations"
          detail="The runtime reports no active agents, workflows, or tracked collections."
        />
      ) : (
        <ul className="flex flex-col">
          {rows.map(({ sectionId, label, href, section }) => (
            <li key={sectionId} className="flex items-center justify-between gap-3 border-b border-border/50 py-1.5 last:border-b-0">
              <Link
                href={href}
                className="group inline-flex items-center gap-1 text-sm font-medium text-fg hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                {label}
                <ArrowUpRight className="size-3 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </Link>
              <span className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-fg-secondary">{section?.recordCount ?? 0}</span>
                {section && <HealthChip state={section.health} />}
              </span>
            </li>
          ))}
        </ul>
      )}
    </CommandRegion>
  );
}
