"use client";

import { MailCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { requestEmailVerificationAction } from "@/app/verify-email/actions";
import type {
  EmailOwnershipState,
  EmailVerificationIssueResult,
} from "@/features/auth-email-ownership/contracts";
import {
  EMAIL_OWNERSHIP_REQUIRED_FOR,
  ISSUE_DELIVERY_TEXT,
  ISSUE_REFUSAL_TEXT,
  formatLinkExpiry,
  latestLinkText,
} from "@/features/auth-email-ownership/wording";

/**
 * The one place a signed-in human learns their address is not yet confirmed, and asks for a link.
 *
 * Renders NOTHING when the address is confirmed, when the state could not be read, or when this
 * deployment cannot send authentication mail: a notice offering an act that cannot happen would be
 * noise on every page, and nobody's access depends on it. The Governance genesis page states the
 * requirement on its own where it matters.
 *
 * The button sends no input. Whom the link is for and where it goes are decided server-side from
 * the session.
 */
export function EmailOwnershipNotice({ state }: { readonly state: EmailOwnershipState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<EmailVerificationIssueResult | null>(null);

  if (state.status !== "unverified" || !state.deliveryAvailable) return null;

  function request() {
    startTransition(async () => {
      let next: EmailVerificationIssueResult;
      try {
        next = await requestEmailVerificationAction();
      } catch {
        next = { status: "refused", reason: "persistence-unavailable" };
      }
      setResult(next);
      router.refresh();
    });
  }

  const message = result
    ? result.status === "issued"
      ? ISSUE_DELIVERY_TEXT[result.delivery]
      : ISSUE_REFUSAL_TEXT[result.reason]
    : state.latest
      ? `${latestLinkText(state.latest.delivery)} It expires ${formatLinkExpiry(state.latest.expiresAt)}.`
      : null;

  return (
    <section
      aria-label="Email confirmation"
      className="mb-4 flex flex-col gap-2 rounded-lg border border-border bg-surface-muted p-3 text-sm text-fg-muted sm:flex-row sm:items-start"
    >
      <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">Confirm your email address</p>
        <p className="mt-1">{EMAIL_OWNERSHIP_REQUIRED_FOR}</p>
        {message ? (
          <p className="mt-1" role="status">
            {message}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={request}
        disabled={pending}
        className="shrink-0 self-start rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-fg disabled:opacity-60"
      >
        {pending ? "Sending…" : state.latest ? "Send a new link" : "Send confirmation email"}
      </button>
    </section>
  );
}
