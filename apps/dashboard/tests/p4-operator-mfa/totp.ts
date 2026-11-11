/*
 * P4 — TOTP core against the RFC 6238 reference vectors (SHA-1 seed "12345678901234567890").
 * The RFC lists 8-digit values; a 6-digit code is the same truncation modulo 10^6.
 */
import assert from "node:assert/strict";
import {
  TOTP_DIGITS,
  TOTP_STEP_SECONDS,
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  matchTotpStep,
  otpauthUri,
  totpStep,
} from "../../src/features/operator-mfa/totp";

const SEED = Buffer.from("12345678901234567890", "ascii");
const SEED_B32 = base32Encode(SEED);
const VECTORS: readonly [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
];

assert.equal(TOTP_DIGITS, 6);
assert.equal(TOTP_STEP_SECONDS, 30);
assert.equal(SEED_B32, "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", "RFC base32 of the seed");
assert.deepEqual(base32Decode(SEED_B32), SEED);
assert.equal(base32Decode("not base32!"), null);

for (const [seconds, eight] of VECTORS) {
  const when = new Date(seconds * 1000);
  assert.equal(hotp(SEED, totpStep(when)), eight.slice(-6), `RFC 6238 vector at T=${seconds}`);
  assert.equal(matchTotpStep(SEED_B32, eight.slice(-6), when), totpStep(when));
}

/* ±1 step tolerance, and not one step more. */
const now = new Date(1_800_000_000_000);
const step = totpStep(now);
for (const delta of [-1, 0, 1]) assert.equal(matchTotpStep(SEED_B32, hotp(SEED, step + delta), now), step + delta);
for (const delta of [-2, 2]) assert.equal(matchTotpStep(SEED_B32, hotp(SEED, step + delta), now), null);

/* Format: exactly six digits. */
for (const bad of ["", "12345", "1234567", "12345a", " 123456", "123 456"]) {
  assert.equal(matchTotpStep(SEED_B32, bad, now), null, JSON.stringify(bad));
}

/* Secrets: 160 bits, base32, fresh each time. */
const a = generateTotpSecret();
const b = generateTotpSecret();
assert.match(a, /^[A-Z2-7]{32}$/);
assert.notEqual(a, b);
assert.equal(base32Decode(a)!.length, 20);

const uri = otpauthUri("op@acme.test", a);
assert.ok(uri.startsWith("otpauth://totp/Hebun%20AI%3Aop%40acme.test?"));
for (const part of [`secret=${a}`, "issuer=Hebun+AI", "algorithm=SHA1", "digits=6", "period=30"]) assert.ok(uri.includes(part), part);

console.log("P4 TOTP: RFC 6238 vectors, window, format and secrets verified");
