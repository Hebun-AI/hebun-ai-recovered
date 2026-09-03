/*
 * INT-2 BITE-PROOFS — seventeen mutations of the REAL source, each re-run in a child process, plus
 * one deliberately CORRECT change that must be accepted.
 *
 * A SECURITY TEST THAT STAYS GREEN AFTER ITS PROTECTION IS REMOVED IS NOT A SECURITY TEST. This
 * file is the difference between "the credential authority has three isolation layers" and "the
 * credential authority has three lines of code that look like isolation layers".
 *
 * ── WHAT COUNTS AS A PROOF ───────────────────────────────────────────────────
 *
 *   1. THE MUTATION APPLIED — the file on disk differs. A mutation that silently failed to apply
 *      is indistinguishable from a guard that did not bite.
 *   2. THE RUN FAILED — non-zero exit.
 *   3. IT FAILED FOR THE INTENDED REASON — the expected assertion text is in the output. A
 *      mutation that trips an unrelated check has proved nothing about the guard it targets.
 *   4. THE FILE CAME BACK BYTE-IDENTICAL — verified by sha256, not by "we wrote it back".
 *
 * Restoration runs in `finally`, so a failure never leaves mutated source on disk.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const PG_SUITE = "tests/int2-credential-authority/credential-authority-postgres.ts";
const CRYPTO_SUITE = "tests/int2-credential-authority/encryption-and-keys.ts";
const FIREWALL_SUITE = "tests/int2-credential-authority/boundaries-and-firewall.ts";

const PRIMITIVE = "src/features/secret-encryption/authenticated-encryption.server.ts";
const REGISTRY = "src/features/secret-encryption/key-registry.server.ts";
const REPOSITORY = "src/features/integration-credentials/credential-repository.server.ts";
const ROTATION = "src/features/integration-credentials/rotate-encryption-key.server.ts";
const CONTRACTS = "src/features/integration-credentials/contracts.ts";
const VERIFY = "src/features/integration-authority/verify-connection.server.ts";
/*
 * THE MIGRATION, not the schema module.
 *
 * Mutating `integration-credential.ts` proved nothing: the disposable database is built by
 * applying the generated SQL, so the constraint it actually carries comes from the .sql file. A
 * schema-module mutation applied cleanly, changed real source, and left the database exactly as
 * strict as before — a false pass caught only by requiring the run to fail.
 */
