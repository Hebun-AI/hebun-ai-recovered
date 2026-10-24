"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { confirmEmailOwnershipAction } from "@/app/verify-email/actions";
import {
  EMAIL_VERIFICATION_FRAGMENT_KEY,
  EMAIL_VERIFICATION_TOKEN_PATTERN,
  type EmailVerificationConfirmResult,
} from "@/features/auth-email-ownership/contracts";
import { CONFIRM_REFUSAL_TEXT } from "@/features/auth-email-ownership/wording";

/**
 * The confirmation step of an emailed link.
 *
 * ── WHERE THE TOKEN IS, AND WHERE IT IS NOT ─────────────────────────────────
 *
 * The link carries the token in its FRAGMENT. A browser never sends a fragment to any server, so the
 * token is absent from request logs, proxies and the Referer header by construction. On mount this
 * component reads it once into a ref and immediately rewrites the current history entry without the
 * fragment, so it does not remain in the address bar, the history list, a bookmark or a screenshot.
 * The token is then sent exactly once, as a form field in a server action's request body, and only
 * when the human presses the button: opening (or a mail scanner pre-fetching) the page changes
 * nothing.
 *
 * It never renders the token, never stores it, and never puts it in any URL.
 */
type Phase =
  | { readonly kind: "reading" }
  | { readonly kind: "missing" }
  | { readonly kind: "ready" }
  | { readonly kind: "done"; readonly result: EmailVerificationConfirmResult };

function readFragmentToken(): string | null {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const value = new URLSearchParams(hash).get(EMAIL_VERIFICATION_FRAGMENT_KEY);
  return value && EMAIL_VERIFICATION_TOKEN_PATTERN.test(value) ? value : null;
}

export function VerifyEmailConfirm() {
  const token = useRef<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "reading" });
  const [pending, startTransition] = useTransition();
  /* Whether the held token may be presented again. State, not the ref, so render never reads a ref. */
  const [retryable, setRetryable] = useState(false);

  useEffect(() => {
    /*
     * Runs on mount AND on every hash change: a second emailed link opened in a tab already on this
     * page changes only the fragment, which re-renders nothing by itself — without this the new token
     * would sit in the address bar and no button would appear.
     */
    function capture() {
      const found = readFragmentToken();
      if (window.location.hash) {
        /*
         * `null`, not the current state: the App Router patches `replaceState`, and only a call
         * WITHOUT its internal state marker is applied to the router's own canonical URL. Passing the
         * existing state through would clean the address bar while the router kept the fragment —
         * and rewrote it into history on its next commit.
         */
        window.history.replaceState(null, "", window.location.pathname);
      }
      if (found) token.current = found;
      setRetryable(token.current !== null);
      setPhase(token.current ? { kind: "ready" } : { kind: "missing" });
    }
    capture();
    window.addEventListener("hashchange", capture);
    return () => window.removeEventListener("hashchange", capture);
  }, []);

  function confirm() {
    const value = token.current;
    if (!value) return;
    startTransition(async () => {
      let result: EmailVerificationConfirmResult;
      try {
        const form = new FormData();
        form.set("token", value);
        result = await confirmEmailOwnershipAction(form);
      } catch {
        result = { status: "refused", reason: "persistence-unavailable" };
      }
      /* A used or refused token has no further purpose here; drop it either way except to retry. */
      if (result.status === "verified" || result.reason !== "persistence-unavailable") {
        token.current = null;
        setRetryable(false);
      }
      setPhase({ kind: "done", result });
    });
  }

  if (phase.kind === "reading") {
    return <p className="text-sm text-neutral-500">Reading the link…</p>;
  }

  if (phase.kind === "missing") {
    return (
      <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {CONFIRM_REFUSAL_TEXT["invalid-link"]}
      </p>
    );
  }

  if (phase.kind === "done" && phase.result.status === "verified") {
    return (
      <div className="flex flex-col gap-3">
        <p role="status" className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Your email address is confirmed.
        </p>
        <Link href="/command" className="text-sm font-medium underline">
          Continue to Hebun
        </Link>
      </div>
    );
  }

  const refusal = phase.kind === "done" && phase.result.status === "refused" ? phase.result.reason : null;
  return (
    <div className="flex flex-col gap-3">
      {refusal ? (
        <p role="alert" className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {CONFIRM_REFUSAL_TEXT[refusal]}
        </p>
      ) : (
        <p className="text-sm text-neutral-600">
          Confirm that this email address belongs to the Hebun account you are signed in with. This
          does not sign you in and changes nothing else.
        </p>
      )}
      {retryable ? (
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {pending ? "Confirming…" : "Confirm my email address"}
        </button>
      ) : null}
      {refusal === "unauthenticated" ? (
        <Link href="/login" className="text-sm font-medium underline">
          Sign in
        </Link>
      ) : refusal === "workspace-not-selected" ? (
        <Link href="/login/select-workspace" className="text-sm font-medium underline">
          Choose a workspace
        </Link>
      ) : refusal ? (
        <Link href="/command" className="text-sm font-medium underline">
          Go to Hebun
        </Link>
      ) : null}
    </div>
  );
}
