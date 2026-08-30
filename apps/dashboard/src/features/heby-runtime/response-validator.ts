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

/**
 * Consequential acts a response must not claim. UNCHANGED since UI Phase 16 — no verb was added
 * and none was removed. What changed is how a claim is RECOGNISED; see {@link claimsAnAction}.
 */
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

/* ═══════════════════════════════════════════════════════════════════════════
 * OBSERVATION != ACTION CLAIM
 *
 * The guarantee has always been: **Heby may never claim to have acted.** Until now that was
 * enforced by `text.includes(verb)` — a proxy that was exact while Heby could only ever describe
 * read models, and became wrong the moment Heby was grounded on governance records. A bare
 * substring cannot tell these apart:
 *
 *     "I approved the proposal."                     <- Heby claiming an authority it has none of
 *     "The proposal was approved by governance."     <- Heby REPORTING a record it was grounded on
 *     "Neither has been approved or rejected."       <- Heby reporting that it did NOT happen
 *     "Approved with no execution attempt recorded"  <- an evidence LABEL owned by the retrieval layer
 *
 * The last three are the product working. In production the first `agents`-grounded answer to
 * "what has Heby proposed, and what became of those proposals?" was WITHHELD — both the model's
 * prose and Heby's own deterministic composition — because the honest answer to that question is
 * unsayable without the word "approved". The guard was not wrong about its guarantee; it was
 * wrong about which sentences carry one.
 *
 *     PAST RECORDED GOVERNANCE STATE != HEBY EXERCISING GOVERNANCE AUTHORITY
 *
 * So the rule is narrowed to what it always meant, and narrowed by SEMANTICS rather than by
 * vocabulary. No verb is allowlisted; every one of them still fails in the shape that matters. A
 * sentence asserting a consequential act is refused UNLESS it is one of exactly two things:
 *
 *   1. NEGATED, with the negation attached to the verb — "no", "not", "never", "neither", "0",
 *      "zero", "none", "without". Attached, not merely present in the sentence, because
 *      "No issues, the deploy was executed." must still be refused.
 *
 *   2. ATTRIBUTED to a named actor that is not Heby — "approved by governance", "authorized by
 *      the Director". Heby reporting whose authority acted is the opposite of Heby claiming it.
 *
 * And SELF-ATTRIBUTION is refused ahead of both: "I", "we" or "Heby" as the actor of an
 * un-negated consequential verb fails even when the sentence also names an authority, so
 * "approved by governance — I approved it" cannot slip through on its first clause.
 * ═════════════════════════════════════════════════════════════════════════ */

/** Attached to a verb, these say the act did NOT happen — the honest core of an observation. */
const NEGATIONS = new Set([
  "no", "not", "never", "neither", "nor", "none", "nothing", "nobody", "without",
  "cannot", "cant", "n't", "0", "zero",
]);

/** Tokens that may sit between a negation (or an actor) and its verb without breaking the link. */
const FILLERS = new Set([
  "has", "have", "had", "been", "be", "being", "was", "were", "is", "are", "am",
  "it", "they", "them", "any", "a", "an", "the", "yet", "still", "ever", "then", "also",
  "just", "already", "now", "successfully", "and", "or", "with", "in", "of", "for", "to", "at", "by", "on",
]);

/** Heby claiming the act as its own. Never permitted, negation aside. */
const SELF_ACTORS = new Set(["i", "we", "heby", "me", "us", "my", "our"]);

const tokenize = (sentence: string): string[] =>
  sentence.toLowerCase().replace(/[^a-z0-9']+/g, " ").trim().split(/\s+/).filter(Boolean);

/** Single-word verbs, plus the two two-word phrases, expressed over a token stream. */
const VERB_TOKENS = new Set(["approved", "rejected", "authorized", "executed", "deployed", "deleted"]);
const VERB_PHRASES: readonly (readonly [string, string])[] = [
  ["policy", "updated"],
  ["decision", "recorded"],
];

/** Positions in `tokens` where a consequential verb starts, with its length in tokens. */
function verbSites(tokens: readonly string[]): { index: number; length: number }[] {
  const sites: { index: number; length: number }[] = [];
  tokens.forEach((token, index) => {
    if (VERB_TOKENS.has(token)) sites.push({ index, length: 1 });
    for (const [first, second] of VERB_PHRASES) {
      if (token === first && tokens[index + 1] === second) sites.push({ index, length: 2 });
    }
  });
  return sites;
}

/** A negation linked to this verb by fillers alone, looking back and then forward. */
function isNegated(tokens: readonly string[], index: number, length: number): boolean {
  for (let i = index - 1; i >= 0; i -= 1) {
    const token = tokens[i]!;
    if (NEGATIONS.has(token)) return true;
    /* Coordinated verbs share a negation: "neither has been approved or rejected". */
    if (FILLERS.has(token) || VERB_TOKENS.has(token)) continue;
    break;
  }
  for (let i = index + length; i < tokens.length; i += 1) {
    const token = tokens[i]!;
    if (NEGATIONS.has(token)) return true;
    if (FILLERS.has(token)) continue;
    break;
  }
  return false;
}

/** `I`/`we`/`Heby` reachable backwards from the verb through fillers alone. */
function isSelfAttributed(tokens: readonly string[], index: number, length: number): boolean {
  for (let i = index - 1; i >= 0; i -= 1) {
    const token = tokens[i]!;
    if (SELF_ACTORS.has(token)) return true;
    if (FILLERS.has(token) || VERB_TOKENS.has(token)) continue;
    break;
  }
  /* "… was approved by Heby" / "… executed by me" — the agent of a passive is still the actor. */
  for (let i = index + length; i < tokens.length - 1; i += 1) {
    if (tokens[i] === "by") return SELF_ACTORS.has(tokens[i + 1]!);
    if (!FILLERS.has(tokens[i]!)) break;
  }
  return false;
}

/** `by <someone other than Heby>` — Heby naming whose authority acted. */
function namesAnotherActor(tokens: readonly string[], index: number, length: number): boolean {
  for (let i = index + length; i < tokens.length - 1; i += 1) {
    if (tokens[i] === "by") return !SELF_ACTORS.has(tokens[i + 1]!);
    if (!FILLERS.has(tokens[i]!)) break;
  }
  return false;
}

/**
 * Does this text CLAIM the named consequential act, rather than observe or deny it?
 *
 * Judged per sentence, so a refusal in one sentence cannot license a claim in the next.
 */
export function claimsAnAction(text: string, claim: string): boolean {
  const wanted = claim.split(" ");
  for (const sentence of text.split(/[.!?\n]+/)) {
    const tokens = tokenize(sentence);
    for (const site of verbSites(tokens)) {
      const matched = tokens.slice(site.index, site.index + site.length).join(" ");
      if (matched !== wanted.join(" ")) continue;
      const negated = isNegated(tokens, site.index, site.length);
      if (isSelfAttributed(tokens, site.index, site.length)) {
        if (!negated) return true;
        continue;
      }
      if (negated) continue;
      if (namesAnotherActor(tokens, site.index, site.length)) continue;
      return true;
    }
  }
  return false;
}

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

  // Heby may never claim to have acted (Phase 16 registers only read-only tools). Reporting that
  // an authority acted, or that nothing did, is an OBSERVATION and is not a claim — see above.
  const text = [response.title, ...response.body].join(". ");
  for (const claim of FORBIDDEN_ACTION_CLAIMS) {
    if (claimsAnAction(text, claim)) {
      issues.push(`Response claims an action ("${claim}") that did not occur.`);
    }
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
