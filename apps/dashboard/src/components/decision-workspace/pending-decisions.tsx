import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";
import { HebyWhy } from "@/components/command-center/heby-why";
import type { PreparationKindView } from "@/features/decisions/workspace-model";

/*
 * Pending Human Decisions (Phase 14 §15) — the primary surface.
 *
 * If a real persisted pending-decision queue existed, each item would carry only its
 * real supported fields (identity, subject, kind, authority required, status,
 * origin, consequence summary, evidence state, recommendation state, created, deadline,
 * governance requirement). NONE is fabricated here: the legacy projection is a mock,
 * human-approval results are simulation-derived, and the `approvals` table has no live
 * read path here. So this renders a strong, honest empty state and shows the real
 * preparation-kind vocabulary that a future connected item would be classified by
 * (advice is never an approval).
 *
 * APP-1 NARROWED THE CLAIM. This said "No decision-request source is connected to this
 * surface", which stopped being true at R3A: consequential action requests are read from
 * the durable store and render above. THAT class is connected; the class THIS region is
 * about — material prepared for a human review or approval process — still has no source.
 * The sentence now says which is which instead of denying both.
 */

export function PendingDecisions({ kinds }: { kinds: readonly PreparationKindView[] }) {
  return (
    <DecisionRegion
      eyebrow="What requires human authority"
      title="Pending Human Decisions"
      accent
      className="h-full"
      action={<StructuralMarker label="None pending" />}
    >
      <div className="flex flex-col gap-4">
        <DecisionEmptyState
          title="No decisions are waiting for human authority"
          detail="A pending decision is grounded material prepared for a human process — it states its consequences and always awaits the Director. Consequential action requests ARE connected and appear above, under Actions Awaiting Authorization; what has no source here is prepared review and approval material, and none is fabricated. When one is connected, each item appears here with its subject, kind, authority requirement, consequences, and evidence — reviewed before any action."
        />

        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            How an item would be classified
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {kinds.map((kind) => (
              <li
                key={kind.kind}
                className="flex min-w-0 items-start gap-3 rounded-lg border border-border bg-surface-sunken p-3"
              >
                <span className="mt-0.5 rounded-full border border-border bg-surface px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wider text-fg-secondary">
                  {kind.kind}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-5 text-fg-secondary">{kind.statement}</p>
                  <p className="mt-0.5 text-[0.65rem] text-fg-muted">
                    {kind.distinctFromAdvice ? "Visibly distinct from advice." : "Advisory — never an approval."}
                    {kind.requiresConsequences ? " Consequences required before confirmation." : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href="/command"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Where decision pressure is surfaced
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <span className="text-[0.7rem] text-fg-muted">Why is nothing here?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </DecisionRegion>
  );
}
