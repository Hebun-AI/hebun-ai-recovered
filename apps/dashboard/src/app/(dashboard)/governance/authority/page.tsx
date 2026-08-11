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
  const [authorityLookup, entitlement, roster, candidates] = await Promise.all([
    readGovernanceAuthority(tenant),
    readGenesisNomination(tenant),
    // G3: the tenant's full authority roster with provenance, and who could receive a delegation.
    // Both are read server-side and both return empty for a caller with no Governance authority.
    readAuthorityRoster(tenant),
    readDelegationCandidates(tenant),
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
      <p className="max-w-2xl text-xs text-fg-muted">{GENESIS_ACCEPTANCE_ASSURANCE.limitation}</p>
      <p className="max-w-2xl text-xs text-fg-muted">{DECISION_NON_EFFECT}</p>
    </div>
  );
}
