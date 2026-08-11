/*
 * D1 — the credential primitive itself, with no database in the way.
 *
 * THE INVARIANT. Verification must depend on the password and on nothing else a
 * caller can influence. If any of these pass while the password is wrong, the
 * whole authentication boundary is decorative.
 *
 * The lockout and session behaviour that surrounds this primitive is proved
 * against a REAL PostgreSQL database in `authentication-postgres.ts` — a claim
 * about durable failure state cannot be made against a mock.
 */
import assert from "node:assert/strict";
import {
  CURRENT_SCRYPT_PARAMS,
  PASSWORD_ALGORITHM_SCRYPT,
  hashPassword,
  needsRehash,
  verifyPassword,
} from "../../src/features/auth-runtime/password-hash.server";

const PASSWORD = "correct horse battery staple";

async function main(): Promise<void> {
  /* ── The hash is storable material and nothing else ───────────────────────── */
  {
    const record = await hashPassword(PASSWORD);
    assert.equal(record.algorithm, PASSWORD_ALGORITHM_SCRYPT);
    assert.match(record.salt, /^[0-9a-f]{64}$/, "salt is 32 bytes of hex");
    assert.match(record.secretHash, /^[0-9a-f]{128}$/, "hash is 64 bytes of hex");

    // The password must be unrecoverable from what we store. A substring check is
    // crude on purpose: it catches the catastrophic mistake of storing it.
    const serialized = JSON.stringify(record);
    assert.ok(!serialized.includes(PASSWORD), "the password is not in the record");
    assert.ok(
      !serialized.toLowerCase().includes("horse"),
      "no fragment of the password survives",
    );
  }

  /* ── Salt is per credential, so identical passwords do not collide ────────── */
  {
    const a = await hashPassword(PASSWORD);
    const b = await hashPassword(PASSWORD);
    assert.notEqual(a.salt, b.salt, "each credential gets its own salt");
    assert.notEqual(
      a.secretHash,
      b.secretHash,
      "the same password hashes differently — a stolen table cannot be grouped by hash",
    );
    // …and both still verify.
    assert.equal(await verifyPassword(PASSWORD, a), true);
    assert.equal(await verifyPassword(PASSWORD, b), true);
  }

  /* ── Verification actually depends on the password ────────────────────────── */
  {
    const record = await hashPassword(PASSWORD);
    assert.equal(await verifyPassword(PASSWORD, record), true, "correct password");
    assert.equal(await verifyPassword("wrong password", record), false);
    assert.equal(await verifyPassword("", record), false, "empty is not a password");
    assert.equal(
      await verifyPassword(PASSWORD.toUpperCase(), record),
      false,
      "case matters",
    );
    assert.equal(
      await verifyPassword(` ${PASSWORD}`, record),
      false,
      "a leading space is part of the password and is NOT trimmed away",
    );
    assert.equal(
      await verifyPassword(`${PASSWORD} `, record),
      false,
      "a trailing space is significant too",
    );
  }

  /* ── Unicode normalization is applied, and it is not trimming ─────────────── */
  {
    // Two encodings of the same Turkish text must be the same password.
    const composed = "gizli-şifre-üğı";
    const decomposed = composed.normalize("NFD");
    assert.notEqual(composed, decomposed, "the two encodings really do differ");
    const record = await hashPassword(composed);
    assert.equal(
      await verifyPassword(decomposed, record),
      true,
      "the same characters verify regardless of how the keyboard encoded them",
    );
  }

  /* ── Tampered stored material fails CLOSED, never open ────────────────────── */
  {
    const record = await hashPassword(PASSWORD);

    assert.equal(
      await verifyPassword(PASSWORD, { ...record, salt: "0".repeat(64) }),
      false,
      "a swapped salt does not verify",
    );
    assert.equal(
      await verifyPassword(PASSWORD, { ...record, secretHash: "0".repeat(128) }),
      false,
      "a swapped hash does not verify",
    );
    assert.equal(
      await verifyPassword(PASSWORD, { ...record, algorithm: "plaintext" }),
      false,
      "an unknown algorithm refuses rather than falling back to comparison",
    );
    assert.equal(
      await verifyPassword(PASSWORD, { ...record, salt: "not-hex" }),
      false,
      "malformed stored material refuses instead of throwing",
    );
    assert.equal(
      await verifyPassword(PASSWORD, { ...record, secretHash: "abc" }),
      false,
      "a truncated hash cannot be matched by a truncated candidate",
    );
    assert.equal(
      await verifyPassword(PASSWORD, {
        ...record,
        params: { ...record.params, N: 1024 },
      }),
      false,
      "different cost parameters derive a different key",
    );
  }

  /* ── Algorithm agility: a row states how IT was hashed ────────────────────── */
  {
    // A credential written under weaker parameters must keep verifying, so that
    // raising the policy later never locks anybody out.
    const weaker = { N: 16384, r: 8, p: 1, keylen: 64 };
    const legacy = await hashPassword(PASSWORD, weaker);
    assert.deepEqual(legacy.params, weaker, "the row records its own parameters");
    assert.equal(
      await verifyPassword(PASSWORD, legacy),
      true,
      "an older credential still verifies under the newer policy",
    );
    assert.equal(
      needsRehash(legacy),
      true,
      "…and is reported as due for an upgrade",
    );
    const current = await hashPassword(PASSWORD);
    assert.equal(needsRehash(current), false, "a current credential is not");
    assert.equal(
      needsRehash({ algorithm: "argon2id", params: CURRENT_SCRYPT_PARAMS }),
      true,
      "an unrecognised algorithm is always due for rehash — never silently trusted",
    );
  }

  /* ── Refuse to hash nothing ───────────────────────────────────────────────── */
  {
    await assert.rejects(() => hashPassword(""), /password is required/i);
  }

  /* ── The parameters we ship are the ones we claim ─────────────────────────── */
  {
    assert.equal(CURRENT_SCRYPT_PARAMS.N, 32768);
    assert.equal(CURRENT_SCRYPT_PARAMS.r, 8);
    assert.equal(CURRENT_SCRYPT_PARAMS.p, 3);
    assert.equal(CURRENT_SCRYPT_PARAMS.keylen, 64);
    assert.ok(
      (CURRENT_SCRYPT_PARAMS.N & (CURRENT_SCRYPT_PARAMS.N - 1)) === 0,
      "N is a power of two",
    );
  }

  console.log("D1 credential core: passed");
}

void main();
