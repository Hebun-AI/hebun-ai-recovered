/*
 * YT-SOC1 · the YouTube channel measurement series, exercised against the read seam's own shapes.
 *
 * WHAT THIS PROVES — properties, not tokens (TRH-IG7):
 *
 *   1. Five evidence states are distinguishable and never collapsed.
 *   2. ONE usable measurement is NOT a series — comparability is a status, not a length.
 *   3. A REAL ZERO SURVIVES AS ZERO. This is the whole point for YouTube: the production channel
 *      genuinely reports 0 subscribers, 0 videos and 0 views. "0" must never render as "no data".
 *   4. `null` survives as `null`, and carries WHY: a channel that hides its subscriber count is a
 *      different fact from YouTube not reporting one. Instagram has no analogue for this.
 *   5. Order is normalised to OLDEST FIRST regardless of the order the seam returned.
 *   6. Nothing is calculated — no delta, no rate, no direction. That is YT-SOC2's question.
 *   7. The derivation is pure and deterministic: same input, same output, no clock.
 *
 * Pure: no database, no network, no provider, no credential, no tenant.
 */
import assert from "node:assert/strict";
import {
  deriveYouTubeChannelMeasurementSeries,
  YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT,
  YOUTUBE_CHANNEL_SERIES_SENTENCES,
} from "../../src/features/youtube-channel-surface/channel-measurement-series";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";
import type {
  ObservationFacts,
  StoredProviderObservation,
} from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
} from "../../src/features/provider-youtube/contracts";
import { YOUTUBE_CHANNEL_SUBJECT_KIND } from "../../src/features/provider-observation-history/record-youtube-channel-observation.server";

function stored(observedAt: string, facts: Partial<Record<string, unknown>>): StoredProviderObservation {
  return Object.freeze({
    observationId: "11111111-1111-4111-8111-111111111111",
    providerKey: YOUTUBE_PROVIDER_KEY,
    capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
    subjectKind: YOUTUBE_CHANNEL_SUBJECT_KIND,
    subjectRef: "youtube/channel/UC_test",
    integrationId: "22222222-2222-4222-8222-222222222222",
    observedAt,
    recordedAt: observedAt,
    provenance: "standing-authorization" as const,
    observedByActorType: null,
    standingAuthorizationId: "33333333-3333-4333-8333-333333333333",
    invocationId: "44444444-4444-4444-8444-444444444444",
    facts: facts as ObservationFacts,
  });
}
const readOf = (...o: readonly StoredProviderObservation[]): ProviderObservationReadResult => ({
  status: "read",
  observations: o,
});

/** The stored channel fact shape, as the released mapper writes it. */
const channel = (
  subscriberCount: unknown,
  hiddenSubscriberCount: unknown,
  videoCount: unknown,
  viewCount: unknown,
) => ({
  channelId: "UC_test",
  title: "A Channel",
  handle: "@a-channel",
  subscriberCount,
  hiddenSubscriberCount,
  videoCount,
  viewCount,
  recentVideoCount: 0,
  moreVideosExist: false,
});

