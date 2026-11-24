"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { confirmPasswordResetAction } from "@/app/reset-password/actions";
import {
  EMAIL_VERIFICATION_FRAGMENT_KEY,
  EMAIL_VERIFICATION_TOKEN_PATTERN,
  PASSWORD_RESET_MIN_LENGTH,
  type PasswordResetConfirmRefusal,
  type PasswordResetConfirmResult,
} from "@/features/auth-email-ownership/contracts";

/*
 * ACTIVATION-1 — the reset link's landing form. Same token discipline as the verification page:
 * read once from the fragment into a ref, the fragment is removed from history at once, the token is
 * sent only as a form field when the human submits, and it is never rendered or stored.
 */
const REFUSAL_TEXT: Record<PasswordResetConfirmRefusal, string> = {
  "invalid-link": "This link is not valid any more. It may have been used, replaced by a newer one, or expired.",
  "password-unacceptable": `Choose a password of at least ${PASSWORD_RESET_MIN_LENGTH} characters.`,
  unavailable: "Password reset is not available right now. Nothing was changed.",
  "persistence-unavailable": "Hebun is unavailable right now. Nothing was changed; try again shortly.",
};

function readFragmentToken(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const value = new URLSearchParams(hash).get(EMAIL_VERIFICATION_FRAGMENT_KEY);
  return value && EMAIL_VERIFICATION_TOKEN_PATTERN.test(value) ? value : null;
}

export function ResetPasswordForm() {
  const token = useRef<string | null>(null);
  const [phase, setPhase] = useState<"reading" | "missing" | "ready">("reading");
  const [result, setResult] = useState<PasswordResetConfirmResult | null>(null);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    function capture() {
      const found = readFragmentToken();
      if (window.location.hash) window.history.replaceState(null, "", window.location.pathname);
      if (found) token.current = found;
      setPhase(token.current ? "ready" : "missing");
    }
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, []);

  function submit() {
    const value = token.current;
    if (!value) return;
    startTransition(async () => {
      let outcome: PasswordResetConfirmResult;
      try {
        const form = new FormData();
        form.set("token", value);
        form.set("password", password);
        outcome = await confirmPasswordResetAction(form);
      } catch {
        outcome = { status: "refused", reason: "persistence-unavailable" };
      }
      if (outcome.status === "reset" || outcome.reason === "invalid-link") token.current = null;
      setResult(outcome);
      if (outcome.status === "refused" && outcome.reason === "invalid-link") setPhase("missing");
    });
  }

  if (phase === "reading") return <p className="text-sm text-neutral-500">Reading the link…</p>;

  if (result?.status === "reset") {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Your password is changed. Every open Hebun session was signed out.
        </p>
        <Link href="/login" className="text-sm font-medium underline">
          Sign in
        </Link>
      </div>
    );
  }

  if (phase === "missing") {
    return (
      <div className="flex flex-col gap-3">
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {REFUSAL_TEXT["invalid-link"]}
        </p>
        <Link href="/forgot-password" className="text-sm font-medium underline">
          Request a new link
        </Link>
      </div>
    );
  }

  const tooShort = password.length < PASSWORD_RESET_MIN_LENGTH;
  const mismatch = repeat.length > 0 && repeat !== password;
  const refusal = result?.status === "refused" ? result.reason : null;
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor="new-password" className="text-sm font-medium">
        New password
      </label>
      <input
        id="new-password"
        type="password"
        autoComplete="new-password"
        minLength={PASSWORD_RESET_MIN_LENGTH}
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <p className="text-xs text-neutral-500">At least {PASSWORD_RESET_MIN_LENGTH} characters.</p>
      <label htmlFor="repeat-password" className="text-sm font-medium">
        Repeat it
      </label>
      <input
        id="repeat-password"
        type="password"
        autoComplete="new-password"
        required
        value={repeat}
        onChange={(e) => setRepeat(e.target.value)}
        aria-invalid={mismatch}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      {mismatch ? <p className="text-xs text-amber-800">The two passwords differ.</p> : null}
      {refusal ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {REFUSAL_TEXT[refusal]}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending || tooShort || repeat !== password}
        className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
      >
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
