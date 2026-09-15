/*
 * standing-issuance-trigger/scan-issuable-requests.server.ts — the standing issuance scan
 * (RUNG 2 act path).
 *
 * ── WHAT THIS DECIDES, AND THE ONE THING IT MUST NEVER DECIDE ───────────────
 *
 *     THE TRIGGER DECIDES *WHEN*. IT NEVER DECIDES *WHETHER*.
 *
 * It enumerates candidate pending agent proposals and hands each REQUEST ID to
 * `issuePermitUnderStandingAuthorization`. That function takes one argument and reads every other
 * fact off rows the caller does not control, so there is no parameter here through which a tenant,
 * an agent, an envelope, an action kind, a quota, a cadence, a payload, an expiry or a Governance
 * decision could be chosen — by this module, by its caller, or by anything that ever calls its
 * caller.
 *
 * ── WHY THIS MODULE EXISTS AT ALL, AND WHY IT IS ALLOWED TO NAME THE ISSUER ─
 *
 * The RUNG 2 firewall pins that the issuing seam is unreachable from `src/app`, `src/components`
 * and every Heby module, and that exactly one module under `src/features` may name it. Until now
 * that one module was the issuer itself, which is another way of saying the authority had no
 * trigger and could never fire.
 *
 * The firewall's STATED purpose is that the agent must not decide its own authorization: *"Heby
 * PROPOSES. If any agent runtime, server action, route or component could call the issuer, the
 * agent would be deciding its own authorization and the entire model would collapse."* A scheduler
 * tick is none of those things. So the pin is widened by EXACTLY ONE NAMED MODULE — this one — and
 * every area ban is untouched. The firewall still proves that no browser event, no server action,
 * no component and no Heby module can reach the issuer; it now also proves that the only other
 * namer is this file, by name.
 *
 * ── IT DUPLICATES NO AUTHORIZATION AUTHORITY ────────────────────────────────
 *
 * Envelope existence, effective revision, `active`, the validity window, the quota, the cadence,
 * evidence admissibility, evidence reuse, tenant enrolment, agent liveness, the frozen action set,
 * agent match, kind match and the payload digest are ALL decided by the issuer, against freshly
 * re-read rows, behind a `FOR UPDATE` lock on the envelope, inside the issuing transaction. This
 * file re-implements none of them and cannot overrule any of them.
 *
 * The rules the DISCOVERY applies — pending, agent-proposed, machine-executable, some envelope
 * exists for this tenant and agent, no permit yet — are a COURTESY: they save a transaction per
 * request per tick. The issuer applies every one of them authoritatively afterwards. If the two
 * ever disagreed, the authoritative one wins and this one being wrong could only ever cause a
 * REFUSAL, never an issuance that should not have happened.
 *
 * ── IT DOES NOT EXECUTE, DELIVER, OR ARM ────────────────────────────────────
 *
 * An issued permit is an ordinary single-use permit and nothing here spends one. It does not import
 * the executor, the delivery scan, the arming control or the tenant enrolment writer. Whether that
 * permit is ever delivered is the released RUNG 1.5 scan's question, asked on its own tick, against
 * its own re-read rows, behind the deployment's own arming control — which remains DISARMED.
 *
 *     PROPOSED → ISSUED is this file's tick. ISSUED → DELIVERED → EXECUTED is not.
 *
 * ── ISOLATED PER CANDIDATE, NOT FAIL-FAST ───────────────────────────────────
 *
 * One organization's withdrawn envelope, exhausted quota or unreadable row must not stop every
 * other organization's covered proposals from being issued. So each candidate is processed
 * independently and its outcome recorded; a refusal is data, not an exception, and a THROW is
 * caught and recorded rather than allowed to abort the tick. The blast radius of any single failure
 * is exactly one request.
 *
 * SEQUENTIALLY, AND THAT IS DELIBERATE. Running them in parallel would put several issuing
 * transactions in flight at once, contending for the same envelope row locks, for no benefit — an
 * issuance scan is not latency sensitive. Correctness would survive it (the lock is exclusive
 * either way); legibility would not.
 *
 * ── NO RETRY, NO SCHEDULE, NO STATE ─────────────────────────────────────────
 *
 * There is no loop that re-attempts anything, no backoff, no next-run computation and nothing
 * written about when to run again. A refused candidate is simply reported; the next tick finds it
 * again because eligibility is DERIVED from authoritative rows and never from scheduler
 * bookkeeping. Nothing here persists, so nothing here can drift from the authorities it reads.
 *
 * A cadence that has not elapsed is not slept on and not queued. The tick reports the refusal and
 * ends; a later tick finds the same request and the issuer decides again. THE TRIGGER NEVER WAITS
 * OUT, SHORTENS OR ACCUMULATES AN ENVELOPE'S BOUNDS.
 *
 * ── IT DOES NOT AUDIT THE ISSUER ────────────────────────────────────────────
 *
 * It does not read permits, envelopes or audit rows afterwards to decide whether issuance "really"
 * happened. The issuer's returned outcome IS the answer; a second opinion assembled from rows would
 * be a second authorization authority wearing a report's clothing.
 *
 * Server-only.
 */
