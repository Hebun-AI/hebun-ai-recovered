/*
 * integration-credentials/rotate-encryption-key.server.ts — RE-ENCRYPTING WHAT IS ALREADY THERE.
 *
 * ── ROTATION IS NOT REPLACEMENT, AND CONFUSING THEM WOULD BE DESTRUCTIVE ─────
 *
 * Replacing a credential means the TENANT'S SECRET CHANGED: a new row, the old one revoked, the
 * connection back to `unverified`.
 *
 * Rotating an encryption key re-encrypts THE SAME PROVIDER SECRET under a new deployment key,
 * without changing credential identity, provider-credential semantics or connection state. The
 * same row is updated in place — same credential id, same kind, same expiry, same revocation
 * state, same connection, same lifecycle — and only `algorithm`, `key_id`, `ciphertext`, `iv` and
 * `auth_tag` move.
 *
 * ── IT NECESSARILY HOLDS THE PLAINTEXT, AND SAYING OTHERWISE WOULD BE FALSE ──
 *
 * Re-encryption is decrypt-then-encrypt. For each row, the tenant's provider secret EXISTS IN
 * SERVER MEMORY between `openSecret` and `sealSecret` — briefly, never persisted, never logged,
 * never returned, and never in the report. That window is real, and V8 offers no way to erase it
 * afterwards: a heap dump taken at the wrong instant contains the secret.
 *
 * So the honest claim is narrow: rotation does not CHANGE the tenant's secret. It does handle it.
 *
 * If rotation revoked credentials, an operator rotating a key would silently unverify every
 * connection in the deployment and force every tenant to reconnect. It does not, and a test
 * asserts the id, the kind, the expiry, the lifecycle and the connection state all survive.
 *
 * ── ONE ROW, ONE TRANSACTION ─────────────────────────────────────────────────
 *
 * Each row is decrypted under the key IT RECORDS, re-encrypted under the active key with a FRESH
 * IV, and written in its own transaction. A failure leaves that row exactly as it was — still
 * sealed under the old key and still decryptable — and the ceremony reports it as remaining rather
 * than pretending it moved.
 *
 * A single transaction over every row would make one bad row abandon the whole rotation, and a
 * ceremony that must be run all-or-nothing is a ceremony that never gets run.
 *
 * ── NO AUDIT ROW, AND NO DURABLE CEREMONY RECORD EITHER ──────────────────────
 *
 * `audit_log.actor_id` and `actor_type` are NOT NULL. This runs from a terminal, and a terminal has
 * no actor to name — `scripts/provider-connectivity.ts` refused the same trade in the same words.
 * Writing `system` would attribute a person's act to a principal that does not exist.
 *
 * EVERY OTHER CANDIDATE WAS AUDITED AND REJECTED, not overlooked:
 *
 *   audit_log          NOT NULL actor. Refused by decision rather than faked.
 *   event_log          same NOT NULL actor, and activating it is out of scope for this phase.
 *   telemetry_events   `tenant_id` NOT NULL. Rotation is DEPLOYMENT-GLOBAL and spans every
 *                      tenant, so any tenant id written here would be a false attribution.
 *   command_audit      `tenant_id` NOT NULL, and scoped to a `commands` row that does not exist.
 *
 * There is therefore NO LEGITIMATE DURABLE CEREMONY-EVIDENCE AUTHORITY in this repository, and
 * INT-2 does not invent one. Inventing a table would create a second audit authority; inventing an
 * actor would make the record itself the first lie in it.
 *
 * WHAT ACTUALLY SURVIVES THE TERMINAL: the `key_id` column on each credential row. It is durable
 * and countable months later, and `countRowsOnKey` reads it — but it is a STATE, not a RECORD. It
 * says which key seals a row today; it cannot say when it moved, from what, who ran it, or that
 * three rows failed on the way.
 *
 * RECORDED DEBT — durable rotation evidence is UNAVAILABLE pending a platform-principal /
 * ceremony-evidence authority. Until that exists, rotation is operationally available for
 * CONTROLLED USE and is NOT production-authorized. `RotationReport` below is an in-process value
 * printed to a terminal, which is not durable evidence and is not described as any.
 *
 * ── NO SECRET IS EVER RETURNED OR REPORTED ───────────────────────────────────
 *
 * Every value in `RotationReport` is a key id, a count or a credential id. The plaintext exists
 * only between `openSecret` and `sealSecret` inside one function, and nothing here logs.
 *
 * Server-only. NOT reachable from any request path — no route, action or component imports it.
 */
import { eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { integrationCredentials } from "@/db/schema/integration-credential";
import {
  openSecret,
  sealSecret,
  type SealedSecret,
} from "@/features/secret-encryption/authenticated-encryption.server";
import {
  activeKeyOf,
  keyForRow,
  type ConfiguredEncryptionKeys,
} from "@/features/secret-encryption/key-registry.server";
import { credentialAad, type IntegrationCredentialKind } from "./contracts";

/** Why a single row did not move. Each is reported, never swallowed. */
export type RotationFailureReason =
  /** The row names a key this deployment no longer registers. Re-add it and run again. */
  | "source-key-unregistered"
  /** The tag did not verify: tampering, a wrong key under the right id, or a moved row. */
  | "decryption-failed"
  /** The write itself failed. The row is unchanged and still readable under its old key. */
  | "write-failed";

export interface RotationFailure {
  readonly credentialId: string;
  readonly sourceKeyId: string;
  readonly reason: RotationFailureReason;
}

/**
 * THE CEREMONY'S RESULT — an in-process value, NOT durable evidence.
 *
 * It is returned to the caller and printed to a terminal. Nothing persists it, because no
 * authority exists that could hold it truthfully (see the header). Calling this "the evidence"
 * would overstate what a terminal window is.
 *
 * Every field is a count, a key id or a credential id. Nothing here can carry a secret.
 */
export interface RotationReport {
  readonly sourceKeyId: string | null;
  readonly destinationKeyId: string;
  /** Rows sealed under a key other than the destination, before the ceremony ran. */
  readonly countBefore: number;
  readonly countReEncrypted: number;
  /** Rows still not on the destination key afterwards. Zero is the only complete rotation. */
  readonly countRemaining: number;
  readonly failures: readonly RotationFailure[];
  readonly result: "complete" | "incomplete";
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Key rotation is server-only.");
  }
}

export interface RotationOptions {
  /**
   * Rotate only rows sealed under this key. Omitted, every row not already on the active key is
   * a candidate — which is what an operator wants after adding a key, and what a test needs to
   * prove that "not already active" is the real predicate.
   */
  readonly sourceKeyId?: string;
  /** TEST-ONLY: forced failure between decrypt and write, to prove a failed row stays readable. */
  readonly failBeforeWriteForTest?: (credentialId: string) => Promise<void>;
}

/**
 * Re-encrypt every credential that is not already sealed under the active key.
 *
 * DESTROYED ROWS ARE SKIPPED. They hold an empty ciphertext by constraint, there is nothing to
 * re-encrypt, and attempting one would produce a row that claims destruction while holding
 * material — which the database would reject anyway.
 *
 * REVOKED-BUT-NOT-DESTROYED ROWS ARE INCLUDED. They still hold real ciphertext under a key an
 * operator intends to retire, and leaving them behind would block that key's removal forever.
 */
