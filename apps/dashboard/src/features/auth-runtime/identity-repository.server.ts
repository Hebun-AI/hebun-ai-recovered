/*
 * Identity + session control-plane repository (server-only, durable).
 *
 * Pure data access over the authored Drizzle schema. No cookie / request
 * concerns live here — the session service composes these calls. Every read that
 * feeds authorization returns the raw status fields so the service can fail
 * closed with a precise reason (identity / membership / tenant / session).
 */

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import {
  authIdentities,
  companies,
  memberships,
  roles,
  users,
  userSessionContexts,
} from "@/db/schema";

/**
 * Anything that can read: the database, or an open transaction on it. Needed because Identity
 * establishment must commit atomically with the credential and the ceremony completion that
 * accompany it, and a transaction is not assignable to the full database type.
 */
export type IdentityReader = Pick<ControlPlaneDatabase, "execute">;
/** Anything that can write one row: the database, or an open transaction on it. */
export type IdentityWriter = Pick<ControlPlaneDatabase, "insert">;
/**
 * Anything that can both mint and spend a session row: the database, or an open transaction on it.
 *
 * Needed because moving a session from one tenant to another must be atomic — "the old session was
 * revoked but the new one was never written" would sign a human out for pressing a switch button,
 * and "two sessions exist because two switches raced" would leave a live receipt nobody holds.
 */
export type SessionWriter = Pick<ControlPlaneDatabase, "insert" | "update">;

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

/**
 * ONE selectable entitlement, as a human choosing a workspace may see it.
 *
 * Deliberately thin: the membership id (the thing being selected), the tenant it belongs to, and
 * display names. NO role id, NO membership version, NO authority scope, NO governance provenance —
 * a picker needs to tell workspaces apart, not to carry authority. Everything authoritative is
 * re-resolved server-side at selection time, so nothing here is trusted on the way back.
 */
export interface TenantCandidate {
  readonly membershipId: string;
  readonly tenantId: string;
  readonly tenantName: string;
  readonly roleName: string | null;
}

