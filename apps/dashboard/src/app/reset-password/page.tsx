import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

/*
 * ACTIVATION-1 — where an emailed reset link lands. Public by exact path; the token is in the
 * fragment, so no request ever carries it, and nothing happens until the human submits.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Choose a new password — Hebun AI",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Choose a new password</h1>
      <ResetPasswordForm />
    </main>
  );
}
