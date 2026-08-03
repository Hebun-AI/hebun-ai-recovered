/**
 * Enterprise Memory Reasoning — understanding contracts.
 *
 * Understanding is the aggregate shape of a completed reasoning result: the goal
 * it answered, the evidence it rested on, the relations, implications,
 * contradictions, gaps, and the confidence declared. Phase 1 defines this shape
 * ONLY — it assembles none (that is a later phase). No understanding is produced,
 * inferred, or decided here; this is the immutable contract the later phases fill.
 */

import type { ReasoningTimestamp } from "@/features/enterprise-memory-reasoning/contracts";
import type { EvidenceSet } from "@/features/enterprise-memory-reasoning/evidence";
import type { ReasoningGoal } from "@/features/enterprise-memory-reasoning/goal";
import type { ReasoningRelation } from "@/features/enterprise-memory-reasoning/relation";
import type { ReasoningImplication } from "@/features/enterprise-memory-reasoning/implication";
import type { ReasoningContradiction } from "@/features/enterprise-memory-reasoning/contradiction";
import type { ReasoningGap } from "@/features/enterprise-memory-reasoning/gap";
import type { ReasoningConfidence } from "@/features/enterprise-memory-reasoning/confidence";

/**
 * The complete, immutable shape of a reasoning understanding. Every field is
 * readonly. Nothing here is decision, plan, action, or command — it is explained,
 * traceable understanding, and nothing more.
 */
export interface ReasoningUnderstanding {
  readonly goal: ReasoningGoal;
  readonly evidence: EvidenceSet;
  readonly relations: readonly ReasoningRelation[];
  readonly implications: readonly ReasoningImplication[];
  readonly contradictions: readonly ReasoningContradiction[];
  readonly gaps: readonly ReasoningGap[];
  readonly confidence: ReasoningConfidence;
  readonly producedAt: ReasoningTimestamp;
}
