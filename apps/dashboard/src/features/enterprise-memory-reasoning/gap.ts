/**
 * Enterprise Memory Reasoning — gap contracts.
 *
 * A gap records where understanding is incomplete — a missing piece the evidence
 * does not cover. It is a contract shape only. Phase 1 declares what a gap IS; it
 * fills none, and it never invents the missing information.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningId, ReasoningStatement } from "@/features/enterprise-memory-reasoning/contracts";

export type ReasoningGapId = ReasoningId;

/** A declared absence — something the available evidence does not establish. */
export interface ReasoningGap {
  readonly gapId: ReasoningGapId;
  readonly statement: ReasoningStatement;
  readonly relatedTo: readonly EvidenceReference[];
}
