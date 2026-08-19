/*
 * heby-source-evidence.tsx — the G7 Evidence Surface: what a Heby answer cited OUTSIDE Knowledge.
 *
 * ── WHAT THIS IS FOR ────────────────────────────────────────────────────────
 *
 * G6C connected Heby to its tenant's own Governance record through a read-only boundary. G6D made
 * the citation durable: one row per cited record, per answer, carrying the label and the one derived
 * detail the reader saw, plus the STANDING the answering class asserted at that moment.
 *
 * Until G7 none of that was visible. The turn renderer had a field for Knowledge evidence and a
 * bare `sourceClass · recordRef` fallback, and nothing else — so an answer grounded on the
 * organization's own constitutional record displayed a reference string, and a RELOADED one
 * displayed "evidence details were not retained" while the rows sat unread. This file is the
 * reader's view of those rows.
 *
 * ── THE ONE DISTINCTION THIS PANEL EXISTS TO MAKE ───────────────────────────
 *
 * AUTHORITATIVE and DERIVED are rendered as two different things, in words, above the records they
 * apply to. That is the whole point of the surface:
 *
 *   AUTHORITATIVE  the class that resolved these records OWNS them. `decision_records` IS the
 *                  tenant's Governance record; it is not a summary of something else.
 *   DERIVED        the class handed over a read model built from something it does not own.
 *
 * The standing is the one SNAPSHOTTED AT ANSWER TIME and is never re-derived. A delegation granted
 * since must not appear inside an answer that never saw it, and flattening a mixed answer to
 * whichever standing is more flattering would be the specific lie G6D's per-group column prevents.
 * Each group therefore carries its own, and a mixed answer renders as two groups saying two
 * different things.
 *
 * ── WHAT IT REFUSES TO DO ───────────────────────────────────────────────────
 *
 * Nothing is computed here, nothing is inferred, and no sentence is generated: the copy is FIXED
 * TEXT arranged around stored values. There is no score, confidence, freshness, ratification or
 * quality figure — none of those exist in the record and inventing one beside a Governance decision
 * would be a verdict on the organization's own constitution.
 *
 * It renders `recordRef` as TEXT, never as a link. G6D deliberately gave the reference no foreign
 * key so answer history survives whatever the authority does next; a link would quietly turn a
 * historical reference back into a current-state claim, and could dangle.
 *
 * `authoritative` is NOT a claim that the record is correct. It says who owns it. K4 settled the
 * deeper form of this: ratified is not true.
 *
 * Presentation only. No fetch, no state, no authority, no database id rendered as a link.
 */

import type { HebySourceEvidenceGroup } from "@/features/heby-runtime";

/**
 * The source class, printed as the record's own vocabulary rather than a friendly label.
 *
 * R7.1 settled this for `audit_log.action` and it holds here: mapping `governance` to something
 * warmer, or grouping classes into categories, would assert a taxonomy no authority published.
 */
function ClassName({ sourceClass }: { readonly sourceClass: string }) {
  return (
    <span className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-fg-secondary">
      {sourceClass}
    </span>
  );
}

/**
 * The standing chip. Two states, two sentences, and deliberately not one badge with two colours:
 * a reader who cannot see colour must still get the distinction, so the words carry it.
 */
/**
 * The standing.
 *
 * G7 took the box off it. It was a bordered chip inside a bordered card on a filled panel — the
 * visual grammar of a dashboard widget dropped onto a spatial canvas. The distinction it carries is
 * far too important to be decoration, so it is now carried by the two things that survive any
 * theme: a WORD, and a lit marker for the authority that is absent for the derived read.
 *
 * The words are the mechanism, not the colour. A reader who cannot see the marker still gets it.
 */
function Standing({ authoritative }: { readonly authoritative: boolean }) {
  return (
    <span
      data-heby-source-standing={authoritative ? "authoritative" : "derived"}
      className={`inline-flex items-center gap-1.5 text-[0.64rem] font-medium tracking-wide ${
        authoritative ? "text-highlight" : "text-fg-muted"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-1 rounded-full ${authoritative ? "bg-highlight" : "bg-fg-muted/50"}`}
      />
      {authoritative ? "authoritative organizational record" : "derived read model"}
    </span>
  );
}

/**
 * One source class's citations.
 *
 * No card, no fill, no rounded panel. Structure comes from a single hairline running down the left
 * — brighter for the authority than for the derived read — plus spacing and type, which is the same
 * grammar Heby's own turns already use in the transcript beside it. The evidence therefore reads as
 * part of the answer rather than as a widget attached to it.
 */
function Group({ group }: { readonly group: HebySourceEvidenceGroup }) {
  return (
    <li
      className={`border-l pl-3.5 ${group.authoritative ? "border-highlight/35" : "border-border"}`}
      data-heby-source-group={group.sourceClass}
    >
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <ClassName sourceClass={group.sourceClass} />
        <Standing authoritative={group.authoritative} />
      </div>

      <ul className="mt-1.5 flex flex-col gap-2">
        {group.items.map((item) => (
          <li key={item.recordRef} data-heby-source-item="">
            <p className="text-[0.8rem] font-medium leading-5 text-fg">{item.label}</p>
            <p className="mt-0.5 text-[0.74rem] leading-5 text-fg-secondary">{item.detail}</p>
            {/*
              The reference the owning authority itself uses, as plain text. Shown because a reader
              checking this answer against the record needs to know WHICH record — and not linked,
              for the reasons in this file's header.
            */}
            <p className="mt-0.5 font-mono text-[0.62rem] leading-4 text-fg-muted/80">{item.recordRef}</p>
          </li>
        ))}
      </ul>
    </li>
  );
}

/**
 * The panel.
 *
 * `historical` frames a preserved snapshot so it is never read as a current-state claim — the same
 * frame the Knowledge panel uses, and needed here for a stronger reason: these records belong to
 * authorities that may have moved on, and the reference deliberately cannot be resolved forward.
 */
export function HebySourceEvidencePanel({
  groups,
  historical = false,
}: {
  readonly groups: readonly HebySourceEvidenceGroup[];
  readonly historical?: boolean;
}) {
  if (groups.length === 0) return null;

  return (
    <div
      className="mt-1.5"
      data-heby-source-evidence=""
      {...(historical ? { "data-heby-source-evidence-historical": "" } : {})}
    >
      {historical ? (
        <p
          className="mb-1.5 text-[0.64rem] leading-4 text-fg-muted"
          data-heby-source-historical-notice=""
        >
          Recorded with this answer, as these records stood at the time. They may have changed since,
          and Hebun does not re-read them to check.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3.5">
        {groups.map((group) => (
          <Group key={group.sourceClass} group={group} />
        ))}
      </ul>

      <p className="mt-3 max-w-[34rem] text-[0.64rem] leading-4 text-fg-muted/80">
        A record being authoritative means the source that resolved it owns it. It is not a statement
        that the record is correct, current, or agreed with by anything else.
      </p>
    </div>
  );
}
