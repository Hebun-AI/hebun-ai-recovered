"use client";

/*
 * Provider connectivity control card (R2E) — Platform → Providers → Anthropic / Claude.
 *
 * Shows the truthful, secret-free provider-ops view and the Director ON/OFF control. It keeps
 * the operational states DISTINCT: "Director enabled" is a permission, not a health or
 * reachability claim. The API key is never shown here and is never changed by this control.
 *
 * The toggle calls a server action; the tenant, role, and authority are resolved server-side.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, PlugZap, ShieldCheck } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { setClaudeConnectivityAction } from "@/app/(dashboard)/platform/actions";
import type { ProviderOpsView } from "@/features/heby-provider-ops/provider-connectivity-projection.server";

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

export function ProviderConnectivityControlCard({ view }: { view: ProviderOpsView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const enabled = view.directorEnabled;

  function toggle() {
    setError(null);
    startTransition(async () => {
      const result = await setClaudeConnectivityAction({ enabled: !enabled });
      if (result.status === "ok") {
        router.refresh();
        return;
      }
      setError(
        result.status === "unauthorized"
          ? "Sign in to change provider connectivity."
          : "You do not have permission to change provider connectivity (owner/director only).",
      );
    });
  }

  const transportTone: Tone =
    view.transport === "live" ? "info" : view.transport === "fake" ? "warn" : "muted";
  const transportLabel =
    view.transport === "live" ? "Live" : view.transport === "fake" ? "Test (fake)" : "Unavailable";

  return (
    <Card>
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
            <PlugZap className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <CardTitle>{view.providerLabel}</CardTitle>
            <CardDescription>
              Director control of Claude <strong>model-generation</strong> connectivity (the Heby
              model seam) — not agent execution, tools, or Computer Use.
            </CardDescription>
          </div>
        </div>
        <Pill
          tone={enabled ? "good" : "muted"}
          label={enabled ? "Director: Enabled" : "Director: Disabled"}
        />
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* The control itself */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">Director connectivity permission</p>
              <p className="text-xs leading-5 text-fg-muted">
                {enabled
                  ? "Requests may proceed only if configuration, credential, model, and transport gates also pass."
                  : "Off — Hebun will make no new Claude request, blocked server-side before any network dispatch."}
              </p>
            </div>
          </div>
          <Button
            variant={enabled ? "danger" : "success"}
            onClick={toggle}
            disabled={pending}
            aria-pressed={enabled}
          >
            {pending ? "Saving…" : enabled ? "Turn OFF" : "Turn ON"}
          </Button>
        </div>

        {error ? <p className="text-xs font-medium text-error">{error}</p> : null}

        {/* Truthful, distinct states — never collapsed into one boolean. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Configuration">
            <Pill
              tone={view.configuration === "configured" ? "good" : "warn"}
              label={view.configuration === "configured" ? "Configured" : "Needs configuration"}
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
          <Field label="Model">
            <span className="truncate text-sm font-medium text-fg" title={view.model ?? undefined}>
              {view.model ?? "—"}
            </span>
          </Field>
          <Field label="Transport">
            <Pill tone={transportTone} label={transportLabel} />
          </Field>
          <Field label="Connectivity">
            <Pill tone="muted" label="Not recorded" />
          </Field>
          <Field label="Last validation">
            <Pill tone="muted" label="Not recorded" />
          </Field>
        </div>
      </CardContent>

      <CardFooter className="flex-col items-start gap-1">
        <p className="text-xs leading-5 text-fg-muted">
          <strong className="text-fg-secondary">Enabled</strong> means the Director permits
          connectivity — not that Claude is configured, healthy, reachable, or that the last request
          succeeded. Those are separate facts shown above.
        </p>
        <p className="text-xs leading-5 text-fg-muted">
          The API key is never shown or changed here; it stays in server configuration. This control
          governs model connectivity only — it activates no execution, tools, or Computer Use.
        </p>
      </CardFooter>
    </Card>
  );
}
