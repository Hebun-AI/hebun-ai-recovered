/*
 * membership-authority/read-membership-authorizations.server.ts — the surface's read seam (I1).
 *
 * AUTHORITY-ONLY, LIKE `readDelegationCandidates`. A caller without Governance authority gets an
 * empty view rather than a directory: which humans a tenant has authorized for onboarding, and
 * which roles exist, are not facts an ordinary member needs, and returning them "for the UI" would
 * make the surface a disclosure path around the authority it is supposed to represent.
 *
 * REPORTS THE ROLE-BASELINE GAP AS ITSELF. When a tenant holds no onboarding-eligible role the view
 * says so, so the surface can explain the real absence instead of rendering an empty dropdown that
 * looks like a loading bug.
 *
 * Read-only. No writes, no authority decisions, no side effects.
 *
 * Server-only.
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import { membershipAuthorizations } from "@/db/schema/membership-authorization";
import { roles } from "@/db/schema/role";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull, type GovernanceDeps } from "@/features/governance-decision/persistence.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import { ELIGIBLE_ROLE_TYPE_LIST } from "./contracts";

/** A role a new human may legitimately be authorized into. Resolved server-side, never guessed. */
export interface EligibleRole {
  readonly roleId: string;
  readonly name: string;
  readonly type: string;
}

/** One authorization, as the Governance surface may show it. Every field is a real column. */
export interface MembershipAuthorizationView {
  readonly authorizationId: string;
  readonly normalizedEmail: string;
  readonly intendedRoleId: string;
  readonly intendedRoleName: string | null;
  readonly status: string;
  readonly authorizedAt: string;
  readonly governanceDecisionId: string;
  readonly authorizedByActorId: string;
  /** True only when I2 has spent this authorization. Always false today — I2 does not exist. */
  readonly consumed: boolean;
}

export interface MembershipAuthorityView {
  readonly viewerIsGovernanceAuthority: boolean;
  readonly eligibleRoles: readonly EligibleRole[];
  readonly authorizations: readonly MembershipAuthorizationView[];
  /**
   * The tenant holds no role of an onboarding-eligible band. Not an error and not the viewer's
   * fault — the tenant role-baseline gap, surfaced rather than hidden behind an empty control.
   */
  readonly roleBaselineMissing: boolean;
}

export type MembershipAuthorityLookup =
  | { readonly status: "read"; readonly view: MembershipAuthorityView }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-unavailable";
    };

const EMPTY_VIEW: MembershipAuthorityView = {
  viewerIsGovernanceAuthority: false,
  eligibleRoles: [],
  authorizations: [],
  roleBaselineMissing: false,
};

export async function readMembershipAuthority(
  tenant: TenantContext | null,
  deps: GovernanceDeps = {},
): Promise<MembershipAuthorityLookup> {
  if (typeof window !== "undefined") {
    throw new Error("Membership authority reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) {
    return { status: "unavailable", reason: "no-authorized-tenant-context" };
  }
  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const authority = await resolveGovernanceAuthority(tenant, deps);
    if (!authority.authorized) return { status: "read", view: EMPTY_VIEW };

    const eligible = await db
      .select({ roleId: roles.id, name: roles.name, type: roles.type })
      .from(roles)
      .where(
        and(
          eq(roles.tenantId, tenant.tenantId),
          eq(roles.lifecycleStatus, "active"),
          inArray(roles.type, ELIGIBLE_ROLE_TYPE_LIST),
        ),
      );

    const rows = await db
      .select({
        authorizationId: membershipAuthorizations.id,
        normalizedEmail: membershipAuthorizations.normalizedEmail,
        intendedRoleId: membershipAuthorizations.intendedRoleId,
        intendedRoleName: roles.name,
        status: membershipAuthorizations.status,
        authorizedAt: membershipAuthorizations.authorizedAt,
        governanceDecisionId: membershipAuthorizations.governanceDecisionId,
        authorizedByActorId: membershipAuthorizations.authorizedByActorId,
        consumedAt: membershipAuthorizations.consumedAt,
      })
      .from(membershipAuthorizations)
      .leftJoin(roles, eq(roles.id, membershipAuthorizations.intendedRoleId))
      .where(eq(membershipAuthorizations.tenantId, tenant.tenantId))
      .orderBy(desc(membershipAuthorizations.authorizedAt));

    return {
      status: "read",
      view: {
        viewerIsGovernanceAuthority: true,
        eligibleRoles: eligible,
        roleBaselineMissing: eligible.length === 0,
        authorizations: rows.map((row) => ({
          authorizationId: row.authorizationId,
          normalizedEmail: row.normalizedEmail,
          intendedRoleId: row.intendedRoleId,
          intendedRoleName: row.intendedRoleName,
          status: row.status,
          authorizedAt: row.authorizedAt.toISOString(),
          governanceDecisionId: row.governanceDecisionId,
          authorizedByActorId: row.authorizedByActorId,
          consumed: row.consumedAt !== null,
        })),
      },
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
