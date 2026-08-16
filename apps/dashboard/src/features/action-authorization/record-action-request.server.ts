/*
 * action-authorization/record-action-request.server.ts — freezing a proposal so a human can
 * decide about it (R3A).
 *
 * WHAT THIS MODULE DOES, AND THE ONE THING IT REFUSES TO DO. It takes a `HebyPreparedAction` the
 * deterministic Heby lifecycle already produced and writes it down. It does not re-run the gates,
 * does not re-validate arguments against the tool schema, and does not decide anything: Phase 17
 * owns preparation and this phase owns durability. Re-deriving would create a second opinion about
 * what was prepared, and two opinions is one too many.
 *
 * WHY ONLY `REQUIRES_HUMAN_REVIEW` IS ACCEPTED. Every other terminal state means the action must
 * not reach a human: `RESTRICTED` is a device action or a confused-deputy attempt, `UNAVAILABLE`
 * has no substrate, `EXPIRED` rests on stale evidence, `FAILED` never validated, and
 * `EXECUTION_ELIGIBLE` is read-only work that needs no permission. Persisting any of them would
 * put a question in front of the Director that the architecture already answered.
 *
 * NOTHING HERE IS AUDITED. A proposal moves no authority; the row IS the record. The audit ledger
 * opens at the first authority-bearing event, which is the human's decision.
 *
 * NO AUTHORITY IS CONSULTED, AND NONE IS GRANTED. Recording a request asks nothing of Governance —
 * anyone with a tenant session may propose. That is deliberate: proposing is free, and the entire
 * cost is paid at the approval boundary, where a human and a Governance decision are both
 * mandatory. This module cannot approve, cannot mint a permit, and does not import the permit
 * table.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/bootstrap-authority.server";
import type { HebyPreparedAction } from "@/features/heby-actions/contracts";
import {
  asCanonicalPayload,
  digestCanonicalAction,
  type CanonicalPayload,
} from "./canonical-payload";
import {
  AUTHORIZABLE_SIDE_EFFECTS,
  type ActionRequestRefusal,
  type ActionRequestResult,
} from "./contracts";

export interface ActionRequestDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

function refused(reason: ActionRequestRefusal): ActionRequestResult {
  return { status: "refused", reason };
}

/**
 * Persist one prepared consequential action as a pending request.
 *
 * The caller supplies the prepared action and nothing else. It cannot supply the tenant (session),
 * the proposer (session), the digest (computed here), the status (always `pending`), or any
 * approval field — those columns are unreachable from this module's insert.
 */
export async function recordActionRequest(
  tenant: TenantContext | null,
  prepared: HebyPreparedAction | null,
  deps: ActionRequestDeps = {},
): Promise<ActionRequestResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action requests are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!prepared) return refused("not-authorizable");

  /* Only a proposal that actually reached the human-review boundary may be persisted. */
  if (prepared.lifecycleState !== "REQUIRES_HUMAN_REVIEW") return refused("not-authorizable");
  if (!AUTHORIZABLE_SIDE_EFFECTS.includes(prepared.sideEffect)) {
    return refused("side-effect-not-authorizable");
  }
  if (!prepared.argumentsValid) return refused("arguments-invalid");

  /*
   * The arguments already passed the tool's typed schema, so this narrowing should always succeed.
   * It is checked anyway: this is the last point before a value becomes something a human is asked
   * to approve, and it fails closed rather than trusting upstream.
   */
  const payload: CanonicalPayload | null = asCanonicalPayload(prepared.arguments);
  if (!payload) return refused("arguments-invalid");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const targetKind = prepared.target?.kind ?? null;
  const targetRef = prepared.target?.ref ?? null;

  const payloadDigest = digestCanonicalAction({
    actionKind: prepared.actionKind,
    toolId: prepared.toolId,
    targetKind,
    targetRef,
    payload,
  });

  try {
    /*
     * A pre-check, NOT the invariant. `heby_action_requests_one_pending_per_digest_uq` is what
     * actually prevents two live proposals for the same act; this read exists only so the ordinary
     * case gets a named refusal instead of a constraint violation. The catch below is the real
     * guard when two callers race.
     */
    const existing = await db
      .select({ id: hebyActionRequests.id })
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.tenantId, tenant.tenantId),
          eq(hebyActionRequests.payloadDigest, payloadDigest),
          eq(hebyActionRequests.status, "pending"),
        ),
      )
      .limit(1);
    if (existing.length > 0) return refused("already-pending");

    const rows = await db
      .insert(hebyActionRequests)
      .values({
        tenantId: tenant.tenantId,
        actionId: prepared.actionId,
        payloadDigest,
        actionKind: prepared.actionKind,
        toolId: prepared.toolId,
        sideEffect: prepared.sideEffect,
        reversibility: prepared.reversibility,
        targetKind,
        targetRef,
        targetLabel: prepared.target?.label ?? null,
        ownerWorkspace: prepared.ownerWorkspace,
        requestingWorkspace: prepared.requestingWorkspace,
        canonicalPayload: payload,
        expectedEffect: prepared.expectedEffect,
        consequences: prepared.consequences,
        evidence: prepared.evidence,
        /*
         * Heby proposed it. `agent` is the honest actor type, and it is exactly why the approver
         * column carries a `human` CHECK: the same row records that a machine asked and a person
         * answered.
         */
        proposedByActorType: "agent",
        proposedByActorId: tenant.userId,
        status: "pending",
        createdAt: now,
        createdBy: tenant.userId,
        createdByType: "human",
      })
      .returning({ id: hebyActionRequests.id });

    const requestId = rows[0]?.id;
    if (!requestId) return refused("persistence-unavailable");
    return { status: "recorded", requestId, payloadDigest };
  } catch (error) {
    /*
     * The unique index is the authority on duplicates, not the pre-check above. A caller that lost
     * the race must be told the same thing the pre-check would have told it — reporting a
     * persistence failure would make a working invariant look like a broken database.
     */
    if (isUniqueViolation(error)) return refused("already-pending");
    return refused("persistence-unavailable");
  }
}

/** PostgreSQL `unique_violation`. Read from the driver's code, never from the message text. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "23505"
  );
}
