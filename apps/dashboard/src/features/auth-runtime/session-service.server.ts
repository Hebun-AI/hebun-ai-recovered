/*
 * Session service (server-only, pure of request/cookie concerns).
 *
 * This is the concrete implementation of the previously contract-only auth
 * authority. It:
 *  - issues a durable session (writes user_session_contexts, keyed digest),
 *  - resolves an opaque reference back to an authorized TenantContext,
 *  - re-validates identity / membership / tenant on every resolve (fail closed),
 *  - routes the final assembly through the existing integrity gate
 *    `createAuthorizedAuthenticationResult`.
 *
 * No next/headers here so it is unit-testable; the thin cookie wrappers live in
 * request-session.server.ts.
 */

import type { ControlPlaneDatabase } from "@/db/client.server";
import type { ConfiguredAuthenticationEnvironment } from "@/features/auth/environment/auth-environment.server";
import { AuthenticationError } from "@/features/auth/errors";
import { createAuthorizedAuthenticationResult } from "@/features/auth/services/authorized-authentication-result.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import type {
  ApplicationSessionAuthority,
  AuthenticationResult,
  CanonicalIdentity,
  ProviderAuthentication,
} from "@/features/auth/types";
import {
  digestSessionReference,
  generateSessionReference,
} from "./session-digest.server";
import {
  recordFailedAttempt,
  recordSuccessfulVerification,
  spendEquivalentCredentialWork,
  verifyPasswordCredential,
} from "./credential-repository.server";
import {
  findActiveLocalIdentityByEmail,
  findPrimaryActiveMembership,
  findSessionByDigest,
  insertSessionContext,
  revokeSession,
  touchSessionActivity,
  type SessionResolutionRow,
} from "./identity-repository.server";

export const SESSION_INACTIVITY_TTL_SECONDS = 30 * 60; // 30 minutes
export const SESSION_ABSOLUTE_TTL_SECONDS = 8 * 60 * 60; // 8 hours
export const SESSION_ASSURANCE_LEVEL = "aal1";

const ACTIVE_TENANT_STATUSES = new Set(["active"]);

/**
 * Server-side-only classification of why a sign-in failed.
 *
 * The CLIENT never sees this. `no-identity`, `no-credential`, `bad-password` and
 * `locked` all return the same `unauthenticated / invalid` result, because any
 * externally visible difference between them is an account-enumeration oracle.
 * This field exists so the server can still tell them apart in diagnostics.
 */
export type SignInDiagnostic =
  | "ok"
  | "no-identity"
  | "no-credential"
  | "bad-password"
  | "locked"
  | "no-membership"
  | "tenant-inactive";

export interface IssuedLocalSession {
  readonly reference: string;
  readonly maxAgeSeconds: number;
  readonly result: AuthenticationResult;
  /** Server-only. Never returned to a client — see SignInDiagnostic. */
  readonly diagnostic: SignInDiagnostic;
}

/** The single user-facing sign-in refusal. One shape for every failure cause. */
function signInRefused(diagnostic: SignInDiagnostic): IssuedLocalSession {
  return {
    reference: "",
    maxAgeSeconds: 0,
    result: { status: "unauthenticated", reason: "invalid" },
    diagnostic,
  };
}

function unauthenticated(
  reason: "missing" | "invalid" | "expired",
): AuthenticationResult {
  return { status: "unauthenticated", reason };
}

function forbidden(
  reason: "identity" | "user" | "membership" | "tenant" | "session" | "assurance",
): AuthenticationResult {
  return { status: "forbidden", reason };
}

