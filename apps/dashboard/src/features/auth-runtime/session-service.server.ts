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
import {
  asHumanTenantContext,
  type TenantContext,
  type TenantContextFields,
} from "@/features/auth/tenant/tenant-context";
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
  ACTIVE_TENANT_STATUSES,
  findActiveLocalIdentityByEmail,
  findActiveMemberships,
  findMembershipForUser,
  findPrimaryActiveMembership,
  findSessionByDigest,
  findTenantCandidates,
  insertSessionContext,
  revokeSession,
  revokeSessionIfActive,
  touchSessionActivity,
  type MembershipResolution,
  type SessionResolutionRow,
  type TenantCandidate,
} from "./identity-repository.server";

export const SESSION_INACTIVITY_TTL_SECONDS = 30 * 60; // 30 minutes
export const SESSION_ABSOLUTE_TTL_SECONDS = 8 * 60 * 60; // 8 hours
export const SESSION_ASSURANCE_LEVEL = "aal1";

/**
 * How long a PRE-TENANT receipt lives. Deliberately short: it is a half-finished sign-in, not a
 * working session. An abandoned workspace picker should stop being a cookie worth stealing quickly,
 * and ten minutes is long enough to read a list and click.
 */
export const PRE_TENANT_SESSION_TTL_SECONDS = 10 * 60; // 10 minutes

/*
 * `ACTIVE_TENANT_STATUSES` now comes from the identity repository, which owns every read of
 * `companies` lifecycle state. It was a private constant here while this file was the only asker;
 * R4B gave the pre-tenant onboarding flows the same question, and one definition is what keeps the
 * two enforcement points from drifting apart. The set is unchanged — `{"active"}` — and so are all
 * four gates below.
 */

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
  | "tenant-inactive"
  /**
   * The credential was proven and the human holds MORE THAN ONE active membership, so no tenant can
   * be resolved without asking. Unlike the four authentication failures above, this one IS visible
   * to the client — it is not a failure and it reveals nothing about anybody else's account.
   */
  | "tenant-selection-required";

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

  /*
   * ── ZERO / ONE / MANY ──────────────────────────────────────────────────────
   *
   * Credential verification answered WHO. How many places they may work is a separate question, and
   * `findPrimaryActiveMembership` could only ever answer it for one. The list is read here, and the
   * three outcomes the `AuthenticationResult` contract has always declared become reachable:
   *
   *   0  → `onboarding-required`        a verified human who belongs nowhere yet
   *   1  → `authorized`                 UNCHANGED — the same row, the same session, no regression
   *   2+ → `tenant-selection-required`  the human chooses; the server never guesses
   *
   * The 1-membership path deliberately still calls `findPrimaryActiveMembership`, so the behaviour
   * every existing test asserts is produced by the same function it always was.
   */
  const memberships = await findActiveMemberships(db, identity.userId);
  if (memberships.length !== 1) {
    return issuePreTenantSession(db, env, identity, memberships, now);
  }

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
 * Issue a PRE-TENANT receipt: the credential is proven, the active tenant is not yet decided.
 *
 * WHAT THIS ROW IS NOT. It carries no tenant and no membership, so `assembleAuthorized` is never
 * called for it, no `TenantContext` can be built from it, `resolveTenantContext()` returns null, the
 * dashboard gate refuses it (`status !== "authorized"`), and every governed server action refuses a
 * null tenant. It authorizes nothing. Its only power is to let the workspace picker know who is
 * choosing, without asking for the password a second time.
 *
 * The row shape has always been legal — `user_session_contexts_tenant_membership_chk` permits both
 * columns NULL and the composite foreign key is MATCH SIMPLE. Nothing had ever written one.
 */
