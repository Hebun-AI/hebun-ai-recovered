/*
 * machine-delivery-trigger/scan-deliverable-permits.server.ts — the automatic delivery scan
 * (RUNG 2).
 *
 * ── WHAT THIS DECIDES, AND THE ONE THING IT MUST NEVER DECIDE ───────────────
 *
 *     THE TRIGGER DECIDES *WHEN*. IT NEVER DECIDES *WHETHER*.
 *
 * The released executor already says so in its own words: "RUNG 2 will discover eligible permits
 * asynchronously; a discovery made minutes ago must never be able to carry a permission that has
 * since been withdrawn. THE SCANNER IS A COURTESY FILTER. THIS IS THE BOUNDARY." This file is that
 * scanner, built to that sentence.
 *
 * It enumerates candidate permits and hands each PERMIT ID to `executeRecordWorkAsMachine`. That
 * function takes one argument and reads every other fact off rows the caller does not control, so
 * there is no parameter here through which a tenant, an agent, a payload or an action kind could be
 * chosen — by this module, by its caller, or by anything that ever calls its caller.
 *
 * ── IT DUPLICATES NO EXECUTION AUTHORITY ────────────────────────────────────
 *
 * Armed, tenant-enrolled, agent-in-service, action-kind-admitted, payload-recordable, not-expired,
 * not-consumed, right-tenant and work-authority-accepts are ALL decided by the executor, against
 * freshly re-read rows, inside the spend's own transaction. This file re-implements none of them
 * and cannot overrule any of them.
 *
 * The one rule the DISCOVERY applies — active, unexpired, agent-proposed, machine-executable — is a
 * COURTESY: it saves a principal mint and several reads per permit per tick. The executor applies
 * every one of those authoritatively afterwards. If the two ever disagreed, the authoritative one
 * wins and this one being wrong could only ever cause a REFUSAL, never a spend that should not have
 * happened.
 *
 * ── ISOLATED PER CANDIDATE, NOT FAIL-FAST ───────────────────────────────────
 *
 * One organization's withdrawn participation, retired agent or unreadable row must not stop every
 * other organization's already-authorized work from being delivered. So each candidate is processed
 * independently and its outcome recorded; a refusal is data, not an exception, and a THROW is
 * caught and recorded rather than allowed to abort the tick. The blast radius of any single failure
 * is exactly one permit.
 *
 * SEQUENTIALLY, AND THAT IS DELIBERATE. Running them in parallel would put several spend
 * transactions in flight at once for no benefit — a delivery scan is not latency sensitive — and
 * would make the concurrency story harder to reason about rather than easier. Correctness would
 * survive it (the single spend is exclusive either way); legibility would not.
 *
 * ── NO RETRY, NO SCHEDULE, NO STATE ─────────────────────────────────────────
 *
 * There is no loop that re-attempts anything, no backoff, no next-run computation and nothing
 * written about when to run again. A failed attempt is simply reported; the next tick finds the
 * permit again because DELIVERABILITY IS DERIVED from authoritative rows and never from scheduler
 * bookkeeping. Nothing here persists, so nothing here can drift from the authorities it reads.
 *
 * A permit that lapses before any tick reaches it stays expired. THE TRIGGER NEVER REFRESHES,
 * EXTENDS OR RE-MINTS AUTHORITY — an expired permit is the Director's to re-authorize.
 *
 * ── IT DOES NOT AUDIT THE EXECUTOR ──────────────────────────────────────────
 *
 * It does not read work items, permits or audit rows afterwards to decide whether execution
 * "really" happened. The executor's returned outcome IS the answer; a second opinion assembled
 * from rows would be a second execution authority wearing a report's clothing.
 *
 * Server-only.
 */
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
import {
  listMachineDeliverablePermitsForRuntime,
  type MachineDeliverablePermitReadDeps,
} from "@/features/action-authorization/read-machine-deliverable-permits.server";
import {
  executeRecordWorkAsMachine,
  type MachineRecordWorkDeps,
} from "@/features/governed-machine-execution/execute-record-work-as-machine.server";
import { classifyDeliveryOutcome, type DeliveryScanResult, type ScannedPermitOutcome } from "./contracts";

/**
 * Injection only. There is deliberately no field here naming a tenant, a permit, an action kind, a
 * payload or a limit that could widen — `limit` reaches the reader, which clamps it downward.
 */
export interface ScanDeliverablePermitsDeps
  extends Pick<MachineDeliverablePermitReadDeps, "getDb" | "limit"> {
  /** Injectable so the scan is provable without a control plane. Never reaches a column. */
  readonly execute?: typeof executeRecordWorkAsMachine;
  /** Forwarded to the executor so its own authorities stay injectable in tests. */
  readonly executorDeps?: MachineRecordWorkDeps;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The machine delivery scan is server-only.");
  }
}

/**
 * Scan every machine-deliverable permit in the deployment and hand each one to the executor.
 *
 * TAKES NO SCOPE. The only inputs are injection points; there is deliberately no argument naming a
 * tenant, a permit, an action kind or a payload, so no caller — including an authenticated machine
 * ingress — can aim this at anything.
 */
export async function scanDeliverablePermits(
  deps: ScanDeliverablePermitsDeps = {},
): Promise<DeliveryScanResult> {
  assertServerOnly();

  const register = await listMachineDeliverablePermitsForRuntime({
    ...(deps.getDb ? { getDb: deps.getDb } : {}),
    ...(deps.limit === undefined ? {} : { limit: deps.limit }),
  });
  if (register.status !== "read") {
    /* FAIL CLOSED. An unreadable register is not an empty one, and must never be reported as
     * "nothing was deliverable" — that would turn an outage into a silent, permanent pause. */
    return { status: "unavailable", reason: "persistence-unavailable" };
  }

  const execute = deps.execute ?? executeRecordWorkAsMachine;
  const outcomes: ScannedPermitOutcome[] = [];
  let delivered = 0;

  for (const candidate of register.permits) {
    /*
     * THE ONLY THING HANDED ACROSS THE BOUNDARY IS A PERMIT ID.
     *
     * Not the tenant this scan just read — which is in scope on `candidate` right here and may not
     * travel. The executor re-derives it from the permit row, which is what makes a compromised or
     * buggy trigger unable to substitute one.
     */
    const outcome = await runOne(candidate.permitId, execute, deps.executorDeps);
    outcomes.push({ permitId: candidate.permitId, outcome });
    if (outcome.status === "delivered") delivered += 1;
  }

  return {
    status: "scanned",
    considered: register.permits.length,
    /* The scan filters nothing after discovery: every candidate is offered to the authority. */
    attempted: register.permits.length,
    delivered,
    outcomes,
  };
}

async function runOne(
  permitId: string,
  execute: typeof executeRecordWorkAsMachine,
  executorDeps: MachineRecordWorkDeps | undefined,
): Promise<ScannedPermitOutcome["outcome"]> {
  try {
    return classifyDeliveryOutcome(await execute({ permitId }, executorDeps ?? {}));
  } catch {
    /*
     * A THROW IS NOT A REFUSAL, and this scan will not report it as one. The executor spends inside
     * a transaction, so an escaping error leaves the permit active and no work row behind; the next
     * tick will find it again. Nothing is retried here.
     */
    return { status: "failed" };
  }
}
