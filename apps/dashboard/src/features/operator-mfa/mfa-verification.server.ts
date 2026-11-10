/**
 * Verify a TOTP code against an identity's MFA credential — replay-proof and lockout-bound.
 *
 * WHAT THIS MODULE MAY WRITE: only the verification counters of an MFA credential
 * (`last_accepted_step`, `failed_attempt_count`, `locked_until`). It never creates, activates or
 * revokes a credential and never touches an operator grant; those are ceremony acts
 * (`scripts/lib/operator-authority.ts`), audited in the same transaction.
 *
 * SECRETS. The sealed secret is opened inside `verifyMfaCode` and dropped there. Nothing this module
 * returns, throws or logs carries the secret or a code.
 */
import { and, eq, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { authMfaCredentials } from "@/db/schema";
import {
  openSecret,
  sealSecret,
  type SealedSecret,
} from "@/features/secret-encryption/authenticated-encryption.server";
import {
  activeKeyOf,
  keyForRow,
  resolveEncryptionKeys,
  type ConfiguredEncryptionKeys,
  type EncryptionKeyResolution,
} from "@/features/secret-encryption/key-registry.server";
import { matchTotpStep } from "./totp";

/** The MFA key set (O2) — separate from the integration-credential keys. */
export const MFA_ENCRYPTION_ENV_KEYS = {
  keys: "HEBUN_MFA_ENCRYPTION_KEYS",
  additionalKeys: "HEBUN_MFA_ENCRYPTION_KEYS_ADDITIONAL",
  activeKeyId: "HEBUN_MFA_ENCRYPTION_ACTIVE_KEY_ID",
} as const;

export const MFA_FAILED_ATTEMPT_THRESHOLD = 5;
export const MFA_LOCKOUT_SECONDS = 15 * 60;

export function resolveMfaEncryptionKeys(
  env: Readonly<Record<string, string | undefined>> = process.env,
): EncryptionKeyResolution {
  return resolveEncryptionKeys(MFA_ENCRYPTION_ENV_KEYS, env);
}

/** The AAD binds a sealed secret to its own credential row, so it cannot be moved to another. */
function aadFor(credentialId: string): Buffer {
  return Buffer.from(`hebun-mfa-totp:v1:${credentialId}`, "utf8");
}

export function sealMfaSecret(
  credentialId: string,
  secretBase32: string,
  keys: ConfiguredEncryptionKeys,
): SealedSecret {
  return sealSecret(secretBase32, activeKeyOf(keys), aadFor(credentialId));
}

type MfaWriter = Pick<ControlPlaneDatabase, "select" | "update">;

export type MfaVerification =
  | { readonly outcome: "no-credential" }
  | { readonly outcome: "locked"; readonly credentialId: string }
  | { readonly outcome: "rejected"; readonly credentialId: string }
  /** The code was right but its step was already used — a replay. Not counted as a failure. */
  | { readonly outcome: "replayed"; readonly credentialId: string }
  | { readonly outcome: "unavailable"; readonly credentialId: string }
  | { readonly outcome: "verified"; readonly credentialId: string; readonly step: number };

/**
 * Verify `code` against the identity's credential in `status` (`active` for a challenge, `pending`
 * only for the enrollment ceremony's first code).
 */
export async function verifyMfaCode(
  db: MfaWriter,
  input: {
    readonly authIdentityId: string;
    readonly code: string;
    readonly status: "active" | "pending";
    /** Restrict to one credential (the enrollment ceremony's own pending row). */
    readonly credentialId?: string;
  },
  keys: EncryptionKeyResolution,
  now: Date,
): Promise<MfaVerification> {
  const rows = await db
    .select({
      id: authMfaCredentials.id,
      sealAlgorithm: authMfaCredentials.sealAlgorithm,
      sealKeyId: authMfaCredentials.sealKeyId,
      sealCiphertext: authMfaCredentials.sealCiphertext,
      sealIv: authMfaCredentials.sealIv,
      sealAuthTag: authMfaCredentials.sealAuthTag,
      lockedUntil: authMfaCredentials.lockedUntil,
    })
    .from(authMfaCredentials)
    .where(
      and(
        eq(authMfaCredentials.authIdentityId, input.authIdentityId),
        eq(authMfaCredentials.status, input.status),
        ...(input.credentialId ? [eq(authMfaCredentials.id, input.credentialId)] : []),
      ),
    )
    .limit(1);
  const row = rows[0];
  if (!row) return { outcome: "no-credential" };
  const credentialId = row.id;

  if (row.lockedUntil !== null && row.lockedUntil.getTime() > now.getTime()) {
    return { outcome: "locked", credentialId };
  }
  if (keys.status !== "configured") return { outcome: "unavailable", credentialId };
  const key = keyForRow(keys, row.sealKeyId);
  if (!key || row.sealAlgorithm !== "aes-256-gcm") return { outcome: "unavailable", credentialId };

  const opened = openSecret(
    {
      algorithm: "aes-256-gcm",
      keyId: row.sealKeyId,
      ciphertext: row.sealCiphertext,
      iv: row.sealIv,
      authTag: row.sealAuthTag,
    },
    key,
    aadFor(credentialId),
  );
  if (!opened.ok) return { outcome: "unavailable", credentialId };

  const step = matchTotpStep(opened.plaintext, input.code, now);
  if (step === null) {
    /* One statement: concurrent wrong codes cannot each read the same count. */
    const lockUntil = new Date(now.getTime() + MFA_LOCKOUT_SECONDS * 1000);
    await db
      .update(authMfaCredentials)
      .set({
        failedAttemptCount: sql`${authMfaCredentials.failedAttemptCount} + 1`,
        lockedUntil: sql`case when ${authMfaCredentials.failedAttemptCount} + 1 >= ${MFA_FAILED_ATTEMPT_THRESHOLD} then ${lockUntil.toISOString()}::timestamptz else ${authMfaCredentials.lockedUntil} end`,
        updatedAt: now,
      })
      .where(eq(authMfaCredentials.id, credentialId));
    return { outcome: "rejected", credentialId };
  }

  /*
   * REPLAY GUARD, ATOMIC. The step is accepted only if it is strictly later than every step ever
   * accepted on this credential, and only while the row is still in the expected status and unlocked.
   * Zero rows updated means a replay (or a race that another request won) — refused either way.
   */
  const accepted = await db
    .update(authMfaCredentials)
    .set({ lastAcceptedStep: step, failedAttemptCount: 0, lockedUntil: null, updatedAt: now })
    .where(
      and(
        eq(authMfaCredentials.id, credentialId),
        eq(authMfaCredentials.status, input.status),
        sql`${authMfaCredentials.lastAcceptedStep} < ${step}`,
        sql`(${authMfaCredentials.lockedUntil} is null or ${authMfaCredentials.lockedUntil} <= ${now.toISOString()}::timestamptz)`,
      ),
    )
    .returning({ id: authMfaCredentials.id });
  if (accepted.length === 0) return { outcome: "replayed", credentialId };
  return { outcome: "verified", credentialId, step };
}
