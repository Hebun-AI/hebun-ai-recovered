/*
 * Credential control-plane repository (server-only, durable).
 *
 * The ONLY module permitted to read `auth_credentials.salt` / `.secret_hash`.
 * Everything it returns to a caller outside this file is either non-secret state
 * or a boolean; the secret-bearing shape never leaves the verification path. A
 * structural test asserts no other module selects those columns.
 *
 * LOCKOUT lives here rather than in memory because Postgres is the only state
 * every server process shares. A process-local counter would be a protection the
 * second process does not honour, which is worse than none: it would read as a
 * control while failing open.
 *
 * Lockout is TEMPORARY and bounded. Repeated failure delays a human; it never
 * destroys their account, and `locked_until` always names an explicit instant.
 */

import { and, eq, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { authCredentials } from "@/db/schema";
import {
  CURRENT_SCRYPT_PARAMS,
  PASSWORD_ALGORITHM_SCRYPT,
  verifyPassword,
  type PasswordHashRecord,
  type ScryptParams,
} from "./password-hash.server";

/** Failures tolerated before a credential is temporarily locked. */
export const CREDENTIAL_FAILED_ATTEMPT_THRESHOLD = 5;
/** How long a lockout lasts. Deterministic — no backoff curve, no jitter. */
export const CREDENTIAL_LOCKOUT_SECONDS = 15 * 60;

/**
 * Secret-bearing row. Module-private BY DESIGN: it never leaves this file, is
 * never serialized and never logged. It exists only long enough for
 * `verifyPasswordCredential` to compare against it and drop it.
 */
interface CredentialVerificationRow {
  readonly credentialId: string;
  readonly authIdentityId: string;
  readonly algorithm: string;
  readonly params: ScryptParams;
  readonly salt: string;
  readonly secretHash: string;
  readonly status: string;
  readonly failedAttemptCount: number;
  readonly lockedUntil: Date | null;
}

export interface CredentialInsert {
  readonly authIdentityId: string;
  readonly algorithm: string;
  readonly params: ScryptParams;
  readonly salt: string;
  readonly secretHash: string;
}

/*
 * A fixed, deliberately unmatchable record used to spend the SAME scrypt work
 * when there is no identity or no credential to check against.
 *
 * Without it an unknown email answers in ~1 ms while a known one costs ~230 ms,
 * and that gap is a working account-enumeration oracle however identical the
 * response body is. Verifying against this can never succeed: its hash is zeroes.
 */
const TIMING_EQUALIZER: PasswordHashRecord = Object.freeze({
  algorithm: PASSWORD_ALGORITHM_SCRYPT,
  params: CURRENT_SCRYPT_PARAMS,
  salt: "0".repeat(64),
  secretHash: "0".repeat(128),
});

/**
 * Spend one scrypt derivation and discard the answer, so a caller that has
 * nothing to verify still costs what verifying costs. Always fails internally.
 */
export async function spendEquivalentCredentialWork(
  password: string,
): Promise<void> {
  await verifyPassword(password.length > 0 ? password : " ", TIMING_EQUALIZER);
}

/** What checking a password against the credential authority concluded. */
export type CredentialVerification =
  /** No active credential exists. Externally identical to a wrong password. */
  | { readonly outcome: "no-credential" }
  /** A real credential, temporarily locked. The password was NOT considered. */
  | { readonly outcome: "locked"; readonly credentialId: string }
  /** A real, unlocked credential — and the password did not match it. */
  | { readonly outcome: "rejected"; readonly credentialId: string }
  /** A real, unlocked credential, and the password matched. */
  | { readonly outcome: "verified"; readonly credentialId: string };

/**
 * Check a password against an identity's active credential.
 *
 * THIS IS THE ONLY PLACE `salt` / `secret_hash` ARE EVER HELD. The row is loaded,
 * compared, and discarded inside this function; nothing secret-bearing is
 * returned, so no caller — not the session service, not a server action — can
 * leak, log or forward credential material it never receives.
 *
 * Every branch costs one scrypt derivation, so "no credential", "locked" and
 * "wrong password" are indistinguishable by timing as well as by value.
 */
export async function verifyPasswordCredential(
  db: ControlPlaneDatabase,
  authIdentityId: string,
  password: string,
  now: Date,
): Promise<CredentialVerification> {
  const credential = await findActivePasswordCredential(db, authIdentityId);
  if (!credential) {
    await spendEquivalentCredentialWork(password);
    return { outcome: "no-credential" };
  }

  if (isCredentialLocked(credential, now)) {
    // A locked credential refuses even the CORRECT password until it expires.
    await spendEquivalentCredentialWork(password);
    return { outcome: "locked", credentialId: credential.credentialId };
  }

  const matched = await verifyPassword(password, {
    algorithm: credential.algorithm,
    params: credential.params,
    salt: credential.salt,
    secretHash: credential.secretHash,
  });

  return matched
    ? { outcome: "verified", credentialId: credential.credentialId }
    : { outcome: "rejected", credentialId: credential.credentialId };
}

/**
 * Load the ACTIVE password credential for an identity.
 *
 * Module-private: the returned row carries secret material, so it must not
 * escape this file. Callers use `verifyPasswordCredential` instead.
 *
 * Returns undefined when the identity has no credential or its credential is
 * revoked — both are treated exactly like a wrong password, so the two are
 * indistinguishable from outside.
 */
async function findActivePasswordCredential(
  db: ControlPlaneDatabase,
  authIdentityId: string,
): Promise<CredentialVerificationRow | undefined> {
  const rows = await db
    .select({
      credentialId: authCredentials.id,
      authIdentityId: authCredentials.authIdentityId,
      algorithm: authCredentials.algorithm,
      params: authCredentials.params,
      salt: authCredentials.salt,
      secretHash: authCredentials.secretHash,
      status: authCredentials.status,
      failedAttemptCount: authCredentials.failedAttemptCount,
      lockedUntil: authCredentials.lockedUntil,
    })
    .from(authCredentials)
    .where(
      and(
        eq(authCredentials.authIdentityId, authIdentityId),
        eq(authCredentials.credentialType, "password"),
        eq(authCredentials.status, "active"),
        eq(authCredentials.lifecycleStatus, "active"),
      ),
    )
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;
  return {
    ...row,
    params: row.params as ScryptParams,
    salt: row.salt.trim(),
    secretHash: row.secretHash.trim(),
  };
}

/** True when the credential is locked at `now`. An absent lock is not a lock. */
function isCredentialLocked(
  row: Pick<CredentialVerificationRow, "lockedUntil">,
  now: Date,
): boolean {
  return row.lockedUntil !== null && row.lockedUntil.getTime() > now.getTime();
}

/**
 * Record a failed verification. Increments durably and, on crossing the
 * threshold, sets an explicit `locked_until`.
 *
 * The increment and the threshold test happen in ONE statement so two concurrent
 * wrong-password attempts cannot both read the same count and each write
 * `threshold - 1`. The database decides the new value from the stored one.
 */
export async function recordFailedAttempt(
  db: ControlPlaneDatabase,
  credentialId: string,
  now: Date,
): Promise<void> {
  const lockUntil = new Date(now.getTime() + CREDENTIAL_LOCKOUT_SECONDS * 1000);
  await db
    .update(authCredentials)
    .set({
      failedAttemptCount: sql`${authCredentials.failedAttemptCount} + 1`,
      lockedUntil: sql`case
        when ${authCredentials.failedAttemptCount} + 1 >= ${CREDENTIAL_FAILED_ATTEMPT_THRESHOLD}
        then ${lockUntil.toISOString()}::timestamptz
        else ${authCredentials.lockedUntil}
      end`,
      updatedAt: now,
    })
    .where(eq(authCredentials.id, credentialId));
}

/**
 * Record a successful verification: clear the failure state and stamp the time.
 * Success normalizes the credential — a human who remembers their password is
 * not carrying a penalty from last week.
 */
export async function recordSuccessfulVerification(
  db: ControlPlaneDatabase,
  credentialId: string,
  now: Date,
): Promise<void> {
  await db
    .update(authCredentials)
    .set({
      failedAttemptCount: 0,
      lockedUntil: null,
      lastVerifiedAt: now,
      updatedAt: now,
    })
    .where(eq(authCredentials.id, credentialId));
}

/**
 * Create an active password credential for an identity.
 *
 * Provisioning only — there is no product surface that calls this in D1. The
 * partial unique index guarantees a second ACTIVE password credential for the
 * same identity fails at the database rather than racing.
 */
export async function insertPasswordCredential(
  db: ControlPlaneDatabase,
  input: CredentialInsert,
  now: Date = new Date(),
): Promise<string> {
  const rows = await db
    .insert(authCredentials)
    .values({
      authIdentityId: input.authIdentityId,
      credentialType: "password",
      algorithm: input.algorithm,
      params: input.params,
      salt: input.salt,
      secretHash: input.secretHash,
      status: "active",
      passwordChangedAt: now,
      failedAttemptCount: 0,
    })
    .returning({ id: authCredentials.id });
  return rows[0]!.id;
}

/**
 * Revoke a credential. Durable and terminal for that row: a revoked credential
 * can never authenticate again, and the schema requires it to say why.
 * Deliberately not a delete — the record that a credential existed survives.
 */
export async function revokeCredential(
  db: ControlPlaneDatabase,
  credentialId: string,
  reason: string,
  now: Date = new Date(),
): Promise<void> {
  await db
    .update(authCredentials)
    .set({
      status: "revoked",
      revokedAt: now,
      revocationReason: reason,
      updatedAt: now,
    })
    .where(eq(authCredentials.id, credentialId));
}
