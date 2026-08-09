/*
 * governance-compliance-risk/contracts.ts — read-only presentation contract for the
 * Compliance & Risk surface (Hebun UI Phase 23C).
 *
 * Compliance & Risk exposes only what the real policy engine can prove structurally: the
 * compliance and risk EVALUATION stages, the frameworks evaluated against, and the risk model.
 * Its inputs are seeded, so every state is DERIVED · SEEDED INPUT — never a live compliance
 * certification or a confirmed organizational risk. It renders NO fabricated compliance %,
 * compliance/risk score, violation/incident count, or trend, and NO mutation control.
 *
 * Distinctions kept explicit: compliance evaluation ≠ certification; risk evaluation ≠ incident;
 * risk signal ≠ proven risk; absence of violation ≠ compliant; absence of risk ≠ safe;
 * derived ≠ authoritative; seeded ≠ live organizational state.
 */

/** One real deterministic evaluation stage (structural, from the governance pipeline). */
export interface EvaluationStageView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

/** A compliance framework the engine evaluates against — reference only, no score. */
export interface ComplianceFrameworkView {
  readonly name: string;
  readonly note: string;
}

export interface ComplianceRiskModel {
  readonly state: {
    readonly provenance: "derived-seeded";
    readonly headline: string;
    readonly detail: string;
  };
  /** Constraint + compliance evaluation stages (real, structural). */
  readonly complianceStages: readonly EvaluationStageView[];
  /** Risk evaluation stage (real, structural). */
  readonly riskStages: readonly EvaluationStageView[];
  /** Frameworks evaluated against — reference, scored over seeded data, not a live certification. */
  readonly frameworks: readonly ComplianceFrameworkView[];
  /** The risk model — levels and drivers, structural. */
  readonly riskModel: { readonly levels: readonly string[]; readonly note: string };
  readonly distinctions: readonly string[];
}
