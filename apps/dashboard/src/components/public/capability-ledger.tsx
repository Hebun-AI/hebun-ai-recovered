import {
  PUBLIC_CAPABILITY_CLAIMS,
  PUBLIC_CAPABILITY_STATE_LABEL,
} from "@/features/public-claims/capability-claims";

/*
 * The capability ledger — capability, state, and LIMIT, with the limit given the same weight as
 * the capability. That equal weighting is the point: a marketing table that lists what a product
 * does and hides where it stops is the ordinary shape, and publishing the boundary beside the
 * claim is the one thing this site does differently.
 *
 * ── ONE SOURCE, TWO RENDERINGS, NO HIDDEN INFORMATION ────────────────────────
 *
 * Desktop renders a three-column table. Below `lg` each row becomes a stacked block carrying the
 * same three labelled values. NOTHING COLLAPSES INTO A DISCLOSURE: an accordion on a limit column
 * would mean the boundary is one tap less visible than the capability, which is exactly the
 * asymmetry the ledger exists to remove.
 *
 * Both renderings read the SAME closed contract, so a claim cannot exist on one breakpoint only.
 * The mobile blocks are a `<dl>` per row rather than a table, because a two-cell table row read
 * out of its header context is worse than an explicit term/definition pair.
 *
 * The state is never carried by colour alone — it is a word, and the mono register marks it as a
 * value rather than as prose.
 */
export function CapabilityLedger() {
  return (
    <>
      {/* Desktop: a real table, with real header cells. */}
      <table className="hidden w-full border-collapse text-left lg:table">
        <caption className="sr-only">
          Hebun AI capabilities available today, each with the limit that applies to it.
        </caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="w-[16rem] border-b-2 border-fg pb-3 pr-6 font-mono text-label font-normal tracking-[0.08em] uppercase text-fg-muted"
            >
              Capability
            </th>
            <th
              scope="col"
              className="w-[9rem] border-b-2 border-fg px-6 pb-3 font-mono text-label font-normal tracking-[0.08em] uppercase text-fg-muted"
            >
              State
            </th>
            <th
              scope="col"
              className="border-b-2 border-fg pb-3 pl-6 font-mono text-label font-normal tracking-[0.08em] uppercase text-fg-muted"
            >
              Limit
            </th>
          </tr>
        </thead>
        <tbody>
          {PUBLIC_CAPABILITY_CLAIMS.map((claim) => (
            <tr key={claim.id}>
              <th
                scope="row"
                className="border-b border-border py-5 pr-6 align-top text-body font-bold normal-case tracking-normal text-fg"
              >
                {claim.capability}
              </th>
              <td className="border-b border-border px-6 py-5 align-top">
                <span className="font-mono text-meta font-semibold text-fg">
                  {PUBLIC_CAPABILITY_STATE_LABEL[claim.state]}
                </span>
              </td>
              <td className="border-b border-border py-5 pl-6 align-top text-body leading-relaxed text-fg-secondary">
                {claim.limit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: the same three values, stacked and labelled. Nothing is hidden. */}
      <ul className="flex flex-col lg:hidden">
        {PUBLIC_CAPABILITY_CLAIMS.map((claim) => (
          <li key={claim.id} className="border-t border-border py-6 first:border-t-2 first:border-t-fg">
            <dl className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <dt className="font-mono text-label tracking-[0.08em] uppercase text-fg-muted">
                  Capability
                </dt>
                <dd className="text-body font-bold text-fg">{claim.capability}</dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-mono text-label tracking-[0.08em] uppercase text-fg-muted">
                  State
                </dt>
                <dd className="font-mono text-meta font-semibold text-fg">
                  {PUBLIC_CAPABILITY_STATE_LABEL[claim.state]}
                </dd>
              </div>
              <div className="flex flex-col gap-1">
                <dt className="font-mono text-label tracking-[0.08em] uppercase text-fg-muted">
                  Limit
                </dt>
                <dd className="text-body leading-relaxed text-fg-secondary">{claim.limit}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
