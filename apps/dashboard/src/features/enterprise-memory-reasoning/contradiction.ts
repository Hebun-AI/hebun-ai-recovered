/**
 * Enterprise Memory Reasoning — contradiction contracts.
 *
 * A contradiction records a tension between pieces of evidence. It is a contract
 * shape only — Phase 1 declares what a contradiction IS; it detects and resolves
 * none. Surfacing and resolving contradictions are later, separate concerns.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningId, ReasoningStatement } from "@/features/enterprise-memory-reasoning/contracts";

export type ReasoningContradictionId = ReasoningId;

/** A tension identified among two or more pieces of evidence. */
export interface ReasoningContradiction {
  readonly contradictionId: ReasoningContradictionId;
  readonly statement: ReasoningStatement;
  readonly between: readonly EvidenceReference[];
}
