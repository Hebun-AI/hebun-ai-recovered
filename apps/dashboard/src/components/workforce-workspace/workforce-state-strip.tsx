import { CapabilityMarker } from "./workforce-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Workforce State strip (Phase 11 §9) — a compact scan of honest structural facts.
 *
 * No workforce identity model is connected, so the strip says exactly that. NO
 * fabricated humans, AI-agent counts, capability coverage, availability, or
 * capacity — and the Operations `active-agents` count is NOT reused as a workforce
 * count, because operational runtime records are not organizational identities.
 */

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">{label}</span>
    </span>
  );
}

export function WorkforceStateStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Scope</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
          Identity model not connected
        </span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <Cell label="Humans" value="None connected" />
      <Cell label="AI agents" value="None connected" />
      <Cell label="Capabilities" value="Not mapped" />
      <Cell label="Assignments" value="None" />

      <span className="ml-auto flex items-center gap-2">
        <span className="text-[0.7rem] text-fg-muted">Freshness unknown</span>
        <CapabilityMarker label="Capability view" />
        <HebyWhy label="Why?" variant="icon" />
      </span>
    </div>
  );
}
