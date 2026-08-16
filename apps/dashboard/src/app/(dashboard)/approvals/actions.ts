"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  approveActionRequest,
  rejectActionRequest,
} from "@/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "@/features/action-authorization/revoke-action-permit.server";
import type {
  ActionApprovalResult,
  ActionRejectionResult,
  ActionRevocationResult,
} from "@/features/action-authorization/contracts";

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
 * THERE IS NO EXECUTE ACTION IN THIS FILE, and none anywhere else the client can reach. Approving
 * mints a permit; spending it produces an authorization handoff; performing the act belongs to R3B,
 * which does not exist. A client cannot cause an effect through this boundary because there is no
 * representation in which it could ask for one.
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
