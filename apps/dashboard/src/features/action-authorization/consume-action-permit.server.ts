/*
 * action-authorization/consume-action-permit.server.ts — spending an authorization, exactly once,
 * and recording what it was spent on in the SAME transaction (R3A, extended at R3B).
 *
 * THIS MODULE STILL PERFORMS NOTHING. No adapter, no provider, no browser, no shell, no device, no
 * network call, no agent dispatch — none of those modules is imported, and a firewall test asserts
 * none ever is. Its successful end state is AUTHORIZED, and whether anything then happens is
 * decided entirely by its caller.
 *
 * R3B ADDED ONE SEAM: `onAuthorizedWithin`, a callback invoked INSIDE the spend transaction with
 * the transaction handle and the authorization. It exists because "consume the permit, then insert
 * the execution attempt" is two transactions, and a crash between them leaves a spent
 * authorization nothing can account for. One transaction makes the pair atomic: either the permit
 * is spent AND the attempt exists, or neither does. The callback may only write; it cannot widen
 * what was authorized, and it receives the authorization rather than producing one.
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
 * disagreement throws, which ROLLS THE SPEND BACK WITH IT: the permit stays `active` and nothing
 * is authorized. That is the correct direction for a CONTENT disagreement — nothing was authorized
 * and nothing was burned, so a Governance authority can revoke the permit deliberately once they
 * know why the payload drifted. (An earlier revision of this header claimed the opposite, that a
 * mismatched permit is burned. The code has always rolled back; the prose was wrong, and R3B
 * repaired it rather than changing correct transaction semantics to match stale prose.)
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

/**
 * The transaction handle handed to {@link PermitConsumptionDeps.onAuthorizedWithin}.
 *
 * Narrowed to `insert` and `select` on purpose. The callback records what the authorization is
 * being spent on and re-reads the rows it depends on; it has no business updating or deleting
 * anything, and least of all the permit it is running inside the spend of.
 */
export type PermitConsumptionTx = Pick<ControlPlaneDatabase, "insert" | "select">;

export interface PermitConsumptionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  /**
   * Invoked INSIDE the spend transaction, after the digest checks pass and before commit (R3B).
   *
   * ATOMICITY IS THE ENTIRE PURPOSE. A caller that spent the permit and then separately recorded
   * what it was spent on would, on a crash between the two, hold an authorization that was
   * consumed for no recorded reason — unspendable, unaccountable, and impossible to reconcile.
   *
   * Throwing aborts the whole transaction: the permit reverts to `active` and nothing was
   * recorded. That is the safe direction — if Hebun cannot write down what it is about to do, it
   * must not become entitled to do it.
   */
  readonly onAuthorizedWithin?: (
    tx: PermitConsumptionTx,
    authorization: ExecutionAuthorization,
  ) => Promise<void>;
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

      const authorization: ExecutionAuthorization = {
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
      };

      /*
       * THE ATOMIC HALF (R3B). Still inside the transaction that spent the permit. A throw here
       * takes the spend with it, which is the whole reason the seam exists rather than the caller
       * doing this immediately afterwards.
       */
      if (deps.onAuthorizedWithin) {
        try {
          await deps.onAuthorizedWithin(tx, authorization);
        } catch (error) {
          outcome = refused("handoff-record-failed");
          throw new Error(
            `handoff-record-failed:${error instanceof Error ? error.name : "unknown"}`,
          );
        }
      }

      outcome = { status: "authorized", authorization };
    });

    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    /*
     * Every throw above rolls the spend back with it, so the permit stays `active` in all of these
     * cases. Nothing was authorized and nothing was burned.
     */
    if (error instanceof Error && error.message.startsWith("handoff-record-failed")) {
      return refused("handoff-record-failed");
    }
    if (error instanceof Error && error.message.startsWith("permit-")) {
      return refused("digest-mismatch");
    }
    return refused("persistence-unavailable");
  }
}
