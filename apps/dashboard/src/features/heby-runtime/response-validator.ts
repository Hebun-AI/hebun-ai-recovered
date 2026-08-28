/*
 * heby-runtime/response-validator.ts — fail-closed response validation (UI Phase 16).
 *
 * Before a response is displayed it is validated. This is the guard that keeps a future
 * model's output honest: every evidence reference must be backed by the assembled evidence
 * (a model cannot introduce a citation for a source that was not retrieved), the authority
 * boundary must be unchanged, no response may claim an action occurred without a real tool
 * result, and no response may claim an approval/decision. Any malformed or unsupported
 * response fails closed to a safe UNAVAILABLE. Deterministic responses pass by construction;
 * the validator exists so the same gate applies the moment a model is ever connected.
 */

import type { HebyEvidenceReference } from "@/features/heby-integration";
import type { HebyRuntimeResponse } from "./contracts";
import { isSupportedEvidence } from "./evidence-assembler";

export interface ResponseValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
  /** The response to display: the original when valid, a safe fallback when not. */
  readonly response: HebyRuntimeResponse;
}

/** Words a response must not use to claim a consequential act that never happened. */
const FORBIDDEN_ACTION_CLAIMS = [
  "approved",
  "rejected",
  "authorized",
  "executed",
  "deployed",
  "deleted",
  "policy updated",
  "decision recorded",
];

function safeFallback(original: HebyRuntimeResponse, issues: readonly string[]): HebyRuntimeResponse {
  return {
    kind: "UNAVAILABLE",
    origin: "deterministic",
    title: "Response withheld",
    body: ["Heby could not produce a response that passed validation, so nothing is shown."],
    evidence: [],
    provenance: [],
    provenanceCovered: [],
    uncertainty: "unavailable",
    limitations: issues.length > 0 ? issues : ["Response failed validation."],
    authority: original.authority,
    modelUsed: false,
  };
}

/**
 * Validate a runtime response against the evidence that was actually assembled and the
 * authority the request was bound to. Fails closed.
 */
export function validateResponse(
  response: HebyRuntimeResponse,
  assembledEvidence: readonly HebyEvidenceReference[],
  expectedAuthority: HebyRuntimeResponse["authority"],
): ResponseValidation {
  const issues: string[] = [];

  // Shape.
  if (!response.title || response.body.length === 0) issues.push("Response is missing a title or body.");

  // Authority boundary must be unchanged.
  if (response.authority !== expectedAuthority) {
    issues.push("Response authority boundary does not match the request.");
  }

  // Heby may never claim to have acted (Phase 16 registers only read-only tools).
  const text = [response.title, ...response.body].join(" ").toLowerCase();
  for (const claim of FORBIDDEN_ACTION_CLAIMS) {
    if (text.includes(claim)) issues.push(`Response claims an action ("${claim}") that did not occur.`);
  }

  // Every evidence reference must be backed by the assembled evidence.
  for (const reference of response.evidence) {
    if (!isSupportedEvidence(reference, assembledEvidence)) {
      issues.push(`Unsupported evidence reference: ${reference.sourceClass}/${reference.recordRef}.`);
    }
  }

  // A model-origin response must carry the modelUsed flag.
  if (response.origin === "model" && !response.modelUsed) {
    issues.push("Model-origin response must set modelUsed.");
  }

  // Model attribution is only valid on a model-origin, model-used response, and its
  // transport provenance must be an explicit, known value — never conflated with origin.
  if (response.modelAttribution) {
    if (response.origin !== "model" || !response.modelUsed) {
      issues.push("Model attribution present on a non-model response.");
    }
    if (
      response.modelAttribution.transport !== "fake" &&
      response.modelAttribution.transport !== "live"
    ) {
      issues.push("Model attribution has an unknown transport provenance.");
    }
  }

  /*
   * AGENT-PROPOSAL-4A. The attempt flag is orthogonal to origin, so it is NOT constrained by it:
   * a deterministic answer may follow an attempt (withheld), and a model answer always follows
   * one. What IS constrained is the reverse direction — a served model answer that denied having
   * attempted a model would be self-contradictory.
   */
  if (
    response.modelInvocationAttempted !== undefined &&
    typeof response.modelInvocationAttempted !== "boolean"
  ) {
    issues.push("Model invocation attempted must be a boolean when present.");
  }
  if (response.origin === "model" && response.modelInvocationAttempted === false) {
    issues.push("A model-origin response cannot deny that a model invocation was attempted.");
  }

  if (issues.length > 0) {
    return { valid: false, issues, response: safeFallback(response, issues) };
  }
  return { valid: true, issues: [], response };
}
