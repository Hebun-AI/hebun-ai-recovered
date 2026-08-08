import type { ExecutiveOverview } from "@/features/director-dashboard-executive-overview";
import { toPlatformDependencies } from "@/features/platform/workspace-model";
import { HealthChip } from "@/components/command-center/command-region";
import { PlatformRegion, PlatformEmptyState, TechnicalMarker } from "./platform-region";

/*
 * Infrastructure / System Dependencies (Phase 13 §26/§32) — the real technical
 * substrate.
 *
 * REAL, non-authoritative data: the technical Executive Overview sections
 * (platform, runtime, monitoring, diagnostics, evaluation, authentication) framed
 * as DEPENDENCY availability — each with its health and widget source state. This
 * is the technical-substrate meaning Platform owns, distinct from Command's
 * executive scan and Operations' "what is running" framing. No internal topology,
 * service graph, ports, or fake uptime. Unavailable is shown honestly, never as
 * available.
 */

export function PlatformDependencies({ overview }: { overview: ExecutiveOverview }) {
  const dependencies = toPlatformDependencies(overview.sections);

  return (
    <PlatformRegion
      variant="plain"
      eyebrow="What technical substrate is available"
      title="System Dependencies"
      action={<TechnicalMarker label="Live technical view" />}
    >
      {dependencies.length === 0 ? (
        <PlatformEmptyState
          title="No technical dependencies reported"
          detail="The runtime reported no technical dependency sections."
          compact
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {dependencies.map((dependency) => (
            <li key={dependency.sectionId} className="flex items-center gap-3 p-3 sm:gap-4">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg">{dependency.label}</span>
                <span className="block truncate text-[0.7rem] leading-5 text-fg-muted">{dependency.describes}</span>
              </span>
              <span className="hidden w-24 shrink-0 text-[0.7rem] text-fg-muted sm:inline">
                {dependency.sourceStateLabel}
              </span>
              <span className="shrink-0">
                <HealthChip state={dependency.health} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </PlatformRegion>
  );
}
