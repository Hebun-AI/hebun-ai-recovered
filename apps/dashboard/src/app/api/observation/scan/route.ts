/*
 * /api/observation/scan — the ONLY machine ingress in this deployment (TRH-25).
 *
 * ── WHAT A CALLER MAY SAY ───────────────────────────────────────────────────
 *
 * That it is time. Nothing else.
 *
 * There is no path parameter, no query parameter and no body. The handler reads exactly one thing
 * from the request — the `authorization` header — and never anything else, so there is no syntax in
 * which a caller could name a tenant, an authorization, a provider, a capability, a subject, a
 * connection or a credential. The scan it starts takes no scope either. A COMPROMISED SCHEDULER
 * CAN ONLY EVER SAY "NOW", AND SAYING "NOW" MORE OFTEN BUYS NOTHING: the cadence ceiling and the
 * operator's stop are decided later, authoritatively, per authorization.
 *
 * ── AUTHENTICATION IS EXPLICIT AND FAILS CLOSED ─────────────────────────────
 *
 * A single shared secret in `HEBUN_OBSERVATION_TRIGGER_SECRET`, compared in constant time against
 * `Authorization: Bearer <secret>`. An unset secret refuses EVERY request — an unconfigured
 * deployment is closed, never open — and there is no query-string or body fallback, because a
 * secret that may travel in a URL will eventually be found in a log.
 *
 * THE REFUSAL HAPPENS BEFORE ANY DATABASE OR PROVIDER ACCESS. Nothing is read, no principal is
 * minted and no provider is contacted until the caller has proved it holds the secret.
 *
 * Nothing here logs, echoes or returns the secret, the header, or any part of either.
 *
 * ── IT IS NOT A SCHEDULE ────────────────────────────────────────────────────
 *
 * This file contains no timer, no cron expression and no next-run computation. It is the ingress a
 * scheduler may knock on. Which scheduler, and how often, is deployment configuration — and until
 * that configuration exists, nothing calls this and no unattended observation happens.
 *
 * GET, because a scheduler's default verb is GET and this endpoint commands nothing: it reports
 * what the released authorities decided. That reads oddly for something that can cause a write, and
 * the honest framing is that the WRITE is caused by an authorization the organization already
 * granted, not by the verb.
 */
import { timingSafeEqual } from "node:crypto";
import { scanDueObservations } from "@/features/observation-trigger/scan-due-observations.server";

/** Node runtime: the scan reaches the control-plane database through the released `pg` client. */
export const runtime = "nodejs";
/** Never cached, never prerendered — a scan is an event, not a document. */
export const dynamic = "force-dynamic";

const TRIGGER_SECRET_ENV = "HEBUN_OBSERVATION_TRIGGER_SECRET";

/**
 * Constant-time bearer comparison.
 *
 * Length is compared first because `timingSafeEqual` THROWS on unequal lengths — the released
 * install-state verifier does exactly this for the same reason. Returning `false` for an absent or
 * malformed header is the same answer as a wrong one: a caller learns only that it failed.
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

  const result = await scanDueObservations();

  if (result.status !== "scanned") {
    /* The register could not be read, so nothing was attempted. Reported as a server fault rather
     * than as an empty scan, because "nothing was due" and "we could not find out" are different
     * facts and a scheduler dashboard must be able to tell them apart. */
    return Response.json({ status: result.status, reason: result.reason }, { status: 503 });
  }

  /*
   * THE BODY CARRIES COUNTS AND OUTCOMES, NEVER SCOPE. No tenant, subject, connection, credential
   * or provider payload appears — an authorization id and a status word are the whole vocabulary,
   * so this response cannot become a way to enumerate the deployment's organizations.
   */
  return Response.json({
    status: result.status,
    considered: result.considered,
    attempted: result.attempted,
    recorded: result.recorded,
    outcomes: result.outcomes,
  });
}