/**
 * Sign in a human with email + password, and on success issue a durable session.
 *
 * THE ORDER IS THE SECURITY PROPERTY. No session material is generated until a
 * credential has actually been verified:
 *
 *   1. resolve the local identity for the email
 *   2. load its ACTIVE password credential
 *   3. refuse if that credential is temporarily locked
 *   4. verify the password with scrypt, in constant time
 *   5. resolve membership / tenant (authorization, deliberately AFTER step 4)
 *   6. mint a fresh opaque session reference
 *
 * Steps 1-3 all spend the same scrypt work as step 4 before returning, so a
 * missing identity, a missing credential and a wrong password are
 * indistinguishable from outside in both body and timing.
 *
 * Membership and tenant are resolved but NOT granted here: this function never
 * creates a membership, never chooses a role, and never upgrades one. It only
 * refuses to issue a session for a human who has no usable place to be.
 *
 * Does NOT touch cookies — the caller (a server action) sets it.
 */
export async function issueLocalSession(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  input: {
    readonly email: string;
    readonly password: string;
    readonly requestId: string;
  },
  now: Date = new Date(),
): Promise<IssuedLocalSession> {
  const password = typeof input.password === "string" ? input.password : "";

  const identity = await findActiveLocalIdentityByEmail(db, input.email.trim());
  if (!identity) {
    // Spend the same work a real check costs, so an unknown email is not
    // detectable by how quickly it is refused.
    await spendEquivalentCredentialWork(password);
    return signInRefused("no-identity");
  }

  // The credential authority checks the password and returns only a verdict.
  // No salt or hash crosses this boundary, so nothing here can leak one.
  const verification = await verifyPasswordCredential(
    db,
    identity.authIdentityId,
    password,
    now,
  );

  if (verification.outcome === "no-credential") {
    // No credential, or the only one is revoked. Externally identical to a wrong
    // password: an identity without a usable credential must not be discoverable.
    return signInRefused("no-credential");
  }
  if (verification.outcome === "locked") {
    return signInRefused("locked");
  }
  if (verification.outcome === "rejected") {
    await recordFailedAttempt(db, verification.credentialId, now);
    return signInRefused("bad-password");
  }

  // Verified. Clear the failure state before anything else can fail — a human who
  // proved their password must not keep a penalty because their tenant is inactive.
  await recordSuccessfulVerification(db, verification.credentialId, now);

  const membership = await findPrimaryActiveMembership(db, identity.userId);
  if (!membership) {
    return {
      reference: "",
      maxAgeSeconds: 0,
      result: forbidden("membership"),
      diagnostic: "no-membership",
    };
  }
  if (
    membership.companyLifecycleStatus !== "active" ||
    (membership.companyTenantStatus !== null &&
      !ACTIVE_TENANT_STATUSES.has(membership.companyTenantStatus)) ||
    membership.companyAuthenticationDisabled
  ) {
    return {
      reference: "",
      maxAgeSeconds: 0,
      result: forbidden("tenant"),
      diagnostic: "tenant-inactive",
    };
  }
  if (!membership.roleId) {
    return {
      reference: "",
      maxAgeSeconds: 0,
      result: forbidden("membership"),
      diagnostic: "no-membership",
    };
  }

  const reference = generateSessionReference();
  const key = env.sessionDigestCurrentKey;
  const hash = digestSessionReference(reference, key);
  const authenticatedAt = now;
  const inactivityExpiresAt = new Date(
    now.getTime() + SESSION_INACTIVITY_TTL_SECONDS * 1000,
  );
  const absoluteExpiresAt = new Date(
    now.getTime() + SESSION_ABSOLUTE_TTL_SECONDS * 1000,
  );

  const sessionContextId = await insertSessionContext(db, {
    authIdentityId: identity.authIdentityId,
    providerSessionReferenceHash: hash,
    providerSessionReferenceDigestVersion: key.version,
    userId: identity.userId,
    activeTenantId: membership.tenantId,
    activeMembershipId: membership.membershipId,
    membershipVersion: membership.membershipVersion,
    assuranceLevel: SESSION_ASSURANCE_LEVEL,
    mfaVerified: false,
    authenticatedAt,
    issuedAt: authenticatedAt,
    lastActivityAt: authenticatedAt,
    absoluteExpiresAt,
    inactivityExpiresAt,
  });

  const result = assembleAuthorized({
    row: {
      sessionContextId,
      sessionVersion: 1,
      authIdentityId: identity.authIdentityId,
      userId: identity.userId,
      activeTenantId: membership.tenantId,
      activeMembershipId: membership.membershipId,
      sessionMembershipVersion: membership.membershipVersion,
      assuranceLevel: SESSION_ASSURANCE_LEVEL,
      mfaVerified: false,
      authenticatedAt,
      issuedAt: authenticatedAt,
      lastActivityAt: authenticatedAt,
      absoluteExpiresAt,
      inactivityExpiresAt,
      revokedAt: null,
      identityStatus: "active",
      identityProvider: identity.provider,
      identityIssuer: identity.issuer,
      identitySubject: identity.subject,
      userLifecycleStatus: "active",
      membershipStatus: "active",
      membershipCurrentVersion: membership.membershipVersion,
      membershipRevokedAt: null,
      membershipRoleId: membership.roleId,
      companyLifecycleStatus: membership.companyLifecycleStatus,
      companyTenantStatus: membership.companyTenantStatus,
      companyAuthenticationDisabledAt: null,
    },
    digestVersion: key.version,
    digestHash: hash,
    requestId: input.requestId,
    now,
  });

  return {
    reference,
    maxAgeSeconds: SESSION_ABSOLUTE_TTL_SECONDS,
    result,
    diagnostic: "ok",
  };
}

