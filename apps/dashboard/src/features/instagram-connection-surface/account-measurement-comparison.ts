/*
 * instagram-connection-surface/account-measurement-comparison.ts — IG-AN2.
 *
 * ── THE ONE SENTENCE THIS MODULE MAY PRODUCE ────────────────────────────────
 *
 *   "Between the instant Hebun observed T₁ and the instant it observed T₂, the count Instagram
 *    reported changed by N."
 *
 * NOT "the account grew", not "followers are flat", not "engagement is down", not "this needs
 * attention". A number and the two numbers it came from. Whether a change of +5 is good news is a
 * judgement about a business, and this module has no evidence for one and no field to carry it.
 *
 * ── WHY THIS SHARES NO CODE WITH YT-SOC2 ────────────────────────────────────
 *
 * The YouTube comparison and this one look alike and are not the same. YT-SOC2 carries a
 * SUBSCRIBER-SPECIFIC comparison type, because a YouTube channel can HIDE its subscriber count and
 * the released contract distinguishes "the owner hides it" from "the provider went quiet". Instagram
 * has no analogue: IG-AN1's measurement point carries three plain `number | null` counts and no
 * absence reason, because the released Instagram fact vocabulary has none to carry.
 *
 * A shared `SocialMetricComparison<T>` would have to erase that difference to exist, and the moment
 * it did, a caller could ask a generic question — "how did this account's audience change?" — that
 * neither provider answers. The two modules share CONVENTIONS (five states, the last-two window,
 * `null` is never zero, no field for a rate) and share no TYPES. That is the same refusal IG-AN1 and
 * YT-SOC1 already make one layer down, kept rather than undone here.
 *
 * ── FOLLOWERS ARE NOT SUBSCRIBERS, AND FOLLOWING IS NOT EITHER ──────────────
 *
 * The three metrics keep Instagram's own names. `followsCount` is how many accounts THIS account
 * follows — an outbound number the account controls — while `followersCount` is inbound and it does
 * not. They are compared independently and are never summed, averaged or ranked against each other.
 *
 * ── A PURE DERIVATION OVER A PURE DERIVATION ────────────────────────────────
 *
 * It consumes the released IG-AN1 series and nothing else — no database, no provider, no tenant, no
 * clock, no persistence. Nothing is stored: the calculation is reproducible from the observations at
 * any time, which is why there is no analytics table and no cache.
 */
import type {
  InstagramAccountMeasurementPoint,
  InstagramAccountMeasurementSeries,
} from "./account-measurement-series";

/**
 * WHY A METRIC COULD NOT BE COMPARED.
 *
 * Never "no data". Which SIDE is missing is the fact a reader needs: a count Instagram stopped
 * reporting and one it only just started reporting are different situations, and both differ from
 * one it has never reported.
 *
 * Deliberately Instagram's OWN type. It is structurally identical to YouTube's today, and importing
 * that one would make a future divergence in either provider's vocabulary a breaking change in the
 * other.
 */
export type InstagramMetricComparabilityGap =
  | "previous-not-reported"
  | "latest-not-reported"
  | "neither-reported";

/**
 * One metric across two instants.
 *
 * `comparable` carries the arithmetic AND both inputs, so a reader can recheck the subtraction
 * against the evidence rather than trust it. `not-comparable` carries whatever WAS reported — a
 * present endpoint is not discarded because its partner is missing — and never substitutes zero for
 * the absent one. **An absent baseline does not make the latest value a change from nothing; it
 * makes the change unknowable.**
 *
 * There is no `change` field on the `not-comparable` arm. The absence of the field is the guarantee.
 */
export type InstagramMetricComparison =
  | {
      readonly status: "comparable";
      readonly previous: number;
      readonly latest: number;
      /** HEBUN CALCULATED: `latest - previous`. Zero is a result, not an absence. */
      readonly change: number;
    }
  | {
      readonly status: "not-comparable";
      readonly gap: InstagramMetricComparabilityGap;
      readonly previous: number | null;
      readonly latest: number | null;
    };

/**
 * What the evidence supports.
 *
 * The first three states are passed through from the series unchanged — a comparison cannot know
 * more about the evidence than the series it was built from. `insufficient-history` is the state
 * this module adds: measurements exist, but not two of them.
 */
