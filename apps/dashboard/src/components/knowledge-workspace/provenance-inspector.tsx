import { MapPin, ShieldCheck, GitBranch, Gauge, History } from "lucide-react";
import type { KnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { KnowledgeRegion, ReferenceMarker } from "./knowledge-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Evidence & Provenance inspector (Phase 9 §13) — Knowledge is the primary home
 * for inspectable provenance.
 *
 * The provenance chain follows the five real metadata dimensions: Origin →
 * Authority → Provenance → Confidence → Lifecycle. With no memory selected (and
 * none surfaced to select), the inspector shows its honest instructional state and
 * never fabricates a source, attribution, or version. Intelligence and Command may
 * link here; this region invents no "Source 1 / Source 2".
 */

const DIMENSION_ICON = {
  origin: MapPin,
  authority: ShieldCheck,
  provenance: GitBranch,
  confidence: Gauge,
  lifecycle: History,
} as const;

export function ProvenanceInspector({ model }: { model: KnowledgeWorkspaceModel }) {
  return (
    <KnowledgeRegion
      eyebrow="Inspect"
      title="Evidence & Provenance"
      className="h-full"
      action={<ReferenceMarker label="Nothing selected" />}
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-5 text-fg-secondary">
          Select a memory to trace its provenance chain. Nothing is surfaced yet, so there is nothing to
          inspect — the inspector never fabricates a source or attribution to fill this space.
        </p>
        <ol className="flex flex-col gap-2">
          {model.metadataDimensions.map((dimension, index) => {
            const Icon = DIMENSION_ICON[dimension.dimension];
            return (
              <li key={dimension.dimension} className="flex items-start gap-2.5">
                <span className="flex flex-col items-center pt-0.5">
                  <Icon className="size-4 shrink-0 text-fg-muted" aria-hidden="true" />
                  {index < model.metadataDimensions.length - 1 && (
                    <span className="mt-1 h-4 w-px bg-border" aria-hidden="true" />
                  )}
                </span>
                <div className="min-w-0 pb-1">
                  <p className="text-sm font-medium text-fg">{dimension.label}</p>
                  <p className="text-meta leading-5 text-fg-muted">{dimension.describes}</p>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="flex items-center gap-2">
          <span className="text-meta uppercase tracking-wide text-fg-muted">How does provenance work?</span>
          <HebyWhy label="Ask Heby" variant="text" />
        </div>
      </div>
    </KnowledgeRegion>
  );
}
