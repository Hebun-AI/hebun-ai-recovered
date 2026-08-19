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
import { formatStreamInstant, type HebyStreamItem, type HebyStreamState } from "@/features/heby-stream";

function Item({ item }: { readonly item: HebyStreamItem }) {
  return (
    <li data-heby-stream-item={item.kind} className="relative pl-5">
      {/*
        The connector. Decorative, and static: a moving or coloured-by-type marker would imply a
        classification of the record that no authority published.
      */}
      <span
        aria-hidden="true"
        className="absolute left-0 top-[0.45rem] size-1.5 rounded-full bg-highlight/60"
      />
      <Link
        href={item.href}
        className="block rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 transition-colors duration-(--dur-fast) hover:border-highlight/40 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-highlight"
      >
        {/*
          The label WRAPS rather than truncating. It is the record's own name — an action kind or a
          recipient — and a reader deciding whether to open it needs the whole thing. Clipping it to
          fit a column would hide exactly the part that distinguishes one pending decision from
          another.
        */}
        <p className="text-[0.8rem] font-medium leading-5 text-fg">{item.label}</p>
        <p className="mt-0.5 text-[0.72rem] leading-5 text-fg-secondary">{item.detail}</p>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-fg-muted">
            {/*
              The one thing that is certainly true about this row: a human still has to decide.
              It is not a classification of the record — it is the queue the record is in.
            */}
            awaiting a decision
          </p>
          <time dateTime={item.at} className="text-[0.62rem] tabular-nums text-fg-muted">
            {formatStreamInstant(item.at)}
          </time>
        </div>
      </Link>
    </li>
  );
}

export function HebyStreamRail({ stream }: { readonly stream: HebyStreamState }) {
  return (
    <aside
      aria-label="Hebun Akışı"
      data-heby-stream-rail={stream.status}
      className="flex h-full min-h-0 w-full flex-col gap-3 overflow-y-auto rounded-2xl border border-border/60 bg-surface/25 p-4"
    >
      <div className="shrink-0">
        <h2 className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-fg-secondary">
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
        <ul className="flex min-h-0 flex-col gap-2.5">
          {stream.items.map((item) => (
            <Item key={item.key} item={item} />
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
