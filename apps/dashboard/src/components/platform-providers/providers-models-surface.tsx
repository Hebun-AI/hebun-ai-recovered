/*
 * providers-models-surface.tsx — the authoritative Providers & Models truth surface (Hebun UI Phase 24B).
 *
 * Rebuilds the provider capability view on the REAL offline provider catalog. For each registered
 * provider it shows only proven facts (name, type, execution mode, declared capabilities, credential
 * status, connection state) — never the fabricated per-provider health, conformance score, aggregate
 * "Health %", or token/cost/latency estimate. The "future live" provider's blocked state comes from
 * the real eligibility engine. Structural capability coverage is shown as counts, not a health metric.
 *
 * Server component — no client state, no connect/configure/invoke/secret control.
 */

import { Boxes, ShieldAlert } from "lucide-react";
import { getProvidersModel } from "@/features/platform-providers";

const COVERAGE_META: Record<string, { text: string; dot: string }> = {
  covered: { text: "text-success", dot: "bg-success" },
  partial: { text: "text-warning", dot: "bg-warning" },
  missing: { text: "text-fg-muted", dot: "bg-fg-muted" },
};

export function ProvidersModelsSurface() {
  const model = getProvidersModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Boxes className="size-4 text-primary" aria-hidden="true" />
        Every provider is a registered offline descriptor — none is configured, connected, or invokable.
      </div>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-warning">
            {model.state.headline}
          </span>
          <h2 className="text-sm font-semibold text-fg">Provider &amp; model capability</h2>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">{model.state.note}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Registered providers</h2>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-border text-[0.7rem] uppercase tracking-wide text-fg-muted">
                <th className="py-2 pr-3 font-medium">Provider</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Execution mode</th>
                <th className="py-2 pr-3 font-medium">Connection</th>
                <th className="py-2 pr-3 font-medium">Credentials</th>
                <th className="py-2 pr-3 font-medium">Capabilities</th>
              </tr>
            </thead>
            <tbody>
              {model.providers.map((p) => (
                <tr key={p.id} className="border-b border-border/60 align-top">
                  <td className="py-2.5 pr-3">
                    <div className="text-sm font-medium text-fg">{p.name}</div>
                    <div className="text-[0.7rem] text-fg-muted">{p.family} · {p.priority}</div>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-fg-secondary">{p.providerType}</td>
                  <td className="py-2.5 pr-3 text-xs text-fg-secondary">{p.executionMode}</td>
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-fg-muted">
                      <span className="size-1.5 rounded-full bg-fg-muted" aria-hidden="true" />
                      {p.connectionState}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-xs text-fg-secondary">{p.credentialStatus}</td>
                  <td className="py-2.5 pr-3">
                    <div className="flex flex-wrap gap-1">
                      {p.primaryCapabilities.map((c) => (
                        <span key={c} className="rounded bg-surface-sunken px-1.5 py-0.5 text-[0.65rem] text-fg-secondary">{c}</span>
                      ))}
                      {p.secondaryCapabilities.map((c) => (
                        <span key={c} className="rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-fg-muted">{c}</span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[0.7rem] text-fg-muted">Live support is false across the catalog — no provider is connected and no live model is loaded.</p>
      </section>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="size-4 text-warning" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-fg">{model.futureLive.name} — future live provider</h2>
          <span className="inline-flex items-center rounded-md bg-fg-muted/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-fg-muted">
            {model.futureLive.mode}
          </span>
        </div>
        <p className="max-w-3xl text-[0.7rem] leading-5 text-fg-muted">{model.futureLive.note}</p>
        <p className="text-[0.7rem] text-fg-muted">
          Live eligible: <span className="text-fg-secondary">{model.futureLive.liveEligible ? "yes" : "no"}</span> · Credentials: <span className="text-fg-secondary">{model.futureLive.credentialStatus}</span>
        </p>
        {model.futureLive.blockingReasons.length > 0 && (
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-secondary">Blocked because</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {model.futureLive.blockingReasons.map((r) => (
                <li key={r} className="text-[0.7rem] leading-5 text-fg-muted">— {r}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-fg">Capability coverage</h2>
          <p className="text-[0.7rem] text-fg-muted">
            {model.coverage.covered} covered · {model.coverage.partial} partial · {model.coverage.missing} missing of {model.coverage.total} — structural, not health.
          </p>
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {model.capabilityCoverage.map((c) => {
            const meta = COVERAGE_META[c.status];
            return (
              <li key={c.capability} className="flex items-start gap-2 rounded-lg border border-border p-2.5">
                <span className={`mt-1 size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-fg">
                    {c.capability} <span className={`text-[0.7rem] uppercase ${meta.text}`}>{c.status}</span>
                  </p>
                  <p className="text-[0.7rem] leading-5 text-fg-muted">{c.note}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Future providers required</h2>
        <p className="text-[0.7rem] text-fg-muted">Business domains with no provider in the network yet.</p>
        <div className="flex flex-wrap gap-1.5">
          {model.futureDomains.map((f) => (
            <span key={f.domain} className="rounded border border-dashed border-border px-2 py-0.5 text-[0.7rem] text-fg-muted" title={f.note}>
              {f.domain}
            </span>
          ))}
        </div>
      </section>

      <ul className="flex max-w-3xl flex-col gap-1">
        {model.distinctions.map((d) => (
          <li key={d} className="text-xs leading-5 text-fg-muted">— {d}</li>
        ))}
      </ul>
    </div>
  );
}
