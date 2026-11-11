/**
 * P4 operator authority ceremony — the ONLY writer of operator grants and MFA credentials.
 *
 * Lives under `scripts/` on purpose: `src/` cannot reach it, so the running application has no path
 * that grants, revokes, enrolls or removes operator authority (the provider-connectivity precedent).
 *
 * Every act here (MFA design gate O3):
 *   1. needs a VERIFIED ACTOR — email + password through the released verifier and lockout; and, once
 *      any active operator exists, an active grant plus a valid TOTP code of the actor's own. While no
 *      operator exists the act runs under the BOOTSTRAP rule and is recorded as such. Deployment
 *      possession alone is never an actor.
 *   2. needs a REASON — one line, non-empty.
 *   3. writes its `audit_log` row IN THE SAME TRANSACTION as the change; if the audit insert fails, the
 *      change rolls back.
 * A verified actor whose act is refused gets a `rejected` audit row. Secrets, codes and the
 * `otpauth://` URI never enter a row, a log line or a return value other than `beginMfaEnrollment`'s
 * one-time secret for the terminal.
 *
 * Functions take their inputs as arguments (no prompts) so they can be proven against a disposable
 * database; `scripts/operator.ts` is the interactive shell around them.
 */
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Client } from "pg";
import * as schema from "../../src/db/schema";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import { authIdentities, authMfaCredentials, platformOperatorGrants, users } from "../../src/db/schema";
import {
  recordFailedAttempt,
  recordSuccessfulVerification,
  verifyPasswordCredential,
} from "../../src/features/auth-runtime/credential-repository.server";
import { hasActiveOperatorGrant } from "../../src/features/operator-authority/admin-access.server";
import { writeOperatorAudit, type OperatorAuditRecord } from "../../src/features/governance-audit/operator-authority-audit.server";
import { sealMfaSecret, verifyMfaCode } from "../../src/features/operator-mfa/mfa-verification.server";
import { generateTotpSecret } from "../../src/features/operator-mfa/totp";
import type { EncryptionKeyResolution } from "../../src/features/secret-encryption/key-registry.server";

export const OPERATOR_VERBS = ["grant", "revoke", "mfa-enroll", "mfa-revoke"] as const;
export type OperatorVerb = (typeof OPERATOR_VERBS)[number];
export const MAX_REASON_CHARACTERS = 500;

export function operatorDbFromClient(client: Client): ControlPlaneDatabase {
  return drizzle(client, { schema }) as unknown as ControlPlaneDatabase;
}

export function validateReason(reason: string): boolean {
  const trimmed = reason.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_REASON_CHARACTERS && !/[\r\n]/.test(trimmed);
}

export interface OperatorIdentity {
  readonly authIdentityId: string;
  readonly userId: string;
  readonly email: string;
}

export async function findIdentityByEmail(
  db: ControlPlaneDatabase,
  email: string,
): Promise<OperatorIdentity | undefined> {
  const rows = await db
    .select({ authIdentityId: authIdentities.id, userId: users.id, email: users.email })
    .from(users)
    .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
    .where(
      and(
        sql`lower(${users.email}) = ${email.trim().toLowerCase()}`,
        eq(users.lifecycleStatus, "active"),
        eq(authIdentities.status, "active"),
        eq(authIdentities.lifecycleStatus, "active"),
        sql`${authIdentities.revokedAt} is null`,
      ),
    )
    .orderBy(authIdentities.createdAt)
    .limit(1);
  const row = rows[0];
  return row ? { authIdentityId: row.authIdentityId, userId: row.userId, email: row.email } : undefined;
}

export async function countActiveOperators(db: ControlPlaneDatabase): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(platformOperatorGrants)
    .where(eq(platformOperatorGrants.status, "active"));
  return rows[0]?.count ?? 0;
}

export type ActorVerification =
  | { readonly status: "verified"; readonly actor: OperatorIdentity; readonly bootstrap: boolean }
  | {
      readonly status: "refused";
      readonly reason: "actor-unverified" | "actor-not-operator" | "actor-mfa-required" | "actor-mfa-failed";
      /** Present when the actor's identity was verified, so the refusal can be audited. */
      readonly actor?: OperatorIdentity;
    };

/** Verify the human at the terminal. Never inferred from the environment or the target. */
export async function verifyCeremonyActor(
  db: ControlPlaneDatabase,
  input: { readonly email: string; readonly password: string; readonly code?: string },
  keys: EncryptionKeyResolution,
  now: Date,
): Promise<ActorVerification> {
  const actor = await findIdentityByEmail(db, input.email);
  if (!actor) return { status: "refused", reason: "actor-unverified" };
  const password = await verifyPasswordCredential(db, actor.authIdentityId, input.password, now);
  if (password.outcome === "rejected") await recordFailedAttempt(db, password.credentialId, now);
  if (password.outcome !== "verified") return { status: "refused", reason: "actor-unverified" };
  await recordSuccessfulVerification(db, password.credentialId, now);

  if ((await countActiveOperators(db)) === 0) return { status: "verified", actor, bootstrap: true };
  if (!(await hasActiveOperatorGrant(db, actor.authIdentityId))) {
    return { status: "refused", reason: "actor-not-operator", actor };
  }
  if (!input.code) return { status: "refused", reason: "actor-mfa-required", actor };
  const mfa = await verifyMfaCode(db, { authIdentityId: actor.authIdentityId, code: input.code, status: "active" }, keys, now);
  if (mfa.outcome !== "verified") return { status: "refused", reason: "actor-mfa-failed", actor };
  return { status: "verified", actor, bootstrap: false };
}

