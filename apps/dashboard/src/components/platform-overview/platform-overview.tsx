/*
 * platform-overview.tsx — the authoritative Platform Overview truth surface (Hebun UI Phase 24B).
 *
 * States what platform capability exists and what is actually connected: an honest availability map
 * over the deterministic offline provider substrate, the authority boundary per concept, the provider
 * execution ladder (nothing past REGISTERED), and the advisory Heby profile. It also shows the REAL,
 * non-authoritative technical dependency availability from the Executive Overview. It renders NO
 * aggregate Platform health, uptime, latency, availability %, or connection, and NO mutation control.
 *
 * Server component — no client state, no mutation affordance.
 */

import Link from "next/link";
import { ArrowUpRight, Layers, PlugZap } from "lucide-react";
import { getPlatformOverviewModel, type PlatformAvailabilityState } from "@/features/platform-overview";
import type { PlatformDependencyView } from "@/features/platform/workspace-model";

const STATE_META: Record<PlatformAvailabilityState, { label: string; dot: string; text: string }> = {
  "contract-only": { label: "Contract only", dot: "bg-warning", text: "text-warning" },
  offline: { label: "Offline", dot: "bg-fg-muted", text: "text-fg-muted" },
  simulation: { label: "Simulation", dot: "bg-warning", text: "text-warning" },
  "not-connected": { label: "Not connected", dot: "bg-fg-muted", text: "text-fg-muted" },
  "in-memory": { label: "In-memory", dot: "bg-fg-muted", text: "text-fg-muted" },
  advisory: { label: "Advisory", dot: "bg-info", text: "text-info" },
  "external-authority": { label: "External authority", dot: "bg-info", text: "text-info" },
};

const DEP_STATE_DOT: Record<PlatformDependencyView["sourceState"], string> = {
  loading: "bg-fg-muted",
  ready: "bg-success",
  empty: "bg-fg-muted",
  unavailable: "bg-fg-muted",
  failed: "bg-error",
};

export function PlatformOverview({ dependencies }: { dependencies: readonly PlatformDependencyView[] }) {
  const model = getPlatformOverviewModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Layers className="size-4 text-primary" aria-hidden="true" />
        Platform describes and configures provider/model/tool capability — and states honestly that nothing is connected, live, or executing.
      </div>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-warning">
            {model.state.headline}
          </span>
          <h2 className="text-sm font-semibold text-fg">Platform availability &amp; authority</h2>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">{model.state.note}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-fg">Substrate availability</h2>
          <p className="text-[0.7rem] text-fg-muted">Authority owner and honest state per area — no fabricated health.</p>
        </div>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.availability.map((item) => {
            const meta = STATE_META[item.state];
            return (
              <li key={item.area} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex min-w-0 items-center gap-2 sm:w-56 sm:shrink-0">
                  <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-fg">{item.area}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.7rem] leading-5 text-fg-muted">{item.detail}</p>
                  <p className="mt-1 text-[0.7rem] text-fg-muted">
                    Owner: <span className="text-fg-secondary">{item.authorityOwner}</span> · Mutation: none
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className={`text-[0.7rem] font-medium uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
                  {item.href && (
                    <Link
                      href={item.href}
                      className="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-ring"
                    >
                      Open
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg">Provider execution boundary</h2>
          <p className="text-[0.7rem] text-fg-muted">Registered ≠ configured ≠ connected ≠ invokable ≠ authorized ≠ executed ≠ successful.</p>
          <ol className="flex flex-col gap-1.5">
            {model.executionBoundary.map((step) => (
              <li key={step.stage} className="flex items-start gap-2">
                <span className={`mt-1 size-1.5 shrink-0 rounded-full ${step.reached ? "bg-success" : "bg-fg-muted"}`} aria-hidden="true" />
                <p className="min-w-0 text-[0.7rem] leading-5 text-fg-muted">
                  <span className={`font-semibold uppercase tracking-wide ${step.reached ? "text-success" : "text-fg-secondary"}`}>{step.stage}</span>
                  {step.reached ? " · reached" : " · not reached"} — {step.note}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg">Authority boundaries</h2>
          <p className="text-[0.7rem] text-fg-muted">Platform configures capability; other workspaces own what it is not.</p>
          <ul className="flex flex-col divide-y divide-border/60">
            {model.authorityBoundaries.map((b) => (
              <li key={b.concept} className="flex flex-col gap-0.5 py-2">
                <p className="text-xs font-medium text-fg">{b.concept}</p>
                <p className="text-[0.7rem] leading-5 text-fg-muted">
                  Owner: <span className="text-fg-secondary">{b.owner}</span> — {b.note}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-fg">Technical dependency availability</h2>
          <p className="text-[0.7rem] text-fg-muted">Real, non-authoritative source state from the Executive Overview.</p>
        </div>
        {dependencies.length === 0 ? (
          <p className="text-xs text-fg-muted">No technical dependency section is available.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dependencies.map((dep) => (
              <li key={dep.sectionId} className="flex items-start gap-2 rounded-lg border border-border p-3">
                <span className={`mt-1 size-1.5 shrink-0 rounded-full ${DEP_STATE_DOT[dep.sourceState]}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-fg">{dep.label}</p>
                  <p className="text-[0.7rem] leading-5 text-fg-muted">{dep.describes}</p>
                  <p className="mt-0.5 text-[0.7rem] text-fg-secondary">{dep.sourceStateLabel}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Heby — {model.heby.mode} ({model.heby.state})</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-secondary">May inspect</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {model.heby.mayInspect.map((x) => (
                <li key={x} className="text-[0.7rem] leading-5 text-fg-muted">{x}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-fg-secondary">May not</p>
            <ul className="mt-1 flex flex-col gap-0.5">
              {model.heby.mayNot.map((x) => (
                <li key={x} className="text-[0.7rem] leading-5 text-fg-muted">{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <ul className="flex max-w-3xl flex-col gap-1">
        {model.distinctions.map((d) => (
          <li key={d} className="text-xs leading-5 text-fg-muted">— {d}</li>
        ))}
      </ul>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <PlugZap className="size-3.5" aria-hidden="true" />
        Platform is read-only here. It describes and configures capability; it never connects, invokes, authorizes, or executes.
      </p>
    </div>
  );
}
