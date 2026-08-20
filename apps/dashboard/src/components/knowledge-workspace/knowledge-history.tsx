import { KnowledgeRegion, KnowledgeEmptyState } from "./knowledge-region";

/*
 * History / Change (Phase 9 §15).
 *
 * History is surfaced ONLY from real retained snapshots or versions. None is
 * retained, so no "Recent Changes" is synthesized from current state — no fake
 * timestamps, edits, or inferred change history. An admitted memory is never
 * mutated in place; a new record supersedes it, and history would be the chain of
 * those supersessions once retained.
 */

export function KnowledgeHistory() {
  return (
    <KnowledgeRegion variant="plain" eyebrow="What changed" title="History">
      <div className="flex flex-col gap-2">
        <KnowledgeEmptyState
          title="No retained history"
          detail="Change history appears once memory supersessions are retained. No history is retained, so none is shown — the workspace does not invent changes from current state."
          compact
        />
        <p className="text-meta leading-5 text-fg-muted">
          Memory is immutable: a record is never edited in place. A correction is a new record that supersedes
          the prior one, and history is the chain of those supersessions.
        </p>
      </div>
    </KnowledgeRegion>
  );
}