export interface SessionContextInsert {
  readonly authIdentityId: string;
  readonly providerSessionReferenceHash: string;
  readonly providerSessionReferenceDigestVersion: number;
  readonly userId: string;
  /**
   * NULL together when the session is a PRE-TENANT receipt — a human whose credential is verified
   * and whose active tenant is not yet decided. `user_session_contexts_tenant_membership_chk` is
   * `(active_tenant_id IS NULL) = (active_membership_id IS NULL)`, so both-NULL has always been a
   * legal row; nothing had ever written one. A pre-tenant row carries NO tenant authority: the
   * resolver refuses to build a `TenantContext` from it, so it authorizes nothing.
   */
  readonly activeTenantId: string | null;
  readonly activeMembershipId: string | null;
  readonly membershipVersion: number | null;
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
 * Is a human already known to Hebun at this address?
 *
 * Case-insensitive by design: `users_email_uq` is on the exact string, but a seeded row may carry
 * mixed case, and "the same human" must not depend on capitalisation. The same comparison the
 * operator-only credential tooling already performs when it looks a human up by address.
 *
 * Read-only. Returns a boolean, never a row: a caller asking "is this address taken" must not
 * receive an account directory as a side effect.
 */
export async function isEmailClaimed(
  db: IdentityReader,
  normalizedEmail: string,
): Promise<boolean> {
  const rows = await db.execute(
    sql`select 1 from public.users where lower(email) = ${normalizedEmail} limit 1`,
  );
  return rows.rows.length > 0;
}

/** The coordinates of the local identity to establish. Every value is server-resolved. */
export interface LocalIdentityInsert {
  /** Already normalized (lower + trimmed) by the caller against the invitation's own column. */
  readonly normalizedEmail: string;
  readonly provider: string;
  readonly issuer: string;
  readonly subject: string;
  /** The moment verification is considered to have occurred. Never client-supplied. */
  readonly verifiedAt: Date;
  /**
   * Attribution for the created rows.
   *
   * `"human"` — the human performed the act that created them and is their own creator. This is
   * enrollment: a person followed an invitation, chose a password, and brought themselves into
   * existence. `created_by` on the identity names that human.
   *
   * OMITTED — **no actor may be named.** The rows are created, but nobody is recorded as having
   * created them. This is the deployment-possession case: a terminal caused the act, and Hebun
   * cannot cryptographically identify the human operating it. `created_by` and `created_by_type`
   * are then left NULL **together**, which is the only truthful pair — the same reason
   * `companies.created_by` stays NULL when a possession ceremony provisions a tenant.
   *
   * G5A CORRECTION. `created_by` on the identity used to be set to the new user's own id
   * unconditionally, whatever this field said. For enrollment that is true and stays true. For a
   * possession-bootstrapped human it was FALSE: they did not perform the act, and the row claimed
   * they did. Attribution now follows this field in both columns.
   */
  readonly createdByType?: "human";
}

/**
 * ESTABLISH ONE NEW HUMAN — the first product writer Identity authority has ever had.
 *
 * Everything Hebun knows about `users` and `auth_identities` lives in this module, so this is where
 * creating them belongs. No other module may insert into either table; a structural test enforces
 * that, exactly as one enforces that only the credential repository names the stored secret.
 *
 * WHAT IT REFUSES TO DECIDE. It does not decide whether the human MAY be created — that is the
 * caller's authority to have established, and I1.2 establishes it with a Governance second key. It
 * takes a writer rather than a database so it can be part of the caller's transaction: "identity
 * created but the credential failed" must be unrepresentable, not merely unlikely.
 *
 * `is_primary` is true because this is the human's first and only identity. `status` is `active`
 * with `verified_at` set together, because `auth_identities_active_chk` requires exactly that pair —
 * an identity may not claim to be active without a verification timestamp.
 *
 * Uniqueness is left to the database: `users_email_uq` and
 * `auth_identities_provider_issuer_subject_uq` are the real defense against a duplicate human, and
 * a losing race surfaces as a unique violation the caller maps to an honest refusal.
 */
export async function insertLocalIdentity(
  writer: IdentityWriter,
  input: LocalIdentityInsert,
): Promise<{ readonly userId: string; readonly authIdentityId: string }> {
  const userRows = await writer
    .insert(users)
    .values({
      email: input.normalizedEmail,
      createdByType: input.createdByType,
    })
    .returning({ id: users.id });
  const userId = userRows[0]!.id;

  /*
   * BOTH-OR-NEITHER. An actor id without an actor type, or a type without an id, is a half-claim
   * about who acted. `createdBy` is therefore derived from the same field that carries the type:
   * self-attribution when a human acted, and NULL when no actor may be named.
   */
  const identityRows = await writer
    .insert(authIdentities)
    .values({
      userId,
      provider: input.provider,
      issuer: input.issuer,
      subject: input.subject,
      status: "active",
      isPrimary: true,
      verifiedAt: input.verifiedAt,
      createdBy: input.createdByType === "human" ? userId : undefined,
      createdByType: input.createdByType,
    })
    .returning({ id: authIdentities.id });

  return { userId, authIdentityId: identityRows[0]!.id };
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

/**
 * Every active membership this human holds, in a deterministic order.
 *
 * The SIBLING of `findPrimaryActiveMembership`, not a replacement: that function answers "which one
 * does an unqualified sign-in resolve?" and keeps its `LIMIT 1`; this one answers "which ones exist
 * at all?". They share the exact same predicate and the exact same ordering, so the first row of
 * this list IS what the other returns — a property a test asserts rather than a coincidence.
 *
 * This does NOT make anything a new Membership authority. It is a read, it writes nothing, and it
 * returns no field a caller could act on: authority comes from re-resolving the chosen membership at
 * issuance time, never from this list.
 */
export async function findActiveMemberships(
  db: ControlPlaneDatabase,
  userId: string,
): Promise<readonly MembershipResolution[]> {
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
    .orderBy(asc(memberships.createdAt), asc(memberships.id));

  return rows.map((row) => ({
    membershipId: row.membershipId,
    tenantId: row.tenantId,
    membershipVersion: row.membershipVersion,
    roleId: row.roleId,
    companyLifecycleStatus: row.companyLifecycleStatus,
    companyTenantStatus: row.companyTenantStatus,
    companyAuthenticationDisabled: row.companyAuthenticationDisabledAt !== null,
  }));
}

/**
 * The selectable workspaces for one human, as a picker may render them.
 *
 * SERVER-DERIVED, ALWAYS. A caller passes a user id resolved from a durable session; it can never
 * pass a tenant id or a membership id in, so it cannot manufacture a candidate. Only tenants whose
 * authentication is enabled appear — offering a workspace that would refuse the session at issuance
 * would be a picker that lies.
 */
export async function findTenantCandidates(
  db: ControlPlaneDatabase,
  userId: string,
): Promise<readonly TenantCandidate[]> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      tenantId: memberships.tenantId,
      tenantName: companies.name,
      roleName: roles.name,
      companyLifecycleStatus: companies.lifecycleStatus,
      companyTenantStatus: companies.tenantStatus,
      companyAuthenticationDisabledAt: companies.authenticationDisabledAt,
      roleId: memberships.roleId,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.tenantId))
    .leftJoin(roles, eq(roles.id, memberships.roleId))
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.status, "active"),
        eq(memberships.lifecycleStatus, "active"),
        isNull(memberships.revokedAt),
      ),
    )
    .orderBy(asc(memberships.createdAt), asc(memberships.id));

  return rows
    .filter(
      (row) =>
        row.roleId !== null &&
        row.companyLifecycleStatus === "active" &&
        (row.companyTenantStatus === null || row.companyTenantStatus === "active") &&
        row.companyAuthenticationDisabledAt === null,
    )
    .map((row) => ({
      membershipId: row.membershipId,
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      roleName: row.roleName,
    }));
}

