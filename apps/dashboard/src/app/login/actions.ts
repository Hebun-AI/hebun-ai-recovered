"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getControlPlaneDb } from "@/db/client.server";
import {
  clearSessionCookie,
  getAuthEnvironment,
  setSessionCookie,
} from "@/features/auth-runtime/request-session.server";
import { SESSION_COOKIE_NAME } from "@/features/auth-runtime/session-cookie";
import {
  issueLocalSession,
  revokeSessionByReference,
} from "@/features/auth-runtime/session-service.server";
import { cookies } from "next/headers";

/**
 * Local sign-in with a VERIFIED credential (D1).
 *
 * Email + password. The password is verified with scrypt against the durable
 * credential authority before any session material exists — an email alone can
 * no longer mint a session, which is what this action did before D1.
 *
 * Only functions when the auth environment is configured for the `local`
 * provider; in any other mode it fails closed.
 *
 * The password is read from the form, handed to the session service, and never
 * touched again: it is not logged, not stored, not placed in the session, and
 * never included in a redirect. `issued.diagnostic` distinguishes the failure
 * causes server-side and is deliberately NOT surfaced — every sign-in failure
 * redirects with the same generic marker so the page cannot be used to discover
 * which email addresses exist.
 */
export async function loginAction(formData: FormData): Promise<void> {
  const env = getAuthEnvironment();
  if (env.status !== "configured" || env.provider !== "local") {
    redirect("/login?error=unavailable");
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=invalid");

  const issued = await issueLocalSession(getControlPlaneDb(), env, {
    email,
    password,
    requestId: randomUUID(),
  });
  if (issued.result.status !== "authorized") {
    // One marker for every cause: unknown email, wrong password, locked
    // credential, and no membership are indistinguishable to the client.
    redirect("/login?error=invalid");
  }

  await setSessionCookie(issued.reference, issued.maxAgeSeconds);
  redirect("/foundation");
}

/** Sign out: revoke the durable session row and clear the cookie. */
export async function logoutAction(): Promise<void> {
  const env = getAuthEnvironment();
  const store = await cookies();
  const reference = store.get(SESSION_COOKIE_NAME)?.value;
  if (reference && env.status === "configured") {
    try {
      await revokeSessionByReference(getControlPlaneDb(), env, reference);
    } catch {
      // Even if revocation fails, always clear the client cookie below.
    }
  }
  await clearSessionCookie();
  redirect("/login");
}
