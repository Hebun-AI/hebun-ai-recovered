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
          <DecisionEmptyState
            title="No evidence is attached to a decision"
            detail="Evidence is grounded information — with its source and provenance — that supports a decision. No decision item is connected, so no evidence is shown, and none is invented. When present, each item would carry its source identity and attribution; absent evidence would remain visible, never silently filled."
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
