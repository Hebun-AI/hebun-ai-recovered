/*
 * INT-2 — THE ENCRYPTION PRIMITIVE AND THE KEY REGISTRY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A secret sealed here comes back only under the right key, the right algorithm and the right
 *    row identity; every other combination REFUSES; and a deployment whose key configuration is
 *    absent, malformed, duplicated or self-contradictory produces no key at all rather than a
 *    guess."
 *
 * No database, no network, no environment mutation — the registry takes `env` as a parameter, so
 * every invalid configuration is exercised without touching the process.
 */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import {
  openSecret,
  sealSecret,
  createEncryptionKey,
  SECRET_ALGORITHM_AES_256_GCM,
  SECRET_AUTH_TAG_BYTES,
  SECRET_IV_BYTES,
  SECRET_KEY_BYTES,
} from "../../src/features/secret-encryption/authenticated-encryption.server";
import {
  activeKeyOf,
  keyForRow,
  INTEGRATION_ENCRYPTION_ENV_KEYS,
  resolveIntegrationEncryptionKeys,
} from "../../src/features/secret-encryption/key-registry.server";
import { credentialAad } from "../../src/features/integration-credentials/contracts";

const TENANT = "10000000-0000-4000-8000-0000000000a1";
const OTHER_TENANT = "10000000-0000-4000-8000-0000000000b1";
const INTEGRATION = "20000000-0000-4000-8000-0000000000a2";
const OTHER_INTEGRATION = "20000000-0000-4000-8000-0000000000b2";
const SECRET = "int2-fixture-secret-do-not-log-9f3c";

const K1 = Buffer.alloc(SECRET_KEY_BYTES, 1);
const K2 = Buffer.alloc(SECRET_KEY_BYTES, 2);
const key1 = createEncryptionKey("k1", K1);
const key2 = createEncryptionKey("k2", K2);

const aad = credentialAad(TENANT, INTEGRATION, "api_key");