/**
 * Resolve an opaque session reference to an AuthenticationResult. Tries the
 * current digest key, then the previous (rotation), then re-validates the live
 * identity / membership / tenant. Fails closed on every anomaly.
 */
export async function resolveSessionFromReference(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  reference: string,
  input: { readonly requestId: string; readonly correlationId?: string },
  now: Date = new Date(),
): Promise<AuthenticationResult> {
  const trimmed = reference?.trim();
  if (!trimmed) return unauthenticated("missing");

  const keys = [env.sessionDigestCurrentKey];
  if (env.sessionDigestPreviousKey) keys.push(env.sessionDigestPreviousKey);

  let match: { row: SessionResolutionRow; version: number; hash: string } | undefined;
  for (const key of keys) {
    const hash = digestSessionReference(trimmed, key);
    const row = await findSessionByDigest(db, key.version, hash);
    if (row) {
      match = { row, version: key.version, hash };
      break;
    }
  }
  if (!match) return unauthenticated("invalid");

  const { row } = match;
  if (
    now.getTime() >= row.inactivityExpiresAt.getTime() ||
    now.getTime() >= row.absoluteExpiresAt.getTime()
  ) {
    return unauthenticated("expired");
  }
  if (!row.activeTenantId || !row.activeMembershipId) return forbidden("tenant");
  if (row.identityStatus !== "active") return forbidden("identity");
  if (row.userLifecycleStatus !== "active") return forbidden("user");
  if (
    row.membershipStatus !== "active" ||
    row.membershipRevokedAt !== null ||
    row.membershipRoleId === null
  ) {
    return forbidden("membership");
  }
  if (
    row.sessionMembershipVersion === null ||
    row.membershipCurrentVersion === null ||
    row.sessionMembershipVersion !== row.membershipCurrentVersion
  ) {
    return forbidden("membership");
  }
  if (
    row.companyLifecycleStatus !== "active" ||
    (row.companyTenantStatus !== null &&
      !ACTIVE_TENANT_STATUSES.has(row.companyTenantStatus)) ||
    row.companyAuthenticationDisabledAt !== null
  ) {
    return forbidden("tenant");
  }

  const result = assembleAuthorized({
    row,
    digestVersion: match.version,
    digestHash: match.hash,
    requestId: input.requestId,
    correlationId: input.correlationId,
    now,
  });

  if (result.status === "authorized") {
    // Slide the inactivity window forward. Best effort — never blocks the request.
    const nextInactivity = new Date(
      now.getTime() + SESSION_INACTIVITY_TTL_SECONDS * 1000,
    );
    const boundedInactivity =
      nextInactivity.getTime() > row.absoluteExpiresAt.getTime()
        ? row.absoluteExpiresAt
        : nextInactivity;
    try {
      await touchSessionActivity(
        db,
        row.sessionContextId,
        now,
        boundedInactivity,
      );
    } catch {
      // A failed activity touch must not deny an otherwise valid session.
    }
  }

  return result;
}

