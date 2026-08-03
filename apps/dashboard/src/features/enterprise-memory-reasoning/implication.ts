/**
 * Enterprise Memory Reasoning — implication contracts.
 *
 * An implication states what follows from evidence and relations. It is a contract
 * shape only — Phase 1 declares what an implication IS; it derives none. No
 * inference, no decision, no planning. Each implication names its basis so it can
 * always be traced back to the memory that supports it.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningRelationId } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningId, ReasoningStatement } from "@/features/enterprise-memory-reasoning/contracts";

export type ReasoningImplicationId = ReasoningId;

/** Something that follows from the named evidence and relations. */
export interface ReasoningImplication {
  readonly implicationId: ReasoningImplicationId;
  readonly statement: ReasoningStatement;
  readonly basis: readonly EvidenceReference[];
  readonly derivedFrom: readonly ReasoningRelationId[];
}
