/*
 * external-recipients/normalization.ts — one deterministic address form (R3R).
 *
 * ── SAME SEMANTICS AS THE REPOSITORY ALREADY USES ────────────────────────────
 *
 * `membership-authority/authorize-membership.server.ts` already normalizes an email before storing
 * it in `membership_authorizations.normalized_email`, and `invitations.normalized_email` carries
 * the same form. This module reproduces those semantics EXACTLY — trim, lowercase, a length bound
 * of `NORMALIZED_EMAIL_MAX_LENGTH`, and the same shape gate — and a test asserts the two functions
 * agree on a shared corpus.
 *
 * WHY REPRODUCED RATHER THAN IMPORTED. The existing function lives inside a `.server.ts` module
 * that pulls in the database client and Governance authority. This module is pure and is imported
 * by the ref/digest path, so importing that one would drag a server graph into a pure module.
 * Extracting it into a shared module instead would edit membership authority — another closed
 * phase's authoritative writer — for the convenience of this one. Reproducing the rule and PROVING
 * parity in a test is the smaller, safer move; if a third consumer appears, extraction earns
 * itself then.
 *
 * ── DELIBERATELY NOT AGGRESSIVE ──────────────────────────────────────────────
 *
 * No gmail dot-stripping, no `+tag` removal, no unicode/punycode folding, no MX lookup. Those are
 * provider-specific guesses about who owns an address, and `jane+work@example.com` really can be a
 * different mailbox from `jane@example.com`. Canonicalising them together would silently merge two
 * recipients into one — an identity claim this domain explicitly refuses to make.
 *
 * NORMALIZATION IS NOT VALIDATION OF REALITY. A value that normalizes cleanly is syntactically
 * addressable. It is not verified, not deliverable, and not proof anyone owns it.
 *
 * Pure. No I/O, no database, no clock, no authority.
 */

/** Mirrors `identity-enrollment/contracts.ts`, which the existing normalizer already uses. */
export const RECIPIENT_EMAIL_MAX_LENGTH = 320;

/*
 * One `@`, something before it, and a dotted something after it — the existing comment calls this
 * "Not RFC 5322 — a shape gate", and that is the right description. A full RFC 5322 grammar admits
 * quoted local parts and bracketed literals that no consumer here can use, and a stricter homegrown
 * pattern would reject legitimate addresses. The gate exists to stop obvious corruption, not to
 * decide what the internet permits.
 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/**
 * The single normalized form, or `null` when the value is not a syntactically usable address.
 *
 * Returns `null` rather than throwing because the caller turns it into a typed refusal, and
 * because a malformed address is ordinary user input, not a programming error.
 */
export function normalizeRecipientEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0 || normalized.length > RECIPIENT_EMAIL_MAX_LENGTH) return null;
  if (!EMAIL_SHAPE.test(normalized)) return null;
  return normalized;
}

/** Whether a value is already in its normalized form. Used before trusting a stored value. */
export function isNormalizedRecipientEmail(value: unknown): value is string {
  return typeof value === "string" && normalizeRecipientEmail(value) === value;
}
