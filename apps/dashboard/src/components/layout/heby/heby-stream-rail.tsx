/*
 * heby-stream-rail.tsx — "Hebun Akışı", the Heby canvas's contextual rail (G7).
 *
 * ── IT IS A SURFACE, NOT A SOURCE OF TRUTH ──────────────────────────────────
 *
 * It renders what `@/features/heby-stream` projected from a read the server already performed. It
 * holds no state, fetches nothing, computes nothing, and cannot produce an entry that has no row
 * behind it — the projection has no branch that would let it.
 *
 * ── WHAT IT DELIBERATELY IS NOT ─────────────────────────────────────────────
 *
 * It is not navigation. The reference concept's rail sits where a second nav would, and the Hebun
 * shell already owns navigation; this is an `<aside>` with a list of records, and the workspace
 * ships no `<nav>` of its own.
 *
 * It is not a status board. There is no health, no online state, no count of anything, no progress,
 * no "live" indicator and no pulsing dot — the reference has one, and no read seam in this
 * repository could make it true.
 *
 * It is not a timeline of the organization. It shows the decisions Hebun is holding for a human.
 * Four of the five entry types the reference depicts have no read seam at all, and the fifth
 * (recorded governance activity) exists only as a tally, which is not an event and is not shown
 * here as one.
 *
 * ── EMPTY IS A REAL ANSWER, AND SO IS UNAVAILABLE ───────────────────────────
 *
 * "You have nothing awaiting a decision" and "Hebun could not read them" are different facts and
 * get different sentences. Neither is a claim that nothing happened in the organization — Hebun
 * would have no way to know that.
 *
 * Pure presentation. Every value is a prop.
 */

import Link from "next/link";
import { ChevronsLeft } from "lucide-react";
import { formatStreamInstant, type HebyStreamItem, type HebyStreamState } from "@/features/heby-stream";

function Item({ item, depth }: { readonly item: HebyStreamItem; readonly depth: number }) {
  return (
    <li data-heby-stream-item={item.kind} className="relative pl-10">
      {/*
        The marker. A ring on the spine, decorative and static, and DELIBERATELY IDENTICAL FOR EVERY
        ROW. The reference gives each entry its own icon and its own colour, which is a
        classification — of a document, an approval, an analysis, a task, a signal. No authority in
        this product published any such classification, and there is exactly one kind of record
        here, so one neutral marker is the whole truth.
      */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-1 flex size-7 items-center justify-center rounded-full border border-highlight/25 bg-surface/60"
      >
        <span className="size-1.5 rounded-full bg-highlight/70" />
      </span>
      <Link
        href={item.href}
        /*
         * `depth` is the row's POSITION in a list the projection already ordered — nothing more. It
         * spends a little contrast on rows further down so the column reads as a spine with a
         * front and a back, exactly as the reference does. It is not a ranking, not an age, not an
         * importance and not a state: the row's own words and its own timestamp are unchanged, and
         * the floor is high enough that every row stays legible.
         */
        style={depth > 2 ? { opacity: 0.82 } : undefined}
        className="block rounded-xl border border-border/50 bg-surface/30 px-3 py-2.5 transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        {/*
          The label WRAPS rather than truncating. It is the record's own name — an action kind or a
          recipient — and a reader deciding whether to open it needs the whole thing. Clipping it to
          fit a column would hide exactly the part that distinguishes one pending decision from
          another.
        */}
        {/*
          Label and instant share the top line, with the instant right-aligned, as in the reference.
          The label still WRAPS rather than truncating — it is the record's own name, and a reader
          deciding whether to open it needs the whole thing — so the instant is kept on its own
          shrink-proof column instead of competing for the same run of text.
        */}
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 text-[0.8rem] font-medium leading-5 text-fg">{item.label}</p>
          <time dateTime={item.at} className="shrink-0 text-[0.62rem] leading-5 tabular-nums text-fg-muted">
            {formatStreamInstant(item.at)}
          </time>
        </div>
        <p className="mt-0.5 text-[0.72rem] leading-5 text-fg-secondary">{item.detail}</p>
        <p className="mt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
          {/*
            The one thing that is certainly true about this row: a human still has to decide.
            It is not a classification of the record — it is the queue the record is in.
          */}
          awaiting a decision
        </p>
      </Link>
    </li>
  );
}

