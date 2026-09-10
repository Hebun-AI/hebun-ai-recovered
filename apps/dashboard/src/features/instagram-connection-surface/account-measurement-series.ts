/*
 * instagram-connection-surface/account-measurement-series.ts — what Instagram reported about this
 * account, at each instant Hebun looked.
 *
 * ── THE ONE SENTENCE THIS MODULE MAY PRODUCE ────────────────────────────────
 *
 *   "Instagram reported these counts at instant T₁, and these at instant T₂."
 *
 * NOT "followers grew", not "growth is accelerating", not "this is going well". This module orders
 * measurements and says how many comparable ones exist. It performs NO arithmetic between them —
 * not because subtraction is hard, but because a difference is a HEBUN CALCULATION and belongs to a
 * phase that has been asked for it. There is deliberately no field on any type below in which a
 * derived number could be placed, so a future edit that wanted to sneak one in would have to widen
 * the contract in public.
 *
 * ── THE FIVE VERBS, KEPT APART ──────────────────────────────────────────────
 *
 *   INSTAGRAM REPORTED   followersCount, followsCount, mediaCount — raw provider facts
 *   HEBUN OBSERVED       observedAt — when Hebun obtained them
 *   HEBUN CALCULATED     nothing, in this phase
 *   HEBUN INFERRED       nothing, ever, here
 *   HEBUN RECOMMENDS     nothing, ever, here
 *
 * ── A PURE DERIVATION ───────────────────────────────────────────────────────
 *
 * No I/O, no database, no provider, no tenant resolution, no clock. It is handed the result the
 * released read seam already produced — the same shape the released projections take — so it cannot
 * become a second reader, cannot widen a tenant predicate it never sees, and cannot outlive the
 * kill switch that governs the read.
 *
 * ── `null` IS NOT ZERO, AND ONE POINT IS NOT A SERIES ───────────────────────
 *
 * A withheld count stays `null` all the way through. And a single measurement is returned under its
 * OWN status, so "there is nothing to compare" is a fact the type system states rather than a length
 * check every future caller has to remember to write.
 */
import type {
  ObservationFacts,
  StoredProviderObservation,
} from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";

/**
 * How many account observations a caller should ask the read seam for.
 *
 * ── WHY 30 AND NOT THE SEAM'S MAXIMUM OF 50 ─────────────────────────────────
 *
 * At the released daily cadence, 30 observations is roughly a month of history — long enough to be
 * a meaningful window and short enough that a page renders a bounded amount. The seam permits 50,
 * but "the maximum is available" is not a reason to ask for it: a limit chosen by what a surface can
 * honestly use is a decision, while a limit chosen by what the API allows is an accident.
 *
 * The derivation below works on whatever it is given. This constant is the RECOMMENDATION a caller
 * should pass, not a bound this module enforces.
 */
export const ACCOUNT_SERIES_OBSERVATION_LIMIT = 30 as const;

/** The exact fact keys the released Instagram account mapper writes. Named, never discovered. */
const FOLLOWERS_COUNT = "followersCount";
const FOLLOWS_COUNT = "followsCount";
const MEDIA_COUNT = "mediaCount";

/**
 * One measurement: what Instagram reported, and when Hebun looked.
 *
 * Every count is `number | null`, and `null` means the provider did not report it — never zero. The
 * account id is deliberately absent: the series belongs to the tenant's own account by construction,
 * and carrying a provider identifier through a measurement type would invite it onto a screen.
 */
export interface InstagramAccountMeasurementPoint {
  /** HEBUN OBSERVED. The stored instant, exactly as recorded. */
  readonly observedAt: string;
  /** INSTAGRAM REPORTED. */
  readonly followersCount: number | null;
  readonly followsCount: number | null;
  readonly mediaCount: number | null;
}

/**
 * What the evidence supports — five distinguishable answers, none collapsed into another.
 *
 * ── WHY `single` IS ITS OWN STATUS AND NOT A ONE-ELEMENT ARRAY ──────────────
 *
 * Because comparability is the property callers actually need, and a length check is the property
 * they will forget. With `series` as the only shape carrying more than one point, a caller cannot
 * reach two measurements without having handled the case where only one exists. "Not enough evidence
 * to compare" stops being a discipline and becomes a type.
 *
 * ── WHY `no-usable-measurements` IS NOT `no-observations` ───────────────────
 *
 * "Hebun holds no account observation" and "Hebun holds observations in which the provider reported
 * no counts at all" are different facts about the world. Reporting the second as the first would
 * blame an absence on Hebun's records when it belongs to the provider's answer.
 */
export type InstagramAccountMeasurementSeries =
  /* The read itself could not be performed. Passed through unchanged from the seam. */
  | {
      readonly status: "unavailable";
      readonly reason: "unauthenticated" | "persistence-unavailable";
    }
  /* The read succeeded and Hebun holds no account observation at all. */
  | { readonly status: "no-observations" }
  /* Observations exist, but none carries a single usable count. */
  | {
      readonly status: "no-usable-measurements";
      readonly observationsConsidered: number;
    }
  /* Exactly one usable measurement. A measurement, and NOT a series. Nothing is comparable. */
  | {
      readonly status: "single-measurement";
      readonly point: InstagramAccountMeasurementPoint;
      readonly observationsConsidered: number;
    }
  /* Two or more usable measurements, ordered oldest first. Comparison becomes possible — later. */
  | {
      readonly status: "series";
      readonly points: readonly InstagramAccountMeasurementPoint[];
      readonly observationsConsidered: number;
    };

