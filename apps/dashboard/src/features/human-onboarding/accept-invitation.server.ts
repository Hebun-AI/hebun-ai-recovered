/*
 * human-onboarding/accept-invitation.server.ts — ACT B: the invited human joins.
 *
 * ── THE IDENTITY BINDING, WHICH IS THE SECURITY BOUNDARY OF THIS PHASE ───────
 *
 * A valid capability plus an arbitrary authenticated human is NOT enough, and nothing in the
 * repository suggests invitations are transferable. Acceptance therefore requires BOTH:
 *
 *   1. possession of the capability                                  (what the bearer holds)
 *   2. proof of the credential belonging to the INVITED identity     (who the bearer is)
 *
 * The comparison is `lower(users.email) = invitations.normalized_email`, using the normalization
 * Identity authority already defines — the same lower+trim rule `invitations_normalized_email_chk`
 * and `membership_authorizations_normalized_email_chk` enforce, and the same case-insensitive
 * comparison `isEmailClaimed` performs. No second normalization is implemented here.
 *
 * ── WHY AUTHENTICATION IS BY CREDENTIAL AND NOT BY SESSION ───────────────────
 *
 * A brand-new human who has just completed I1.2 has an identity and a credential and NO membership,
 * so `issueLocalSession` refuses them and no session can exist yet. Requiring a session would make
 * the brand-new path unreachable and would push this phase into changing Session authority, which
 * is not I2's to change. Verifying the credential is the primitive that answers "which human?" —
 * D1's own words — and it answers it without minting anything.
 *
 * An already-authenticated human re-proves their password here. For "join another organization"
 * that is a defensible re-authentication, and it makes both paths one code path with one set of
 * proofs rather than two.
 *
 * ── ENUMERATION AND PROBING ARE CLOSED ───────────────────────────────────────
 *
 * Unknown email, no credential, wrong password, locked credential and "authenticated human is not
 * the invited human" all return the SAME `not-acceptable`, and every branch spends the same scrypt
 * work. Otherwise a capability holder could learn which address it was issued for, and anyone could
 * probe which addresses exist.
 *
 * ── WHAT IS DERIVED, NEVER SUPPLIED ──────────────────────────────────────────
 *
 *   tenant  ← the invitation row          role ← the invitation's intended_role_id
 *   user    ← the verified credential     invitation ← resolved by digest
 *
 * The client supplies the capability, an email and a password. Nothing else exists to supply.
 *
 * Server-only.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { invitations } from "@/db/schema/invitation";
import { memberships } from "@/db/schema/membership";
import { membershipAuthorizations } from "@/db/schema/membership-authorization";
import { roles } from "@/db/schema/role";
import type { AuthenticationDigestKey } from "@/features/auth/environment/auth-environment.server";
import {
  recordFailedAttempt,
  recordSuccessfulVerification,
  spendEquivalentCredentialWork,
  verifyPasswordCredential,
} from "@/features/auth-runtime/credential-repository.server";
import { findActiveLocalIdentityByEmail } from "@/features/auth-runtime/identity-repository.server";
import { recordMembershipCreatedWithin } from "@/features/governance-audit/human-onboarding-audit.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/bootstrap-authority.server";
import {
  digestInvitationToken,
  timingSafeEqualHex,
} from "@/features/identity-enrollment/enrollment-digest.server";
import {
  MEMBERSHIP_CREATED_ACTION,
  ONBOARDING_MEMBERSHIP_ROLE_TYPE,
  type InvitationAcceptanceRefusal,
  type InvitationAcceptanceResult,
} from "./contracts";
import { isAnyUniqueViolation } from "./issue-invitation.server";

export interface AcceptanceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly digestKey: AuthenticationDigestKey;
}

function refused(reason: InvitationAcceptanceRefusal): InvitationAcceptanceResult {
  return { status: "refused", reason };
}

/** Thrown inside the transaction when the conditional acceptance matched nothing. */
class AcceptanceRaceLost extends Error {}

/**
 * Accept ONE invitation and become a member of exactly the tenant it names.
 *
 * Neither the capability alone nor the credential alone is sufficient: the capability names the
 * invitation, and the credential proves the bearer is the human that invitation was issued for.
 */
