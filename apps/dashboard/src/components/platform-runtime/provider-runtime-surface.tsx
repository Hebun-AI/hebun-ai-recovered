/*
 * provider-runtime-surface.tsx — the authoritative Provider Runtime truth surface (Hebun UI Phase 24C).
 *
 * Shows how far a provider invocation can actually progress: the offline runtime stages, the real
 * 13-step invocation pipeline (a descriptive contract), the real live-eligibility result (blocked),
 * and an honest-empty activity state. It renders NO fabricated request count, latency, token, cost,
 * success rate, receipt, or invocation health, and NO connect/invoke/execute control.
 *
 * Server component — no client state, no mutation affordance.
 */

import { Cpu, ShieldOff } from "lucide-react";
import { getProviderRuntimeModel, type RuntimeStageState } from "@/features/platform-runtime";

const STAGE_META: Record<RuntimeStageState, { label: string; dot: string; text: string }> = {
  "contract-only": { label: "Contract only", dot: "bg-warning", text: "text-warning" },
  simulation: { label: "Simulation", dot: "bg-warning", text: "text-warning" },
  "not-connected": { label: "Not connected", dot: "bg-fg-muted", text: "text-fg-muted" },
  "external-authority": { label: "External authority", dot: "bg-info", text: "text-info" },
};

export function ProviderRuntimeSurface() {
  const model = getProviderRuntimeModel();

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <div className="flex items-center gap-2 text-sm text-fg-secondary">
        <Cpu className="size-4 text-primary" aria-hidden="true" />
        The provider runtime machinery is real but offline — routing decides without dispatching, invocation prepares without invoking.
      </div>

      <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-warning/40 bg-warning/5 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-warning">
            {model.state.headline}
          </span>
          <h2 className="text-sm font-semibold text-fg">Provider runtime</h2>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-fg-muted">{model.state.note}</p>
      </section>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Runtime stages</h2>
        <ul className="flex flex-col divide-y divide-border/60 rounded-lg border border-border bg-surface">
          {model.stages.map((s) => {
            const meta = STAGE_META[s.state];
            return (
              <li key={s.stage} className="flex flex-col gap-1.5 p-3 sm:flex-row sm:items-start sm:gap-4">
                <div className="flex min-w-0 items-center gap-2 sm:w-48 sm:shrink-0">
                  <span className={`size-1.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden="true" />
                  <span className="truncate text-sm font-medium text-fg">{s.stage}</span>
                </div>
                <p className="min-w-0 flex-1 text-[0.7rem] leading-5 text-fg-muted">{s.note}</p>
                <span className={`shrink-0 text-[0.7rem] font-medium uppercase tracking-wide ${meta.text}`}>{meta.label}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
          <h2 className="text-sm font-semibold text-fg">Routing &amp; invocation truth</h2>
          <p className="text-[0.7rem] leading-5 text-fg-muted">{model.routingTruth}</p>
          <p className="text-[0.7rem] leading-5 text-fg-muted">{model.invocationTruth}</p>
          <p className="mt-1 text-[0.7rem] text-fg-muted">The invocation pipeline is a descriptive, deterministic contract of {model.pipeline.length} steps — none executes.</p>
          <ol className="mt-1 flex flex-col gap-1">
            {model.pipeline.map((step) => (
              <li key={step.order} className="text-[0.7rem] leading-5 text-fg-muted">
                <span className="text-fg-secondary">{step.order}. {step.label}</span> — {step.description}
              </li>
            ))}
          </ol>
        </section>

        <div className="flex min-w-0 flex-col gap-4">
          <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Live eligibility — {model.liveEligibility.provider}</h2>
            <p className="text-[0.7rem] text-fg-muted">
              Mode: <span className="text-fg-secondary">{model.liveEligibility.mode}</span> · Live eligible: <span className="text-fg-secondary">{model.liveEligibility.liveEligible ? "yes" : "no"}</span> · Credentials: <span className="text-fg-secondary">{model.liveEligibility.credentialStatus}</span>
            </p>
            {model.liveEligibility.blockingReasons.length > 0 && (
              <ul className="flex flex-col gap-0.5">
                {model.liveEligibility.blockingReasons.map((r) => (
                  <li key={r} className="text-[0.7rem] leading-5 text-fg-muted">— {r}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-surface p-4">
            <h2 className="text-sm font-semibold text-fg">Invocation activity</h2>
            <p className="text-2xl font-semibold text-fg">{model.activity.realInvocations}</p>
            <p className="text-[0.7rem] leading-5 text-fg-muted">{model.activity.note}</p>
          </section>
        </div>
      </div>

      <section className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-fg">Execution boundary</h2>
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

      <ul className="flex max-w-3xl flex-col gap-1">
        {model.distinctions.map((d) => (
          <li key={d} className="text-xs leading-5 text-fg-muted">— {d}</li>
        ))}
      </ul>

      <p className="flex items-center gap-2 text-xs text-fg-muted">
        <ShieldOff className="size-3.5" aria-hidden="true" />
        Read-only. Platform prepares and describes provider runtime; it never connects, invokes, or executes. Execution is Operations&rsquo; authority.
      </p>
    </div>
  );
}
