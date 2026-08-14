"use client";

/*
 * Onboarding entry card — the surface a bearer uses to spend an onboarding capability.
 *
 * IT EXTENDS THE SIGN-IN SURFACE, exactly as the workspace picker does. It is not a sign-up form, not
 * an account creator and not an invitation manager: it exists only for the moments between holding a
 * capability and holding a membership, and it lives under `/login` because that is where those
 * moments are.
 *
 * ── IT RENDERS NOTHING IT WAS NOT GIVEN ──────────────────────────────────────
 *
 * The card never learns, and therefore can never display, the organization's name, the invited
 * address or the intended role. Showing any of them before a proof would turn a stolen capability
 * into a disclosure. Every refusal is text the SERVER built from the authorities' own refusal unions
 * and passed in as a prop — the card looks a reason up, it does not know what reasons exist.
 *
 * ── THE CONTINUATION RECEIPT IS NOT HERE ─────────────────────────────────────
 *
 * The continuation reference never reaches this component. It is set by the server into an httpOnly
 * cookie at Act 1 and read by the server at Act 3; this card only knows whether one EXISTS, because
 * that determines which step to offer. There is no state to persist and nothing to leak.
 *
 * ── THE CAPABILITY LIVES IN MEMORY, AND ONLY IN MEMORY ───────────────────────
 *
 * It is held in React state so the bearer types it once per visit, and it is deliberately NOT put in
 * localStorage, sessionStorage or the URL. A reload asks for it again — the honest cost of refusing
 * to write a bearer secret anywhere durable on a device Hebun knows nothing about.
 *
 * ── THE LANGUAGE IS DELIBERATE ───────────────────────────────────────────────
 *
 * "Onboarding capability", never "invite code". "Waiting for approval", never "we emailed you".
 * Hebun sent nothing and verified no address, and no wording here may suggest otherwise.
 *
 * ACCESSIBILITY: real labels on real inputs, refusals in role="alert", progress in role="status",
 * and every state carried by words rather than colour.
 */

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  acceptInvitationEntryAction,
  completeEnrollmentAction,
  startEnrollmentAction,
} from "@/app/login/onboarding-actions";

/** Which act the bearer is on. Derived from the server, never declared by the client. */
type Step = "present" | "await-approval" | "accept" | "done";

export interface OnboardingEntryWording {
  /** Refusal reason → sentence, for each of the three acts. Built server-side from real unions. */
  readonly startRefusals: Readonly<Record<string, string>>;
  readonly completionRefusals: Readonly<Record<string, string>>;
  readonly acceptanceRefusals: Readonly<Record<string, string>>;
  /** The minimum a first password must satisfy, from the enrollment policy constant. */
  readonly minimumPasswordLength: number;
  /** What possession of a capability does and does not prove. Stated as a limitation. */
  readonly possessionLimitation: string;
  /** Where the receipt lives and what happens if it is lost. */
  readonly receiptCustody: string;
  readonly receiptIfLost: string;
}

const FALLBACK_REFUSAL = "That could not be completed. Nothing was changed.";

