import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { DecisionRegion, DecisionEmptyState, StructuralMarker } from "./decision-region";

/*
 * Consequences (Phase 14 §19) and Governance / Authority Requirement (§20), grouped.
 *
 * The real Heby Core Phase 6 contract REQUIRES a prepared review/approval item to
 * state its consequences before a human confirmation. That rule is surfaced as
 * structural truth. No consequence instance is connected, so no business impact,
 * revenue, cost, risk reduction, customer impact, or probability is fabricated.
 *
 * Governance owns the authority requirement (approval required, Director required,
 * human review required, blocked, restriction, basis). The structural vocabulary is
 * shown and labelled structural; no requirement is tied to a fabricated decision.
 */

const CONSEQUENCE_RULE = [
  "A review or approval item must state its consequences before a person confirms it.",
  "Advice carries no consequences requirement — because advice is never an approval.",
];

const AUTHORITY_REQUIREMENTS: readonly { label: string; meaning: string }[] = [
  { label: "Human review required", meaning: "A person must review before the item can proceed." },
  { label: "Approval required", meaning: "An explicit human approval is needed." },
  { label: "Director required", meaning: "The authority terminates at the Director — no one else may decide." },
  { label: "Blocked", meaning: "A restriction currently prevents the item from proceeding." },
];

export function DecisionConsequencesAndGovernance() {
  return (
    <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
      <div className="min-w-0">
        <DecisionRegion
          variant="plain"
          eyebrow="What follows"
          title="Consequences"
          action={<StructuralMarker label="Contract rule" />}
        >
          <ul className="flex flex-col gap-2">
            {CONSEQUENCE_RULE.map((rule) => (
              <li
                key={rule}
                className="rounded-lg border border-border bg-surface-sunken p-3 text-[0.7rem] leading-5 text-fg-secondary"
              >
                {rule}
              </li>
            ))}
          </ul>
          {/*
            * APP-2. This said "No decision item is connected, so no stated consequences are shown".
            * A decision item IS connected, and its real consequences render above under Actions
            * Awaiting Authorization — required before confirmation, and never collapsed.
            *
            * It DEFERS rather than duplicating. A second list here would be a second authoritative-
            * looking source for one decision fact, and the two could drift; the consequences a human
            * acts on must be the ones attached to the request being authorized.
            */}
          <DecisionEmptyState
            title="Consequences appear on the action being authorized"
            detail="A connected request states its own consequences, and they are shown with it above, before any confirmation — not here. This region states the contract rule that consequences must be stated before a human confirms; it holds no second copy, because one decision fact must have one source. Nothing is manufactured, and business impact is never fabricated."
            tone="calm"
            compact
          />
        </DecisionRegion>
      </div>
      <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
        <DecisionRegion
          variant="plain"
          eyebrow="What authority applies"
          title="Governance & Authority Requirement"
          action={<StructuralMarker label="Structural view" />}
        >
          <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
            {AUTHORITY_REQUIREMENTS.map((req) => (
              <li key={req.label} className="flex flex-col gap-0.5 p-3">
                <span className="text-xs font-medium text-fg">{req.label}</span>
                <span className="text-[0.7rem] leading-5 text-fg-muted">{req.meaning}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.7rem] leading-5 text-fg-muted">
            These are the structural authority requirements. None is tied to a live decision, because none is
            connected. Governance owns the rules — this surface never edits them.
          </p>
          <Link
            href="/governance"
            className="mt-2 inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
          >
            Open Governance
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
        </DecisionRegion>
      </div>
    </div>
  );
}
