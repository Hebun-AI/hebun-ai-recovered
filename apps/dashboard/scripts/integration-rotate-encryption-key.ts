/*
 * scripts/integration-rotate-encryption-key.ts — THE ENCRYPTION-KEY ROTATION CEREMONY.
 *
 *   npm run integration:rotate-key            re-encrypt every row not on the active key
 *   npm run integration:rotate-key -- --from k1   only rows sealed under k1
 *   npm run integration:rotate-key -- --check k1  how many rows still name k1 (no writes)
 *
 * ── WHAT AN OPERATOR IS ACTUALLY DOING ───────────────────────────────────────
 *
 *   1. Add the new key to HEBUN_INTEGRATION_ENCRYPTION_KEYS, keeping the old one.
 *   2. Point HEBUN_INTEGRATION_ENCRYPTION_ACTIVE_KEY_ID at it. New writes use it immediately;
 *      existing rows are untouched and still open under the key each of them records.
 *   3. Run this. Every row is decrypted under its own key and re-sealed under the active one.
 *   4. Run `--check <old>` until it reports zero.
 *   5. ONLY THEN remove the old key from the registry.
 *
 * Skipping step 4 makes every row still on the old key permanently unreadable. That is why step 5
 * has its own command instead of being something to remember.
 *
 * ── WHAT IT CHANGES, AND WHAT IT NECESSARILY HANDLES ─────────────────────────
 *
 * It re-encrypts the same provider secret under a new deployment key. Credential identity,
 * provider-credential semantics and connection state are unchanged: same credential id, same kind,
 * same expiry, same revocation state, same connection, same lifecycle. No connection is unverified,
 * no tenant is asked to reconnect, nothing is revoked.
 *
 * It does, necessarily, DECRYPT each secret transiently in server memory in order to re-encrypt it.
 * That window is real and cannot be erased afterwards. Run this on a host you would already trust
 * with the deployment key, and nowhere else.
 *
 * ── NO AUDIT ROW, NO INVENTED ACTOR, AND NO DURABLE RECORD ───────────────────
 *
 * `audit_log.actor_id`/`actor_type` are NOT NULL and a terminal has no actor to name. Recording
 * `system` would attribute this to a principal that does not exist. `event_log` has the same
 * constraint; `telemetry_events` and `command_audit` are tenant-scoped and this act is global.
 *
 * So NOTHING PERSISTS THIS RUN. What survives is the `key_id` on each row — a state, not a record:
 * it says which key seals a credential today, and cannot say when it moved, from what, or that a
 * row failed on the way. The output below is a terminal report and is not durable evidence.
 *
 * DEBT: durable rotation evidence is unavailable pending a platform-principal / ceremony-evidence
 * authority. Until then this ceremony is for CONTROLLED USE and is NOT production-authorized.
 *
 * ── NOTHING SECRET IS PRINTED ────────────────────────────────────────────────
 *
 * Key ids, counts and credential ids only. No key material, no ciphertext, no IV, no tag, and no
 * plaintext — not on success, and not in any failure path.
 */
import { createControlPlaneDb } from "../src/db/client.server";
import {
  countRowsOnKey,
  rotateIntegrationEncryptionKey,
} from "../src/features/integration-credentials/rotate-encryption-key.server";
import {
  INTEGRATION_ENCRYPTION_ENV_KEYS,
  resolveIntegrationEncryptionKeys,
} from "../src/features/secret-encryption/key-registry.server";

function argOf(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Refusing to rotate.");
    process.exitCode = 1;
    return;
  }

  const keys = resolveIntegrationEncryptionKeys(process.env);
  if (keys.status !== "configured") {
    /* IDS AND ENV VAR NAMES ONLY — this text reaches terminals, CI logs and screenshots. */
    console.error("The encryption key registry is not usable. Refusing to rotate.");
    console.error(`  missing : ${keys.missingKeys.join(", ") || "none"}`);
    console.error(`  invalid : ${keys.invalidKeys.join(", ") || "none"}`);
    console.error(
      `  expected: ${INTEGRATION_ENCRYPTION_ENV_KEYS.keys}="id:base64key,id:base64key" and ` +
        `${INTEGRATION_ENCRYPTION_ENV_KEYS.activeKeyId}="id"`,
    );
    process.exitCode = 1;
    return;
  }

  const handle = createControlPlaneDb(databaseUrl);
  try {
    const check = argOf("--check");
    if (check) {
      const count = await countRowsOnKey(handle.db, check);
      console.log(`Rows still sealed under "${check}": ${count}`);
      if (count > 0) {
        console.log("");
        console.log(`  DO NOT REMOVE "${check}" FROM THE REGISTRY.`);
        console.log("  Those rows would become permanently unreadable. Run the rotation first.");
        process.exitCode = 1;
      } else {
        console.log(`  Safe to remove "${check}" from ${INTEGRATION_ENCRYPTION_ENV_KEYS.keys}.`);
      }
      return;
    }

    const report = await rotateIntegrationEncryptionKey(handle.db, keys, {
      sourceKeyId: argOf("--from"),
    });

    console.log("Encryption key rotation");
    console.log(`  source key      : ${report.sourceKeyId ?? "(every key but the active one)"}`);
    console.log(`  destination key : ${report.destinationKeyId}`);
    console.log(`  count before    : ${report.countBefore}`);
    console.log(`  re-encrypted    : ${report.countReEncrypted}`);
    console.log(`  remaining       : ${report.countRemaining}`);
    console.log(`  result          : ${report.result}`);

    if (report.failures.length > 0) {
      console.log("");
      console.log("  Rows that did NOT move — each is unchanged and still readable under its own key:");
      for (const failure of report.failures) {
        console.log(`    ${failure.credentialId}  from=${failure.sourceKeyId}  ${failure.reason}`);
      }
    }
    console.log("");
    console.log("  NOT DURABLE EVIDENCE. No audit_log row is recorded — a terminal has no actor to");
    console.log("  attribute, and naming one that does not exist would be worse than recording");
    console.log("  nothing. No other table in this repository can hold this truthfully: event_log");
    console.log("  needs the same actor, and telemetry_events and command_audit are tenant-scoped");
    console.log("  while this act is deployment-global.");
    console.log("");
    console.log("  What survives is the key_id column on the rows themselves, which is a STATE and");
    console.log("  not a RECORD. Capture this output yourself if you need to keep it.");
    console.log("");
    console.log("  This ceremony is for CONTROLLED USE and is NOT production-authorized until a");
    console.log("  platform-principal / ceremony-evidence authority exists.");

    if (report.result !== "complete") process.exitCode = 1;
  } finally {
    await handle.dispose();
  }
}

main().catch((error) => {
  /* Never the error object: a driver error can carry a query string, and a query can carry a row. */
  console.error("The rotation ceremony failed.", error instanceof Error ? error.message : "");
  process.exitCode = 1;
});
