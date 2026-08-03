/**
 * Enterprise Memory Reasoning — relation rules (Phase 2).
 *
 * Pure, deterministic lookups over the canonical relation type descriptors. These
 * answer plain questions about a relation type — its direction, its cardinality,
 * whether it is symmetric. No traversal, no inference, no graph execution; these
 * are table reads, nothing more.
 */

import type { ReasoningRelationType } from "@/features/enterprise-memory-reasoning/relation";
import { RELATION_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/relation-types";
import type {
  RelationCardinality,
  RelationDirection,
  RelationTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/relation-types";

/** Returns the canonical descriptor for a relation type. */
export function descriptorOf(type: ReasoningRelationType): RelationTypeDescriptor {
  return RELATION_TYPE_DESCRIPTORS[type];
}

export function directionOf(type: ReasoningRelationType): RelationDirection {
  return RELATION_TYPE_DESCRIPTORS[type].direction;
}

export function cardinalityOf(type: ReasoningRelationType): RelationCardinality {
  return RELATION_TYPE_DESCRIPTORS[type].cardinality;
}

/** True when the relation type is symmetric (endpoint order carries no meaning). */
export function isSymmetric(type: ReasoningRelationType): boolean {
  return RELATION_TYPE_DESCRIPTORS[type].direction === "symmetric";
}

/** True when the relation type constrains each side to a single endpoint. */
export function isOneToOne(type: ReasoningRelationType): boolean {
  return RELATION_TYPE_DESCRIPTORS[type].cardinality === "one-to-one";
}
