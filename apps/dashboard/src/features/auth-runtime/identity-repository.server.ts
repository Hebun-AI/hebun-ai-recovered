/*
 * Identity + session control-plane repository (server-only, durable).
 *
 * Pure data access over the authored Drizzle schema. No cookie / request
 * concerns live here — the session service composes these calls. Every read that
 * feeds authorization returns the raw status fields so the service can fail
 * closed with a precise reason (identity / membership / tenant / session).
 */

import { and, asc, eq, isNull } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  authIdentities,
  companies,
  memberships,
  roles,
  users,
  userSessionContexts,
} from "@/db/schema";

export interface LocalIdentityRow {
  readonly userId: string;
  readonly authIdentityId: string;
  readonly provider: string;
  readonly issuer: string;
  readonly subject: string;
  readonly email: string;
}

export interface MembershipResolution {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly membershipVersion: number;
  readonly roleId: string | null;
  readonly companyLifecycleStatus: string;
  readonly companyTenantStatus: string | null;
  readonly companyAuthenticationDisabled: boolean;
}

export interface SessionContextInsert {
  readonly authIdentityId: string;
  readonly providerSessionReferenceHash: string;
  readonly providerSessionReferenceDigestVersion: number;
  readonly userId: string;
  readonly activeTenantId: string;
  readonly activeMembershipId: string;
  readonly membershipVersion: number;
  readonly assuranceLevel: string;
  readonly mfaVerified: boolean;
  readonly authenticatedAt: Date;
  readonly issuedAt: Date;
  readonly lastActivityAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly inactivityExpiresAt: Date;
}

export interface SessionResolutionRow {
  readonly sessionContextId: string;
  readonly sessionVersion: number;
  readonly authIdentityId: string;
  readonly userId: string;
  readonly activeTenantId: string | null;
  readonly activeMembershipId: string | null;
  readonly sessionMembershipVersion: number | null;
  readonly assuranceLevel: string;
  readonly mfaVerified: boolean;
  readonly authenticatedAt: Date;
  readonly issuedAt: Date;
  readonly lastActivityAt: Date;
  readonly absoluteExpiresAt: Date;
  readonly inactivityExpiresAt: Date;
  readonly revokedAt: Date | null;
  // Live re-validation of the identity / membership / tenant behind the session.
  readonly identityStatus: string | null;
  readonly identityProvider: string | null;
  readonly identityIssuer: string | null;
  readonly identitySubject: string | null;
  readonly userLifecycleStatus: string | null;
  readonly membershipStatus: string | null;
  readonly membershipCurrentVersion: number | null;
  readonly membershipRevokedAt: Date | null;
  readonly membershipRoleId: string | null;
  readonly companyLifecycleStatus: string | null;
  readonly companyTenantStatus: string | null;
  readonly companyAuthenticationDisabledAt: Date | null;
}

/** Find the active, verified local identity for an email (sign-in resolution). */
export async function findActiveLocalIdentityByEmail(
  db: ControlPlaneDatabase,
  email: string,
): Promise<LocalIdentityRow | undefined> {
  const rows = await db
    .select({
      userId: users.id,
      authIdentityId: authIdentities.id,
      provider: authIdentities.provider,
      issuer: authIdentities.issuer,
      subject: authIdentities.subject,
      email: users.email,
    })
    .from(users)
    .innerJoin(authIdentities, eq(authIdentities.userId, users.id))
    .where(
      and(
        eq(users.email, email),
        eq(users.lifecycleStatus, "active"),
        eq(authIdentities.provider, "local"),
        eq(authIdentities.status, "active"),
        eq(authIdentities.lifecycleStatus, "active"),
        isNull(authIdentities.revokedAt),
      ),
    )
    .orderBy(asc(authIdentities.createdAt), asc(authIdentities.id))
    .limit(1);
  return rows[0];
}

/**
 * Resolve the single active membership (and its tenant) for a user. R1 pilot:
 * exactly one active membership is expected; the first deterministic active row
 * is chosen. Tenant-selection across multiple memberships is out of R1 scope.
 */
export async function findPrimaryActiveMembership(
  db: ControlPlaneDatabase,
  userId: string,
): Promise<MembershipResolution | undefined> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      tenantId: memberships.tenantId,
      membershipVersion: memberships.version,
      roleId: memberships.roleId,
      companyLifecycleStatus: companies.lifecycleStatus,
      companyTenantStatus: companies.tenantStatus,
      companyAuthenticationDisabledAt: companies.authenticationDisabledAt,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.tenantId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.status, "active"),
        eq(memberships.lifecycleStatus, "active"),
        isNull(memberships.revokedAt),
      ),
    )
    .orderBy(asc(memberships.createdAt), asc(memberships.id))
    .limit(1);
  const row = rows[0];
  if (!row) return undefined;
  return {
    membershipId: row.membershipId,
    tenantId: row.tenantId,
    membershipVersion: row.membershipVersion,
    roleId: row.roleId,
    companyLifecycleStatus: row.companyLifecycleStatus,
    companyTenantStatus: row.companyTenantStatus,
    companyAuthenticationDisabled: row.companyAuthenticationDisabledAt !== null,
  };
}

