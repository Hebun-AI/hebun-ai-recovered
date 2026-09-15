/*
 * action-authorization/read-machine-deliverable-permits.server.ts — RUNTIME DISCOVERY of permits a
 * machine may be handed (RUNG 2 delivery).
 *
 * ── WHY THIS EXISTS BESIDE A TENANT-SCOPED READER ───────────────────────────
 *
 * `readActionPermits` takes a `TenantContext` and is the right shape for a human looking at their
 * own organization. A trigger has no session and no human, so it cannot use that reader — and the
 * fix must never be to let a caller supply the tenant instead, because a parameter that can name a
 * tenant is a parameter that can CHOOSE one.
 *
 * So this reader takes NO SCOPE AT ALL. There is no tenant parameter, no permit parameter, no
 * action-kind parameter and no ordering parameter; the only inputs are injection points. That is
 * exactly the shape `listActiveStandingObservationsForRuntime` established for TRH-25, and it is
 * what makes a reader safe to expose to a machine trigger.
 *
 * ── IT DISCOVERS CANDIDATES. IT DECIDES NOTHING. ────────────────────────────
 *
 * Every row this returns is a HINT. The released executor re-reads the permit, re-derives the
 * tenant from it, re-resolves tenant participation and the root control, re-checks agent liveness
 * and re-applies the frozen action set inside the spend's own transaction. Nothing here is trusted
 * later, so being wrong here can only ever cause a refusal — never an execution that should not
 * have happened.
 *
 * ── `status = 'active'` IS NOT ENOUGH, AND THIS IS NOT THEORETICAL ──────────
 *
 * EXPIRY IS DERIVED, NEVER SWEPT. No job rewrites `status` when a permit lapses, so a row may sit
 * at `active` long after `expires_at` has passed — production holds exactly such a row. A predicate
 * that omitted the clock would rediscover it on every tick forever, spend nothing, and log a
 * refusal each time: a tight failure loop manufactured by the scanner.
 *
 * So `expires_at > now()` is applied HERE, in the DATABASE'S clock — the same predicate, on the
 * same column, against the same clock the single spend itself uses. The two agree by construction
 * rather than by coincidence.
 *
 * ── THE ACTION SET IS CONSULTED, NEVER RESTATED ─────────────────────────────
 *
 * `MACHINE_EXECUTABLE_ACTION_KINDS` is imported. `record-work` is not spelled in this file. If the
 * frozen set ever changes, this reader follows it instead of drifting from it — and it cannot
 * widen it, because it only ever filters BY it.
 *
 * ── UNREADABLE IS NOT EMPTY ─────────────────────────────────────────────────
 *
 * A query failure returns `unavailable`, never `[]`. Reporting an outage as "nothing was
 * deliverable" would turn a database problem into a silent, permanent pause that looks healthy.
 *
 * READ ONLY. No insert, update, delete, transaction, lock or claim appears here. Concurrency is
 * settled by the released single spend, which is the only statement entitled to settle it.
 *
 * Server-only.
 */
import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { type ControlPlaneDatabase } from "@/db/client.server";
/*
 * THE SCHEMA BARREL, IMPORTED FOR ITS SIDE EFFECT AND NOT FOR A BINDING.
 *
 * `@/db/schema` initialises lazily and the shared `tenantColumns` base sits in a module cycle, so a
 * module that reaches a single table file COLD can throw `Cannot access 'tenantColumns' before
 * initialization`. Whether it does depends on the bundle's module order, which is why this was
 * latent: the same source answered 401 on one production deployment and 500 on the next.
 *
 * BOTH WERE OBSERVED, on this route, in production, during the RUNG 2 act path phase. A 500 here
 * means the handler never ran — so its constant-time bearer check never ran either, and the hourly
 * scan silently did nothing. Every module of the standing mutation authority already carries this
 * line; the delivery path is given it for the same reason rather than left to the bundler.
 */
