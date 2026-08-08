import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { PlatformWorkspaceModel } from "@/features/platform/workspace-model";
import { PlatformRegion, PlatformEmptyState } from "./platform-region";

/*
 * Providers & Models (Phase 13 §25) — capability, not configuration.
 *
 * No configured provider or model record is surfaced (the provider catalog's
 * metrics/health are seeded and excluded; a provider adapter existing in code is
 * not a configured provider). So the region is honestly empty and instead names the
 * REAL platform capability vocabulary the provider matrix recognises and the REAL
 * execution modes the platform runs in — notably no "Live" mode. No model name is
 * presented as configured, and no ranking, benchmark, cost, or token usage is
 * fabricated.
 */

export function ProvidersModels({ model }: { model: PlatformWorkspaceModel }) {
  return (
    <PlatformRegion variant="plain" eyebrow="What capability is available" title="Providers & Models">
      <div className="flex flex-col gap-4">
        <PlatformEmptyState
          title="No providers or models configured"
          detail="A provider supplies capability; a model is one way it does so. No configured provider or model is surfaced, and none is fabricated — a provider adapter in code is not a connected, configured provider."
          compact
        />
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Platform capabilities the matrix recognises</p>
          <ul className="flex flex-wrap gap-1.5">
            {model.capabilities.map((entry) => (
              <li
                key={entry.capability}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {entry.capability}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">Execution modes the platform runs in</p>
          <ul className="flex flex-wrap gap-1.5">
            {model.executionModes.map((entry) => (
              <li
                key={entry.mode}
                className="inline-flex items-center rounded-md border border-border bg-surface px-2 py-1 text-xs text-fg-secondary"
              >
                {entry.mode}
              </li>
            ))}
          </ul>
        </div>
        <Link
          href="/director/provider-matrix"
          className="inline-flex w-fit items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
        >
          Providers & Runtime surface
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </PlatformRegion>
  );
}
