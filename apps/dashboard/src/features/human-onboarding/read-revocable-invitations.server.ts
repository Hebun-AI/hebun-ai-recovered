/*
 * human-onboarding/read-revocable-invitations.server.ts — the revocation surface's read seam.
 *
 * WHY IT IS SEPARATE FROM I1's READ SEAM. `readMembershipAuthority` answers "which humans has
 * Governance authorized?", which is Membership Authority's question. Which INVITATION exists and
 * whether it can still be ended is Human Onboarding's, and this is the module that owns invitations.
 * Extending I1's view would have made one seam answer two phases' questions.
 *
 * AUTHORITY-ONLY, LIKE EVERY OTHER GOVERNANCE READ. A caller without Governance authority gets an
 * empty view rather than a list of who has an outstanding capability — which is exactly the sort of
 * fact that must not leak to an ordinary member.
 *
 * WHAT IT DELIBERATELY DOES NOT RETURN:
 *
 *   token_hash          the digest is the invitation's secret half and has no reader on any surface
 *   the capability      never stored, so it could not be returned even in error
 *   normalized_email    NOT duplicated. The card already renders the address from the authorization
 *                       row it belongs to, and this view is keyed by `membershipAuthorizationId` so
 *                       the surface can join them without this seam repeating the PII.
 *
 * Read-only. No writes, no authority decisions, no side effects.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { invitations } from "@/db/schema/invitation";
import { membershipAuthorizations } from "@/db/schema/membership-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveGovernanceDbOrNull,
  type GovernanceDeps,
} from "@/features/governance-decision/bootstrap-authority.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/decision-authority.server";

/**
 * One invitation that could still be ended, as the Governance surface may show it.
 *
 * Every field is a real column or derived from one, and none of them identifies the invited human —
 * the surface already knows that from the authorization this row is keyed to.
 */
export interface RevocableInvitationView {
  readonly invitationId: string;
  /** The authorization that produced it. The join key the surface renders against. */
  readonly membershipAuthorizationId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  /**
   * The capability has passed its window but the row still says `pending`. Rendered so the surface
   * can be honest that revoking it is a cleanup rather than a withdrawal of something live.
   */
  readonly expiredByClock: boolean;
}

export interface RevocableInvitationsView {
  readonly viewerIsGovernanceAuthority: boolean;
  readonly revocable: readonly RevocableInvitationView[];
}

export type RevocableInvitationsLookup =
  | { readonly status: "read"; readonly view: RevocableInvitationsView }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-unavailable";
    };

const EMPTY_VIEW: RevocableInvitationsView = {
  viewerIsGovernanceAuthority: false,
  revocable: [],
};

/**
 * Every invitation in this tenant that is still `pending`, and therefore still revocable.
 *
 * Status-scoped rather than clock-scoped on purpose: a lapsed invitation is exactly the one that
 * strands the tenant/address slot, so it must appear here to be cleaned up.
 */
export async function readRevocableInvitations(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<RevocableInvitationsLookup> {
  if (typeof window !== "undefined") {
    throw new Error("Invitation reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  const now = (deps.now ?? (() => new Date()))();

  try {
    const authority = await resolveGovernanceAuthority(tenant, deps);
    if (!authority.authorized) return { status: "read", view: EMPTY_VIEW };

    /*
     * Inner-joined to the authorization that consumed it: an invitation always has one, and joining
     * gives the surface its key without this seam returning the address a second time.
     */
    const rows = await db
      .select({
        invitationId: invitations.id,
        membershipAuthorizationId: membershipAuthorizations.id,
        issuedAt: invitations.issuedAt,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .innerJoin(
        membershipAuthorizations,
        eq(membershipAuthorizations.consumedByInvitationId, invitations.id),
      )
      .where(
        and(eq(invitations.tenantId, tenant.tenantId), eq(invitations.status, "pending")),
      );

    return {
      status: "read",
      view: {
        viewerIsGovernanceAuthority: true,
        revocable: rows.map((row) => ({
          invitationId: row.invitationId,
          membershipAuthorizationId: row.membershipAuthorizationId,
          issuedAt: row.issuedAt.toISOString(),
          expiresAt: row.expiresAt.toISOString(),
          expiredByClock: row.expiresAt.getTime() <= now.getTime(),
        })),
      },
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
