/*
 * YT-SOC2 · comparing two YouTube channel measurements — the first HEBUN CALCULATED value in the
 * Social Intelligence line.
 *
 * WHAT THIS PROVES — properties, not tokens (TRH-IG7):
 *
 *   1. A comparison exists only when TWO usable measurements exist. One is not a comparison.
 *   2. 0 → 0 gives change 0. THIS IS THE PRODUCTION CASE and it is a real calculation, not an
 *      empty state.
 *   3. Every metric is comparable INDEPENDENTLY. A hidden subscriber count does not void the
 *      video and view comparisons beside it.
 *   4. A missing endpoint is never given a baseline of zero. No previous value, no comparison.
 *   5. A subscriber gap keeps the YT-SOC1 reason — hidden-by-channel is not not-reported.
 *   6. Both endpoints are carried beside the computed number, so the arithmetic can be rechecked
 *      against the evidence it came from (the `elapsedSince` precedent).
 *   7. No percentage, rate, direction, verdict or recommendation exists anywhere in the contract.
 *
 * Pure: no database, no network, no provider, no credential, no tenant, no clock.
 */
import assert from "node:assert/strict";
import {
  compareYouTubeChannelMeasurements,
  YOUTUBE_CHANNEL_COMPARISON_SENTENCES,
} from "../../src/features/youtube-channel-surface/channel-measurement-comparison";
import { deriveYouTubeChannelMeasurementSeries } from "../../src/features/youtube-channel-surface/channel-measurement-series";
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

