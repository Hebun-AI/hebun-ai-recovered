/*
 * Email verification link digest (server-only).
 *
 * The same construction as `identity-enrollment/enrollment-digest.server.ts` and the session digest:
 * a 256-bit random reference handed out once, and only a keyed, domain-separated HMAC of it stored.
 * NO NEW SECRET — the configured authentication digest key is reused, and the label keeps an email
 * link, a session reference and an enrollment continuation from ever producing the same digest.
 */
import { createHmac, randomBytes } from "node:crypto";
import type { AuthenticationDigestKey } from "@/features/auth/environment/auth-environment.server";

/** Changing this string invalidates every open link, which is why it is not a parameter. */
const EMAIL_VERIFICATION_LABEL = "hebun.auth.email-verification.v1";

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Email verification digests are server-only.");
  }
}

/** 32 random bytes, base64url: exactly 43 characters. Mailed once, never stored. */
export function generateEmailVerificationReference(): string {
  assertServerRuntime();
  return randomBytes(32).toString("base64url");
}

/** HMAC-SHA256(secret, "<label>:<reference>") as 64 lowercase hex characters. */
export function digestEmailVerificationReference(
  reference: string,
  key: AuthenticationDigestKey,
): string {
  assertServerRuntime();
  if (!reference) throw new Error("A link reference is required to compute a digest.");
  return createHmac("sha256", key.secret)
    .update(`${EMAIL_VERIFICATION_LABEL}:${reference}`)
    .digest("hex");
}
