/*
 * secret-encryption/authenticated-encryption.server.ts — THE FIRST REVERSIBLE PRIMITIVE IN HEBUN.
 *
 * ── WHAT MAKES THIS DIFFERENT FROM EVERY OTHER CRYPTO MODULE HERE ────────────
 *
 * Every secret Hebun held before this file was one-way by design: `password-hash.server.ts` runs
 * scrypt so a stolen row cannot become the password a human typed, and `session-digest.server.ts`
 * runs HMAC so a stolen row cannot become a cookie. Neither has an inverse, and that absence was
 * the security property.
 *
 * A provider credential cannot work that way. Hebun must one day present the tenant's actual
 * secret to the provider, so the secret must come back out. This module is therefore the first
 * place in the repository where a stored value CAN be turned back into the thing it protects, and
 * every rule below exists because of that one difference.
 *
 * ── AES-256-GCM, CHOSEN AGAINST THE ALTERNATIVES ─────────────────────────────
 *
 * Node's `crypto` offers three authenticated modes: `aes-256-gcm`, `aes-256-ccm` and
 * `chacha20-poly1305`. GCM is hardware-accelerated (AES-NI) on the runtimes this deployment
 * actually uses, has no awkward parameter coupling, and has the best-understood failure modes.
 * ChaCha20-Poly1305 would win on a CPU without AES-NI, which is not this deployment.
 *
 * AES-GCM-SIV — which would remove the nonce-reuse cliff entirely — IS NOT AVAILABLE IN NODE, and
 * adding a dependency to obtain it would break the rule `password-hash.server.ts` already states
 * for this repository: no dependency is added and no cryptography is invented here.
 *
 * ── AUTHENTICATED, NOT MERELY ENCRYPTED ──────────────────────────────────────
 *
 * Confidentiality alone would let an attacker with write access to the database flip ciphertext
 * bits and hand the provider a corrupted secret, or move a row between tenants. The 16-byte GCM
 * tag makes both a decryption FAILURE rather than a silent wrong answer, and the caller-supplied
 * AAD binds the ciphertext to the row's identity so a correctly-encrypted secret belonging to
 * another tenant does not open here either.
 *
 * ── WHAT THIS MODULE DELIBERATELY DOES NOT HAVE ──────────────────────────────
 *
 *   NO database access, NO tenant concept, NO environment read, NO key storage, NO logging.
 *
 * It is handed a key and an AAD and it does arithmetic. `password-hash.server.ts` is built the same
 * way and says why: a primitive that can reach configuration is a primitive that can be made to
 * choose its own key, and a primitive that can reach a database is one that can persist what it
 * was given.
 *
 * ── THE LIMIT THAT CANNOT BE ENGINEERED AWAY ─────────────────────────────────
 *
 * V8 DOES NOT GUARANTEE MEMORY ZEROIZATION. Plaintext handled here lives in a `Buffer` or a
 * `string` subject to garbage collection, string interning and heap snapshots. `buf.fill(0)`
 * narrows the window for a `Buffer` and does NOTHING for a `string`. What this module offers is a
 * narrow lifetime and no persistence — not erasure. Anyone reading a heap dump of a live process
 * at the wrong moment gets the secret, and no test here will pretend otherwise.
 *
 * Server-only.
 */
import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";

/** The one algorithm this phase implements. Recorded per row so a second one needs no migration. */
export const SECRET_ALGORITHM_AES_256_GCM = "aes-256-gcm" as const;

/** Exactly 32 bytes. A shorter key is a configuration error, never something to pad. */
export const SECRET_KEY_BYTES = 32;
/** 96 bits — the GCM-native nonce size, generated fresh for every single encryption. */
export const SECRET_IV_BYTES = 12;
/** 128 bits. The full tag; a truncated tag is a weaker guarantee wearing the same name. */
export const SECRET_AUTH_TAG_BYTES = 16;

/**
 * A key the registry resolved. The material never leaves this process and is never rendered.
 *
 * `toString`/`toJSON` are overridden because the single most likely way for key material to escape
 * is not an attacker — it is a `console.log(key)` or a `JSON.stringify(deps)` written in a hurry.
 */
export interface EncryptionKey {
  readonly keyId: string;
  readonly material: Buffer;
}

/** Build a key, with the accidental-disclosure guards attached. */
export function createEncryptionKey(keyId: string, material: Buffer): EncryptionKey {
  if (material.length !== SECRET_KEY_BYTES) {
    throw new Error(`An encryption key must be exactly ${SECRET_KEY_BYTES} bytes.`);
  }
  const key = {
    keyId,
    material,
    toString: () => `[EncryptionKey ${keyId}]`,
    toJSON: () => `[EncryptionKey ${keyId}]`,
  };
  return Object.freeze(key) as EncryptionKey;
}

