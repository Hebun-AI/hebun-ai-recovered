import type { SecurityCenterModel } from "@/features/security-center";
import { SecurityRegion } from "./security-region";

/*
 * Security Architecture (UI refinement) — Hebun's real security ownership flow, using real system
 * names: Technical State (Platform/Operations) → Security Intelligence (Security Center) →
 * Governance & Decisions → Phase 17 Action Layer → Phase 18 Device/Tool Runtime → Receipt/Audit.
 * No fake animated network, agent swarm, or "AI orchestrator online" — a static, honest map.
 */

export function SecurityArchitecture({ model }: { model: SecurityCenterModel }) {
  return (
    <SecurityRegion eyebrow="How security flows through Hebun" title="Security Architecture">
      <ol className="flex flex-col gap-0">
        {model.architecture.map((layer, i) => (
          <li key={layer.layer} className="flex flex-col">
            <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-sunken p-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <span className="text-sm font-semibold text-fg">{layer.layer}</span>
                <span className="ml-2 text-[0.65rem] font-medium uppercase tracking-wide text-highlight">{layer.owner}</span>
              </div>
              <p className="min-w-0 max-w-xl text-[0.7rem] leading-5 text-fg-secondary sm:text-right">{layer.describes}</p>
            </div>
            {i < model.architecture.length - 1 && (
              <div className="flex items-center gap-2 py-1 pl-3 text-[0.6rem] uppercase tracking-wider text-fg-muted">
                <span aria-hidden="true">↓</span>
                {layer.flowLabel && <span>{layer.flowLabel}</span>}
              </div>
            )}
          </li>
        ))}
      </ol>
    </SecurityRegion>
  );
}
