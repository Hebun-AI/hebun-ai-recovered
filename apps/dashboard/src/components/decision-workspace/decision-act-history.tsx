import { Lock, ShieldAlert } from "lucide-react";
import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";

/*
 * Decision Act (Phase 14 §21, §28) and Decision History (§22, §23), grouped.
 *
 * DECISION ACT — a hard safety gate. An active Approve / Reject / Authorize control
 * may exist ONLY when a real, safe, server-authorized decision-mutation path persists
 * a decision record with verified Director identity and enforced governance, proven by
 * tests. No such path is connected on this surface, so NO decision affordance is
 * rendered. The act is honestly reported as not connected — the surface reviews and
 * prepares; it does not decide, approve, reject, authorize, or execute.
 *
 * DECISION HISTORY — if a real immutable decision history existed it would be surfaced,
 * with supersession (a new decision attributably supersedes a prior one, which stays
 * immutable) kept distinct from mutation or deletion. None is connected, so this is an
 * honest empty state. No decision history, audit event, or supersession is fabricated.
 */

export function DecisionActAndHistory() {
  return (
    <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
      <div className="min-w-0">
        <DecisionRegion
          variant="plain"
          eyebrow="Recording a decision"
          title="Decision Act"
          action={<StructuralMarker label="Not connected" />}
        >
          <div className="flex flex-col gap-2 rounded-lg border border-border-strong border-dashed bg-surface-sunken p-4">
            <p className="flex items-center gap-1.5 text-sm font-medium text-fg">
              <Lock className="size-3.5 text-fg-muted" aria-hidden="true" />
              Decision recording is not connected yet
            </p>
            <p className="text-xs leading-5 text-fg-secondary">
              No approve, reject, or authorize action is offered here. A decision may be recorded only through a
              real, server-authorized path that verifies the Director&apos;s identity, checks the governance
              requirement, and writes an accountable, immutable record. Until that path is connected, this
              surface reviews and prepares — it never decides on the Director&apos;s behalf.
            </p>
            <p className="flex items-start gap-1.5 text-[0.7rem] leading-5 text-fg-muted">
              <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              When connected, a consequential decision would require explicit confirmation restating the exact
              decision, its authority basis, its consequences, its scope and target, and that execution is a
              separate step.
            </p>
          </div>
        </DecisionRegion>
      </div>
      <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
        <DecisionRegion
          variant="plain"
          eyebrow="What was decided"
          title="Decision History"
          action={<StructuralMarker label="None recorded" />}
        >
          <DecisionEmptyState
            title="No decisions have been recorded"
            detail="A recorded decision is an immutable, accountable record of a human act. No decision record is connected, so none is shown, and none is fabricated. A later decision would supersede a prior one attributably — the prior record would never be rewritten or deleted."
            compact
          />
        </DecisionRegion>
      </div>
    </div>
  );
}