/**
 * Re-resolve ONE membership by id, for exactly one human.
 *
 * THE REVALIDATION SEAM. Selection is not authorization — this is. The membership id arrives from a
 * client that was shown a candidate list some moments ago, and everything may have changed since:
 * the membership may be revoked, its version may have moved, its tenant may have been disabled. So
 * the id is matched together with the authenticated `user_id`, and the caller re-checks lifecycle
 * from the returned row rather than from anything it remembered.
 *
 * A membership belonging to another human resolves to nothing — indistinguishable from one that
 * never existed, so a guessed uuid learns nothing.
 */
export async function findMembershipForUser(
  db: ControlPlaneDatabase,
  userId: string,
  membershipId: string,
): Promise<MembershipResolution | undefined> {
  const rows = await db
    .select({
      membershipId: memberships.id,
      tenantId: memberships.tenantId,
      membershipVersion: memberships.version,
      roleId: memberships.roleId,
      membershipStatus: memberships.status,
      membershipLifecycleStatus: memberships.lifecycleStatus,
      membershipRevokedAt: memberships.revokedAt,
      companyLifecycleStatus: companies.lifecycleStatus,
      companyTenantStatus: companies.tenantStatus,
      companyAuthenticationDisabledAt: companies.authenticationDisabledAt,
    })
    .from(memberships)
    .innerJoin(companies, eq(companies.id, memberships.tenantId))
    .where(and(eq(memberships.id, membershipId), eq(memberships.userId, userId)))
    .limit(1);

  const row = rows[0];
  if (!row) return undefined;
  /* Lifecycle is checked HERE, from the row just read — never from the candidate list. */
  if (
    row.membershipStatus !== "active" ||
    row.membershipLifecycleStatus !== "active" ||
    row.membershipRevokedAt !== null ||
    row.roleId === null
  ) {
    return undefined;
  }
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

/**
 * Insert a durable session context row; returns its generated id.
 *
 * Takes a writer rather than the database so it can be part of the caller's transaction: a switch
 * that mints a session and spends the previous one must do both or neither.
 */
export async function insertSessionContext(
  db: IdentityWriter,
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

/**
 * SPEND a session exactly once: revoke it only if it is still live, and report whether this call is
 * the one that did it.
 *
 * THE SIBLING OF `revokeSession`, NOT ITS REPLACEMENT. Sign-out is unconditional and idempotent —
 * revoking an already-revoked session is still the right outcome. A switch is not: it is a
 * transition, and two concurrent transitions from one session must produce ONE new session, not two.
 * Predicating the write on `revoked_at is null` takes the row lock on the session being spent, which
 * is the thing two switches actually contend for, and makes the loser's update affect zero rows.
 *
 * The same shape the invitation authority already uses to make acceptance single-use. Returns false
 * rather than throwing so the caller decides what a lost race means.
 */
export async function revokeSessionIfActive(
  writer: Pick<ControlPlaneDatabase, "update">,
  sessionContextId: string,
  revokedAt: Date,
  revocationReason: string,
): Promise<boolean> {
  const spent = await writer
    .update(userSessionContexts)
    .set({ revokedAt, revocationReason })
    .where(
      and(
        eq(userSessionContexts.id, sessionContextId),
        isNull(userSessionContexts.revokedAt),
      ),
    )
    .returning({ id: userSessionContexts.id });
  return spent.length > 0;
}

/**
 * The tenant statuses under which Hebun admits activity. ONE definition, deliberately.
 *
 * This was previously a private constant inside `session-service.server.ts`, which was correct while
 * the session service was the only thing that asked the question. R4B gives the same question a
 * second asker — the pre-tenant onboarding and enrollment flows — and two copies of "which statuses
 * count as usable" is exactly the drift that lets one enforcement point quietly disagree with the
 * other. The vocabulary therefore lives here, in the module that already owns every read of
 * `companies` lifecycle state, and the session service imports it.
 *
 * A NULL `tenant_status` is treated as active by every caller: the column is nullable and the two
 * fixture-seeded tenants predate it. That check belongs to the caller, not to this set, because the
 * set answers "is this status usable", not "is this row usable".
 */
export const ACTIVE_TENANT_STATUSES: ReadonlySet<string> = new Set(["active"]);

/**
 * Whether a tenant may currently accept onboarding and enrollment activity (R4B).
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * The authenticated paths re-derive tenant state on every request, so a suspended tenant loses all
 * governed access on its next request. The three PRE-TENANT flows — invitation acceptance,
 * enrollment start, enrollment completion — never had that check, because they resolve their tenant
 * from an invitation row rather than from a session, so no session gate ever ran for them. A bearer
 * holding a live invitation into a suspended tenant could therefore still create a user, an
 * identity, a credential and a membership. This is the read that closes that.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 *
 * It is NOT a second tenant authority. It owns no state, performs no write, decides no transition,
 * and accepts nothing from a client but a tenant id that its caller already read from a durable row.
 * It is one more read in the module that already performs every other `companies` read, and it
 * answers exactly one question.
 *
 * ── ONLY `active` IS ELIGIBLE, AND THAT IS INHERITED, NOT INVENTED ──────────
 *
 * `suspended`, `provisioning`, `deleting` and `deleted` all refuse, because the session gate already
 * admits only `active` and this preserves that rule rather than writing a new one. Refusing
 * `deleting`/`deleted` here assigns them no product meaning — R5 still owns deletion entirely.
 *
 * ── WHAT IS DELIBERATELY NOT CONSULTED ──────────────────────────────────────
 *
 * `authentication_disabled_at` is authentication POLICY, not tenant lifecycle, and collapsing the
 * two would make "suspended" and "authentication disabled" indistinguishable forever. Membership
 * status is a different subject entirely and each caller already checks its own. `lifecycle_status`
 * IS consulted, because it is the generic soft-delete flag every governed read in this repository
 * already respects and the session gate checks it in the same breath.
 */
export async function isTenantOnboardingEligible(
  db: ControlPlaneDatabase,
  tenantId: string,
): Promise<boolean> {
  const rows = await db
    .select({
      lifecycleStatus: companies.lifecycleStatus,
      tenantStatus: companies.tenantStatus,
    })
    .from(companies)
    .where(eq(companies.id, tenantId))
    .limit(1);

  const row = rows[0];
  /* No such tenant is not eligible. Fail closed, exactly as a missing row does everywhere else. */
  if (!row) return false;
  if (row.lifecycleStatus !== "active") return false;
  return row.tenantStatus === null || ACTIVE_TENANT_STATUSES.has(row.tenantStatus);
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
