"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContext } from "@/features/auth-runtime/request-session.server";
import {
  declareActionRequestPurpose,
  type DeclareActionPurposeResult,
} from "@/features/action-authorization/declare-action-purpose.server";
import {
  approveActionRequest,
  rejectActionRequest,
} from "@/features/action-authorization/decide-action-request.server";
import { revokeActionPermit } from "@/features/action-authorization/revoke-action-permit.server";
import { executeAuthorizedAction } from "@/features/action-execution/execute-authorized-action.server";
import { executeRecordWork } from "@/features/governed-internal-action/execute-record-work.server";
import {
  executePlaceHuman,
  type PlacementActResult,
} from "@/features/governed-internal-action/execute-place-human.server";
import type {
  ActionApprovalResult,
  ActionRejectionResult,
  ActionRevocationResult,
} from "@/features/action-authorization/contracts";
import type { ExecutionResult } from "@/features/action-execution/contracts";
import type { InternalActResult } from "@/features/governed-internal-action/execute-record-work.server";
import {
  writeStandingMutationAuthorization,
  type StandingMutationWriteResult,
} from "@/features/standing-mutation-authority/authorize-standing-mutation.server";
import { readStandingMutations } from "@/features/standing-mutation-authority/read-standing-mutations.server";

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

/*
 * GIA-2 — PERFORM ONE AUTHORIZED PLACEMENT.
 *
 * A THIRD SERVER ACTION, NOT A DISPATCHER. It would be shorter to switch on the permit's action
 * kind inside one action and call whichever executor matched, and that is exactly what is avoided:
 * the kind would then be read from a row rather than from the function a reviewer is looking at,
 * and a future kind would join the switch without anybody deciding it should be executable from
 * here. Each executable act gets its own named entry point.
 *
 * Same refusal economics as the record-work action: a refused internal act aborts the transaction
 * that was spending the permit, so the permit reverts to `active` and nothing was written. Only a
 * success revalidates.
 *
 * `/director/organization` is revalidated because that is where the placement register is read.
 */
export async function executeGovernedPlacementAction(
  input: { readonly permitId: string },
): Promise<PlacementActResult> {
  const tenant = await resolveTenantContext();
  const result = await executePlaceHuman(tenant, {
    permitId: String(input?.permitId ?? ""),
  });
  if (result.status === "executed") {
    revalidatePath("/approvals");
    revalidatePath("/director/organization");
  }
  return result;
}

/*
 * PBGA-1 — DECLARE WHICH WORK A PENDING REQUEST SERVES.
 *
 * A DECLARATION, NOT A DECISION. It approves nothing, rejects nothing, mints no permit and executes
 * nothing: it records that a human said what organizational purpose this act is filed for, so the
 * person deciding about it can see that purpose before they decide.
 *
 * It sits beside the decision actions because that is where a pending request is looked at, and the
 * separation from them is the point — a Director may declare a purpose and still reject the act.
 *
 * The tenant and the declaring human are resolved SERVER-SIDE. The browser supplies two ids and
 * nothing else; it cannot name the declarer, cannot name another organization, and the storage
 * CHECK refuses a non-human declarer underneath.
 */
export async function declareActionPurposeAction(
  input: { readonly requestId: string; readonly workItemId: string },
): Promise<DeclareActionPurposeResult> {
  const tenant = await resolveTenantContext();
  const result = await declareActionRequestPurpose(tenant, {
    requestId: String(input?.requestId ?? ""),
    workItemId: String(input?.workItemId ?? ""),
  });
  if (result.status === "declared") revalidatePath("/approvals");
  return result;
}

/*
 * ── RUNG 2 · THE STANDING ENVELOPE BOUNDARY ─────────────────────────────────
 *
 * The two actions below are the ONLY client-crossable way a standing mutation envelope comes into
 * being or is taken away. They are the product surface the tenant machine-execution ceremony said
 * it was standing in for: *"a tenant Governance decision has to be reachable from a terminal until
 * a product surface exists"*. This is that surface; the ceremony is unchanged and still works.
 *
 * WHAT THE CLIENT MAY SUPPLY, EXHAUSTIVELY: which agent, which action kind, the two window
 * instants, a maximum number of acts, a minimum interval, a justification, and WHICH REVISION IT
 * WAS SHOWN. The tenant, the human, the Governance authority, the decision type, the outcome
 * vocabulary, the lineage revision, the supersession pointer and every timestamp are resolved
 * SERVER-SIDE by the released writer — so a forged tenant, authorizer, revision or decision is
 * unrepresentable here rather than filtered downstream.
 *
 * AUTHORIZING AN ENVELOPE IS NOT AN ACT, AND NOT AN ARMING. It mints no permit, spends nothing,
 * records no work and reaches no provider. It does not touch the deployment's
 * `machine-internal-execution` control, and it cannot enrol its own organization: both remain
 * possession-and-ceremony decisions that no browser can reach.
 *
 * IT CANNOT WIDEN ANYTHING. `actionKind` is checked against the released frozen machine-executable
 * set by the writer and again by a database CHECK, so a client asking for a kind outside it is
 * refused twice and adds nothing to what a machine may do.
 *
 * THESE ACTIONS DO NOT ISSUE. Neither imports the issuing seam — the firewall pins that no file
 * under `src/app` may name it — so no browser event can turn a proposal into a permit. Issuance is
 * decided by the released authority against a pending agent proposal, never by a click here.
 */
