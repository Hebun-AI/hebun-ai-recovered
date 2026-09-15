/*
 * action-authorization/read-standing-issuable-requests.server.ts — RUNTIME DISCOVERY of pending
 * agent proposals a standing envelope might cover (RUNG 2 act path).
 *
 * ── WHY THIS EXISTS BESIDE A TENANT-SCOPED READER ───────────────────────────
 *
 * `readPendingActionRequests` takes a `TenantContext` and is the right shape for a human looking at
 * their own queue. A trigger has no session and no human, so it cannot use that reader — and the
 * fix must never be to let a caller supply the tenant instead, because a parameter that can name a
 * tenant is a parameter that can CHOOSE one.
 *
 * So this reader takes NO SCOPE AT ALL. There is no tenant parameter, no request parameter, no
 * agent parameter, no action-kind parameter and no ordering parameter; the only inputs are
 * injection points. That is the shape `listActiveStandingObservationsForRuntime` established for
 * TRH-25 and `listMachineDeliverablePermitsForRuntime` follows for RUNG 1.5, and it is what makes a
 * reader safe to expose to a machine trigger.
 *
 * ── IT DISCOVERS CANDIDATES. IT DECIDES NOTHING. ────────────────────────────
 *
 * Every row this returns is a HINT. The released issuer re-reads the request, re-derives the tenant
 * from it, locks the effective envelope revision FOR UPDATE, and re-applies the window, the quota,
 * the cadence, the evidence admissibility, the evidence-reuse rule, tenant enrolment, agent
 * liveness, the frozen action set and the payload digest inside the issuing transaction. This file
 * re-implements none of them and cannot overrule any of them.
 *
 *     THE DISCOVERY DECIDES *WHICH ROWS TO ASK ABOUT*. IT NEVER DECIDES *WHETHER*.
 *
 * Being wrong here can only ever cause a REFUSAL, never an issuance that should not have happened.
 *
 * ── THE PREDICATE IS A COURTESY FILTER, AND EVERY CLAUSE IS RE-DECIDED LATER ─
 *
 * `pending`, agent-proposed, machine-executable, and a standing envelope exists for that exact
 * tenant and agent. Each saves reads per tick; none is trusted. Deliberately ABSENT from this
 * predicate: the envelope's window, quota, cadence and state. They are all facts the issuer must
 * evaluate behind its own row lock, and evaluating them here without the lock would produce an
 * answer that could already be stale by the time the issuer asked — while creating a second place
 * where the quota is counted. TRH-25 paid for that lesson: `where not exists` is not a mutex.
 *
 * ── NO EVIDENCE PREDICATE, ON PURPOSE ───────────────────────────────────────
 *
 * Whether a proposal carries an admitted evidence class, and whether that exact evidence has already
 * funded an act, are both the issuer's to decide — the second one behind the lock, because it is a
 * count over rows the issuing transaction is about to add to. A SQL approximation here would be a
 * second evidence-uniqueness authority that could disagree with the real one.
 *
 * ── UNREADABLE IS NOT EMPTY ─────────────────────────────────────────────────
 *
 * A query failure returns `unavailable`, never `[]`. Reporting an outage as "nothing was issuable"
 * would turn a database problem into a silent, permanent pause that looks healthy.
 *
 * READ ONLY. No insert, update, delete, transaction, lock or claim appears here. Concurrency is
 * settled by the released issuer, which is the only code entitled to settle it.
 *
 * Server-only.
 */
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
/*
 * THE SCHEMA BARREL, IMPORTED FOR ITS SIDE EFFECT AND NOT FOR A BINDING.
 *
 * `@/db/schema` initialises lazily, and the shared `tenantColumns` base sits in a module cycle: a
 * module that reaches a single table file COLD throws `Cannot access 'tenantColumns' before
 * initialization`. Importing the barrel first is the released fix — every module in the standing
 * mutation authority already carries this exact line for this exact reason.
 *
 * IT IS NOT COSMETIC. Without it this file loaded fine under the test runner and under `tsx`, and
 * the deployed route answered production with a 500 on every call: the handler never ran, so its
 * bearer check never ran either. A guard that cannot load is not a guard.
 */
import "@/db/schema";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import { standingMutationAuthorizations } from "@/db/schema/standing-mutation-authorization";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "@/features/governed-machine-execution/contracts";

/**
 * The most candidates one scan may ever consider.
 *
 * A CEILING, NOT A TUNING KNOB. It bounds the work a single tick can start so that a backlog
 * degrades into "the next tick continues" rather than into one unbounded run against a serverless
 * time limit. Anything not reached this tick is rediscovered next tick, because eligibility is
 * derived from authoritative rows and never from scheduler bookkeeping.
 *
 * It is NOT a quota. The envelope's `max_acts` is the quota, it is enforced by the issuer behind a
 * row lock, and this number can neither raise nor lower it.
 */
export const STANDING_ISSUABLE_REQUEST_SCAN_LIMIT = 25;

