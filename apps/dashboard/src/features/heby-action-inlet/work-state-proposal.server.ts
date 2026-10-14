/*
 * heby-action-inlet/work-state-proposal.server.ts — FILING ONE GOVERNED DECLARED-STATE CHANGE
 * (WORK-UPDATE V1).
 *
 *     human chose item + state → agent proposed → prepareAction → recordAgentOriginatedActionRequest
 *
 * This files a REQUEST. It authorizes nothing and changes nothing. A human decides at `/approvals`,
 * and even an approved request changes nothing until a human executes it.
 *
 * ── WHAT IS FROZEN, AND WHERE EACH VALUE COMES FROM ──────────────────────────
 *
 * The item and the target state come from the HUMAN. `fromState` and the work domain come from the
 * row this module reads a moment before filing — never from the caller and never from a model. All
 * four are hashed into the digest, so the permit is bound to exactly that item, that transition and
 * that domain; the Work Authority refuses the act if the item no longer holds `fromState`.
 *
 * ── THE MANDATE AND RESPONSIBILITY ARE NOT ENFORCED HERE ─────────────────────
 *
 * `recordAgentOriginatedActionRequest` reads the agent's effective mandate before it writes and
 * refuses when the kind is outside its scope or the item's domain is outside its responsibility.
 * That is the one enforcement seam at origination; a second copy here would be one too many.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { prepareAction } from "@/features/heby-actions/action-preparer";
import {
  recordAgentOriginatedActionRequest,
  type ActionRequestDeps,
} from "@/features/action-authorization/record-action-request.server";
import type { AgentProposer } from "@/features/action-authorization/agent-proposer.server";
import type { ActionRequestRefusal } from "@/features/action-authorization/contracts";
import { readWorkStateTarget } from "@/features/organizational-work/read-work.server";
import {
  formatWorkItemRef,
  isWorkDeclaredState,
  type WorkDeclaredState,
} from "@/features/organizational-work/work-contracts";
import { formatWorkDomainRef } from "@/features/work-domain/work-scope";
import { SET_WORK_DECLARED_STATE_ACTION_KIND, SET_WORK_DECLARED_STATE_OWNER_WORKSPACE } from "./contracts";

/** What the human said: which item, and which state. Nothing else crosses this boundary. */
export interface WorkStateProposalInput {
  readonly workItemId: unknown;
  readonly toState: unknown;
}

export type WorkStateProposalRefusal =
  | "unauthenticated"
  /** The target state is not one of the closed declared states. */
  | "invalid-target-state"
  /** No work item of THIS tenant carries that id. Another tenant's looks identical. */
  | "work-unresolved"
  /** The item is retired. */
  | "work-retired"
  /** The item names no work domain, so no agent responsibility could be checked against it (D6). */
  | "work-not-domain-scoped"
  /** The item already holds the chosen state. A governed no-op is not filed. */
  | "state-unchanged"
  /** That exact change is already waiting for a decision. */
  | "already-pending"
  /** Work could not be read or the request could not be written. Nothing was filed. */
  | "persistence-unavailable"
  /** The prepared action did not reach human review, or the writer refused it. */
  | "not-authorizable";

export type WorkStateProposalResult =
  | {
      readonly status: "proposed";
      readonly receipt: {
        readonly requestId: string;
        readonly actionKind: typeof SET_WORK_DECLARED_STATE_ACTION_KIND;
        readonly fromState: WorkDeclaredState;
        readonly toState: WorkDeclaredState;
        readonly status: "pending-review";
      };
    }
  | {
      readonly status: "refused";
      readonly reason: WorkStateProposalRefusal;
      /** The writer's own refusal (mandate, responsibility), when it is the one that refused. */
      readonly authorityRefusal?: ActionRequestRefusal;
    };

export type WorkStateProposalDeps = ActionRequestDeps;

function refused(reason: WorkStateProposalRefusal, authorityRefusal?: ActionRequestRefusal): WorkStateProposalResult {
  return authorityRefusal ? { status: "refused", reason, authorityRefusal } : { status: "refused", reason };
}

/**
 * Re-read the human's chosen item for THIS tenant, and refuse anything a governed change cannot be
 * about. Exported so the origination can refuse BEFORE any model call; the filing below asks again.
 */
export async function resolveWorkStateTarget(
  tenant: TenantContext,
  input: WorkStateProposalInput,
  deps: WorkStateProposalDeps,
): Promise<
  | {
      readonly status: "resolved";
      readonly workItemId: string;
      readonly title: string;
      readonly fromState: WorkDeclaredState;
      readonly toState: WorkDeclaredState;
      readonly workDomainId: string;
    }
  | { readonly status: "refused"; readonly reason: WorkStateProposalRefusal }
