/*
 * IG-AN2 — what the Instagram account comparison may and may not say.
 *
 * ── THE ONE SENTENCE UNDER TEST ─────────────────────────────────────────────
 *
 *   "Between the instant Hebun observed T₁ and the instant it observed T₂, the count Instagram
 *    reported changed by N."
 *
 * Every assertion below is about a value a human would read, not a token the module happens to
 * contain. Zero is asserted as a RESULT throughout, because the production evidence that unblocked
 * this phase is two real observations reporting the same three numbers — and a comparison that
 * cannot say "0" honestly is worse than no comparison at all.
 */
import assert from "node:assert/strict";
import {
  compareInstagramAccountMeasurements,
  INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES,
} from "../../src/features/instagram-connection-surface/account-measurement-comparison";
import {
  deriveInstagramAccountMeasurementSeries,
  type InstagramAccountMeasurementSeries,
} from "../../src/features/instagram-connection-surface/account-measurement-series";
import type { StoredProviderObservation } from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
} from "../../src/features/provider-instagram/contracts";

function stored(observedAt: string, facts: Record<string, unknown>): StoredProviderObservation {
  return Object.freeze({
    observationId: "11111111-1111-4111-8111-111111111111",
    providerKey: INSTAGRAM_PROVIDER_KEY,
    capabilityKey: INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
    subjectKind: "instagram-account",
    subjectRef: "instagram/account/test",
    integrationId: "22222222-2222-4222-8222-222222222222",
    observedAt,
    recordedAt: observedAt,
    observedByActorType: null,
    standingAuthorizationId: "33333333-3333-4333-8333-333333333333",
    invocationId: "44444444-4444-4444-8444-444444444444",
    facts,
  }) as unknown as StoredProviderObservation;
}

/** The released read seam returns NEWEST FIRST; fixtures must reproduce that, not a tidy order. */
const read = (rows: readonly StoredProviderObservation[]): ProviderObservationReadResult =>
  ({ status: "read", observations: [...rows].reverse() }) as unknown as ProviderObservationReadResult;

const seriesOf = (rows: readonly StoredProviderObservation[]): InstagramAccountMeasurementSeries =>
  deriveInstagramAccountMeasurementSeries(read(rows));

/* The two real production observations that unblocked this phase, transcribed. */
const PROD_FIRST = stored("2026-09-10T08:00:18.986Z", {
  username: "turkishrughousecom",
  accountType: "BUSINESS",
  followersCount: 56,
  followsCount: 83,
  mediaCount: 8,
});
const PROD_SECOND = stored("2026-09-11T10:00:20.258Z", {
  username: "turkishrughousecom",
  accountType: "BUSINESS",
  followersCount: 56,
  followsCount: 83,
  mediaCount: 8,
});

/* ── 1–4 · the states inherited from the series ────────────────────────────── */

function anUnavailableReadStaysUnavailable(): void {
  for (const reason of ["unauthenticated", "persistence-unavailable"] as const) {
    const result = compareInstagramAccountMeasurements(
      deriveInstagramAccountMeasurementSeries({ status: "unavailable", reason }),
    );
    assert.equal(result.status, "unavailable");
    assert.equal(result.status === "unavailable" ? result.reason : null, reason, "the reason survives");
    assert.ok(
      /unknown/i.test(INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES[reason]),
      "a failed read is reported as unknown, never as no change",
    );
  }
}

function noObservationsIsNotNoChange(): void {
  const result = compareInstagramAccountMeasurements(seriesOf([]));
  assert.equal(result.status, "no-observations");
  const sentence = INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES["no-observations"];
  assert.ok(/nothing was asked|nothing failed/i.test(sentence), `honest sentence: ${sentence}`);
  assert.ok(!/no change|unchanged|stable/i.test(sentence), "absence is never phrased as a change");
}

function observationsWithoutUsableCountsAreNamedAsSuch(): void {
  const result = compareInstagramAccountMeasurements(
    seriesOf([stored("2026-09-10T08:00:00.000Z", { username: "x" }), stored("2026-09-11T08:00:00.000Z", { username: "x" })]),
  );
  assert.equal(result.status, "no-usable-measurements");
  assert.equal(result.status === "no-usable-measurements" ? result.observationsConsidered : null, 2);
  assert.ok(
    /what the provider said/i.test(INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES["no-usable-measurements"]),
    "it blames the provider's silence, not this account",
  );
}

function oneMeasurementIsInsufficientHistory(): void {
  const result = compareInstagramAccountMeasurements(seriesOf([PROD_FIRST]));
  assert.equal(result.status, "insufficient-history");
  assert.equal(result.status === "insufficient-history" ? result.measurementsAvailable : null, 1);
  const sentence = INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES["insufficient-history"];
  assert.ok(
    /two observations/i.test(sentence) && /second/i.test(sentence),
    `it says what is missing — a second observation of the same account: ${sentence}`,
  );
  assert.ok(!/\b0\b/.test(sentence), "one measurement is never reported as a change of zero");
}

/* ── 5/8 · the production case: two real measurements, all three changes zero ── */

