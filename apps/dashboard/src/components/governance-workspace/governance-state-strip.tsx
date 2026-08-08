import { ControlMarker } from "./governance-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Governance State / Scope strip (Phase 12 §22) — a compact scan of honest facts.
 *
 * No populated policy, risk, approval, or evidence source is connected, so the
 * strip states that plainly. NO invented compliance %, risk score, policy count,
 * or violation count — those would be synthetic. Governance is advisory here: it
 * describes the control context; it does not compute a governance score.
 */

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">{label}</span>
    </span>
  );
}

export function GovernanceStateStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Scope</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
          Policy source not connected
        </span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <Cell label="Policies" value="None surfaced" />
      <Cell label="Risks" value="Not populated" />
      <Cell label="Approvals" value="Simulated only" />
      <Cell label="Evidence" value="None" />

      <span className="ml-auto flex items-center gap-2">
        <span className="text-[0.7rem] text-fg-muted">Freshness unknown</span>
        <ControlMarker label="Control view" />
        <HebyWhy label="Why?" variant="icon" />
      </span>
    </div>
  );
}
