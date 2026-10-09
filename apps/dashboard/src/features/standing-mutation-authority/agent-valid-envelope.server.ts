/*
 * L-2b — does this agent hold a standing envelope that can still issue permits, now or later?
 *
 * Read INSIDE a caller's transaction. The effective envelope is the agent's highest revision, as
 * standing issuance reads it (its step 3). It is valid while that
 * revision is `active` and its window has not closed (`now() < not_after`, database clock). A window
 * that has not yet OPENED still counts: it would start issuing without anyone deciding again.
 * Reads only; a human ends an envelope by withdrawing it, or it expires.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { standingMutationAuthorizations } from "@/db/schema/standing-mutation-authorization";

export async function hasValidStandingEnvelopeWithin(
  tx: ControlPlaneDatabase,
  tenantId: string,
  agentId: string,
): Promise<boolean> {
  const [effective] = await tx
    .select({
      state: standingMutationAuthorizations.state,
      open: sql<boolean>`${standingMutationAuthorizations.notAfter} > now()`,
    })
    .from(standingMutationAuthorizations)
    .where(
      and(
        eq(standingMutationAuthorizations.tenantId, tenantId),
        eq(standingMutationAuthorizations.agentId, agentId),
      ),
    )
    .orderBy(desc(standingMutationAuthorizations.authorizationRevision))
    .limit(1);
  return effective !== undefined && effective.state === "active" && effective.open === true;
}
