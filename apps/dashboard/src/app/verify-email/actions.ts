"use server";

import {
  getAuthEnvironment,
  resolveRequestAuthentication,
} from "@/features/auth-runtime/request-session.server";
import type {
  EmailVerificationConfirmResult,
  EmailVerificationIssueResult,
} from "@/features/auth-email-ownership/contracts";
import {
  confirmEmailVerification,
  issueEmailVerification,
} from "@/features/auth-email-ownership/email-verification.server";

/**
 * Email ownership — the two acts a signed-in human may perform about their own address.
 *
 * ── THE BROWSER SENDS ONE THING, AND ONLY TO ONE OF THEM ────────────────────
 *
 * Requesting a link takes NO input: the identity and the recipient are whoever the authorized
 * session says. Confirming takes exactly the link token, as one form field in the request BODY (the
 * page lifted it out of the URL fragment) — never in a query string, a path, a redirect, or a
 * positional argument a development log would print. Neither action
 * logs, echoes or returns the token, and every failure comes back as a closed code.
 *
 * Both actions require an AUTHORIZED session. A link is a proof only when the person presenting it
 * is signed in as the identity it was mailed for.
 */

type SessionResolution =
  | {
      readonly status: "authorized";
      readonly authIdentityId: string;
      readonly sessionContextId: string;
    }
  | { readonly status: "workspace-not-selected" | "unauthenticated" };

async function resolveSession(): Promise<SessionResolution> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") return { status: "unauthenticated" };
  try {
    const result = await resolveRequestAuthentication(env);
    if (result.status === "authorized") {
      return {
        status: "authorized",
        authIdentityId: result.tenantContext.authIdentityId,
        sessionContextId: result.tenantContext.sessionContextId,
      };
    }
    if (result.status === "tenant-selection-required") return { status: "workspace-not-selected" };
    return { status: "unauthenticated" };
  } catch {
    return { status: "unauthenticated" };
  }
}

/** Mail a new confirmation link to the signed-in identity's own address. */
export async function requestEmailVerificationAction(): Promise<EmailVerificationIssueResult> {
  const session = await resolveSession();
  if (session.status !== "authorized") {
    return { status: "refused", reason: "unauthenticated" };
  }
  try {
    return await issueEmailVerification(session.authIdentityId);
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}

/**
 * Present a link token as the signed-in identity.
 *
 * The token travels as a FORM FIELD, never as a positional argument: the framework's development
 * server-function log prints positional arguments verbatim (a string token would land in the log),
 * while form data is printed as an opaque `{}`.
 */
export async function confirmEmailOwnershipAction(
  formData: FormData,
): Promise<EmailVerificationConfirmResult> {
  const token = formData instanceof FormData ? formData.get("token") : null;
  const session = await resolveSession();
  if (session.status === "workspace-not-selected") {
    return { status: "refused", reason: "workspace-not-selected" };
  }
  if (session.status !== "authorized") {
    return { status: "refused", reason: "unauthenticated" };
  }
  try {
    return await confirmEmailVerification(typeof token === "string" ? token : "", {
      authIdentityId: session.authIdentityId,
      sessionContextId: session.sessionContextId,
    });
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}