function stored(observedAt: string, facts: Record<string, unknown>): StoredProviderObservation {
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
/** The whole released pipeline: stored observations → series → comparison. */
const compareOf = (result: ProviderObservationReadResult) =>
  compareYouTubeChannelMeasurements(deriveYouTubeChannelMeasurementSeries(result));

let reachedEnd = false;

function main(): void {
  /* ═══ 1. NO EVIDENCE STATE IS COLLAPSED ═════════════════════════════════ */
  assert.deepEqual(
    compareOf({ status: "unavailable", reason: "persistence-unavailable" }),
    { status: "unavailable", reason: "persistence-unavailable" },
    "an unavailable read stays unavailable — never a comparison of nothing",
  );
  assert.equal(compareOf(readOf()).status, "no-observations", "zero observations is its own answer");

  const blind = compareOf(readOf(stored("2026-09-07T14:40:20.113Z", channel(null, false, null, null))));
  assert.equal(blind.status, "no-usable-measurements", "observations reporting nothing measure nothing");

  /* ═══ 2. ONE MEASUREMENT IS NOT A COMPARISON ════════════════════════════ */
  const one = compareOf(readOf(stored("2026-09-07T14:40:20.113Z", channel(0, false, 0, 0))));
  assert.equal(
    one.status,
    "insufficient-history",
    "one usable measurement cannot be compared — and that is a state, not an error",
  );
  if (one.status !== "insufficient-history") return;
  assert.equal(one.measurementsAvailable, 1);
  assert.ok(!("change" in one), "nothing calculated is exposed when nothing could be calculated");

  /* ═══ 3. THE PRODUCTION CASE: 0 → 0 IS A REAL CALCULATION ═══════════════
   *
   * This is exactly what this tenant's channel holds: four observations, every count a genuine
   * zero. The change is 0 — computed, not absent — and a surface must be able to say so.
   */
  const flat = compareOf(
    readOf(
      stored("2026-09-10T11:00:20.489Z", channel(0, false, 0, 0)),
      stored("2026-09-09T10:00:20.919Z", channel(0, false, 0, 0)),
      stored("2026-09-08T09:03:57.382Z", channel(0, false, 0, 0)),
      stored("2026-09-07T14:40:20.113Z", channel(0, false, 0, 0)),
    ),
  );
  assert.equal(flat.status, "compared", "four zero measurements still produce a comparison");
  if (flat.status !== "compared") return;
  assert.equal(flat.subscriberCount.status, "comparable");
  if (flat.subscriberCount.status !== "comparable") return;
  assert.equal(flat.subscriberCount.previous, 0);
  assert.equal(flat.subscriberCount.latest, 0);
  assert.equal(flat.subscriberCount.change, 0, "0 → 0 is a change of 0, calculated");
  assert.notEqual(flat.subscriberCount.change, null, "and it is NEVER null");
  /* The other two metrics travel a different code path and must reach the same answer. */
  assert.equal(flat.videoCount.status, "comparable", "0 → 0 videos is comparable, not empty");
  assert.equal(
    flat.videoCount.status === "comparable" && flat.videoCount.change,
    0,
    "0 → 0 videos is a change of 0, calculated",
  );
  assert.equal(flat.viewCount.status, "comparable", "0 → 0 views is comparable, not empty");
  assert.equal(
    flat.viewCount.status === "comparable" && flat.viewCount.change,
    0,
    "0 → 0 views is a change of 0, calculated",
  );

  /* ═══ 4. THE WINDOW IS THE TWO MOST RECENT, AND IT IS STATED ════════════
   *
   * With four measurements the comparison is between the last two — never the first and last, and
   * never "the most recent pair that happens to be comparable", which would silently vary the
   * window and hide a gap. Both instants are carried so the arithmetic can be rechecked.
   */
  assert.equal(
    flat.previousObservedAt,
    "2026-09-09T10:00:20.919Z",
    "previous is the SECOND-NEWEST measurement — not the oldest, and not the latest",
  );
  assert.equal(flat.latestObservedAt, "2026-09-10T11:00:20.489Z");
  assert.equal(flat.observationsConsidered, 4);
  assert.ok(
    flat.previousObservedAt < flat.latestObservedAt,
    "previous is genuinely earlier — chronology is deterministic regardless of the seam's order",
  );

  /* ═══ 5. POSITIVE, NEGATIVE AND ZERO ARE ALL REAL RESULTS ═══════════════ */
  const rising = compareOf(
    readOf(
      stored("2026-09-08T09:00:00.000Z", channel(57, false, 12, 900)),
      stored("2026-09-07T09:00:00.000Z", channel(56, false, 10, 1000)),
    ),
  );
  assert.equal(rising.status, "compared");
  if (rising.status !== "compared") return;
  assert.equal(rising.subscriberCount.status === "comparable" && rising.subscriberCount.change, 1, "56 → 57 is +1");
  assert.equal(rising.videoCount.status === "comparable" && rising.videoCount.change, 2, "10 → 12 is +2");
  assert.equal(
    rising.viewCount.status === "comparable" && rising.viewCount.change,
    -100,
    "1000 → 900 is -100 — a decrease is reported as readily as an increase",
  );

  /* ═══ 6. EVERY METRIC IS COMPARABLE INDEPENDENTLY ═══════════════════════ */
  const hiddenSubs = compareOf(
    readOf(
      stored("2026-09-08T09:00:00.000Z", channel(null, true, 12, 900)),
      stored("2026-09-07T09:00:00.000Z", channel(56, false, 10, 800)),
    ),
  );
  assert.equal(hiddenSubs.status, "compared");
  if (hiddenSubs.status !== "compared") return;
  assert.equal(
    hiddenSubs.subscriberCount.status,
    "not-comparable",
    "a hidden latest subscriber count cannot be compared",
  );
  assert.equal(
    hiddenSubs.videoCount.status === "comparable" && hiddenSubs.videoCount.change,
    2,
    "but the video comparison beside it is unaffected",
  );
  assert.equal(
    hiddenSubs.viewCount.status === "comparable" && hiddenSubs.viewCount.change,
    100,
    "and so is the view comparison",
  );

  /* ═══ 7. A GAP KEEPS ITS YT-SOC1 REASON ═════════════════════════════════ */
  if (hiddenSubs.subscriberCount.status !== "not-comparable") return;
  assert.equal(hiddenSubs.subscriberCount.gap, "latest-not-reported");
  assert.equal(
    hiddenSubs.subscriberCount.latestAbsence,
    "hidden-by-channel",
    "the channel HIDES it — a deliberate choice by its owner",
  );
  assert.equal(hiddenSubs.subscriberCount.previousAbsence, null, "while the earlier count was reported");
  assert.equal(hiddenSubs.subscriberCount.previous, 56, "and that reported value is still carried");
  assert.equal(hiddenSubs.subscriberCount.latest, null, "the hidden one is null — NEVER zero");

  const omittedSubs = compareOf(
    readOf(
      stored("2026-09-08T09:00:00.000Z", channel(null, false, 12, 900)),
      stored("2026-09-07T09:00:00.000Z", channel(56, false, 10, 800)),
    ),
  );
  assert.equal(omittedSubs.status, "compared");
  assert.equal(omittedSubs.status, "compared");
  assert.equal(omittedSubs.subscriberCount.status, "not-comparable", "an omitted latest count cannot be compared");
  if (omittedSubs.status !== "compared" || omittedSubs.subscriberCount.status !== "not-comparable") return;
  assert.equal(
    omittedSubs.subscriberCount.latestAbsence,
    "not-reported",
    "YouTube not reporting is a DIFFERENT fact from the channel hiding — never collapsed",
  );
  assert.notEqual(
    omittedSubs.subscriberCount.latestAbsence,
    hiddenSubs.subscriberCount.latestAbsence,
    "the two absences stay distinguishable all the way through the comparison",
  );

  /* ═══ 8. A MISSING PREVIOUS IS NEVER A BASELINE OF ZERO ═════════════════ */
  const noPrevious = compareOf(
    readOf(
      stored("2026-09-08T09:00:00.000Z", channel(57, false, 12, 900)),
      stored("2026-09-07T09:00:00.000Z", channel(null, false, 10, 800)),
    ),
  );
  assert.equal(noPrevious.status, "compared");
  assert.equal(noPrevious.status, "compared");
  assert.equal(noPrevious.subscriberCount.status, "not-comparable", "no previous subscriber count, no comparison");
  if (noPrevious.status !== "compared" || noPrevious.subscriberCount.status !== "not-comparable") return;
  assert.equal(noPrevious.subscriberCount.gap, "previous-not-reported");
  assert.equal(
    noPrevious.subscriberCount.previous,
    null,
    "an unreported baseline stays null — 57 is NOT reported as +57 from an invented zero",
  );
  assert.notEqual(noPrevious.subscriberCount.previous, 0, "NEVER zero");
  assert.equal(noPrevious.subscriberCount.latest, 57, "the reported latest value is still carried");

  /*
   * AND THE SAME RULE HOLDS FOR THE OTHER TWO METRICS.
   *
   * Subscribers travel through their own comparison function because they alone carry an absence
   * reason. Videos and views go through the generic one — a separate code path with the same
   * obligation, and one a bite-proof caught having no test at all: zeroing the baseline there passed
   * every assertion above.
   */
  const noPreviousVideo = compareOf(
    readOf(
      stored("2026-09-08T09:00:00.000Z", channel(57, false, 12, 900)),
      stored("2026-09-07T09:00:00.000Z", channel(56, false, null, undefined)),
    ),
  );
  assert.equal(noPreviousVideo.status, "compared");
  if (noPreviousVideo.status !== "compared") return;
  assert.equal(noPreviousVideo.videoCount.status, "not-comparable", "no previous video count, no comparison");
  if (noPreviousVideo.videoCount.status !== "not-comparable") return;
  assert.equal(noPreviousVideo.videoCount.gap, "previous-not-reported");
  assert.equal(
    noPreviousVideo.videoCount.previous,
    null,
    "an unreported video baseline stays null — 12 is NOT reported as +12 from an invented zero",
  );
  assert.notEqual(noPreviousVideo.videoCount.previous, 0, "NEVER zero");
  assert.equal(noPreviousVideo.videoCount.latest, 12, "while the reported latest value is carried");
  assert.equal(noPreviousVideo.viewCount.status, "not-comparable", "and the same for views");
  if (noPreviousVideo.viewCount.status !== "not-comparable") return;
  assert.equal(
    noPreviousVideo.viewCount.previous,
    null,
    "an unreported view baseline stays null — 900 is NOT a change from an invented zero",
  );
  assert.notEqual(noPreviousVideo.viewCount.previous, 0, "NEVER zero");
  assert.equal(
    noPreviousVideo.subscriberCount.status === "comparable" && noPreviousVideo.subscriberCount.change,
    1,
    "and subscribers remain comparable beside them — metrics stay independent in both directions",
  );

  const neither = compareOf(
    readOf(
      stored("2026-09-08T09:00:00.000Z", channel(null, false, 12, 900)),
      stored("2026-09-07T09:00:00.000Z", channel(null, false, 10, 800)),
    ),
  );
  assert.equal(neither.status, "compared");
  assert.equal(neither.status, "compared");
  assert.equal(neither.subscriberCount.status, "not-comparable", "neither side reported, no comparison");
  if (neither.status !== "compared" || neither.subscriberCount.status !== "not-comparable") return;
  assert.equal(neither.subscriberCount.gap, "neither-reported");

  /* ═══ 9. MALFORMED VALUES ARE NOT REPAIRED INTO A COMPARISON ════════════ */
  const malformed = compareOf(
    readOf(
      stored("2026-09-08T09:00:00.000Z", channel("57", false, 12, 900)),
      stored("2026-09-07T09:00:00.000Z", channel("56", false, 10, 800)),
    ),
  );
  assert.equal(malformed.status, "compared");
  if (malformed.status !== "compared") return;
  assert.equal(
    malformed.subscriberCount.status,
    "not-comparable",
    'the STRINGS "56" and "57" are not counts, so there is no +1 to report',
  );

  /* ═══ 10. NOTHING BUT THE ARITHMETIC ════════════════════════════════════ */
  assert.deepEqual(
    Object.keys(flat).sort(),
    [
      "latestObservedAt",
      "observationsConsidered",
      "previousObservedAt",
      "status",
      "subscriberCount",
      "videoCount",
      "viewCount",
    ],
    "a comparison carries the three metrics, both instants and the count considered — nothing else",
  );
  assert.deepEqual(
    Object.keys(flat.videoCount).sort(),
    ["change", "latest", "previous", "status"],
    "a comparable metric carries both endpoints beside the computed change, so it can be rechecked",
  );
  const shape = JSON.stringify(flat);
  for (const banned of ["percent", "rate", "growth", "trend", "direction", "up", "down", "score", "velocity", "forecast"]) {
    assert.ok(!new RegExp(`"[^"]*${banned}[^"]*"\\s*:`, "i").test(shape), `no \`${banned}\` field`);
  }

  /* ═══ 11. PURE AND DETERMINISTIC ════════════════════════════════════════ */
  const input = readOf(
    stored("2026-09-08T09:00:00.000Z", channel(57, false, 12, 900)),
    stored("2026-09-07T09:00:00.000Z", channel(56, false, 10, 800)),
  );
  assert.deepEqual(compareOf(input), compareOf(input), "same input, same output — no clock, no randomness");
  assert.ok(Object.isFrozen(flat), "the result is frozen");

  /* ═══ 12. THE SENTENCES DO NOT INTERPRET ════════════════════════════════ */
  const sentences = Object.values(YOUTUBE_CHANNEL_COMPARISON_SENTENCES);
  assert.equal(new Set(sentences).size, sentences.length, "each state says something different");
  const allText = sentences.join(" ");
  for (const f of ["growing", "declining", "improving", "healthy", "should", "recommend", "%"] as const) {
    assert.ok(!new RegExp(f, "i").test(allText), `no sentence claims \`${f}\``);
  }

  reachedEnd = true;
  console.log(
    "youtube-social-intelligence/channel-comparison-behaviour: one is not a comparison, 0→0 is a " +
      "calculated 0, metrics compare independently, hidden != not-reported, no invented baseline, " +
      "malformed not repaired, endpoints carried, pure and frozen",
  );
}

main();

/*
 * AN EARLY RETURN MUST NEVER LOOK LIKE SUCCESS.
 *
 * The narrowing guards above are written `if (x.status !== "...") return;`, which exits `main()`
 * silently — the process still ends 0 and the suite reports PASS with most of its assertions never
 * executed. A bite-proof found exactly that: a mutation changed a status, the suite returned early,
 * and it looked green. This converts any early exit into a failure.
 */
assert.ok(
  reachedEnd,
  "the behaviour suite returned early — a narrowing guard exited main() before the end, so the " +
    "assertions after it never ran and a PASS here would have meant nothing",
);
