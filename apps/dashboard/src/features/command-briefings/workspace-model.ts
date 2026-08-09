/*
 * command-briefings/workspace-model.ts — the read model for Command · Briefings
 * (Hebun UI Phase 20B).
 *
 * PROVENANCE CONTRACT (no-fake-data, Phase 20A honesty rules):
 *
 *   Briefings answers: "What should the Director understand right now?" The only real,
 *   Director-safe material is the immutable Director Briefing CONTRACT (Organizational
 *   Intelligence Runtime, Phase 8): a briefing ORGANIZES already-bound intelligence
 *   artifacts into one preserved, attributable, uncertainty-bearing package that
 *   terminates at the Director. A briefing is NOT a decision, NOT a recommendation, NOT a
 *   ranking, NOT a priority, NOT an approval or rejection.
 *
 *   The Runtime is contract-only here: no candidate is generated, so no artifact is bound,
 *   so NO briefing instance exists. The required upstream inputs (Memory Context, Reasoning
 *   Understanding, Organizational Assembly) are not connected. Therefore the briefing list
 *   is ALWAYS empty and the surface renders an honest empty state. This model fabricates no
 *   briefing, summary, change, timestamp, or recommendation, and calls no model.
 */

/** A structural section a real executive briefing would organize. Copy only, no instances. */
export interface BriefingSectionView {
  readonly key: string;
  readonly label: string;
  readonly describes: string;
}

const BRIEFING_SECTIONS: readonly BriefingSectionView[] = [
  { key: "changed", label: "What changed", describes: "Material change since the Director last looked — carried from bound artifacts, never invented." },
  { key: "attention", label: "What needs attention", describes: "Where the organization is asking for a human look." },
  { key: "decisions", label: "Decisions waiting", describes: "Prepared items pending a human decision. The decision act lives on Decisions." },
  { key: "exceptions", label: "Operational exceptions", describes: "Where running work diverged from expectation." },
  { key: "intelligence", label: "Emerging intelligence", describes: "Candidates and assessments still advisory — never promoted to truth here." },
  { key: "governance", label: "Governance concerns", describes: "Applicable constraints and restrictions, exposed — never waived." },
  { key: "evidence", label: "Evidence & provenance", describes: "Each briefing item carries its source, provenance, and declared uncertainty." },
];

/** The briefing contract truth this surface presents while no instance exists. */
export interface BriefingContractView {
  readonly statement: string;
  readonly isNot: readonly string[];
  /** Upstream inputs a briefing requires, each honestly not connected. */
  readonly dependencies: readonly { readonly label: string; readonly connected: false }[];
}

export interface CommandBriefingsModel {
  readonly contract: BriefingContractView;
  readonly sections: readonly BriefingSectionView[];
  /** Live briefings. Always empty — the Runtime is contract-only; no artifact is bound. */
  readonly briefings: readonly never[];
  /** Whether the briefing-producing Runtime is connected. Always false in this phase. */
  readonly runtimeConnected: false;
}

/** Build the Briefings model from the real briefing contract only. Pure; fabricates nothing. */
export function getCommandBriefingsModel(): CommandBriefingsModel {
  return {
    contract: {
      statement:
        "A Director Briefing organizes already-bound intelligence into one preserved, attributable package for the Director. It terminates at the Director; it never decides.",
      isNot: ["a decision", "a recommendation", "a ranking", "a priority", "an approval", "a rejection"],
      dependencies: [
        { label: "Memory Context", connected: false },
        { label: "Reasoning Understanding", connected: false },
        { label: "Organizational Assembly", connected: false },
      ],
    },
    sections: BRIEFING_SECTIONS,
    briefings: [],
    runtimeConnected: false,
  };
}
