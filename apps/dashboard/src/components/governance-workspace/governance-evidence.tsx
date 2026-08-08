import { ChevronRight } from "lucide-react";
import type { GovernanceWorkspaceModel } from "@/features/governance/workspace-model";
import { GovernanceRegion, GovernanceEmptyState } from "./governance-region";

/*
 * Evidence & Auditability (Phase 12 §27) — a governance state must be inspectable.
 *
 * When a governance decision is retained, it would carry its evidence, source,
 * reason, actor, time, and policy basis. No governance history is retained, so the
 * region is honestly empty — no fabricated audit events, evidence, actors, or
 * timestamps — and instead shows the REAL governance pipeline stages (inspect →
 * policy → resolve → validate → report), labelled as process, not live telemetry.
 */

export function GovernanceEvidence({ model }: { model: GovernanceWorkspaceModel }) {
  return (
    <GovernanceRegion variant="plain" eyebrow="What supports a governance state" title="Evidence & Auditability">
      <div className="flex flex-col gap-3">
        <GovernanceEmptyState
          title="No retained governance history available"
          detail="Governance evidence and audit records appear once decisions are retained. None is retained, so none is shown — the workspace invents no audit event, evidence, or actor."
          tone="blocked"
          compact
        />
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">
            How a governance decision is formed — process, not live telemetry
          </p>
          <ol className="flex flex-wrap items-stretch gap-1.5">
            {model.pipelineStages.map((stage, index) => (
              <li key={stage.stage} className="flex items-stretch gap-1.5">
                <div className="flex min-w-[7rem] flex-col gap-0.5 rounded-lg border border-border bg-surface-sunken px-2.5 py-2">
                  <span className="text-xs font-semibold text-fg">{stage.label}</span>
                  <span className="text-[0.62rem] leading-4 text-fg-muted">{stage.describes}</span>
                </div>
                {index < model.pipelineStages.length - 1 && (
                  <ChevronRight className="hidden size-4 shrink-0 self-center text-fg-muted sm:block" aria-hidden="true" />
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </GovernanceRegion>
  );
}
