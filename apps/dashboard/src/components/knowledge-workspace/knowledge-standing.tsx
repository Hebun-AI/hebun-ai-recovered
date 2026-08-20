import { ProvenanceChip } from "@/components/ui/provenance-chip";
import type { KnowledgeListing } from "@/features/knowledge/contracts";
import type { CompanyUnderstandingResult } from "@/features/knowledge/company-understanding-read.server";

/*
 * knowledge-standing.tsx — Stage 1. The workspace's opening line of fact.
 *
 * ── WHY IT IS NOT A ROW OF KPI TILES ─────────────────────────────────────────
 *
 * Four big numbers in four boxes is how `/finance` presents mock revenue, and it is the single
 * device most likely to make a derived figure read as a record. This is a SENTENCE of facts: each
 * value keeps the word that qualifies it, and the whole line is stamped `Derived` because every
 * number in it is recomputed on read and stored nowhere.
 *
 * ── IT NEVER TURNS AN UNREADABLE SOURCE INTO A ZERO ──────────────────────────
 *
 * When a read did not answer, the corresponding fact is the words "could not be read", not "0".
 * A zero here would be a claim about the organization that Hebun is in no position to make — the
 * same rule the released mock-surface gate enforces on the Executive Overview.
 *
 * It computes over values the page has already read. No read of its own, no authority, no state.
 */

export function KnowledgeStanding({
  listing,
  understanding,
  persistenceConfigured,
}: {
  readonly listing: KnowledgeListing;
  readonly understanding: CompanyUnderstandingResult;
  readonly persistenceConfigured: boolean;
}) {
  const recordFact =
    listing.status === "read"
      ? `${listing.records.length} record${listing.records.length === 1 ? "" : "s"} in force${
          listing.truncated ? " on this page" : ""
        }`
      : "records could not be read";

  const coverageFact =
    understanding.status === "read"
      ? (() => {
          const { categories } = understanding.view;
          const covered = categories.filter((c) => c.state === "covered").length;
          return `${covered} of ${categories.length} declared areas covered`;
        })()
      : "coverage could not be derived";

  const persistenceFact = persistenceConfigured
    ? "durable persistence connected"
    : "durable persistence not configured";

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-border bg-surface-sunken px-4 py-2.5">
      <ProvenanceChip kind="derived" detail="recomputed on read" />
      <p className="min-w-0 text-meta text-fg-secondary">
        <span className="font-medium text-fg">{recordFact}</span>
        <span aria-hidden="true"> · </span>
        <span className="font-medium text-fg">{coverageFact}</span>
        <span aria-hidden="true"> · </span>
        <span>{persistenceFact}</span>
      </p>
    </div>
  );
}
