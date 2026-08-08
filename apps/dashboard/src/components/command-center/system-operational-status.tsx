import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import { CommandRegion, HealthChip } from "./command-region";
import { HebyWhy } from "./heby-why";

/*
 * System / Operational Status — the one genuinely data-backed health surface.
 *
 * REAL: folds the eight Executive Overview sections (platform, runtime, agents,
 * workflows, monitoring, diagnostics, evaluation, auth) — all authoritative:false.
 * This is SYSTEM / OPERATIONAL health, never business "organization health"
 * (spec §5/§13). `empty` upstream maps to `unknown`, so absence never reads as
 * healthy.
 */

export function SystemOperationalStatus({ overview }: { overview: ExecutiveOverview }) {
  return (
    <CommandRegion
      eyebrow="System"
      title="System / Operational Status"
      action={
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-fg-muted sm:inline">
            {overview.criticalAlertCount} critical · {overview.warningCount} warning · {overview.unavailableCount} unavailable
          </span>
          <HealthChip state={overview.organizationHealth} />
        </div>
      }
    >
      <ul className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
        {overview.sections.map((section) => (
          <li
            key={section.sectionId}
            className="flex items-center justify-between gap-3 border-b border-border/60 py-2 last:border-b-0"
          >
            <span className="min-w-0 truncate text-sm text-fg">{section.label}</span>
            <HealthChip state={section.health} />
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-colors duration-(--dur-fast) hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
        >
          View system detail
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
        <HebyWhy label="Explain" />
      </div>
    </CommandRegion>
  );
}
