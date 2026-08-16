/*
 * action-authorization/decide-action-request.server.ts — the human authority boundary (R3A).
 *
 * WHERE THE AUTHORITY COMES FROM, AND WHERE IT DOES NOT. The only question this module asks about
 * authority is `resolveGovernanceAuthority(tenant)` — the same G2/G3 resolver that already answers
 * it for ratification, delegation, revocation and membership. There is NO second resolver here, and
 * none of `roles.type`, `memberships.authority_scope`, `permissions`, provider state, a Director
 * Twin prediction, a prior approval, or anything the client supplied is consulted for authority. A
 * tenant owner without Governance authority is refused exactly like a stranger.
 *
 * THE CIRCULAR-REFERENCE PROBLEM, AND THE AUTHORIZED SOLUTION. The decision must name the request
 * as its subject and the permit must name the decision as its provenance; both columns are NOT
 * NULL. I1 hit this exact shape and the Director authorized generating the artifact's UUID in the
 * application so the decision can bind to it before the row exists. R3A reuses that, unchanged:
 * the permit id is a v4 UUID from `crypto.randomUUID`, and the row it names is written in the same
 * transaction or not at all.
 *
 * WHAT COMMITS TOGETHER ON APPROVAL. The governance session, the `approve` decision, the request's
 * status transition, the permit, and TWO audit rows are one transaction. "Approved but no permit",
 * "permit but no decision", and "authorized but unaudited" are all unrepresentable rather than
 * unlikely.
 *
 * THE DIGEST IS RE-VERIFIED BEFORE APPROVAL. A request whose stored payload no longer hashes to its
 * stored digest is refused, never repaired. A human cannot be asked to approve a thing that has
 * already drifted, and silently re-hashing would make the drift invisible.
 *
 * WHAT THIS MODULE CANNOT DO. It never executes, dispatches, connects a substrate, calls a
 * provider, or touches a device. Those absences are structural: the modules involved are not
 * imported, and a firewall test asserts they never will be.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordActionAuthorizationEventWithin } from "@/features/governance-audit/action-authorization-audit.server";
import {
  resolveGovernanceDbOrNull,
  validateJustification,
} from "@/features/governance-decision/bootstrap-authority.server";
import {
  resolveGovernanceAuthority,
  writeGovernanceDecisionWithin,
} from "@/features/governance-decision/decision-authority.server";
import { asCanonicalPayload, digestCanonicalAction, digestsMatch } from "./canonical-payload";
import {
  ACTION_APPROVAL_DECISION_TYPE,
  ACTION_AUDIT_APPROVED,
  ACTION_AUDIT_PERMIT_ISSUED,
  ACTION_AUDIT_REJECTED,
  ACTION_REJECTION_DECISION_TYPE,
  ACTION_REQUEST_SUBJECT_TYPE,
  PERMIT_DEFAULT_TTL_SECONDS,
  PERMIT_MAX_TTL_SECONDS,
  PERMIT_MIN_TTL_SECONDS,
  REJECTION_REASON_MAX_LENGTH,
  type ActionApprovalResult,
  type ActionDecisionRefusal,
  type ActionRejectionResult,
} from "./contracts";

export interface ActionDecisionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

function refusedApproval(reason: ActionDecisionRefusal): ActionApprovalResult {
  return { status: "refused", reason };
}

function refusedRejection(reason: ActionDecisionRefusal): ActionRejectionResult {
  return { status: "refused", reason };
}

/**
 * Clamp a requested lifetime into the server's bounds.
 *
 * A client may ask for less and may NEVER widen beyond the maximum. The clamp is silent by design:
 * an over-long request is not an error to argue about, it is simply not what the server grants,
 * and the row records what was actually granted.
 */
export function clampTtlSeconds(requested: number | undefined): number {
  if (typeof requested !== "number" || !Number.isFinite(requested)) {
    return PERMIT_DEFAULT_TTL_SECONDS;
  }
  const floored = Math.floor(requested);
  if (floored < PERMIT_MIN_TTL_SECONDS) return PERMIT_MIN_TTL_SECONDS;
  if (floored > PERMIT_MAX_TTL_SECONDS) return PERMIT_MAX_TTL_SECONDS;
  return floored;
}

/** Re-hash a stored request and compare against the digest frozen at proposal time. */
function storedDigestStillHolds(row: typeof hebyActionRequests.$inferSelect): boolean {
  const payload = asCanonicalPayload(row.canonicalPayload);
  if (!payload) return false;
  const recomputed = digestCanonicalAction({
    actionKind: row.actionKind,
    toolId: row.toolId,
    targetKind: row.targetKind,
    targetRef: row.targetRef,
    payload,
  });
  return digestsMatch(recomputed, row.payloadDigest);
}