export async function rotateIntegrationEncryptionKey(
  db: ControlPlaneDatabase,
  keys: ConfiguredEncryptionKeys,
  options: RotationOptions = {},
): Promise<RotationReport> {
  assertServerOnly();

  const destination = activeKeyOf(keys);
  const candidates = await db
    .select({
      id: integrationCredentials.id,
      tenantId: integrationCredentials.tenantId,
      integrationId: integrationCredentials.integrationId,
      kind: integrationCredentials.kind,
      algorithm: integrationCredentials.algorithm,
      keyId: integrationCredentials.keyId,
      ciphertext: integrationCredentials.ciphertext,
      iv: integrationCredentials.iv,
      authTag: integrationCredentials.authTag,
      destroyedAt: integrationCredentials.destroyedAt,
    })
    .from(integrationCredentials);

  const pending = candidates.filter(
    (row) =>
      row.destroyedAt === null &&
      row.keyId !== destination.keyId &&
      (options.sourceKeyId === undefined || row.keyId === options.sourceKeyId),
  );

  const failures: RotationFailure[] = [];
  let moved = 0;

  for (const row of pending) {
    const sourceKey = keyForRow(keys, row.keyId);
    if (!sourceKey) {
      failures.push({
        credentialId: row.id,
        sourceKeyId: row.keyId,
        reason: "source-key-unregistered",
      });
      continue;
    }

    const aad = credentialAad(
      row.tenantId,
      row.integrationId,
      row.kind as IntegrationCredentialKind,
    );
    const sealed: SealedSecret = {
      algorithm: row.algorithm as SealedSecret["algorithm"],
      keyId: row.keyId,
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.authTag,
    };
    const opened = openSecret(sealed, sourceKey, aad);
    if (!opened.ok) {
      failures.push({ credentialId: row.id, sourceKeyId: row.keyId, reason: "decryption-failed" });
      continue;
    }

    /* THE SAME PLAINTEXT, a fresh IV, the new key. The tenant's secret is not being changed. */
    const resealed = sealSecret(opened.plaintext, destination, aad);

    try {
      await db.transaction(async (tx) => {
        if (options.failBeforeWriteForTest) await options.failBeforeWriteForTest(row.id);
        await tx
          .update(integrationCredentials)
          .set({
            algorithm: resealed.algorithm,
            keyId: resealed.keyId,
            ciphertext: resealed.ciphertext,
            iv: resealed.iv,
            authTag: resealed.authTag,
            /*
             * `updated_at` moves and NOTHING ELSE about the credential does. No actor is written:
             * a terminal has none, and `updated_by` naming a human who was not there would be
             * worse than a null. `version` is deliberately untouched — the credential did not
             * change, only its wrapping did.
             */
            updatedAt: new Date(),
          })
          .where(eq(integrationCredentials.id, row.id));
      });
      moved += 1;
    } catch {
      /* The row is untouched and still opens under its old key. Reported, never swallowed. */
      failures.push({ credentialId: row.id, sourceKeyId: row.keyId, reason: "write-failed" });
    }
  }

  /*
   * Counted again from the DATABASE, not from `pending.length - moved`. Arithmetic on the earlier
   * numbers would report what the ceremony BELIEVES happened; this reports what is actually there,
   * which is the only figure worth putting in front of an operator about to delete a key.
   */
  const after = await db
    .select({
      keyId: integrationCredentials.keyId,
      destroyedAt: integrationCredentials.destroyedAt,
    })
    .from(integrationCredentials);

  const remaining = after.filter(
    (row) =>
      row.destroyedAt === null &&
      row.keyId !== destination.keyId &&
      (options.sourceKeyId === undefined || row.keyId === options.sourceKeyId),
  ).length;

  return Object.freeze({
    sourceKeyId: options.sourceKeyId ?? null,
    destinationKeyId: destination.keyId,
    countBefore: pending.length,
    countReEncrypted: moved,
    countRemaining: remaining,
    failures,
    result: remaining === 0 && failures.length === 0 ? ("complete" as const) : ("incomplete" as const),
  });
}

/**
 * How many credentials would become UNREADABLE if this key were removed from the registry.
 *
 * The question an operator is actually asking before deleting a key, and the count that answers it
 * is not "rows naming this key" — it is "rows naming this key THAT STILL HOLD MATERIAL".
 *
 * A DESTROYED ROW STILL RECORDS THE KEY THAT ONCE SEALED IT, and always will: the `key_id` is part
 * of the historical record of how that credential was held. But its ciphertext is the empty string
 * by constraint, so removing the key costs nothing — there is nothing left to decrypt. Counting it
 * would block a key's removal forever on rows that are already gone, and the ceremony would teach
 * operators to ignore its own warning.
 *
 * Returns zero exactly when the key is safe to remove.
 */
export async function countRowsOnKey(
  db: ControlPlaneDatabase,
  keyId: string,
): Promise<number> {
  const rows = await db
    .select({
      id: integrationCredentials.id,
      destroyedAt: integrationCredentials.destroyedAt,
    })
    .from(integrationCredentials)
    .where(eq(integrationCredentials.keyId, keyId));
  return rows.filter((row) => row.destroyedAt === null).length;
}
