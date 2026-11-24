/*
 * P5-5 — the weekly agent task tick. Vercel cron calls it on Mondays at 05:00 UTC (08:00 Istanbul) with the
 * trigger secret; anything else is 401. The scan reads the `agent-task-schedule` switch first; off, it reads
 * nothing else. The response carries counts and reasons only: no brief, draft text, tenant name or person.
 */
import { timingSafeEqual } from "node:crypto";
import { scanScheduledAgentTasks } from "@/features/standing-agent-task/scheduled-agent-task.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRIGGER_SECRET_ENV = "HEBUN_STANDING_AGENT_TASK_TRIGGER_SECRET";

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
  const result = await scanScheduledAgentTasks();
  if (result.status === "unavailable") return Response.json(result, { status: 503 });
  if (result.status === "disabled") return Response.json(result);
  return Response.json({
    status: result.status,
    periodKey: result.periodKey,
    considered: result.considered,
    outcomes: result.outcomes.map((o) => ({ status: o.status, template: o.template, ...(o.status === "failed" ? { reason: o.reason } : {}) })),
  });
}
