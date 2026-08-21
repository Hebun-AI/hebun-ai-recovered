import { StructuralMarker } from "./decision-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Decision State strip (Phase 14 §14) — a compact, honest scan.
 *
 * ── APP-1: THE CONNECTION CLAIM WAS REMOVED FROM THIS STRIP ──────────────────
 *
 * It used to lead with "Decision queue · No source connected". That was true when written and
 * false from R3A onward: consequential action requests are read from the durable store and render
 * a few hundred pixels below, under "Actions Awaiting Authorization". The strip sat above them
 * denying them.
 *
 * The claim is REMOVED rather than inverted. This component takes no props and performs no read,
 * so it cannot know a connection state — restating one here would be a second, unverifiable
 * source of truth about the queue, and the next phase to connect something would leave it stale
 * exactly as R3A did. The region that performs the read is the region that reports it.
 *
 * What remains is what this strip actually owns: the two admissible facts from the real Heby
 * contract — the only state the system may produce is "pending at the Director", and a decision
 * can arrive only from a human act. No approval rate, no average decision time, no pending count,
 * no urgency or impact score, and now no connection claim.
 */

export function DecisionStateStrip() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="text-xs text-fg-secondary">
        Admissible state: <span className="font-medium text-fg">pending at the Director</span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <span className="text-xs text-fg-muted">A decision is recorded only by a human act.</span>

      <span className="ml-auto flex items-center gap-2">
        <StructuralMarker label="Structural view" />
        <HebyWhy
          label="Why is nothing pending?"
          variant="icon"
          region={{ key: "decision-state-strip", label: "Decision state" }}
          intent="ASSESS_UNCERTAINTY"
        />
      </span>
    </div>
  );
}
