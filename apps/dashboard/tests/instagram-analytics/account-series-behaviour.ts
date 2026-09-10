/*
 * IG-AN1 · the account measurement series, exercised against the read seam's own shapes.
 *
 * WHAT THIS PROVES — properties, not tokens (TRH-IG7):
 *
 *   1. Five evidence states are distinguishable and never collapsed.
 *   2. ONE usable measurement is NOT a series — comparability is a status, not a length.
 *   3. `null` survives as `null`; a real `0` survives as `0`.
 *   4. An observation with no usable count is excluded, and that is reported honestly.
 *   5. Order is normalised to OLDEST FIRST regardless of the order the seam returned.
 *   6. Nothing is calculated: no delta, no rate, no direction — the types have nowhere to put one.
 *   7. The derivation is pure and deterministic: same input, same output, no clock.
 *
 * Pure: no database, no network, no provider, no credential, no tenant.
 */
import assert from "node:assert/strict";
import {
  deriveInstagramAccountMeasurementSeries,
  ACCOUNT_SERIES_OBSERVATION_LIMIT,
  INSTAGRAM_ACCOUNT_SERIES_SENTENCES,
} from "../../src/features/instagram-connection-surface/account-measurement-series";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";
import type {
  ObservationFacts,
  StoredProviderObservation,
} from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_PROVIDER_KEY,
} from "../../src/features/provider-instagram/contracts";

const ACCOUNT_ID = "17841400000000000";

function stored(observedAt: string, facts: ObservationFacts): StoredProviderObservation {
  return Object.freeze({
    observationId: "11111111-1111-4111-8111-111111111111",
    providerKey: INSTAGRAM_PROVIDER_KEY,
    capabilityKey: INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
    subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND,
    subjectRef: `instagram/account/${ACCOUNT_ID}`,
    integrationId: "22222222-2222-4222-8222-222222222222",
    observedAt,
    recordedAt: observedAt,
    provenance: "standing-authorization" as const,
    observedByActorType: null,
    standingAuthorizationId: "33333333-3333-4333-8333-333333333333",
    invocationId: "44444444-4444-4444-8444-444444444444",
    facts,
  });
}
const readOf = (...o: readonly StoredProviderObservation[]): ProviderObservationReadResult => ({
  status: "read",
  observations: o,
});
const counts = (followersCount: unknown, followsCount: unknown, mediaCount: unknown): ObservationFacts =>
  ({ accountId: ACCOUNT_ID, username: "acct", accountType: "BUSINESS", followersCount, followsCount, mediaCount }) as ObservationFacts;

