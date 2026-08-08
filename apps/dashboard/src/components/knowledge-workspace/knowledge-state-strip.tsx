import type { KnowledgeWorkspaceModel } from "@/features/knowledge/workspace-model";
import { ReferenceMarker } from "./knowledge-region";
import { HebyWhy } from "@/components/command-center/heby-why";

/*
 * Knowledge State / Scope strip (Phase 9 §8) — a compact scan of honest structural
 * facts only.
 *
 * No knowledge source, admitted memory, or relationship is surfaced through a real
 * read model, so the strip states that plainly. NO invented Knowledge Score,
 * Trust %, Coverage %, or asset count — those would be synthetic.
 */

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="text-sm font-semibold tabular-nums text-fg">{value}</span>
      <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">{label}</span>
    </span>
  );
}

export function KnowledgeStateStrip({ model }: { model: KnowledgeWorkspaceModel }) {
  const connectedSources = model.sourceKinds.filter((kind) => kind.connected > 0).length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-border bg-surface-sunken px-4 py-2.5">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.7rem] uppercase tracking-wide text-fg-muted">Scope</span>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <span className="size-2 rounded-full bg-fg-muted" aria-hidden="true" />
          No sources connected
        </span>
      </span>

      <span className="hidden h-4 w-px bg-border sm:inline-block" aria-hidden="true" />

      <Cell label="Sources" value={`${connectedSources} connected`} />
      <Cell label="Admitted memory" value="None surfaced" />
      <Cell label="Relationships" value="None" />
      <Cell label="Provenance" value="Not populated" />

      <span className="ml-auto flex items-center gap-2">
        <span className="text-[0.7rem] text-fg-muted">Freshness unknown</span>
        <ReferenceMarker label="Reference" />
        <HebyWhy label="Why?" variant="icon" />
      </span>
    </div>
  );
}
