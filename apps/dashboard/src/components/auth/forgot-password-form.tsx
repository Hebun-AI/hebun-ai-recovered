"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { requestPasswordResetAction, type PasswordResetRequestAnswer } from "@/app/forgot-password/actions";

/* ACTIVATION-1 — one field, one answer for every address. */
export function ForgotPasswordForm() {
  const [pending, startTransition] = useTransition();
  const [answer, setAnswer] = useState<PasswordResetRequestAnswer | null>(null);

  function submit(formData: FormData) {
    startTransition(async () => {
      try {
        setAnswer(await requestPasswordResetAction(formData));
      } catch {
        setAnswer({ status: "unavailable" });
      }
    });
  }

  if (answer?.status === "sent") {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          If an account uses that address, a reset link is on its way. It works once and expires in 1 hour.
        </p>
        <Link href="/login" className="text-sm font-medium underline">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={submit} className="flex flex-col gap-3">
      <p className="text-sm text-neutral-600">Enter the email address you sign in with. We will mail you a link.</p>
      <label htmlFor="reset-email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="reset-email"
        name="email"
        type="email"
        autoComplete="email"
        required
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {answer?.status === "unavailable" ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Password reset is not available right now. Try again later or contact support.
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <Link href="/login" className="text-sm font-medium underline">
        Back to sign in
      </Link>
    </form>
  );
}
