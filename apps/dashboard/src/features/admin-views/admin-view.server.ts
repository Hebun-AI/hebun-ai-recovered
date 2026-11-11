/**
 * The request half of the Platform Admin readers: resolve this request's session from the cookie
 * (released `request-session` seam), hand it to a reader — which re-checks grant + MFA itself — and
 * turn a refusal into the same answer the page guard gives (login / 404 / MFA challenge).
 */
import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { getControlPlaneDb } from "@/db/client.server";
import {
  getAuthEnvironment,
  resolveRequestAuthentication,
} from "@/features/auth-runtime/request-session.server";
import type { AdminRead, AdminReadContext } from "./platform-readers.server";

export async function adminReadContext(now: Date = new Date()): Promise<AdminReadContext> {
  const env = getAuthEnvironment();
  const requestId = randomUUID();
  const authentication =
    env.status === "configured"
      ? await resolveRequestAuthentication(env, { requestId })
      : ({ status: "unauthenticated", reason: "missing" } as const);
  return { db: getControlPlaneDb(), authentication, now, requestId };
}

/** What a page renders: data, or a plain failure. A refusal never returns. */
export type AdminViewResult<T> =
  | { readonly status: "read"; readonly data: T }
  | { readonly status: "unavailable" | "audit-failed" };

export function settleAdminRead<T>(read: AdminRead<T>): AdminViewResult<T> {
  if (read.status === "read") return { status: "read", data: read.data };
  if (read.status !== "denied") return { status: read.status };
  if (read.access.status === "unauthenticated") redirect("/login");
  if (read.access.status === "forbidden") notFound();
  redirect("/admin/verify");
}