/**
 * Revoke the session behind a reference (logout). Best-effort lookup across the
 * current and previous digest keys; returns true when a row was revoked.
 */
export async function revokeSessionByReference(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  reference: string,
  reason: string = "logout",
  now: Date = new Date(),
): Promise<boolean> {
  const trimmed = reference?.trim();
  if (!trimmed) return false;
  const keys = [env.sessionDigestCurrentKey];
  if (env.sessionDigestPreviousKey) keys.push(env.sessionDigestPreviousKey);
  for (const key of keys) {
    const hash = digestSessionReference(trimmed, key);
    const row = await findSessionByDigest(db, key.version, hash);
    if (row) {
      await revokeSession(db, row.sessionContextId, now, reason);
      return true;
    }
  }
  return false;
}

interface AssembleInput {
  readonly row: SessionResolutionRow;
  readonly digestVersion: number;
  readonly digestHash: string;
  readonly requestId: string;
  readonly correlationId?: string;
  readonly now: Date;
}

/** Build the four authority objects and run them through the integrity gate. */
function assembleAuthorized(input: AssembleInput): AuthenticationResult {
  const { row } = input;
  const provider = row.identityProvider!;
  const issuer = row.identityIssuer!;
  const subject = row.identitySubject!;
  const authenticatedAt = row.authenticatedAt.toISOString();
  const absoluteExpiresAt = row.absoluteExpiresAt.toISOString();
  const inactivityExpiresAt = row.inactivityExpiresAt.toISOString();
  const tenantId = row.activeTenantId!;
  const membershipId = row.activeMembershipId!;
  const membershipVersion = row.sessionMembershipVersion!;

  const providerAuthentication: ProviderAuthentication = {
    provider,
    issuer,
    subject,
    authenticatedAt,
    assuranceLevel: "aal1",
    mfaVerified: row.mfaVerified,
    providerSessionReferenceHash: input.digestHash,
    providerSessionReferenceDigestVersion: input.digestVersion,
  };
  const canonicalIdentity: CanonicalIdentity = {
    authIdentityId: row.authIdentityId,
    userId: row.userId,
    provider,
    issuer,
    subject,
    identityStatus: "active",
    userLifecycleStatus: "active",
  };
  const applicationSession: ApplicationSessionAuthority = {
    sessionContextId: row.sessionContextId,
    sessionVersion: row.sessionVersion,
    authIdentityId: row.authIdentityId,
    userId: row.userId,
    activeTenantId: tenantId,
    activeMembershipId: membershipId,
    membershipVersion,
    assuranceLevel: "aal1",
    mfaVerified: row.mfaVerified,
    authenticatedAt,
    absoluteExpiresAt,
    inactivityExpiresAt,
  };
  const tenantContext: TenantContext = {
    tenantId,
    userId: row.userId,
    authIdentityId: row.authIdentityId,
    membershipId,
    membershipVersion,
    roleId: row.membershipRoleId!,
    sessionContextId: row.sessionContextId,
    provider,
    assuranceLevel: "aal1",
    mfaVerified: row.mfaVerified,
    requestId: input.requestId,
    correlationId: input.correlationId,
    authenticatedAt,
  };

  try {
    return createAuthorizedAuthenticationResult(
      {
        providerAuthentication,
        canonicalIdentity,
        applicationSession,
        tenantContext,
      },
      input.now,
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      if (error.code === "AUTH_SESSION_CONTEXT_EXPIRED") {
        return unauthenticated("expired");
      }
      return forbidden("session");
    }
    throw error;
  }
}
