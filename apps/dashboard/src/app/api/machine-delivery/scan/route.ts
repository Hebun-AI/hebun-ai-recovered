/*
 * /api/machine-delivery/scan — the SECOND machine ingress in this deployment (RUNG 2).
 *
 * ── WHAT A CALLER MAY SAY ───────────────────────────────────────────────────
 *
 * That it is time. Nothing else.
 *
 * There is no path parameter, no query parameter and no body. The handler reads exactly one thing
 * from the request — the `authorization` header — and never anything else, so there is no syntax in
 * which a caller could name a tenant, a permit, an action kind, a payload or an agent. The scan it
 * starts takes no scope either. A COMPROMISED SCHEDULER CAN ONLY EVER SAY "NOW", AND SAYING "NOW"
 * MORE OFTEN BUYS NOTHING: candidates are re-derived from authoritative rows every tick, and a
 * permit can be spent exactly once by a single conditional statement that is not this file's.
 *
 * ── AUTHENTICATION IS EXPLICIT AND FAILS CLOSED ─────────────────────────────
 *
 * A single shared secret in `HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET`, compared in constant time
 * against `Authorization: Bearer <secret>`. An unset secret refuses EVERY request — an unconfigured
 * deployment is closed, never open — and there is no query-string or body fallback, because a
 * secret that may travel in a URL will eventually be found in a log.
 *
 * ITS OWN SECRET, NOT THE OBSERVATION ONE. Two ingresses that share a secret are one credential
 * with two doors: rotating for one silently re-authorizes the other, and a leak from either reaches
 * both. TRH-25 established a per-ingress env name and this follows it.
 *
 * THE REFUSAL HAPPENS BEFORE ANY DATABASE OR EXECUTOR ACCESS. Nothing is read, no permit is
 * discovered and no principal is minted until the caller has proved it holds the secret.
 *
 * Nothing here logs, echoes or returns the secret, the header, or any part of either.
 *
 * ── IT DOES NOT REACH THE EXECUTOR, AND THAT IS STRUCTURAL ──────────────────
 *
 * This file does not import `executeRecordWorkAsMachine` and does not name it. The route calls the
 * SCAN MODULE; the scan module calls the executor. That indirection is not decoration — it is the
 * property the RUNG 1 firewall asserts, and it is what keeps "a product surface cannot trigger
 * machine execution" true while still admitting one authenticated machine ingress.
 *
 * ── IT IS NOT A SCHEDULE ────────────────────────────────────────────────────
 *
 * This file contains no timer, no cron expression and no next-run computation. It is the ingress a
 * scheduler may knock on. Which scheduler, and how often, is deployment configuration.
 *
 * GET, because a scheduler's default verb is GET and this endpoint commands nothing: it reports
 * what the released authorities decided. That reads oddly for something that can cause a write, and
 * the honest framing is that the WRITE is caused by an authorization a human already granted and an
 * organization already opted into, not by the verb.
 */
import { timingSafeEqual } from "node:crypto";
import { scanDeliverablePermits } from "@/features/machine-delivery-trigger/scan-deliverable-permits.server";

/** Node runtime: the scan reaches the control-plane database through the released `pg` client. */
export const runtime = "nodejs";
/** Never cached, never prerendered — a scan is an event, not a document. */
export const dynamic = "force-dynamic";

const TRIGGER_SECRET_ENV = "HEBUN_MACHINE_DELIVERY_TRIGGER_SECRET";

/**
 * Constant-time bearer comparison.
 *
 * Length is compared first because `timingSafeEqual` THROWS on unequal lengths. Returning `false`
 * for an absent or malformed header is the same answer as a wrong one: a caller learns only that it
 * failed.
 */
function isAuthorized(header: string | null, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!header) return false;
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const given = Buffer.from(header.slice(prefix.length));
  const want = Buffer.from(expected);
  if (given.length !== want.length) return false;
  return timingSafeEqual(given, want);
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request.headers.get("authorization"), process.env[TRIGGER_SECRET_ENV])) {
    /* No detail, no hint about which half failed, and no `WWW-Authenticate` challenge — there is no
     * interactive client to challenge. */
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await scanDeliverablePermits();

  if (result.status !== "scanned") {
    /* The candidate register could not be read, so nothing was attempted. Reported as a server
     * fault rather than as an empty scan, because "nothing was deliverable" and "we could not find
     * out" are different facts and a scheduler dashboard must be able to tell them apart. */
    return Response.json({ status: result.status, reason: result.reason }, { status: 503 });
  }

  /*
   * THE BODY CARRIES COUNTS AND OUTCOME CATEGORIES, NEVER SCOPE. No tenant, permit, agent, payload,
   * subject, work title, customer name or email appears — so this response cannot become a way to
   * enumerate the deployment's organizations or their authorized work.
   *
   * EVEN THE PERMIT IDS ARE DROPPED. The scan carries them internally for per-candidate isolation;
   * they stop here. A permit id is not a credential, but it is scope, and an endpoint that returned
   * a list of them would be an enumeration surface for exactly the rows this phase exists to
   * deliver.
   */
  const refusals: Record<string, number> = {};
  for (const { outcome } of result.outcomes) {
    if (outcome.status === "refused") refusals[outcome.reason] = (refusals[outcome.reason] ?? 0) + 1;
  }

  return Response.json({
    status: result.status,
    considered: result.considered,
    attempted: result.attempted,
    delivered: result.delivered,
    failed: result.outcomes.filter((o) => o.outcome.status === "failed").length,
    /* Refusal WORDS and their counts — the executor's own vocabulary, no identifiers attached. */
    refusals,
  });
}