function theRealProductionEvidenceComparesToZero(): void {
  const result = compareInstagramAccountMeasurements(seriesOf([PROD_FIRST, PROD_SECOND]));
  assert.equal(result.status, "compared");
  if (result.status !== "compared") return;

  assert.equal(result.previousObservedAt, "2026-09-10T08:00:18.986Z");
  assert.equal(result.latestObservedAt, "2026-09-11T10:00:20.258Z");
  assert.equal(result.observationsConsidered, 2);

  for (const [name, metric] of [
    ["followersCount", result.followersCount],
    ["followsCount", result.followsCount],
    ["mediaCount", result.mediaCount],
  ] as const) {
    assert.equal(metric.status, "comparable", `${name} was comparable`);
    if (metric.status !== "comparable") continue;
    assert.equal(metric.change, 0, `${name} change is the NUMBER zero`);
    assert.equal(typeof metric.change, "number", `${name} change is not null and not a string`);
    assert.notEqual(metric.change, null, `${name} zero is never collapsed into null`);
  }
  assert.equal(result.followersCount.status === "comparable" ? result.followersCount.previous : null, 56);
  assert.equal(result.followersCount.status === "comparable" ? result.followersCount.latest : null, 56);
  assert.equal(result.followsCount.status === "comparable" ? result.followsCount.previous : null, 83);
  assert.equal(result.mediaCount.status === "comparable" ? result.mediaCount.previous : null, 8);
}

function thereIsNoSentenceForAComparison(): void {
  /*
   * A comparison speaks in numbers. Any sentence Hebun wrote about one — "followers held steady",
   * "growth has stalled" — would be an interpretation this phase has no authority to make. The
   * ABSENCE of a `compared` entry is the boundary, exactly as YT-SOC2 draws it.
   */
  assert.ok(
    !("compared" in INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES),
    "there is no sentence for a comparison, and that is deliberate",
  );
  const BANNED = [
    "stable", "steady", "flat", "stagnant", "growth", "growing", "declining", "improving",
    "momentum", "engagement", "performance", "good", "bad", "healthy", "poor", "trend",
  ];
  for (const sentence of Object.values(INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES)) {
    for (const word of BANNED) {
      assert.ok(
        !new RegExp(`\\b${word}\\b`, "i").test(sentence),
        `no interpretive word "${word}" in: ${sentence}`,
      );
    }
  }
}

/* ── 6/7 · real movement, in both directions ──────────────────────────────── */

function apositiveChangeIsSignedCorrectly(): void {
  const result = compareInstagramAccountMeasurements(
    seriesOf([
      stored("2026-09-10T08:00:00.000Z", { followersCount: 56, followsCount: 83, mediaCount: 8 }),
      stored("2026-09-11T08:00:00.000Z", { followersCount: 61, followsCount: 80, mediaCount: 9 }),
    ]),
  );
  assert.equal(result.status, "compared");
  if (result.status !== "compared") return;
  assert.equal(result.followersCount.status === "comparable" ? result.followersCount.change : null, 5);
  assert.equal(result.mediaCount.status === "comparable" ? result.mediaCount.change : null, 1);
  /* A metric may fall while another rises; they are compared independently. */
  assert.equal(result.followsCount.status === "comparable" ? result.followsCount.change : null, -3);
}

function anegativeChangeIsNotClampedToZero(): void {
  const result = compareInstagramAccountMeasurements(
    seriesOf([
      stored("2026-09-10T08:00:00.000Z", { followersCount: 100, followsCount: 10, mediaCount: 4 }),
      stored("2026-09-11T08:00:00.000Z", { followersCount: 88, followsCount: 10, mediaCount: 4 }),
    ]),
  );
  assert.equal(result.status, "compared");
  if (result.status !== "compared") return;
  assert.equal(result.followersCount.status === "comparable" ? result.followersCount.change : null, -12);
  assert.equal(result.followsCount.status === "comparable" ? result.followsCount.change : null, 0);
}

/* ── 9 · the window is deterministic ──────────────────────────────────────── */

function theWindowIsAlwaysTheLastTwoMeasurements(): void {
  const rows = [
    stored("2026-09-08T08:00:00.000Z", { followersCount: 10, followsCount: 1, mediaCount: 1 }),
    stored("2026-09-09T08:00:00.000Z", { followersCount: 20, followsCount: 2, mediaCount: 2 }),
    stored("2026-09-10T08:00:00.000Z", { followersCount: 30, followsCount: 3, mediaCount: 3 }),
    stored("2026-09-11T08:00:00.000Z", { followersCount: 45, followsCount: 4, mediaCount: 4 }),
  ];
  const result = compareInstagramAccountMeasurements(seriesOf(rows));
  assert.equal(result.status, "compared");
  if (result.status !== "compared") return;
  assert.equal(result.previousObservedAt, "2026-09-10T08:00:00.000Z", "the SECOND-NEWEST, not the oldest");
  assert.equal(result.latestObservedAt, "2026-09-11T08:00:00.000Z");
  assert.equal(result.followersCount.status === "comparable" ? result.followersCount.change : null, 15);
  assert.equal(result.observationsConsidered, 4, "all four were considered, two were compared");

  /* Shuffling the read order must not move the window: the series sorts, and this consumes it. */
  const shuffled = compareInstagramAccountMeasurements(
    seriesOf([rows[2]!, rows[0]!, rows[3]!, rows[1]!]),
  );
  assert.deepEqual(shuffled, result, "the window is a function of the instants, not of arrival order");
}

