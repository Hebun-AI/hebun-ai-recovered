/*
 * action-authorization/consume-action-permit.server.ts — spending an authorization, exactly once,
 * without performing anything (R3A).
 *
 * THIS IS THE FURTHEST R3A GOES. It turns a live permit into an `ExecutionAuthorization` and stops.
 * No adapter, no provider, no browser, no shell, no device, no network call, no agent dispatch —
 * none of those modules is imported, and a firewall test asserts none ever is. The successful end
 * state of this function is AUTHORIZED BUT NOT EXECUTED.
 *
 * THE SINGLE-SPEND INVARIANT IS ONE STATEMENT, NOT A SEQUENCE. Validation IS the spend:
 *
 *     UPDATE ... SET status='consumed', consumed_at, handoff_id
 *      WHERE id = $1 AND tenant_id = $2 AND status = 'active' AND expires_at > now()
 *
 * A `check → then update` shape would leave a window in which two callers both read `active` and
 * both proceed, which is precisely how one approval becomes two sends. Here the loser updates zero
 * rows and receives nothing. There is no window to crash inside: a process that dies after the
 * commit has already spent the permit, and a process that dies before it has spent nothing.
 *
 * `expires_at > now()` USES THE DATABASE CLOCK. The caller's clock is not consulted for the
 * predicate, because a caller that could pass its own `now` could also pass a convenient one.
 *
 * WHAT WAS APPROVED == WHAT MAY BE EXECUTED. After winning the spend, the request's payload is
 * re-hashed and compared against BOTH the request's frozen digest and the permit's bound copy. Any
 * disagreement refuses and returns no authorization — the permit is already consumed at that point,
 * which is the safe direction: a suspicious permit is burned rather than re-offered.
 *
 * CONSUMED ≠ SUCCEEDED. Spending records that authorization was used. Whether the act then works
 * is R3B's fact to record, and a failed execution does NOT return the permit — a retry needs a new
 * decision, because the alternative is one approval quietly authorizing an unbounded number of
 * attempts.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, eq, gt, sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { recordActionAuthorizationEventWithin } from "@/features/governance-audit/action-authorization-audit.server";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/bootstrap-authority.server";
import { asCanonicalPayload, digestCanonicalAction, digestsMatch } from "./canonical-payload";
import {
  ACTION_AUDIT_PERMIT_CONSUMED,
  type ExecutionAuthorization,
  type PermitConsumptionRefusal,
} from "./contracts";

export interface PermitConsumptionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
}

export type PermitConsumptionResult =
  | { readonly status: "authorized"; readonly authorization: ExecutionAuthorization }
  | { readonly status: "refused"; readonly reason: PermitConsumptionRefusal };

function refused(reason: PermitConsumptionRefusal): PermitConsumptionResult {
  return { status: "refused", reason };
}

/**
 * Spend one permit and return the authorization handoff.
 *
 * The caller supplies which permit and nothing else. It cannot supply the tenant (session), the
 * handoff id (minted here), the consumption time, or the digest.
 */
