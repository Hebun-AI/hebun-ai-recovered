/*
 * governance-overview/contracts.ts — read-only presentation contract for the Governance
 * Overview truth surface (Hebun UI Phase 23B).
 *
 * Governance Overview answers: "what governance capabilities and boundaries actually exist
 * right now?" It is READ-ONLY and states honest availability only — no fabricated compliance %,
 * governance/audit health, risk %, explainability score, policy/violation/approval count,
 * incident, trend, or timestamp. Every area names its authority owner and whether it can mutate.
 */

/** Honest availability of one governance area. */
export type GovernanceAreaStatus =
  /** Real, authoritative connected surface (e.g. Security Center, Phase 19). */
  | "authoritative-real"
  /** Real engine, but derived from seeded input — not live organizational truth. */
  | "derived-seeded"
  /** A contract/engine exists, but no live substrate is connected. */
  | "not-connected"
  /** Authority lives in another workspace. */
  | "external-authority"
  /** Deliberately restricted / advisory-only. */
  | "restricted";

export interface GovernanceAreaView {
  readonly area: string;
  readonly question: string;
  readonly status: GovernanceAreaStatus;
  readonly authorityOwner: string;
  readonly backing: string;
  /** Whether this area can mutate anything from here. Always false in Phase 23B. */
  readonly canMutate: false;
  readonly detail: string;
  readonly href?: string;
}

export interface GovernanceOverviewModel {
  readonly availability: readonly GovernanceAreaView[];
  readonly note: string;
}