export function HebyStreamRail({ stream }: { readonly stream: HebyStreamState }) {
  return (
    <aside
      aria-label="Hebun Akışı"
      data-heby-stream-rail={stream.status}
      className="flex h-full min-h-0 w-full flex-col gap-4 overflow-y-auto rounded-3xl border border-border/45 bg-surface/25 p-5 backdrop-blur-[2px]"
    >
      <div className="shrink-0">
        <h2 className="text-[0.74rem] font-semibold uppercase tracking-[0.2em] text-highlight/85">
          Hebun Akışı
        </h2>
        {/*
          The subtitle states the rail's SCOPE, so a sparse list is understood as a narrow one
          rather than as a claim that the organization is idle.
        */}
        <p className="mt-1 text-[0.68rem] leading-5 text-fg-muted">
          What Hebun is holding for a human decision.
        </p>
      </div>

      {stream.status === "items" ? (
        /*
          The spine. One decorative hairline behind the markers, so the column reads as a single
          vertical run rather than a stack of cards. It is a border on a list, not a timeline: it
          measures nothing, spans nothing but the rows that exist, and disappears with them.
        */
        <ul className="relative flex min-h-0 flex-col gap-3 before:absolute before:bottom-3 before:left-[0.84rem] before:top-3 before:w-px before:bg-highlight/15 before:content-['']">
          {stream.items.map((item, index) => (
            <Item key={item.key} item={item} depth={index} />
          ))}
        </ul>
      ) : stream.status === "empty" ? (
        <p className="text-[0.72rem] leading-5 text-fg-muted" data-heby-stream-empty="">
          Nothing is waiting on a decision. This is what Hebun has recorded — it is not a statement
          about what your organization has been doing.
        </p>
      ) : (
        <p className="text-[0.72rem] leading-5 text-fg-muted" data-heby-stream-unavailable="">
          This could not be read right now ({stream.reason}). Nothing is being hidden and nothing is
          being guessed.
        </p>
      )}
    </aside>
  );
}

/**
 * The rail put away: a 40px strip carrying the control that brings it back.
 *
 * IT LIVES HERE, BESIDE THE FULL-SIZE RAIL, ON PURPOSE. The one thing the collapsed state must not
 * lose is the difference between "nothing is waiting" and "this could not be read", and that
 * difference is this file's whole responsibility. Keeping the strip in the canvas meant the two
 * sentences and their 40px counterpart were written in different files and could drift apart; here
 * they cannot, and the strip is provable on its own.
 *
 * Pure presentation. Every value is a prop, and putting the rail away reads nothing, marks nothing
 * and asserts nothing about the records.
 */
export function HebyStreamRailStrip({
  stream,
  onShow,
}: {
  readonly stream: HebyStreamState;
  readonly onShow: () => void;
}) {
  const unavailable = stream.status === "unavailable";
  return (
    <div className="flex h-full w-10 flex-col items-center gap-2 pt-1">
      <button
        type="button"
        aria-label={unavailable ? "Show Hebun Akışı — it could not be read" : "Show Hebun Akışı"}
        aria-expanded={false}
        data-heby-rail-show=""
        data-heby-rail-collapsed={stream.status}
        onClick={onShow}
        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border/60 text-fg-muted transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:text-highlight focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        <ChevronsLeft className="size-4" aria-hidden="true" />
      </button>
      {/*
        A COLLAPSED RAIL WHOSE READ FAILED SAYS SO, IN WORDS, WHILE COLLAPSED. Collapsing an
        unavailable read into the same silent strip an empty one gets would present a failure as an
        empty queue — the exact confusion the two full-size sentences exist to prevent. It states the
        failure and nothing more: no count, no reason to guess at, and no claim about the
        organization.
      */}
      {unavailable ? (
        <p
          data-heby-rail-unavailable=""
          className="heby-rail-vertical select-none text-[0.6rem] font-medium uppercase tracking-[0.14em] text-fg-muted"
        >
          Could not be read
        </p>
      ) : null}
    </div>
  );
}
