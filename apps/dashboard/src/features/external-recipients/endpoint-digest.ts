/*
 * external-recipients/endpoint-digest.ts — WHAT WAS APPROVED == WHERE IT MAY LATER GO (R3R).
 *
 * One deterministic SHA-256 over an endpoint's NORMALIZED value. That is the whole module.
 *
 * WHY NOT REUSE `digestArtifactContent`. That function hashes a revision's bytes VERBATIM, and its
 * own header says so: "Nothing is trimmed, normalised, or canonicalised first: the digest must
 * cover the bytes that were actually stored." An endpoint digest covers the opposite — the
 * normalized form, because ` Jane@Example.COM ` and `jane@example.com` are the same mailbox and
 * must not produce two approvals for one address. Two different questions; two functions. Sharing
 * one would mean the first time either rule changed, the other domain's historical digests would
 * silently mean something else.
 *
 * WHY A PLAIN DIGEST AND NOT AN HMAC. Same argument `canonical-payload.ts` and
 * `content-digest.ts` already made: the address is SHOWN to a human, in full, because a human
 * cannot approve a send without seeing where it goes. Keying it would imply a confidentiality this
 * value does not have at the approval surface and would add key management to a content check.
 *
 * WHAT A DIGEST IS NOT. It is evidence of BYTES. It is not verification, not deliverability, not
 * ownership, not trust, and not proof the person exists. An address that hashes perfectly may
 * bounce, may belong to somebody else, or may never have existed.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */
import { createHash } from "node:crypto";

/** The shape the database CHECK constraint enforces: lowercase hex, exactly 64 characters. */
const DIGEST_RE = /^[0-9a-f]{64}$/;

/**
 * SHA-256 over the already-normalized endpoint value, encoded UTF-8.
 *
 * Takes the NORMALIZED string and does not normalize it again: normalization is the caller's
 * decision and belongs to `normalization.ts`, so a caller that skipped it gets a digest of what it
 * actually passed rather than a silently repaired one. The writer normalizes first, and a test
 * pins that the digest of a raw value and of its normalized form differ — which is the point.
 */
export function digestRecipientEndpoint(normalizedValue: string): string {
  return createHash("sha256").update(normalizedValue, "utf8").digest("hex");
}

/** Whether a value has the exact stored digest shape. Used before trusting a supplied digest. */
export function isRecipientEndpointDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST_RE.test(value);
}

/**
 * Equality for two endpoint digests.
 *
 * These are public values, so timing is not a real threat; the function exists so call sites
 * compare through ONE named check rather than scattering `===` over hex strings, and so a
 * malformed input is refused rather than silently compared. Mirrors `contentDigestsMatch`.
 */
export function endpointDigestsMatch(left: unknown, right: unknown): boolean {
  if (!isRecipientEndpointDigest(left) || !isRecipientEndpointDigest(right)) return false;
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i += 1) {
    difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  }
  return difference === 0;
}