function countFact(facts: ObservationFacts, key: string): number | null {
  const value = (facts as Record<string, unknown>)[key];
  /*
   * A COUNT IS A COUNT ONLY WHEN IT IS A FINITE NUMBER. A numeric string, `NaN`, a boolean or a
   * nested shape are all "the provider did not report a usable count" — and are carried as `null`
   * rather than parsed into one, because a measurement Hebun had to repair is not a measurement
   * Instagram made.
   */
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A measurement is USABLE when it has a real instant and at least one reported count.
 *
 * An observation whose three counts are all withheld is a real observation of nothing measurable;
 * including it would put a row with no numbers into a measurement series and let a later phase
 * subtract across a gap that contains no evidence.
 */
function usablePointOf(
  observation: StoredProviderObservation,
): InstagramAccountMeasurementPoint | null {
  if (typeof observation.observedAt !== "string" || observation.observedAt.length === 0) return null;

  const followersCount = countFact(observation.facts, FOLLOWERS_COUNT);
  const followsCount = countFact(observation.facts, FOLLOWS_COUNT);
  const mediaCount = countFact(observation.facts, MEDIA_COUNT);
  if (followersCount === null && followsCount === null && mediaCount === null) return null;

  return Object.freeze({ observedAt: observation.observedAt, followersCount, followsCount, mediaCount });
}

/**
 * Derive the account measurement series from an authorized, capability-scoped read.
 *
 * ── ORDER IS CHOSEN, NOT INHERITED ──────────────────────────────────────────
 *
 * The read seam returns newest-first, because a surface showing "the latest" wants that. A SERIES
 * wants the opposite: oldest first, so it reads forwards in time like every chart and every
 * subtraction anyone will later write. Inheriting the seam's order would leave the first element
 * meaning "most recent" in one module and "earliest" in another, and the sign of a future delta
 * would depend on which one the author had read last.
 *
 * So the order is normalised here, deliberately, and asserted by test.
 *
 * THE CALLER MUST SCOPE THE READ. This function cannot check that the observations it was handed
 * came from `instagram.account.public.read`; it reads the account fact vocabulary, and a caller who
 * passes media observations will correctly get `no-usable-measurements` rather than nonsense — but
 * naming the capability at the read remains the caller's obligation.
 */
export function deriveInstagramAccountMeasurementSeries(
  result: ProviderObservationReadResult,
): InstagramAccountMeasurementSeries {
  if (result.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: result.reason });
  }

  const observationsConsidered = result.observations.length;
  if (observationsConsidered === 0) return Object.freeze({ status: "no-observations" as const });

  const points: InstagramAccountMeasurementPoint[] = [];
  for (const observation of result.observations) {
    const point = usablePointOf(observation);
    if (point !== null) points.push(point);
  }

  if (points.length === 0) {
    return Object.freeze({ status: "no-usable-measurements" as const, observationsConsidered });
  }

  /* Oldest first. String comparison is correct for the ISO-8601 UTC instants the writer stores. */
  points.sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0));

  if (points.length === 1) {
    return Object.freeze({
      status: "single-measurement" as const,
      point: points[0]!,
      observationsConsidered,
    });
  }

  return Object.freeze({
    status: "series" as const,
    points: Object.freeze(points),
    observationsConsidered,
  });
}

/* ── The words a surface may use about this evidence ───────────────────────── */

/**
 * What each state means, in the words a human should read.
 *
 * NONE of these sentences reports a change, a direction or a verdict, and none of them invents a
 * zero. A single measurement is described as exactly that — a measurement, with the reason a
 * comparison cannot be offered stated plainly rather than shown as "0".
 */
export const INSTAGRAM_ACCOUNT_SERIES_SENTENCES: Readonly<
  Record<
    "unauthenticated" | "persistence-unavailable" | "no-observations" | "no-usable-measurements" | "single-measurement",
    string
  >
> = Object.freeze({
  unauthenticated:
    "This session could not be resolved, so no stored account measurements were read. Whether any " +
    "exist is unknown.",
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so how many account measurements " +
    "exist is unknown. This is not a statement that there are none.",
  "no-observations":
    "Hebun has stored no Instagram account observation for this organization yet. Nothing was asked " +
    "of Instagram and nothing failed.",
  "no-usable-measurements":
    "Hebun holds account observations, but Instagram reported no follower, following or media count " +
    "in them. There is nothing to measure — which is a fact about what the provider said, not about " +
    "this account.",
  "single-measurement":
    "Hebun holds one account measurement. A single observation is a measurement, not a comparison — " +
    "a second observation is needed before any change can be shown, and Hebun will not invent one.",
});