const MIGRATION = `src/db/migrations/${readdirSync(path.join(process.cwd(), "src/db/migrations")).find((f) => f.includes("int2"))!}`;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  /* A timeout or spawn failure is a VOID proof, never a pass — say so instead of counting it. */
  assert.ok(!result.error, `the child run of ${suite} failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE ENCRYPTION PRIMITIVE ───────────────────────────────────────────── */
  {
    label: "M1 the IV stops being fresh — every encryption reuses one nonce",
    file: PRIMITIVE,
    suite: CRYPTO_SUITE,
    find: "  const iv = randomBytes(SECRET_IV_BYTES);",
    replace: "  const iv = Buffer.alloc(SECRET_IV_BYTES, 7);",
    expect: "must use a FRESH IV",
  },
  {
    /*
     * Mutating only the DECRYPT side broke the round trip and tripped section 1 first — a bite in
     * the wrong place, which proves a different guard. Emptying the BINDING instead keeps every
     * round trip working and removes exactly the property this proof is about.
     */
    label: "M2 the AAD stops binding the row, so a ciphertext becomes tenant-independent",
    file: CONTRACTS,
    suite: CRYPTO_SUITE,
    find: "    JSON.stringify([CREDENTIAL_AAD_VERSION, tenantId, integrationId, kind]),",
    replace: "    JSON.stringify([CREDENTIAL_AAD_VERSION]),",
    expect: "another TENANT does not open",
  },
  {
    label: "M3 the recorded algorithm is ignored and the current one assumed",
    file: PRIMITIVE,
    suite: CRYPTO_SUITE,
    find: '  if (sealed.algorithm !== SECRET_ALGORITHM_AES_256_GCM) {\n    return { ok: false, reason: "algorithm-unsupported" };\n  }',
    replace: "  /* mutated: dispatch on the current default instead of the stored value */",
    expect: "dispatch is on the STORED algorithm",
  },
  {
    label: "M4 the row's key id is ignored, so any registered key is tried",
    file: PRIMITIVE,
    suite: CRYPTO_SUITE,
    find: '  if (sealed.keyId !== key.keyId) return { ok: false, reason: "key-mismatch" };',
    replace: "  /* mutated: the recorded key id no longer gates the attempt */",
    expect: "a row opens under ITS key only",
  },
  /* ── THE KEY REGISTRY ───────────────────────────────────────────────────── */
  {
    /*
     * REPORTED AS WHAT IT ACTUALLY PROVES. Removing the registry's length check does not produce
     * a wrong-length key in circulation — the PRIMITIVE refuses to construct one, loudly, and the
     * run dies there. So this is a defence-in-depth proof: two independent places reject a
     * malformed key, and the second one holds when the first is gone. Claiming it proved the
     * registry's `invalid` arm would be claiming the wrong guard bit.
     */
    label: "M5 the registry stops checking key length — the PRIMITIVE refuses anyway (defence in depth)",
    file: REGISTRY,
    suite: CRYPTO_SUITE,
    find: "  if (material.length !== SECRET_KEY_BYTES) return null;",
    replace: "  /* mutated: any length will do */",
    expect: "An encryption key must be exactly 32 bytes",
  },
  {
    label: "M6 a duplicate key id becomes last-one-wins instead of a refusal",
    file: REGISTRY,
    suite: CRYPTO_SUITE,
    find: "    if (keys.has(keyId)) {\n      invalidKeys.push(keyId);\n      continue;\n    }",
    replace: "    /* mutated: a later entry silently replaces an earlier one */",
    expect: "must FAIL CLOSED",
  },
  {
    label: "M7 an active key id naming no registered key is tolerated",
    file: REGISTRY,
    suite: CRYPTO_SUITE,
    find: '  if (!KEY_ID_RE.test(rawActive!) || !keys.has(rawActive!)) {\n    invalidKeys.push(INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId);\n  }',
    replace: "  /* mutated: the active id is no longer checked against the registry */",
    expect: "must FAIL CLOSED",
  },
  {
    /*
     * The ADDITIONAL variable's complaints are routed to a throwaway list, so a malformed or
     * duplicate entry there is silently dropped while the primary list still configures. The
     * registry would then be "configured" with a hole where an operator believed a key was.
     */
    label: "M17 malformed ADDITIONAL configuration is swallowed instead of refusing",
    file: REGISTRY,
    suite: CRYPTO_SUITE,
    find: "    if (registerKeyEntries(rawAdditional, INTEGRATION_ENCRYPTION_ENV_KEYS.additionalKeys, keys, invalidKeys) === 0) {",
    replace: "    if (registerKeyEntries(rawAdditional, INTEGRATION_ENCRYPTION_ENV_KEYS.additionalKeys, keys, []) === 0) {",
    expect: "must FAIL CLOSED",
  },
  /* ── TENANT ISOLATION, ONE LAYER AT A TIME ──────────────────────────────── */
  {
    label: "M8 LAYER 1: the application tenant predicate is deleted",
    file: REPOSITORY,
    suite: PG_SUITE,
    find: "  return eq(integrationCredentials.tenantId, tenant.tenantId);",
    replace: "  return sql`true`;",
    expect: "A cannot DECRYPT B's",
  },
  {
    label: "M9 LAYER 2: the composite foreign key becomes a single-column one",
    file: MIGRATION,
    suite: PG_SUITE,
    find: 'FOREIGN KEY ("tenant_id","integration_id") REFERENCES "public"."integrations"("tenant_id","id")',
    replace: 'FOREIGN KEY ("integration_id") REFERENCES "public"."integrations"("id")',
    expect: "ANOTHER TENANT'S connection is a database error",
  },
  {
    label: "M10 LAYER 3: the AAD stops binding the credential kind",
    file: CONTRACTS,
    suite: PG_SUITE,
    find: '    JSON.stringify([CREDENTIAL_AAD_VERSION, tenantId, integrationId, kind]),',
    replace: "    JSON.stringify([CREDENTIAL_AAD_VERSION, tenantId, integrationId]),",
    expect: "the AAD is load-bearing",
  },
  /* ── LIFECYCLE AND ATOMICITY ────────────────────────────────────────────── */
  {
    label: "M11 storing a credential is allowed to produce `connected`",
    file: "src/features/integration-authority/integration-repository.server.ts",
    suite: PG_SUITE,
    /*
     * Mutating `nextState` was refused by `isI1Producible` before any write happened — a real
     * bite, but of the phase-boundary gate rather than of the claim this proof is about. Writing
     * the literal into the UPDATE bypasses both guards, so what fails is the assertion that a
     * stored secret leaves the connection unverified.
     */
    find:
      "      connectionState: nextState,\n" +
      "      /*\n" +
      "       * Health is RESET, never asserted.",
    replace:
      '      connectionState: "connected" as ConnectionState,\n' +
      "      /*\n" +
      "       * Health is RESET, never asserted.",
    expect: "a supplied secret is an UNPROVEN secret",
  },
  {
    label: "M12 replacement leaves the transaction, so a failure destroys the old credential",
    file: REPOSITORY,
    suite: PG_SUITE,
    find: "    /* TEST-ONLY: the window this ordering is accused of opening, forced open on demand. */\n    if (deps.failAfterRevokeForTest) await deps.failAfterRevokeForTest();",
    replace: "    if (deps.failAfterRevokeForTest) { try { await deps.failAfterRevokeForTest(); } catch { /* mutated: swallowed */ } }",
    expect: "injected mid-replacement failure",
  },
  {
    label: "M13 a revoked or destroyed credential is allowed to decrypt",
    file: REPOSITORY,
    suite: PG_SUITE,
    find: '  if (row.revokedAt !== null || row.destroyedAt !== null) return refused("credential-not-live");',
    replace: "  /* mutated: end-of-life no longer blocks a decryption */",
    expect: "the revoked row cannot be opened",
  },
  /* ── THE VERIFICATION VOCABULARY ────────────────────────────────────────── */
  {
    label: "M14 a held credential is reported as a missing one",
    file: VERIFY,
    suite: PG_SUITE,
    find: "  return { ok: false, reason: NO_PROVIDER_VERIFIER };",
    replace: "  return { ok: false, reason: NO_CREDENTIAL_AUTHORITY };",
    expect: "telling the tenant it is missing would be false",
  },
  /* ── ROTATION, AND THE ONE THING IT MUST NOT DO ─────────────────────────── */
  {
    /*
     * The single most destructive thing this subsystem could do: an operator rotates a DEPLOYMENT
     * key and every tenant is silently asked to reconnect. Rotation re-wraps a secret; it does not
     * end a grant.
     */
    label: "M15 key rotation revokes the credentials it re-encrypts",
    file: ROTATION,
    suite: PG_SUITE,
    find: "            authTag: resealed.authTag,",
    replace:
      "            authTag: resealed.authTag,\n" + "            revokedAt: new Date(),",
    expect: "the lifecycle is unchanged",
  },
  {
    label: "M16 the encryption primitive starts logging what it handles",
    file: PRIMITIVE,
    suite: FIREWALL_SUITE,
    find: "  const iv = randomBytes(SECRET_IV_BYTES);",
    replace:
      "  const iv = randomBytes(SECRET_IV_BYTES);\n" + "  console.debug(plaintext);",
    expect: "it does arithmetic and nothing else",
  },
];

/** Behaviour-preserving. The suite must ACCEPT it, or these assertions are brittle, not strict. */
const ACCEPTED = {
  label: "A1 the live-credential predicate is written out inline — identical behaviour",
  file: REPOSITORY,
  suite: PG_SUITE,
  find:
    "  return and(\n" +
    "    isNull(integrationCredentials.revokedAt),\n" +
    "    isNull(integrationCredentials.destroyedAt),\n" +
    "  );",
  replace:
    "  return and(\n" +
    "    sql`${integrationCredentials.revokedAt} is null`,\n" +
    "    sql`${integrationCredentials.destroyedAt} is null`,\n" +
    "  );",
} as const;

let bitten = 0;

function withMutation(file: string, edits: readonly { find: string; replace: string }[], body: () => void): void {
  const original = readFile(file);
  const before = sha(original);
  let mutated = original;
  for (const edit of edits) {
    assert.ok(
      mutated.includes(edit.find),
      `the mutation target is not present in ${file} — the proof would be vacuous:\n${edit.find}`,
    );
    mutated = mutated.replace(edit.find, edit.replace);
  }
  assert.notEqual(mutated, original, `the mutation changed nothing in ${file}`);

  try {
    writeFileSync(abs(file), mutated, "utf8");
    /* CONDITION 1 */
    assert.equal(sha(readFile(file)), sha(mutated), `the mutation did not reach ${file}`);
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
  }
  /* CONDITION 4 */
  assert.equal(sha(readFile(file)), before, `${file} was not restored byte-identically`);
}

async function main(): Promise<void> {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.file, [mutation], () => {
      const run = runSuite(mutation.suite);
      /* CONDITION 2 */
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
      );
      /* CONDITION 3 */
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }

  withMutation(ACCEPTED.file, [{ find: ACCEPTED.find, replace: ACCEPTED.replace }], () => {
    const run = runSuite(ACCEPTED.suite);
    assert.ok(
      run.ok,
      `${ACCEPTED.label}: a behaviour-preserving change was REJECTED — the suite is testing the ` +
        `spelling rather than the rule.\n--- actual ---\n${run.output.slice(-2500)}`,
    );
  });
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `int2-credential-authority/bite-proofs: ${bitten} mutations bit, 1 correct change accepted`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
