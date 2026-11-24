import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

/* ACTIVATION-1 — ask for a password reset link. Public by exact path (middleware). */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password — Hebun AI",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Reset your password</h1>
      <ForgotPasswordForm />
    </main>
  );
}
