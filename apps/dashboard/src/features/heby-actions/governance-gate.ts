/*
 * heby-actions/governance-gate.ts — the action governance boundary (Phase 17).
 *
 * Every non-trivial (state-changing) action must pass a governance boundary before it could be
 * eligible. Discovery established the honest truth: Heby Core Phase 7 is a REAL deterministic
 * governance gate, but it gates PRESENTATIONS (tenant/organization isolation, evidence
 * eligibility, protected-classification, secret exposure) — not tool ACTIONS. There is NO live
 * action-governance / policy evaluator connected in this repository.
 *
 * So this gate NEVER fabricates "POLICY PASSED", "APPROVED", or "COMPLIANT". A READ_ONLY or
 * PREPARATION_ONLY action needs no governance (`not-required`). Any mutation or device action
 * requires governance that is NOT connected (`not-connected`) — which blocks eligibility. That is
 * the truthful state: a contract exists; no evaluator backs it. When a real evaluator is ever
 * connected, it must be integrated ONLY through its sanctioned contract, and only then may this
 * gate report `satisfied`.
 */

import type {
  HebyActionTool,
  HebyGovernanceGateResult,
  HebyRequirementStatus,
  ToolSideEffectClass,
} from "./contracts";

/** Whether a side-effect class requires a governance check at all. */
function governanceRequired(sideEffect: ToolSideEffectClass, toolGated: boolean): boolean {
  if (sideEffect === "READ_ONLY" || sideEffect === "PREPARATION_ONLY") return false;
  return toolGated || sideEffect === "REVERSIBLE_MUTATION" || sideEffect === "CONSEQUENTIAL_MUTATION" || sideEffect === "DEVICE_ACTION";
}

/**
 * Whether a live action-governance / policy evaluator is connected. ALWAYS false in Phase 17 —
 * this is the single seam a future, separately-authorized governance runtime would replace. It is
 * a constant, not fabricated telemetry.
 */
export function isGovernanceEvaluatorConnected(): boolean {
  return false;
}

export function evaluateGovernance(tool: HebyActionTool | undefined): HebyGovernanceGateResult {
  if (!tool) {
    return {
      status: "unmet",
      required: true,
      evaluatorConnected: false,
      reasons: ["No tool to evaluate governance for."],
    };
  }

  const required = governanceRequired(tool.sideEffect, tool.governanceGated);
  const evaluatorConnected = isGovernanceEvaluatorConnected();

  if (!required) {
    return {
      status: "not-required",
      required: false,
      evaluatorConnected,
      reasons: ["This side-effect class requires no governance check."],
    };
  }

  // Required, but no live evaluator — honest, and it blocks. Never a faked pass.
  const status: HebyRequirementStatus = evaluatorConnected ? "satisfied" : "not-connected";
  return {
    status,
    required: true,
    evaluatorConnected,
    reasons: evaluatorConnected
      ? ["Governance evaluator returned a decision."]
      : ["No live governance/policy evaluator is connected; this action cannot be governed here."],
  };
}
