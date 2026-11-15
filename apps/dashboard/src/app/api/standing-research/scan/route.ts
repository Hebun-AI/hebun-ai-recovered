/*
 * P6-4 (D7) — the 08:00 Europe/Istanbul (05:00 UTC) research tick. Machine ingress: no session, a bearer
 * secret checked in constant time before anything is read, and an unset secret refuses every request.
 *
 * INERT UNTIL TWO DIRECTOR GATES: the secret `HEBUN_STANDING_RESEARCH_TRIGGER_SECRET` is configured, AND
 * the `research-schedule` kill switch is on. With the switch off the tick reads nothing else and runs
 * nothing (`disabled`).
 */
import { timingSafeEqual } from "node:crypto";
import { scanScheduledResearch } from "@/features/standing-research-authority/scheduled-research.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIGGER_SECRET_ENV = "HEBUN_STANDING_RESEARCH_TRIGGER_SECRET";

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
    return new Response("Unauthorized", { status: 401 });
  }
  const result = await scanScheduledResearch();
  if (result.status === "unavailable") return Response.json(result, { status: 503 });
  if (result.status === "disabled") return Response.json(result);
  /* Counts and reasons only: no brief, report text, tenant name or person crosses this response. */
  return Response.json({
    status: result.status,
    localDate: result.localDate,
    considered: result.considered,
    outcomes: result.outcomes.map((o) => ({ status: o.status, ...(o.status === "failed" ? { reason: o.reason } : {}) })),
  });
}
