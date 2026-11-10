import { CustomerHome } from "@/components/customer-home/customer-home";
import { toWaitingOnYou, toWorkInMotion } from "@/features/command-overview/workspace-model";
import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";
import { readAwaitingDecisionAggregate } from "@/features/action-authorization/awaiting-decision-aggregate.server";
import { readWorkRegister } from "@/features/organizational-work/read-work.server";
import { readLiveMapProjection } from "@/features/live-map/read-live-map.server";
import { summariseLiveMap } from "@/features/live-map/awareness";
import { readSecurityRecordedActObservation } from "@/features/governance-activity/security-observation-source.server";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { resolveHumanNames } from "@/features/auth-runtime/human-label-read.server";

export const metadata = { title: "Home — Hebun AI" };

/*
 * P3 — the Customer Dashboard (`/home`), the landing of the Customer Workspace navigation.
 *
 * It owns no data. The tenant is resolved ONCE, here, server-side, and handed to the same released,
 * tenant-scoped read seams Command uses — taken unchanged, none of them accepting a tenant id from
 * the request. Each fails inside its own reader, so one unreadable source leaves the rest intact,
 * and an unreadable source is shown as unreadable, never as zero. Nothing here writes.
 *
 * The Director's `/command` is untouched; this is a separate route, reached from the customer shell.
 */
export default async function CustomerHomePage() {
  const tenant = await resolveTenantContext();
  const [pending, awaiting, liveMap, recordedActs, work, humanNames] = await Promise.all([
    readPendingActionRequests(tenant),
    readAwaitingDecisionAggregate(tenant),
    readLiveMapProjection(tenant),
    readSecurityRecordedActObservation(tenant),
    readWorkRegister(tenant),
    resolveHumanNames(tenant, tenant?.userId ? [tenant.userId] : []),
  ]);
  /* One instant for every duration this page renders. */
  const evaluatedAt = new Date().toISOString();

  return (
    <CustomerHome
      name={tenant?.userId ? humanNames.get(tenant.userId) ?? null : null}
      organization={summariseLiveMap(liveMap)}
      waiting={toWaitingOnYou(pending, { evaluatedAt, aggregate: awaiting })}
      work={toWorkInMotion(work)}
      activity={recordedActs}
      evaluatedAt={evaluatedAt}
    />
  );
}
