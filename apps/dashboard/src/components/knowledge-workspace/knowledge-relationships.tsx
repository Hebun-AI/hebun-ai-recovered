import type { KnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { KnowledgeRegion, KnowledgeEmptyState } from "./knowledge-region";

/*
 * Relationships (Phase 9 §12) — how knowledge connects.
 *
 * A relationship graph is rendered ONLY where real entity + relationship data
 * exists. None is surfaced, so this region shows an honest empty state — never
 * random connected dots — and instead names the REAL typed relationships
 * (MemoryRelationshipType) that connect one memory to another.
 */

export function KnowledgeRelationships({ model }: { model: KnowledgeWorkspaceModel }) {
  return (
    <KnowledgeRegion variant="plain" eyebrow="How knowledge connects" title="Relationships">
      <div className="flex flex-col gap-3">
        <KnowledgeEmptyState
          title="No relationship graph available yet"
          detail="Relationships appear once admitted memories reference one another. None is surfaced, so no graph is drawn — the workspace does not render placeholder nodes."
        />
        <div>
          <p className="mb-2 text-[0.7rem] uppercase tracking-wide text-fg-muted">
            Relationship types the model recognizes
          </p>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {model.relationshipTypes.map((relationship) => (
              <li
                key={relationship.type}
                className="flex flex-col gap-0.5 rounded-lg border border-border bg-surface p-3"
              >
                <span className="text-sm font-medium text-fg">{relationship.label}</span>
                <span className="text-[0.7rem] leading-5 text-fg-muted">{relationship.describes}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </KnowledgeRegion>
  );
}
