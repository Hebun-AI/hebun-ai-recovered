/*
 * infrastructure-settings-surface.tsx — the authoritative Infrastructure & Settings truth surface
 * (Hebun UI Phase 24C).
 *
 * States honest platform infrastructure truth: in-memory persistence, no durable configuration store,
 * no configured provider, no connected integration, external authentication authority, and a strict
 * secrets boundary. It replaces the fabricated Settings "API Keys: configured" rows. It renders NO
 * CPU/memory/uptime/region/node/latency/availability/deployment metric, NO secret value, and NO
 * secret-entry / key-rotation / credential-mutation control.
 *
 * Server component — no client state, no mutation affordance.
 */

import { Server, KeyRound, ShieldOff } from "lucide-react";
import { getInfrastructureModel, type InfraState } from "@/features/platform-infrastructure";

const STATE_META: Record<InfraState, { label: string; dot: string; text: string }> = {
  "contract-only": { label: "Contract only", dot: "bg-warning", text: "text-warning" },
  "in-memory": { label: "In-memory", dot: "bg-fg-muted", text: "text-fg-muted" },
  "not-connected": { label: "Not connected", dot: "bg-fg-muted", text: "text-fg-muted" },
  "external-authority": { label: "External authority", dot: "bg-info", text: "text-info" },
  structural: { label: "Structural", dot: "bg-info", text: "text-info" },
};

export function InfrastructureSettingsSurface() {
  const model = getInfrastructureModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Server className="size-4 text-primary" aria-hidden="true" />
        Platform runs in-memory with no durable configuration store — the honest technical state, not a dashboard of fake health.
      </div>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-warning">
            {model.state.headline}
          </span>
          <h2 className="text-sm font-semibold text-fg">Infrastructure &amp; settings</h2>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">{model.state.note}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-fg">Infrastructure state</h2>
          <p className="text-[0.7rem] text-fg-muted">Adapter registry: {model.adapterRegistryCount} registered (offline) · authority owner per area.</p>
        </div>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.areas.map((a) => {
            const meta = STATE_META[a.state];
            return (
              <li key={a.area} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex min-w-0 items-center gap-2 sm:w-52 sm:shrink-0">
                  <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-fg">{a.area}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] leading-5 text-fg-muted">{a.detail}</p>
                  <p className="mt-1 text-[0.7rem] text-fg-muted">Owner: <span className="text-fg-secondary">{a.authorityOwner}</span></p>
                </div>
                <span className={`shrink-0 text-[0.7rem] font-medium uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-center gap-2">
          <KeyRound className="size-4 text-fg-muted" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-fg">Secrets boundary</h2>
        </div>
        <p className="max-w-3xl text-[0.7rem] leading-5 text-fg-muted">{model.secretsBoundary}</p>
      </section>

      <ul className="flex max-w-3xl flex-col gap-1">
        {model.distinctions.map((d) => (
          <li key={d} className="text-xs leading-5 text-fg-muted">— {d}</li>
        ))}
      </ul>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Read-only. No secret value is shown and no configuration is mutable here. Authentication authority is external to Platform.
      </p>
    </div>
  );
}