export type InstagramAccountComparison =
  | {
      readonly status: "unavailable";
      readonly reason: "unauthenticated" | "persistence-unavailable";
    }
  | { readonly status: "no-observations" }
  | {
      readonly status: "no-usable-measurements";
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "insufficient-history";
      readonly measurementsAvailable: number;
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "compared";
      /** HEBUN OBSERVED — the window the arithmetic below spans. */
      readonly previousObservedAt: string;
      readonly latestObservedAt: string;
      readonly observationsConsidered: number;
      readonly followersCount: InstagramMetricComparison;
      readonly followsCount: InstagramMetricComparison;
      readonly mediaCount: InstagramMetricComparison;
    };

function gapOf(previous: number | null, latest: number | null): InstagramMetricComparabilityGap {
  if (previous === null && latest === null) return "neither-reported";
  return previous === null ? "previous-not-reported" : "latest-not-reported";
}

function compareMetric(previous: number | null, latest: number | null): InstagramMetricComparison {
  if (previous === null || latest === null) {
    return Object.freeze({
      status: "not-comparable" as const,
      gap: gapOf(previous, latest),
      previous,
      latest,
    });
  }
  /* THE WHOLE CALCULATION. `56 - 56` is `0`, and that is an answer. */
  return Object.freeze({
    status: "comparable" as const,
    previous,
    latest,
    change: latest - previous,
  });
}

/**
 * Compare the two most recent measurements in a released IG-AN1 series.
 *
 * ── WHY THE LAST TWO, AND NOT "THE MOST RECENT COMPARABLE PAIR" ─────────────
 *
 * Searching backwards for the most recent pair that happens to share a reported metric would make
 * the comparison window VARY per metric and per run, silently — a follower change measured across
 * six days sitting beside a media change measured across one, with nothing on the surface saying so.
 * The window is fixed at the last two measurements and stated in the result, so an unreported metric
 * shows up as a gap the reader can see rather than as a longer reach nobody mentioned.
 *
 * Every metric is then compared INDEPENDENTLY inside that one window.
 */
export function compareInstagramAccountMeasurements(
  series: InstagramAccountMeasurementSeries,
): InstagramAccountComparison {
  if (series.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: series.reason });
  }
  if (series.status === "no-observations") {
    return Object.freeze({ status: "no-observations" as const });
  }
  if (series.status === "no-usable-measurements") {
    return Object.freeze({
      status: "no-usable-measurements" as const,
      observationsConsidered: series.observationsConsidered,
    });
  }
  if (series.status === "single-measurement") {
    return Object.freeze({
      status: "insufficient-history" as const,
      measurementsAvailable: 1,
      observationsConsidered: series.observationsConsidered,
    });
  }

  /* The series is oldest-first, so the comparison window is its final pair. */
  const latest: InstagramAccountMeasurementPoint = series.points[series.points.length - 1]!;
  const previous: InstagramAccountMeasurementPoint = series.points[series.points.length - 2]!;

  return Object.freeze({
    status: "compared" as const,
    previousObservedAt: previous.observedAt,
    latestObservedAt: latest.observedAt,
    observationsConsidered: series.observationsConsidered,
    followersCount: compareMetric(previous.followersCount, latest.followersCount),
    followsCount: compareMetric(previous.followsCount, latest.followsCount),
    mediaCount: compareMetric(previous.mediaCount, latest.mediaCount),
  });
}

/* ── The words a surface may use about this evidence ───────────────────────── */

/**
 * What each non-comparable state means, in the words a human should read.
 *
 * There is deliberately NO entry for `compared`. A comparison speaks for itself in numbers, and any
 * sentence Hebun wrote about one — "followers held steady", "the account is growing" — would be an
 * interpretation this phase has no authority to make. The absence of that entry is the boundary.
 */
export const INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES: Readonly<
  Record<
    | "unauthenticated"
    | "persistence-unavailable"
    | "no-observations"
    | "no-usable-measurements"
    | "insufficient-history",
    string
  >
> = Object.freeze({
  unauthenticated:
    "This session could not be resolved, so no stored account measurements were read. Whether any " +
    "change occurred is unknown.",
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so whether any change occurred is " +
    "unknown. This is not a statement that nothing changed.",
  "no-observations":
    "Hebun has stored no Instagram account observation for this organization yet. Nothing was asked " +
    "of Instagram and nothing failed.",
  "no-usable-measurements":
    "Hebun holds account observations, but Instagram reported no follower, following or media count " +
    "in them. There is nothing to compare — a fact about what the provider said, not about this " +
    "account.",
  "insufficient-history":
    "Hebun holds one account measurement. A comparison needs two observations of the same account, " +
    "and the second has not been made yet. Hebun will not compare a measurement against an " +
    "assumed starting point.",
});
