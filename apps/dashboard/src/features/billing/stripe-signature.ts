/*
 * billing/stripe-signature.ts — COMMERCIAL-ACTIVATION-1. Stripe webhook signature verification.
 *
 * Stripe signs `${t}.${rawBody}` with HMAC-SHA256 under the endpoint's `whsec_` secret and sends
 * `Stripe-Signature: t=<unix>,v1=<hex>[,v1=<hex>…]`. The body is verified EXACTLY as received — a
 * re-serialized JSON object is a different byte string and must never be what is checked.
 *
 * Refused: a missing/garbled header, no v1 signature, a timestamp outside the tolerance (replay), or
 * no v1 matching in constant time. `v0` (test-only legacy scheme) is ignored, never accepted.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const STRIPE_SIGNATURE_TOLERANCE_SECONDS = 300;

export type StripeSignatureCheck =
  | { readonly status: "verified"; readonly timestamp: number }
  | { readonly status: "refused"; readonly reason: "missing-header" | "malformed-header" | "timestamp-outside-tolerance" | "no-matching-signature" };

export function verifyStripeSignature(
  rawBody: string,
  header: string | null | undefined,
  secret: string,
  nowSeconds: number,
  toleranceSeconds: number = STRIPE_SIGNATURE_TOLERANCE_SECONDS,
): StripeSignatureCheck {
  if (!header) return { status: "refused", reason: "missing-header" };
  let timestamp: number | null = null;
  const v1: string[] = [];
  for (const part of header.split(",")) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key === "t" && /^\d+$/.test(value)) timestamp = Number(value);
    if (key === "v1" && /^[0-9a-f]{64}$/.test(value)) v1.push(value);
  }
  if (timestamp === null || v1.length === 0) return { status: "refused", reason: "malformed-header" };
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return { status: "refused", reason: "timestamp-outside-tolerance" };
  const expected = Buffer.from(createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex"), "utf8");
  const match = v1.some((candidate) => {
    const given = Buffer.from(candidate, "utf8");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
  return match ? { status: "verified", timestamp } : { status: "refused", reason: "no-matching-signature" };
}

/** Test seam: the header Stripe would send for `rawBody` at `timestamp`. */
export function signStripePayload(rawBody: string, secret: string, timestamp: number): string {
  return `t=${timestamp},v1=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest("hex")}`;
}
