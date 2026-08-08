import { StructuralMarker } from "./decision-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Decision State strip (Phase 14 §14) — a compact, honest scan.
 *
 * There is NO real persisted pending queue, decided count, deadline, or freshness to
 * report, so none is invented. The strip states the one true fact — no decision
 * request source is connected to this surface — and the two admissible facts from the
 * real Heby contract: the only state the system may produce is "pending at the
 * Director", and a decision can arrive only from a human act. No approval rate, no
 * average decision time, no pending count, no urgency or impact score.
 */

export function DecisionStateStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Decision queue</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
          <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
          No source connected
        </span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <span className="text-xs text-fg-secondary">
        Admissible state: <span className="font-medium text-fg">pending at the Director</span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <span className="text-xs text-fg-muted">A decision is recorded only by a human act.</span>

      <span className="ml-auto flex items-center gap-2">
        <StructuralMarker label="Structural view" />
        <HebyWhy label="Why is nothing pending?" variant="icon" />
      </span>
    </div>
  );
}