/** A verified actor's refused attempt: one `rejected` row, best effort (nothing changed). */
export async function auditRefusal(
  db: ControlPlaneDatabase,
  record: Omit<OperatorAuditRecord, "result" | "source">,
): Promise<void> {
  try {
    await writeOperatorAudit(db, { ...record, result: "rejected", source: "operator-ceremony" });
  } catch {
    /* No state changed; a lost rejection row cannot grant anything. */
  }
}

interface ActAs {
  readonly actor: OperatorIdentity;
  readonly bootstrap: boolean;
  readonly target: OperatorIdentity;
  readonly reason: string;
  readonly now: Date;
}

export type ActOutcome =
  | { readonly status: "done"; readonly entityId: string }
  | { readonly status: "refused"; readonly reason: string };

class Refused extends Error {
  constructor(readonly reason: string) {
    super(reason);
  }
}

async function inTransaction(
  db: ControlPlaneDatabase,
  work: (tx: ControlPlaneDatabase) => Promise<string>,
): Promise<ActOutcome> {
  try {
    const entityId = await db.transaction(async (tx) => work(tx as unknown as ControlPlaneDatabase));
    return { status: "done", entityId };
  } catch (error) {
    if (error instanceof Refused) return { status: "refused", reason: error.reason };
    throw error;
  }
}

export async function grantOperator(db: ControlPlaneDatabase, act: ActAs): Promise<ActOutcome> {
  if (!validateReason(act.reason)) return { status: "refused", reason: "reason-required" };
  return inTransaction(db, async (tx) => {
    if (await hasActiveOperatorGrant(tx, act.target.authIdentityId)) throw new Refused("already-operator");
    const [grant] = await tx
      .insert(platformOperatorGrants)
      .values({
        authIdentityId: act.target.authIdentityId,
        status: "active",
        grantedAt: act.now,
        grantedByUserId: act.actor.userId,
        grantReason: act.reason.trim(),
        createdBy: act.actor.userId,
        createdByType: "human",
      })
      .returning({ id: platformOperatorGrants.id });
    await writeOperatorAudit(tx, {
      actorUserId: act.actor.userId,
      action: "platform.operator.grant",
      entityType: "platform_operator_grant",
      entityId: grant!.id,
      targetAuthIdentityId: act.target.authIdentityId,
      result: "committed",
      reason: act.reason.trim(),
      bootstrap: act.bootstrap,
      previousState: { status: null },
      nextState: { status: "active", grantedAt: act.now.toISOString() },
      source: "operator-ceremony",
      occurredAt: act.now,
    });
    return grant!.id;
  });
}

export async function revokeOperator(db: ControlPlaneDatabase, act: ActAs): Promise<ActOutcome> {
  if (!validateReason(act.reason)) return { status: "refused", reason: "reason-required" };
  return inTransaction(db, async (tx) => {
    const revoked = await tx
      .update(platformOperatorGrants)
      .set({
        status: "revoked",
        revokedAt: act.now,
        revokedByUserId: act.actor.userId,
        revocationReason: act.reason.trim(),
        updatedAt: act.now,
        updatedBy: act.actor.userId,
        updatedByType: "human",
      })
      .where(
        and(
          eq(platformOperatorGrants.authIdentityId, act.target.authIdentityId),
          eq(platformOperatorGrants.status, "active"),
        ),
      )
      .returning({ id: platformOperatorGrants.id });
    if (revoked.length === 0) throw new Refused("not-operator");
    await writeOperatorAudit(tx, {
      actorUserId: act.actor.userId,
      action: "platform.operator.revoke",
      entityType: "platform_operator_grant",
      entityId: revoked[0]!.id,
      targetAuthIdentityId: act.target.authIdentityId,
      result: "committed",
      reason: act.reason.trim(),
      bootstrap: act.bootstrap,
      previousState: { status: "active" },
      nextState: { status: "revoked", revokedAt: act.now.toISOString() },
      source: "operator-ceremony",
      occurredAt: act.now,
    });
    return revoked[0]!.id;
  });
}

export type EnrollmentStart =
  | {
      readonly status: "started";
      readonly credentialId: string;
      /** For the terminal ONCE (the `otpauth://` URI). Never logged, stored in clear, or audited. */
      readonly secret: string;
    }
  | { readonly status: "refused"; readonly reason: "keys-unavailable" };

/**
 * Create a PENDING credential for the target. Pending authorizes nothing: only `completeMfaEnrollment`
 * — after a correct first code, with its audit row — makes it active. Earlier abandoned pending rows of
 * the same identity are closed first.
 */
