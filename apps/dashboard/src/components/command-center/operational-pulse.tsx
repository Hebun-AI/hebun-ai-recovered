import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type {
  ExecutiveOverview,
  ExecutiveSection,
  ExecutiveSectionId,
} from "@/features/director-dashboard-executive-overview";
import { CommandRegion, HealthChip, RegionEmptyState } from "./command-region";

/*
 * Operational Pulse — the minimum Director-level view of live work.
 *
 * REAL states + counts from the Executive Overview sections (agents, workflows,
 * runtime collections). Summary only — Operations / Workforce own investigation
 * (spec §12). Orchestration plumbing is intentionally not exposed. Zero records
 * renders as an honest "no active work" line, never a fabricated number.
 */

const PULSE_ROWS: readonly {
  sectionId: ExecutiveSectionId;
  label: string;
  href: string;
  unit: string;
}[] = [
  { sectionId: "active-agents", label: "Agents", href: "/workforce", unit: "active" },
  { sectionId: "active-workflows", label: "Workflows", href: "/operations", unit: "active" },
  { sectionId: "runtime-status", label: "Runtime collections", href: "/operations", unit: "tracked" },
];

function sectionById(
  overview: ExecutiveOverview,
  id: ExecutiveSectionId,
): ExecutiveSection | undefined {
  return overview.sections.find((section) => section.sectionId === id);
}

export function OperationalPulse({ overview }: { overview: ExecutiveOverview }) {
  const rows = PULSE_ROWS.map((row) => ({ ...row, section: sectionById(overview, row.sectionId) })).filter(
    (row) => row.section,
  );

  const anyRecords = rows.some((row) => (row.section?.recordCount ?? 0) > 0);

  return (
    <CommandRegion eyebrow="Live work" title="Operational Pulse">
      {rows.length === 0 || !anyRecords ? (
        <RegionEmptyState
          title="No active operations"
          detail="The runtime reports no active agents, workflows, or tracked collections in the current system view."
        />
      ) : (
        <ul className="flex flex-col">
          {rows.map(({ sectionId, label, href, unit, section }) => (
            <li key={sectionId} className="flex items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-b-0">
              <Link
                href={href}
                className="group flex min-w-0 items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
              >
                <span className="text-sm font-medium text-fg group-hover:text-primary">{label}</span>
                <ArrowUpRight className="size-3.5 text-fg-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
              </Link>
              <div className="flex items-center gap-3">
                <span className="text-sm tabular-nums text-fg-secondary">
                  {section?.recordCount ?? 0} <span className="text-fg-muted">{unit}</span>
                </span>
                {section && <HealthChip state={section.health} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </CommandRegion>
  );
}
