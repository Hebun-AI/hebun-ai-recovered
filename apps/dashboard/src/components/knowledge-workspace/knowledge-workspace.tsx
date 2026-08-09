import type { KnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { KnowledgeHeader } from "./knowledge-header";
import { KnowledgeStateStrip } from "./knowledge-state-strip";
import { KnowledgeAvailability } from "./knowledge-availability";
import { KnowledgeSources } from "./knowledge-sources";
import { ProvenanceInspector } from "./provenance-inspector";
import { CompanyMemory } from "./company-memory";
import { KnowledgeRelationships } from "./knowledge-relationships";
import { ClassificationAccess } from "./classification-access";
import { KnowledgeHistory } from "./knowledge-history";
import { KnowledgeBoundary } from "./knowledge-boundary";

/*
 * Knowledge & Memory Workspace — the organization's inspectable information
 * substrate (UI Phase 9). It answers: what does the organization know, where did
 * it come from, how is it connected, what context is retained, and what evidence
 * can be inspected? — grounded and source-driven, distinct from Intelligence's
 * analytical, emerging character.
 *
 * Composition:
 *   Header (slim)
 *   State / Scope strip          — honest structural scan
 *   Sources (primary) | Evidence & Provenance inspector
 *   Company Memory               — the real five-dimension memory model
 *   Relationships | Classification & Access
 *   History                      — honest empty
 *   Settled Reference boundary   — drill-through, no duplication
 *
 * Built ONLY on real Enterprise Memory vocabulary; every populated surface is
 * honestly empty because no memory record, source, graph, or history is surfaced.
 * No synthetic data, no model call, no authority act. Ambient Heby is provided by
 * the shell (Phase 5).
 */

export function KnowledgeWorkspace({ model }: { model: KnowledgeWorkspaceModel }) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
      <KnowledgeHeader />
      <KnowledgeStateStrip model={model} />
      <KnowledgeAvailability model={model} />

      {/* Sources + provenance inspector */}
      <div className="grid min-w-0 gap-4 lg:grid-cols-3">
        <div className="min-w-0 lg:col-span-2">
          <KnowledgeSources model={model} />
        </div>
        <div className="min-w-0">
          <ProvenanceInspector model={model} />
        </div>
      </div>

      <CompanyMemory model={model} />

      {/* Relationships + governance, grouped */}
      <div className="grid min-w-0 gap-x-6 gap-y-4 rounded-xl border border-border bg-surface p-4 lg:grid-cols-2">
        <div className="min-w-0">
          <KnowledgeRelationships model={model} />
        </div>
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-6">
          <ClassificationAccess model={model} />
        </div>
      </div>

      <KnowledgeHistory />
      <KnowledgeBoundary />
    </div>
  );
}