export interface StandingIssuableRequestReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  /**
   * CLAMPED, AND CLAMPED DOWNWARD ONLY.
   *
   * Present so boundedness is provable without inserting twenty-six fixtures. It passes through
   * `Math.min`, so no caller — injected or otherwise — can raise the ceiling above the constant.
   * A parameter that could only narrow is not an authority.
   */
  readonly limit?: number;
}

/**
 * One candidate. The REQUEST ID is what crosses to the issuer; the tenant id is carried for
 * per-candidate isolation inside the scan and MUST NOT be forwarded as authority — the issuer
 * derives the tenant from the request row itself and has no parameter that could accept one.
 */
export interface StandingIssuableRequest {
  readonly requestId: string;
  readonly tenantId: string;
}

export type StandingIssuableRequestsResult =
  | { readonly status: "read"; readonly requests: readonly StandingIssuableRequest[] }
  /** The control plane could not be read. NOTHING was discovered — which is not the same as none. */
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Standing-issuable request discovery is server-only.");
  }
}

/**
 * Every pending agent proposal in the deployment that a standing envelope might cover.
 *
 * Takes no arguments beyond injection. There is no parameter through which a caller could narrow,
 * widen, order or target this.
 */
export async function listStandingIssuableRequestsForRuntime(
  deps: StandingIssuableRequestReadDeps = {},
): Promise<StandingIssuableRequestsResult> {
  assertServerOnly();

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  const limit = Math.min(
    deps.limit ?? STANDING_ISSUABLE_REQUEST_SCAN_LIMIT,
    STANDING_ISSUABLE_REQUEST_SCAN_LIMIT,
  );

  try {
    const rows = await db
      .selectDistinct({
        requestId: hebyActionRequests.id,
        tenantId: hebyActionRequests.tenantId,
        createdAt: hebyActionRequests.createdAt,
      })
      .from(hebyActionRequests)
      /*
       * AN ENVELOPE MUST EXIST FOR THIS EXACT TENANT AND AGENT.
       *
       * Joined rather than checked afterwards so a deployment where no organization has authorized
       * anything discovers NOTHING — which is the state production is in, and the scan must cost a
       * single query in it. The join is on BOTH columns: an envelope belonging to another tenant
       * must never make another tenant's proposal a candidate.
       *
       * WHICH revision, and whether it is `active`, in-window, unspent and inside its cadence, is
       * deliberately NOT decided here. The issuer locks the effective revision and decides all of
       * it there. This join asks only "is there any envelope at all for this pair?", which is why
       * `selectDistinct` is used: a lineage with several revisions must not yield several
       * candidates for one request.
       */
      .innerJoin(
        standingMutationAuthorizations,
        and(
          eq(standingMutationAuthorizations.tenantId, hebyActionRequests.tenantId),
          eq(standingMutationAuthorizations.agentId, hebyActionRequests.proposedByActorId),
        ),
      )
      /*
       * AND NO PERMIT MAY ALREADY EXIST FOR THIS REQUEST.
       *
       * A LEFT JOIN with a null test rather than a `not exists`, for the same reason the delivery
       * scan derives expiry in SQL: it is one query. The released
       * `action_permits_request_uq` is the authority that makes one-permit-per-request true, and
       * the issuer refuses `already-permitted` regardless of what this clause says. This exists so
       * a settled request is not rediscovered on every tick forever — a tight refusal loop
       * manufactured by the scanner, which is exactly the failure RUNG 1.5 had to repair.
       */
      .leftJoin(
        actionPermits,
        and(
          eq(actionPermits.actionRequestId, hebyActionRequests.id),
          eq(actionPermits.tenantId, hebyActionRequests.tenantId),
        ),
      )
      .where(
        and(
          isNull(actionPermits.id),
          /* Only a proposal still awaiting a decision. A decided one is not the issuer's business. */
          eq(hebyActionRequests.status, "pending"),
          /*
           * A STANDING ENVELOPE COVERS ITS AGENT'S OWN PROPOSALS, NEVER A HUMAN'S.
           *
           * A human who proposes an act and walks away has not asked for it to be authorized
           * without them. The issuer refuses `not-agent-proposed`, and discovering one here would
           * only manufacture a refusal per tick.
           */
          eq(hebyActionRequests.proposedByActorType, "agent"),
          /* CONSULTED, NEVER RESTATED. This file does not spell any action kind. */
          inArray(hebyActionRequests.actionKind, [...MACHINE_EXECUTABLE_ACTION_KINDS]),
        ),
      )
      /* OLDEST FIRST, so a backlog drains in the order it was proposed and nothing starves. */
      .orderBy(asc(hebyActionRequests.createdAt))
      .limit(limit);

    return {
      status: "read",
      requests: rows.map((row) => ({ requestId: row.requestId, tenantId: row.tenantId })),
    };
  } catch {
    /* FAIL CLOSED, AND HONESTLY: we could not find out. Never "there were none". */
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
