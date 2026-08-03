/**
 * Enterprise Memory Reasoning — relation type descriptors (Phase 2).
 *
 * Declares the fixed properties of each relation type: its direction and its
 * cardinality. This is canonical, immutable declarative data — a lookup table, not
 * an engine. There is no traversal, no graph execution, no inference, and no
 * algorithm here; later reasoning is out of scope for this phase.
 */

import type { ReasoningRelationType } from "@/features/enterprise-memory-reasoning/relation";

/** Whether a relation is directional or symmetric between its two endpoints. */
export type RelationDirection = "directed" | "symmetric";

/** How many endpoints may participate on each side of a relation type. */
export type RelationCardinality = "one-to-one" | "one-to-many" | "many-to-many";

/** The fixed, canonical properties of a relation type. */
export interface RelationTypeDescriptor {
  readonly type: ReasoningRelationType;
  readonly direction: RelationDirection;
  readonly cardinality: RelationCardinality;
}

/**
 * The canonical descriptor for every relation type. Frozen and immutable:
 *   - supports:     directed   (A supports B is not B supports A)
 *   - contradicts:  symmetric  (A contradicts B iff B contradicts A)
 *   - supersedes:   directed, one-to-one (a version supersedes exactly one prior)
 *   - relates-to:   symmetric  (an undirected association)
 */
export const RELATION_TYPE_DESCRIPTORS: Readonly<Record<ReasoningRelationType, RelationTypeDescriptor>> = Object.freeze({
  supports: Object.freeze({ type: "supports", direction: "directed", cardinality: "many-to-many" }),
  contradicts: Object.freeze({ type: "contradicts", direction: "symmetric", cardinality: "many-to-many" }),
  supersedes: Object.freeze({ type: "supersedes", direction: "directed", cardinality: "one-to-one" }),
  "relates-to": Object.freeze({ type: "relates-to", direction: "symmetric", cardinality: "many-to-many" }),
});
