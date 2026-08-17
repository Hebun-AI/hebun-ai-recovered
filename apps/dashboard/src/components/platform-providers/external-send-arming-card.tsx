"use client";

/*
 * External-send arming card (R3B) — Providers & Models → Resend.
 *
 * The Director-facing arming boundary for OUTBOUND EXTERNAL SENDS. It is the sibling of the R2E
 * Claude connectivity card and deliberately looks like it: same authority, same server action
 * shape, same refusal to collapse operational states into one green dot.
 *
 * ── WHAT THIS CARD MUST NEVER IMPLY ──────────────────────────────────────────
 *
 *   armed ≠ configured correctly · ≠ domain verified · ≠ connected · ≠ authorized ·
 *   ≠ sent · ≠ accepted · ≠ delivered
 *
 * "Armed" here means exactly one thing: the Director permits the runtime to dispatch, AND the
 * deployment has the three values it would need. Every send still requires an approved permit and
 * an explicit human Execute on Approvals — arming authorizes nothing by itself.
 *
 * No credential, sender address or subject value is rendered. The card shows PRESENCE only.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Mail, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setExternalSendConnectivityAction } from "@/app/(dashboard)/platform/actions";
import type { ExternalSendOpsView } from "@/features/action-execution/execution-arming-projection.server";

type Tone = "good" | "warn" | "muted" | "info";

const TONE_DOT: Record<Tone, string> = {
  good: "bg-success",
  warn: "bg-warning",
  muted: "bg-fg-muted",
  info: "bg-info",
};
const TONE_TEXT: Record<Tone, string> = {
  good: "text-success",
  warn: "text-warning",
  muted: "text-fg-secondary",
  info: "text-info",
};

function Pill({ tone, label }: { tone: Tone; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${TONE_TEXT[tone]}`}>
      <span className={`size-2 shrink-0 rounded-full ${TONE_DOT[tone]}`} aria-hidden="true" />
      {label}
    </span>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-raised/40 p-3">
      <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">{label}</span>
      {children}
    </div>
  );
}

/** The three arming states, each rendered as its own sentence rather than a shared adjective. */
const ARMING_META: Record<
  ExternalSendOpsView["armingState"],
  { tone: Tone; label: string; detail: string }
> = {
  unconfigured: {
    tone: "muted",
    label: "Not configured",
    detail:
      "Deployment has not supplied the credential, sender and subject. The adapter does not exist at runtime, and arming is refused until all three are present.",
  },
  "configured-disarmed": {
    tone: "warn",
    label: "Configured — disarmed",
    detail:
      "Everything needed is configured, and the Director has not permitted sending. Every execution is blocked server-side before any network dispatch.",
  },
  armed: {
    tone: "good",
    label: "Armed",
    detail:
      "The Director permits dispatch and the deployment is complete. A send still requires an approved permit and an explicit human Execute — arming authorizes nothing on its own.",
  },
};

export function ExternalSendArmingCard({ view }: { view: ExternalSendOpsView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const enabled = view.directorEnabled;
  const arming = ARMING_META[view.armingState];
  /* Enabling is impossible without configuration, so the control says so instead of failing late. */
  const canEnable = view.configuration === "configured";

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setExternalSendConnectivityAction({ enabled: !enabled });
      if (result.status === "ok") {
        router.refresh();
        return;
      }
      setError(
        result.status === "unauthorized"
          ? "Sign in to change external-send connectivity."
          : result.status === "configuration-incomplete"
            ? "External send cannot be armed until the credential, sender and subject are all configured."
            : "You do not have permission to change external-send connectivity (owner/director only).",
      );
    });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
            <Mail className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle>{view.providerLabel} — external send</CardTitle>
            <CardDescription>
              Director control of <strong>outbound external sending</strong>. Separate from Claude
              model connectivity: permitting Hebun to think never permits it to act.
            </CardDescription>
          </div>
        </div>
        <Pill tone={arming.tone} label={arming.label} />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* The control itself */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">Director send permission</p>
              <p className="text-xs leading-5 text-fg-muted">{arming.detail}</p>
            </div>
          </div>
          <Button
            variant={enabled ? "danger" : "success"}
            onClick={toggle}
            disabled={pending || (!enabled && !canEnable)}
            aria-pressed={enabled}
          >
            {pending ? "Saving…" : enabled ? "Disarm" : "Arm"}
          </Button>
        </div>

        {error ? <p className="text-xs font-medium text-error">{error}</p> : null}

        {/* Truthful, distinct facts — never collapsed into the arming pill. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Director permission">
            <Pill
              tone={enabled ? "good" : "muted"}
              label={enabled ? "Enabled" : "Disabled"}
            />
          </Field>
          <Field label="Credential">
            <span className="inline-flex items-center gap-1.5">
              <KeyRound className="size-3.5 text-fg-muted" aria-hidden="true" />
              <Pill
                tone={view.credential === "present" ? "good" : "warn"}
                label={view.credential === "present" ? "Present" : "Missing"}
              />
            </span>
          </Field>
          <Field label="Sender">
            <Pill
              tone={view.sender === "configured" ? "good" : "warn"}
              label={view.sender === "configured" ? "Configured" : "Missing"}
            />
          </Field>
          <Field label="Subject">
            <Pill
              tone={view.subject === "configured" ? "good" : "warn"}
              label={view.subject === "configured" ? "Configured" : "Missing"}
            />
          </Field>
          <Field label="Sender domain">
            <Pill tone="muted" label="Not established by Hebun" />
          </Field>
          <Field label="Last send">
            <Pill tone="muted" label="Never" />
          </Field>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-1">
        <p className="text-xs leading-5 text-fg-muted">
          <strong className="text-fg-secondary">Armed</strong> means the Director permits dispatch
          and the deployment is complete. It does not mean the sending domain is verified, that the
          provider is reachable, or that anything has been sent, accepted or delivered.
        </p>
        <p className="text-xs leading-5 text-fg-muted">
          Resend is the authority on domain verification — Hebun performs no check and shows no
          badge for it. The API key is never shown or changed here; it stays in server
          configuration. Every send additionally requires an approved permit and an explicit human
          Execute on Approvals.
        </p>
      </CardFooter>
    </Card>
  );
}
