/*
 * standing-mutation-authority/issue-permit-under-standing-authorization.server.ts — the ONE place a
 * permit comes into being without a human clicking Approve (RUNG 2).
 *
 * ── WHAT IT DOES, AND THE THREE WORDS THAT BOUND IT ─────────────────────────
 *
 *     valid standing envelope + the agent's own pending evidenced proposal → ONE ORDINARY PERMIT
 *
 * "ORDINARY" is the whole design. The row it writes is the same single-use, digest-bound, expiring,
 * revocable `action_permits` row `approveActionRequest` writes — same columns, same CHECKs, same
 * spend statement. The only difference is `standing_authorization_id`, which records WHY it could be
 * issued without a click. Nothing downstream of this file changed for RUNG 2.
 *
 * "Same audit" was claimed here before APF-1 and was not true: this seam wrote no audit row, so a
 * standing-issued permit entered history only when it was spent. APF-1 makes it true — see step 12.
 *
 * ── WHAT IT IS NOT ──────────────────────────────────────────────────────────
 *
 * It is not an executor: it spends nothing, records no work and reaches no provider. It is not a
 * Governance writer: it creates NO decision. `governance_decision_id` names the STANDING decision a
 * human already took, because that is the decision that authorizes this act — inventing a per-act
 * decision would be recording a deliberation that never happened, and letting an agent author one
 * would hand Governance to a machine. Both were considered and refused by name at design time.
 *
 * ── THE HUMAN NAMED ON THE PERMIT IS THE TRUTH, NOT A CONVENIENCE ───────────
 *
 * `authorized_by_actor_id` is the person who signed the envelope, and the DB CHECK requiring a human
 * there is UNTOUCHED. That naming is accurate: they authorized this act, in advance, inside bounds
 * they chose and can withdraw. It is not a fabricated click.
 *
 * ── UNREACHABLE FROM HEBY, THE UI, AND EVERY CLIENT ─────────────────────────
 *
 * Heby PROPOSES. This seam decides whether a proposal is already authorized by a standing envelope.
 * If an agent could call this, the envelope would be self-service and the whole authority model
 * would collapse into "the agent decides". A firewall pins that no file under `src/app`, no
 * component and no Heby module reaches this module.
 *
 * ── CONCURRENCY: THE ENVELOPE ROW IS THE MUTEX ──────────────────────────────
 *
 * Quota, cadence and evidence-uniqueness are all COUNTS over rows this transaction is about to add
 * to. `where not exists` is not a mutex — TRH-25 already paid for that lesson. So the effective
 * revision is re-read `FOR UPDATE` inside the transaction, and every count happens behind that lock.
 * Two scans racing one envelope serialize; the loser sees the winner's permit in its own count.
 *
 * Server-only.
 */
import { randomUUID } from "node:crypto";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { standingMutationAuthorizations } from "@/db/schema/standing-mutation-authorization";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import { readDurableAgentRuntimeLiveness } from "@/features/agent-identity/read-durable-agent-identity.server";
import { resolveMachineExecutionReachability } from "@/features/tenant-machine-execution-authority/resolve-machine-execution-reachability.server";
import { resolveMachineInternalExecutionEnabled } from "@/features/governed-machine-execution/machine-execution-control.server";
import { readEffectiveAgentMandateForRuntime } from "@/features/agent-mandate/read-agent-mandate.server";
import { refuseOutsideAgentMandate } from "@/features/action-authorization/agent-mandate-ceiling";
import { recordActionAuthorizationEventWithin } from "@/features/governance-audit/action-authorization-audit.server";
import {
  asCanonicalPayload,
  digestCanonicalAction,
  digestsMatch,
} from "@/features/action-authorization/canonical-payload";
import { toEvidence } from "@/features/action-authorization/decision-projection";
import {
  ACTION_AUDIT_PERMIT_ISSUED,
  PERMIT_DEFAULT_TTL_SECONDS,
} from "@/features/action-authorization/contracts";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "@/features/governed-machine-execution/contracts";
import { ADMITTED_EVIDENCE_SOURCE_CLASSES, type StandingIssuanceRefusal } from "./contracts";

