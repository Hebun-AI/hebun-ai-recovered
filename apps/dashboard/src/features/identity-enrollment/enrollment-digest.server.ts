/*
 * Enrollment continuation digest (server-only).
 *
 * The bearer holds an opaque, high-entropy continuation reference returned ONCE by Act 1. The
 * database never stores that reference — only a keyed one-way digest
 * (`identity_enrollment_requests.continuation_hash`, char(64) hex). Identical to how
 * `session-digest.server.ts` treats a session reference and how `invitations.token_hash` is
 * specified, and for the same two reasons:
 *
 *   - a leaked database row cannot be turned back into a usable continuation reference;
 *   - a guessed reference cannot be forged into a valid digest without the server-only secret.
 *
 * NO NEW CRYPTOGRAPHY, AND NO NEW SECRET. This reuses the already-configured authentication digest
 * key, with an explicit DOMAIN SEPARATOR in the HMAC input. Domain separation is what keeps two
 * purposes from sharing one keystream: a session reference and an enrollment continuation can never
 * produce the same digest even if the same random bytes were somehow drawn twice, and neither can
 * be replayed as the other. Introducing a second environment secret would have added a deployment
 * requirement without adding separation the label already provides.
 *
 * The digest is HMAC-SHA256(secret, "<label>:<reference>") rendered as 64 lowercase hex characters,
 * satisfying the schema check `^[0-9a-f]{64}$`.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthenticationDigestKey } from "@/features/auth/environment/auth-environment.server";

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * The domain separator. Changing this string invalidates every stored continuation digest, which is
 * why it is a constant rather than something a caller may pass.
 */
const ENROLLMENT_CONTINUATION_LABEL = "hebun.i1-2.enrollment-continuation.v1";

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Enrollment digest is server-only.");
  }
}

/** Generate a 256-bit URL-safe continuation reference. Returned to the bearer exactly once. */
export function generateContinuationReference(): string {
  assertServerRuntime();
  return randomBytes(32).toString("base64url");
}

/** Keyed one-way digest of a continuation reference. Returns 64 lowercase hex chars. */
export function digestContinuationReference(
  reference: string,
  key: AuthenticationDigestKey,
): string {
  assertServerRuntime();
  if (!reference) {
    throw new Error("A continuation reference is required to compute a digest.");
  }
  return createHmac("sha256", key.secret)
    .update(`${ENROLLMENT_CONTINUATION_LABEL}:${reference}`)
    .digest("hex");
}

/**
 * Keyed one-way digest of an invitation token, under the invitation's own domain separator.
 *
 * `invitations.token_hash` is `char(64)` with `^[0-9a-f]{64}$` — the same shape — and I1.2 must be
 * able to recognise a presented token without becoming Invitation authority. This computes the
 * digest and nothing else: it mints no token, issues no invitation, and writes nothing.
 */
const INVITATION_TOKEN_LABEL = "hebun.invitation-token.v1";

export function digestInvitationToken(
  token: string,
  key: AuthenticationDigestKey,
): string {
  assertServerRuntime();
  if (!token) throw new Error("An invitation token is required to compute a digest.");
  return createHmac("sha256", key.secret)
    .update(`${INVITATION_TOKEN_LABEL}:${token}`)
    .digest("hex");
}

/** Constant-time comparison of two 64-char hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (!HEX_64.test(a) || !HEX_64.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** True when a value has the exact stored-digest shape. */
export function isDigestShape(value: unknown): value is string {
  return typeof value === "string" && HEX_64.test(value);
}
