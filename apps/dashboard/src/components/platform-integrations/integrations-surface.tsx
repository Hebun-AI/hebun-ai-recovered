/*
 * integrations-surface.tsx — the authoritative Integrations truth surface (Hebun UI Phase 24C).
 *
 * States honestly that no integration is connected. It lists the offline provider descriptors that
 * could back an integration (repository / communication / browser), each "not connected", and shows an
 * empty connected list. It excludes the integrations mock (fabricated connection/sync/scope/event
 * state) and offers NO connect / authenticate / OAuth / sync / secret control.
 *
 * Server component — no client state, no mutation affordance.
 */

import { Plug, ShieldOff } from "lucide-react";
import { getIntegrationsModel } from "@/features/platform-integrations";

export function IntegrationsSurface() {
  const model = getIntegrationsModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Plug className="size-4 text-primary" aria-hidden="true" />
        No external integration is connected or authenticated — only offline provider descriptors exist.
      </div>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-warning">
            {model.state.headline}
          </span>
          <h2 className="text-sm font-semibold text-fg">Integrations</h2>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">{model.state.note}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Connected integrations</h2>
        {model.connected.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-fg-muted">
            None. No integration is authenticated or connected.
          </p>
        ) : null}
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Integration-capable descriptors</h2>
        <p className="text-[0.7rem] text-fg-muted">Offline provider descriptors that could back an integration. A descriptor is not a connection.</p>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.candidates.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="flex min-w-0 items-center gap-2 sm:w-44 sm:shrink-0">
                <span className="size-1.5 shrink-0 rounded-full bg-fg-muted" aria-hidden="true" />
                <span className="truncate text-sm font-medium text-fg">{c.name}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[0.7rem] text-fg-secondary">{c.providerType}</p>
                <p className="text-[0.7rem] leading-5 text-fg-muted">{c.note}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">{c.connectionState}</p>
                <p className="text-[0.7rem] text-fg-muted">Credentials: {c.credentialStatus}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <ul className="flex max-w-3xl flex-col gap-1">
        {model.distinctions.map((d) => (
          <li key={d} className="text-xs leading-5 text-fg-muted">— {d}</li>
        ))}
      </ul>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Read-only. No connect, authenticate, OAuth, sync, or secret control — nothing is connected here.
      </p>
    </div>
  );
}
