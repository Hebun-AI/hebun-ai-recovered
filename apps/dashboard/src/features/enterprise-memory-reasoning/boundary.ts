/**
 * Enterprise Memory Reasoning — boundary contracts.
 *
 * These types describe the boundary a reasoning request crosses as it enters the
 * reasoning foundation. Input arrives ONLY as an already-assembled memory context
 * (the published Context Assembly output) plus a goal. Reasoning never queries,
 * retrieves, selects, or assembles memory itself, and it never reaches storage.
 * Phase 1 defines the boundary shape ONLY — it processes nothing.
 */

import type { AssembledContext } from "@/features/enterprise-memory-context";
import type { ReasoningId, ReasoningTimestamp } from "@/features/enterprise-memory-reasoning/contracts";
import type { ReasoningGoal } from "@/features/enterprise-memory-reasoning/goal";

export type ReasoningRequestId = ReasoningId;

/**
 * A reasoning request: a goal paired with the assembled memory context it should
 * be understood against. The context is the sole source of truth — reasoning adds
 * no facts to it and mutates nothing.
 */
export interface ReasoningRequest {
  readonly requestId: ReasoningRequestId;
  readonly goal: ReasoningGoal;
  readonly context: AssembledContext;
  readonly submittedAt: ReasoningTimestamp;
}

/**
 * Marker contract documenting the non-responsibility rule at the type level:
 * reasoning understands; it never decides, plans, executes, or acts. Recorded so
 * the boundary is explicit; it grants and triggers nothing.
 */
export interface ReasoningNonResponsibility {
  readonly understandingOnly: true;
  readonly makesNoDecision: true;
  readonly takesNoAction: true;
}
