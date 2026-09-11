/*
 * observation-coverage.tsx — how much evidence stands behind everything above.
 *
 * ── WHY THIS IS NOT A VANITY PANEL ──────────────────────────────────────────
 *
 * Every other number on this surface is a claim about the outside world. This one is a claim about
 * HEBUN: how many times it has actually looked, and when it last did. It is the question a reader
 * has before trusting any of the others — a follower count from an observation eight days old and
 * one from this morning are different kinds of fact, and nothing else on the page says which you
 * are looking at across all three capabilities at once.
 *
 * Every figure is counted from the reads this page already performed. Nothing is estimated, nothing
 * is projected, and a read that FAILED reports as unknown rather than as a coverage of zero —
 * "Hebun has observed this nothing times" and "Hebun could not check" are different sentences.
 *
 * ── IT IS A TABLE BECAUSE IT IS TABULAR ─────────────────────────────────────
 *
 * Three rows of the same four facts. A grid of cards would cost more space to say less, and would
 * lose the row/column relationship that lets a screen reader announce "YouTube channel, 4
 * observations" instead of four unlabelled numbers.
 *
 * Server component.
 */
import type { SocialCoverageRow } from "@/features/social-intelligence/dashboard-model";

const FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function instant(iso: string | null): string {
  if (iso === null) return "—";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : `${FORMAT.format(parsed)} UTC`;
}

export function ObservationCoverage({ rows }: { readonly rows: readonly SocialCoverageRow[] }) {
  return (
    /*
      THE SCROLL CONTAINER IS THE TABLE'S OWN. A four-column table of timestamps cannot narrow past
      a point, and the alternative to scrolling it here is the whole page scrolling sideways.
    */
    <div className="min-w-0 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">
          Stored provider observations per capability — how many, and over what period.
        </caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className="px-4 py-2.5 text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Capability
            </th>
            <th scope="col" className="px-4 py-2.5 text-right text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Observations
            </th>
            <th scope="col" className="px-4 py-2.5 text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">
              First
            </th>
            <th scope="col" className="px-4 py-2.5 text-label font-semibold uppercase tracking-[0.12em] text-fg-muted">
              Latest
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-border last:border-b-0">
              <th scope="row" className="px-4 py-2.5 text-meta font-medium text-fg">
                {row.label}
              </th>
              {row.known ? (
                <>
                  <td className="px-4 py-2.5 text-right text-meta font-semibold text-fg tabular-nums">
                    {row.observations}
                  </td>
                  <td className="px-4 py-2.5 text-meta text-fg-secondary">{instant(row.firstObservedAt)}</td>
                  <td className="px-4 py-2.5 text-meta text-fg-secondary">{instant(row.latestObservedAt)}</td>
                </>
              ) : (
                /*
                  A FAILED READ SPANS THE ROW rather than filling three cells with dashes. Three
                  dashes read as three absent facts; one sentence reads as one unanswered question,
                  which is what actually happened.
                */
                <td colSpan={3} className="px-4 py-2.5 text-meta text-fg-muted text-pretty">
                  Hebun could not read its own observation history for this capability, so how many
                  exist is unknown. This is not a statement that there are none.
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