> {
  if (!isWorkDeclaredState(input?.toState)) return { status: "refused", reason: "invalid-target-state" };
  const read = await readWorkStateTarget(tenant, input?.workItemId, { getDb: deps.getDb });
  if (read.status === "unavailable") return { status: "refused", reason: "persistence-unavailable" };
  if (read.status === "unresolved") return { status: "refused", reason: "work-unresolved" };
  const target = read.target;
  if (!target.inService) return { status: "refused", reason: "work-retired" };
  if (target.workDomainId === null) return { status: "refused", reason: "work-not-domain-scoped" };
  if (target.declaredState === input.toState) return { status: "refused", reason: "state-unchanged" };
  return {
    status: "resolved",
    workItemId: target.workItemId,
    title: target.title,
    fromState: target.declaredState,
    toState: input.toState,
    workDomainId: target.workDomainId,
  };
}

/**
 * File the agent-originated proposal. There is no human entry point: in V1 a state change is only
 * ever proposed by an agent a human asked, and only through this function.
 */
export async function proposeAgentOriginatedWorkStateAction(
  tenant: TenantContext | null,
  input: WorkStateProposalInput,
  proposer: AgentProposer,
  deps: WorkStateProposalDeps = {},
  originationInvocationId?: string,
  /** The agent's normalized rationale. Stored beside the request, never part of the digest. */
  proposalRationale?: string,
): Promise<WorkStateProposalResult> {
  if (typeof window !== "undefined") {
    throw new Error("Work state proposals are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const target = await resolveWorkStateTarget(tenant, input, deps);
  if (target.status === "refused") return refused(target.reason);

  /* The RE-FORMATTED references, so what is frozen provably came from the row that was read. */
  const workItemRef = formatWorkItemRef(target.workItemId);
  const prepared = prepareAction({
    actionKind: SET_WORK_DECLARED_STATE_ACTION_KIND,
    requestingWorkspace: SET_WORK_DECLARED_STATE_OWNER_WORKSPACE,
    target: { kind: "record", ref: workItemRef, label: target.title, sourceClass: "work" },
    proposedArguments: {
      workItemRef,
      fromState: target.fromState,
      toState: target.toState,
      workScope: "domain",
      workDomainRef: formatWorkDomainRef(target.workDomainId),
    },
    /* One citation, because one row was read a moment ago. It IS the read. */
    evidence: [{ sourceClass: "work", recordRef: workItemRef, lifecycle: "settled" }],
  });
  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") return refused("not-authorizable");

  const recorded = await recordAgentOriginatedActionRequest(
    tenant,
    prepared,
    proposer,
    deps,
    originationInvocationId,
    proposalRationale,
  );
  if (recorded.status === "recorded") {
    return {
      status: "proposed",
      receipt: {
        requestId: recorded.requestId,
        actionKind: SET_WORK_DECLARED_STATE_ACTION_KIND,
        fromState: target.fromState,
        toState: target.toState,
        status: "pending-review",
      },
    };
  }
  if (recorded.reason === "already-pending") return refused("already-pending");
  if (recorded.reason === "persistence-unavailable") return refused("persistence-unavailable");
  return refused("not-authorizable", recorded.reason);
}

/*
 * WORK-UPDATE V1 (Option A) — WHICH ITEM DID THE PERSON COME FROM?
 *
 * The Work register links to /heby with the item as a lookup key; nothing else travels. This resolves
 * it for the SESSION's tenant through the Work Authority's own read, exactly as a proposal would: a
 * foreign or malformed id is `unresolved`, indistinguishable from absent. The title and state are for
 * the person's screen only — this read feeds no model, and origination re-resolves the item itself.
 */
export type WorkStateSelection =
  | {
      readonly status: "selected";
      readonly workItemId: string;
      readonly title: string;
      readonly declaredState: WorkDeclaredState;
      readonly inService: boolean;
      readonly domainScoped: boolean;
    }
  | { readonly status: "unresolved" }
  | { readonly status: "unavailable" };

export async function readWorkStateSelection(
  tenant: TenantContext | null,
  workItemId: unknown,
  deps: WorkStateProposalDeps = {},
): Promise<WorkStateSelection> {
  if (typeof window !== "undefined") throw new Error("Work state selection is server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unavailable" };
  const read = await readWorkStateTarget(tenant, workItemId, { getDb: deps.getDb });
  if (read.status !== "found") return read.status === "unresolved" ? { status: "unresolved" } : { status: "unavailable" };
  return {
    status: "selected",
    workItemId: read.target.workItemId,
    title: read.target.title,
    declaredState: read.target.declaredState,
    inService: read.target.inService,
    domainScoped: read.target.workDomainId !== null,
  };
}
