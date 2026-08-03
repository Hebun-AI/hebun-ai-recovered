/**
 * Enterprise Memory Reasoning — goal contracts.
 *
 * A goal states what the reasoning is asked to understand. It is a question or
 * objective, not an instruction to act. A goal never authorizes a decision, a
 * plan, or an action — it only scopes what understanding is sought. Contracts only.
 */

import type { MemoryNamespace } from "@/features/enterprise-memory";
import type { ReasoningId, ReasoningStatement, ReasoningTimestamp } from "@/features/enterprise-memory-reasoning/contracts";

export type ReasoningGoalId = ReasoningId;

/** What the reasoning is asked to understand, and within which scope. */
export interface ReasoningGoal {
  readonly goalId: ReasoningGoalId;
  readonly namespace: MemoryNamespace;
  readonly question: ReasoningStatement;
  readonly requestedAt: ReasoningTimestamp;
}
