"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  approveActionRequest,
  rejectActionRequest,
} from "@/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "@/features/action-authorization/revoke-action-permit.server";
import { executeAuthorizedAction } from "@/features/action-execution/execute-authorized-action.server";
import { executeRecordWork } from "@/features/governed-internal-action/execute-record-work.server";
import type {
  ActionApprovalResult,
  ActionRejectionResult,
  ActionRevocationResult,
} from "@/features/action-authorization/contracts";
import type { ExecutionResult } from "@/features/action-execution/contracts";
import type { InternalActResult } from "@/features/governed-internal-action/execute-record-work.server";

/*
 * The R3A authorization boundary — the only client-crossable way to authorize a consequential act.
 *
 * WHAT THE CLIENT MAY SUPPLY, EXHAUSTIVELY: which request or permit, a justification, a rejection
 * or revocation reason, and a REQUESTED lifetime it may shorten but never widen. Nothing else has a
 * parameter. The tenant, the actor, the Governance authority, the decision outcome, the payload
 * digest, the expiry ceiling, the permit state and every timestamp are resolved SERVER-SIDE from
 * the durable R1 session — so a forged `tenantId`, `actorId`, `digest`, `expiresAt`, `permitId`
 * owner or `approvedBy` is unrepresentable here rather than filtered somewhere downstream.
 *
 * THERE ARE NOW EXACTLY TWO EXECUTE ACTIONS (GIA-1), one per authorized action kind, and each takes
 * ONE parameter: which permit. Neither can be told the tenant, the recipient, the content, the
 * adapter, the digests, the title, the department or the handoff — every one of those is resolved
 * server-side from the durable session and the approved request, so a client that wanted to perform
 * something else has no representation in which to ask.
 *
 * TWO ACTIONS, NOT A DISPATCHER. Each names its own executor, and each executor RE-CHECKS the
 * permit's action kind inside its own transaction — so calling the wrong one is refused by the
 * authority rather than by a routing table, and a third executable act would need a third
 * deliberate export here rather than a new row in a map.
 *
 * APPROVING STILL DOES NOT EXECUTE. Approval mints a permit and stops; a SEPARATE, deliberate
 * human click spends it. Collapsing the two would erase the distinction R3A spent an entire phase
 * establishing, in the first line of the phase that depends on it.
 *
 * HEBY CANNOT REACH THIS FILE. Heby's server actions do not import this module, so no message,
 * model answer, slash command or voice transcript has a representation in which it could approve
 * OR execute anything. There is no worker, no scheduler and no queue that could call it either:
 * the only caller is a browser event from an authenticated human.
 *
 * THERE IS ALSO NO PROPOSE ACTION. A request is written by the Heby lifecycle server-side; letting
 * a browser post an arbitrary action request would make the proposal channel the weakest link in a
 * chain whose entire value is that the strong link comes later.
 *
 * Heby's server actions do not import this module, so no message, model answer, slash command or
 * voice transcript has a representation in which it could approve anything.
 */

export async function approveActionRequestAction(
  input: { readonly requestId: string; readonly justification: string; readonly requestedTtlSeconds?: number },
): Promise<ActionApprovalResult> {
  const tenant = await resolveTenantContext();
  const result = await approveActionRequest(tenant, {
    requestId: String(input?.requestId ?? ""),
    justification: String(input?.justification ?? ""),
    requestedTtlSeconds:
      typeof input?.requestedTtlSeconds === "number" ? input.requestedTtlSeconds : undefined,
  });
  if (result.status === "authorized") revalidatePath("/approvals");
  return result;
}

export async function rejectActionRequestAction(
  input: { readonly requestId: string; readonly justification: string; readonly rejectionReason: string },
): Promise<ActionRejectionResult> {
  const tenant = await resolveTenantContext();
  const result = await rejectActionRequest(tenant, {
    requestId: String(input?.requestId ?? ""),
    justification: String(input?.justification ?? ""),
    rejectionReason: String(input?.rejectionReason ?? ""),
  });
  if (result.status === "rejected") revalidatePath("/approvals");
  return result;
}

export async function revokeActionPermitAction(
  input: { readonly permitId: string; readonly justification: string; readonly revocationReason: string },
): Promise<ActionRevocationResult> {
  const tenant = await resolveTenantContext();
  const result = await revokeActionPermit(tenant, {
    permitId: String(input?.permitId ?? ""),
    justification: String(input?.justification ?? ""),
    revocationReason: String(input?.revocationReason ?? ""),
  });
  if (result.status === "revoked") revalidatePath("/approvals");
  return result;
}

/**
 * Spend one authorization on one external act (R3B).
 *
 * The Director clicks Execute. That click is the whole trigger — there is no automatic execution
 * on approval, no worker draining approved permits, and no scheduled sweep. An authorization that
 * is never clicked simply expires, which is the correct default for an irreversible act.
 *
 * The path revalidates on every terminal outcome, refusals included: a refused attempt changes
 * what the surface must show (the permit is spent) just as much as an accepted one does.
 */
export async function executeAuthorizedActionAction(
  input: { readonly permitId: string },
): Promise<ExecutionResult> {
  const tenant = await resolveTenantContext();
  const result = await executeAuthorizedAction(tenant, {
    permitId: String(input?.permitId ?? ""),
  });
  if (result.status !== "refused") revalidatePath("/approvals");
  return result;
}

/**
 * Spend one authorization on one governed INTERNAL act (GIA-1).
 *
 * The same shape and the same trigger as its external sibling: the Director clicks Execute, and
 * that click is the whole trigger. There is no automatic execution on approval, no worker draining
 * approved permits, and no scheduled sweep.
 *
 * WHAT DIFFERS IS THE COST OF A REFUSAL. A refused internal act aborts the transaction that was
 * spending the permit, so the permit reverts to `active` and NOTHING was written. Revalidating only
 * on success is therefore correct here and would be wrong for a send: an external attempt burns the
 * authorization and leaves a durable row the surface must show.
 *
 * Both routes are revalidated because both changed: the decision surface shows a spent permit, and
 * the work register now holds a row it did not hold before.
 */
export async function executeGovernedInternalActionAction(
  input: { readonly permitId: string },
): Promise<InternalActResult> {
  const tenant = await resolveTenantContext();
  const result = await executeRecordWork(tenant, {
    permitId: String(input?.permitId ?? ""),
  });
  if (result.status === "executed") {
    revalidatePath("/approvals");
    revalidatePath("/director/work");
  }
  return result;
}