export async function beginMfaEnrollment(
  db: ControlPlaneDatabase,
  input: { readonly target: OperatorIdentity; readonly actor: OperatorIdentity; readonly now: Date },
  keys: EncryptionKeyResolution,
): Promise<EnrollmentStart> {
  if (keys.status !== "configured") return { status: "refused", reason: "keys-unavailable" };
  const credentialId = randomUUID();
  const secret = generateTotpSecret();
  const sealed = sealMfaSecret(credentialId, secret, keys);
  await db.transaction(async (tx) => {
    await tx
      .update(authMfaCredentials)
      .set({ status: "revoked", revokedAt: input.now, revocationReason: "abandoned-enrollment", updatedAt: input.now })
      .where(
        and(
          eq(authMfaCredentials.authIdentityId, input.target.authIdentityId),
          eq(authMfaCredentials.status, "pending"),
        ),
      );
    await tx.insert(authMfaCredentials).values({
      id: credentialId,
      authIdentityId: input.target.authIdentityId,
      method: "totp",
      status: "pending",
      sealAlgorithm: sealed.algorithm,
      sealKeyId: sealed.keyId,
      sealCiphertext: sealed.ciphertext,
      sealIv: sealed.iv,
      sealAuthTag: sealed.authTag,
      createdBy: input.actor.userId,
      createdByType: "human",
    });
  });
  return { status: "started", credentialId, secret };
}

/** Activate the pending credential after its first correct code; supersedes any active one. */
export async function completeMfaEnrollment(
  db: ControlPlaneDatabase,
  act: ActAs & { readonly credentialId: string; readonly code: string },
  keys: EncryptionKeyResolution,
): Promise<ActOutcome> {
  if (!validateReason(act.reason)) return { status: "refused", reason: "reason-required" };
  const first = await verifyMfaCode(
    db,
    { authIdentityId: act.target.authIdentityId, code: act.code, status: "pending", credentialId: act.credentialId },
    keys,
    act.now,
  );
  if (first.outcome !== "verified") return { status: "refused", reason: `first-code-${first.outcome}` };
  return inTransaction(db, async (tx) => {
    const superseded = await tx
      .update(authMfaCredentials)
      .set({ status: "revoked", revokedAt: act.now, revocationReason: "superseded", updatedAt: act.now })
      .where(
        and(
          eq(authMfaCredentials.authIdentityId, act.target.authIdentityId),
          eq(authMfaCredentials.status, "active"),
        ),
      )
      .returning({ id: authMfaCredentials.id });
    const activated = await tx
      .update(authMfaCredentials)
      .set({ status: "active", activatedAt: act.now, updatedAt: act.now, updatedBy: act.actor.userId, updatedByType: "human" })
      .where(and(eq(authMfaCredentials.id, act.credentialId), eq(authMfaCredentials.status, "pending")))
      .returning({ id: authMfaCredentials.id });
    if (activated.length === 0) throw new Refused("enrollment-superseded");
    await writeOperatorAudit(tx, {
      actorUserId: act.actor.userId,
      action: "auth.mfa.enroll",
      entityType: "auth_mfa_credential",
      entityId: act.credentialId,
      targetAuthIdentityId: act.target.authIdentityId,
      result: "committed",
      reason: act.reason.trim(),
      bootstrap: act.bootstrap,
      previousState: { activeCredentialId: superseded[0]?.id ?? null },
      nextState: { activeCredentialId: act.credentialId, activatedAt: act.now.toISOString() },
      source: "operator-ceremony",
      occurredAt: act.now,
    });
    return act.credentialId;
  });
}

/** Revoke the target's active MFA credential (removal, or the first half of recovery — O4). */
export async function revokeMfa(db: ControlPlaneDatabase, act: ActAs): Promise<ActOutcome> {
  if (!validateReason(act.reason)) return { status: "refused", reason: "reason-required" };
  return inTransaction(db, async (tx) => {
    const revoked = await tx
      .update(authMfaCredentials)
      .set({
        status: "revoked",
        revokedAt: act.now,
        revocationReason: "revoked-by-ceremony",
        updatedAt: act.now,
        updatedBy: act.actor.userId,
        updatedByType: "human",
      })
      .where(
        and(
          eq(authMfaCredentials.authIdentityId, act.target.authIdentityId),
          eq(authMfaCredentials.status, "active"),
        ),
      )
      .returning({ id: authMfaCredentials.id });
    if (revoked.length === 0) throw new Refused("no-active-mfa");
    await writeOperatorAudit(tx, {
      actorUserId: act.actor.userId,
      action: "auth.mfa.revoke",
      entityType: "auth_mfa_credential",
      entityId: revoked[0]!.id,
      targetAuthIdentityId: act.target.authIdentityId,
      result: "committed",
      reason: act.reason.trim(),
      bootstrap: act.bootstrap,
      previousState: { status: "active" },
      nextState: { status: "revoked", revokedAt: act.now.toISOString() },
      source: "operator-ceremony",
      occurredAt: act.now,
    });
    return revoked[0]!.id;
  });
}
