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
import { listWorkArtifacts } from "@/features/work-artifacts/read-work-artifacts.server";
import { RESEARCH_REPORT_ARTIFACT_TYPE } from "@/features/work-artifacts/contracts";
import { readAssistanceDataUse } from "@/features/external-ai-data-use/assistance-data-use.server";
import Link from "next/link";

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
  const [pending, awaiting, liveMap, recordedActs, work, humanNames, artifacts, assistance] = await Promise.all([
    readPendingActionRequests(tenant),
    readAwaitingDecisionAggregate(tenant),
    readLiveMapProjection(tenant),
    readSecurityRecordedActObservation(tenant),
    readWorkRegister(tenant),
    resolveHumanNames(tenant, tenant?.userId ? [tenant.userId] : []),
    listWorkArtifacts(tenant),
    readAssistanceDataUse(tenant),
  ]);
  /*
   * ACTIVATION-1 — first-run setup: Heby and agents send nothing to the AI processor until this
   * organization's Governance authority records the assistance decision. Point there; decide nothing.
   */
  const assistanceSetup =
    assistance.status === "read" && (!assistance.assistanceAuthorized || assistance.missingDataClasses.length > 0)
      ? assistance
      : null;
  /* One instant for every duration this page renders. */
  const evaluatedAt = new Date().toISOString();

  return (
    <>
    {assistanceSetup ? (
      <section aria-labelledby="assistance-setup" className="mx-auto mb-6 w-full max-w-5xl rounded-md border border-border bg-surface-subtle p-4 text-sm">
        <h2 id="assistance-setup" className="font-semibold text-fg">
          {assistanceSetup.assistanceAuthorized ? "AI assistance needs one more decision" : "Turn on AI assistance"}
        </h2>
        <p className="mt-1 text-fg-muted">
          {assistanceSetup.assistanceAuthorized
            ? "A data use that agents need is not yet covered by this organization’s decision."
            : "Heby and agents send nothing to the AI processor until this organization decides it may."}{" "}
          {assistanceSetup.viewerIsGovernanceAuthority
            ? "You hold Governance authority here, so you can decide it."
            : assistanceSetup.governanceEstablished
              ? "Only this organization’s Governance authority can decide it."
              : "First confirm your email address and accept Governance authority on the Governance page."}
        </p>
        <Link href="/governance/authority" className="mt-2 inline-block font-medium text-primary underline">
          Open AI assistance data use
        </Link>
      </section>
    ) : null}
    <CustomerHome
      name={tenant?.userId ? humanNames.get(tenant.userId) ?? null : null}
      organization={summariseLiveMap(liveMap)}
      waiting={toWaitingOnYou(pending, { evaluatedAt, aggregate: awaiting })}
      work={toWorkInMotion(work)}
      activity={recordedActs}
      research={
        artifacts.status === "read"
          ? {
              status: "read",
              reports: artifacts.artifacts
                .filter((a) => a.artifactType === RESEARCH_REPORT_ARTIFACT_TYPE)
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                .map(({ id, title, createdAt }) => ({ id, title, createdAt })),
            }
          : { status: "unavailable" }
      }
      evaluatedAt={evaluatedAt}
    />
    </>
  );
}
