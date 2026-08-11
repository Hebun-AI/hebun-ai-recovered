/*
 * heby-runtime/prompt-validation.ts — the narrow application-boundary validator for a
 * user's Heby question (UI Runtime R2C).
 *
 * This is NOT content moderation and NOT prompt-injection defense (the trust boundary
 * that keeps evidence as DATA lives in the model layer's request translation). It only
 * enforces that a user prompt is a well-formed, bounded string before it is ever placed
 * into a model request: reject empty/blank, reject oversized, normalize surrounding
 * whitespace. User text is never interpreted as executable instructions anywhere.
 */

/** Upper bound on a single Heby question. Generous for prose, bounded against abuse. */
export const MAX_PROMPT_LENGTH = 4000;
/** Lower bound after trimming — a blank prompt is not a question. */
export const MIN_PROMPT_LENGTH = 1;

export type PromptRejectionReason = "not-a-string" | "empty" | "too-long";

export type PromptValidation =
  | { readonly ok: true; readonly prompt: string }
  | { readonly ok: false; readonly reason: PromptRejectionReason };

/**
 * Validate and normalize a user prompt. Pure. Returns the trimmed prompt when valid, or a
 * typed rejection. Length is measured BEFORE trimming so a giant blob of whitespace is
 * rejected as oversized rather than silently collapsing to empty.
 */
export function validateHebyPrompt(input: unknown): PromptValidation {
  if (typeof input !== "string") return { ok: false, reason: "not-a-string" };
  if (input.length > MAX_PROMPT_LENGTH) return { ok: false, reason: "too-long" };
  const prompt = input.trim();
  if (prompt.length < MIN_PROMPT_LENGTH) return { ok: false, reason: "empty" };
  return { ok: true, prompt };
}
