"use server";

import { issuePasswordReset } from "@/features/auth-email-ownership/email-verification.server";

/*
 * ACTIVATION-1 — request a password reset link.
 *
 * One answer for every address: whether an account exists is never revealed. The only distinct
 * answer is "unavailable", which says the deployment cannot send mail at all — true for everyone.
 */
export type PasswordResetRequestAnswer = { readonly status: "sent" } | { readonly status: "unavailable" };

export async function requestPasswordResetAction(formData: FormData): Promise<PasswordResetRequestAnswer> {
  const email = String(formData.get("email") ?? "");
  try {
    const result = await issuePasswordReset(email);
    if (
      result.status === "refused" &&
      (result.reason === "delivery-unavailable" || result.reason === "unavailable" || result.reason === "persistence-unavailable")
    ) {
      return { status: "unavailable" };
    }
  } catch {
    return { status: "unavailable" };
  }
  return { status: "sent" };
}