export async function authorizeStandingMutationAction(
  input: {
    readonly agentId: string;
    readonly actionKind: string;
    readonly notBefore: string;
    readonly notAfter: string;
    readonly maxActs: number;
    readonly minIntervalMinutes: number;
    readonly justification: string;
    readonly observedRevision: number | null;
  },
): Promise<StandingMutationWriteResult> {
  const tenant = await resolveTenantContext();
  /*
   * The two instants arrive as strings because that is what a browser has. They are parsed HERE and
   * an unparseable one becomes an `invalid-envelope` refusal from the writer's own bounds check —
   * never a silent `Invalid Date` that a comparison would then treat as false.
   */
  const result = await writeStandingMutationAuthorization(tenant, "active", {
    agentId: String(input?.agentId ?? ""),
    actionKind: String(input?.actionKind ?? ""),
    notBefore: new Date(String(input?.notBefore ?? "")),
    notAfter: new Date(String(input?.notAfter ?? "")),
    maxActs: Number(input?.maxActs),
    minIntervalMinutes: Number(input?.minIntervalMinutes),
    justification: String(input?.justification ?? ""),
    observedRevision:
      typeof input?.observedRevision === "number" ? input.observedRevision : null,
  });
  if (result.status === "written") revalidatePath("/approvals");
  return result;
}

/*
 * Withdrawing appends a `withdrawn` revision. It edits nothing, and it does NOT revoke permits the
 * envelope already issued: those are ordinary single-use permits with their own expiry and their
 * own revocation control, and collapsing the two would let one click silently unmake acts a human
 * separately authorized. Withdrawing where nothing stands is refused rather than recorded.
 *
 * ── WHY THE WINDOW, QUOTA AND CADENCE ARE RE-READ AND NOT ACCEPTED ──────────
 *
 * The withdrawn revision is a ROW, and its `not_before`, `not_after`, `max_acts` and
 * `min_interval_minutes` are NOT NULL — the released writer stores them, and it also writes them
 * into the Governance decision's evidence. So a withdrawal that supplied placeholder bounds would
 * record a decision claiming the envelope being withdrawn had a one-millisecond window and a quota
 * of one. That is not a cosmetic inaccuracy: it is a false Governance record, written by the act
 * whose whole purpose is to be auditable.
 *
 * They are therefore RE-READ from the effective revision through the released reader, server-side,
 * inside this action. The browser supplies which agent and which revision it was shown; it supplies
 * no bound, and cannot restate one.
 */
export async function withdrawStandingMutationAction(
  input: { readonly agentId: string; readonly justification: string; readonly observedRevision: number | null },
): Promise<StandingMutationWriteResult> {
  const tenant = await resolveTenantContext();
  const agentId = String(input?.agentId ?? "");

  const standing = await readStandingMutations(tenant);
  if (standing.status !== "read") return { status: "refused", reason: "persistence-unavailable" };
  const effective = standing.items.find((item) => item.agentId === agentId);
  /*
   * No effective revision for this agent means there is nothing to take back. Answered with the
   * writer's own word for it rather than a second vocabulary, so the surface has one wording to
   * render whether the refusal came from here or from inside the transaction.
   */
  if (!effective) return { status: "refused", reason: "no-active-authorization" };

  const result = await writeStandingMutationAuthorization(tenant, "withdrawn", {
    agentId,
    /* The row's own kind and bounds, never the caller's. */
    actionKind: effective.actionKind,
    notBefore: new Date(effective.notBefore),
    notAfter: new Date(effective.notAfter),
    maxActs: effective.maxActs,
    minIntervalMinutes: effective.minIntervalMinutes,
    justification: String(input?.justification ?? ""),
    observedRevision:
      typeof input?.observedRevision === "number" ? input.observedRevision : null,
  });
  if (result.status === "written") revalidatePath("/approvals");
  return result;
}
