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
 * Local-identity sign-in (R1 pilot). Only functions when the auth environment is
 * configured for the `local` provider; in any other mode it fails closed. This
 * is identity selection for a seeded pilot identity — there is no credential
 * verification yet (a documented R1 limitation), so it must never run in a
 * Supabase/production configuration.
 */
export async function loginAction(formData: FormData): Promise<void> {
  const env = getAuthEnvironment();
  if (env.status !== "configured" || env.provider !== "local") {
    redirect("/login?error=unavailable");
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email) redirect("/login?error=invalid");

  const issued = await issueLocalSession(getControlPlaneDb(), env, {
    email,
    requestId: randomUUID(),
  });
  if (issued.result.status !== "authorized") {
    redirect(`/login?error=${issued.result.status}`);
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