import {
  listStandingIssuableRequestsForRuntime,
  type StandingIssuableRequestReadDeps,
} from "@/features/action-authorization/read-standing-issuable-requests.server";
import {
  issuePermitUnderStandingAuthorization,
  type StandingIssuanceDeps,
} from "@/features/standing-mutation-authority/issue-permit-under-standing-authorization.server";
import { classifyIssuanceOutcome, type IssuanceScanResult, type ScannedRequestOutcome } from "./contracts";

/**
 * Injection only. There is deliberately no field here naming a tenant, an agent, a request, an
 * envelope, an action kind, a quota, a cadence or a limit that could widen — `limit` reaches the
 * reader, which clamps it downward.
 */
export interface ScanIssuableRequestsDeps
  extends Pick<StandingIssuableRequestReadDeps, "getDb" | "limit"> {
  /** Injectable so the scan is provable without a control plane. Never reaches a column. */
  readonly issue?: typeof issuePermitUnderStandingAuthorization;
  /** Forwarded to the issuer so its own authorities stay injectable in tests. */
  readonly issuerDeps?: StandingIssuanceDeps;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The standing issuance scan is server-only.");
  }
}

/**
 * Scan every pending agent proposal a standing envelope might cover and offer each to the issuer.
 *
 * TAKES NO SCOPE. The only inputs are injection points; there is deliberately no argument naming a
 * tenant, a request, an agent, an envelope or an action kind, so no caller — including an
 * authenticated machine ingress — can aim this at anything.
 */
export async function scanIssuableRequests(
  deps: ScanIssuableRequestsDeps = {},
): Promise<IssuanceScanResult> {
  assertServerOnly();

  const register = await listStandingIssuableRequestsForRuntime({
    ...(deps.getDb ? { getDb: deps.getDb } : {}),
    ...(deps.limit === undefined ? {} : { limit: deps.limit }),
  });
  if (register.status !== "read") {
    /* FAIL CLOSED. An unreadable register is not an empty one, and must never be reported as
     * "nothing was issuable" — that would turn an outage into a silent, permanent pause. */
    return { status: "unavailable", reason: "persistence-unavailable" };
  }

  const issue = deps.issue ?? issuePermitUnderStandingAuthorization;
  const outcomes: ScannedRequestOutcome[] = [];
  let issued = 0;

  for (const candidate of register.requests) {
    /*
     * THE ONLY THING HANDED ACROSS THE BOUNDARY IS A REQUEST ID.
     *
     * Not the tenant this scan just read — which is in scope on `candidate` right here and may not
     * travel. The issuer re-derives it from the request row, which is what makes a compromised or
     * buggy trigger unable to substitute one.
     */
    const outcome = await runOne(candidate.requestId, issue, deps.issuerDeps);
    outcomes.push({ requestId: candidate.requestId, outcome });
    if (outcome.status === "issued") issued += 1;
  }

  return {
    status: "scanned",
    considered: register.requests.length,
    /* The scan filters nothing after discovery: every candidate is offered to the authority. */
    attempted: register.requests.length,
    issued,
    outcomes,
  };
}

async function runOne(
  requestId: string,
  issue: typeof issuePermitUnderStandingAuthorization,
  issuerDeps: StandingIssuanceDeps | undefined,
): Promise<ScannedRequestOutcome["outcome"]> {
  try {
    return classifyIssuanceOutcome(await issue({ requestId }, issuerDeps ?? {}));
  } catch {
    /*
     * A THROW IS NOT A REFUSAL, and this scan will not report it as one. The issuer writes inside a
     * transaction, so an escaping error leaves no permit behind and the envelope's counts unmoved;
     * the next tick will find the request again. Nothing is retried here.
     */
    return { status: "failed" };
  }
}