function main(): void {
  /* ═══ 1. FIVE STATES, EACH DISTINGUISHABLE ═══════════════════════════════ */
  assert.deepEqual(
    deriveYouTubeChannelMeasurementSeries({ status: "unavailable", reason: "unauthenticated" }),
    { status: "unavailable", reason: "unauthenticated" },
    "an unavailable read is passed through, never turned into an absence",
  );
  assert.deepEqual(
    deriveYouTubeChannelMeasurementSeries({ status: "unavailable", reason: "persistence-unavailable" }),
    { status: "unavailable", reason: "persistence-unavailable" },
  );
  assert.deepEqual(
    deriveYouTubeChannelMeasurementSeries(readOf()),
    { status: "no-observations" },
    "zero observations is its own answer",
  );

  const blind = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel(null, false, null, null))),
  );
  assert.equal(blind.status, "no-usable-measurements", "an observation with no counts measures nothing");
  assert.equal(
    blind.status === "no-usable-measurements" && blind.observationsConsidered,
    1,
    "and it still reports that an observation WAS considered — the absence is the provider's",
  );
  assert.notEqual(blind.status, "no-observations", "which is a different fact from holding none");

  /* ═══ 2. ONE MEASUREMENT IS NOT A SERIES ═════════════════════════════════ */
  const one = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel(0, false, 0, 0))),
  );
  assert.equal(one.status, "single-measurement", "one usable measurement gets its own status");
  if (one.status !== "single-measurement") return;
  assert.ok(!("points" in one), "a single measurement exposes no series a caller could compare across");

  /* ═══ 3. THE PRODUCTION CASE: A REAL ZERO IS A MEASUREMENT ═══════════════
   *
   * This is the shape of every observation this tenant actually holds. A channel reporting zero is
   * REPORTING — it is not silent, and a surface that renders "no data" here would be lying about
   * evidence Hebun successfully obtained four times.
   */
  assert.equal(one.point.subscriberCount, 0, "0 subscribers is a measurement, not an absence");
  assert.equal(one.point.videoCount, 0);
  assert.equal(one.point.viewCount, 0);
  assert.notEqual(one.point.subscriberCount, null, "and it is NEVER null");
  assert.equal(
    one.point.subscriberCountAbsence,
    null,
    "a reported count has no absence reason — there is no absence to explain",
  );

  /* ═══ 4. null CARRIES ITS REASON ═════════════════════════════════════════
   *
   * The released provider contract states that `subscriberCount` is null when the channel HIDES it
   * or when YouTube OMITTED it, and `hiddenSubscriberCount` is what tells the two apart. Collapsing
   * them would throw away the only fact that distinguishes a deliberate choice from a gap.
   */
  const hidden = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel(null, true, 12, 340))),
  );
  assert.equal(hidden.status, "single-measurement");
  if (hidden.status !== "single-measurement") return;
  assert.equal(hidden.point.subscriberCount, null, "a hidden count is null, never zero");
  assert.notEqual(hidden.point.subscriberCount, 0, "NEVER zero");
  assert.equal(
    hidden.point.subscriberCountAbsence,
    "hidden-by-channel",
    "and the series says WHY — the channel hides it",
  );
  assert.equal(hidden.point.videoCount, 12, "while the counts YouTube did report survive intact");
  assert.equal(hidden.point.viewCount, 340);

  const omitted = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel(null, false, 12, 340))),
  );
  assert.equal(omitted.status, "single-measurement");
  if (omitted.status !== "single-measurement") return;
  assert.equal(
    omitted.point.subscriberCountAbsence,
    "not-reported",
    "an absence with no hidden flag is YouTube not reporting — a DIFFERENT fact from hiding",
  );
  assert.notEqual(
    omitted.point.subscriberCountAbsence,
    hidden.point.subscriberCountAbsence,
    "the two absences are never collapsed into one",
  );

  /* A FINITE COUNT WINS OVER A CONTRADICTORY FLAG. The flag explains an absence; where there is no
   * absence there is nothing for it to explain, and a reported number is not discarded. */
  const contradictory = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel(9, true, 1, 2))),
  );
  assert.equal(contradictory.status, "single-measurement");
  if (contradictory.status !== "single-measurement") return;
  assert.equal(contradictory.point.subscriberCount, 9, "a reported count is kept");
  assert.equal(contradictory.point.subscriberCountAbsence, null, "and no absence is invented for it");

  /* ═══ 5. ORDER IS NORMALISED TO OLDEST FIRST ═════════════════════════════ */
  const newestFirst = readOf(
    stored("2026-09-10T11:00:20.489Z", channel(0, false, 0, 0)),
    stored("2026-09-09T10:00:20.919Z", channel(0, false, 0, 0)),
    stored("2026-09-08T09:03:57.382Z", channel(0, false, 0, 0)),
    stored("2026-09-07T14:40:20.113Z", channel(0, false, 0, 0)),
  );
  const series = deriveYouTubeChannelMeasurementSeries(newestFirst);
  assert.equal(series.status, "series", "four usable measurements are a series");
  if (series.status !== "series") return;
  assert.deepEqual(
    series.points.map((p) => p.observedAt),
    [
      "2026-09-07T14:40:20.113Z",
      "2026-09-08T09:03:57.382Z",
      "2026-09-09T10:00:20.919Z",
      "2026-09-10T11:00:20.489Z",
    ],
    "OLDEST FIRST, whatever order the seam returned — a series reads forwards in time",
  );
  assert.equal(series.observationsConsidered, 4);

  /* THE REAL PRODUCTION SERIES IS FLAT AT ZERO, AND THAT IS A RESULT. */
  assert.ok(
    series.points.every((p) => p.subscriberCount === 0 && p.videoCount === 0 && p.viewCount === 0),
    "four honest zeros stay four honest zeros — a flat series is evidence, not an empty one",
  );

  const oldestFirst = readOf(
    stored("2026-09-07T14:40:20.113Z", channel(0, false, 0, 0)),
    stored("2026-09-08T09:03:57.382Z", channel(0, false, 0, 0)),
    stored("2026-09-09T10:00:20.919Z", channel(0, false, 0, 0)),
    stored("2026-09-10T11:00:20.489Z", channel(0, false, 0, 0)),
  );
  assert.deepEqual(
    deriveYouTubeChannelMeasurementSeries(oldestFirst),
    series,
    "the derivation is order-independent — it normalises rather than trusting the caller",
  );

  /* ═══ 6. MALFORMED FACTS NARROW, THEY DO NOT PARSE ═══════════════════════ */
  const malformed = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel("0", false, Number.NaN, { total: 3 }))),
  );
  assert.equal(
    malformed.status,
    "no-usable-measurements",
    "a numeric STRING, NaN and a shape are none of them counts — so nothing measurable remains",
  );

  const partly = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel("12", false, 12, []))),
  );
  assert.equal(partly.status, "single-measurement");
  if (partly.status !== "single-measurement") return;
  assert.equal(partly.point.subscriberCount, null, "a numeric string is not repaired into 12");
  assert.equal(partly.point.videoCount, 12);
  assert.equal(partly.point.viewCount, null);

  /* A NON-BOOLEAN hidden FLAG IS NOT A HIDDEN CHANNEL. */
  const badFlag = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("2026-09-07T14:40:20.113Z", channel(null, "true", 1, 1))),
  );
  assert.equal(badFlag.status, "single-measurement");
  if (badFlag.status !== "single-measurement") return;
  assert.equal(
    badFlag.point.subscriberCountAbsence,
    "not-reported",
    'the STRING "true" is not the boolean the contract specifies — it does not prove hiding',
  );

  /* An observation with no usable instant contributes nothing. */
  const instantless = deriveYouTubeChannelMeasurementSeries(
    readOf(stored("", channel(0, false, 0, 0)), stored("2026-09-07T14:40:20.113Z", channel(0, false, 0, 0))),
  );
  assert.equal(instantless.status, "single-measurement", "a measurement with no instant is not a measurement");

  /* ═══ 7. NOTHING IS CALCULATED ═══════════════════════════════════════════ */
  assert.deepEqual(
    Object.keys(series.points[0]!).sort(),
    ["observedAt", "subscriberCount", "subscriberCountAbsence", "videoCount", "viewCount"],
    "a measurement point carries the reported counts, the absence reason, and the observed instant",
  );
  assert.deepEqual(
    Object.keys(series).sort(),
    ["observationsConsidered", "points", "status"],
    "and the series itself carries no computed summary",
  );
  const shape = JSON.stringify(series);
  for (const derived of ["delta", "change", "growth", "rate", "trend", "percent", "average", "engagement", "score"]) {
    assert.ok(!new RegExp(derived, "i").test(shape), `the result contains no \`${derived}\` field`);
  }

  /* ═══ 8. PURE AND DETERMINISTIC ══════════════════════════════════════════ */
  assert.deepEqual(
    deriveYouTubeChannelMeasurementSeries(newestFirst),
    deriveYouTubeChannelMeasurementSeries(newestFirst),
    "the same input yields the same output — no clock, no randomness",
  );
  assert.ok(Object.isFrozen(series), "the result is frozen");
  assert.ok(Object.isFrozen(series.points[0]), "and so is each point");

  /* ═══ THE BOUND IS A DECISION, NOT THE CEILING ═══════════════════════════ */
  assert.equal(YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT, 30, "the recommended history bound");
  assert.ok(
    YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT < MAX_OBSERVATIONS_PER_READ,
    "chosen BELOW the seam's maximum — availability is not a reason to ask for everything",
  );

  /* ═══ THE SENTENCES REFUSE TO CALL A ZERO AN ABSENCE ═════════════════════ */
  const sentences = Object.values(YOUTUBE_CHANNEL_SERIES_SENTENCES);
  assert.equal(new Set(sentences).size, sentences.length, "each state says something different");
  const allText = sentences.join(" ");
  for (const f of ["unchanged", "stable", "flat", "no growth", "0%"] as const) {
    assert.ok(!new RegExp(f, "i").test(allText), `no sentence claims \`${f}\``);
  }
  assert.ok(
    /not a comparison/i.test(YOUTUBE_CHANNEL_SERIES_SENTENCES["single-measurement"]),
    "the single-measurement sentence says plainly that nothing can be compared yet",
  );
  assert.ok(
    /unknown/i.test(YOUTUBE_CHANNEL_SERIES_SENTENCES["persistence-unavailable"]),
    "an unavailable read is admitted as ignorance, not reported as an absence",
  );

  console.log(
    "youtube-social-intelligence/channel-series-behaviour: five states distinguished, one " +
      "measurement is not a series, real zero preserved, hidden != not-reported, malformed " +
      "narrows, order normalised oldest-first, nothing calculated, pure and frozen",
  );
}

main();
