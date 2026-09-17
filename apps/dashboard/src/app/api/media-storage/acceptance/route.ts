/*
 * /api/media-storage/acceptance — the machine ingress that proves production storage is connected.
 *
 * ── WHAT A CALLER MAY SAY ───────────────────────────────────────────────────
 *
 * "Run the storage acceptance now." Nothing else. No path parameter, no query, no body is read. The
 * handler reads exactly one thing from the request, the `authorization` header, so there is no syntax
 * in which a caller could name a tenant, a key, bytes or a URL.
 *
 * ── AUTHENTICATION IS EXPLICIT AND FAILS CLOSED ─────────────────────────────
 *
 * Its OWN bearer secret, `HEBUN_MEDIA_STORAGE_ACCEPTANCE_SECRET`, compared in constant time. Not the
 * store's write or read secret, and not another ingress's secret: sharing would turn two doors into
 * one credential. An unset secret refuses every request, so removing that variable closes this door.
 * The refusal happens before the storage resolver is even evaluated.
 *
 * ── WHAT IT DOES ────────────────────────────────────────────────────────────
 *
 * One run of `runStorageAcceptance`: a synthetic fixture under the reserved acceptance tenant
 * namespace, through the released storage port. No database, no Media Asset row, no generation, no
 * Governance, no request, permit or execution. The response carries check names and booleans only.
 *
 * GET, like every other machine ingress in this deployment (INT-3 pins routes to GET). The verb is
 * not the authorization: the bearer secret is, and a run's only write is one synthetic fixture object
 * in the reserved acceptance namespace.
 */
import { timingSafeEqual } from "node:crypto";
import { runStorageAcceptance } from "@/features/media-storage-acceptance/run-storage-acceptance.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCEPTANCE_SECRET_ENV = "HEBUN_MEDIA_STORAGE_ACCEPTANCE_SECRET";

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
  if (!isAuthorized(request.headers.get("authorization"), process.env[ACCEPTANCE_SECRET_ENV])) {
    return new Response("Unauthorized", { status: 401 });
  }

  const result = await runStorageAcceptance();

  if (result.status === "accepted") {
    return Response.json({ status: result.status, backend: result.backend, passed: result.passed }, {
      headers: { "cache-control": "no-store" },
    });
  }
  if (result.status === "not-connected") {
    return Response.json({ status: result.status, reason: result.reason }, { status: 503, headers: { "cache-control": "no-store" } });
  }
  return Response.json(
    { status: result.status, failedCheck: result.failedCheck, passed: result.passed },
    { status: 503, headers: { "cache-control": "no-store" } },
  );
}
