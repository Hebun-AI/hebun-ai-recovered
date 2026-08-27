import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";

/*
 * Evidence & Provenance (Phase 14 §17) and Recommendation / Advisory Context (§18),
 * grouped.
 *
 * Evidence would come from real Knowledge / Heby grounding and provenance structures;
 * a recommendation is advisory analysis from Intelligence. NEITHER has a live instance
 * connected here, so both render honest empty states. No evidence count, source
 * identity, confidence, attribution, or reference is fabricated; no recommendation
 * text is generated. Missing evidence stays visible, and a recommendation is kept
 * clearly distinct from a decision, an approval, and an authorization.
 */

export function DecisionEvidenceAndAdvisory() {
  return (
    <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
      <div className="min-w-0">
        <DecisionRegion
          variant="plain"
          eyebrow="What supports the decision"
          title="Evidence & Provenance"
          action={<StructuralMarker label="None connected" />}
        >
          {/*
            * APP-2. This said "No decision item is connected, so no evidence is shown" while a
            * connected request durably stored two evidence references the whole time. The claim was
            * false, and the fix was not to reword it: the evidence was already in the row and the
            * read simply discarded it. It is now projected and rendered WITH the request it belongs
            * to, so provenance sits beside the thing being authorized rather than in a panel that
            * cannot see it.
            *
            * NOTHING IS MANUFACTURED HERE. This region holds no evidence store and creates none —
            * it explains what evidence is and points at where the live entries appear.
            */}
          <DecisionEmptyState
            title="Evidence appears on the action being authorized"
            detail="Evidence is grounded information — with its source and provenance — that supports a decision. A connected request carries the evidence its proposal recorded, and it is shown with that request above, each entry keeping its source class, its reference and its lifecycle. Nothing is resolved, enriched or invented, and a request that recorded no evidence says so rather than appearing to have none read. What has no source HERE is a standalone evidence instance independent of a request."
            compact
          />
          <Link
            href="/knowledge"
            className="mt-3 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Where evidence lives
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </DecisionRegion>
      </div>
      <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
        <DecisionRegion
          variant="plain"
          eyebrow="What is advised"
          title="Recommendation & Advisory Context"
          action={<StructuralMarker label="Advisory only" />}
        >
          <DecisionEmptyState
            title="No recommendation is attached to a decision"
            detail="A recommendation is advisory analysis — a proposed course of action. It is never a decision, an approval, or an authorization. No recommendation instance is connected, and none is generated. When present, it would remain clearly marked as advice the Director may accept or reject."
            compact
          />
          <Link
            href="/intelligence"
            className="mt-3 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Where advisory analysis lives
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </DecisionRegion>
      </div>
    </div>
  );
}
