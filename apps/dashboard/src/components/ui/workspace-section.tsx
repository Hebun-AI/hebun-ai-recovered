import { cn } from "@/lib/utils";
import { ProvenanceChip, type Provenance } from "./provenance-chip";

/*
 * workspace-section.tsx — Stage 0. The section header an ordinary Hebun workspace is built from.
 *
 * ── THE GRAMMAR IT FIXES ─────────────────────────────────────────────────────
 *
 * A canonical Hebun section answers four things before its content: what it is, what question it
 * answers, WHERE ITS DATA CAME FROM, and — when it can be acted on — under whose authority. Today
 * every workspace improvises that: Command, Intelligence, Workforce and Decisions each carry their
 * own hand-built "scope strip", and Operations, Governance and Platform each carry their own
 * hand-built availability matrix. Four and three implementations of two ideas.
 *
 * ── WHY PROVENANCE IS A REQUIRED FIELD ───────────────────────────────────────
 *
 * `provenance` is not optional. A section that does not say where its data came from is exactly the
 * defect this program exists to remove: a derived count rendered with the visual weight of a
 * record, or seeded reference data rendered with the weight of an organization's own truth. Making
 * it required means a future section cannot be added without answering the question.
 *
 * ── AUTHORITY IS NOT PROVENANCE ──────────────────────────────────────────────
 *
 * `authority` is a separate, separately-optional field, and it names WHO MAY ACT — never who may
 * read. Knowledge authoring and Governance ratification are different authorities over the same
 * records; a section that merges them into one line would be the beginning of merging them in fact.
 * Where both apply they are stated as two sections, not one line with two words in it.
 *
 * Presentational and server-safe. It resolves nothing, reads nothing, and grants nothing.
 */

export function WorkspaceSection({
  title,
  question,
  provenance,
  provenanceDetail,
  authority,
  actions,
  children,
  className,
  id,
}: {
  readonly title: string;
  /** The question this section answers, in the reader's language. One sentence. */
  readonly question: string;
  /** Required. What kind of claim everything below is. */
  readonly provenance: Provenance;
  readonly provenanceDetail?: string;
  /** Who may ACT here. Omitted when the section is read-only. Never a read permission. */
  readonly authority?: string;
  readonly actions?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly id?: string;
}) {
  return (
    <section
      id={id}
      aria-label={title}
      className={cn("flex min-w-0 flex-col gap-3", className)}
    >
      <header className="flex min-w-0 flex-col gap-1.5 border-b border-border pb-2.5">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h2 className="min-w-0 text-title font-semibold text-fg">{title}</h2>
          {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
        </div>
        <p className="max-w-prose text-body text-fg-secondary text-pretty">{question}</p>
        {/*
          Provenance and authority sit on their own row, never opposite the title. That is the
          `/finance` lesson made structural: a `shrink-0` chip placed opposite a truncating heading
          takes the row and starves the heading — measured at 158.3px of a 197px row, leaving 11.9px
          for a title needing 93px. On its own row a chip can only ever cost its own height.
        */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ProvenanceChip kind={provenance} detail={provenanceDetail} />
          {authority ? (
            <span className="text-meta text-fg-muted">
              Acting here requires: <span className="font-medium text-fg-secondary">{authority}</span>
            </span>
          ) : null}
        </div>
      </header>
      {children}
    </section>
  );
}
