/*
 * calculated-change.tsx — the one place on this surface where a number is HEBUN'S and not a
 * provider's.
 *
 * ── WHAT IT MAY SAY, AND WHAT IT MAY NOT ────────────────────────────────────
 *
 * "Between the instant Hebun observed T₁ and the instant it observed T₂, the count YouTube reported
 * changed by N." That is the whole vocabulary. Not "held steady", not "no growth", not "needs
 * attention" — whether a change of 0 is good news is a judgement about a business, and this phase
 * has no evidence for one and no field to carry it.
 *
 * ── BOTH ENDPOINTS ARE SHOWN BESIDE THE RESULT ──────────────────────────────
 *
 * YT-SOC2 carries `previous` and `latest` next to `change` so a reader can recheck the subtraction
 * against the evidence rather than trust it, and this renders all three for the same reason. A
 * calculated number that hides its inputs asks to be believed; one that shows them can be checked.
 *
 * ── ZERO IS THE RESULT, NOT THE ABSENCE OF ONE ──────────────────────────────
 *
 * `0 - 0` is `0`. It is rendered as the digit, in the same weight as any other result, with no
 * apology and no "no change" phrasing. The one thing this component must never do is make a real
 * calculation look like missing data — which is precisely what a dash, a grey-out or an empty state
 * would do here.
 *
 * Server component.
 */
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import type { SocialChangeBlock, SocialProvenance } from "@/features/social-intelligence/dashboard-model";

const WINDOW_FORMAT = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function instant(iso: string): string {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? iso : `${WINDOW_FORMAT.format(parsed)} UTC`;
}

export function CalculatedChange({
  block,
  provenance,
  platformLabel,
}: {
  readonly block: SocialChangeBlock;
  readonly provenance: SocialProvenance;
  readonly platformLabel: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-dashed border-border-strong bg-surface-sunken p-4">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h4 className="min-w-0 text-meta font-semibold uppercase tracking-[0.12em] text-fg-secondary">
          Change across the last two observations
        </h4>
        <ProvenanceChip kind={provenance} detail="Hebun calculated" />
      </div>

      <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
        {block.cells.map((cell) => (
          <div key={cell.shortLabel} className="flex min-w-0 flex-col gap-0.5">
            {/* One name read aloud, not the short one followed by the long one. See the card. */}
            <dt className="text-label font-medium uppercase tracking-[0.1em] text-fg-muted">
              <span aria-hidden="true">{cell.shortLabel}</span>
              <span className="sr-only">Change in {cell.label}</span>
            </dt>
            <dd
              className={
                cell.status === "comparable"
                  ? "text-lg font-semibold leading-tight text-fg tabular-nums"
                  : "text-lg font-semibold leading-tight text-fg-muted"
              }
            >
              {cell.display}
              {cell.status === "comparable" ? (
                /*
                 * THE INPUTS, FOR A READER WHO CANNOT SEE THE ROW BELOW. Sighted readers get them
                 * from the "from → to" line; this makes the same two numbers available to everyone.
                 */
                <span className="sr-only">, from {cell.previous} to {cell.latest}</span>
              ) : (
                <span className="sr-only">. {cell.note}</span>
              )}
            </dd>
            {cell.status === "comparable" ? (
              <p className="text-label text-fg-muted tabular-nums" aria-hidden="true">
                {cell.previous} → {cell.latest}
              </p>
            ) : (
              <p className="text-label leading-4 text-fg-muted text-pretty">{cell.note}</p>
            )}
          </div>
        ))}
      </dl>

      {/*
        THE WINDOW IS STATED, ALWAYS. YT-SOC2 fixes the comparison at the last two measurements
        rather than reaching back for a comparable pair, precisely so the window is one fact a reader
        can see. Printing the arithmetic without it would give back the ambiguity that design bought.
      */}
      <p className="text-label leading-4 text-fg-muted text-pretty">
        {platformLabel} was observed at {instant(block.previousObservedAt)} and again at{" "}
        {instant(block.latestObservedAt)}. The figures above are the difference between those two
        observations.
      </p>
    </div>
  );
}