/* ── 10 · absence never becomes a comparison ──────────────────────────────── */

function amissingEndpointIsNotComparableAndNeverZero(): void {
  const result = compareInstagramAccountMeasurements(
    seriesOf([
      stored("2026-09-10T08:00:00.000Z", { followersCount: 56, mediaCount: 8 }),
      stored("2026-09-11T08:00:00.000Z", { followersCount: 60, followsCount: 83, mediaCount: 9 }),
    ]),
  );
  assert.equal(result.status, "compared");
  if (result.status !== "compared") return;
  /* Followers and media compare cleanly; the metric with one missing side does not. */
  assert.equal(result.followersCount.status, "comparable");
  assert.equal(result.mediaCount.status, "comparable");
  assert.equal(result.followsCount.status, "not-comparable");
  if (result.followsCount.status !== "not-comparable") return;
  assert.equal(result.followsCount.gap, "previous-not-reported", "WHICH side is missing is carried");
  assert.equal(result.followsCount.previous, null);
  assert.equal(result.followsCount.latest, 83, "the side that WAS reported is not discarded");
  assert.ok(!("change" in result.followsCount), "there is no field to hold an invented change");
}

function neitherSideReportedIsItsOwnGap(): void {
  const result = compareInstagramAccountMeasurements(
    seriesOf([
      stored("2026-09-10T08:00:00.000Z", { followersCount: 56 }),
      stored("2026-09-11T08:00:00.000Z", { followersCount: 60 }),
    ]),
  );
  assert.equal(result.status, "compared");
  if (result.status !== "compared") return;
  assert.equal(result.followsCount.status, "not-comparable");
  assert.equal(result.followsCount.status === "not-comparable" ? result.followsCount.gap : null, "neither-reported");
  assert.equal(result.mediaCount.status === "not-comparable" ? result.mediaCount.gap : null, "neither-reported");
}

function amalformedObservationCannotCreateAComparison(): void {
  /* One real measurement plus rows the series refuses leaves a comparison with nothing to compare. */
  const result = compareInstagramAccountMeasurements(
    seriesOf([
      stored("2026-09-10T08:00:00.000Z", { followersCount: 56, followsCount: 83, mediaCount: 8 }),
      stored("2026-09-11T08:00:00.000Z", { followersCount: "61", followsCount: null, mediaCount: NaN }),
    ]),
  );
  assert.equal(result.status, "insufficient-history", "a string count is not a measurement");
  assert.equal(result.status === "insufficient-history" ? result.observationsConsidered : null, 2);
}

/* ── 11/12/13/14 · purity, immutability, isolation ────────────────────────── */

function theSourceObservationsAreNotMutated(): void {
  const rows = [
    stored("2026-09-10T08:00:00.000Z", { followersCount: 56, followsCount: 83, mediaCount: 8 }),
    stored("2026-09-11T08:00:00.000Z", { followersCount: 61, followsCount: 83, mediaCount: 8 }),
  ];
  const before = JSON.stringify(rows);
  compareInstagramAccountMeasurements(seriesOf(rows));
  assert.equal(JSON.stringify(rows), before, "the observations are untouched");
}

function theResultIsFrozenLikeEveryReleasedDerivation(): void {
  const result = compareInstagramAccountMeasurements(seriesOf([PROD_FIRST, PROD_SECOND]));
  assert.ok(Object.isFrozen(result), "the result is frozen");
  if (result.status !== "compared") return;
  assert.ok(Object.isFrozen(result.followersCount), "and so is each metric");
  assert.ok(Object.isFrozen(result.followsCount));
  assert.ok(Object.isFrozen(result.mediaCount));
}

function itIsDeterministic(): void {
  const series = seriesOf([PROD_FIRST, PROD_SECOND]);
  assert.deepEqual(
    compareInstagramAccountMeasurements(series),
    compareInstagramAccountMeasurements(series),
    "same input, same answer, every time",
  );
}

function main(): void {
  anUnavailableReadStaysUnavailable();
  noObservationsIsNotNoChange();
  observationsWithoutUsableCountsAreNamedAsSuch();
  oneMeasurementIsInsufficientHistory();
  theRealProductionEvidenceComparesToZero();
  thereIsNoSentenceForAComparison();
  apositiveChangeIsSignedCorrectly();
  anegativeChangeIsNotClampedToZero();
  theWindowIsAlwaysTheLastTwoMeasurements();
  amissingEndpointIsNotComparableAndNeverZero();
  neitherSideReportedIsItsOwnGap();
  amalformedObservationCannotCreateAComparison();
  theSourceObservationsAreNotMutated();
  theResultIsFrozenLikeEveryReleasedDerivation();
  itIsDeterministic();
  console.log("IG-AN2 account comparison behaviour checks passed");
}

main();
