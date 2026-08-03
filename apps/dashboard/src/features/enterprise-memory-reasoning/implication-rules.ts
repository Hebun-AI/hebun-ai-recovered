/**
 * Enterprise Memory Reasoning — implication rules (Phase 3).
 *
 * Pure, deterministic lookups over the canonical implication type descriptors.
 * These answer plain questions about an implication type — its direction, its
 * minimum basis, whether it requires a relation. No inference, no derivation;
 * these are table reads, nothing more.
 */

import type { ImplicationType } from "@/features/enterprise-memory-reasoning/implication-types";
import { IMPLICATION_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/implication-types";
import type {
  ImplicationDirection,
  ImplicationTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/implication-types";

export function implicationDescriptorOf(type: ImplicationType): ImplicationTypeDescriptor {
  return IMPLICATION_TYPE_DESCRIPTORS[type];
}

export function implicationDirectionOf(type: ImplicationType): ImplicationDirection {
  return IMPLICATION_TYPE_DESCRIPTORS[type].direction;
}

export function implicationMinimumBasis(type: ImplicationType): number {
  return IMPLICATION_TYPE_DESCRIPTORS[type].minimumBasis;
}

/** True when the implication type must cite at least one explicit relation. */
export function implicationRequiresRelation(type: ImplicationType): boolean {
  return IMPLICATION_TYPE_DESCRIPTORS[type].requiresRelation;
}

/** True when the implication type is mutual (basis and statement co-imply). */
export function implicationIsBidirectional(type: ImplicationType): boolean {
  return IMPLICATION_TYPE_DESCRIPTORS[type].direction === "bidirectional";
}
