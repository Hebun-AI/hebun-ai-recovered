/*
 * runtime-signals-surface.tsx — read-only Runtime & Signals inspection (Hebun UI Phase 22C).
 *
 * States what Hebun's runtime observes about itself: real observation sources with honest
 * connection states, and an honest surfaced-signals state (empty is valid). It renders NO
 * fabricated signal / alert / incident / event / failure / timestamp / count / provenance,
 * and keeps signal ≠ alert ≠ incident ≠ failure explicit. No acknowledge / resolve / restart
 * / retry / kill controls.
 *
 * Server component — no client state, no mutation affordance.
 */

import { Activity, Ban, Radio, ShieldOff } from "lucide-react";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getRuntimeSignalsModel,
  type RuntimeConnectionState,
} from "@/features/operations-runtime-signals";

const CONNECTION_META: Record<RuntimeConnectionState, { label: string; variant: BadgeVariant }> = {
  connected: { label: "Connected", variant: "success" },
  derived: { label: "Derived", variant: "info" },
  empty: { label: "Empty", variant: "neutral" },
  partial: { label: "Partial", variant: "warning" },
  unavailable: { label: "Unavailable", variant: "neutral" },
  "not-connected": { label: "Not connected", variant: "neutral" },
};

export function RuntimeSignalsSurface() {
  const model = getRuntimeSignalsModel();
  const observation = CONNECTION_META[model.observation.state];

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Observation state */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-start">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-sunken">
            <Radio className="size-4 text-fg-secondary" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-fg">Runtime observation</h2>
              <Badge variant={observation.variant}>{observation.label}</Badge>
            </div>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-fg-secondary">{model.observation.detail}</p>
          </div>
        </CardContent>
      </Card>

      {/* Runtime signal sources */}
      <Card>
        <CardHeader>
          <CardTitle>Runtime signal sources</CardTitle>
          <span className="text-xs text-fg-muted">The real observation layers, with their backing and honest connection state.</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {model.sources.map((source) => {
            const meta = CONNECTION_META[source.connection];
            return (
              <div key={source.source} className="flex flex-col gap-1 rounded-md border border-border bg-surface-sunken p-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="min-w-0 sm:w-56 sm:shrink-0">
                  <p className="text-sm font-semibold text-fg">{source.source}</p>
                  <p className="font-mono text-[0.7rem] text-fg-muted">{source.backing}</p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-fg-secondary">{source.authority}{source.derived ? " · derived" : ""}</p>
                  <p className="mt-0.5 text-[0.7rem] leading-5 text-fg-muted">{source.limitations}</p>
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Surfaced signals — honest empty */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-4 text-fg-muted" aria-hidden="true" />
            Surfaced signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border bg-surface-sunken p-4 text-sm text-fg-secondary">
            <Ban className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            {model.surfacedSignals.note}
          </div>
          <p className="mt-3 text-xs leading-5 text-fg-muted">{model.provenanceNote}</p>
        </CardContent>
      </Card>

      {/* Monitoring boundary */}
      <Card>
        <CardHeader>
          <CardTitle>Monitoring boundary</CardTitle>
          <span className="text-xs text-fg-muted">What a signal is — and is not.</span>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {model.monitoringBoundary.map((distinction) => (
            <div key={`${distinction.left}-${distinction.right}`} className="rounded-md border border-border bg-surface-sunken p-3">
              <p className="text-sm font-semibold text-fg">
                {distinction.left} <span className="text-fg-muted">≠</span> {distinction.right}
              </p>
              <p className="mt-0.5 text-xs leading-5 text-fg-muted">{distinction.note}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Runtime & Signals is read-only. It observes and explains runtime state; it never acknowledges, resolves, restarts, retries, kills, or executes anything.
      </p>
    </div>
  );
}
