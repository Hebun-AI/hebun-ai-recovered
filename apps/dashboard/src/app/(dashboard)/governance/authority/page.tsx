import {
  GovernanceAuthorityCard,
  type GovernanceBlock,
} from "@/components/governance-authority/governance-authority-card";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { readGenesisNomination } from "@/features/governance-genesis/genesis-acceptance.server";
import {
  isGovernancePersistenceConfigured,
  readGovernanceAuthority,
} from "@/features/governance-decision/bootstrap-authority.server";
import { GENESIS_ACCEPTANCE_ASSURANCE } from "@/features/governance-genesis/contracts";
import { DECISION_NON_EFFECT } from "@/features/governance-decision/contracts";
import { readAuthorityRoster } from "@/features/governance-decision/decision-authority.server";
import { readDelegationCandidates } from "@/features/governance-decision/authority-delegation.server";
import { AuthorityRosterCard } from "@/components/governance-authority/authority-roster-card";
import { MembershipAuthorizationCard } from "@/components/governance-authority/membership-authorization-card";
import { readMembershipAuthority } from "@/features/membership-authority/read-membership-authorizations.server";
import { MemberRoleProvisioningCard } from "@/components/governance-authority/member-role-provisioning-card";
import { readRoleBaselineState } from "@/features/tenant-role-baseline/provision-member-role.server";

export const metadata = { title: "Governance Authority — Hebun AI" };

/*
 * Governance Authority (G2) — the surface that establishes a tenant's first Governance authority.
 *
 * It reads TWO authorities and keeps them distinct, because collapsing them is the mistake this
 * whole chain exists to prevent:
 *
 *   `genesis_nominations`  entitlement — who MAY establish Governance          (G2.1)
 *   `decision_records`     authority   — whether Governance EXISTS, and in whom (G2)
 *
 * The block reason shown is the REAL one, in resolution order, so nobody is offered a
 * constitutional ceremony that will fail. Everything is resolved SERVER-SIDE.
 */
export default async function GovernanceAuthorityPage() {
  const tenant = await resolveTenantContext();
  const [authorityLookup, entitlement, roster, candidates, membership, roleBaseline] =
    await Promise.all([
    readGovernanceAuthority(tenant),
    readGenesisNomination(tenant),
    // G3: the tenant's full authority roster with provenance, and who could receive a delegation.
    // Both are read server-side and both return empty for a caller with no Governance authority.
    readAuthorityRoster(tenant),
    readDelegationCandidates(tenant),
    // I1: which future humans Governance has authorized, and which roles they may be authorized
    // into. Authority-only, like the candidate list — a non-authority receives an empty view.
    readMembershipAuthority(tenant),
    // I1.1: whether the tenant has its ordinary member role. Authority-gated like the rest.
    readRoleBaselineState(tenant),
  ]);

  const authority = authorityLookup.status === "read" ? authorityLookup.authority : null;
  const nomination = entitlement.status === "read" ? entitlement.nomination : null;

  const block: GovernanceBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : !isGovernancePersistenceConfigured() ||
        authorityLookup.status === "unavailable" ||
        entitlement.status === "unavailable"
      ? { kind: "persistence-unavailable" }
      : authority?.bootstrap
        ? {
            kind: "already-established",
            viewerIsAuthority: authority.viewerIsGovernanceAuthority,
          }
        : !nomination
          ? { kind: "no-entitlement" }
          : !nomination.viewerIsNominatedHuman
            ? { kind: "not-the-entitled-human" }
            : nomination.status !== "accepted"
              ? { kind: "entitlement-not-accepted" }
              : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <div className="min-w-0 max-w-2xl">
        <GovernanceAuthorityCard block={block} authority={authority} />
      </div>
      {roster.status === "read" && roster.roster.active.length > 0 ? (
        <div className="min-w-0 max-w-2xl">
          <AuthorityRosterCard
            roster={roster.roster}
            candidates={candidates}
            viewerUserId={tenant?.userId ?? null}
          />
        </div>
      ) : null}
      {roleBaseline.status === "read" && roleBaseline.viewerIsGovernanceAuthority ? (
        <div className="min-w-0 max-w-2xl">
          <MemberRoleProvisioningCard memberRoleId={roleBaseline.memberRoleId} />
        </div>
      ) : null}
      {membership.status === "read" && membership.view.viewerIsGovernanceAuthority ? (
        <div className="min-w-0 max-w-2xl">
          <MembershipAuthorizationCard
            eligibleRoles={membership.view.eligibleRoles}
            authorizations={membership.view.authorizations}
            roleBaselineMissing={membership.view.roleBaselineMissing}
          />
        </div>
      ) : null}
      <p className="max-w-2xl text-xs text-fg-muted">{GENESIS_ACCEPTANCE_ASSURANCE.limitation}</p>
      <p className="max-w-2xl text-xs text-fg-muted">{DECISION_NON_EFFECT}</p>
    </div>
  );
}
