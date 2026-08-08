/*
 * heby-actions/execution-gate.ts — CONTROLLED tool invocation (Phase 17).
 *
 * The only place a Heby action ever runs. It re-checks eligibility itself (fail closed — never
 * trusting the caller), and invokes ONLY a READ_ONLY action, delegating to the Phase 16
 * `invokeTool` gate so the existing safe read-only behavior is preserved unchanged. Every other
 * class is withheld with an honest receipt and NO side effect: a mutation returns
 * REQUIRES_HUMAN_REVIEW, a device action RESTRICTED, a substrate-less action UNAVAILABLE. It
 * records no fabricated timestamp and no fabricated actor; the optional `observedTick` is a
 * caller-supplied logical clock or nothing.
 *
 * No mutation substrate is invented here. Phase 17 completes the lifecycle while consequential
 * mutation stays non-runnable — architecture honesty over fake functionality.
 */

import {
  invokeTool,
  NAVIGATE_TOOL_ID,
  INSPECT_SYSTEM_STATE_TOOL_ID,
  type ExecutiveOverviewLike,
  type HebyToolResult,
  type ToolResultState,
} from "@/features/heby-runtime";
import type {
  HebyActionReceipt,
  HebyExecutionEligibility,
  HebyPreparedAction,
} from "./contracts";

export interface ExecutionContext {
  /** The real, non-authoritative Executive Overview, when the server supplied it. */
  readonly overview?: ExecutiveOverviewLike;
  /** Optional caller-supplied logical tick recorded on the receipt. Never a wall clock. */
  readonly observedTick?: number;
}

/** Map a blocked prepared action to an honest execution state. Never a fake success. */
function withheldState(prepared: HebyPreparedAction): ToolResultState {
  switch (prepared.lifecycleState) {
    case "REQUIRES_HUMAN_REVIEW":
      return "REQUIRES_HUMAN_REVIEW";
    case "RESTRICTED":
      return "RESTRICTED";
    case "REQUIRES_GOVERNANCE":
    case "UNAVAILABLE":
      return "UNAVAILABLE";
    default:
      return "FAILED";
  }
}

function withheldReceipt(
  prepared: HebyPreparedAction,
  eligibility: HebyExecutionEligibility,
  observedTick?: number,
): HebyActionReceipt {
  return {
    actionId: prepared.actionId,
    toolId: prepared.toolId,
    executionState: withheldState(prepared),
    sideEffect: prepared.sideEffect,
    sideEffectOccurred: false,
    target: prepared.target,
    toolResult: undefined,
    evidence: prepared.evidence,
    provenance: ["Execution withheld before any tool ran."],
    authorityBasis: prepared.authorityGate.requirement,
    governanceBasis: prepared.governanceGate.status,
    reversibility: prepared.reversibility,
    failureReason: eligibility.blockingReasons.join(" "),
    observedTick,
  };
}

/** Wrap a Phase 16 read-only tool result into an action receipt. */
function receiptFromToolResult(
  prepared: HebyPreparedAction,
  toolResult: HebyToolResult,
  observedTick?: number,
): HebyActionReceipt {
  return {
    actionId: prepared.actionId,
    toolId: prepared.toolId,
    executionState: toolResult.state,
    sideEffect: prepared.sideEffect,
    // READ_ONLY tools never cause a side effect; carry the tool's own honest flag through.
    sideEffectOccurred: toolResult.sideEffectOccurred,
    target: prepared.target,
    toolResult,
    evidence: toolResult.evidence,
    provenance: toolResult.provenance,
    authorityBasis: "advisory-only",
    governanceBasis: "not-required",
    reversibility: "none",
    failureReason: toolResult.state === "SUCCESS" ? undefined : toolResult.summary,
    observedTick,
  };
}

/**
 * Invoke a prepared action under control. Pure and deterministic. Only a READ_ONLY, fully
 * eligible action runs; everything else returns an honest, side-effect-free withheld receipt.
 */
export function executeAction(
  prepared: HebyPreparedAction,
  eligibility: HebyExecutionEligibility,
  context: ExecutionContext = {},
): HebyActionReceipt {
  // Fail closed: never run a non-eligible action, whatever the caller claims.
  if (!eligibility.executionEligible || prepared.sideEffect !== "READ_ONLY") {
    return withheldReceipt(prepared, eligibility, context.observedTick);
  }

  switch (prepared.toolId) {
    case NAVIGATE_TOOL_ID: {
      const query = typeof prepared.arguments.query === "string" ? prepared.arguments.query : "";
      const result = invokeTool({ toolId: NAVIGATE_TOOL_ID, query });
      return receiptFromToolResult(prepared, result, context.observedTick);
    }
    case INSPECT_SYSTEM_STATE_TOOL_ID: {
      const result = invokeTool({ toolId: INSPECT_SYSTEM_STATE_TOOL_ID, overview: context.overview });
      return receiptFromToolResult(prepared, result, context.observedTick);
    }
    default:
      // Eligible but no invocation path — fail closed rather than pretend.
      return {
        actionId: prepared.actionId,
        toolId: prepared.toolId,
        executionState: "FAILED",
        sideEffect: prepared.sideEffect,
        sideEffectOccurred: false,
        target: prepared.target,
        toolResult: undefined,
        evidence: prepared.evidence,
        provenance: ["No invocation path for this tool."],
        authorityBasis: "advisory-only",
        governanceBasis: "not-required",
        reversibility: "none",
        failureReason: "Eligible read-only tool has no invocation path.",
        observedTick: context.observedTick,
      };
  }
}
