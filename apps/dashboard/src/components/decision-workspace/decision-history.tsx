import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";

/*
 * Decision History (Phase 14 §22, §23).
 *
 * ── WHAT WAS REMOVED FROM THIS FILE, AND WHY (APP-0) ─────────────────────────
 *
 * This component used to render "Decision Act" beside history: a Phase 14 safety gate stating
 * "Decision recording is not connected yet" and "No approve, reject, or authorize action is offered
 * here", above a promise of what a connected act WOULD restate — the exact decision, its authority
 * basis, its consequences, its scope and target, and that execution is a separate step.
 *
 * Every one of those conditions has been met since R3A/R3B, on this same page, three regions above:
 * `ActionAuthorizations` reads consequential requests from the durable store, states the expected
 * effect, the tool, the target, the typed parameters and the consequences BEFORE any control, takes
 * a justification recorded in the Governance ledger, resolves the authority server-side, and treats
 * execution as a separate second click. So the section promised a future that had arrived, and
 * denied a capability rendering a few hundred pixels above it. Two statements, one page, not both
 * true.
 *
 * It is DELETED rather than reworded, because it owned nothing that the connected region does not
 * already say better and with real data. Restating the act here would be a second decision surface
 * describing the first.
 *
 * ── WHY HISTORY SURVIVES, AND WHAT IT MAY HONESTLY CLAIM ─────────────────────
 *
 * History is a different fact and is still genuinely absent. Deciding DOES write an accountable
 * record — the request keeps `status`, `approvalDecisionId`, `approvedAt` and its deciding actor,
 * and every permit carries the Governance decision that issued it — so the old "no decision record
 * is connected" would now be false in the other direction. What does not exist is a HISTORY READ:
 * the queue reader filters to `pending`, and no seam presents decided requests chronologically.
 *
 * The records exist. The account of them does not. That is the sentence this region may make.
 */

export function DecisionHistory() {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-surface p-4">
      <DecisionRegion
        variant="plain"
        eyebrow="What was decided"
        title="Decision History"
        action={<StructuralMarker label="Not surfaced here" />}
      >
        <DecisionEmptyState
          title="Past decisions are not listed on this surface"
          detail="Authorizing, refusing or revoking above writes an accountable record: the request keeps its outcome, its deciding actor and its Governance decision, and each permit carries the authorization that issued it. What is not connected here is a chronological read over those records — this surface shows the queue and the permits it produced, never an account of what was decided before. None is fabricated. A later decision would supersede a prior one attributably; the prior record is never rewritten or deleted."
          compact
        />
      </DecisionRegion>
    </div>
  );
}
