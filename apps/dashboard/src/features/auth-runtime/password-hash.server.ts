/*
 * Password hashing (server-only) — the D1 credential primitive.
 *
 * Sits beside session-digest.server.ts and follows the same rule: a secret the
 * server holds is never stored in a form that can be turned back into the thing
 * the human typed. The digest module protects a reference Hebun generated; this
 * module protects a secret a human chose, which is weaker input and therefore
 * gets a deliberately slow, salted, memory-hard function instead of one HMAC.
 *
 * PRIMITIVE. scrypt from `node:crypto` (RFC 7914, OpenSSL-backed). No dependency
 * is added and no cryptography is invented here — this module only selects
 * parameters, generates salt, and compares in constant time.
 *
 * PARAMETERS. N=2^15, r=8, p=3, 64-byte key: an OWASP-listed scrypt configuration
 * (~32 MB, ~230 ms on the development machine). They are written INTO each stored
 * credential rather than read from config, so:
 *   - raising the cost later does not invalidate existing credentials, and
 *   - a row always states how it was actually hashed.
 * `maxmem` is set explicitly because Node's 32 MB default is exactly at the
 * boundary for these parameters and would otherwise throw.
 *
 * ALGORITHM AGILITY. `verifyPassword` dispatches on the STORED algorithm, not on
 * the current default. A credential hashed under a future algorithm keeps
 * verifying, and `needsRehash` reports when a row is below the current policy so
 * a caller may upgrade it after a successful sign-in. Nothing here hard-codes
 * scrypt as the only possibility.
 *
 * WHAT THIS MODULE MUST NEVER DO: log a password, return a password, persist a
 * password, or hand `salt`/`secretHash` to anything outside the credential
 * repository. It has no database access and no environment access by design.
 */

import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";
import { promisify } from "node:util";

/*
 * `promisify(scrypt)` resolves to the 3-argument overload, which cannot carry
 * `maxmem`. The options-bearing signature is stated explicitly so the cost
 * parameters are actually applied rather than silently dropped.
 */
const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>;

export const PASSWORD_ALGORITHM_SCRYPT = "scrypt";

/** Cost parameters recorded with every credential this module writes. */
export interface ScryptParams {
  readonly N: number;
  readonly r: number;
  readonly p: number;
  readonly keylen: number;
}

/** Current policy. Raising these is safe: existing rows keep their own values. */
export const CURRENT_SCRYPT_PARAMS: ScryptParams = Object.freeze({
  N: 32768,
  r: 8,
  p: 3,
  keylen: 64,
});

/** The stored, non-secret-bearing description of a hashed password. */
export interface PasswordHashRecord {
  readonly algorithm: string;
  readonly params: ScryptParams;
  /** 32 bytes, hex. */
  readonly salt: string;
  /** `keylen` bytes, hex. */
  readonly secretHash: string;
}

const HEX = /^[0-9a-f]+$/;

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Password hashing is server-only.");
  }
}

/**
 * scrypt needs ~128*N*r bytes. Node's default `maxmem` is 32 MB, which these
 * parameters meet exactly, so the limit is stated rather than left to chance.
 */
function maxmemFor(params: ScryptParams): number {
  return 128 * params.N * params.r * 2 + 1024 * 1024;
}

function assertUsableParams(params: ScryptParams): void {
  const { N, r, p, keylen } = params;
  const powerOfTwo = Number.isInteger(N) && N > 1 && (N & (N - 1)) === 0;
  if (!powerOfTwo) throw new Error("scrypt N must be a power of two greater than 1.");
  if (!Number.isInteger(r) || r < 1) throw new Error("scrypt r must be a positive integer.");
  if (!Number.isInteger(p) || p < 1) throw new Error("scrypt p must be a positive integer.");
  if (!Number.isInteger(keylen) || keylen < 32) {
    throw new Error("scrypt keylen must be at least 32 bytes.");
  }
}

async function deriveScrypt(
  password: string,
  saltHex: string,
  params: ScryptParams,
): Promise<string> {
  assertUsableParams(params);
  const derived = await scryptAsync(
    // Normalize so the same typed characters always derive the same key across
    // platforms/keyboards. This is Unicode normalization, NOT trimming: a leading
    // or trailing space is part of the password and must stay significant.
    password.normalize("NFKC"),
    Buffer.from(saltHex, "hex"),
    params.keylen,
    { N: params.N, r: params.r, p: params.p, maxmem: maxmemFor(params) },
  );
  return derived.toString("hex");
}

/**
 * Hash a password under the CURRENT policy with a fresh random salt.
 * Returns only storable material — never the password.
 */
export async function hashPassword(
  password: string,
  params: ScryptParams = CURRENT_SCRYPT_PARAMS,
): Promise<PasswordHashRecord> {
  assertServerRuntime();
  if (typeof password !== "string" || password.length === 0) {
    throw new Error("A password is required.");
  }
  const salt = randomBytes(32).toString("hex");
  const secretHash = await deriveScrypt(password, salt, params);
  return { algorithm: PASSWORD_ALGORITHM_SCRYPT, params, salt, secretHash };
}

/**
 * Verify a password against a stored record, in constant time.
 *
 * Dispatches on `record.algorithm` so rows written under an older (or future)
 * algorithm still verify. An unknown algorithm returns false rather than
 * throwing: an unreadable credential must fail closed, not leak which rows are
 * unreadable. Malformed stored material likewise returns false.
 */
export async function verifyPassword(
  password: string,
  record: PasswordHashRecord,
): Promise<boolean> {
  assertServerRuntime();
  if (typeof password !== "string" || password.length === 0) return false;
  if (record.algorithm !== PASSWORD_ALGORITHM_SCRYPT) return false;
  if (!HEX.test(record.salt) || !HEX.test(record.secretHash)) return false;
  if (record.secretHash.length !== record.params.keylen * 2) return false;

  let candidate: string;
  try {
    candidate = await deriveScrypt(password, record.salt, record.params);
  } catch {
    return false;
  }

  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(record.secretHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * True when a stored credential is below current policy and should be rewritten
 * on the next successful sign-in. This is what makes an Argon2id move a data
 * upgrade rather than a migration — no caller is required to act on it in D1.
 */
export function needsRehash(
  record: Pick<PasswordHashRecord, "algorithm" | "params">,
  policy: ScryptParams = CURRENT_SCRYPT_PARAMS,
): boolean {
  if (record.algorithm !== PASSWORD_ALGORITHM_SCRYPT) return true;
  const p = record.params;
  return (
    p.N < policy.N || p.r < policy.r || p.p < policy.p || p.keylen < policy.keylen
  );
}
