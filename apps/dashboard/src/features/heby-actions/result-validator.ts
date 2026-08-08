/*
 * heby-actions/result-validator.ts — tool-result validation + execution-claim safety (Phase 17).
 *
 * Tool output is UNTRUSTED input. Before a receipt is believed it is validated against the
 * prepared action it claims to fulfil: the tool identity, the action identity, the declared
 * side-effect class, the target, the authority basis, and provenance must all be consistent, and
 * a receipt may not claim a side effect for a class that cannot cause one. Any mismatch FAILS
 * CLOSED to a safe FAILED receipt.
 *
 * It also owns EXECUTION-CLAIM SAFETY: Heby may never say "I restarted it / sent it / approved it
 * / deployed it" unless a validated receipt proves a side-effecting action occurred. Because only
 * READ_ONLY actions run in Phase 17 (and READ_ONLY never causes a side effect), NO receipt can
 * ever prove one — so response generation is STRUCTURALLY incapable of a truthful execution
 * claim. This extends the Phase 16 response-validator's forbidden-claims guard to the action path.
 */

import type {
  HebyActionReceipt,
  HebyPreparedAction,
} from "./contracts";

export interface ReceiptValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
  /** The receipt to trust: the original when valid, a safe FAILED fallback when not. */
  readonly receipt: HebyActionReceipt;
}

/**
 * Phrases that assert a consequential act occurred. A response using one is only safe when a
 * validated receipt proves it. Deliberately conservative (fail closed), but phrased so innocuous
 * words ("present", "consent") do not trip the guard.
 */
export const ACTION_EXECUTION_CLAIM_VERBS: readonly string[] = [
  "restarted",
  "sent the",
  "approved the",
  "rejected the",
  "authorized the",
  "executed the",
  "deployed",
  "deleted the",
  "granted the",
  "modified the policy",
  "changed the permission",
];

function safeFailedReceipt(original: HebyActionReceipt, reason: string): HebyActionReceipt {
  return {
    actionId: original.actionId,
    toolId: original.toolId,
    executionState: "FAILED",
    sideEffect: original.sideEffect,
    sideEffectOccurred: false,
    target: original.target,
    toolResult: undefined,
    evidence: [],
    provenance: ["Receipt failed validation; withheld."],
    authorityBasis: original.authorityBasis,
    governanceBasis: original.governanceBasis,
    reversibility: original.reversibility,
    failureReason: reason,
    observedTick: original.observedTick,
  };
}

/** Whether a receipt is a truthful proof that a side-effecting action occurred. */
export function receiptProvesSideEffect(receipt: HebyActionReceipt): boolean {
  return receipt.executionState === "SUCCESS" && receipt.sideEffectOccurred === true;
}

/**
 * Validate a receipt against the prepared action it claims to fulfil. Fails closed on ANY
 * identity, side-effect, target, authority, or provenance inconsistency.
 */
export function validateReceipt(
  receipt: HebyActionReceipt,
  prepared: HebyPreparedAction,
): ReceiptValidation {
  const issues: string[] = [];

  if (receipt.toolId !== prepared.toolId) {
    issues.push(`Receipt tool identity (${receipt.toolId}) does not match the action (${prepared.toolId}).`);
  }
  if (receipt.actionId !== prepared.actionId) {
    issues.push("Receipt action identity does not match the prepared action.");
  }
  if (receipt.sideEffect !== prepared.sideEffect) {
    issues.push("Receipt side-effect class does not match the prepared action.");
  }
  if ((receipt.target?.ref ?? null) !== (prepared.target?.ref ?? null)) {
    issues.push("Receipt target does not match the prepared action.");
  }
  // A read-only / preparation-only receipt must never claim a side effect occurred.
  if (
    (prepared.sideEffect === "READ_ONLY" || prepared.sideEffect === "PREPARATION_ONLY") &&
    receipt.sideEffectOccurred
  ) {
    issues.push("A non-mutating action must not report a side effect.");
  }
  // A SUCCESS receipt must carry the tool result that proves the tool ran.
  if (receipt.executionState === "SUCCESS" && !receipt.toolResult) {
    issues.push("A SUCCESS receipt must carry the tool result it derives from.");
  }
  // Authority basis for a READ_ONLY execution must be advisory-only — never escalated.
  if (prepared.sideEffect === "READ_ONLY" && receipt.executionState === "SUCCESS" && receipt.authorityBasis !== "advisory-only") {
    issues.push("A read-only execution must carry an advisory-only authority basis.");
  }
  if (receipt.provenance.length === 0) {
    issues.push("Receipt carries no provenance.");
  }

  if (issues.length > 0) {
    return { valid: false, issues, receipt: safeFailedReceipt(receipt, issues.join(" ")) };
  }
  return { valid: true, issues: [], receipt };
}

export interface ExecutionClaimCheck {
  readonly safe: boolean;
  readonly offendingClaims: readonly string[];
}

/**
 * Guard a piece of response text against an unproven execution claim. Text that asserts a
 * consequential act is only safe when a receipt PROVES that act occurred. In Phase 17 no receipt
 * can prove one, so any such claim is unsafe — the caller must withhold it.
 */
export function checkExecutionClaim(
  text: string,
  receipt?: HebyActionReceipt,
): ExecutionClaimCheck {
  const lowered = text.toLowerCase();
  const offending = ACTION_EXECUTION_CLAIM_VERBS.filter((verb) => lowered.includes(verb));
  if (offending.length === 0) return { safe: true, offendingClaims: [] };
  // A claim is only safe if a validated receipt proves a side effect actually occurred.
  const proven = receipt ? receiptProvesSideEffect(receipt) : false;
  return { safe: proven, offendingClaims: proven ? [] : offending };
}
