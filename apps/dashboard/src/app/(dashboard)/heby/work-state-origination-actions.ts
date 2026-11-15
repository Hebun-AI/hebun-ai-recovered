"use server";

/*
 * WORK-UPDATE V1 — the boundary behind Heby's "propose a state change for this work item" affordance.
 *
 * Its own file, beside the other origination boundaries, so WORK-1's server actions stay unable to
 * reach agent origination. The browser supplies the item the person is looking at, the state they
 * chose and, when more than one agent is in service, which agent — three lookup values, each
 * resolved for the session's tenant on the server. The model is shown neither the item nor its
 * state. A proposal is a pending request for /approvals; nothing is approved and no work changes here.
 */
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  originateWorkStateChange,
  type OriginateWorkStateResult,
} from "@/features/agent-origination/originate-work-state.server";
import {
  preflightWorkStateOrigination,
  readWorkStateAgentChoices,
} from "@/features/origination-availability/read-origination-availability.server";
import type { WorkStateAgentChoices } from "@/features/origination-availability/contracts";
import { revalidatePath } from "next/cache";
import {
  assignWorkDraft,
  readWorkDraftChoices,
  reviseWorkDraft,
  type AssignWorkDraftResult,
  type ReviseWorkDraftResult,
  type WorkDraftChoices,
} from "@/features/agent-work/assign-work-draft.server";
import { readResearchChoices, type ResearchChoices } from "@/features/agent-work/assign-research-report.server";
import {
  authorizeStandingResearch,
  readStandingResearch,
  runStandingResearchNow,
  withdrawStandingResearch,
  type RunStandingResearchResult,
} from "@/features/standing-research-authority/standing-research.server";
import type { StandingResearchAuthorizationRecord, StandingResearchWriteResult } from "@/features/standing-research-authority/contracts";

export async function proposeWorkStateChangeAction(input: {
  readonly workItemId: string;
  readonly toState: string;
  readonly agentId?: string;
}): Promise<OriginateWorkStateResult> {
  return originateWorkStateChange(
    {
      workItemId: typeof input?.workItemId === "string" ? input.workItemId : "",
      toState: input?.toState,
      ...(typeof input?.agentId === "string" ? { agentId: input.agentId } : {}),
    },
    { resolveTenant: resolveTenantContext, preflight: (tenant, agentId, workScope) => preflightWorkStateOrigination(tenant, agentId, workScope) },
  );
}

/*
 * WORK-UPDATE-AGENT-SELECTION-1 — the chooser's list for the item the person is looking at: this
 * tenant's in-service agents and whether each is responsible for the item's work domain. A read;
 * the item id is a lookup key resolved for the session's tenant. It decides nothing — the proposal
 * above re-resolves whichever agent is sent.
 */
export async function readWorkStateAgentChoicesAction(input: { readonly workItemId: string }): Promise<WorkStateAgentChoices> {
  return readWorkStateAgentChoices(await resolveTenantContext(), typeof input?.workItemId === "string" ? input.workItemId : "");
}

/*
 * AGENT-EXECUTION-1 — the agent work doors for the same work item. The tenant comes from the session;
 * the client sends ids and words, which the seam answers against this tenant's records. Linking the
 * draft as this work's evidence is NOT here: it is the person's own act on /director/work (WEV-1).
 */
export async function readWorkDraftChoicesAction(input: { readonly workItemId: string }): Promise<WorkDraftChoices> {
  return readWorkDraftChoices(await resolveTenantContext(), input?.workItemId);
}

export async function assignWorkDraftAction(input: {
  readonly workItemId: string;
  readonly agentId: string;
  readonly prompt: string;
  readonly title: string;
  readonly artifactType: string;
  readonly intendedDestination?: string;
}): Promise<AssignWorkDraftResult> {
  const result = await assignWorkDraft(
    {
      workItemId: input?.workItemId,
      agentId: input?.agentId,
      prompt: input?.prompt,
      title: input?.title,
      artifactType: input?.artifactType,
      ...(input?.intendedDestination === undefined ? {} : { intendedDestination: input.intendedDestination }),
    },
    { resolveTenant: resolveTenantContext },
  );
  if (result.status === "prepared" || result.status === "prepared-stale") revalidatePath("/operations");
  return result;
}

/*
 * P6-1 / P6-2 — the research door for the same work item. The tenant comes from the session; the client
 * sends ids, words and the revision number it was looking at. Research runs ONLY under the tenant's
 * standing research authorization (P6-2): Governance writes the brief, agent and work item, and "run now"
 * runs exactly that brief. The seam asks every other authority again before the model and files an
 * UNSOURCED RESEARCH DRAFT for review.
 */
export async function readResearchChoicesAction(input: { readonly workItemId: string }): Promise<{
  readonly choices: ResearchChoices;
  readonly standing: StandingResearchAuthorizationRecord | null | "unavailable";
}> {
  const tenant = await resolveTenantContext();
  const [choices, standing] = await Promise.all([readResearchChoices(tenant, input?.workItemId), readStandingResearch(tenant)]);
  return { choices, standing: standing.status === "read" ? standing.authorization : "unavailable" };
}

export async function authorizeStandingResearchAction(input: {
  readonly workItemId: string;
  readonly agentId: string;
  readonly title: string;
  readonly brief: string;
  readonly justification: string;
  readonly observedAuthorizationRevision: number | null;
}): Promise<StandingResearchWriteResult> {
  return authorizeStandingResearch(await resolveTenantContext(), {
    workItemId: input?.workItemId,
    agentId: input?.agentId,
    title: input?.title,
    brief: input?.brief,
    justification: input?.justification,
    observedAuthorizationRevision: typeof input?.observedAuthorizationRevision === "number" ? input.observedAuthorizationRevision : null,
  });
}

export async function withdrawStandingResearchAction(input: {
  readonly justification: string;
  readonly observedAuthorizationRevision: number | null;
}): Promise<StandingResearchWriteResult> {
  return withdrawStandingResearch(await resolveTenantContext(), {
    justification: input?.justification,
    observedAuthorizationRevision: typeof input?.observedAuthorizationRevision === "number" ? input.observedAuthorizationRevision : null,
  });
}

export async function runStandingResearchNowAction(input: { readonly observedAuthorizationRevision: number }): Promise<RunStandingResearchResult> {
  const result = await runStandingResearchNow(
    { observedAuthorizationRevision: input?.observedAuthorizationRevision },
    { resolveTenant: resolveTenantContext },
  );
  if (result.status === "prepared") {
    revalidatePath("/operations");
    revalidatePath("/home");
  }
  return result;
}

/*
 * HEBY-WORKFLOW-1 — after Governance asked for changes on a draft linked to this work, the person asks a
 * responsible agent for the next revision. The revision and the change request the person read travel as
 * staleness keys only; the seam re-reads both, and the new revision waits for Governance review.
 */
export async function reviseWorkDraftAction(input: {
  readonly workItemId: string;
  readonly artifactId: string;
  readonly agentId: string;
  readonly prompt: string;
  readonly expectedRevisionNo: number;
  readonly reviewBasisDecisionId: string;
}): Promise<ReviseWorkDraftResult> {
  const result = await reviseWorkDraft(
    {
      workItemId: input?.workItemId,
      artifactId: input?.artifactId,
      agentId: input?.agentId,
      prompt: input?.prompt,
      expectedRevisionNo: input?.expectedRevisionNo,
      reviewBasisDecisionId: input?.reviewBasisDecisionId,
    },
    { resolveTenant: resolveTenantContext },
  );
  if (result.status === "prepared" || result.status === "prepared-stale") revalidatePath("/operations");
  return result;
}

