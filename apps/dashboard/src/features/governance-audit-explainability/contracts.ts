/*
 * governance-audit-explainability/contracts.ts — read-only presentation contract for the
 * Audit & Explainability surface (Hebun UI Phase 23C).
 *
 * It exposes the structure of the real engine's audit trace and governance explanation, with
 * an honest state (derived from seeded input; no durable authoritative audit persistence). It
 * generates NO synthetic audit event, NO fabricated timestamp, and NO model chain-of-thought.
 * Explainability here means inspectable system provenance (which policy/rule/stage participated),
 * NOT hidden model reasoning.
 *
 * Distinctions kept explicit: explanation ≠ chain-of-thought; audit ≠ runtime event; audit ≠
 * execution receipt; provenance ≠ evidence; evidence ≠ conclusion; security finding ≠ compliance
 * violation; derived evaluation ≠ authoritative audit record.
 */

export interface EvaluationStageView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
}

/** One kind of trace a governance explanation contains (structural, from GovernanceExplanation). */
export interface TraceKindView {
  readonly name: string;
  readonly describes: string;
}

export interface AuditExplainabilityModel {
  readonly state: {
    readonly provenance: "derived-seeded";
    readonly headline: string;
    readonly detail: string;
  };
  /** Audit + explanation pipeline stages (real, structural). */
  readonly auditStages: readonly EvaluationStageView[];
  /** What a runtime audit trace contains — a per-evaluation trace, not a persisted record. */
  readonly auditModel: { readonly note: string; readonly recordFields: readonly string[] };
  /** Durable authoritative audit records — always absent; none is fabricated. */
  readonly durableRecords: { readonly present: false; readonly note: string };
  /** The trace kinds a governance explanation exposes (structural provenance). */
  readonly explanationTraces: readonly TraceKindView[];
  /** Explainability is inspectable provenance, not model chain-of-thought. */
  readonly explainabilityNote: string;
  readonly distinctions: readonly string[];
}