function main(): void {
  /* ═══ 1. FIVE STATES, EACH DISTINGUISHABLE ═══════════════════════════════ */
  assert.deepEqual(
    deriveInstagramAccountMeasurementSeries({ status: "unavailable", reason: "unauthenticated" }),
    { status: "unavailable", reason: "unauthenticated" },
    "an unavailable read is passed through, never turned into an absence",
  );
  assert.deepEqual(
    deriveInstagramAccountMeasurementSeries({ status: "unavailable", reason: "persistence-unavailable" }),
    { status: "unavailable", reason: "persistence-unavailable" },
  );
  assert.deepEqual(
    deriveInstagramAccountMeasurementSeries(readOf()),
    { status: "no-observations" },
    "zero observations is its own answer",
  );

  /* OBSERVATIONS THAT MEASURE NOTHING ARE NOT "NO OBSERVATIONS". */
  const blind = deriveInstagramAccountMeasurementSeries(
    readOf(stored("2026-09-10T08:00:00.000Z", counts(null, null, null))),
  );
  assert.equal(blind.status, "no-usable-measurements", "an observation with no counts measures nothing");
  assert.equal(
    blind.status === "no-usable-measurements" && blind.observationsConsidered,
    1,
    "and it still reports that an observation WAS considered — the absence is the provider's",
  );
  assert.notEqual(blind.status, "no-observations", "which is a different fact from holding none");

  /* ═══ 2. ONE MEASUREMENT IS NOT A SERIES ═════════════════════════════════ */
  const one = deriveInstagramAccountMeasurementSeries(
    readOf(stored("2026-09-10T08:00:18.986Z", counts(56, 83, 8))),
  );
  assert.equal(one.status, "single-measurement", "one usable measurement gets its own status");
  if (one.status !== "single-measurement") return;
  assert.equal(one.point.followersCount, 56);
  assert.equal(one.point.observedAt, "2026-09-10T08:00:18.986Z");
  /* THE SHAPE ITSELF REFUSES COMPARISON: there is no `points` array to iterate. */
  assert.ok(!("points" in one), "a single measurement exposes no series a caller could compare across");

  /* ═══ 5. ORDER IS NORMALISED TO OLDEST FIRST ═════════════════════════════ */
  const newestFirst = readOf(
    stored("2026-09-12T08:00:00.000Z", counts(60, 85, 10)),
    stored("2026-09-11T08:00:00.000Z", counts(58, 84, 9)),
    stored("2026-09-10T08:00:00.000Z", counts(56, 83, 8)),
  );
  const series = deriveInstagramAccountMeasurementSeries(newestFirst);
  assert.equal(series.status, "series", "three usable measurements are a series");
  if (series.status !== "series") return;
  assert.deepEqual(
    series.points.map((p) => p.observedAt),
    ["2026-09-10T08:00:00.000Z", "2026-09-11T08:00:00.000Z", "2026-09-12T08:00:00.000Z"],
    "OLDEST FIRST, whatever order the seam returned — a series reads forwards in time",
  );
  assert.equal(series.points[0]!.followersCount, 56, "and the earliest point carries the earliest counts");
  assert.equal(series.points.at(-1)!.followersCount, 60);

  /* The same input in the opposite order yields the identical series — order is not inherited. */
  const oldestFirst = readOf(
    stored("2026-09-10T08:00:00.000Z", counts(56, 83, 8)),
    stored("2026-09-11T08:00:00.000Z", counts(58, 84, 9)),
    stored("2026-09-12T08:00:00.000Z", counts(60, 85, 10)),
  );
  assert.deepEqual(
    deriveInstagramAccountMeasurementSeries(oldestFirst),
    series,
    "the derivation is order-independent — it normalises rather than trusting the caller",
  );

  /* ═══ 3. null != 0, AND 0 != null ════════════════════════════════════════ */
  const mixed = deriveInstagramAccountMeasurementSeries(
    readOf(
      stored("2026-09-10T08:00:00.000Z", counts(0, 0, 0)),
      stored("2026-09-11T08:00:00.000Z", counts(null, 84, undefined)),
    ),
  );
  assert.equal(mixed.status, "series");
  if (mixed.status !== "series") return;
  const [zeroPoint, partialPoint] = mixed.points;
  assert.equal(zeroPoint!.followersCount, 0, "a real zero survives as zero");
  assert.equal(zeroPoint!.mediaCount, 0);
  assert.notEqual(zeroPoint!.followersCount, null, "and is never turned into an absence");
  assert.equal(partialPoint!.followersCount, null, "a withheld count stays null");
  assert.notEqual(partialPoint!.followersCount, 0, "NEVER zero");
  assert.equal(partialPoint!.mediaCount, null, "an absent key is withheld too");
  assert.equal(partialPoint!.followsCount, 84, "while the count that WAS reported survives intact");

  /* ═══ 4. MALFORMED FACTS NARROW, THEY DO NOT PARSE ═══════════════════════ */
  const malformed = deriveInstagramAccountMeasurementSeries(
    readOf(stored("2026-09-10T08:00:00.000Z", counts("56", Number.NaN, { total: 8 }))),
  );
  assert.equal(
    malformed.status,
    "no-usable-measurements",
    "a numeric STRING, NaN and a shape are none of them counts — so nothing measurable remains",
  );

  /* A partly-malformed observation keeps only what was genuinely reported. */
  const partlyMalformed = deriveInstagramAccountMeasurementSeries(
    readOf(stored("2026-09-10T08:00:00.000Z", counts("56", 83, [])))
  );
  assert.equal(partlyMalformed.status, "single-measurement");
  if (partlyMalformed.status !== "single-measurement") return;
  assert.equal(partlyMalformed.point.followersCount, null, "a numeric string is not repaired into 56");
  assert.equal(partlyMalformed.point.followsCount, 83);
  assert.equal(partlyMalformed.point.mediaCount, null);

  /* An observation with no usable instant contributes nothing. */
  const instantless = deriveInstagramAccountMeasurementSeries(
    readOf(stored("", counts(56, 83, 8)), stored("2026-09-10T08:00:00.000Z", counts(57, 83, 8))),
  );
  assert.equal(instantless.status, "single-measurement", "a measurement with no instant is not a measurement");

  /* ═══ 6. NOTHING IS CALCULATED ═══════════════════════════════════════════ */
  const shape = JSON.stringify(series);
  for (const derived of ["delta", "change", "growth", "rate", "trend", "percent", "average", "direction", "score"]) {
    assert.ok(!new RegExp(derived, "i").test(shape), `the result contains no \`${derived}\` field`);
  }
  assert.deepEqual(
    Object.keys(series.points[0]!).sort(),
    ["followersCount", "followsCount", "mediaCount", "observedAt"],
    "a measurement point carries exactly the reported counts and the observed instant",
  );
  assert.deepEqual(
    Object.keys(series).sort(),
    ["observationsConsidered", "points", "status"],
    "and the series itself carries no computed summary",
  );
  /* Two points with different values produce NO comparison of any kind. */
  assert.equal(
    (series as unknown as Record<string, unknown>).followersDelta,
    undefined,
    "three measurements with rising counts still yield no delta — that is IG-AN2's question",
  );

  /* ═══ 7. PURE AND DETERMINISTIC ══════════════════════════════════════════ */
  assert.deepEqual(
    deriveInstagramAccountMeasurementSeries(newestFirst),
    deriveInstagramAccountMeasurementSeries(newestFirst),
    "the same input yields the same output — no clock, no randomness",
  );
  assert.ok(Object.isFrozen(series), "the result is frozen");
  assert.ok(Object.isFrozen(series.points[0]), "and so is each point");

  /* ═══ THE BOUND IS A DECISION, NOT THE CEILING ═══════════════════════════ */
  assert.equal(ACCOUNT_SERIES_OBSERVATION_LIMIT, 30, "the recommended history bound");
  assert.ok(
    ACCOUNT_SERIES_OBSERVATION_LIMIT < MAX_OBSERVATIONS_PER_READ,
    "chosen BELOW the seam's maximum — availability is not a reason to ask for everything",
  );

  /* ═══ THE SENTENCES REFUSE TO INVENT A ZERO OR A VERDICT ═════════════════ */
  const sentences = Object.values(INSTAGRAM_ACCOUNT_SERIES_SENTENCES);
  assert.equal(new Set(sentences).size, sentences.length, "each state says something different");
  const allText = sentences.join(" ");
  for (const f of ["unchanged", "stable", "no growth", "0%", "flat"] as const) {
    assert.ok(!new RegExp(f, "i").test(allText), `no sentence claims \`${f}\``);
  }
  assert.ok(
    /not a comparison/i.test(INSTAGRAM_ACCOUNT_SERIES_SENTENCES["single-measurement"]),
    "the single-measurement sentence says plainly that nothing can be compared yet",
  );
  assert.ok(
    /unknown/i.test(INSTAGRAM_ACCOUNT_SERIES_SENTENCES["persistence-unavailable"]),
    "an unavailable read is admitted as ignorance, not reported as an absence",
  );

  console.log(
    "instagram-analytics/account-series-behaviour: five states distinguished, one measurement is " +
      "not a series, null!=0, 0!=null, malformed narrows, order normalised oldest-first, nothing " +
      "calculated, pure and frozen, bound below the ceiling",
  );
}

main();