async function issuePreTenantSession(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  identity: {
    readonly userId: string;
    readonly authIdentityId: string;
    readonly provider: string;
    readonly issuer: string;
    readonly subject: string;
  },
  memberships: readonly MembershipResolution[],
  now: Date,
): Promise<IssuedLocalSession> {
  const reference = generateSessionReference();
  const key = env.sessionDigestCurrentKey;
  const hash = digestSessionReference(reference, key);
  const expiresAt = new Date(now.getTime() + PRE_TENANT_SESSION_TTL_SECONDS * 1000);

  await insertSessionContext(db, {
    authIdentityId: identity.authIdentityId,
    providerSessionReferenceHash: hash,
    providerSessionReferenceDigestVersion: key.version,
    userId: identity.userId,
    activeTenantId: null,
    activeMembershipId: null,
    membershipVersion: null,
    assuranceLevel: SESSION_ASSURANCE_LEVEL,
    mfaVerified: false,
    authenticatedAt: now,
    issuedAt: now,
    lastActivityAt: now,
    absoluteExpiresAt: expiresAt,
    inactivityExpiresAt: expiresAt,
  });

  const providerAuthentication: ProviderAuthentication = {
    provider: identity.provider,
    issuer: identity.issuer,
    subject: identity.subject,
    authenticatedAt: now.toISOString(),
    assuranceLevel: "aal1",
    mfaVerified: false,
    providerSessionReferenceHash: hash,
    providerSessionReferenceDigestVersion: key.version,
  };

  if (memberships.length === 0) {
    return {
      reference,
      maxAgeSeconds: PRE_TENANT_SESSION_TTL_SECONDS,
      result: { status: "onboarding-required", providerAuthentication },
      diagnostic: "no-membership",
    };
  }

  return {
    reference,
    maxAgeSeconds: PRE_TENANT_SESSION_TTL_SECONDS,
    result: {
      status: "tenant-selection-required",
      canonicalIdentity: {
        authIdentityId: identity.authIdentityId,
        userId: identity.userId,
        provider: identity.provider,
        issuer: identity.issuer,
        subject: identity.subject,
        identityStatus: "active",
        userLifecycleStatus: "active",
      },
      /* Derived here, from live rows. A client can neither supply nor extend this list. */
      eligibleTenantIds: memberships.map((entry) => entry.tenantId),
    },
    diagnostic: "tenant-selection-required",
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
  if (row.identityStatus !== "active") return forbidden("identity");
  if (row.userLifecycleStatus !== "active") return forbidden("user");

  /*
   * A PRE-TENANT receipt. It is not `forbidden` — the human proved their credential and simply has
   * not chosen yet — but it is emphatically not `authorized` either, so the dashboard gate still
   * refuses it and no `TenantContext` exists. The candidates are re-derived from LIVE rows on every
   * resolve, so a membership revoked while the picker was open disappears from it immediately.
   */
  if (!row.activeTenantId || !row.activeMembershipId) {
    const candidates = await findActiveMemberships(db, row.userId);
    if (candidates.length === 0) {
      return {
        status: "onboarding-required",
        providerAuthentication: preTenantProviderAuthentication(row, match.version, match.hash),
      };
    }
    return {
      status: "tenant-selection-required",
      canonicalIdentity: {
        authIdentityId: row.authIdentityId,
        userId: row.userId,
        provider: row.identityProvider!,
        issuer: row.identityIssuer!,
        subject: row.identitySubject!,
        identityStatus: "active",
        userLifecycleStatus: "active",
      },
      eligibleTenantIds: candidates.map((entry) => entry.tenantId),
    };
  }
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

/** Provider evidence for a pre-tenant receipt, built from the row that already exists. */
function preTenantProviderAuthentication(
  row: SessionResolutionRow,
  digestVersion: number,
  digestHash: string,
): ProviderAuthentication {
  return {
    provider: row.identityProvider!,
    issuer: row.identityIssuer!,
    subject: row.identitySubject!,
    authenticatedAt: row.authenticatedAt.toISOString(),
    assuranceLevel: "aal1",
    mfaVerified: row.mfaVerified,
    providerSessionReferenceHash: digestHash,
    providerSessionReferenceDigestVersion: digestVersion,
  };
}

/** Why a tenant selection was refused. The client never learns which membership exists. */
export type TenantSelectionRefusal =
  /** No usable pre-tenant receipt: missing, expired, revoked, or already tenant-bound. */
  | "no-selection-context"
  /**
   * The named membership is not a live entitlement of THIS human. Deliberately one reason for
   * "never existed", "belongs to somebody else", "revoked", "no role" and "tenant disabled" — any
   * difference between them would let a guessed uuid probe the membership table.
   */
  | "membership-unavailable";

export type TenantSelectionOutcome =
  | {
      readonly status: "selected";
      /** A FRESH reference. The pre-tenant one is revoked and can never be used again. */
      readonly reference: string;
      readonly maxAgeSeconds: number;
      readonly result: AuthenticationResult;
    }
  | { readonly status: "refused"; readonly reason: TenantSelectionRefusal };

/**
 * Turn a pre-tenant receipt into a tenant-bound session for ONE chosen membership.
 *
 * ── SELECTION IS NOT AUTHORIZATION. REVALIDATION IS. ─────────────────────────
 *
 * The membership id arrives from a client that was shown a list some moments ago. Everything in
 * that list may since have changed, so NOTHING from it is trusted:
 *
 *   1. the human is re-resolved from the durable pre-tenant row, never from input;
 *   2. the membership is re-read BY ID **AND** by that human's `user_id`, so another human's
 *      entitlement resolves to nothing;
 *   3. status, lifecycle, revocation and role are re-checked from the row just read;
 *   4. the tenant's own lifecycle and authentication posture are re-checked;
 *   5. `membership_version` is taken from the row read NOW, so the session can never carry a stale
 *      version — the resolver would reject it on the very next request anyway.
 *
 * ── A FRESH SESSION, NOT A MUTATED ONE ───────────────────────────────────────
 *
 * Nothing in this repository has ever changed a session's tenant after issuance: the only writers
 * are an activity touch and a revocation. A session is an authentication receipt, and rewriting
 * which tenant a receipt was for would destroy its provenance and invite confused-deputy behaviour.
 * So a NEW reference is minted, a NEW row is written, and the pre-tenant row is revoked — the old
 * cookie is dead the instant the new one exists.
 */
export async function selectTenantForSession(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  reference: string,
  input: { readonly membershipId: string; readonly requestId: string },
  now: Date = new Date(),
): Promise<TenantSelectionOutcome> {
  const trimmed = reference?.trim();
  if (!trimmed) return { status: "refused", reason: "no-selection-context" };

  const keys = [env.sessionDigestCurrentKey];
  if (env.sessionDigestPreviousKey) keys.push(env.sessionDigestPreviousKey);

  let current: SessionResolutionRow | undefined;
  for (const key of keys) {
    const row = await findSessionByDigest(db, key.version, digestSessionReference(trimmed, key));
    if (row) {
      current = row;
      break;
    }
  }
  if (!current) return { status: "refused", reason: "no-selection-context" };

  /* Expired, or already tenant-bound: neither is a selection context. */
  if (
    now.getTime() >= current.inactivityExpiresAt.getTime() ||
    now.getTime() >= current.absoluteExpiresAt.getTime() ||
    current.activeTenantId !== null ||
    current.activeMembershipId !== null ||
    current.identityStatus !== "active" ||
    current.userLifecycleStatus !== "active"
  ) {
    return { status: "refused", reason: "no-selection-context" };
  }

  /* THE REVALIDATION. By id AND by the authenticated human, together. */
  const membershipId = typeof input?.membershipId === "string" ? input.membershipId.trim() : "";
  if (!membershipId) return { status: "refused", reason: "membership-unavailable" };
  const membership = await findMembershipForUser(db, current.userId, membershipId);
  if (!membership || !membership.roleId) {
    return { status: "refused", reason: "membership-unavailable" };
  }
  if (
    membership.companyLifecycleStatus !== "active" ||
    (membership.companyTenantStatus !== null &&
      !ACTIVE_TENANT_STATUSES.has(membership.companyTenantStatus)) ||
    membership.companyAuthenticationDisabled
  ) {
    return { status: "refused", reason: "membership-unavailable" };
  }

  /* A fresh receipt, bound to exactly what was just revalidated. */
  const nextReference = generateSessionReference();
  const key = env.sessionDigestCurrentKey;
  const hash = digestSessionReference(nextReference, key);
  const inactivityExpiresAt = new Date(now.getTime() + SESSION_INACTIVITY_TTL_SECONDS * 1000);
  const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_TTL_SECONDS * 1000);

  const sessionContextId = await insertSessionContext(db, {
    authIdentityId: current.authIdentityId,
    providerSessionReferenceHash: hash,
    providerSessionReferenceDigestVersion: key.version,
    userId: current.userId,
    activeTenantId: membership.tenantId,
    activeMembershipId: membership.membershipId,
    membershipVersion: membership.membershipVersion,
    assuranceLevel: SESSION_ASSURANCE_LEVEL,
    mfaVerified: false,
    authenticatedAt: current.authenticatedAt,
    issuedAt: now,
    lastActivityAt: now,
    absoluteExpiresAt,
    inactivityExpiresAt,
  });

  /*
   * The pre-tenant receipt dies here. Revoked AFTER the new row exists, so a failure at insert time
   * leaves the human holding a still-usable picker rather than nothing at all.
   */
  await revokeSession(db, current.sessionContextId, now, "tenant-selected");

  const result = assembleAuthorized({
    row: {
      sessionContextId,
      sessionVersion: 1,
      authIdentityId: current.authIdentityId,
      userId: current.userId,
      activeTenantId: membership.tenantId,
      activeMembershipId: membership.membershipId,
      sessionMembershipVersion: membership.membershipVersion,
      assuranceLevel: SESSION_ASSURANCE_LEVEL,
      mfaVerified: false,
      authenticatedAt: current.authenticatedAt,
      issuedAt: now,
      lastActivityAt: now,
      absoluteExpiresAt,
      inactivityExpiresAt,
      revokedAt: null,
      identityStatus: "active",
      identityProvider: current.identityProvider,
      identityIssuer: current.identityIssuer,
      identitySubject: current.identitySubject,
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
    status: "selected",
    reference: nextReference,
    maxAgeSeconds: SESSION_ABSOLUTE_TTL_SECONDS,
    result,
  };
}

/**
 * The workspaces this pre-tenant receipt may choose between.
 *
 * Read-only, and derived entirely from the durable row: the caller supplies a cookie reference and
 * nothing else, so it cannot widen its own list. Returns an empty list rather than an error when the
 * receipt is unusable, because a picker that cannot say who it belongs to has nothing to show.
 */
export async function readSelectableWorkspaces(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  reference: string,
  now: Date = new Date(),
): Promise<readonly TenantCandidate[]> {
  const trimmed = reference?.trim();
  if (!trimmed) return [];
  const keys = [env.sessionDigestCurrentKey];
  if (env.sessionDigestPreviousKey) keys.push(env.sessionDigestPreviousKey);
  for (const key of keys) {
    const row = await findSessionByDigest(db, key.version, digestSessionReference(trimmed, key));
    if (!row) continue;
    if (
      now.getTime() >= row.absoluteExpiresAt.getTime() ||
      row.activeTenantId !== null ||
      row.identityStatus !== "active" ||
      row.userLifecycleStatus !== "active"
    ) {
      return [];
    }
    return findTenantCandidates(db, row.userId);
  }
  return [];
}

/* ── POST-LOGIN TENANT SWITCHING ─────────────────────────────────────────────────────────────────
 *
 * The MIRROR IMAGE of tenant selection, and deliberately a separate entry point.
 *
 * `selectTenantForSession` refuses a tenant-bound receipt, and keeps refusing it: it is reachable
 * from `/login/select-workspace`, which lives beneath the one public route prefix, so widening it
 * would make an already-authorized session re-pointable through a public surface. The precondition
 * here is the exact opposite — a session that is authorized RIGHT NOW — so it gets its own function
 * and its own refusals, while sharing the one revalidation reader and the one assembly path.
 *
 * WHAT A SWITCH IS NOT. It grants nothing: no membership, no role, no authority, no new identity,
 * no invitation. It changes which of a human's EXISTING entitlements this browser is currently
 * acting under, and nothing else.
 */

/** Why a workspace switch was refused. The client never learns which membership exists. */
export type TenantSwitchRefusal =
  /** No session that may switch: missing, expired, revoked, forbidden, or still pre-tenant. */
  | "no-active-session"
  /** Deliberately one reason for every way the target is not a live entitlement of this human. */
  | "membership-unavailable"
  /** The target IS the workspace this session is already in. */
  | "already-active"
  /** A concurrent switch or sign-out spent this session first. Nothing was changed. */
  | "switch-superseded";

export type TenantSwitchOutcome =
  | {
      readonly status: "switched";
      /** A FRESH reference. The session that authorized the switch is revoked and is already dead. */
      readonly reference: string;
      readonly maxAgeSeconds: number;
      readonly result: AuthenticationResult;
    }
  | { readonly status: "refused"; readonly reason: TenantSwitchRefusal };

/** Raised inside the transaction when another switch (or a sign-out) spent this session first. */
class SwitchSuperseded extends Error {}

/**
 * The workspaces an ALREADY-AUTHORIZED session may move to, including the one it is in.
 *
 * The current workspace is included on purpose: a switcher that hid it could not say where the human
 * is, and "which one am I in" is the first thing such a control has to answer. Selecting it is
 * refused as `already-active`, so including it grants nothing.
 *
 * Derived entirely from the durable session: the caller supplies a cookie reference and nothing
 * else, so it cannot widen its own list. Returns an empty list rather than an error when the session
 * is not authorized — a control that cannot say who it belongs to has nothing to show.
 */
export async function readSwitchableWorkspaces(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  reference: string,
  input: { readonly requestId: string },
  now: Date = new Date(),
): Promise<readonly TenantCandidate[]> {
  const trimmed = reference?.trim();
  if (!trimmed) return [];
  const current = await resolveSessionFromReference(db, env, trimmed, input, now);
  if (current.status !== "authorized") return [];
  return findTenantCandidates(db, current.applicationSession.userId);
}

/**
 * Move an AUTHORIZED session from the tenant it is in to ONE other membership the human holds.
 *
 * ── THE CALLER'S AUTHORITY IS THE SESSION, AND IT IS CHECKED BY THE RESOLVER ──
 *
 * The current session is validated by `resolveSessionFromReference` — the exact function every
 * request uses — rather than by a second set of predicates written here. So "authorized enough to
 * switch" cannot drift from "authorized enough to act": a session whose membership was revoked, whose
 * version moved, or whose tenant was disabled is `forbidden` to the rest of the product and is
 * refused here too. A pre-tenant receipt is not authorized either, so it cannot reach this path.
 *
 * ── SWITCHING IS NOT AUTHORIZATION. REVALIDATION IS. ─────────────────────────
 *
 * The membership id arrives from a client that was shown a list some moments ago, and NOTHING in it
 * is trusted. The human is taken from the resolved session, never from input; the membership is
 * re-read BY ID **AND** by that human's `user_id`; status, lifecycle, revocation and role are
 * re-checked from the row just read; the target tenant's own lifecycle and authentication posture
 * are re-checked; and `membership_version` is taken from the row read NOW.
 *
 * ── ONE TRANSACTION, AND THE OLD SESSION IS SPENT INSIDE IT ──────────────────
 *
 * Authority is never mutated in place — the same rule initial selection follows. But unlike initial
 * selection, the revoke here is CONDITIONAL and comes FIRST, inside the transaction that mints the
 * replacement:
 *
 *   - conditional, so two concurrent switches produce exactly ONE new session. The loser's update
 *     matches zero rows, it raises, and its insert unwinds — no orphan session, no second cookie.
 *   - first, so the row lock is taken on the session two switches contend for.
 *   - in one transaction, so a failure at insert time cannot leave a human signed out for pressing
 *     a button. Either the switch happened or nothing did.
 *
 * ── THE CLOCK IS CARRIED OVER, NOT RESTARTED ─────────────────────────────────
 *
 * `authenticated_at` and `absolute_expires_at` come from the session being replaced. A switch proves
 * no credential, so it must not extend how long one authentication is good for; restarting the
 * absolute window on every switch would turn it into an inactivity window with extra steps. Only the
 * inactivity window slides, and it is bounded by the absolute expiry it may never pass.
 */
export async function switchTenantForSession(
  db: ControlPlaneDatabase,
  env: ConfiguredAuthenticationEnvironment,
  reference: string,
  input: { readonly membershipId: string; readonly requestId: string },
  now: Date = new Date(),
): Promise<TenantSwitchOutcome> {
  const trimmed = reference?.trim();
  if (!trimmed) return { status: "refused", reason: "no-active-session" };

  /* THE CALLER'S AUTHORITY, judged by the one function that judges it everywhere else. */
  const current = await resolveSessionFromReference(
    db,
    env,
    trimmed,
    { requestId: input.requestId },
    now,
  );
  if (current.status !== "authorized") {
    return { status: "refused", reason: "no-active-session" };
  }
  const session = current.applicationSession;

  const membershipId = typeof input?.membershipId === "string" ? input.membershipId.trim() : "";
  if (!membershipId) return { status: "refused", reason: "membership-unavailable" };

  /*
   * ALREADY THERE. Checked before anything is read, and answered plainly: this client was told which
   * workspace it is in, so naming it back reveals nothing. Minting a second session for the same
   * tenant would rotate the reference and slide the clock for no reason at all.
   */
  if (membershipId === session.activeMembershipId) {
    return { status: "refused", reason: "already-active" };
  }

  /* THE REVALIDATION. By id AND by the authenticated human, together. */
  const membership = await findMembershipForUser(db, session.userId, membershipId);
  if (!membership || !membership.roleId) {
    return { status: "refused", reason: "membership-unavailable" };
  }
  if (
    membership.companyLifecycleStatus !== "active" ||
    (membership.companyTenantStatus !== null &&
      !ACTIVE_TENANT_STATUSES.has(membership.companyTenantStatus)) ||
    membership.companyAuthenticationDisabled
  ) {
    return { status: "refused", reason: "membership-unavailable" };
  }

  /* The clock the replacement inherits. Never a fresh eight hours. */
  const authenticatedAt = new Date(session.authenticatedAt);
  const absoluteExpiresAt = new Date(session.absoluteExpiresAt);
  const slidInactivity = new Date(now.getTime() + SESSION_INACTIVITY_TTL_SECONDS * 1000);
  const inactivityExpiresAt =
    slidInactivity.getTime() > absoluteExpiresAt.getTime() ? absoluteExpiresAt : slidInactivity;

  const nextReference = generateSessionReference();
  const key = env.sessionDigestCurrentKey;
  const hash = digestSessionReference(nextReference, key);

  let sessionContextId: string;
  try {
    sessionContextId = await db.transaction(async (tx) => {
      /*
       * SPEND THE CURRENT SESSION, CONDITIONALLY AND FIRST. Zero rows means a concurrent switch or a
       * sign-out got here first, and the abort unwinds the insert below with it.
       */
      const spent = await revokeSessionIfActive(
        tx,
        session.sessionContextId,
        now,
        "tenant-switched",
      );
      if (!spent) throw new SwitchSuperseded();

      return insertSessionContext(tx, {
        authIdentityId: session.authIdentityId,
        providerSessionReferenceHash: hash,
        providerSessionReferenceDigestVersion: key.version,
        userId: session.userId,
        activeTenantId: membership.tenantId,
        activeMembershipId: membership.membershipId,
        membershipVersion: membership.membershipVersion,
        assuranceLevel: SESSION_ASSURANCE_LEVEL,
        mfaVerified: session.mfaVerified,
        authenticatedAt,
        issuedAt: now,
        lastActivityAt: now,
        absoluteExpiresAt,
        inactivityExpiresAt,
      });
    });
  } catch (error) {
    if (error instanceof SwitchSuperseded) {
      return { status: "refused", reason: "switch-superseded" };
    }
    throw error;
  }

  const result = assembleAuthorized({
    row: {
      sessionContextId,
      sessionVersion: 1,
      authIdentityId: session.authIdentityId,
      userId: session.userId,
      activeTenantId: membership.tenantId,
      activeMembershipId: membership.membershipId,
      sessionMembershipVersion: membership.membershipVersion,
      assuranceLevel: SESSION_ASSURANCE_LEVEL,
      mfaVerified: session.mfaVerified,
      authenticatedAt,
      issuedAt: now,
      lastActivityAt: now,
      absoluteExpiresAt,
      inactivityExpiresAt,
      revokedAt: null,
      identityStatus: "active",
      identityProvider: current.canonicalIdentity.provider,
      identityIssuer: current.canonicalIdentity.issuer,
      identitySubject: current.canonicalIdentity.subject,
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

  /* The cookie must not outlive the receipt it carries. */
  const remainingSeconds = Math.max(
    1,
    Math.floor((absoluteExpiresAt.getTime() - now.getTime()) / 1000),
  );

  return {
    status: "switched",
    reference: nextReference,
    maxAgeSeconds: remainingSeconds,
    result,
  };
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
  /*
   * THE ONE PLACE AN AUTHORIZED HUMAN AUTHORITY PROJECTION IS MINTED.
   *
   * Everything above this line is what earns it: a live `auth_identities` row, a live `users` row,
   * a live membership for THIS human in THIS tenant, and a non-null `role_id` on that membership.
   * A caller holding a pre-tenant receipt never reaches here — that path returns
   * `onboarding-required` or `tenant-selection-required` and mints nothing.
   *
   * The fields are built as `TenantContextFields` so every one of them is still type-checked
   * individually; `asHumanTenantContext` then applies the nominal human marker. Building the object
   * as a `TenantContext` literal is no longer possible, and that is the point: the marker names a
   * symbol no other module can reach, so no other module can forge this value.
   */
  const tenantContextFields: TenantContextFields = {
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
  const tenantContext: TenantContext = asHumanTenantContext(tenantContextFields);

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
