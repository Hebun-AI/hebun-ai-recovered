/*
 * human-onboarding/issue-invitation.server.ts — ACT A: spend one authorization, mint one capability.
 *
 * WHERE THE AUTHORITY COMES FROM, AND WHERE IT DOES NOT. `resolveGovernanceAuthority(tenant)` — the
 * same G2/G3 resolver that already answers it for ratification, delegation, revocation, membership
 * authorization, role provisioning and identity enrollment. There is NO second resolver here, and
 * `roles.type`, `roles.authority_rank`, `memberships.authority_scope`, `permissions`,
 * `role_permissions` and anything the client supplied are consulted for nothing.
 *
 * WHY ISSUANCE NEEDS AUTHORITY AT ALL, GIVEN I1 ALREADY DECIDED. The Governance decision authorized
 * an onboarding; it did not authorize handing a bearer capability to whoever asks. Minting a token
 * is the moment the tenant loses control of who can attempt to join, so the act belongs to the same
 * authority that made the decision. It is NOT a second Governance decision — nothing is decided
 * here, and `decision_records` is not written.
 *
 * WHAT THE CLIENT MAY SUPPLY. One thing: which authorization. The tenant, the invited address, the
 * intended role, the expiry, the token and every timestamp are read from the authorization row or
 * generated server-side. There is no input field for any of them, so a forged one has nowhere to
 * arrive.
 *
 * WHAT COMMITS TOGETHER. The invitation, the authorization's consumption and the audit row are one
 * transaction. "Invitation exists but the authorization was never spent" and "spent but no
 * invitation" are both unrepresentable rather than unlikely.
 *
 * CONSUMPTION MEANS ISSUANCE. `membership_authorizations.consumed_by_invitation_id` is a foreign key
 * to the invitation, so the schema already says an authorization is spent when it produces one. A
 * lapsed invitation does not un-spend it; re-inviting needs a new Governance decision.
 *
 * Server-only.
 */
import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { invitations } from "@/db/schema/invitation";
import { membershipAuthorizations } from "@/db/schema/membership-authorization";
import { roles } from "@/db/schema/role";
import type { AuthenticationDigestKey } from "@/features/auth/environment/auth-environment.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordInvitationIssuedWithin } from "@/features/governance-audit/human-onboarding-audit.server";
import {
  resolveGovernanceDbOrNull,
  type GovernanceDeps,
} from "@/features/governance-decision/bootstrap-authority.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/decision-authority.server";
import { digestInvitationToken } from "@/features/identity-enrollment/enrollment-digest.server";
import {
  INVITATION_ISSUED_ACTION,
  INVITATION_LIFETIME_HOURS,
  ONBOARDING_MEMBERSHIP_ROLE_TYPE,
  type InvitationIssuanceRefusal,
  type InvitationIssuanceResult,
} from "./contracts";

/** Governance dependencies plus the digest key, which is a request concern the caller resolves. */
export interface OnboardingDeps extends GovernanceDeps {
  readonly digestKey: AuthenticationDigestKey;
  /** Test seam only: forces a known capability so its digest can be asserted. */
  readonly mintCapability?: () => string;
}

function refused(reason: InvitationIssuanceRefusal): InvitationIssuanceResult {
  return { status: "refused", reason };
}

/** Thrown inside the transaction when the conditional consumption matched nothing. */
class AuthorizationRaceLost extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Issue ONE invitation against ONE live membership authorization.
 *
 * The capability is returned exactly once and is never stored: only its keyed digest reaches the
 * database, using the same HMAC primitive the session reference and the enrollment continuation
 * already use. Hebun sends nothing — the caller delivers it out of band, and the contract says so.
 */
