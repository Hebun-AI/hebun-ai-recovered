import type { IntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { AdvisoryMarker } from "./workspace-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Intelligence State / Scope strip (Phase 8 §8) — a single-line analytical scan.
 *
 * Composes ONLY honest, real facts: how many upstream inputs are connected (a real
 * count over the real dependency set — currently zero), whether any candidate or
 * evidence is surfaced (none), and that freshness is unknown because nothing is
 * wired. NO invented aggregate score, confidence average, or pattern count.
 */

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">{label}</span>
    </span>
  );
}

export function IntelligenceStateStrip({ model }: { model: IntelligenceWorkspaceModel }) {
  const connected = model.dependencies.filter((dependency) => dependency.connected).length;
  const total = model.dependencies.length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Scope</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
          Not connected
        </span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <Cell label="Inputs wired" value={`${connected} / ${total}`} />
      <Cell label="Candidates" value="None surfaced" />
      <Cell label="Evidence" value="None" />
      <Cell label="Uncertainty" value="Unresolved" />

      <span className="ml-auto flex items-center gap-2">
        <span className="text-[0.7rem] text-fg-muted">Freshness unknown</span>
        <AdvisoryMarker label="Advisory" />
        <HebyWhy label="Why?" variant="icon" />
      </span>
    </div>
  );
}
