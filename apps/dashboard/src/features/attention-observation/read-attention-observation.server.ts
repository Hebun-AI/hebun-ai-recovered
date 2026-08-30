/*
 * attention-observation/read-attention-observation.server.ts — THE COMPOSITION (E2-4).
 *
 * ── IT COMPOSES; IT OWNS NOTHING ─────────────────────────────────────────────
 *
 * Four released readers, four independent availabilities, one shared evaluation instant. This
 * module issues NO statement of its own, holds no table, writes nothing and defines no authority.
 * Every fact it reports is read through the subsystem that already owns it:
 *
 * ── WHAT IS DELIBERATELY ABSENT: THE EXECUTION LEDGER ────────────────────────
 *
 * An earlier draft derived "how long has the longest attempt been awaiting an outcome" from
 * `readExecutionLedger`. GE-1 pins that read to EXACTLY ONE caller — the `/approvals` route — so
 * that the durable record of irreversible acts is read at one place and no second surface can
 * render a divergent execution history. E2-4 does not widen that pin: the observation was DROPPED,
 * not argued for.
 *
 * The related fact that survives is `approvedUnexecuted`, and it is different in kind: it counts
 * proposals with NO attempt at all, derived inside action-authorization's own aggregate by the same
 * `not exists` its released permit reader already performs. It reads no execution history.
 *
 *     APPROVED WITH NO ATTEMPT != EXECUTION HISTORY
 *
 *   awaiting decision      -> action-authorization  (`heby_action_requests.created_at`)
 *   authorized, unspent    -> action-authorization  (`action_permits.issued_at` / `expires_at`)
 *   most recent recorded act     -> governance-activity (`audit_log.occurred_at`)
 *
 * It is deliberately NOT a central module that acquires those subsystems' semantics: each block
 * below names the exact column it was measured from, and the arithmetic is the pure primitive in
 * `contracts.ts`. There is no "organizational events" table here, no cache, and no second copy of
 * anything.
 *
 * ── FOUR AVAILABILITIES, NEVER MERGED ────────────────────────────────────────
 *
 * An unreadable ledger must not make the decision queue look empty, and an empty queue must not
 * look like a failed read. Each block carries its own `status`, exactly as `/command` already keeps
 * its three reads apart.
 *
 *     UNAVAILABLE != NOTHING WAITING        UNAVAILABLE != ZERO DURATION
 *
 * ── THE CLOCK IS A PARAMETER ─────────────────────────────────────────────────
 *
 * `now` is injected and resolved ONCE, so every duration in one reading is measured against one
 * instant and a test can pin it. No function below calls `Date.now()`.
 *
 * READ/DERIVATION ONLY. It cannot approve, reject, withdraw, issue, revoke, consume, execute,
 * retry or send.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  readApprovedUnexecutedAggregate,
  readAwaitingDecisionAggregate,
  type AwaitingDecisionDeps,
} from "@/features/action-authorization/awaiting-decision-aggregate.server";
import {
  readActionPermits,
  type ActionPermitView,
} from "@/features/action-authorization/read-action-authorizations.server";
import { observeGovernanceActivity } from "@/features/governance-activity/observe.server";
import {
  ATTENTION_NON_CLAIMS,
  elapsedSince,
  longerOf,
  remainingUntil,
  type ElapsedObservation,
} from "./contracts";

/* ═══════════════════════════════════════════════════════════════════════════
 * THE BLOCKS
 * ═════════════════════════════════════════════════════════════════════════ */

export type AttentionBlock<T> =
  | { readonly status: "observed"; readonly value: T }
  | { readonly status: "unavailable"; readonly reason: string };

/** What is still awaiting a human decision, and how long the oldest has been waiting. */
export interface AwaitingDecisionObservation {
  /** Unbounded — every pending proposal, not the list reader's first fifty. */
  readonly awaiting: number;
  /**
   * Elapsed since the OLDEST pending proposal was filed. `null` when nothing is awaiting, and
   * `null` is not a duration of zero — a caller renders the count, never an age of nothing.
   */
  readonly oldestWaiting: ElapsedObservation | null;
}

/**
 * Approved, and no execution attempt behind it. SIA-1 publishes the count; this adds the WHEN.
 *
 *     APPROVED != EXECUTED        AN APPROVAL AUTHORIZES AN ACT, IT DOES NOT PERFORM ONE
 */
export interface ApprovedUnexecutedObservation {
  readonly approvedWithoutAttempt: number;
  /** Elapsed since the OLDEST such approval. `null` when there are none. */
  readonly oldestApproved: ElapsedObservation | null;
}

/** Authorizations that exist and have not been used. Time REMAINING, from the permit's own expiry. */
export interface AuthorizedUnspentObservation {
  readonly active: number;
  /** The soonest expiry among active permits. `null` when none is active. */
  readonly soonestExpiry: ElapsedObservation | null;
  /** Elapsed since the LONGEST-HELD active permit was issued. */
  readonly longestHeld: ElapsedObservation | null;
}

/** How long since the most recent act Hebun recorded. Never "since the organization last acted". */
export interface RecordedActRecencyObservation {
  readonly totalRecordedActs: number;
  readonly sinceMostRecent: ElapsedObservation | null;
}

