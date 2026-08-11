import {
  GenesisAcceptanceCard,
  type GenesisBlock,
} from "@/components/governance-genesis/genesis-acceptance-card";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  isGenesisPersistenceConfigured,
  readGenesisNomination,
} from "@/features/governance-genesis/genesis-acceptance.server";
import { GENESIS_OPERATOR_ROOT } from "@/features/governance-genesis/contracts";

export const metadata = { title: "Genesis Nomination — Hebun AI" };

/*
 * Genesis Nomination (G2.1) — KEY 2 of the two-key ceremony, and the only product surface anywhere
 * in Hebun that touches pre-Governance entitlement.
 *
 * WHAT THIS PAGE CAN DO: show whether this tenant has a genesis nomination, and — only for the human
 * it actually names — accept it.
 *
 * WHAT IT CANNOT DO: create one. Nominating is a local operator ceremony
 * (`npm run governance:nominate-genesis`) run out-of-band, so no signed-in user, of any role band,
 * can nominate anybody including themselves. The absence of a nominate control here is the design,
 * not an unfinished edge.
 *
 * The tenant, the actor, the identity and the session are all resolved SERVER-SIDE. The block reason
 * shown to a visitor is the REAL one, in resolution order, so nobody is offered a ceremony that will
 * fail.
 */
export default async function GenesisNominationPage() {
  const tenant = await resolveTenantContext();
  const lookup = await readGenesisNomination(tenant);

  const nomination = lookup.status === "read" ? lookup.nomination : null;

  const block: GenesisBlock | undefined = !tenant
    ? { kind: "unauthenticated" }
    : !isGenesisPersistenceConfigured() || lookup.status === "unavailable"
      ? { kind: "persistence-unavailable" }
      : !nomination
        ? { kind: "no-nomination" }
        : !nomination.viewerIsNominatedHuman
          ? { kind: "not-the-nominated-human" }
          : nomination.status === "accepted"
            ? { kind: "already-accepted", acceptedAt: nomination.acceptedAt }
            : nomination.status === "revoked"
              ? { kind: "revoked" }
              : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <div className="min-w-0 max-w-2xl">
        <GenesisAcceptanceCard block={block} nomination={nomination} />
      </div>
      <p className="max-w-2xl text-xs text-fg-muted">{GENESIS_OPERATOR_ROOT.limitation}</p>
    </div>
  );
}
