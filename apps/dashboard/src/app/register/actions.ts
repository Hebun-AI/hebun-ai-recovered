"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";

import { getControlPlaneDb } from "@/db/client.server";
import {
  getAuthEnvironment,
  setSessionCookie,
} from "@/features/auth-runtime/request-session.server";
import { issueLocalSession } from "@/features/auth-runtime/session-service.server";
import { createSelfServiceAccount } from "@/features/self-service-signup/create-account.server";
import type { SignupRefusal } from "@/features/self-service-signup/contracts";

/**
 * Create an account, an organization, and sign the new human in.
 *
 * ── THE BROWSER SENDS FOUR STRINGS AND NOTHING ELSE ─────────────────────────
 *
 * Name, email, password, organization name. Every other field is read from nowhere: there is no
 * `tenantId` to send, no `roleId`, no membership, no provisioning source. Extra form fields are not
 * "stripped" — they are never read, because nothing reads them. An attacker who posts
 * `tenantId=<someone else's>` has posted a string this action does not look at.
 *
 * ── THE SESSION IS MINTED BY PROVING THE CREDENTIAL, NOT BY OUR SAY-SO ──────
 *
 * After provisioning succeeds this action does NOT hand itself a session. It calls the SAME
 * `issueLocalSession` the sign-in form calls, with the email and password the visitor just chose, so
 * the new session is authorized by the credential authority verifying a password against a stored
 * hash — exactly as every other session in the product is. Nothing here can mint tenant identity,
 * and the two-stage session architecture is reused rather than special-cased.
 *
 * A brand-new human holds EXACTLY ONE active membership, so that call returns `authorized` and this
 * is the released single-workspace fast path. If it ever returned `tenant-selection-required`, the
 * human would be sent to the released picker rather than to a page this action invented.
 *
 * ── THE PASSWORD ─────────────────────────────────────────────────────────────
 *
 * Read from the form, passed to the signup authority (which hands it to the credential authority to
 * hash), passed once more to the session service to verify, and never touched again. It is not
 * logged, not stored here, not placed in the session, and never put in a redirect URL.
 */
export async function registerAction(formData: FormData): Promise<void> {
  const env = getAuthEnvironment();
  /* FAIL CLOSED. Signup writes credentials; a misconfigured auth environment must not. */
  if (env.status !== "configured" || env.provider !== "local") {
    redirect("/register?error=unavailable");
  }

  const fullName = String(formData.get("fullName") ?? "");
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const organizationName = String(formData.get("organizationName") ?? "");

  const outcome = await createSelfServiceAccount({
    fullName,
    email,
    password,
    organizationName,
  });

  if (outcome.status === "refused") {
    /*
     * THE REASON TRAVELS AS A CODE, NOT A SENTENCE, and never with the input echoed back. The page
     * maps it to released wording; putting the sentence in the URL would let anyone craft a Hebun
     * page that says whatever they typed.
     */
    redirect(`/register?error=${encodeURIComponent(outcome.reason satisfies SignupRefusal)}`);
  }

  const issued = await issueLocalSession(getControlPlaneDb(), env, {
    email,
    password,
    requestId: randomUUID(),
  });

  /*
   * THE ACCOUNT EXISTS EITHER WAY. If the session could not be issued — a race that revoked the
   * membership, a database that went away between the two calls — the human is sent to sign in
   * rather than told signup failed, because signup did not fail. Nothing is rolled back here and
   * nothing could be: the provisioning transaction committed.
   */
  if (issued.result.status !== "authorized") {
    if (
      issued.result.status === "tenant-selection-required" ||
      issued.result.status === "onboarding-required"
    ) {
      await setSessionCookie(issued.reference, issued.maxAgeSeconds);
      redirect("/login/select-workspace");
    }
    redirect("/login?created=1");
  }

  await setSessionCookie(issued.reference, issued.maxAgeSeconds);
  redirect("/foundation");
}
