/**
 * Enterprise Memory Reasoning — relation contracts.
 *
 * A relation records an explicit, typed link between two pieces of evidence. It
 * is a contract shape only — Phase 1 declares what a relation IS; it establishes
 * none. No relating logic, no inference, no algorithm lives here.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningId, ReasoningStatement } from "@/features/enterprise-memory-reasoning/contracts";

/** The recognized relation kinds between two memories. */
export type ReasoningRelationType = "supports" | "contradicts" | "supersedes" | "relates-to";

export type ReasoningRelationId = ReasoningId;

/** A typed, directional relation from one evidence reference to another. */
export interface ReasoningRelation {
  readonly relationId: ReasoningRelationId;
  readonly type: ReasoningRelationType;
  readonly from: EvidenceReference;
  readonly to: EvidenceReference;
  readonly describedBy: ReasoningStatement;
}
