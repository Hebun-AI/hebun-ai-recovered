import { CommandOverview } from "@/components/command-overview/command-overview";
import {
  getExpressIntentSummary,
  toConnectedCapability,
  toWaitingOnYou,
  toWorkInMotion,
} from "@/features/command-overview/workspace-model";
import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";
import { readAwaitingDecisionAggregate } from "@/features/action-authorization/awaiting-decision-aggregate.server";
import { readWorkRegister } from "@/features/organizational-work/read-work.server";
import { readLiveMapProjection } from "@/features/live-map/read-live-map.server";
import { summariseLiveMap } from "@/features/live-map/awareness";
import { readSecurityRecordedActObservation } from "@/features/governance-activity/security-observation-source.server";
import { summariseSecurityObservation } from "@/features/security-center/awareness";
import { listConnections } from "@/features/integration-authority/integration-read.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";

export const metadata = { title: "Command — Hebun AI" };

/*
 * Command — the executive operating ledger (CMD-V2), and the default authenticated landing.
 *
 * ── WHAT THIS ROUTE OWNS ─────────────────────────────────────────────────────
 *
 * The tenant, resolved ONCE, here. That is the convention `/approvals` and `/heby` already follow
 * and the reason no Command component may resolve it: N resolutions per request could describe N
 * different instants, and a component that resolves its own context is a component that can be
 * moved somewhere it should not read.
 *
 * ── EVERY READ BELONGS TO SOMEBODY ELSE ──────────────────────────────────────
 *
 * Seven released seams, each owned by the authority it reads from, each taken unchanged, each handed
 * the SAME tenant this route resolved once, and each failing inside its own reader: an unreadable
 * ledger leaves the Live Map region intact and vice versa. Not one of them takes a tenant, work,
 * department or connection identifier, so pointing any of them at another organization is
 * unrepresentable rather than refused.
 *
 *   readPendingActionRequests        the action-authorization authority's bounded pending queue
 *   readAwaitingDecisionAggregate    the same authority's UNBOUNDED aggregate — the only honest
 *                                    source for "oldest" and for a true total
 *   readLiveMapProjection            L4's released projection
 *   readSecurityRecordedActObservation  E2-2's released recorded-act seam
 *   readWorkRegister                 WORK-1's organizational work register
 *   listConnections                  INT-5A's WRITER-FREE half of the integration authority
 *   resolveHumanNames                Identity's name-only, tenant-gated presentation projection
 *
 * ── THE SEVENTH IMPORT IS THE ONE CMD-V2 ADDED, AND IT IS NARROW ─────────────
 *
 * `listConnections` joins the read set so the page can answer "what is actually connected" from the
 * ONE authority that records it. The alternative — drawing provider tiles from the catalog, from a
 * credential row or from a capability descriptor — would state a connection the database never
 * made. INT-5A split the reads out of the module that can create, disconnect and attach credentials
 * precisely so a consumer like this one holds no reference to a writer; that split is why this
 * import is admissible at all, and the firewall test enumerates it rather than pattern-matching it.
 *
 *     CATALOG != CONNECTION      CREDENTIAL != CONNECTED      CONNECTED != CAPABILITY AVAILABLE
 *
 * PERMITS ARE STILL NOT READ HERE, ON PURPOSE. A permit is an authorization already granted — a
 * different lifecycle stage from a request awaiting one. The surest way to guarantee the two are
 * never merged into a single number is not to fetch the second at all.
 *
 * ── WHAT REPLACED THE THREE-FILE LANDING ─────────────────────────────────────
 *
 * The released landing rendered an awareness band, a three-section Overview and a work register as
 * three siblings, because CMD-B1's composition pin could not admit a fourth region. The Director
 * retired that pin. Every region is now declared in `COMMAND_REGIONS` and composed by
 * `CommandOverview`, so the page a Director meets is the page a test can assert. This route is left
 * with what a route should own: one tenant, seven reads, one instant, and one component.
 */

export default async function CommandPage() {
  const tenant = await resolveTenantContext();
  const [pending, awaiting, liveMap, recordedActs, work, connections, humanNames] = await Promise.all([
    readPendingActionRequests(tenant),
    readAwaitingDecisionAggregate(tenant),
    readLiveMapProjection(tenant),
    readSecurityRecordedActObservation(tenant),
    readWorkRegister(tenant),
    listConnections(tenant),
    resolveHumanNames(tenant, tenant?.userId ? [tenant.userId] : []),
  ]);
  /* ONE instant for every duration this page renders. Resolved here, never inside a component. */
  const evaluatedAt = new Date().toISOString();

  return (
    <CommandOverview
      waiting={toWaitingOnYou(pending, { evaluatedAt, aggregate: awaiting })}
      intent={getExpressIntentSummary()}
      work={toWorkInMotion(work)}
      capability={toConnectedCapability(connections)}
      organization={summariseLiveMap(liveMap)}
      liveMap={liveMap}
      security={summariseSecurityObservation(recordedActs)}
      recordedActs={recordedActs}
      humanName={tenant?.userId ? humanNames.get(tenant.userId) ?? null : null}
    />
  );
}
