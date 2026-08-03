/**
 * Enterprise Memory Reasoning — implication type descriptors (Phase 3).
 *
 * Declares the fixed properties of each implication type: its direction, whether
 * it must rest on an explicit relation, and the minimum evidence basis it needs.
 * This is canonical, immutable declarative data — a lookup table, not an engine.
 * There is no inference, no derivation, and no reasoning execution here.
 */

import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";

/** The recognized implication types. */
export type ImplicationType = "entailment" | "support" | "elaboration" | "equivalence";

/** Whether an implication flows one way (basis → statement) or is mutual. */
export type ImplicationDirection = "forward" | "bidirectional";

/** The fixed, canonical properties of an implication type. */
export interface ImplicationTypeDescriptor {
  readonly type: ImplicationType;
  readonly direction: ImplicationDirection;
  /** Whether the implication must cite at least one explicit relation. */
  readonly requiresRelation: boolean;
  /** The minimum number of evidence references the implication must rest on. */
  readonly minimumBasis: number;
}

/**
 * The canonical descriptor for every implication type. Frozen and immutable:
 *   - entailment:  forward,        must derive from a relation, basis >= 1
 *   - support:     forward,        no relation required,        basis >= 1
 *   - elaboration: forward,        no relation required,        basis >= 1
 *   - equivalence: bidirectional,  must derive from a relation, basis >= 2
 */
export const IMPLICATION_TYPE_DESCRIPTORS: Readonly<Record<ImplicationType, ImplicationTypeDescriptor>> = Object.freeze({
  entailment: Object.freeze({ type: "entailment", direction: "forward", requiresRelation: true, minimumBasis: 1 }),
  support: Object.freeze({ type: "support", direction: "forward", requiresRelation: false, minimumBasis: 1 }),
  elaboration: Object.freeze({ type: "elaboration", direction: "forward", requiresRelation: false, minimumBasis: 1 }),
  equivalence: Object.freeze({ type: "equivalence", direction: "bidirectional", requiresRelation: true, minimumBasis: 2 }),
});

/** A Phase 1 implication paired with its Phase 3 type classification. */
export interface ClassifiedImplication {
  readonly type: ImplicationType;
  readonly implication: ReasoningImplication;
}
