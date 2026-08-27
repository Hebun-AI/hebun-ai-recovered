import assert from "node:assert/strict";
import type {
  ApplicationSessionAuthority,
  CanonicalIdentity,
  ProviderAuthentication,
  TenantContext,
} from "../../src/features/auth";
import {
  AuthenticationError,
} from "../../src/features/auth";
import {
  asHumanTenantContext,
  createAuthorizedAuthenticationResult,
} from "../../src/features/auth/server";

const providerAuthentication: ProviderAuthentication = {
  provider: "supabase",
  issuer: "https://identity.example.test",
  subject: "provider-subject",
  authenticatedAt: "2026-07-19T12:00:00.000Z",
  assuranceLevel: "aal2",
  mfaVerified: true,
  providerSessionReferenceHash: "a".repeat(64),
  providerSessionReferenceDigestVersion: 2,
};
const canonicalIdentity: CanonicalIdentity = {
  authIdentityId: "auth-identity-id",
  userId: "user-id",
  provider: "supabase",
  issuer: providerAuthentication.issuer,
  subject: providerAuthentication.subject,
  identityStatus: "active",
  userLifecycleStatus: "active",
};
const applicationSession: ApplicationSessionAuthority = {
  sessionContextId: "session-context-id",
  sessionVersion: 1,
  authIdentityId: canonicalIdentity.authIdentityId,
  userId: canonicalIdentity.userId,
  activeTenantId: "tenant-id",
  activeMembershipId: "membership-id",
  membershipVersion: 3,
  assuranceLevel: providerAuthentication.assuranceLevel,
  mfaVerified: providerAuthentication.mfaVerified,
  authenticatedAt: providerAuthentication.authenticatedAt,
  absoluteExpiresAt: "2026-07-20T12:00:00.000Z",
  inactivityExpiresAt: "2026-07-19T13:00:00.000Z",
};
const tenantContext: TenantContext = asHumanTenantContext({
  tenantId: applicationSession.activeTenantId,
  userId: canonicalIdentity.userId,
  authIdentityId: canonicalIdentity.authIdentityId,
  membershipId: applicationSession.activeMembershipId,
  membershipVersion: applicationSession.membershipVersion,
  roleId: "role-id",
  sessionContextId: applicationSession.sessionContextId,
  provider: providerAuthentication.provider,
  assuranceLevel: providerAuthentication.assuranceLevel,
  mfaVerified: providerAuthentication.mfaVerified,
  requestId: "request-id",
  authenticatedAt: providerAuthentication.authenticatedAt,
});

const now = new Date("2026-07-19T12:30:00.000Z");

function expectFailure(
  input: Parameters<typeof createAuthorizedAuthenticationResult>[0],
  code: AuthenticationError["code"],
): void {
  assert.throws(
    () => createAuthorizedAuthenticationResult(input, now),
    (error: unknown) => error instanceof AuthenticationError && error.code === code,
  );
}

function main(): void {
  const base = {
    providerAuthentication,
    canonicalIdentity,
    applicationSession,
    tenantContext,
  };

  expectFailure({ ...base, canonicalIdentity: { ...canonicalIdentity, userId: "other" } }, "AUTH_IDENTITY_INTEGRITY_FAILURE");
  expectFailure({ ...base, tenantContext: { ...tenantContext, tenantId: "other" } }, "AUTH_IDENTITY_INTEGRITY_FAILURE");
  expectFailure({ ...base, tenantContext: { ...tenantContext, membershipId: "other" } }, "AUTH_IDENTITY_INTEGRITY_FAILURE");
  expectFailure({ ...base, tenantContext: { ...tenantContext, assuranceLevel: "aal1" } }, "AUTH_IDENTITY_INTEGRITY_FAILURE");
  expectFailure({ ...base, tenantContext: { ...tenantContext, authenticatedAt: "2026-07-19T12:01:00.000Z" } }, "AUTH_IDENTITY_INTEGRITY_FAILURE");
  expectFailure({ ...base, applicationSession: { ...applicationSession, sessionVersion: 0 } }, "AUTH_IDENTITY_INTEGRITY_FAILURE");
  expectFailure({ ...base, tenantContext: { ...tenantContext, membershipVersion: 4 } }, "AUTH_IDENTITY_INTEGRITY_FAILURE");
  expectFailure({ ...base, applicationSession: { ...applicationSession, inactivityExpiresAt: now.toISOString() } }, "AUTH_SESSION_CONTEXT_EXPIRED");

  console.log("authorized authentication result checks passed");
}

main();
