/*
 * action-authorization/revoke-action-permit.server.ts — ending an authorization before it is
 * spent (R3A).
 *
 * WHY THIS SHIPS IN THE SAME PHASE AS ISSUANCE. I1 declared `revoked_at` and `revocation_reason`
 * on `membership_authorizations` and left them unwritten; closing that took a whole later phase,
 * and the same shape had already cost the invitation work once before. A revocation column with no
 * writer is not a safety feature, it is a claim. R3A therefore refuses to issue an authorization it
 * cannot withdraw, and this module is why the permit table's revocation columns are true.
 *
 * REVOCATION IS A GOVERNANCE DECISION, NOT A FIELD SOMEBODY FLIPPED. It costs a decision record, a
 * justification, and a stated reason, exactly like the approval it ends. The `revoke` decision type
 * is the same one G3 uses to end a delegation — ending an authorization is one act with one name,
 * whatever it ended — but its SUBJECT is the permit, so the ledger never confuses "this action may
 * no longer run" with "this human may no longer decide".
 *
 * WHAT REVOCATION DOES NOT TOUCH. The approved request keeps its `approved` status, its decision,
 * and its approver. History is not rewritten: a thing that was authorized was authorized, and the
 * revocation is a second fact placed after it rather than an erasure of the first.
 *
 * A CONSUMED PERMIT CANNOT BE REVOKED. Once spent, the authorization is gone and whatever it
 * authorized is R3B's problem; pretending to recall it would imply a reach into execution that R3A
 * does not have. The database `action_permits_terminal_exclusive_chk` enforces the same thing.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordActionAuthorizationEventWithin } from "@/features/governance-audit/action-authorization-audit.server";
import { resolveGovernanceDbOrNull, validateJustification } from "@/features/governance-decision/persistence.server";
import { writeGovernanceDecisionWithin } from "@/features/governance-decision/decision-authority.server";
import { resolveGovernanceAuthority } from "@/features/governance-decision/authority-read.server";
import {
  ACTION_AUDIT_PERMIT_REVOKED,
  ACTION_PERMIT_SUBJECT_TYPE,
  ACTION_REVOCATION_DECISION_TYPE,
  REVOCATION_REASON_MAX_LENGTH,
  type ActionRevocationRefusal,
  type ActionRevocationResult,
} from "./contracts";

export interface ActionRevocationDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

function refused(reason: ActionRevocationRefusal): ActionRevocationResult {
  return { status: "refused", reason };
}

/**
 * Revoke one live permit.
 *
 * The client supplies which permit, a justification, and a stated reason. It cannot supply the
 * tenant, the actor, the authority source, or the resulting state.
 */
export async function revokeActionPermit(
  tenant: TenantContext | null,
  input: {
    readonly permitId: string;
    readonly justification: string;
    readonly revocationReason: string;
  },
  deps: ActionRevocationDeps = {},
): Promise<ActionRevocationResult> {
  if (typeof window !== "undefined") {
    throw new Error("Permit revocation is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const justification = validateJustification(input?.justification);
  if (!justification) return refused("justification-required");

  const reason = typeof input?.revocationReason === "string" ? input.revocationReason.trim() : "";
  if (!reason || reason.length > REVOCATION_REASON_MAX_LENGTH) {
    return refused("revocation-reason-required");
  }

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refused("no-governance-authority");
  if (!authority.authorized) return refused("not-the-governance-authority");

  try {
    const rows = await db
      .select()
      .from(actionPermits)
      .where(and(eq(actionPermits.id, input.permitId), eq(actionPermits.tenantId, tenant.tenantId)))
      .limit(1);
    const permit = rows[0];
    if (!permit) return refused("permit-unresolvable");
    /*
     * An EXPIRED permit is still `active` in the column, because expiry is derived. Revoking one is
     * permitted and deliberately not special-cased: it is a no-op for safety but a real statement
     * in the ledger, and refusing would force an authority to argue with a clock.
     */
    if (permit.status !== "active") return refused("permit-not-active");

    let committed: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: ACTION_REVOCATION_DECISION_TYPE,
          subjectType: ACTION_PERMIT_SUBJECT_TYPE,
          subjectId: permit.id,
          justification,
          evidence: {
            actionRequestId: permit.actionRequestId,
            revokedAuthorizationDecisionId: permit.governanceDecisionId,
            boundPayloadDigest: permit.boundPayloadDigest,
          },
        },
        now,
      );

      /*
       * `status = 'active'` in the predicate, not merely in the read above. A revocation racing a
       * consumption is settled by the database: exactly one of them updates a row, and the loser's
       * whole transaction is discarded.
       */
      const updated = await tx
        .update(actionPermits)
        .set({
          status: "revoked",
          revokedAt: now,
          revocationDecisionId: decisionId,
          revocationReason: reason,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(actionPermits.id, permit.id),
            eq(actionPermits.tenantId, tenant.tenantId),
            eq(actionPermits.status, "active"),
          ),
        )
        .returning({ id: actionPermits.id });
      if (updated.length !== 1) throw new Error("permit-no-longer-active");

      const requestRows = await tx
        .select({
          actionKind: hebyActionRequests.actionKind,
          toolId: hebyActionRequests.toolId,
          sideEffect: hebyActionRequests.sideEffect,
          reversibility: hebyActionRequests.reversibility,
          targetKind: hebyActionRequests.targetKind,
          targetRef: hebyActionRequests.targetRef,
        })
        .from(hebyActionRequests)
        .where(
          and(
            eq(hebyActionRequests.id, permit.actionRequestId),
            eq(hebyActionRequests.tenantId, tenant.tenantId),
          ),
        )
        .limit(1);
      const req = requestRows[0];

      await recordActionAuthorizationEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: ACTION_AUDIT_PERMIT_REVOKED,
          outcome: "committed",
          entityId: permit.id,
          metadata: {
            actionRequestId: permit.actionRequestId,
            permitId: permit.id,
            governanceDecisionId: decisionId,
            governanceSessionId: sessionId,
            actionKind: req?.actionKind ?? "unknown",
            toolId: req?.toolId ?? "unknown",
            sideEffect: req?.sideEffect ?? "unknown",
            reversibility: req?.reversibility,
            targetKind: req?.targetKind ?? null,
            targetRef: req?.targetRef ?? null,
            payloadDigest: permit.boundPayloadDigest,
            executed: false,
          },
        },
        now,
      );

      committed = { decisionId, sessionId };
    });

    if (!committed) return refused("persistence-unavailable");
    const outcome = committed as { decisionId: string; sessionId: string };
    return {
      status: "revoked",
      permitId: permit.id,
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "permit-no-longer-active") {
      return refused("permit-not-active");
    }
    return refused("persistence-unavailable");
  }
}