export async function consumeActionPermit(
  tenant: TenantContext | null,
  input: { readonly permitId: string },
  deps: PermitConsumptionDeps = {},
): Promise<PermitConsumptionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Permit consumption is server-only.");
  }
  if (!tenant?.tenantId) return refused("unauthenticated");

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();
  const handoffId = randomUUID();

  try {
    let outcome: PermitConsumptionResult | null = null;

    await db.transaction(async (tx) => {
      /*
       * THE SPEND. One statement, four predicates, and the row count is the verdict. `sql\`now()\``
       * is the database's clock, deliberately not the caller's.
       */
      const spent = await tx
        .update(actionPermits)
        .set({
          status: "consumed",
          consumedAt: now,
          handoffId,
          updatedAt: now,
        })
        .where(
          and(
            eq(actionPermits.id, input.permitId),
            eq(actionPermits.tenantId, tenant.tenantId),
            eq(actionPermits.status, "active"),
            gt(actionPermits.expiresAt, sql`now()`),
          ),
        )
        .returning({
          id: actionPermits.id,
          actionRequestId: actionPermits.actionRequestId,
          governanceDecisionId: actionPermits.governanceDecisionId,
          authorizedByActorId: actionPermits.authorizedByActorId,
          boundPayloadDigest: actionPermits.boundPayloadDigest,
          issuedAt: actionPermits.issuedAt,
          expiresAt: actionPermits.expiresAt,
        });

      if (spent.length !== 1) {
        /* Not found, foreign tenant, already spent, revoked, or expired — one answer for all. */
        outcome = refused("permit-not-consumable");
        return;
      }
      const permit = spent[0]!;

      const reqRows = await tx
        .select()
        .from(hebyActionRequests)
        .where(
          and(
            eq(hebyActionRequests.id, permit.actionRequestId),
            eq(hebyActionRequests.tenantId, tenant.tenantId),
          ),
        )
        .limit(1);
      const request = reqRows[0];
      if (!request) {
        /* Structurally impossible — the composite FK guarantees it. Fail closed regardless. */
        outcome = refused("digest-mismatch");
        throw new Error("permit-request-missing");
      }

      const payload = asCanonicalPayload(request.canonicalPayload);
      if (!payload) {
        outcome = refused("digest-mismatch");
        throw new Error("permit-payload-unusable");
      }

      const recomputed = digestCanonicalAction({
        actionKind: request.actionKind,
        toolId: request.toolId,
        targetKind: request.targetKind,
        targetRef: request.targetRef,
        payload,
      });

      /* Three-way agreement: what is stored, what was frozen, and what the permit bound. */
      if (
        !digestsMatch(recomputed, request.payloadDigest) ||
        !digestsMatch(request.payloadDigest, permit.boundPayloadDigest)
      ) {
        outcome = refused("digest-mismatch");
        throw new Error("permit-digest-mismatch");
      }

      await recordActionAuthorizationEventWithin(
        tx,
        {
          tenantId: tenant.tenantId,
          userId: permit.authorizedByActorId,
          requestId: tenant.requestId,
          sessionContextId: tenant.sessionContextId,
        },
        {
          action: ACTION_AUDIT_PERMIT_CONSUMED,
          outcome: "committed",
          entityId: permit.id,
          metadata: {
            actionRequestId: request.id,
            permitId: permit.id,
            governanceDecisionId: permit.governanceDecisionId,
            actionKind: request.actionKind,
            toolId: request.toolId,
            sideEffect: request.sideEffect,
            reversibility: request.reversibility,
            targetKind: request.targetKind,
            targetRef: request.targetRef,
            payloadDigest: permit.boundPayloadDigest,
            expiresAt: permit.expiresAt.toISOString(),
            handoffId,
            /* The whole point of R3A, stated in the ledger: authorized, not executed. */
            executed: false,
          },
        },
        now,
      );

      outcome = {
        status: "authorized",
        authorization: {
          handoffId,
          permitId: permit.id,
          tenantId: tenant.tenantId,
          actionRequestId: request.id,
          actionKind: request.actionKind,
          toolId: request.toolId,
          targetKind: request.targetKind,
          targetRef: request.targetRef,
          canonicalPayload: payload,
          boundPayloadDigest: permit.boundPayloadDigest,
          authorizationDecisionId: permit.governanceDecisionId,
          authorizedByActorId: permit.authorizedByActorId,
          issuedAt: permit.issuedAt.toISOString(),
          expiresAt: permit.expiresAt.toISOString(),
          consumedAt: now.toISOString(),
        },
      };
    });

    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    /*
     * A digest failure rolls the spend back with it, so the permit stays `active`. That is the
     * correct direction for a CONTENT disagreement: nothing was authorized, nothing was burned,
     * and a Governance authority can revoke the permit deliberately once they know why.
     */
    if (error instanceof Error && error.message.startsWith("permit-")) {
      return refused("digest-mismatch");
    }
    return refused("persistence-unavailable");
  }
}