export async function acceptInvitation(
  input: {
    readonly capability: string;
    readonly email: string;
    readonly password: string;
  },
  deps: AcceptanceDeps,
): Promise<InvitationAcceptanceResult> {
  if (typeof window !== "undefined") {
    throw new Error("Invitation acceptance is server-only.");
  }

  const capability = typeof input?.capability === "string" ? input.capability.trim() : "";
  const email = typeof input?.email === "string" ? input.email.trim().toLowerCase() : "";
  const password = typeof input?.password === "string" ? input.password : "";

  if (!capability) return refused("capability-unrecognized");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  try {
    /*
     * LOOKUP IS BY DIGEST, NEVER BY ID. `invitations_token_hash_uq` is global, so a matching digest
     * names at most one row and identifiers cannot be enumerated.
     */
    const tokenHash = digestInvitationToken(capability, deps.digestKey);
    const invitationRows = await db
      .select({
        id: invitations.id,
        tenantId: invitations.tenantId,
        normalizedEmail: invitations.normalizedEmail,
        intendedRoleId: invitations.intendedRoleId,
        status: invitations.status,
        expiresAt: invitations.expiresAt,
        storedTokenHash: invitations.tokenHash,
        roleType: roles.type,
      })
      .from(invitations)
      .innerJoin(roles, eq(roles.id, invitations.intendedRoleId))
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);

    const invitation = invitationRows[0];
    if (!invitation) {
      // Spend the same work a real check costs, so an unknown capability is not detectable by timing.
      await spendEquivalentCredentialWork(password);
      return refused("capability-unrecognized");
    }
    /* Constant-time confirmation, so a near-miss is indistinguishable from a wild guess. */
    if (!timingSafeEqualHex(tokenHash, invitation.storedTokenHash.trim())) {
      await spendEquivalentCredentialWork(password);
      return refused("capability-unrecognized");
    }

    /*
     * USABILITY IS A PREDICATE, NOT A STATUS READ. `invitation_status` has an `expired` value that
     * nothing writes, so trusting `status = 'pending'` alone would accept a lapsed capability.
     */
    if (invitation.status !== "pending" || invitation.expiresAt.getTime() <= now.getTime()) {
      await spendEquivalentCredentialWork(password);
      return refused("capability-not-usable");
    }

    /* The band must still be eligible at the moment the membership is created, not only when authorized. */
    if (invitation.roleType !== ONBOARDING_MEMBERSHIP_ROLE_TYPE) {
      await spendEquivalentCredentialWork(password);
      return refused("role-not-eligible");
    }

    /* ── AUTHENTICATION. Everything below returns ONE reason. ─────────────────── */
    const identity = await findActiveLocalIdentityByEmail(db, email);
    if (!identity) {
      await spendEquivalentCredentialWork(password);
      return refused("not-acceptable");
    }

    /*
     * THE BINDING. Compared BEFORE the password is checked would leak which address the capability
     * names; compared after, a mismatch costs exactly what a wrong password costs. `users.email` is
     * lower-cased for comparison because a seeded row may carry mixed case, while
     * `invitations.normalized_email` is CHECK-enforced lower already.
     */
    const verification = await verifyPasswordCredential(db, identity.authIdentityId, password, now);
    if (verification.outcome === "no-credential" || verification.outcome === "locked") {
      return refused("not-acceptable");
    }
    if (verification.outcome === "rejected") {
      await recordFailedAttempt(db, verification.credentialId, now);
      return refused("not-acceptable");
    }

    if (identity.email.trim().toLowerCase() !== invitation.normalizedEmail) {
      /*
       * A REAL HUMAN PROVED A REAL PASSWORD — AND IS NOT THE INVITED HUMAN. The credential state is
       * normalised because they did nothing wrong, and the refusal is the same sentence everyone
       * else gets, so a capability cannot be used to discover who it was for.
       */
      await recordSuccessfulVerification(db, verification.credentialId, now);
      return refused("not-acceptable");
    }

    // Verified, and verified as the invited human.
    await recordSuccessfulVerification(db, verification.credentialId, now);

    /*
     * Already a member of this tenant. Reported honestly rather than as an authentication failure —
     * the human proved who they are, so there is nothing left to protect by being vague.
     */
    const existing = await db
      .select({ id: memberships.id })
      .from(memberships)
      .where(
        and(eq(memberships.tenantId, invitation.tenantId), eq(memberships.userId, identity.userId)),
      )
      .limit(1);
    if (existing.length > 0) return refused("already-a-member");

    /*
     * PROVENANCE. The authorization that produced this invitation must still name it. This is a
     * read, not a write: I2 does not re-consume anything — consumption happened at issuance, and
     * the schema's `consumed_by_invitation_id` foreign key is what says so.
     */
    const provenance = await db
      .select({ id: membershipAuthorizations.id, status: membershipAuthorizations.status })
      .from(membershipAuthorizations)
      .where(
        and(
          eq(membershipAuthorizations.consumedByInvitationId, invitation.id),
          eq(membershipAuthorizations.tenantId, invitation.tenantId),
        ),
      )
      .limit(1);
    const authorization = provenance[0];
    if (!authorization || authorization.status !== "consumed") {
      return refused("authorization-provenance-broken");
    }

    let created: { membershipId: string } | null = null;

    await db.transaction(async (tx) => {
      /*
       * THE CONDITIONAL ACCEPTANCE, FIRST. Predicated on the invitation still being pending and
       * unexpired, so a concurrent acceptance that got here first makes this update zero rows — and
       * the abort unwinds the membership and the audit row with it. Doing it before the membership
       * insert means the row lock is taken on the invitation, which is the thing two acceptances
       * actually contend for.
       */
      const accepted = await tx
        .update(invitations)
        .set({
          status: "accepted",
          acceptedAt: now,
          acceptedByUserId: identity.userId,
          updatedAt: now,
          updatedBy: identity.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(invitations.id, invitation.id),
            eq(invitations.status, "pending"),
            sql`${invitations.expiresAt} > ${now.toISOString()}::timestamptz`,
          ),
        )
        .returning({ id: invitations.id });

      if (accepted.length === 0) throw new AcceptanceRaceLost();

      /*
       * THE MEMBERSHIP. Every authority-bearing value is copied from the invitation row, whose
       * `invitations_tenant_role_fk` already proved the tenant/role pair is consistent — so the pair
       * written here is a database-verified pair, not an application guess. The client chose none of
       * it, and `memberships_accepted_invitation_uq` is the terminal backstop against two
       * memberships citing one invitation.
       */
      const membership = await tx
        .insert(memberships)
        .values({
          tenantId: invitation.tenantId,
          userId: identity.userId,
          roleId: invitation.intendedRoleId,
          status: "active",
          statusChangedAt: now,
          acceptedInvitationId: invitation.id,
          createdBy: identity.userId,
          createdByType: "human",
        })
        .returning({ id: memberships.id });
      const membershipId = membership[0]!.id;

      await recordMembershipCreatedWithin(
        tx,
        {
          action: MEMBERSHIP_CREATED_ACTION,
          tenantId: invitation.tenantId,
          invitationId: invitation.id,
          memberUserId: identity.userId,
          membershipId,
          roleId: invitation.intendedRoleId,
          membershipAuthorizationId: authorization.id,
        },
        now,
      );

      created = { membershipId };
    });

    if (!created) return refused("persistence-unavailable");
    const outcome = created as { membershipId: string };
    return {
      status: "accepted",
      membershipId: outcome.membershipId,
      tenantId: invitation.tenantId,
      userId: identity.userId,
      roleId: invitation.intendedRoleId,
      invitationId: invitation.id,
      membershipAuthorizationId: authorization.id,
      acceptedAt: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof AcceptanceRaceLost) return refused("capability-not-usable");
    /* `memberships_tenant_user_uq` or `memberships_accepted_invitation_uq` lost the race. */
    if (isAnyUniqueViolation(error)) return refused("already-a-member");
    return refused("persistence-unavailable");
  }
}

