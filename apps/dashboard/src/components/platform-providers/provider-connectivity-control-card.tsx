"use client";

/*
 * Provider connectivity control card (R2E) — Platform → Providers → Anthropic / Claude.
 *
 * Shows the truthful, secret-free provider-ops view. It keeps the operational states DISTINCT:
 * "Director enabled" is a permission, not a health or reachability claim. The API key is never
 * shown here and is never changed.
 *
 * ── READ-ONLY SINCE R5.1 ─────────────────────────────────────────────────────
 *
 * The toggle is gone, and no session of any role can change this permission from the product.
 *
 * The control row is root-scoped — no `tenant_id`, one row per provider key for the whole
 * deployment — while the authority that used to gate the toggle was resolved through
 * `roles.tenant_id` (NOT NULL) against the signed-in tenant. A tenant-scoped role was therefore
 * deciding what every other tenant depends on.
 *
 * WHY THIS SAYS SO INSTEAD OF HIDING THE BUTTON. Hiding a control implies the viewer merely lacks a
 * permission somebody else holds. Nobody holds this one in-product: the write moved out of the
 * application entirely. A disabled button would be the lie; the sentence below is the truth.
 */

import { KeyRound, PlugZap, ShieldCheck, Terminal } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  const enabled = view.directorEnabled;

  const transportTone: Tone =
    view.transport === "live" ? "info" : view.transport === "fake" ? "warn" : "muted";
  /*
   * DISPATCH IS THE ONLY FIELD THAT DECIDES DISPATCH (L2).
   *
   * The gates beside it can all read healthy while a request is still blocked: two of the five
   * inputs `evaluateModelAvailability` consults were never rendered here, and the field labelled
   * "Credential" reports a different variable than the credential GATE. So the card is not allowed
   * to imply readiness from the gates alone — it states a verdict.
   *
   * THAT VERDICT USED TO BE `availability`, AND `availability` CANNOT SEE THE DIRECTOR. It is pure
   * config and transport presence. The Director's durable control is the FIRST gate at request time
   * and blocks before a transport is selected, so this card rendered a green "an attempt is
   * permitted" in the kill switch's own intended operating state — configured deployment, Director
   * off, nothing dispatched. The verdict is now `dispatch`, which is that composition, and it names
   * the refusing authority instead of collapsing both into one word.
   */
  const availabilityTone: Tone = view.availability === "AVAILABLE" ? "good" : "warn";
  const AVAILABILITY_LABEL: Record<typeof view.availability, string> = {
    AVAILABLE: "Configuration permits an attempt",
    DISABLED: "Disabled — connectivity flag is not enabled",
    MISCONFIGURED: "Misconfigured — provider, model or output bound",
    CREDENTIAL_UNAVAILABLE: "Blocked — no server-side model credential",
    TRANSPORT_UNAVAILABLE: "Blocked — no live transport selected",
  };
  const dispatchTone: Tone = view.dispatch === "permitted" ? "good" : "warn";
  const DISPATCH_LABEL: Record<typeof view.dispatch, string> = {
    permitted: "Permitted — an attempt may be made",
    "blocked-by-director": "Blocked — the Director's connectivity control is off",
    "blocked-by-availability": "Blocked — the deployment's model configuration",
  };
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
        {/* The permission, stated — and where it is changed. No control renders here. */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface-raised/50 p-4">
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
          <div className="flex items-start gap-3 border-t border-border pt-3">
            <Terminal className="mt-0.5 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            <p className="min-w-0 text-xs leading-5 text-fg-muted">
              <strong className="text-fg-secondary">This permission is global and is not changed from Hebun.</strong>{" "}
              One row governs every tenant, so no tenant role — owner and director included — may set
              it. In generation one it is changed only through the local deployment-operator ceremony{" "}
              <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.7rem] text-fg-secondary">
                npm run provider:connectivity
              </code>
              , which runs on the deployment itself and never in production.
            </p>
          </div>
        </div>

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
          <Field label="Configuration verdict">
            <Pill tone={availabilityTone} label={AVAILABILITY_LABEL[view.availability]} />
          </Field>
          <Field label="Dispatch">
            <Pill tone={dispatchTone} label={DISPATCH_LABEL[view.dispatch]} />
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
          succeeded. Those are separate facts shown above.{" "}
          <strong className="text-fg-secondary">Dispatch</strong> is the only one that decides
          whether a request may be attempted at all; every other field here — the configuration
          verdict included — can read healthy while it does not, because none of them can see all
          the gates. It still never means a provider was reached or that a call succeeded.
        </p>
        <p className="text-xs leading-5 text-fg-muted">
          The API key is never shown or changed here; it stays in server configuration. This control
          governs model connectivity only — it activates no execution, tools, or Computer Use.
        </p>
      </CardFooter>
    </Card>
  );
}
