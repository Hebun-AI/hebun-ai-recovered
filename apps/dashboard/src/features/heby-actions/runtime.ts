/*
 * heby-actions/runtime.ts — the Phase 17 action lifecycle orchestrator.
 *
 * Threads one honest path end to end:
 *   request → prepare → eligibility → (only if READ_ONLY and eligible) controlled invocation
 *           → receipt validation → outcome, with an in-memory provenance chain of THIS pass.
 *
 * It never jumps from language to execution: a request is already a typed proposal, preparation
 * never runs anything, and only a fully eligible READ_ONLY action reaches the execution gate. An
 * action is marked EXECUTED only when a validated receipt PROVES the tool ran; otherwise the
 * lifecycle rests at its prepared state (REQUIRES_HUMAN_REVIEW, RESTRICTED, UNAVAILABLE, EXPIRED,
 * FAILED, or PREPARED). Pure and deterministic — safe server-side or in the client panel; it
 * writes no memory, records no decision, and holds no secret.
 */

import type {
  HebyActionOutcome,
  HebyActionRequest,
  HebyPreparedAction,
  HebyRuntimeProvenanceLink,
} from "./contracts";
import { prepareAction, type PrepareActionOptions } from "./action-preparer";
import { deriveEligibility } from "./eligibility";
import { executeAction, type ExecutionContext } from "./execution-gate";
import { validateReceipt } from "./result-validator";

export interface RunActionOptions extends PrepareActionOptions, ExecutionContext {}

function baseChain(prepared: HebyPreparedAction): HebyRuntimeProvenanceLink[] {
  return [
    { stage: "proposed", outcome: `${prepared.actionKind} proposed from ${prepared.requestingWorkspace}` },
    { stage: "prepared", outcome: `prepared as ${prepared.sideEffect}, arguments ${prepared.argumentsValid ? "valid" : "invalid"}` },
    { stage: "capability-checked", outcome: prepared.capabilityGate.status },
    { stage: "governance-checked", outcome: prepared.governanceGate.status },
    { stage: "authority-checked", outcome: prepared.authorityGate.status },
  ];
}

/**
 * Prepare an action and derive its eligibility WITHOUT executing anything. The safe default for a
 * UI preview: it shows what would happen, the requirements, and the eligibility — never a run.
 */
export function proposeAction(
  request: HebyActionRequest,
  options: PrepareActionOptions = {},
): HebyActionOutcome {
  const prepared = prepareAction(request, options);
  const eligibility = deriveEligibility(prepared);
  const provenanceChain: HebyRuntimeProvenanceLink[] = [
    ...baseChain(prepared),
    { stage: "eligibility-derived", outcome: eligibility.executionEligible ? "eligible" : "blocked" },
  ];
  return {
    prepared,
    eligibility,
    receipt: undefined,
    provenanceChain,
    lifecycleState: eligibility.lifecycleState,
  };
}

/**
 * Run the full lifecycle. Executes ONLY a READ_ONLY, eligible action through the controlled gate;
 * everything else returns the prepared outcome with no receipt and no side effect.
 */
export function runAction(
  request: HebyActionRequest,
  options: RunActionOptions = {},
): HebyActionOutcome {
  const prepared = prepareAction(request, options);
  const eligibility = deriveEligibility(prepared);
  const provenanceChain: HebyRuntimeProvenanceLink[] = [
    ...baseChain(prepared),
    { stage: "eligibility-derived", outcome: eligibility.executionEligible ? "eligible" : "blocked" },
  ];

  if (!eligibility.executionEligible) {
    return {
      prepared,
      eligibility,
      receipt: undefined,
      provenanceChain,
      lifecycleState: eligibility.lifecycleState,
    };
  }

  // Controlled invocation — READ_ONLY only, delegating to the Phase 16 gate.
  const rawReceipt = executeAction(prepared, eligibility, options);
  const validation = validateReceipt(rawReceipt, prepared);
  provenanceChain.push({ stage: "invoked", outcome: rawReceipt.executionState });
  provenanceChain.push({ stage: "result-validated", outcome: validation.valid ? "valid" : "withheld" });

  const executed = validation.valid && validation.receipt.executionState === "SUCCESS";

  return {
    prepared,
    eligibility,
    receipt: validation.receipt,
    provenanceChain,
    lifecycleState: executed ? "EXECUTED" : "FAILED",
  };
}
