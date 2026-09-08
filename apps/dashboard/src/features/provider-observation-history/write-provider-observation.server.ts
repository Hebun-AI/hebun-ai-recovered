/*
 * provider-observation-history/write-provider-observation.server.ts — THE ONE WRITER (TRH-21).
 *
 * ── WHAT IT DOES, AND WHERE IT MAY BE REACHED FROM ───────────────────────────
 *
 * It records that a provider reported something, at an instant, through a connection. It may be
 * called ONLY after an already-authorized server-side provider read has succeeded, because the
 * three facts it needs — the connection the capability authority chose, the subject the PROVIDER
 * confirmed, and the read instant — exist only on the far side of such a read.
 *
 * ── WHAT IT MUST NOT DO, AND CANNOT ──────────────────────────────────────────
 *
 * It does not initiate a provider read. It imports no provider transport, no credential accessor
 * and no capability authority: it could not contact a provider if it wanted to, and a firewall
 * walks the real import graph rather than trusting this paragraph.
 *
 * It does not mint a tenant context, and it accepts no tenant, actor, membership or role from a
 * caller — the authorized context is a parameter and the actor is read OFF it. A browser has no
 * path here at all; there is no server action, and the only callers are server compositions.
 *
 * It does not ask Governance for anything. **RECORDING WHAT WAS OBSERVED IS NOT DECIDING WHETHER
 * IT SHOULD HAVE BEEN.** That decision was already made, upstream, by the capability authority that
 * let the read happen. Consulting Governance here would create a second answer to a settled
 * question, and a second answer is the beginning of a second authority.
 *
 * It does not schedule, retry, poll or loop. It writes one row and returns.
 *
 * It is not Knowledge ingestion. No knowledge module is reachable from here, and a stored
 * observation acquires no organizational standing by being stored.
 *
 * ── APPEND-ONLY MEANS NO UPDATE PATH EXISTS ──────────────────────────────────
 *
 * This file contains one INSERT and nothing else. There is no update seam, no delete seam, no
 * upsert-with-merge and no correction path, because a later different number is a NEW observation
 * and never a repair of an old one. A retention authority, if one is ever needed, is a separate
 * decision by a separate owner and is deliberately not made here.
 *
 * ── THE IDEMPOTENCY CONTRACT ─────────────────────────────────────────────────
 *
 * `onConflictDoNothing` against the (tenant, provider, subject, instant) unique index. A replay of
 * the SAME observation writes nothing and says so. A genuinely later read is a different instant
 * and therefore a new row — even when every value is identical, because "the number did not change"
 * is itself an observation, and deduplicating it away would erase the only evidence anyone looked.
 *
 * Server-only.
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { getControlPlaneDb, type ControlPlaneDatabase } from "@/db/client.server";
import { providerObservations } from "@/db/schema/provider-observation";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  isObservationPrincipal,
  type ObservationPrincipal,
} from "@/features/standing-observation-authority/observation-principal.server";
import {
  canonicalizeFacts,
  type ObservationFacts,
  type ProviderObservationRecord,
  type ProviderObservationRefusal,
  type ProviderObservationWriteResult,
} from "./contracts";

export interface ProviderObservationWriteDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Provider observation history is server-only.");
  }
}

function resolveDbOrNull(deps: ProviderObservationWriteDeps): ControlPlaneDatabase | null {
  if (deps.getDb) return deps.getDb();
  try {
    return getControlPlaneDb();
  } catch {
    return null;
  }
}

function refused(reason: ProviderObservationRefusal): ProviderObservationWriteResult {
  return { status: "refused", reason };
}

/** A usable instant: an ISO string a `Date` accepts, stored as UTC. Never "now" invented here. */
function parseInstant(value: string): Date | null {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Record one provider observation.
 *
 * THE TENANT IS THE AUTHORIZED CONTEXT'S, ALWAYS. `tenant.tenantId` is the only tenant this can
 * write under and no argument can override it — which is what makes cross-tenant filing
 * unrepresentable at the seam, before the composite foreign key makes it unrepresentable at rest.
 */
export async function recordProviderObservation(
  tenant: TenantContext | null,
  record: ProviderObservationRecord,
  deps: ProviderObservationWriteDeps = {},
): Promise<ProviderObservationWriteResult> {
  assertServerOnly();
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");

  const observedAt = parseInstant(record.observedAt);
  if (
    observedAt === null ||
    record.providerKey.trim().length === 0 ||
    record.capabilityKey.trim().length === 0 ||
    record.subjectRef.trim().length === 0 ||
    record.integrationId.trim().length === 0
  ) {
    return refused("invalid-observation");
  }

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");

  const facts = canonicalizeFacts(record.facts);
  const factsDigest = createHash("sha256").update(facts).digest("hex");

  try {
    const inserted = await db
      .insert(providerObservations)
      .values({
        tenantId: tenant.tenantId,
        integrationId: record.integrationId,
        providerKey: record.providerKey,
        capabilityKey: record.capabilityKey,
        subjectKind: record.subjectKind,
        subjectRef: record.subjectRef,
        observedAt,
        /*
         * The ACTOR IS READ OFF THE AUTHORIZED CONTEXT, never supplied. `TenantContext` is nominally
         * branded as a human member and can be minted at exactly one site, so this literal is true
         * by construction today — and the columns exist so that a future non-human principal cannot
         * be introduced without this record saying which one observed.
         */
        observedByActorType: "human",
        observedByActorId: tenant.userId,
        facts: record.facts,
        factsDigest,
      })
      /* THE IDEMPOTENCY CONTRACT. One subject, one instant, one row — see the header. */
      .onConflictDoNothing({
        target: [
          providerObservations.tenantId,
          providerObservations.providerKey,
          providerObservations.subjectRef,
          providerObservations.observedAt,
        ],
      })
      .returning({ id: providerObservations.id });

    const row = inserted[0];
    return row ? { status: "recorded", observationId: row.id } : { status: "already-recorded" };
  } catch {
    /*
     * NOTHING IS CLAIMED FROM A FAILED WRITE. The caller's observation still happened and is still
     * true; what failed is Hebun's memory of it, and saying so is different from saying the read
     * failed.
     */
    return refused("persistence-unavailable");
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TRH-24 — THE MACHINE-PROVENANCE ENTRY POINT.
 *
 * ── ONE AUTHORITY, TWO ENTRY POINTS, NOT TWO AUTHORITIES ────────────────────
 *
 * This is the same table, the same append-only rule, the same idempotency contract and the same
 * closed `facts` projection. What differs is the ONE thing that actually differs: who caused the
 * read. A second observation authority would have been a second source of truth for a question this
 * one already answers.
 *
 * ── NOTHING ABOUT THE SCOPE IS ACCEPTED FROM THE CALLER ─────────────────────
 *
 * The tenant, provider, capability, subject and connection are read OFF THE PRINCIPAL, which read
 * them off the authorization row. The caller supplies only what the PROVIDER said — the instant and
 * the typed facts — because those are the only two things the authorization cannot know in advance.
 *
 * A caller that wanted to file against a different scope would have to change what Governance
 * authorized.
 *
 * ── AND IT STILL CANNOT CAUSE A READ ────────────────────────────────────────
 *
 * This module imports no transport, no credential seam and no provider adapter. Recording an
 * observation and performing one remain different acts in different modules, exactly as TRH-21 left
 * them.
 * ═════════════════════════════════════════════════════════════════════════ */

/** What the PROVIDER said. The only two facts the authorization could not already know. */
export interface ObservedProviderReport {
  /** Hebun's read instant, UTC, as the released observation seam recorded it. */
  readonly observedAt: string;
  readonly facts: ObservationFacts;
}

/**
 * Record one observation performed under a standing authorization by an ephemeral principal.
 *
 * The principal is verified at RUNTIME through the released guard, so a cast cannot forge one. Its
 * `authorizationId` and `invocationId` become the row's whole provenance, and the human actor pair
 * is written NULL — which the database's XOR check requires and which is simply true: no human
 * performed this read.
 */
export async function recordAuthorizedProviderObservation(
  principal: ObservationPrincipal,
  report: ObservedProviderReport,
  deps: ProviderObservationWriteDeps = {},
): Promise<ProviderObservationWriteResult> {
  assertServerOnly();

  /*
   * THE RUNTIME GUARD. `AgentProposer`'s precedent, for the same reason: the brand exists at runtime
   * precisely so that satisfying the compiler is not enough.
   */
  if (!isObservationPrincipal(principal)) return refused("not-an-observation-principal");

  const observedAt = parseInstant(report?.observedAt);
  if (observedAt === null) return refused("invalid-observation");

  const db = resolveDbOrNull(deps);
  if (!db) return refused("persistence-unavailable");

  const facts = canonicalizeFacts(report.facts);
  const factsDigest = createHash("sha256").update(facts).digest("hex");

  /*
   * ── THE CADENCE WINDOW IS CLAIMED BY THE INSERT ITSELF (TRH-25 prerequisite) ──────────────
   *
   * WHY THIS IS NOT A SECOND CADENCE AUTHORITY. The revalidator decides whether a read may BEGIN
   * and remains the only place that decides. This statement decides nothing: it refuses to STORE a
   * sample the authorization's own ceiling already excludes. Same rule, same source — the interval
   * arrives on the principal, off the authorization row — asserted at the only moment where the
   * database can make it atomic.
   *
   * WHY IT IS NEEDED AT ALL. `observed_at` is HEBUN'S clock at read time, so two concurrent
   * invocations produce two different instants and two different invocation ids. Neither unique
   * index collapses them, and both would previously have inserted. Read-then-write is not
   * enforcement under concurrency, and the manual ceremony is simply the case where concurrency
   * never happened to occur.
   *
   * WHY NOT A LOCK. A mutex that actually prevented the second PROVIDER CALL would have to be held
   * across the provider's network I/O. No transaction in this repository spans network I/O — the
   * OAuth callback deliberately exchanges its token OUTSIDE the transaction that stores it — and
   * production runs on a transaction-pooled connection where a session-level advisory lock is
   * unsafe and a transaction-level one would pin a pooled server connection for the length of a
   * provider call. So the honest guarantee is stated exactly: THIS MAKES A DUPLICATE OBSERVATION
   * UNRECORDABLE. It does not make a duplicate provider CALL impossible, and this comment does not
   * pretend otherwise. Two racing invocations may each spend provider quota; exactly one row can
   * result, and the loser is told which rule stopped it.
   *
   * NO LOCK MEANS NOTHING TO LEAK. A crashed process leaves no lease, no lock and no reservation to
   * reclaim, so there is no scheduler state here and nothing that could need a reaper.
   *
   * `on conflict do nothing` STAYS, and is now the inner of two guards: the window claim answers
   * "a different instant already occupies this window", the conflict target answers TRH-21's
   * original "this exact instant is already on record". Two facts, two mechanisms, neither removed.
   */
  const windowMinutes = Number.isFinite(principal.intervalMinutes) ? principal.intervalMinutes : 0;

  try {
    /*
     * ── ONE SHORT TRANSACTION, SERIALIZED ON THE AUTHORIZATION'S OWN ROW ──────────────────────
     *
     * `insert ... where not exists` ALONE DOES NOT SETTLE THIS, and believing it does is the
     * subtle version of the bug. Under READ COMMITTED neither of two concurrent statements can see
     * the other's uncommitted row, so both `not exists` tests pass and both rows commit. The
     * predicate needs an arbiter, and a time window cannot be a unique index.
     *
     * So the writers are serialized on a row that already exists and already means the right
     * thing: the standing authorization being spent. `for update` makes the second writer WAIT for
     * the first to commit and then re-evaluate the window against a state that now includes it.
     * Different authorizations take different row locks, so nothing is globally serialized.
     *
     * THE TRANSACTION CONTAINS NO NETWORK I/O — only the lock and the insert. The provider call
     * already happened, outside it. That matters: no transaction in this repository spans network
     * I/O, production runs on a transaction-pooled connection, and a lock held across a provider
     * call would pin a pooled server connection for the length of that call.
     *
     * A CRASH RELEASES IT WITH NOTHING TO RECLAIM. The lock is the transaction; a dead process
     * aborts it and leaves no lease, no reservation and no scheduler state for a reaper to find.
     */
    const outcome = await db.transaction(async (tx) => {
      await tx.execute(sql`
        select 1
          from standing_observation_authorizations
         where id = ${principal.authorizationId}::uuid
           and tenant_id = ${principal.tenantId}::uuid
           for update
      `);

      const claimed = await tx.execute<{ id: string }>(sql`
        insert into provider_observations (
          tenant_id, integration_id, provider_key, capability_key, subject_kind, subject_ref,
          observed_at, observed_by_actor_type, observed_by_actor_id,
          standing_authorization_id, invocation_id, facts, facts_digest
        )
        select
          ${principal.tenantId}::uuid, ${principal.integrationId}::uuid, ${principal.providerKey},
          ${principal.capabilityKey}, ${principal.subjectKind}, ${principal.subjectRef},
          ${observedAt}::timestamptz,
          null, null,
          ${principal.authorizationId}::uuid, ${principal.invocationId}::uuid,
          ${facts}::jsonb, ${factsDigest}
        where not exists (
          select 1
            from provider_observations p
           where p.tenant_id = ${principal.tenantId}::uuid
             and p.provider_key = ${principal.providerKey}
             and p.capability_key = ${principal.capabilityKey}
             and p.subject_ref = ${principal.subjectRef}
             /*
              * MACHINE OBSERVATIONS ONLY, exactly as the revalidator measures it. A human read never
              * touches the authorization, and letting one bound this window would make a Governance
              * decision retroactively govern an act performed before it existed.
              */
             and p.standing_authorization_id is not null
             /*
              * WITHIN THE CEILING IN EITHER DIRECTION, AND THE SYMMETRY IS THE WHOLE POINT.
              *
              * The obvious predicate is "a PRIOR observation inside the window", mirroring the
              * revalidator's "how long since the last one". It is wrong here, and a concurrency
              * proof is what shows it: of two racing writers, whichever holds the EARLIER instant
              * never sees the later one, so if the later commits first the earlier still inserts
              * and two rows survive. A one-sided test cannot serialize a pair.
              *
              * Stated symmetrically the rule is order-independent, which is what makes it safe:
              * TWO MACHINE OBSERVATIONS OF ONE SCOPE MAY NOT LIE WITHIN THE CEILING OF EACH OTHER.
              * Whichever writer reaches the lock first wins, and the second is refused no matter
              * which way round their instants fell.
              */
             and p.observed_at > ${observedAt}::timestamptz - make_interval(mins => ${windowMinutes})
             and p.observed_at < ${observedAt}::timestamptz + make_interval(mins => ${windowMinutes})
        )
        on conflict (tenant_id, provider_key, subject_ref, observed_at) do nothing
        returning id
      `);

      const row = claimed.rows[0];
      if (row) return { status: "recorded", observationId: row.id } as const;

      /*
       * ZERO ROWS. The GUARANTEE is already settled — nothing was written — and what remains is
       * only to say WHICH rule settled it, which is a report and not a decision.
       */
      const sameInstant = await tx.execute<{ n: number }>(sql`
        select count(*)::int as n
          from provider_observations p
         where p.tenant_id = ${principal.tenantId}::uuid
           and p.provider_key = ${principal.providerKey}
           and p.subject_ref = ${principal.subjectRef}
           and p.observed_at = ${observedAt}::timestamptz
      `);
      return (sameInstant.rows[0]?.n ?? 0) > 0
        ? ({ status: "already-recorded" } as const)
        : refused("cadence-window-already-observed");
    });

    return outcome;
  } catch (error) {
    /*
     * A REPLAY OF THIS RUN'S PERSISTENCE, REPORTED AS ITSELF. The partial unique index on
     * `invocation_id` refuses a second row for one invocation, and that is a different fact from
     * "this subject was already observed at this instant" — so it gets a different refusal instead
     * of being folded into `persistence-unavailable`, which would have blamed the database.
     */
    if (isInvocationConflict(error)) return refused("invocation-already-recorded");
    /*
     * NOTHING IS CLAIMED FROM A FAILED WRITE. The observation still happened and is still true;
     * what failed is Hebun's memory of it. OBSERVED and RECORDED are different states and the
     * caller is told which one it has.
     */
    return refused("persistence-unavailable");
  }
}

/**
 * PostgreSQL `unique_violation` naming the invocation index. Read from the DRIVER, never guessed
 * from a message.
 *
 * BOTH LEVELS ARE INSPECTED because drizzle wraps the driver's error and the code and constraint
 * name then live on `cause`. The released credential authority reads both for exactly this reason;
 * checking only the top level looks correct and silently never matches, which would have reported a
 * replay as `persistence-unavailable` — blaming the database for a rule this phase wrote.
 */
function isInvocationConflict(error: unknown): boolean {
  const named = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null) return false;
    const e = value as { code?: unknown; constraint?: unknown };
    return e.code === "23505" && e.constraint === "provider_observations_invocation_uidx";
  };
  if (named(error)) return true;
  return named((error as { cause?: unknown } | null)?.cause);
}