export function OnboardingEntryCard({
  hasReceipt,
  wording,
}: {
  /** True when this browser already carries a continuation receipt for a live ceremony. */
  readonly hasReceipt: boolean;
  readonly wording: OnboardingEntryWording;
}) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(hasReceipt ? "await-approval" : "present");
  const [capability, setCapability] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [refusal, setRefusal] = useState<string | null>(null);

  const capabilityId = useId();
  const passwordId = useId();
  const emailId = useId();
  const errorId = useId();

  function look(table: Readonly<Record<string, string>>, reason: string): string {
    return table[reason] ?? FALLBACK_REFUSAL;
  }

  function present() {
    setRefusal(null);
    startTransition(async () => {
      const result = await startEnrollmentAction({ capability });
      if (result.status === "started") {
        setStep("await-approval");
        return;
      }
      /*
       * A Hebun account already exists at the address this capability names, so there is no identity
       * to establish — this is the EXISTING-HUMAN path, and it goes straight to joining. Not an
       * error: the enrollment authority refuses on purpose, and acceptance is the act that applies.
       * It reveals nothing, because the bearer must still prove that human's credential.
       */
      if (result.reason === "already-enrolled") {
        setStep("accept");
        return;
      }
      setRefusal(look(wording.startRefusals, result.reason));
    });
  }

  function complete() {
    setRefusal(null);
    startTransition(async () => {
      const result = await completeEnrollmentAction({ capability, password });
      if (result.status === "completed") {
        setPassword("");
        setStep("accept");
        return;
      }
      setRefusal(look(wording.completionRefusals, result.reason));
    });
  }

  function accept() {
    setRefusal(null);
    startTransition(async () => {
      const result = await acceptInvitationEntryAction({ capability, email, password });
      if (result.status === "accepted") {
        setCapability("");
        setPassword("");
        setStep("done");
        return;
      }
      setRefusal(look(wording.acceptanceRefusals, result.reason));
    });
  }

  if (step === "done") {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-6">
        <h1 className="flex items-center gap-2 text-lg font-medium">
          <KeyRound aria-hidden className="size-4" />
          You are a member
        </h1>
        <p className="text-sm text-fg-muted" role="status">
          Your membership was created. Sign in with the email and password you just chose.
        </p>
        <p className="text-sm">
          <Link className="underline" href="/login">
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h1 className="flex items-center gap-2 text-lg font-medium">
          <KeyRound aria-hidden className="size-4" />
          Join with an onboarding capability
        </h1>
        <p className="text-sm text-fg-muted">
          Someone with Governance authority created a capability for you and handed it over
          themselves. Hebun did not send it and cannot resend it.
        </p>
      </div>

      {refusal ? (
        <p
          aria-live="assertive"
          className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
          id={errorId}
          role="alert"
        >
          <span className="font-medium">Not completed. </span>
          {refusal}
        </p>
      ) : null}

      <label className="flex flex-col gap-1 text-sm" htmlFor={capabilityId}>
        <span className="font-medium">Onboarding capability</span>
        <input
          autoComplete="off"
          className="rounded-md border border-neutral-300 px-3 py-2 font-mono text-sm"
          id={capabilityId}
          name="capability"
          onChange={(event) => setCapability(event.target.value)}
          required
          spellCheck={false}
          type="password"
          value={capability}
        />
      </label>

      {step === "present" ? (
        <>
          <Button disabled={pending || capability.trim().length === 0} onClick={present}>
            {pending ? "Submitting…" : "Submit for approval"}
          </Button>
          <p className="text-xs text-fg-muted">{wording.possessionLimitation}</p>
        </>
      ) : null}

      {step === "await-approval" ? (
        <>
          <p className="text-sm text-fg-muted" role="status">
            Your submission is recorded and is waiting for a Governance authority in that
            organization to approve it. Nothing was created for you yet. Come back to this page in
            this browser and choose a password once it has been approved.
          </p>
          <label className="flex flex-col gap-1 text-sm" htmlFor={passwordId}>
            <span className="font-medium">Choose a password</span>
            <input
              autoComplete="new-password"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              id={passwordId}
              minLength={wording.minimumPasswordLength}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
            <span className="text-xs text-fg-muted">
              At least {wording.minimumPasswordLength} characters.
            </span>
          </label>
          <Button
            disabled={
              pending ||
              capability.trim().length === 0 ||
              password.length < wording.minimumPasswordLength
            }
            onClick={complete}
          >
            {pending ? "Creating…" : "Create my account"}
          </Button>
          <p className="text-xs text-fg-muted">{wording.receiptCustody}</p>
          <p className="text-xs text-fg-muted">{wording.receiptIfLost}</p>
        </>
      ) : null}

      {step === "accept" ? (
        <>
          <p className="text-sm text-fg-muted" role="status">
            Your account exists. One step remains: joining the organization the capability names.
            Confirm the email address the capability was created for, and the password you just
            chose.
          </p>
          <label className="flex flex-col gap-1 text-sm" htmlFor={emailId}>
            <span className="font-medium">Email</span>
            <input
              autoComplete="username"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              id={emailId}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm" htmlFor={passwordId}>
            <span className="font-medium">Password</span>
            <input
              autoComplete="current-password"
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
              id={passwordId}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <Button
            disabled={
              pending ||
              capability.trim().length === 0 ||
              email.trim().length === 0 ||
              password.length === 0
            }
            onClick={accept}
          >
            {pending ? "Joining…" : "Join the organization"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
