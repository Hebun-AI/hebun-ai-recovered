/**
 * Enterprise Memory Reasoning — contradiction rules (Phase 4).
 *
 * Pure, deterministic lookups over the canonical contradiction type descriptors.
 * These answer plain questions about a contradiction type — its severity, its
 * scope, its minimum span, whether it requires a relation or an implication. No
 * detection, no inference; these are table reads, nothing more.
 */

import type {
  ContradictionScope,
  ContradictionSeverity,
  ContradictionType,
  ContradictionTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/contradiction-types";
import { CONTRADICTION_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/contradiction-types";

export function contradictionDescriptorOf(type: ContradictionType): ContradictionTypeDescriptor {
  return CONTRADICTION_TYPE_DESCRIPTORS[type];
}

export function contradictionSeverityOf(type: ContradictionType): ContradictionSeverity {
  return CONTRADICTION_TYPE_DESCRIPTORS[type].severity;
}

export function contradictionScopeOf(type: ContradictionType): ContradictionScope {
  return CONTRADICTION_TYPE_DESCRIPTORS[type].scope;
}

export function contradictionMinimumBetween(type: ContradictionType): number {
  return CONTRADICTION_TYPE_DESCRIPTORS[type].minimumBetween;
}

/** True when the contradiction type must cite at least one explicit relation. */
export function contradictionRequiresRelation(type: ContradictionType): boolean {
  return CONTRADICTION_TYPE_DESCRIPTORS[type].requiresRelation;
}

/** True when the contradiction type must cite at least one explicit implication. */
export function contradictionRequiresImplication(type: ContradictionType): boolean {
  return CONTRADICTION_TYPE_DESCRIPTORS[type].requiresImplication;
}

/** True when the contradiction type stands across three or more facts. */
export function contradictionIsCollective(type: ContradictionType): boolean {
  return CONTRADICTION_TYPE_DESCRIPTORS[type].scope === "collective";
}