/**
 * Approve one pending action request and mint its permit.
 *
 * The client supplies exactly three things: which request, a human-authored justification, and an
 * optional requested lifetime. It cannot supply the tenant, the actor, the authority source, the
 * decision outcome, the digest, the expiry ceiling, or the permit state.
 */
export async function approveActionRequest(
  tenant: TenantContext | null,
  input: {
    readonly requestId: string;
    readonly justification: string;
    readonly requestedTtlSeconds?: number;
  },
  deps: ActionDecisionDeps = {},
): Promise<ActionApprovalResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action authorization decisions are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refusedApproval("unauthenticated");

  const justification = validateJustification(input?.justification);
  if (!justification) return refusedApproval("justification-required");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refusedApproval("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refusedApproval("no-governance-authority");
  if (!authority.authorized) return refusedApproval("not-the-governance-authority");

  try {
    const rows = await db
      .select()
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.id, input.requestId),
          eq(hebyActionRequests.tenantId, tenant.tenantId),
        ),
      )
      .limit(1);
    const request = rows[0];
    if (!request) return refusedApproval("request-unresolvable");
    if (request.status !== "pending") return refusedApproval("request-not-pending");
    if (!storedDigestStillHolds(request)) return refusedApproval("digest-mismatch");

    const ttlSeconds = clampTtlSeconds(input.requestedTtlSeconds);
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);
    /* See the header: the permit's id is minted here so the decision can name it. */
    const permitId = randomUUID();

    let committed: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: ACTION_APPROVAL_DECISION_TYPE,
          subjectType: ACTION_REQUEST_SUBJECT_TYPE,
          subjectId: request.id,
          justification,
          evidence: {
            actionPermitId: permitId,
            payloadDigest: request.payloadDigest,
            actionKind: request.actionKind,
            toolId: request.toolId,
            sideEffect: request.sideEffect,
            expiresAt: expiresAt.toISOString(),
          },
        },
        now,
      );

      /*
       * The transition is guarded by `status = 'pending'` in the predicate, not merely by the read
       * above. Two authorities approving the same request concurrently is a race the database
       * settles: the loser updates zero rows and the whole transaction is thrown away.
       */
      const updated = await tx
        .update(hebyActionRequests)
        .set({
          status: "approved",
          approvalDecisionId: decisionId,
          approvedAt: now,
          approvedByActorType: "human",
          approvedByActorId: tenant.userId,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(hebyActionRequests.id, request.id),
            eq(hebyActionRequests.tenantId, tenant.tenantId),
            eq(hebyActionRequests.status, "pending"),
          ),
        )
        .returning({ id: hebyActionRequests.id });
      if (updated.length !== 1) throw new Error("action-request-no-longer-pending");

      await tx.insert(actionPermits).values({
        id: permitId,
        tenantId: tenant.tenantId,
        actionRequestId: request.id,
        governanceDecisionId: decisionId,
        governanceSessionId: sessionId,
        authorizedByActorType: "human",
        authorizedByActorId: tenant.userId,
        boundPayloadDigest: request.payloadDigest,
        status: "active",
        issuedAt: now,
        expiresAt,
        ttlSeconds,
        createdAt: now,
        createdBy: tenant.userId,
        createdByType: "human",
      });

      const auditActor = {
        tenantId: tenant.tenantId,
        userId: tenant.userId,
        requestId: tenant.requestId,
        sessionContextId: tenant.sessionContextId,
      };
      const shared = {
        actionRequestId: request.id,
        permitId,
        governanceDecisionId: decisionId,
        governanceSessionId: sessionId,
        actionKind: request.actionKind,
        toolId: request.toolId,
        sideEffect: request.sideEffect,
        reversibility: request.reversibility,
        targetKind: request.targetKind,
        targetRef: request.targetRef,
        payloadDigest: request.payloadDigest,
        expiresAt: expiresAt.toISOString(),
        executed: false as const,
      };

      /* Two events, because approving and issuing are two facts that could in principle differ. */
      await recordActionAuthorizationEventWithin(
        tx,
        auditActor,
        { action: ACTION_AUDIT_APPROVED, outcome: "committed", entityId: request.id, metadata: shared },
        now,
      );
      await recordActionAuthorizationEventWithin(
        tx,
        auditActor,
        { action: ACTION_AUDIT_PERMIT_ISSUED, outcome: "committed", entityId: permitId, metadata: shared },
        now,
      );

      committed = { decisionId, sessionId };
    });

    if (!committed) return refusedApproval("persistence-unavailable");
    const outcome = committed as { decisionId: string; sessionId: string };
    return {
      status: "authorized",
      requestId: request.id,
      permitId,
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
      expiresAt: expiresAt.toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "action-request-no-longer-pending") {
      return refusedApproval("request-not-pending");
    }
    return refusedApproval("persistence-unavailable");
  }
}