/**
 * Which tenant does an UNQUALIFIED sign-in resolve for this human, and is it this one?
 *
 * NARROWER THAN ITS ORIGINAL MEANING, deliberately. When I2 closed, this answered "can they enter
 * that tenant at all?", because `findPrimaryActiveMembership` was the only path in. Tenant Selection
 * Authority added another: a human with several memberships is now ASKED at sign-in and may choose
 * any of them. So `reachable: false` no longer means unreachable — it means "not the one an
 * unqualified sign-in would land on", which is the question this function can honestly answer.
 *
 * Read-only. Writes nothing, decides nothing.
 */
export async function describeTenantReachability(
  db: ControlPlaneDatabase,
  userId: string,
  tenantId: string,
): Promise<{
  readonly memberships: number;
  readonly reachable: boolean;
  readonly reason: "only-membership" | "not-the-oldest-membership" | "no-membership";
}> {
  const rows = await db
    .select({ id: memberships.id, tenantId: memberships.tenantId })
    .from(memberships)
    .where(
      and(
        eq(memberships.userId, userId),
        eq(memberships.status, "active"),
        eq(memberships.lifecycleStatus, "active"),
        isNull(memberships.revokedAt),
      ),
    )
    .orderBy(memberships.createdAt, memberships.id);

  if (rows.length === 0) return { memberships: 0, reachable: false, reason: "no-membership" };
  const oldest = rows[0]!;
  if (rows.length === 1) {
    return {
      memberships: 1,
      reachable: oldest.tenantId === tenantId,
      reason: "only-membership",
    };
  }
  return {
    memberships: rows.length,
    reachable: oldest.tenantId === tenantId,
    reason: oldest.tenantId === tenantId ? "only-membership" : "not-the-oldest-membership",
  };
}