/**
 * What is written to a row. Base64 throughout, because the columns are text and a hex/base64
 * mismatch between writer and reader is a class of bug the CHECK constraints can then exclude.
 */
export interface SealedSecret {
  readonly algorithm: typeof SECRET_ALGORITHM_AES_256_GCM;
  readonly keyId: string;
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Secret encryption is server-only.");
  }
}

/**
 * Encrypt one secret.
 *
 * A FRESH RANDOM IV EVERY TIME, generated here and never accepted from a caller. Handing the IV in
 * would make nonce reuse a caller's mistake to make; generating it here makes it unrepresentable.
 *
 * Random 96-bit nonces are birthday-bounded at roughly 2^32 encryptions under one key. Hebun is
 * many orders of magnitude below that, and key rotation bounds it further. Stated as a limit
 * rather than left implicit.
 */
export function sealSecret(plaintext: string, key: EncryptionKey, aad: Buffer): SealedSecret {
  assertServerOnly();
  if (plaintext.length === 0) throw new Error("Refusing to encrypt an empty secret.");

  const iv = randomBytes(SECRET_IV_BYTES);
  const cipher = createCipheriv(SECRET_ALGORITHM_AES_256_GCM, key.material, iv, {
    authTagLength: SECRET_AUTH_TAG_BYTES,
  });
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Object.freeze({
    algorithm: SECRET_ALGORITHM_AES_256_GCM,
    keyId: key.keyId,
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  });
}

/**
 * Why a decryption did not happen. Every arm is a REFUSAL, never a partial result.
 *
 * `algorithm-unsupported` exists because dispatch is on the STORED algorithm and not on the
 * current default — the `verifyPassword` rule, one domain over. A row written by a future
 * algorithm must refuse loudly here rather than be decrypted by the wrong one.
 */
export type DecryptionRefusal =
  | "algorithm-unsupported"
  | "key-mismatch"
  | "malformed-ciphertext"
  | "authentication-failed";

export type OpenSecretResult =
  | { readonly ok: true; readonly plaintext: string }
  | { readonly ok: false; readonly reason: DecryptionRefusal };

/**
 * Decrypt one secret, or say why not.
 *
 * `authentication-failed` covers a tampered ciphertext, a tampered tag, a wrong key AND an AAD
 * that does not match the row's identity — GCM cannot tell them apart, and neither will this
 * module. Reporting a guess about which one it was would be inventing information the cipher did
 * not give, and each of those cases is equally a refusal.
 *
 * NOTHING IS LOGGED HERE, in either direction. A failure message naming the key id or the row
 * would put half the puzzle into an aggregator.
 */
export function openSecret(
  sealed: SealedSecret,
  key: EncryptionKey,
  aad: Buffer,
): OpenSecretResult {
  assertServerOnly();

  if (sealed.algorithm !== SECRET_ALGORITHM_AES_256_GCM) {
    return { ok: false, reason: "algorithm-unsupported" };
  }
  /* The row records which key sealed it. Trying another one would be a silent fallback. */
  if (sealed.keyId !== key.keyId) return { ok: false, reason: "key-mismatch" };

  let iv: Buffer;
  let authTag: Buffer;
  let ciphertext: Buffer;
  try {
    iv = Buffer.from(sealed.iv, "base64");
    authTag = Buffer.from(sealed.authTag, "base64");
    ciphertext = Buffer.from(sealed.ciphertext, "base64");
  } catch {
    return { ok: false, reason: "malformed-ciphertext" };
  }
  if (iv.length !== SECRET_IV_BYTES || authTag.length !== SECRET_AUTH_TAG_BYTES) {
    return { ok: false, reason: "malformed-ciphertext" };
  }

  try {
    const decipher = createDecipheriv(SECRET_ALGORITHM_AES_256_GCM, key.material, iv, {
      authTagLength: SECRET_AUTH_TAG_BYTES,
    });
    decipher.setAAD(aad);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { ok: true, plaintext: plaintext.toString("utf8") };
  } catch {
    /* `final()` throws exactly when the tag does not verify. That is the whole guarantee. */
    return { ok: false, reason: "authentication-failed" };
  }
}

/** Constant-time equality for two same-length buffers. Used by tests and by the rotation ceremony. */
export function secretsEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
