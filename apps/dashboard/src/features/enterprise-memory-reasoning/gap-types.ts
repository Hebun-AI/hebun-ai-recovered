/**
 * Enterprise Memory Reasoning — gap type descriptors (Phase 4).
 *
 * Declares the fixed properties of each gap type: the category of absence it
 * belongs to, its scope, whether it must point at specific facts, and the minimum
 * number of facts it must relate to. This is canonical, immutable declarative data
 * — a lookup table, not an engine. There is no detection, no inference, and no
 * reasoning execution here; a gap is never filled and its content is never invented.
 */

import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import type { ReasoningRelationId } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplicationId } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradictionId } from "@/features/enterprise-memory-reasoning/contradiction";

/** The recognized gap types — the specific kind of missing piece. */
export type GapType =
  | "missing-evidence"
  | "missing-relation"
  | "missing-implication"
  | "unresolved-contradiction"
  | "coverage";

/** The coarse family a gap belongs to. */
export type GapCategory = "grounding" | "structural" | "coverage";

/** How much a gap weakens the surrounding understanding. */
export type GapSeverity = "high" | "moderate" | "low";

/** Whether a gap concerns specific facts or the assembled context as a whole. */
export type GapScope = "local" | "contextual";

/** The fixed, canonical properties of a gap type. */
export interface GapTypeDescriptor {
  readonly type: GapType;
  readonly category: GapCategory;
  readonly severity: GapSeverity;
  readonly scope: GapScope;
  /** Whether the gap must relate to at least one declared fact. */
  readonly requiresReference: boolean;
  /** The minimum number of facts the gap must relate to. */
  readonly minimumRelated: number;
}

/**
 * The canonical descriptor for every gap type. Frozen and immutable:
 *   - missing-evidence:        grounding,  high,     local,      related >= 1
 *   - missing-relation:        structural, moderate, local,      related >= 2
 *   - missing-implication:     structural, moderate, local,      related >= 1
 *   - unresolved-contradiction:structural, high,     local,      related >= 2
 *   - coverage:                coverage,   low,      contextual, related >= 0 (context-wide)
 */
export const GAP_TYPE_DESCRIPTORS: Readonly<Record<GapType, GapTypeDescriptor>> = Object.freeze({
  "missing-evidence": Object.freeze({
    type: "missing-evidence",
    category: "grounding",
    severity: "high",
    scope: "local",
    requiresReference: true,
    minimumRelated: 1,
  }),
  "missing-relation": Object.freeze({
    type: "missing-relation",
    category: "structural",
    severity: "moderate",
    scope: "local",
    requiresReference: true,
    minimumRelated: 2,
  }),
  "missing-implication": Object.freeze({
    type: "missing-implication",
    category: "structural",
    severity: "moderate",
    scope: "local",
    requiresReference: true,
    minimumRelated: 1,
  }),
  "unresolved-contradiction": Object.freeze({
    type: "unresolved-contradiction",
    category: "structural",
    severity: "high",
    scope: "local",
    requiresReference: true,
    minimumRelated: 2,
  }),
  coverage: Object.freeze({
    type: "coverage",
    category: "coverage",
    severity: "low",
    scope: "contextual",
    requiresReference: false,
    minimumRelated: 0,
  }),
});

/** The relation, implication, and contradiction dependencies a gap arises from. */
export interface GapDependencies {
  readonly relations: readonly ReasoningRelationId[];
  readonly implications: readonly ReasoningImplicationId[];
  readonly contradictions: readonly ReasoningContradictionId[];
}

/** A Phase 1 gap paired with its Phase 4 type and declared dependencies. */
export interface ClassifiedGap {
  readonly type: GapType;
  readonly gap: ReasoningGap;
  readonly dependencies: GapDependencies;
}
