/*
 * evolution-panel.tsx — one platform's stored measurements over time, and the change Hebun
 * calculated across them when it could.
 *
 * ── THE TWO PLATFORMS SHARE THIS PANEL AND NOT ITS MEANING ──────────────────
 *
 * The panel is told which metric it is drawing, by name, by the caller. It cannot discover one, and
 * there is no default — so "Followers" and "Subscribers" can sit in the same visual slot on the same
 * screen without either becoming the other. The heading names the platform every time, because two
 * adjacent trajectories with a shared title would be one universal metric in everything but code.
 *
 * ── AN INSUFFICIENT HISTORY IS NOT AN EMPTY STATE ───────────────────────────
 *
 * One measurement is a MEASUREMENT. When that is all Hebun holds, the panel still plots the point
 * and still prints the number — and says, in the released derivation's own words, that a second
 * observation is needed before any change can be shown. Rendering that as "no data" would discard
 * real evidence; rendering it as a trend would invent evidence. It does neither.
 *
 * Server component.
 */
import { ProvenanceChip } from "@/components/ui/provenance-chip";
import { CalculatedChange } from "./calculated-change";
import { MeasurementSeriesChart } from "./measurement-series-chart";
import type {
  SocialChangeBlock,
  SocialProvenance,
  SocialSeriesPoint,
} from "@/features/social-intelligence/dashboard-model";

export interface EvolutionPanelProps {
  readonly platformLabel: string;
  readonly subjectNoun: string;
  /** The metric drawn in the plot. Named by the caller; never inferred. */
  readonly metric: string;
  readonly metricLabel: string;
  readonly points: readonly SocialSeriesPoint[];
  /**
   * How many measurements this panel may claim, already decided by the model. `null` means the count
   * is UNKNOWN and the panel prints none — it may not fall back to counting `points`, which is the
   * defect this prop exists to prevent.
   */
  readonly measurementCountLabel: string | null;
  /** The released sentence for a state that is not a plottable series. */
  readonly evolutionSentence: string | null;
  readonly seriesProvenance: SocialProvenance;
  readonly changes: SocialChangeBlock | null;
  readonly changesSentence: string | null;
  readonly changeProvenance: SocialProvenance;
}

export function EvolutionPanel({
  platformLabel,
  subjectNoun,
  metric,
  metricLabel,
  points,
  measurementCountLabel,
  evolutionSentence,
  seriesProvenance,
  changes,
  changesSentence,
  changeProvenance,
}: EvolutionPanelProps) {
  return (
    <section
      aria-label={`${platformLabel} ${subjectNoun} measurements`}
      className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5">
          <h3 className="min-w-0 text-title font-semibold text-fg">
            {platformLabel} <span className="font-normal text-fg-secondary">· {metric}</span>
          </h3>
          {/*
            THE COUNT OF MEASUREMENTS IS THE PANEL'S OWN HONESTY. A plot with four points and a plot
            with one look different, but not obviously so at a glance; the number says which is
            which without the reader having to count dots.

            It is ABSENT when the count is unknown. The model decides that, not this component —
            counting `points` here is exactly how "0 measurements" once appeared above the sentence
            "Whether any exist is unknown."
          */}
          {measurementCountLabel ? (
            <p className="shrink-0 text-meta text-fg-muted tabular-nums">{measurementCountLabel}</p>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <ProvenanceChip kind={seriesProvenance} detail={`${platformLabel} reported`} />
        </div>
      </header>

      {points.length > 0 ? (
        <MeasurementSeriesChart points={points} metric={metric} metricLabel={metricLabel} />
      ) : null}

      {/*
        THE SENTENCE COMES FROM THE RELEASED DERIVATION, verbatim. It is where the honesty about
        this evidence was already written and defended; restating it here in shorter words would
        create a second version of a claim that only needs one.
      */}
      {evolutionSentence ? (
        <p className="text-meta leading-5 text-fg-secondary text-pretty">{evolutionSentence}</p>
      ) : null}

      {changes ? (
        <CalculatedChange block={changes} provenance={changeProvenance} platformLabel={platformLabel} />
      ) : changesSentence ? (
        <div className="rounded-lg border border-dashed border-border-strong bg-surface-sunken p-4">
          <h4 className="text-meta font-semibold uppercase tracking-[0.12em] text-fg-secondary">
            Change across observations
          </h4>
          <p className="mt-1.5 text-meta leading-5 text-fg-secondary text-pretty">{changesSentence}</p>
        </div>
      ) : null}
    </section>
  );
}