function envWith(keys: string, active: string): Record<string, string> {
  return {
    [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: keys,
    [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: active,
  };
}

function main(): void {
  /* ── 1. ROUND TRIP ───────────────────────────────────────────────────────── */
  {
    const sealed = sealSecret(SECRET, key1, aad);
    assert.equal(sealed.algorithm, SECRET_ALGORITHM_AES_256_GCM);
    assert.equal(sealed.keyId, "k1", "the row records WHICH key sealed it");
    assert.notEqual(sealed.ciphertext, SECRET, "the ciphertext is not the plaintext");
    assert.ok(
      !Buffer.from(sealed.ciphertext, "base64").toString("utf8").includes(SECRET),
      "and the plaintext is not recoverable from the ciphertext bytes without the key",
    );
    assert.equal(Buffer.from(sealed.iv, "base64").length, SECRET_IV_BYTES);
    assert.equal(Buffer.from(sealed.authTag, "base64").length, SECRET_AUTH_TAG_BYTES);

    const opened = openSecret(sealed, key1, aad);
    assert.ok(opened.ok && opened.plaintext === SECRET, "the right key and AAD open it");
  }

  /* ── 2. IV UNIQUENESS — the property nonce reuse would destroy ───────────── */
  {
    const ivs = new Set<string>();
    const ciphertexts = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const sealed = sealSecret(SECRET, key1, aad);
      ivs.add(sealed.iv);
      ciphertexts.add(sealed.ciphertext);
    }
    assert.equal(ivs.size, 200, "every encryption must use a FRESH IV");
    assert.equal(
      ciphertexts.size,
      200,
      "and identical plaintext under one key must never produce identical ciphertext",
    );
  }

  /* ── 3. WRONG KEY, WRONG KEY ID ──────────────────────────────────────────── */
  {
    const sealed = sealSecret(SECRET, key1, aad);

    /* Same id, different material — the case a mis-copied env var produces. */
    const impostor = createEncryptionKey("k1", Buffer.alloc(SECRET_KEY_BYTES, 9));
    const wrongMaterial = openSecret(sealed, impostor, aad);
    assert.ok(!wrongMaterial.ok && wrongMaterial.reason === "authentication-failed");

    /* Different id — refused BEFORE the cipher runs, so no oracle exists at all. */
    const wrongId = openSecret(sealed, key2, aad);
    assert.ok(!wrongId.ok && wrongId.reason === "key-mismatch", "a row opens under ITS key only");
  }

  /* ── 4. TAMPERING IS A REFUSAL, NEVER A WRONG ANSWER ─────────────────────── */
  {
    const sealed = sealSecret(SECRET, key1, aad);

    const flipped = Buffer.from(sealed.ciphertext, "base64");
    flipped[0] ^= 0x01;
    const tamperedCiphertext = openSecret(
      { ...sealed, ciphertext: flipped.toString("base64") },
      key1,
      aad,
    );
    assert.ok(!tamperedCiphertext.ok && tamperedCiphertext.reason === "authentication-failed");

    const tag = Buffer.from(sealed.authTag, "base64");
    tag[0] ^= 0x01;
    const tamperedTag = openSecret({ ...sealed, authTag: tag.toString("base64") }, key1, aad);
    assert.ok(!tamperedTag.ok && tamperedTag.reason === "authentication-failed");

    const shortIv = openSecret({ ...sealed, iv: Buffer.alloc(4).toString("base64") }, key1, aad);
    assert.ok(!shortIv.ok && shortIv.reason === "malformed-ciphertext");

    const futureAlgorithm = openSecret(
      { ...sealed, algorithm: "aes-512-imaginary" as never },
      key1,
      aad,
    );
    assert.ok(
      !futureAlgorithm.ok && futureAlgorithm.reason === "algorithm-unsupported",
      "dispatch is on the STORED algorithm — a future one refuses instead of being guessed at",
    );
  }

  /* ── 5. THE AAD IS THE THIRD ISOLATION LAYER ─────────────────────────────── */
  {
    const sealed = sealSecret(SECRET, key1, aad);

    const otherTenant = openSecret(
      sealed,
      key1,
      credentialAad(OTHER_TENANT, INTEGRATION, "api_key"),
    );
    assert.ok(
      !otherTenant.ok && otherTenant.reason === "authentication-failed",
      "a ciphertext moved to another TENANT does not open, even with the correct key",
    );

    const otherIntegration = openSecret(
      sealed,
      key1,
      credentialAad(TENANT, OTHER_INTEGRATION, "api_key"),
    );
    assert.ok(!otherIntegration.ok, "nor moved to another CONNECTION");

    const otherKind = openSecret(sealed, key1, credentialAad(TENANT, INTEGRATION, "oauth_access"));
    assert.ok(!otherKind.ok, "nor relabelled as another KIND");

    /* The encoding is unambiguous: no two different triples produce the same AAD bytes. */
    const a = credentialAad("a", "bc", "api_key").toString("utf8");
    const b = credentialAad("ab", "c", "api_key").toString("utf8");
    assert.notEqual(a, b, "a JSON array cannot be made ambiguous by shifting the boundaries");
  }

  /* ── 6. KEY MATERIAL IS NEVER RENDERED ───────────────────────────────────── */
  {
    const rendered = `${String(key1)} ${JSON.stringify(key1)} ${JSON.stringify({ key: key1 })}`;
    assert.ok(!rendered.includes(K1.toString("base64")), "no base64 key material in any rendering");
    assert.ok(!rendered.includes(K1.toString("hex")), "and none in hex either");
    assert.ok(rendered.includes("k1"), "the ID is what a careless log gets");
  }

  /* ── 7. THE REGISTRY: EVERY INVALID CONFIGURATION FAILS CLOSED ───────────── */
  {
    const good1 = randomBytes(32).toString("base64");
    const good2 = randomBytes(32).toString("base64");

    const configured = resolveIntegrationEncryptionKeys(
      envWith(`k1:${good1},k2:${good2}`, "k2"),
    );
    assert.equal(configured.status, "configured");
    assert.ok(configured.status === "configured");
    assert.equal(configured.keys.size, 2, "PLURAL keys, so rotation has somewhere to come from");
    assert.equal(activeKeyOf(configured).keyId, "k2", "exactly one key is active for writes");
    assert.equal(keyForRow(configured, "k1")?.keyId, "k1", "and an OLD key stays decryptable");
    assert.equal(keyForRow(configured, "k9"), null, "an unregistered id resolves to NOTHING");

    const cases: ReadonlyArray<readonly [string, Record<string, string>]> = [
      ["absent entirely", {}],
      ["no active key", { [INTEGRATION_ENCRYPTION_ENV_KEYS.keys]: `k1:${good1}` }],
      ["no keys", { [INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId]: "k1" }],
      ["active names no key", envWith(`k1:${good1}`, "k2")],
      ["duplicate key id", envWith(`k1:${good1},k1:${good2}`, "k1")],
      ["short key", envWith(`k1:${randomBytes(16).toString("base64")}`, "k1")],
      ["long key", envWith(`k1:${randomBytes(48).toString("base64")}`, "k1")],
      ["not base64", envWith("k1:this is not base64!!", "k1")],
      ["malformed entry", envWith(`k1${good1}`, "k1")],
      ["illegal key id", envWith(`K 1:${good1}`, "K 1")],
      ["empty registry string", envWith(",,", "k1")],
    ];

    for (const [label, env] of cases) {
      const resolution = resolveIntegrationEncryptionKeys(env);
      assert.equal(resolution.status, "invalid", `"${label}" must FAIL CLOSED, never configure`);
      assert.ok(resolution.status === "invalid");
      assert.ok(
        resolution.missingKeys.length + resolution.invalidKeys.length > 0,
        `"${label}" must say what is wrong`,
      );
      /* The complaint names ids and env vars. It must never quote key material. */
      const complaint = [...resolution.missingKeys, ...resolution.invalidKeys].join(" ");
      assert.ok(!complaint.includes(good1), `"${label}" leaked key material into its own error`);
      assert.ok(!complaint.includes(good2), `"${label}" leaked key material into its own error`);
    }

    /*
     * NO SILENT FALLBACK. With two keys registered, a row naming the FIRST does not open under the
     * ACTIVE one — the registry hands back the key the row names, or nothing.
     */
    const sealedUnderK1 = sealSecret(SECRET, keyForRow(configured, "k1")!, aad);
    const viaActive = openSecret(sealedUnderK1, activeKeyOf(configured), aad);
    assert.ok(!viaActive.ok, "the active key must not open a row sealed under an older one");
    const viaRecorded = openSecret(sealedUnderK1, keyForRow(configured, sealedUnderK1.keyId)!, aad);
    assert.ok(viaRecorded.ok, "and the recorded key must");
  }

  /* ── 8. A KEY OF THE WRONG LENGTH CANNOT EVEN BE CONSTRUCTED ─────────────── */
  {
    assert.throws(() => createEncryptionKey("k1", Buffer.alloc(16)), /exactly 32 bytes/);
    assert.throws(() => sealSecret("", key1, aad), /empty secret/);
  }

  console.log("int2-credential-authority/encryption-and-keys: all assertions passed");
}

main();
