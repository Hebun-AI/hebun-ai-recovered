/**
 * The request half of Platform Admin: read the session cookie, hand it to the decisions in
 * `admin-access.server.ts` (which read no request value at all), and carry the rotated cookie after a
 * successful MFA challenge. The session itself is resolved by the released `request-session` seam.
 */
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getControlPlaneDb } from "@/db/client.server";
import {
  getAuthEnvironment,
  resolveRequestAuthentication,
  setSessionCookie,
} from "@/features/auth-runtime/request-session.server";
import { SESSION_COOKIE_NAME } from "@/features/auth-runtime/session-cookie";
import { resolveMfaEncryptionKeys } from "@/features/operator-mfa/mfa-verification.server";
import {
  elevateSessionWithMfa,
  evaluateAdminAccess,
  type AdminAccess,
  type MfaElevation,
} from "./admin-access.server";

/** Admin access for this request. Disabled or invalid auth is never admin — it fails closed. */
export async function resolveAdminAccessForRequest(now: Date = new Date()): Promise<AdminAccess> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") return { status: "unauthenticated" };
  const authentication = await resolveRequestAuthentication(env);
  return evaluateAdminAccess(getControlPlaneDb(), authentication, now);
}

/** Verify the admin MFA code for this request's session and, on success, set the rotated cookie. */
export async function elevateSessionWithMfaForRequest(code: string): Promise<MfaElevation> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") return { status: "refused", reason: "no-session" };
  const reference = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!reference) return { status: "refused", reason: "no-session" };
  const outcome = await elevateSessionWithMfa(
    getControlPlaneDb(),
    env,
    reference,
    code,
    { requestId: randomUUID() },
    resolveMfaEncryptionKeys(process.env),
  );
  if (outcome.status === "elevated") await setSessionCookie(outcome.reference, outcome.maxAgeSeconds);
  return outcome;
}
