"use server";

import type { PasswordResetConfirmResult } from "@/features/auth-email-ownership/contracts";
import { confirmPasswordReset } from "@/features/auth-email-ownership/email-verification.server";

/*
 * ACTIVATION-1 — set a new password from an emailed link. The token and the password are form
 * fields (never positional arguments, never a URL). No session is read: the reset authority decides.
 */
export async function confirmPasswordResetAction(formData: FormData): Promise<PasswordResetConfirmResult> {
  try {
    return await confirmPasswordReset(String(formData.get("token") ?? ""), String(formData.get("password") ?? ""));
  } catch {
    return { status: "refused", reason: "persistence-unavailable" };
  }
}
