"use server";

import { redirect } from "next/navigation";
import { elevateSessionWithMfaForRequest } from "@/features/operator-authority/admin-request.server";

/**
 * The admin MFA challenge. The form supplies ONE value — the six-digit code. Who is verifying, which
 * credential, and whether they are an operator are all resolved on the server from the session.
 */
export async function verifyAdminMfaAction(formData: FormData): Promise<void> {
  const raw = formData.get("code");
  const code = typeof raw === "string" ? raw.replace(/\s+/g, "") : "";
  if (!/^\d{6}$/.test(code)) redirect("/admin/verify?error=invalid");

  const outcome = await elevateSessionWithMfaForRequest(code);
  if (outcome.status === "elevated") redirect("/admin");
  if (outcome.reason === "no-session") redirect("/login");
  if (outcome.reason === "locked") redirect("/admin/verify?error=locked");
  redirect("/admin/verify?error=invalid");
}
