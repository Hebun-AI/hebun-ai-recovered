/**
 * Platform Admin access: an active operator grant AND a server-verified MFA on this very session.
 *
 * Design gates: operator principal D1/D2/D6 and the MFA gate (O1). Nothing here reads a request
 * header, cookie, query or body: every input is a session the resolver already authorized from the
 * cookie digest, and every fact is re-read from the database on every call — no cached claim, so a
 * revoked grant or MFA credential cuts access on the very next request.
 *
 * NOT CONSULTED, BY CONSTRUCTION: tenant role (customer, Director, Governance), email address, the
 * shell setting, and any client value. Holding a grant opens nothing without MFA; holding MFA opens
 * nothing without a grant.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  authMfaCredentials,
  platformOperatorGrants,
  userSessionContexts,
} from "@/db/schema";
import type { AuthenticationResult } from "@/features/auth/types/authentication-result";
import type { ConfiguredAuthenticationEnvironment } from "@/features/auth/environment/auth-environment.server";
import { revokeSessionIfActive } from "@/features/auth-runtime/identity-repository.server";
import {
  digestSessionReference,
  generateSessionReference,
} from "@/features/auth-runtime/session-digest.server";
import {
  SESSION_INACTIVITY_TTL_SECONDS,
  resolveSessionFromReference,
} from "@/features/auth-runtime/session-service.server";
import type { EncryptionKeyResolution } from "@/features/secret-encryption/key-registry.server";
import { verifyMfaCode } from "@/features/operator-mfa/mfa-verification.server";
import { writeOperatorAudit } from "@/features/governance-audit/operator-authority-audit.server";

/** O1 — one MFA verification keeps admin open for at most 60 minutes. */
export const ADMIN_MFA_WINDOW_SECONDS = 60 * 60;
export const ADMIN_ASSURANCE_LEVELS: ReadonlySet<string> = new Set([
  "aal2",
  "aal3",
]);

export type AdminMfaState =
  "valid" | "missing" | "expired" | "credential-changed";

export interface AdminStanding {
  readonly grant: boolean;
  readonly mfa: AdminMfaState;
}

type Reader = Pick<ControlPlaneDatabase, "select">;

