"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import { establishGovernanceAuthority } from "@/features/governance-decision/bootstrap-authority.server";
import { recordGovernanceDecision } from "@/features/governance-decision/decision-authority.server";
import type {
  BootstrapResult,
  DecisionResult,
} from "@/features/governance-decision/contracts";
import {
  delegateGovernanceAuthority,
  revokeGovernanceAuthority,
} from "@/features/governance-decision/authority-delegation.server";
import type {
  DelegationResult,
  RevocationResult,
} from "@/features/governance-decision/delegation-contracts";

/*
 * The G2 Governance boundary — the only client-crossable way to write a Governance decision.
 *
 * WHAT THE CLIENT MAY SUPPLY, EXHAUSTIVELY: a justification, and (for an ordinary decision) a
 * decision type and a subject reference. Nothing else has a parameter. The tenant, the actor, the
 * identity, the session, the authority source, the bootstrap flag, the outcome and every timestamp
 * are resolved SERVER-SIDE from the durable R1 session — so a forged `tenantId`, `actorId`,
 * `authIdentityId`, `roleId`, `authorityRank`, `bootstrap`, `sessionId` or `decisionId` is
 * unrepresentable here rather than filtered somewhere downstream.
 *
 * There is deliberately NO update, delete, supersede, delegate, revoke, escalate, approve or appeal
 * action in this file or anywhere else the client can reach. Reversing a decision is itself a
 * Governance decision, and that runtime does not exist.
 *
 * Heby's server actions do not import this module, so no message, model answer, slash command or
 * voice transcript has a representation in which it could reach Governance.
 */

/*
 * ── G3: moving Governance authority ─────────────────────────────────────────────────────────────
 *
 * The client names the human to grant, or the delegation to end, and writes a justification.
 * Everything authoritative — the tenant, the caller's identity, whether they hold authority and how,
 * the decision type, the authority source, the session, the timestamp — is resolved server-side.
 *
 * Neither action can end the genesis: a revocation's subject is a delegation decision, and the
 * bootstrap decision is not one (A2-a).
 */
export async function delegateGovernanceAuthorityAction(input: {
  toUserId: string;
  justification: string;
}): Promise<DelegationResult> {
  const tenant = await resolveTenantContext();
  const result = await delegateGovernanceAuthority(tenant, {
    toUserId: input?.toUserId ?? "",
    justification: input?.justification ?? "",
  });
  if (result.status === "delegated") revalidatePath("/governance/authority");
  return result;
}

/** End one delegated authority. Never deletes the delegation decision it names. */
export async function revokeGovernanceAuthorityAction(input: {
  delegationDecisionId: string;
  justification: string;
}): Promise<RevocationResult> {
  const tenant = await resolveTenantContext();
  const result = await revokeGovernanceAuthority(tenant, {
    delegationDecisionId: input?.delegationDecisionId ?? "",
    justification: input?.justification ?? "",
  });
  if (result.status === "revoked") revalidatePath("/governance/authority");
  return result;
}

/** Spend the tenant's accepted genesis entitlement to establish its first Governance authority. */
export async function establishGovernanceAuthorityAction(input: {
  justification: string;
}): Promise<BootstrapResult> {
  const tenant = await resolveTenantContext();
  const result = await establishGovernanceAuthority(tenant, {
    justification: input?.justification ?? "",
  });
  if (result.status === "established") revalidatePath("/governance/authority");
  return result;
}

/**
 * Record one ratify/reject decision under an established authority.
 *
 * Recording is ALL this does. A `ratify` decision does not mark Knowledge ratified — the server
 * module behind this action does not import the Knowledge schema at all.
 */
export async function recordGovernanceDecisionAction(input: {
  decisionType: string;
  subjectType: string;
  subjectId: string;
  justification: string;
}): Promise<DecisionResult> {
  const tenant = await resolveTenantContext();
  const result = await recordGovernanceDecision(tenant, {
    decisionType: input?.decisionType ?? "",
    subjectType: input?.subjectType ?? "",
    subjectId: input?.subjectId ?? "",
    justification: input?.justification ?? "",
  });
  if (result.status === "recorded") revalidatePath("/governance/authority");
  return result;
}