export interface StandingIssuanceDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly now?: () => Date;
  readonly readAgentLiveness?: typeof readDurableAgentRuntimeLiveness;
  /** Injectable so the tenant boundary is provable without a control-plane database (APF-1). */
  readonly reachable?: typeof resolveMachineExecutionReachability;
  /** Injectable root-control reader, handed to the reachability composition (APF-1). */
  readonly armed?: typeof resolveMachineInternalExecutionEnabled;
  /** Injectable so the mandate ceiling is provable without a control-plane database (APF-1). */
  readonly readMandate?: typeof readEffectiveAgentMandateForRuntime;
  /**
   * The lifetime granted to an issued permit, in seconds.
   *
   * Defaulted to the released permit default and clamped by the released CHECK. It is injectable
   * for tests only; there is no caller-facing parameter, because a standing envelope's acts are not
   * a place a caller gets to choose how long authority lasts.
   */
  readonly ttlSeconds?: number;
}

export type StandingIssuanceResult =
  | {
      readonly status: "issued";
      readonly permitId: string;
      readonly requestId: string;
      readonly standingAuthorizationId: string;
      readonly expiresAt: string;
      /** How many acts this envelope has now issued, including this one. */
      readonly actsIssued: number;
      readonly maxActs: number;
    }
  | { readonly status: "refused"; readonly reason: StandingIssuanceRefusal };

class IssuanceAbort extends Error {
  constructor(readonly reason: StandingIssuanceRefusal) {
    super(reason);
  }
}

function refused(reason: StandingIssuanceRefusal): StandingIssuanceResult {
  return { status: "refused", reason };
}