export async function hasActiveOperatorGrant(
  db: Reader,
  authIdentityId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: platformOperatorGrants.id })
    .from(platformOperatorGrants)
    .where(
      and(
        eq(platformOperatorGrants.authIdentityId, authIdentityId),
        eq(platformOperatorGrants.status, "active"),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Both halves, read fresh from the session row, the grant table and the bound credential. */
export async function readAdminStanding(
  db: Reader,
  session: {
    readonly sessionContextId: string;
    readonly authIdentityId: string;
  },
  now: Date,
): Promise<AdminStanding> {
  const [sessionRows, grant] = await Promise.all([
    db
      .select({
        authIdentityId: userSessionContexts.authIdentityId,
        assuranceLevel: userSessionContexts.assuranceLevel,
        mfaVerified: userSessionContexts.mfaVerified,
        mfaVerifiedAt: userSessionContexts.mfaVerifiedAt,
        mfaCredentialId: userSessionContexts.mfaCredentialId,
      })
      .from(userSessionContexts)
      .where(
        and(
          eq(userSessionContexts.id, session.sessionContextId),
          isNull(userSessionContexts.revokedAt),
        ),
      )
      .limit(1),
    hasActiveOperatorGrant(db, session.authIdentityId),
  ]);
  const row = sessionRows[0];
  if (
    !row ||
    row.authIdentityId !== session.authIdentityId ||
    !row.mfaVerified ||
    !ADMIN_ASSURANCE_LEVELS.has(row.assuranceLevel) ||
    !row.mfaVerifiedAt ||
    !row.mfaCredentialId
  ) {
    return { grant, mfa: "missing" };
  }
  const age = now.getTime() - row.mfaVerifiedAt.getTime();
  if (age < 0 || age > ADMIN_MFA_WINDOW_SECONDS * 1000)
    return { grant, mfa: "expired" };

  const credentials = await db
    .select({
      authIdentityId: authMfaCredentials.authIdentityId,
      status: authMfaCredentials.status,
      activatedAt: authMfaCredentials.activatedAt,
    })
    .from(authMfaCredentials)
    .where(eq(authMfaCredentials.id, row.mfaCredentialId))
    .limit(1);
  const credential = credentials[0];
  if (
    !credential ||
    credential.status !== "active" ||
    credential.authIdentityId !== session.authIdentityId ||
    !credential.activatedAt ||
    credential.activatedAt.getTime() > row.mfaVerifiedAt.getTime()
  ) {
    return { grant, mfa: "credential-changed" };
  }
  return { grant, mfa: "valid" };
}

export interface AdminOperator {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly sessionContextId: string;
}

export type AdminAccess =
  | { readonly status: "granted"; readonly operator: AdminOperator }
  | { readonly status: "unauthenticated" }
  /** No active grant. Says nothing about MFA, and the page reveals nothing about admin. */
  | { readonly status: "forbidden" }
  /** An operator whose session lacks a valid MFA verification: send to the challenge. */
  | {
      readonly status: "mfa-required";
      readonly mfa: Exclude<AdminMfaState, "valid">;
    };

/** Decide admin access for an already-resolved authentication result. Fails closed on any error. */
export async function evaluateAdminAccess(
  db: Reader,
  authentication: AuthenticationResult,
  now: Date,
): Promise<AdminAccess> {
  if (authentication.status !== "authorized")
    return { status: "unauthenticated" };
  const session = authentication.applicationSession;
  let standing: AdminStanding;
  try {
    standing = await readAdminStanding(db, session, now);
  } catch {
    return { status: "forbidden" };
  }
  if (!standing.grant) return { status: "forbidden" };
  if (standing.mfa !== "valid")
    return { status: "mfa-required", mfa: standing.mfa };
  return {
    status: "granted",
    operator: {
      userId: session.userId,
      authIdentityId: session.authIdentityId,
      sessionContextId: session.sessionContextId,
    },
  };
}

export type MfaElevation =
  | {
      readonly status: "elevated";
      readonly reference: string;
      readonly maxAgeSeconds: number;
    }
  | {
      readonly status: "refused";
      readonly reason:
        "no-session" | "forbidden" | "invalid" | "locked" | "superseded";
    };

class ElevationSuperseded extends Error {}

/**
 * The admin MFA challenge (step-up). On a verified code the session is ROTATED: the old reference is
 * revoked and a new row is minted with `aal2`, `mfa_verified`, `mfa_verified_at` and the credential it
 * was verified with — all in one transaction with its audit row. The session's own clocks are
 * inherited (never a fresh eight hours). A refused code is audited as `rejected`, best effort.
 */
export async function elevateSessionWithMfa(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  reference: string,
  code: string,
  input: { readonly requestId: string },
  keys: EncryptionKeyResolution,
  now: Date = new Date(),
): Promise<MfaElevation> {
  const trimmed = reference?.trim();
  if (!trimmed) return { status: "refused", reason: "no-session" };
  const current = await resolveSessionFromReference(
    db,
    env,
    trimmed,
    { requestId: input.requestId },
    now,
  );
  if (current.status !== "authorized")
    return { status: "refused", reason: "no-session" };
  const session = current.applicationSession;

  if (!(await hasActiveOperatorGrant(db, session.authIdentityId))) {
    return { status: "refused", reason: "forbidden" };
  }

  const verification = await verifyMfaCode(
    db,
    { authIdentityId: session.authIdentityId, code, status: "active" },
    keys,
    now,
  );
  if (verification.outcome !== "verified") {
    const refusal =
      verification.outcome === "rejected"
        ? "invalid-code"
        : verification.outcome === "no-credential"
          ? "no-credential"
          : verification.outcome;
    try {
      await writeOperatorAudit(db, {
        actorUserId: session.userId,
        action: "auth.mfa.verify",
        entityType:
          verification.outcome === "no-credential"
            ? "auth_identity"
            : "auth_mfa_credential",
        entityId:
          verification.outcome === "no-credential"
            ? session.authIdentityId
            : verification.credentialId,
        targetAuthIdentityId: session.authIdentityId,
        result: "rejected",
        reason: "admin MFA challenge",
        refusal,
        source: "admin-mfa-challenge",
        sessionContextId: session.sessionContextId,
        requestId: input.requestId,
        occurredAt: now,
      });
    } catch {
      /* A refused attempt changes no state; its audit row is best effort. */
    }
    return {
      status: "refused",
      reason: verification.outcome === "locked" ? "locked" : "invalid",
    };
  }

  const absoluteExpiresAt = new Date(session.absoluteExpiresAt);
  const slid = new Date(now.getTime() + SESSION_INACTIVITY_TTL_SECONDS * 1000);
  const inactivityExpiresAt =
    slid.getTime() > absoluteExpiresAt.getTime() ? absoluteExpiresAt : slid;
  const nextReference = generateSessionReference();
  const key = env.sessionDigestCurrentKey;
  const hash = digestSessionReference(nextReference, key);

  try {
    await db.transaction(async (tx) => {
      const spent = await revokeSessionIfActive(
        tx,
        session.sessionContextId,
        now,
        "mfa-elevated",
      );
      if (!spent) throw new ElevationSuperseded();
      /*
       * The elevated row is written HERE, not through the released `insertSessionContext`: the
       * Identity repository stays byte-for-byte unchanged (principal firewall), and this is the one
       * writer of an `aal2` / MFA-bound session.
       */
      const [inserted] = await tx
        .insert(userSessionContexts)
        .values({
          authIdentityId: session.authIdentityId,
          providerSessionReferenceHash: hash,
          providerSessionReferenceDigestVersion: key.version,
          userId: session.userId,
          activeTenantId: session.activeTenantId,
          activeMembershipId: session.activeMembershipId,
          membershipVersion: session.membershipVersion,
          assuranceLevel: "aal2",
          mfaVerified: true,
          mfaVerifiedAt: now,
          mfaCredentialId: verification.credentialId,
          authenticatedAt: new Date(session.authenticatedAt),
          issuedAt: now,
          lastActivityAt: now,
          absoluteExpiresAt,
          inactivityExpiresAt,
          sessionVersion: 1,
        })
        .returning({ id: userSessionContexts.id });
      const sessionContextId = inserted!.id;
      await writeOperatorAudit(tx, {
        actorUserId: session.userId,
        action: "auth.mfa.verify",
        entityType: "auth_mfa_credential",
        entityId: verification.credentialId,
        targetAuthIdentityId: session.authIdentityId,
        result: "committed",
        reason: "admin MFA challenge",
        previousState: {
          sessionContextId: session.sessionContextId,
          assuranceLevel: session.assuranceLevel,
        },
        nextState: { sessionContextId, assuranceLevel: "aal2" },
        source: "admin-mfa-challenge",
        sessionContextId,
        requestId: input.requestId,
        occurredAt: now,
      });
    });
  } catch (error) {
    if (error instanceof ElevationSuperseded)
      return { status: "refused", reason: "superseded" };
    throw error;
  }

  return {
    status: "elevated",
    reference: nextReference,
    maxAgeSeconds: Math.max(
      1,
      Math.floor((absoluteExpiresAt.getTime() - now.getTime()) / 1000),
    ),
  };
}
