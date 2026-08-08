import type { IntelligenceWorkspaceModel } from "@/features/intelligence/workspace-model";
import { IntelligenceHeader } from "./intelligence-header";
import { IntelligenceStateStrip } from "./intelligence-state-strip";
import { EmergingIntelligence } from "./emerging-intelligence";
import { IntelligenceInspector } from "./intelligence-inspector";
import { CandidateTaxonomy } from "./candidate-taxonomy";
import { EvidenceSummary } from "./evidence-summary";
import { UncertaintySummary } from "./uncertainty-summary";
import { IntelligenceFlow } from "./intelligence-flow";
import { IntelligenceBoundary } from "./intelligence-boundary";

/*
 * Intelligence Workspace — the organizational intelligence analysis layer of Hebun
 * (UI Phase 8). It answers: what is the system observing, why might it matter, what
 * evidence supports it, and what remains uncertain? — distinct from Command's "what
 * needs the Director's attention now?".
 *
 * Composition (analytical canvas):
 *   Header (slim)
 *   State / Scope strip            — honest scan, real input-connection count
 *   Priority Intelligence (dominant) | Inspector (contextual lens)
 *   Signals / Patterns / Candidates — real candidate-kind taxonomy
 *   Evidence  |  Confidence & Uncertainty — grouped, honest
 *   Runtime Lifecycle              — explanatory process, not telemetry
 *   Advisory Only                  — authority boundary + drill-through
 *
 * Every populated region is honestly empty: the Runtime is contract-only here and
 * no candidate/evidence instance is surfaced. Nothing is fabricated. Ambient Heby
 * is provided by the shell (Phase 5); Intelligence never hosts the authority act.
 */

export function IntelligenceWorkspace({ model }: { model: IntelligenceWorkspaceModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <IntelligenceHeader />
      <IntelligenceStateStrip model={model} />

      {/* Emerging intelligence + contextual inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <EmergingIntelligence model={model} />
        </div>
        <div className="min-w-0">
          <IntelligenceInspector />
        </div>
      </div>

      <CandidateTaxonomy model={model} />

      {/* Evidence + interpretation, grouped */}
      <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
        <div className="min-w-0">
          <EvidenceSummary />
        </div>
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
          <UncertaintySummary model={model} />
        </div>
      </div>

      <IntelligenceFlow model={model} />
      <IntelligenceBoundary model={model} />
    </div>
  );
}
