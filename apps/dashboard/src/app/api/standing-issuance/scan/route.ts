/*
 * /api/standing-issuance/scan — the THIRD machine ingress in this deployment (RUNG 2 act path).
 *
 * ── WHAT A CALLER MAY SAY ───────────────────────────────────────────────────
 *
 * That it is time. Nothing else.
 *
 * There is no path parameter, no query parameter and no body. The handler reads exactly one thing
 * from the request — the `authorization` header — and never anything else, so there is no syntax in
 * which a caller could name a tenant, a request, an agent, an envelope, an action kind, a quota or
 * a cadence. The scan it starts takes no scope either. A COMPROMISED SCHEDULER CAN ONLY EVER SAY
 * "NOW", AND SAYING "NOW" MORE OFTEN BUYS NOTHING: candidates are re-derived from authoritative
 * rows every tick, and the envelope's window, quota and cadence are enforced by the issuer behind a
 * row lock that this file cannot reach, influence or shorten.
 *
 * ── WHAT IT CANNOT CAUSE ────────────────────────────────────────────────────
 *
 * It cannot execute, deliver, record work, reach a provider, arm the deployment or enrol an
 * organization. The most it can cause is that an ordinary single-use permit comes into existence
 * for a proposal a human's standing envelope already authorized. Whether that permit is ever spent
 * is the released delivery path's question, on its own tick, behind the deployment's own arming
 * control.
 *
 *     PROPOSED → ISSUED is what this endpoint can cause. DELIVERED and EXECUTED are not.
 *
 * ── AUTHENTICATION IS EXPLICIT AND FAILS CLOSED ─────────────────────────────
 *
 * A single shared secret in `HEBUN_STANDING_ISSUANCE_TRIGGER_SECRET`, compared in constant time
 * against `Authorization: Bearer <secret>`. An unset secret refuses EVERY request — an unconfigured
 * deployment is closed, never open — and there is no query-string or body fallback, because a
 * secret that may travel in a URL will eventually be found in a log.
 *
 * ITS OWN SECRET, NOT THE OBSERVATION ONE AND NOT THE DELIVERY ONE. Ingresses that share a secret
 * are one credential with several doors: rotating for one silently re-authorizes the others, and a
 * leak from any reaches all. TRH-25 established a per-ingress env name, RUNG 1.5 followed it, and
 * this follows it for a third time rather than economizing on the one thing that must not be
 * economized on.
 *
 * THE REFUSAL HAPPENS BEFORE ANY DATABASE OR ISSUER ACCESS. Nothing is read, no candidate is
 * discovered and no transaction is opened until the caller has proved it holds the secret.
 *
 * Nothing here logs, echoes or returns the secret, the header, or any part of either.
 *
 * ── IT DOES NOT REACH THE ISSUER, AND THAT IS STRUCTURAL ────────────────────
 *
 * This file does not import `issuePermitUnderStandingAuthorization` and does not name it. The route
 * calls the SCAN MODULE; the scan module calls the issuer. That indirection is not decoration — it
 * is the property the RUNG 2 firewall asserts (no file under `src/app` may name the issuing seam),
 * and it is what keeps "no route, server action or component can authorize an act" true while still
 * admitting one authenticated machine ingress.
 *
 * ── IT IS NOT A SCHEDULE ────────────────────────────────────────────────────
 *
 * This file contains no timer, no cron expression and no next-run computation. It is the ingress a
 * scheduler may knock on. Which scheduler, and how often, is deployment configuration.
 *
 * GET, because a scheduler's default verb is GET and this endpoint commands nothing: it reports
 * what the released authorities decided. That reads oddly for something that can cause a write, and
 * the honest framing is that the WRITE is caused by a standing authorization a human already
 * granted, against a proposal that agent already made, not by the verb.
 */
import { timingSafeEqual } from "node:crypto";
import { scanIssuableRequests } from "@/features/standing-issuance-trigger/scan-issuable-requests.server";

/** Node runtime: the scan reaches the control-plane database through the released `pg` client. */
export const runtime = "nodejs";
/** Never cached, never prerendered — a scan is an event, not a document. */
export const dynamic = "force-dynamic";

const TRIGGER_SECRET_ENV = "HEBUN_STANDING_ISSUANCE_TRIGGER_SECRET";

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

  const result = await scanIssuableRequests();

  if (result.status !== "scanned") {
    /* The candidate register could not be read, so nothing was attempted. Reported as a server
     * fault rather than as an empty scan, because "nothing was issuable" and "we could not find
     * out" are different facts and a scheduler dashboard must be able to tell them apart. */
    return Response.json({ status: result.status, reason: result.reason }, { status: 503 });
  }

  /*
   * THE BODY CARRIES COUNTS AND REFUSAL WORDS, NEVER SCOPE. No tenant, request, agent, envelope,
   * permit, payload, work title or Governance decision appears — so this response cannot become a
   * way to enumerate the deployment's organizations, their agents or their pending proposals.
   *
   * EVEN THE REQUEST AND PERMIT IDS ARE DROPPED. The scan carries them internally for per-candidate
   * isolation; they stop here. Neither is a credential, but both are scope, and an endpoint that
   * returned a list of them would be an enumeration surface for exactly the rows this phase exists
   * to authorize.
   */
  const refusals: Record<string, number> = {};
  for (const { outcome } of result.outcomes) {
    if (outcome.status === "refused") refusals[outcome.reason] = (refusals[outcome.reason] ?? 0) + 1;
  }

  return Response.json({
    status: result.status,
    considered: result.considered,
    attempted: result.attempted,
    issued: result.issued,
    failed: result.outcomes.filter((o) => o.outcome.status === "failed").length,
    /* Refusal WORDS and their counts — the issuer's own vocabulary, no identifiers attached. */
    refusals,
  });
}
