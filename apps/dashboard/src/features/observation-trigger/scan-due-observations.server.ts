/*
 * observation-trigger/scan-due-observations.server.ts — the automatic due-scan (TRH-25).
 *
 * ── WHAT THIS DECIDES, AND THE ONE THING IT MUST NEVER DECIDE ───────────────
 *
 *     THE TRIGGER DECIDES *WHEN*. IT NEVER DECIDES *WHETHER*.
 *
 * It enumerates the deployment's active authorizations, skips the ones whose cadence has not
 * elapsed, and hands each remaining AUTHORIZATION ID to the released TRH-24 composition. That
 * composition takes one argument and reads every scope field off the row, so there is no parameter
 * here through which a tenant, provider, capability, subject, connection or credential could be
 * chosen — by this module, by its caller, or by anything that ever calls its caller.
 *
 * ── IT DUPLICATES NO AUTHORIZATION LOGIC ────────────────────────────────────
 *
 * Active, effective, observable, connection-owned, connection-healthy, capability-available,
 * capability-read-only, credential-present, operator-switch-enabled and cadence are ALL decided by
 * the released revalidator, immediately before transport, against freshly re-read rows. This file
 * re-implements none of them and cannot overrule any of them.
 *
 * The one rule it evaluates itself is the cadence ceiling, and only as a COURTESY: it saves a
 * principal mint and several reads per authorization per tick. The revalidator applies the same
 * rule authoritatively afterwards. If the two ever disagreed, the authoritative one wins and this
 * one being wrong could only ever cause a REFUSAL — never a read that should not have happened.
 *
 * ── ISOLATED PER AUTHORIZATION, NOT FAIL-FAST ───────────────────────────────
 *
 * One organization's unhealthy connection, exhausted quota or withdrawn grant must not stop every
 * other organization's observation. So each authorization is processed independently and its
 * outcome recorded; a refusal is data, not an exception. The blast radius of any single failure is
 * exactly one authorization.
 *
 * SEQUENTIALLY, AND THAT IS DELIBERATE. Running them in parallel would put several provider calls
 * and several database transactions in flight at once for no benefit — a scan is not latency
 * sensitive — and would make the concurrency guarantee harder to reason about rather than easier.
 *
 * ── NO RETRY, NO SCHEDULE, NO STATE ─────────────────────────────────────────
 *
 * There is no loop that re-attempts anything, no backoff, no next-run computation and nothing
 * written about when to run again. A failed attempt is simply reported; the next tick will find it
 * due again because DUE IS DERIVED from stored observations and never from scheduler bookkeeping.
 * Nothing here persists, so nothing here can drift from the authorities it reads.
 *
 * Server-only.
 */
import {
  observeOnceUnderAuthorization,
  type ObserveOnceDeps,
} from "@/features/provider-observation-history/observe-once-under-authorization.server";
import { readLatestAuthorizedObservationAt } from "@/features/provider-observation-history/read-provider-observations.server";
import { listActiveStandingObservationsForRuntime } from "@/features/standing-observation-authority/read-standing-observations.server";
import {
  classifyObserveOutcome,
  type ScanOutcome,
  type ScanResult,
  type ScannedAuthorizationOutcome,
} from "./contracts";

/**
 * Injection only. There is deliberately no field here naming a tenant, an authorization, a
 * provider, a capability, a subject, a connection, a credential or a limit.
 *
 * THE TRANSPORT FIELDS ARE PICKED FROM THE COMPOSITION'S OWN CONTRACT rather than restated. Two
 * reasons, and the second is the load-bearing one: the shape cannot drift from the seam it is
 * forwarded to, and this module never spells the word `fetch` — which keeps it honestly outside the
 * released census of modules that talk to the outside world. It forwards a transport; it is not one.
 */
export interface ScanDueObservationsDeps
  extends Pick<ObserveOnceDeps, "getDb" | "env" | "fetchImpl" | "timeoutMs"> {
  /** Injectable so cadence is provable without waiting a day. Never reaches a column. */
  readonly now?: () => Date;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The observation due-scan is server-only.");
  }
}

/**
 * Scan every active authorization in the deployment and attempt the ones whose cadence has elapsed.
 *
 * TAKES NO SCOPE. The only inputs are injection points; there is deliberately no argument naming a
 * tenant, an authorization, a provider or a limit, so no caller — including an authenticated
 * machine ingress — can aim this at anything.
 */
export async function scanDueObservations(
  deps: ScanDueObservationsDeps = {},
): Promise<ScanResult> {
  assertServerOnly();

  const register = await listActiveStandingObservationsForRuntime(
    deps.getDb ? { getDb: deps.getDb } : {},
  );
  if (register.status !== "read") {
    /* FAIL CLOSED. An unreadable register is not an empty one, and must never be reported as
     * "nothing was due" — that would turn an outage into a silent, permanent pause. */
    return { status: "unavailable", reason: "persistence-unavailable" };
  }

  const now = deps.now ?? (() => new Date());
  const outcomes: ScannedAuthorizationOutcome[] = [];
  let attempted = 0;
  let recorded = 0;

  for (const authorization of register.authorizations) {
    const outcome = await scanOne(authorization, now, deps);
    outcomes.push({ authorizationId: authorization.authorizationId, outcome });
    if (outcome.status !== "not-due" && outcome.status !== "due-unknown") attempted += 1;
    if (outcome.status === "recorded") recorded += 1;
  }

  return {
    status: "scanned",
    considered: register.authorizations.length,
    attempted,
    recorded,
    outcomes,
  };
}

async function scanOne(
  authorization: {
    readonly authorizationId: string;
    readonly tenantId: string;
    readonly providerKey: string;
    readonly capabilityKey: string;
    readonly subjectRef: string;
    readonly intervalMinutes: number;
  },
  now: () => Date,
  deps: ScanDueObservationsDeps,
): Promise<ScanOutcome> {
  /*
   * THE TENANT COMES FROM THE ROW, and is used only to ask the released reader when this scope was
   * last observed under a standing authorization. It is never chosen, never accepted from a caller
   * and never widened — the register produced it, and the register read it off the authorization.
   */
  const last = await readLatestAuthorizedObservationAt(
    { tenantId: authorization.tenantId },
    {
      providerKey: authorization.providerKey,
      capabilityKey: authorization.capabilityKey,
      subjectRef: authorization.subjectRef,
    },
    deps.getDb ? { getDb: deps.getDb } : {},
  );
  if (last.status !== "read") return { status: "due-unknown" };

  if (last.observedAt !== null) {
    const elapsedMs = now().getTime() - Date.parse(last.observedAt);
    const minutesElapsed = Number.isFinite(elapsedMs) ? Math.floor(elapsedMs / 60_000) : null;
    if (minutesElapsed === null || minutesElapsed < authorization.intervalMinutes) {
      return {
        status: "not-due",
        minutesElapsed,
        intervalMinutes: authorization.intervalMinutes,
      };
    }
  }

  /*
   * THE ONLY THING HANDED ACROSS THE BOUNDARY IS AN ID.
   *
   * Not the tenant this scan just used, not the subject, not the connection — all of which are in
   * scope in this very function and none of which may travel. The composition re-reads every one of
   * them from the authorization, which is what makes a compromised trigger unable to substitute
   * any of them.
   */
  const observed = await observeOnceUnderAuthorization(authorization.authorizationId, {
    getDb: deps.getDb,
    env: deps.env,
    clock: deps.now,
    now: deps.now,
    fetchImpl: deps.fetchImpl,
    timeoutMs: deps.timeoutMs,
  });
  return classifyObserveOutcome(observed);
}