function resolveDbOrNull(deps: StandingIssuanceDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

/**
 * The FIRST admitted evidence reference on a proposal, or `null`.
 *
 * "First" is deterministic because the stored array's order is the order the released proposal seam
 * wrote it. The reference it returns is the idempotence anchor: one organizational fact may fund
 * one standing-authorized act, never several.
 */
export function admittedEvidenceRef(rawEvidence: unknown): string | null {
  const projected = toEvidence(rawEvidence);
  if (projected.status !== "attached") return null;
  for (const entry of projected.items) {
    if (ADMITTED_EVIDENCE_SOURCE_CLASSES.has(entry.sourceClass)) return entry.recordRef;
  }
  return null;
}

/**
 * Issue one ordinary permit for one pending agent proposal, under the tenant's standing envelope.
 *
 * THE CALLER SUPPLIES A REQUEST ID AND NOTHING ELSE. There is no parameter for a tenant, an agent,
 * an envelope, an action kind, a payload, an expiry or an authorizer — every one is read off
 * authoritative rows. A caller that wanted to issue against another tenant's envelope has no
 * representation in which to ask.
 */
export async function issuePermitUnderStandingAuthorization(
  input: { readonly requestId: string },
  deps: StandingIssuanceDeps = {},
): Promise<StandingIssuanceResult> {
  if (typeof window !== "undefined") {
    throw new Error("Standing permit issuance is server-only.");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");
  const now = (deps.now ?? (() => new Date()))();
  const ttlSeconds = deps.ttlSeconds ?? PERMIT_DEFAULT_TTL_SECONDS;

  const requestId = (input?.requestId ?? "").trim();
  if (!requestId) return refused("request-unresolvable");

  try {
    let outcome: StandingIssuanceResult | null = null;

    await db.transaction(async (rawTx) => {
      const tx = rawTx as unknown as ControlPlaneDatabase;

      /*
       * 1 · THE PROPOSAL. Its tenant is the tenant, read off the row and never supplied.
       */
      const requestRows = await tx
        .select()
        .from(hebyActionRequests)
        .where(eq(hebyActionRequests.id, requestId))
        .limit(1);
      const request = requestRows[0];
      if (!request) throw new IssuanceAbort("request-unresolvable");
      if (request.status !== "pending") throw new IssuanceAbort("request-unresolvable");

      /*
       * 2 · ONLY THE AGENT'S OWN PROPOSALS.
       *
       * A human who proposes an act and walks away has not asked for it to be authorized without
       * them. The released delivery scan applies the same rule for the same reason.
       */
      if (request.proposedByActorType !== "agent" || !request.proposedByActorId) {
        throw new IssuanceAbort("not-agent-proposed");
      }
      if (!MACHINE_EXECUTABLE_ACTION_KINDS.has(request.actionKind)) {
        throw new IssuanceAbort("action-kind-mismatch");
      }

      /*
       * 3 · THE ENVELOPE, LOCKED. Everything after this point counts rows this transaction may add
       * to, so the lock is what makes the counts mean anything. Highest revision is effective.
       */
      const envelopeRows = await tx
        .select({
          id: standingMutationAuthorizations.id,
          state: standingMutationAuthorizations.state,
          agentId: standingMutationAuthorizations.agentId,
          actionKind: standingMutationAuthorizations.actionKind,
          notBefore: standingMutationAuthorizations.notBefore,
          notAfter: standingMutationAuthorizations.notAfter,
          maxActs: standingMutationAuthorizations.maxActs,
          minIntervalMinutes: standingMutationAuthorizations.minIntervalMinutes,
          governanceDecisionId: standingMutationAuthorizations.governanceDecisionId,
          governanceSessionId: standingMutationAuthorizations.governanceSessionId,
          authorizedByActorId: standingMutationAuthorizations.authorizedByActorId,
        })
        .from(standingMutationAuthorizations)
        .where(
          and(
            eq(standingMutationAuthorizations.tenantId, request.tenantId),
            eq(standingMutationAuthorizations.agentId, request.proposedByActorId),
          ),
        )
        .orderBy(desc(standingMutationAuthorizations.authorizationRevision))
        .limit(1)
        .for("update");

      const envelope = envelopeRows[0];
      if (!envelope) throw new IssuanceAbort("no-standing-authorization");
      if (envelope.state !== "active") throw new IssuanceAbort("standing-authorization-withdrawn");
      if (envelope.agentId !== request.proposedByActorId) throw new IssuanceAbort("agent-mismatch");
      if (envelope.actionKind !== request.actionKind) {
        throw new IssuanceAbort("action-kind-mismatch");
      }

      /* 4 · THE WINDOW, half-open `[not_before, not_after)` so a boundary belongs to one side. */
      if (now.getTime() < envelope.notBefore.getTime()) {
        throw new IssuanceAbort("standing-authorization-not-in-window");
      }
      if (now.getTime() >= envelope.notAfter.getTime()) {
        throw new IssuanceAbort("standing-authorization-not-in-window");
      }

      /*
       * 5 · THE ORGANIZATION MUST STILL BE ACTIVE AND ENROLLED, THE DEPLOYMENT ARMED, and the agent
       * in service and still bounded to this act.
       *
       * Each is re-read here rather than trusted from the envelope, because each can change after a
       * human signed it. The executor re-decides them AGAIN before the spend; this is the early
       * refusal that stops a permit being minted that could only ever be refused.
       *
       * APF-1: reachability is the released composition the executor already uses — organization
       * lifecycle, its machine-execution grant and the `machine-internal-execution` root control,
       * read by their owners. Before APF-1 this step read the grant alone, so a suspended tenant
       * and a DISARMED deployment both still had permits minted for them.
       */
      const reachability = await (deps.reachable ?? resolveMachineExecutionReachability)(
        request.tenantId,
        request.actionKind,
        {
          ...(deps.getDb ? { getDb: deps.getDb } : {}),
          ...(deps.armed ? { rootEnabled: deps.armed } : {}),
        },
      );
      if (reachability.status !== "reachable") {
        switch (reachability.reason) {
          case "persistence-unavailable":
            throw new IssuanceAbort("persistence-unavailable");
          case "tenant-not-active":
            throw new IssuanceAbort("tenant-not-active");
          case "root-control-disabled":
            throw new IssuanceAbort("machine-execution-disarmed");
          case "unsupported-machine-capability":
            throw new IssuanceAbort("action-kind-mismatch");
          default:
            throw new IssuanceAbort("tenant-not-authorized");
        }
      }

      const liveness = await (deps.readAgentLiveness ?? readDurableAgentRuntimeLiveness)(
        request.tenantId,
        envelope.agentId,
        deps.getDb ? { getDb: deps.getDb } : {},
      );
      if (liveness === "unavailable") throw new IssuanceAbort("persistence-unavailable");
      if (liveness !== "in-service") throw new IssuanceAbort("agent-not-in-service");

      /*
       * APF-1 · THE AGENT'S CEILING, AS IT STANDS NOW. The proposal passed the mandate when it was
       * filed; a Governance-authorized human may have withdrawn or narrowed it since. Read from the
       * Agent Mandate Authority and decided by the one shared ceiling — never re-derived here.
       */
      const ceiling = refuseOutsideAgentMandate(
        await (deps.readMandate ?? readEffectiveAgentMandateForRuntime)(
          request.tenantId,
          envelope.agentId,
          deps.getDb ? { getDb: deps.getDb } : {},
        ),
        request.actionKind,
      );
      if (ceiling) throw new IssuanceAbort(ceiling);

      /*
       * 6 · EVIDENCE. THE CLAIM RUNG 2 RESTS ON.
       *
       * A proposal with no admitted evidence is refused outright: the human authorized a class of
       * EVIDENCED acts, and a model's reasoning that work happened is not evidence of it.
       */
      const evidenceRef = admittedEvidenceRef(request.evidence);
      if (!evidenceRef) throw new IssuanceAbort("evidence-required");

      /*
       * 7 · ONE FACT FUNDS ONE ACT.
       *
       * Without this, one observation could be proposed against repeatedly and drain the whole
       * quota while looking perfectly evidenced each time. Checked behind the envelope's lock and
       * scoped to permits issued under a standing envelope — an ordinary human-approved permit
       * citing the same evidence is a human's decision and is none of this seam's business.
       */
      const priorRows = await tx
        .select({ evidence: hebyActionRequests.evidence })
        .from(actionPermits)
        .innerJoin(
          hebyActionRequests,
          and(
            eq(hebyActionRequests.id, actionPermits.actionRequestId),
            eq(hebyActionRequests.tenantId, actionPermits.tenantId),
          ),
        )
        .where(
          and(
            eq(actionPermits.tenantId, request.tenantId),
            eq(actionPermits.standingAuthorizationId, envelope.id),
          ),
        );

      for (const prior of priorRows) {
        if (admittedEvidenceRef(prior.evidence) === evidenceRef) {
          throw new IssuanceAbort("evidence-already-consumed");
        }
      }

      /* 8 · QUOTA. Counted, never stored. `priorRows` is every act this envelope has issued. */
      const actsIssued = priorRows.length;
      if (actsIssued >= envelope.maxActs) {
        throw new IssuanceAbort("standing-authorization-exhausted");
      }

      /* 9 · CADENCE. The newest issuance under this envelope, against the envelope's floor. */
      const latestRows = await tx
        .select({ issuedAt: actionPermits.issuedAt })
        .from(actionPermits)
        .where(
          and(
            eq(actionPermits.tenantId, request.tenantId),
            eq(actionPermits.standingAuthorizationId, envelope.id),
            isNotNull(actionPermits.standingAuthorizationId),
          ),
        )
        .orderBy(desc(actionPermits.issuedAt))
        .limit(1);

      const latest = latestRows[0]?.issuedAt ?? null;
      if (latest !== null) {
        const elapsedMs = now.getTime() - latest.getTime();
        if (elapsedMs < envelope.minIntervalMinutes * 60_000) {
          throw new IssuanceAbort("cadence-not-elapsed");
        }
      }

      /*
       * 10 · THE DIGEST, RE-VERIFIED. The payload frozen at proposal time must still hash to the
       * digest stored beside it, exactly as the human-approval path checks before minting.
       */
      const payload = asCanonicalPayload(request.canonicalPayload);
      if (!payload) throw new IssuanceAbort("digest-mismatch");
      const recomputed = digestCanonicalAction({
        actionKind: request.actionKind,
        toolId: request.toolId,
        targetKind: request.targetKind,
        targetRef: request.targetRef,
        payload,
      });
      if (!digestsMatch(recomputed, request.payloadDigest)) {
        throw new IssuanceAbort("digest-mismatch");
      }

      /*
       * 11 · THE PERMIT, AND WHO THE ROWS NAME.
       *
       * `heby_action_requests_approved_chk` requires an approved request to say WHEN, BY WHICH
       * DECISION and BY WHOM — and a sibling CHECK requires that whom to be a human. The database
       * is right to insist: an approved act with no accountable person is exactly the state neither
       * constraint will allow to exist.
       *
       * So both rows name THE HUMAN WHO SIGNED THE ENVELOPE, and that is a true statement rather
       * than a convenience: they authorized this act, in advance, inside bounds they chose and can
       * withdraw at any moment. What distinguishes a standing-authorized act from a per-act click
       * is not a different name in this column — it is `standing_authorization_id` on BOTH rows,
       * and `approval_decision_id` pointing at the STANDING decision rather than one taken for this
       * act alone.
       *
       * WHAT IS STILL NEVER WRITTEN: a Governance decision. No row is added to the decision ledger
       * here, because no new deliberation happened. That is the line this design would not cross.
       */
      const permitId = randomUUID();
      const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

      /*
       * The transition is guarded by `status = 'pending'` in the predicate, so two issuers racing
       * one proposal are settled by the database: the loser updates zero rows and the whole
       * transaction is thrown away.
       */
      const updated = await tx
        .update(hebyActionRequests)
        .set({
          status: "approved",
          approvalDecisionId: envelope.governanceDecisionId,
          approvedAt: now,
          approvedByActorType: "human",
          approvedByActorId: envelope.authorizedByActorId,
          /* Why this request could be approved without a click — the twin of the permit's column. */
          standingAuthorizationId: envelope.id,
          updatedAt: now,
          updatedBy: envelope.authorizedByActorId,
          updatedByType: "human",
        })
        .where(
          and(
            eq(hebyActionRequests.id, request.id),
            eq(hebyActionRequests.tenantId, request.tenantId),
            eq(hebyActionRequests.status, "pending"),
          ),
        )
        .returning({ id: hebyActionRequests.id });
      if (updated.length !== 1) throw new IssuanceAbort("already-permitted");

      await tx.insert(actionPermits).values({
        id: permitId,
        tenantId: request.tenantId,
        actionRequestId: request.id,
        /* The STANDING decision. No per-act decision exists, and none is invented. */
        governanceDecisionId: envelope.governanceDecisionId,
        governanceSessionId: envelope.governanceSessionId,
        /* The human who signed the envelope. The DB CHECK requiring a human is untouched. */
        authorizedByActorType: "human",
        authorizedByActorId: envelope.authorizedByActorId,
        boundPayloadDigest: request.payloadDigest,
        status: "active",
        issuedAt: now,
        expiresAt,
        ttlSeconds,
        standingAuthorizationId: envelope.id,
        createdAt: now,
        createdBy: envelope.authorizedByActorId,
        createdByType: "human",
        updatedAt: now,
        updatedBy: envelope.authorizedByActorId,
        updatedByType: "human",
      });

      /*
       * 12 · THE AUDIT EVENT, IN THE SAME TRANSACTION AS THE PERMIT (APF-1).
       *
       * `permit-issued`, through the released action-authorization audit writer, so "a permit
       * exists" and "history says a permit was issued" are one fact. What it names, and why each is
       * true rather than convenient:
       *
       *   actor            the human who signed the envelope — the same person the permit row names
       *                    as its authorizer, and the same rule the released machine SPEND already
       *                    applies to its own `permit-consumed` event. No machine actor is invented.
       *   decision         the STANDING decision. No per-act decision exists, and none is implied.
       *   requestId        no session exists, so the correlation is this request's id.
       *   executed: false  issuing is not executing.
       *
       * Deliberately NOT written: an `approved` request event. On the human path that event records
       * a per-act deliberation; here none happened. That the permit came from an envelope is
       * recorded where it already lives — `standing_authorization_id` on the permit `entityId`
       * names — rather than in a metadata field the released contract does not declare.
       */
      await recordActionAuthorizationEventWithin(
        tx,
        {
          tenantId: request.tenantId,
          userId: envelope.authorizedByActorId,
          requestId: request.id,
        },
        {
          action: ACTION_AUDIT_PERMIT_ISSUED,
          outcome: "committed",
          entityId: permitId,
          metadata: {
            actionRequestId: request.id,
            permitId,
            governanceDecisionId: envelope.governanceDecisionId,
            governanceSessionId: envelope.governanceSessionId,
            actionKind: request.actionKind,
            toolId: request.toolId,
            sideEffect: request.sideEffect,
            reversibility: request.reversibility,
            targetKind: request.targetKind,
            targetRef: request.targetRef,
            payloadDigest: request.payloadDigest,
            expiresAt: expiresAt.toISOString(),
            executed: false,
          },
        },
        now,
      );

      outcome = {
        status: "issued",
        permitId,
        requestId: request.id,
        standingAuthorizationId: envelope.id,
        expiresAt: expiresAt.toISOString(),
        actsIssued: actsIssued + 1,
        maxActs: envelope.maxActs,
      };
    });

    return outcome ?? refused("persistence-unavailable");
  } catch (error) {
    if (error instanceof IssuanceAbort) return refused(error.reason);
    return refused("persistence-unavailable");
  }
}