export interface AttentionObservation {
  /** The one instant every duration in this reading was measured against. */
  readonly evaluatedAt: string;
  readonly awaitingDecision: AttentionBlock<AwaitingDecisionObservation>;
  readonly approvedUnexecuted: AttentionBlock<ApprovedUnexecutedObservation>;
  readonly authorizedUnspent: AttentionBlock<AuthorizedUnspentObservation>;
  readonly recordedActRecency: AttentionBlock<RecordedActRecencyObservation>;
  /** Carried with the numbers, never left to a surface to remember. */
  readonly nonClaims: readonly string[];
}

export type AttentionObservationRead =
  | { readonly status: "observed"; readonly observation: AttentionObservation }
  | { readonly status: "unavailable"; readonly reason: string };

export interface AttentionObservationDeps extends AwaitingDecisionDeps {
  /** Injected so every duration in one reading shares one pinned instant. */
  readonly now?: () => Date;
  /*
   * The four released readers, injectable exactly as `LiveMapDeps` injects its three. They default
   * to the real tenant-scoped reads; a caller may substitute one, and nothing here can substitute a
   * TENANT — every predicate still lives inside the reader being replaced.
   */
  readonly readAwaiting?: typeof readAwaitingDecisionAggregate;
  readonly readApproved?: typeof readApprovedUnexecutedAggregate;
  readonly readPermits?: typeof readActionPermits;
  readonly readActivity?: typeof observeGovernanceActivity;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * THE READ
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * Permits that are ACTIVE, by the released derivation.
 *
 * `state` is `derivePermitState`'s answer, computed by the owner at read time from status and
 * expiry together. This module re-derives nothing: an expired permit is already reported as
 * `expired` by its owner, and E2-4 does not get to disagree about that.
 */
function activePermits(permits: readonly ActionPermitView[]): readonly ActionPermitView[] {
  return permits.filter((permit) => permit.state === "active");
}

/**
 * Read this tenant's elapsed-time observations.
 *
 * The tenant arrives as the already-resolved server context and there is no parameter by which a
 * caller could name another organization. Every predicate lives in the released readers below,
 * where it was already bound once per statement.
 */
export async function readAttentionObservation(
  tenant: TenantContext | null,
  deps: AttentionObservationDeps = {},
): Promise<AttentionObservationRead> {
  if (typeof window !== "undefined") {
    throw new Error("Attention observation reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "no-authorized-tenant-context" };

  /* ONE instant, resolved once, shared by every duration below. */
  const evaluatedAt = (deps.now?.() ?? new Date()).toISOString();

  const [awaiting, approved, permits, activity] = await Promise.all([
    (deps.readAwaiting ?? readAwaitingDecisionAggregate)(tenant, deps),
    (deps.readApproved ?? readApprovedUnexecutedAggregate)(tenant, deps),
    (deps.readPermits ?? readActionPermits)(tenant, { getDb: deps.getDb, now: deps.now }),
    (deps.readActivity ?? observeGovernanceActivity)(tenant, { now: deps.now }),
  ]);

  const awaitingDecision: AttentionBlock<AwaitingDecisionObservation> =
    awaiting.status === "read"
      ? {
          status: "observed",
          value: {
            awaiting: awaiting.value.awaiting,
            oldestWaiting: elapsedSince(
              awaiting.value.oldestFiledAt,
              evaluatedAt,
              "action-request.created_at",
            ),
          },
        }
      : { status: "unavailable", reason: awaiting.reason };

  const approvedUnexecuted: AttentionBlock<ApprovedUnexecutedObservation> =
    approved.status === "read"
      ? {
          status: "observed",
          value: {
            approvedWithoutAttempt: approved.value.approvedWithoutAttempt,
            oldestApproved: elapsedSince(
              approved.value.oldestApprovedAt,
              evaluatedAt,
              "action-request.approved_at",
            ),
          },
        }
      : { status: "unavailable", reason: approved.reason };

  const authorizedUnspent: AttentionBlock<AuthorizedUnspentObservation> =
    permits.status === "read"
      ? (() => {
          const active = activePermits(permits.items);
          let soonest: ElapsedObservation | null = null;
          let longest: ElapsedObservation | null = null;
          for (const permit of active) {
            const remaining = remainingUntil(
              permit.expiresAt,
              evaluatedAt,
              "action-permit.expires_at",
            );
            if (remaining !== null && (soonest === null || remaining.milliseconds < soonest.milliseconds)) {
              soonest = remaining;
            }
            longest = longerOf(
              longest,
              elapsedSince(permit.issuedAt, evaluatedAt, "action-permit.issued_at"),
            );
          }
          return {
            status: "observed",
            value: { active: active.length, soonestExpiry: soonest, longestHeld: longest },
          };
        })()
      : { status: "unavailable", reason: permits.reason };

  const recordedActRecency: AttentionBlock<RecordedActRecencyObservation> =
    activity.status === "observed"
      ? {
          status: "observed",
          value: {
            totalRecordedActs: activity.observation.totalRecordedActs,
            sinceMostRecent: elapsedSince(
              activity.observation.latestOccurredAt,
              evaluatedAt,
              "audit-log.occurred_at",
            ),
          },
        }
      : { status: "unavailable", reason: activity.reason };

  return {
    status: "observed",
    observation: {
      evaluatedAt,
      awaitingDecision,
      approvedUnexecuted,
      authorizedUnspent,
      recordedActRecency,
      nonClaims: ATTENTION_NON_CLAIMS,
    },
  };
}
