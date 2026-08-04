/**
 * Enterprise Memory Reasoning — gap rules (Phase 4).
 *
 * Pure, deterministic lookups over the canonical gap type descriptors. These
 * answer plain questions about a gap type — its category, its scope, its minimum
 * span, whether it must point at specific facts. No detection, no inference; these
 * are table reads, nothing more.
 */

import type {
  GapCategory,
  GapScope,
  GapSeverity,
  GapType,
  GapTypeDescriptor,
} from "@/features/enterprise-memory-reasoning/gap-types";
import { GAP_TYPE_DESCRIPTORS } from "@/features/enterprise-memory-reasoning/gap-types";

export function gapDescriptorOf(type: GapType): GapTypeDescriptor {
  return GAP_TYPE_DESCRIPTORS[type];
}

export function gapCategoryOf(type: GapType): GapCategory {
  return GAP_TYPE_DESCRIPTORS[type].category;
}

export function gapSeverityOf(type: GapType): GapSeverity {
  return GAP_TYPE_DESCRIPTORS[type].severity;
}

export function gapScopeOf(type: GapType): GapScope {
  return GAP_TYPE_DESCRIPTORS[type].scope;
}

export function gapMinimumRelated(type: GapType): number {
  return GAP_TYPE_DESCRIPTORS[type].minimumRelated;
}

/** True when the gap type must relate to at least one declared fact. */
export function gapRequiresReference(type: GapType): boolean {
  return GAP_TYPE_DESCRIPTORS[type].requiresReference;
}

/** True when the gap type concerns the assembled context as a whole. */
export function gapIsContextual(type: GapType): boolean {
  return GAP_TYPE_DESCRIPTORS[type].scope === "contextual";
}
