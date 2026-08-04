/**
 * Enterprise Memory Reasoning — contradiction type descriptors (Phase 4).
 *
 * Declares the fixed properties of each contradiction type: its severity, its
 * scope, whether it must rest on an explicit relation or implication, and the
 * minimum number of facts it must stand between. This is canonical, immutable
 * declarative data — a lookup table, not an engine. There is no detection, no
 * inference, and no reasoning execution here.
 */

import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningRelationId } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplicationId } from "@/features/enterprise-memory-reasoning/implication";

/** The recognized contradiction types. */
export type ContradictionType = "direct" | "temporal" | "partial" | "derived";

/** How much a contradiction weighs against the surrounding understanding. */
export type ContradictionSeverity = "blocking" | "material" | "minor";

/** Whether a contradiction stands between exactly two facts or across many. */
export type ContradictionScope = "pairwise" | "collective";

/** The fixed, canonical properties of a contradiction type. */
export interface ContradictionTypeDescriptor {
  readonly type: ContradictionType;
  readonly severity: ContradictionSeverity;
  readonly scope: ContradictionScope;
  /** Whether the contradiction must cite at least one explicit relation. */
  readonly requiresRelation: boolean;
  /** Whether the contradiction must cite at least one explicit implication. */
  readonly requiresImplication: boolean;
  /** The minimum number of evidence references the contradiction stands between. */
  readonly minimumBetween: number;
}

/**
 * The canonical descriptor for every contradiction type. Frozen and immutable:
 *   - direct:   blocking, pairwise,   no relation,  no implication, between >= 2
 *   - temporal: material, pairwise,   needs relation, no implication, between >= 2
 *   - partial:  minor,    pairwise,   no relation,  no implication, between >= 2
 *   - derived:  material, collective, no relation,  needs implication, between >= 3
 */
export const CONTRADICTION_TYPE_DESCRIPTORS: Readonly<Record<ContradictionType, ContradictionTypeDescriptor>> =
  Object.freeze({
    direct: Object.freeze({
      type: "direct",
      severity: "blocking",
      scope: "pairwise",
      requiresRelation: false,
      requiresImplication: false,
      minimumBetween: 2,
    }),
    temporal: Object.freeze({
      type: "temporal",
      severity: "material",
      scope: "pairwise",
      requiresRelation: true,
      requiresImplication: false,
      minimumBetween: 2,
    }),
    partial: Object.freeze({
      type: "partial",
      severity: "minor",
      scope: "pairwise",
      requiresRelation: false,
      requiresImplication: false,
      minimumBetween: 2,
    }),
    derived: Object.freeze({
      type: "derived",
      severity: "material",
      scope: "collective",
      requiresRelation: false,
      requiresImplication: true,
      minimumBetween: 3,
    }),
  });

/** The relation and implication dependencies a classified contradiction rests on. */
export interface ContradictionDependencies {
  readonly relations: readonly ReasoningRelationId[];
  readonly implications: readonly ReasoningImplicationId[];
}

/** A Phase 1 contradiction paired with its Phase 4 type and declared dependencies. */
export interface ClassifiedContradiction {
  readonly type: ContradictionType;
  readonly contradiction: ReasoningContradiction;
  readonly dependencies: ContradictionDependencies;
}
