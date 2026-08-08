import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import { CommandRegion, HealthCell } from "./command-region";
import { HebyWhy } from "./heby-why";

/*
 * System / Operational Status — a fast executive scan, not a table-like card
 * (Phase 7 §11). REAL: the eight Executive Overview sections (authoritative:false)
 * rendered as a compact status matrix. SYSTEM / OPERATIONAL health only — never
 * business health, no fake aggregate score, `unknown` never shown as healthy.
 */

export function SystemOperationalStatus({ overview }: { overview: ExecutiveOverview }) {
  return (
    <CommandRegion
      variant="plain"
      eyebrow="System"
      title="Operational Status"
      action={
        <div className="flex items-center gap-3">
          <span className="hidden text-[0.7rem] text-fg-muted sm:inline">
            {overview.criticalAlertCount} critical · {overview.warningCount} warning · {overview.unavailableCount} unavailable
          </span>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Detail
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <HebyWhy label="Explain" variant="icon" />
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-4">
        {overview.sections.map((section) => (
          <HealthCell key={section.sectionId} label={section.label} state={section.health} />
        ))}
      </div>
    </CommandRegion>
  );
}
