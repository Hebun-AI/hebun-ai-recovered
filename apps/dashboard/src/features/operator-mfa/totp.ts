/**
 * TOTP (RFC 6238 over RFC 4226 HOTP) for the platform operator's second factor.
 *
 * The parameters every standard authenticator app accepts: HMAC-SHA1, 6 digits, 30-second steps.
 * Built on `node:crypto` only — no dependency. This module is pure: it holds no secret beyond the
 * call, reads no clock it is not handed, and never logs.
 *
 * It answers one question — "which time step, if any, does this code belong to?" — and nothing about
 * replay or lockout. Those are durable facts and live with the credential row
 * (`mfa-verification.server.ts`), where an atomic update makes them hold across processes.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOTP_DIGITS = 6;
export const TOTP_STEP_SECONDS = 30;
/** Accept the current step and one either side (±30 s of clock skew). */
export const TOTP_SKEW_STEPS = 1;
/** 160-bit secret, the size RFC 4226 recommends for HMAC-SHA1. */
export const TOTP_SECRET_BYTES = 20;

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const CODE_RE = /^\d{6}$/;

export function base32Encode(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decode unpadded upper-case base32. Returns null for anything else. */
export function base32Decode(text: string): Buffer | null {
  if (!/^[A-Z2-7]+$/.test(text)) return null;
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of text) {
    value = (value << 5) | BASE32_ALPHABET.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** A fresh secret, base32-encoded — the form authenticator apps take. Server-side only. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(TOTP_SECRET_BYTES));
}

/** RFC 4226 HOTP value for one counter, zero-padded to six digits. */
export function hotp(secret: Buffer, counter: number): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function totpStep(now: Date): number {
  return Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/**
 * The time step this code is valid for, within ±1 step of `now`, or null.
 *
 * Every candidate is compared in constant time and all three are always computed, so a near miss and
 * a far miss cost the same.
 */
export function matchTotpStep(secretBase32: string, code: string, now: Date): number | null {
  if (typeof code !== "string" || !CODE_RE.test(code)) return null;
  const secret = base32Decode(secretBase32);
  if (!secret || secret.length === 0) return null;
  const current = totpStep(now);
  let matched: number | null = null;
  for (let delta = -TOTP_SKEW_STEPS; delta <= TOTP_SKEW_STEPS; delta++) {
    const step = current + delta;
    if (step <= 0) continue;
    const expected = Buffer.from(hotp(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code)) && matched === null) matched = step;
  }
  return matched;
}

/**
 * The enrollment URI an authenticator app scans or accepts as text. It CONTAINS THE SECRET: it is
 * shown once, at the enrollment ceremony's terminal, and never logged, stored or audited.
 */
export function otpauthUri(accountLabel: string, secretBase32: string): string {
  const issuer = "Hebun AI";
  const label = encodeURIComponent(`${issuer}:${accountLabel}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