/**
 * Refuse one pending action request.
 *
 * A refusal is a Governance decision too. It records why, it is auditable, and it frees the
 * duplicate-proposal slot so a corrected proposal can be made — which is the point: a rejected
 * action should be re-proposable with different parameters, and a different parameter is a
 * different digest.
 */
export async function rejectActionRequest(
  tenant: TenantContext | null,
  input: {
    readonly requestId: string;
    readonly justification: string;
    readonly rejectionReason: string;
  },
  deps: ActionDecisionDeps = {},
): Promise<ActionRejectionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Action authorization decisions are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refusedRejection("unauthenticated");

  const justification = validateJustification(input?.justification);
  if (!justification) return refusedRejection("justification-required");

  const reason = typeof input?.rejectionReason === "string" ? input.rejectionReason.trim() : "";
  if (!reason || reason.length > REJECTION_REASON_MAX_LENGTH) {
    return refusedRejection("rejection-reason-required");
  }

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refusedRejection("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();

  const authority = await resolveGovernanceAuthority(tenant, deps);
  if (!authority.bootstrapDecisionId) return refusedRejection("no-governance-authority");
  if (!authority.authorized) return refusedRejection("not-the-governance-authority");

  try {
    const rows = await db
      .select()
      .from(hebyActionRequests)
      .where(
        and(
          eq(hebyActionRequests.id, input.requestId),
          eq(hebyActionRequests.tenantId, tenant.tenantId),
        ),
      )
      .limit(1);
    const request = rows[0];
    if (!request) return refusedRejection("request-unresolvable");
    if (request.status !== "pending") return refusedRejection("request-not-pending");

    let committed: { decisionId: string; sessionId: string } | null = null;

    await db.transaction(async (tx) => {
      const { decisionId, sessionId } = await writeGovernanceDecisionWithin(
        tx,
        tenant,
        authority,
        {
          decisionType: ACTION_REJECTION_DECISION_TYPE,
          subjectType: ACTION_REQUEST_SUBJECT_TYPE,
          subjectId: request.id,
          justification,
          evidence: {
            payloadDigest: request.payloadDigest,
            actionKind: request.actionKind,
            toolId: request.toolId,
          },
        },
        now,
      );

      const updated = await tx
        .update(hebyActionRequests)
        .set({
          status: "rejected",
          rejectionDecisionId: decisionId,
          rejectedAt: now,
          rejectionReason: reason,
          updatedAt: now,
          updatedBy: tenant.userId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(hebyActionRequests.id, request.id),
            eq(hebyActionRequests.tenantId, tenant.tenantId),
            eq(hebyActionRequests.status, "pending"),
          ),
        )
        .returning({ id: hebyActionRequests.id });
      if (updated.length !== 1) throw new Error("action-request-no-longer-pending");

      await recordActionAuthorizationEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: tenant.userId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: ACTION_AUDIT_REJECTED,
          outcome: "committed",
          entityId: request.id,
          metadata: {
            actionRequestId: request.id,
            governanceDecisionId: decisionId,
            governanceSessionId: sessionId,
            actionKind: request.actionKind,
            toolId: request.toolId,
            sideEffect: request.sideEffect,
            reversibility: request.reversibility,
            targetKind: request.targetKind,
            targetRef: request.targetRef,
            payloadDigest: request.payloadDigest,
            executed: false,
          },
        },
        now,
      );

      committed = { decisionId, sessionId };
    });

    if (!committed) return refusedRejection("persistence-unavailable");
    const outcome = committed as { decisionId: string; sessionId: string };
    return {
      status: "rejected",
      requestId: request.id,
      decisionId: outcome.decisionId,
      sessionId: outcome.sessionId,
    };
  } catch (error) {
    if (error instanceof Error && error.message === "action-request-no-longer-pending") {
      return refusedRejection("request-not-pending");
    }
    return refusedRejection("persistence-unavailable");
  }
}
