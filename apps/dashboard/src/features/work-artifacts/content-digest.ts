/*
 * work-artifacts/content-digest.ts — WHAT WAS REVIEWED == WHAT MAY LATER BE ACTED ON (R3W).
 *
 * One deterministic SHA-256 over a revision's exact bytes. That is the whole module.
 *
 * WHY A PLAIN DIGEST AND NOT AN HMAC. `canonical-payload.ts` already argued this for action
 * payloads and the same argument holds here: artifact content is SHOWN to a human, in full,
 * because a human cannot approve what they cannot read. Keying it would imply a confidentiality
 * the data does not have and would add key management to a content check.
 *
 * WHY NOT REUSE `digestCanonicalAction`. That function hashes an ACTION identity — kind, tool,
 * target and typed scalars. A revision is bytes. Feeding text through the action serializer would
 * make one function answer two different questions, and the first time the action format changed
 * every historical revision digest would silently mean something else.
 *
 * WHY NOT `actionId`. Heby's `actionId` is FNV-1a — a 32-bit non-cryptographic hash, as its own
 * source comments say. It is right for dedupe and wrong for a binding: 32 bits is searchable in
 * seconds, so a second body could present the same identity and inherit an approval.
 *
 * WHAT A DIGEST IS NOT. It is evidence of BYTES. It is not a confidence score, not a quality
 * measure, not a trust signal, and it says nothing whatever about whether the content is true.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */
import { createHash } from "node:crypto";

/** The shape the database CHECK constraint enforces: lowercase hex, exactly 64 characters. */
const DIGEST_RE = /^[0-9a-f]{64}$/;

/**
 * SHA-256 over the revision's content, encoded UTF-8.
 *
 * Deterministic and total: the same string always yields the same digest, and any change — one
 * character, one trailing newline, one different Unicode normalisation — yields a different one.
 * Nothing is trimmed, normalised, or canonicalised first: the digest must cover the bytes that
 * were actually stored, not a cleaned-up version of them.
 */
export function digestArtifactContent(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/** Whether a value has the exact stored digest shape. Used before trusting a supplied digest. */
export function isArtifactContentDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_RE.test(value);
}

/**
 * Constant-time-ish equality for two digests.
 *
 * These are public values, so timing is not a real threat here; the function exists so call sites
 * compare through ONE named check rather than scattering `===` over hex strings, and so a
 * malformed input is refused rather than silently compared.
 */
export function contentDigestsMatch(left: unknown, right: unknown): boolean {
  if (!isArtifactContentDigest(left) || !isArtifactContentDigest(right)) return false;
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}