export async function issueInvitation(
  tenant: TenantContext | null,
  input: { readonly membershipAuthorizationId: string },
  deps: OnboardingDeps,
): Promise<InvitationIssuanceResult> {
  if (typeof window !== "undefined") {
    throw new Error("Invitation issuance is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  /* AUTHORITY FIRST, and from one place only. */
  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  const authorizationId = String(input?.membershipAuthorizationId ?? "");
  if (!UUID_RE.test(authorizationId)) return refused("authorization-unresolvable");

  try {
    /*
     * Resolved by id AND tenant together, so an authorization belonging to another tenant is
     * indistinguishable from one that never existed. Joined to `roles` so the intended band can be
     * re-checked: the authorization was written at a different moment, and the band is the one fact
     * that must still hold when a capability is minted against it.
     */
    const rows = await db
      .select({
        id: membershipAuthorizations.id,
        tenantId: membershipAuthorizations.tenantId,
        normalizedEmail: membershipAuthorizations.normalizedEmail,
        intendedRoleId: membershipAuthorizations.intendedRoleId,
        status: membershipAuthorizations.status,
        roleType: roles.type,
      })
      .from(membershipAuthorizations)
      .innerJoin(roles, eq(roles.id, membershipAuthorizations.intendedRoleId))
      .where(
        and(
          eq(membershipAuthorizations.id, authorizationId),
          eq(membershipAuthorizations.tenantId, tenant.tenantId),
        ),
      )
      .limit(1);

    const authorization = rows[0];
    if (!authorization) return refused("authorization-unresolvable");
    if (authorization.status !== "authorized") return refused("authorization-not-live");
    if (authorization.roleType !== ONBOARDING_MEMBERSHIP_ROLE_TYPE) {
      return refused("role-not-eligible");
    }

    const capability = (deps.mintCapability ?? (() => randomBytes(32).toString("base64url")))();
    const tokenHash = digestInvitationToken(capability, deps.digestKey);
    const expiresAt = new Date(now.getTime() + INVITATION_LIFETIME_HOURS * 3600_000);

    let issued: { invitationId: string } | null = null;

    await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(invitations)
        .values({
          tenantId: authorization.tenantId,
          normalizedEmail: authorization.normalizedEmail,
          intendedRoleId: authorization.intendedRoleId,
          /* The accountable actor, resolved from the session. Never accepted from input. */
          inviterType: "human",
          inviterId: tenant.userId,
          tokenHash,
          tokenVersion: deps.digestKey.version,
          status: "pending",
          issuedAt: now,
          expiresAt,
          /*
           * `last_sent_at` and `send_count` are deliberately left untouched. They describe a
           * delivery Hebun cannot perform, and writing them would be a claim that it did.
           */
          createdBy: tenant.userId,
          createdByType: "human",
        })
        .returning({ id: invitations.id });
      const invitationId = inserted[0]!.id;

      /*
       * SPEND THE AUTHORIZATION. Predicated on it still being live, so a concurrent issuance that
       * got here first makes this update zero rows — and the abort below unwinds the invitation and
       * the audit row with it. This is G2's `EntitlementRaceLost` pattern, and it is what makes
       * "one authorization, one invitation" true under concurrency rather than by hope.
       */
      const consumed = await tx
        .update(membershipAuthorizations)
        .set({
          status: "consumed",
          consumedAt: now,
          consumedByInvitationId: invitationId,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(membershipAuthorizations.id, authorization.id),
            eq(membershipAuthorizations.tenantId, tenant.tenantId),
            eq(membershipAuthorizations.status, "authorized"),
          ),
        )
        .returning({ id: membershipAuthorizations.id });

      if (consumed.length === 0) throw new AuthorizationRaceLost();

      await recordInvitationIssuedWithin(
        tx,
        {
          action: INVITATION_ISSUED_ACTION,
          tenantId: authorization.tenantId,
          invitationId,
          issuedByUserId: tenant.userId,
          membershipAuthorizationId: authorization.id,
          intendedRoleId: authorization.intendedRoleId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        now,
      );

      issued = { invitationId };
    });

    if (!issued) return refused("persistence-unavailable");
    const outcome = issued as { invitationId: string };
    return {
      status: "issued",
      invitationId: outcome.invitationId,
      capability,
      expiresAt: expiresAt.toISOString(),
      issuedAt: now.toISOString(),
    };
  } catch (error) {
    if (error instanceof AuthorizationRaceLost) return refused("authorization-already-consumed");
    /*
     * A pending invitation already exists for this human in this tenant. That is a real, nameable
     * state rather than an outage, and `invitations_pending_email_uq` is what detects it.
     */
    if (isUniqueViolation(error, "invitations_pending_email_uq")) {
      return refused("invitation-already-pending");
    }
    if (isUniqueViolation(error, "membership_authorizations_consumed_invitation_uq")) {
      return refused("authorization-already-consumed");
    }
    return refused("persistence-unavailable");
  }
}

/** Narrow a thrown value to a Postgres unique violation on one named constraint. */
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code === "23505" && candidate.constraint === constraint) return true;
  return candidate.cause ? isUniqueViolation(candidate.cause, constraint) : false;
}

/** Narrow a thrown value to ANY Postgres unique violation, whatever the constraint. */
export function isAnyUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; cause?: unknown };
  if (candidate.code === "23505") return true;
  return candidate.cause ? isAnyUniqueViolation(candidate.cause) : false;
}
