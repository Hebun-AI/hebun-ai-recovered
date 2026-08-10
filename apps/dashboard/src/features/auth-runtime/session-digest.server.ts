/*
 * Session reference digest (server-only).
 *
 * The browser holds an opaque, high-entropy session reference in an httpOnly
 * cookie. The database never stores that reference — only a keyed one-way digest
 * (`user_session_contexts.provider_session_reference_hash`, char(64) hex). This
 * means:
 * - A leaked database row cannot be turned back into a valid cookie.
 * - A cookie cannot be forged into a valid digest without the server-only secret.
 *
 * The digest is HMAC-SHA256(secret, reference) rendered as 64 lowercase hex
 * characters, which satisfies the schema check `^[0-9a-f]{64}$`.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthenticationDigestKey } from "@/features/auth/environment/auth-environment.server";

const HEX_64 = /^[0-9a-f]{64}$/;

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Session digest is server-only.");
  }
}

/** Generate a 256-bit URL-safe session reference for the client cookie. */
export function generateSessionReference(): string {
  assertServerRuntime();
  return randomBytes(32).toString("base64url");
}

/** Keyed one-way digest of a session reference. Returns 64 lowercase hex chars. */
export function digestSessionReference(
  reference: string,
  key: AuthenticationDigestKey,
): string {
  assertServerRuntime();
  if (!reference) {
    throw new Error("A session reference is required to compute a digest.");
  }
  return createHmac("sha256", key.secret).update(reference).digest("hex");
}

/** Constant-time comparison of two 64-char hex digests. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (!HEX_64.test(a) || !HEX_64.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
