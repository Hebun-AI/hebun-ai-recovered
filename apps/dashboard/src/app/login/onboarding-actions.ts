"use server";

import { cookies } from "next/headers";
import { getAuthEnvironment } from "@/features/auth-runtime/request-session.server";
import {
  ENROLLMENT_CONTINUATION_COOKIE_NAME,
  ENROLLMENT_CONTINUATION_COOKIE_PATH,
  ENROLLMENT_CONTINUATION_TTL_SECONDS,
  continuationCookieOptions,
} from "@/features/identity-enrollment/continuation-cookie";
import { startIdentityEnrollment } from "@/features/identity-enrollment/start-enrollment.server";
import { completeIdentityEnrollment } from "@/features/identity-enrollment/complete-enrollment.server";
import { acceptInvitation } from "@/features/human-onboarding/accept-invitation.server";

/*
 * The public onboarding boundary — the only client-crossable way to spend an onboarding capability.
 *
 * ── WHAT THIS FILE IS, AND WHAT IT IS NOT ───────────────────────────────────────────────────────
 *
 * It is a REQUEST BOUNDARY. It resolves configuration, carries one cookie, and calls authorities that
 * already exist. It is not an authority itself and owns no rule: it validates no capability, digests
 * nothing, decides no eligibility, creates no user, identity, credential, invitation or membership,
 * and writes to no table. Every refusal below is a value produced by the authority that owns the
 * question — none is invented here.
 *
 * ── WHY IT LIVES UNDER `/login` ─────────────────────────────────────────────────────────────────
 *
 * `middleware.ts` treats `/login` and everything beneath it as public, so this surface needs NO
 * change to route protection — the same reasoning `/login/select-workspace` records in its own
 * header. `PUBLIC_PREFIXES` is unchanged, and the dashboard stays exactly as protected as it was.
 *
 * ── WHY THE ACTS ARE UNAUTHENTICATED, AND WHY THAT IS NOT A HOLE ────────────────────────────────
 *
 * The intended human has no user, no identity, no credential and no membership; requiring a session
 * would make the only path to becoming a member unreachable. Possession of the capability is what
 * these acts consume, and possession proves possession — the second key (a Governance approval) is
 * what stands between a bearer and an identity. Nothing here weakens that.
 *
 * ── WHAT THE CLIENT MAY SUPPLY, EXHAUSTIVELY ────────────────────────────────────────────────────
 *
 *   Act 1        the capability
 *   Act 3        the capability, and a password
 *   Acceptance   the capability, an email, and a password
 *
 * The tenant, the intended role, the invitation, the enrollment, the identity coordinates, every
 * status and every timestamp are read from durable rows or generated server-side. The continuation
 * reference is never accepted from input and never returned to the browser — it travels in an
 * httpOnly cookie the server sets and the server reads.
 *
 * ── THE RESULT TYPES ARE SURFACE TYPES, ON PURPOSE ──────────────────────────────────────────────
 *
 * The authorities' refusal unions are re-exported as plain strings rather than handed to the client,
 * so a client component never imports the enrollment authority to name one. The wording that renders
 * them is built server-side, where the real unions are still type-checked.
 */

/* ── ACT 1 ─────────────────────────────────────────────────────────────────── */

export type EnrollmentStartOutcome =
  | { readonly status: "started" }
  | { readonly status: "refused"; readonly reason: string };

/**
 * Begin ONE enrollment ceremony, and keep its continuation reference server-side.
 *
 * The reference is minted by the authority and put straight into an httpOnly cookie. It is not in the
 * return value, so it never reaches the page's JavaScript, never lands in a URL, and is never shown
 * to the human to write down.
 */
export async function startEnrollmentAction(input: {
  capability: string;
}): Promise<EnrollmentStartOutcome> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") {
    return { status: "refused", reason: "persistence-unavailable" };
  }

  const result = await startIdentityEnrollment(
    { capability: input?.capability ?? "" },
    { digestKey: env.sessionDigestCurrentKey },
  );

  if (result.status !== "started") {
    return { status: "refused", reason: result.reason };
  }

  const store = await cookies();
  store.set(
    ENROLLMENT_CONTINUATION_COOKIE_NAME,
    result.continuationReference,
    continuationCookieOptions(ENROLLMENT_CONTINUATION_TTL_SECONDS),
  );
  return { status: "started" };
}

/* ── ACT 3 ─────────────────────────────────────────────────────────────────── */

export type EnrollmentCompletionOutcome =
  | { readonly status: "completed" }
  | { readonly status: "refused"; readonly reason: string };

/**
 * Complete an APPROVED ceremony, using the receipt this browser already holds.
 *
 * The receipt is cleared on every TERMINAL outcome, so a spent or dead reference does not linger.
 * `enrollment-not-approved` is deliberately not terminal: the bearer is waiting for the second key,
 * and clearing it there would strand a ceremony that is progressing normally.
 */
export async function completeEnrollmentAction(input: {
  capability: string;
  password: string;
}): Promise<EnrollmentCompletionOutcome> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") {
    return { status: "refused", reason: "persistence-unavailable" };
  }

  const store = await cookies();
  const continuationReference = store.get(ENROLLMENT_CONTINUATION_COOKIE_NAME)?.value ?? "";
  if (!continuationReference) {
    return { status: "refused", reason: "no-continuation-receipt" };
  }

  const result = await completeIdentityEnrollment(
    {
      capability: input?.capability ?? "",
      continuationReference,
      password: input?.password ?? "",
    },
    { digestKey: env.sessionDigestCurrentKey },
  );

  if (result.status === "completed") {
    await clearContinuationReceipt();
    return { status: "completed" };
  }

  if (
    result.reason === "continuation-unrecognized" ||
    result.reason === "capability-not-usable" ||
    result.reason === "already-enrolled"
  ) {
    await clearContinuationReceipt();
  }
  return { status: "refused", reason: result.reason };
}

/* ── ACCEPTANCE ────────────────────────────────────────────────────────────── */

export type InvitationAcceptanceOutcome =
  | { readonly status: "accepted" }
  | { readonly status: "refused"; readonly reason: string };

/**
 * Accept the invitation and become a member, by proving the credential of the invited human.
 *
 * Nothing about the resulting membership is returned. The tenant name, the role and the membership id
 * are facts about an organization the caller has only just joined, and the next step — an ordinary
 * sign-in — will resolve all of them from the durable row anyway.
 */
export async function acceptInvitationEntryAction(input: {
  capability: string;
  email: string;
  password: string;
}): Promise<InvitationAcceptanceOutcome> {
  const env = getAuthEnvironment();
  if (env.status !== "configured") {
    return { status: "refused", reason: "persistence-unavailable" };
  }

  const result = await acceptInvitation(
    {
      capability: input?.capability ?? "",
      email: input?.email ?? "",
      password: input?.password ?? "",
    },
    { digestKey: env.sessionDigestCurrentKey },
  );

  if (result.status !== "accepted") {
    return { status: "refused", reason: result.reason };
  }
  /* The ceremony is over for this browser; the receipt has nothing left to continue. */
  await clearContinuationReceipt();
  return { status: "accepted" };
}

/** Drop the receipt. Path-scoped identically to the way it was set, or the delete would miss. */
async function clearContinuationReceipt(): Promise<void> {
  const store = await cookies();
  store.delete({
    name: ENROLLMENT_CONTINUATION_COOKIE_NAME,
    path: ENROLLMENT_CONTINUATION_COOKIE_PATH,
  });
}
