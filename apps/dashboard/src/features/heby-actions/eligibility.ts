/*
 * heby-actions/eligibility.ts — derives EXECUTION ELIGIBILITY, and only that (Phase 17).
 *
 * Eligibility is a single explicit predicate, RECOMPUTED here from the gates directly rather than
 * trusting the prepared action's lifecycle label (defense-in-depth — no upstream conclusion is
 * taken on faith). It is true ONLY when every precondition holds: arguments valid, workspace owns
 * the capability, target valid, substrate connected, evidence sufficient, governance satisfied or
 * not required, authority satisfied with no human review outstanding, not stale, not expired, and
 * the side-effect class is READ_ONLY (the only class invokable in Phase 17).
 *
 * Eligibility authorizes NOTHING. It is the precondition an invocation checks — never the
 * invocation, and never an approval. A prepared action carries a FIXED authority basis, so there
 * is no seam to replay it into a stronger context: eligibility reads only the prepared action.
 */

import type { HebyExecutionEligibility, HebyPreparedAction } from "./contracts";

export function deriveEligibility(prepared: HebyPreparedAction): HebyExecutionEligibility {
  const reasons: string[] = [];
  const cap = prepared.capabilityGate;
  const gov = prepared.governanceGate;
  const auth = prepared.authorityGate;

  if (!prepared.argumentsValid) reasons.push("Arguments failed schema validation.");
  if (!cap.toolExists) reasons.push("Tool does not exist.");
  if (!cap.workspacePermitted) reasons.push("Requesting workspace does not own this capability.");
  if (!cap.targetValid) reasons.push("Target is not valid.");
  if (!cap.available) reasons.push("No execution substrate is connected.");
  if (!cap.evidenceSufficient) reasons.push("Evidence is insufficient for this action class.");
  const govOk = gov.status === "satisfied" || gov.status === "not-required";
  if (!govOk) reasons.push("Governance is not satisfied (no live evaluator connected).");
  if (auth.status !== "satisfied") reasons.push("Authority requirement is not satisfied.");
  if (auth.humanReviewRequired) reasons.push("Human review is required before execution.");
  if (prepared.staleness.expired) reasons.push("Preparation has expired and must be revalidated.");
  if (prepared.staleness.freshness === "stale") reasons.push("Evidence is stale (superseded or retired).");
  if (prepared.sideEffect !== "READ_ONLY") {
    reasons.push(`Side-effect class ${prepared.sideEffect} is not invokable in Phase 17.`);
  }

  const executionEligible = reasons.length === 0;

  return {
    actionId: prepared.actionId,
    executionEligible,
    lifecycleState: executionEligible ? "EXECUTION_ELIGIBLE" : prepared.lifecycleState,
    blockingReasons: reasons,
    sideEffect: prepared.sideEffect,
  };
}
