import assert from "node:assert/strict";
import type {
  ApplicationSessionAuthority,
  AuthenticationResult,
  CanonicalIdentity,
  ProviderAuthentication,
  TenantContext,
} from "../../src/features/auth";
import {
  asHumanTenantContext,
  createAuthorizedAuthenticationResult,
  type SupabaseAuthenticationProvider,
} from "../../src/features/auth/server";

const providerAuthentication: ProviderAuthentication = Object.freeze({
  provider: "supabase",
  issuer: "https://identity.example.test",
  subject: "provider-subject",
  verifiedEmail: "director@example.test",
  authenticatedAt: "2026-07-19T12:00:00.000Z",
  assuranceLevel: "aal2",
  mfaVerified: true,
  providerSessionReferenceHash: "a".repeat(64),
  providerSessionReferenceDigestVersion: 2,
});

const canonicalIdentity: CanonicalIdentity = Object.freeze({
  authIdentityId: "auth-identity-id",
  userId: "user-id",
  provider: "supabase",
  issuer: providerAuthentication.issuer,
  subject: providerAuthentication.subject,
  identityStatus: "active",
  userLifecycleStatus: "active",
});

const applicationSession: ApplicationSessionAuthority = Object.freeze({
  sessionContextId: "session-context-id",
  sessionVersion: 1,
  authIdentityId: canonicalIdentity.authIdentityId,
  userId: canonicalIdentity.userId,
  activeTenantId: "tenant-id",
  activeMembershipId: "membership-id",
  membershipVersion: 3,
  assuranceLevel: "aal2",
  mfaVerified: true,
  authenticatedAt: providerAuthentication.authenticatedAt,
  absoluteExpiresAt: "2026-07-20T12:00:00.000Z",
  inactivityExpiresAt: "2026-07-19T13:00:00.000Z",
});

const tenantContext: TenantContext = Object.freeze(asHumanTenantContext({
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
  permissionSummary: Object.freeze(["dashboard.read"]),
  authenticatedAt: providerAuthentication.authenticatedAt,
}));

const result: AuthenticationResult = createAuthorizedAuthenticationResult(
  {
    providerAuthentication,
    canonicalIdentity,
    applicationSession,
    tenantContext,
  },
  new Date("2026-07-19T12:30:00.000Z"),
);

const fakeProvider: SupabaseAuthenticationProvider = {
  provider: "supabase",
  async authenticate() {
    return providerAuthentication;
  },
};

async function main(): Promise<void> {
  assert.equal(result.status, "authorized");
  assert.equal(result.tenantContext.tenantId, "tenant-id");
  assert.equal(result.canonicalIdentity.userId, "user-id");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.providerAuthentication), true);
  assert.equal(Object.isFrozen(result.canonicalIdentity), true);
  assert.equal(Object.isFrozen(result.applicationSession), true);
  assert.equal(Object.isFrozen(result.tenantContext), true);
  assert.equal(Object.isFrozen(result.tenantContext.permissionSummary), true);

  const providerKeys = Object.keys(await fakeProvider.authenticate({
    requestId: "request-id",
    cookies: { get: () => undefined, set: () => undefined },
  }));
  assert.equal(providerKeys.includes("accessToken"), false);
  assert.equal(providerKeys.includes("refreshToken"), false);
  assert.equal(providerKeys.includes("cookie"), false);
  assert.equal(providerKeys.includes("session"), false);

  const expectedStatuses: AuthenticationResult["status"][] = [
    "authorized",
    "unauthenticated",
    "onboarding-required",
    "tenant-selection-required",
    "forbidden",
  ];
  assert.deepEqual(expectedStatuses, [
    "authorized",
    "unauthenticated",
    "onboarding-required",
    "tenant-selection-required",
    "forbidden",
  ]);

  if (false) {
    // @ts-expect-error Authentication evidence is immutable.
    providerAuthentication.subject = "changed";
    // @ts-expect-error Tenant authority is immutable.
    tenantContext.tenantId = "changed";
    // @ts-expect-error Provider metadata is not part of token-free evidence.
    providerAuthentication.metadata = {
      nested: { accessToken: "credential" },
    };
    // @ts-expect-error Authorized results require the server-side factory brand.
    const invalidAuthorizedResult: AuthenticationResult = {
      status: "authorized",
      providerAuthentication,
      canonicalIdentity,
      applicationSession,
      tenantContext,
    };
    void invalidAuthorizedResult;
  }

  console.log("authentication contract checks passed");
}

void main();