import "@/db/schema";
import { actionPermits, hebyActionRequests } from "@/db/schema/action-authorization";
import { resolveGovernanceDbOrNull } from "@/features/governance-decision/persistence.server";
import { MACHINE_EXECUTABLE_ACTION_KINDS } from "@/features/governed-machine-execution/contracts";

/**
 * The most candidates one scan may ever consider.
 *
 * A CEILING, NOT A TUNING KNOB. It bounds the work a single tick can start so that a backlog
 * degrades into "the next tick continues" rather than into one unbounded run against a serverless
 * time limit. Anything not reached this tick is rediscovered next tick, because eligibility is
 * derived from authoritative rows and never from scheduler bookkeeping.
 */
export const MACHINE_DELIVERABLE_PERMIT_SCAN_LIMIT = 25;

export interface MachineDeliverablePermitReadDeps {
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
 * One candidate. The permit id is what crosses to the executor; the tenant id is carried for
 * per-candidate isolation inside the scan and MUST NOT be forwarded as authority — the executor
 * derives the tenant from the permit row itself and would refuse a supplied one.
 */
export interface MachineDeliverablePermit {
  readonly permitId: string;
  readonly tenantId: string;
}

export type MachineDeliverablePermitsResult =
  | { readonly status: "read"; readonly permits: readonly MachineDeliverablePermit[] }
  /** The control plane could not be read. NOTHING was discovered — which is not the same as none. */
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" };

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Machine-deliverable permit discovery is server-only.");
  }
}

/**
 * Every permit in the deployment that a machine could currently be handed.
 *
 * Takes no arguments beyond injection. There is no parameter through which a caller could narrow,
 * widen, order or target this.
 */
export async function listMachineDeliverablePermitsForRuntime(
  deps: MachineDeliverablePermitReadDeps = {},
): Promise<MachineDeliverablePermitsResult> {
  assertServerOnly();

  const db = (deps.getDb ?? resolveGovernanceDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  const limit = Math.min(deps.limit ?? MACHINE_DELIVERABLE_PERMIT_SCAN_LIMIT, MACHINE_DELIVERABLE_PERMIT_SCAN_LIMIT);

  try {
    const rows = await db
      .select({
        permitId: actionPermits.id,
        tenantId: actionPermits.tenantId,
      })
      .from(actionPermits)
      .innerJoin(
        hebyActionRequests,
        /*
         * THE JOIN IS TENANT-CLOSED. Matching the request id alone would be enough in a healthy
         * database; adding the tenant equality means a row that somehow straddled two organizations
         * produces NO candidate rather than a candidate attributed to the wrong one.
         */
        and(
          eq(hebyActionRequests.id, actionPermits.actionRequestId),
          eq(hebyActionRequests.tenantId, actionPermits.tenantId),
        ),
      )
      .where(
        and(
          /* The stored lifecycle column. Necessary, and on its own not sufficient — see below. */
          eq(actionPermits.status, "active"),
          /*
           * THE CLOCK, AND IT IS THE DATABASE'S. `sql\`now()\`` deliberately, not a JavaScript
           * `Date` — the spend applies this exact comparison against this exact clock, and a
           * scanner reading its own clock could disagree with the authority it feeds.
           */
          gt(actionPermits.expiresAt, sql`now()`),
          /* CONSULTED, NEVER RESTATED. This file does not spell any action kind. */
          inArray(hebyActionRequests.actionKind, [...MACHINE_EXECUTABLE_ACTION_KINDS]),
          /*
           * A MACHINE MAY ONLY DELIVER WHAT AN AGENT PROPOSED. A human-proposed act is a human's to
           * perform; the executor refuses one as `not-agent-proposed`, and discovering it here
           * would only manufacture a refusal per tick.
           */
          eq(hebyActionRequests.proposedByActorType, "agent"),
        ),
      )
      /* OLDEST FIRST, so a backlog drains in the order it was authorized and nothing starves. */
      .orderBy(asc(actionPermits.issuedAt))
      .limit(limit);

    return { status: "read", permits: rows };
  } catch {
    /* FAIL CLOSED, AND HONESTLY: we could not find out. Never "there were none". */
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
