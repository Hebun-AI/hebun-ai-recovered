import { GOVERNED_RECORD_ANATOMY } from "@/features/public-claims/capability-claims";

/*
 * What a governed record carries — FIELD NAMES ONLY, drawn as a plate.
 *
 * There is no sample row, no example value, no illustrative organization and no screenshot. That is
 * a deliberate refusal rather than a gap in the design: a plausible-looking record on a marketing
 * page is a fabricated record, and a product whose argument is "we show you the actual evidence"
 * cannot open by showing evidence it invented. Field names are true of the product without standing
 * in for anybody's data, so field names are what is published.
 *
 * The REWORK gave it the plate treatment — registration ticks, a hairline frame, a mono field
 * column — so it reads as a specification of a real record rather than as another table of prose.
 * It is still a `<dl>`, because that is what a term-and-meaning list is, and the plate adds no
 * value, no state and no chrome that pretends to be an interface.
 */
export function RecordAnatomy() {
  return (
    <div className="flex flex-col gap-5">
      <div className="public-plate px-6 py-7 sm:px-8 sm:py-8">
        <span aria-hidden="true" className="public-tick public-tick-tl" />
        <span aria-hidden="true" className="public-tick public-tick-tr" />
        <span aria-hidden="true" className="public-tick public-tick-bl" />
        <span aria-hidden="true" className="public-tick public-tick-br" />

        <p className="mb-7 font-mono text-label tracking-[0.16em] uppercase text-fg-muted">
          Anatomy of a governed record
        </p>

        <dl className="flex flex-col">
          {GOVERNED_RECORD_ANATOMY.map((entry) => (
            <div
              key={entry.field}
              className="grid grid-cols-1 gap-x-8 gap-y-1 border-t border-border py-4 first:border-t-0 first:pt-0 sm:grid-cols-[9rem_minmax(0,1fr)]"
            >
              <dt className="font-mono text-meta tracking-[0.08em] uppercase text-primary-read">
                {entry.field}
              </dt>
              <dd className="text-body leading-relaxed text-fg">{entry.meaning}</dd>
            </div>
          ))}
        </dl>
      </div>
      <p className="max-w-[var(--measure-prose)] text-body leading-relaxed text-fg-muted">
        Field names, not sample data. Hebun shows no record it does not hold.
      </p>
    </div>
  );
}
