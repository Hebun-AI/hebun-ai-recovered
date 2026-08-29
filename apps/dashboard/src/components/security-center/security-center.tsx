import { ShieldCheck, Sparkles } from "lucide-react";
import type { SecurityCenterModel } from "@/features/security-center";
import { describeSecurityBoundary } from "@/features/security-center";
import { SecurityRegion } from "./security-region";
import { SecurityCommandStrip } from "./security-command-strip";
import { SecurityAttention } from "./security-attention";
import { SecurityPipeline } from "./security-pipeline";
import { SecurityDomains } from "./security-domains";
import { SecurityDevice } from "./security-device";
import { SecuritySources } from "./security-sources";
import { SecurityObservation } from "./security-observation";
import { SecurityResponse } from "./security-response";
import { SecurityInvestigation } from "./security-investigation";
import { SecurityArchitecture } from "./security-architecture";

/*
 * Security Center — Hebun's Governance Level-2 security command surface (UI Phase 19 refinement).
 *
 * An enterprise security operating surface, not a SOC wall and not a settings page. It answers four
 * questions with clear visual hierarchy: what is the security state (command strip), what requires
 * attention (attention), what evidence/systems support the view (pipeline · domains · sources ·
 * device · architecture), and what can happen next (response & authority). Calm, evidence-first,
 * authority-aware. Every populated collection is honestly empty; every state carries a text label;
 * a single h1; semantic regions; no fabricated telemetry; red only for genuine restricted state.
 */

export function SecurityCenter({ model }: { model: SecurityCenterModel }) {
  const boundary = describeSecurityBoundary();
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <header className="flex flex-col gap-1">
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">Governance · Security Center</p>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-fg">
          <span className="flex size-7 items-center justify-center rounded-md bg-highlight/15 text-highlight">
            <ShieldCheck className="size-4" aria-hidden="true" />
          </span>
          Security Center
        </h1>
        <p className="max-w-3xl text-sm text-fg-secondary">
          What security state is real right now — the evidence behind it, what is uncertain, and where human authority is required.
        </p>
      </header>

      {/* L1 — state + attention */}
      <SecurityCommandStrip model={model} />
      <SecurityAttention model={model} />

      {/*
        L1b — the one connected evidence source (E2-2). It sits directly under attention because it
        is the only region on this page backed by real records, and evidence-first is the surface's
        stated hierarchy. It is NOT under "what requires attention": a recorded governed act is not
        a finding and requires nothing.
      */}
      <SecurityObservation model={model} />

      {/* L2 — how it works + coverage by domain */}
      <SecurityPipeline model={model} />
      <SecurityDomains model={model} />

      {/* L3 — evidence + endpoint, then response + investigation */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <SecuritySources model={model} className="lg:col-span-2" />
        <SecurityDevice model={model} />
      </div>
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <SecurityResponse model={model} className="lg:col-span-2" />
        <SecurityInvestigation model={model} />
      </div>

      {/* L4 — architecture + boundary */}
      <SecurityArchitecture model={model} />

      <SecurityRegion eyebrow="Who does what" title="Security Response Boundary">
        <ul className="flex flex-col gap-2">
          {boundary.map((row) => (
            <li key={row.actor} className="grid grid-cols-[9rem_1fr] gap-x-3 gap-y-0.5 sm:grid-cols-[11rem_1fr]">
              <span className="text-xs font-semibold text-fg">{row.actor}</span>
              <span className="text-[0.7rem] font-medium uppercase tracking-wide text-fg-muted">{row.role}</span>
              <span className="col-span-2 text-[0.7rem] leading-5 text-fg-secondary sm:col-start-2 sm:col-span-1">{row.describes}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 flex items-start gap-1.5 text-[0.7rem] leading-5 text-fg-muted">
          <Sparkles className="mt-0.5 size-3 shrink-0 text-highlight" aria-hidden="true" />
          Heby (top bar) can explain the security state, trace evidence, and assess uncertainty — advisory only. It never declares a breach, approves, executes, or controls a device.
        </p>
      </SecurityRegion>
    </div>
  );
}