/** Insert a durable session context row; returns its generated id. */
export async function insertSessionContext(
  db: ControlPlaneDatabase,
  input: SessionContextInsert,
): Promise<string> {
  const inserted = await db
    .insert(userSessionContexts)
    .values({
      authIdentityId: input.authIdentityId,
      providerSessionReferenceHash: input.providerSessionReferenceHash,
      providerSessionReferenceDigestVersion:
        input.providerSessionReferenceDigestVersion,
      userId: input.userId,
      activeTenantId: input.activeTenantId,
      activeMembershipId: input.activeMembershipId,
      membershipVersion: input.membershipVersion,
      sessionVersion: 1,
      assuranceLevel: input.assuranceLevel,
      mfaVerified: input.mfaVerified,
      authenticatedAt: input.authenticatedAt,
      issuedAt: input.issuedAt,
      lastActivityAt: input.lastActivityAt,
      absoluteExpiresAt: input.absoluteExpiresAt,
      inactivityExpiresAt: input.inactivityExpiresAt,
    })
    .returning({ id: userSessionContexts.id });
  return inserted[0]!.id;
}

/**
 * Load a non-revoked session by (digest version, digest hash) together with the
 * live identity / membership / tenant fields required to re-authorize it.
 */
export async function findSessionByDigest(
  db: ControlPlaneDatabase,
  digestVersion: number,
  digestHash: string,
): Promise<SessionResolutionRow | undefined> {
  const rows = await db
    .select({
      sessionContextId: userSessionContexts.id,
      sessionVersion: userSessionContexts.sessionVersion,
      authIdentityId: userSessionContexts.authIdentityId,
      userId: userSessionContexts.userId,
      activeTenantId: userSessionContexts.activeTenantId,
      activeMembershipId: userSessionContexts.activeMembershipId,
      sessionMembershipVersion: userSessionContexts.membershipVersion,
      assuranceLevel: userSessionContexts.assuranceLevel,
      mfaVerified: userSessionContexts.mfaVerified,
      authenticatedAt: userSessionContexts.authenticatedAt,
      issuedAt: userSessionContexts.issuedAt,
      lastActivityAt: userSessionContexts.lastActivityAt,
      absoluteExpiresAt: userSessionContexts.absoluteExpiresAt,
      inactivityExpiresAt: userSessionContexts.inactivityExpiresAt,
      revokedAt: userSessionContexts.revokedAt,
      identityStatus: authIdentities.status,
      identityProvider: authIdentities.provider,
      identityIssuer: authIdentities.issuer,
      identitySubject: authIdentities.subject,
      userLifecycleStatus: users.lifecycleStatus,
      membershipStatus: memberships.status,
      membershipCurrentVersion: memberships.version,
      membershipRevokedAt: memberships.revokedAt,
      membershipRoleId: memberships.roleId,
      companyLifecycleStatus: companies.lifecycleStatus,
      companyTenantStatus: companies.tenantStatus,
      companyAuthenticationDisabledAt: companies.authenticationDisabledAt,
    })
    .from(userSessionContexts)
    .leftJoin(
      authIdentities,
      eq(authIdentities.id, userSessionContexts.authIdentityId),
    )
    .leftJoin(users, eq(users.id, userSessionContexts.userId))
    .leftJoin(
      memberships,
      eq(memberships.id, userSessionContexts.activeMembershipId),
    )
    .leftJoin(companies, eq(companies.id, userSessionContexts.activeTenantId))
    .where(
      and(
        eq(
          userSessionContexts.providerSessionReferenceDigestVersion,
          digestVersion,
        ),
        eq(userSessionContexts.providerSessionReferenceHash, digestHash),
        isNull(userSessionContexts.revokedAt),
      ),
    )
    .limit(1);
  return rows[0];
}

/** Slide the inactivity window forward on an active session (best effort). */
export async function touchSessionActivity(
  db: ControlPlaneDatabase,
  sessionContextId: string,
  lastActivityAt: Date,
  inactivityExpiresAt: Date,
): Promise<void> {
  await db
    .update(userSessionContexts)
    .set({ lastActivityAt, inactivityExpiresAt })
    .where(eq(userSessionContexts.id, sessionContextId));
}

/** Revoke a session (logout / invalidation). */
export async function revokeSession(
  db: ControlPlaneDatabase,
  sessionContextId: string,
  revokedAt: Date,
  revocationReason: string,
): Promise<void> {
  await db
    .update(userSessionContexts)
    .set({ revokedAt, revocationReason })
    .where(eq(userSessionContexts.id, sessionContextId));
}

/** Resolve a role's tenant-scoped id (guards role belongs to the tenant). */
export async function findRoleForTenant(
  db: ControlPlaneDatabase,
  tenantId: string,
  roleId: string,
): Promise<{ roleId: string } | undefined> {
  const rows = await db
    .select({ roleId: roles.id })
    .from(roles)
    .where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)))
    .limit(1);
  return rows[0];
}
