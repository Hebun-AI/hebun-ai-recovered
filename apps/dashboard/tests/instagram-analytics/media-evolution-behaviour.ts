/*
 * IG-AN3 — what the Instagram per-post measurement evolution may and may not say.
 *
 * ── THE ONE SENTENCE UNDER TEST ─────────────────────────────────────────────
 *
 *   "For the post Instagram identifies as M, the count Instagram reported at the instant Hebun
 *    observed T₁ and the count it reported at T₂ differ by N."
 *
 * Every assertion below is about a value a human would read, not a token the module happens to
 * contain. Zero is asserted as a RESULT throughout, because the production evidence that unblocked
 * this phase is two real unattended observations in which all eight posts reported the SAME counts —
 * and a comparison that cannot say "0" honestly is worse than no comparison at all.
 */
import assert from "node:assert/strict";
import {
  deriveInstagramMediaEvolution,
  INSTAGRAM_MEDIA_EVOLUTION_SENTENCES,
  INSTAGRAM_MEDIA_GAP_NOTES,
  INSTAGRAM_MEDIA_UNMATCHED_NOTES,
  MEDIA_EVOLUTION_OBSERVATION_LIMIT,
  type InstagramMediaEvolution,
  type InstagramMediaEvolutionItem,
} from "../../src/features/instagram-connection-surface/media-measurement-evolution";
import type { StoredProviderObservation } from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
} from "../../src/features/provider-instagram/contracts";

/* ── Fixtures ──────────────────────────────────────────────────────────────── */

/**
 * `media` is typed `unknown` on purpose: the malformed-shape cases below hand this a string and a
 * `null`, and a fixture that could not express what the provider might actually store would only
 * ever test the happy shape.
 */
function stored(observedAt: string, media: unknown): StoredProviderObservation {
  return Object.freeze({
    observationId: "11111111-1111-4111-8111-111111111111",
    providerKey: INSTAGRAM_PROVIDER_KEY,
    capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
    subjectKind: "instagram-account",
    subjectRef: "instagram/account/test",
    integrationId: "22222222-2222-4222-8222-222222222222",
    observedAt,
    recordedAt: observedAt,
    provenance: "standing-authorization",
    observedByActorType: null,
    standingAuthorizationId: "33333333-3333-4333-8333-333333333333",
    invocationId: "44444444-4444-4444-8444-444444444444",
    facts: {
      accountId: "acct",
      recentMediaCount: Array.isArray(media) ? media.length : null,
      moreMediaExist: false,
      recentMedia: media,
    },
  }) as unknown as StoredProviderObservation;
}

/** The released read seam returns NEWEST FIRST; fixtures must reproduce that, not a tidy order. */
const read = (rows: readonly StoredProviderObservation[]): ProviderObservationReadResult =>
  ({ status: "read", observations: [...rows].reverse() }) as unknown as ProviderObservationReadResult;

/** One media entry, with every field the released mapper writes. */
const post = (
  mediaId: string,
  likeCount: number | null,
  commentCount: number | null,
  extra: Record<string, unknown> = {},
): Record<string, unknown> => ({
  mediaId,
  mediaType: "IMAGE",
  caption: `caption for ${mediaId}`,
  permalink: `https://www.instagram.com/p/${mediaId}/`,
  publishedAt: "2026-09-01T00:00:00.000Z",
  likeCount,
  commentCount,
  ...extra,
});

const T1 = "2026-09-10T14:00:19.320Z";
const T2 = "2026-09-11T14:00:21.998Z";

const compared = (evolution: InstagramMediaEvolution) => {
  assert.equal(evolution.status, "compared", `expected a comparison, got "${evolution.status}"`);
  return evolution as Extract<InstagramMediaEvolution, { status: "compared" }>;
};

const itemOf = (evolution: InstagramMediaEvolution, mediaId: string): InstagramMediaEvolutionItem => {
  const found = compared(evolution).items.find((i) => i.mediaId === mediaId);
  assert.ok(found, `expected an item for mediaId ${mediaId}`);
  return found;
};

/* ── 1 · identity is the mediaId, and only the mediaId ─────────────────────── */

function theSameMediaIdMatchesAcrossObservations(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 32, 4)]), stored(T2, [post("M1", 47, 7)])]),
  );
  const item = itemOf(evolution, "M1");
  assert.equal(item.likeCount.status, "comparable");
  assert.equal(item.likeCount.status === "comparable" ? item.likeCount.change : null, 15);
  assert.equal(item.commentCount.status === "comparable" ? item.commentCount.change : null, 3);
}

function arrayOrderDoesNotDetermineIdentity(): void {
  /*
   * THE SAME TWO POSTS, REVERSED IN THE LATER OBSERVATION. If position were the identity, M1 would
   * be matched against M2 and both deltas would be wrong — which is exactly the silent, plausible
   * failure this assertion exists to catch.
   */
  const evolution = deriveInstagramMediaEvolution(
    read([
      stored(T1, [post("M1", 10, 1), post("M2", 100, 20)]),
      stored(T2, [post("M2", 105, 22), post("M1", 12, 2)]),
    ]),
  );
  const m1 = itemOf(evolution, "M1");
  const m2 = itemOf(evolution, "M2");
  assert.equal(m1.likeCount.status === "comparable" ? m1.likeCount.change : null, 2);
  assert.equal(m2.likeCount.status === "comparable" ? m2.likeCount.change : null, 5);
}

function aChangedCaptionDoesNotBreakOrCreateIdentity(): void {
  /* THE SAME POST, EDITED. Identity must survive it. */
  const evolution = deriveInstagramMediaEvolution(
    read([
      stored(T1, [post("M1", 4, 0, { caption: "the original text" })]),
      stored(T2, [post("M1", 4, 0, { caption: "the edited text" })]),
    ]),
  );
  const item = itemOf(evolution, "M1");
  assert.equal(item.likeCount.status, "comparable");
  /* THE LATEST OBSERVATION'S CONTENT, because it is the more recent thing Instagram said. */
  assert.equal(item.caption, "the edited text");

  /* TWO DIFFERENT POSTS SHARING A CAPTION ARE STILL TWO POSTS. */
  const shared = deriveInstagramMediaEvolution(
    read([
      stored(T1, [post("M1", 1, 0, { caption: "same words" })]),
      stored(T2, [post("M2", 9, 0, { caption: "same words" })]),
    ]),
  );
  assert.equal(shared.status, "no-matching-media", "a shared caption is not a shared identity");
}

function thePermalinkDoesNotDetermineIdentity(): void {
  /* A POST WHOSE PERMALINK CHANGED is still the same post. */
  const moved = deriveInstagramMediaEvolution(
    read([
      stored(T1, [post("M1", 4, 0, { permalink: "https://www.instagram.com/p/old/" })]),
      stored(T2, [post("M1", 6, 0, { permalink: "https://www.instagram.com/p/new/" })]),
    ]),
  );
  assert.equal(itemOf(moved, "M1").likeCount.status, "comparable");

  /* TWO POSTS SHARING A PERMALINK are not thereby one post. */
  const shared = deriveInstagramMediaEvolution(
    read([
      stored(T1, [post("M1", 1, 0, { permalink: "https://www.instagram.com/p/same/" })]),
      stored(T2, [post("M2", 9, 0, { permalink: "https://www.instagram.com/p/same/" })]),
    ]),
  );
  assert.equal(shared.status, "no-matching-media", "a shared permalink is not a shared identity");
}

function aCloseTimestampDoesNotDetermineIdentity(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([
      stored(T1, [post("M1", 1, 0, { publishedAt: "2026-09-01T00:00:00.000Z" })]),
      stored(T2, [post("M2", 9, 0, { publishedAt: "2026-09-01T00:00:00.000Z" })]),
    ]),
  );
  assert.equal(evolution.status, "no-matching-media", "an identical publication time is not identity");
}

function anEntryWithNoMediaIdIsUnmatchableAndDropped(): void {
  const entry = post("M1", 5, 1);
  delete (entry as Record<string, unknown>).mediaId;
  const evolution = deriveInstagramMediaEvolution(read([stored(T1, [entry]), stored(T2, [entry])]));
  assert.equal(
    evolution.status,
    "no-usable-media",
    "an unidentifiable post is never given a synthetic key so it can be matched",
  );
}

/* ── 2 · posts present on only one side ────────────────────────────────────── */

function aPostOnlyInTheLatestIsCountedAndNotComparedToZero(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 4, 0)]), stored(T2, [post("M1", 4, 0), post("M2", 9, 3)])]),
  );
  const block = compared(evolution);
  assert.equal(block.items.length, 1, "only the matched post is compared");
  assert.equal(block.items[0]!.mediaId, "M1");
  assert.equal(block.onlyInLatest, 1);
  assert.equal(block.onlyInPrevious, 0);
  assert.ok(
    !block.items.some((i) => i.mediaId === "M2"),
    "a first sighting has no baseline and must not appear as a change from nothing",
  );
  assert.ok(
    !/new engagement|gained|growth/i.test(INSTAGRAM_MEDIA_UNMATCHED_NOTES.onlyInLatest),
    "the sentence states what Hebun holds, not what happened",
  );
}

function aPostOnlyInThePreviousIsCountedAndNotTreatedAsDeleted(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 4, 0), post("M0", 2, 0)]), stored(T2, [post("M1", 4, 0)])]),
  );
  const block = compared(evolution);
  assert.equal(block.items.length, 1);
  assert.equal(block.onlyInPrevious, 1);
  assert.equal(block.onlyInLatest, 0);
  assert.ok(
    /not a statement that they were removed/i.test(INSTAGRAM_MEDIA_UNMATCHED_NOTES.onlyInPrevious),
    "falling out of a bounded window is not deletion",
  );
}

/* ── 3 · zero is real, and missing is not zero ─────────────────────────────── */

function aReportedZeroIsARealValue(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 0, 0)]), stored(T2, [post("M1", 0, 0)])]),
  );
  const item = itemOf(evolution, "M1");
  assert.equal(item.likeCount.status, "comparable", "a reported 0 is a reported count");
  assert.equal(item.likeCount.status === "comparable" ? item.likeCount.previous : null, 0);
  assert.equal(item.commentCount.status, "comparable");
  assert.equal(item.commentCount.status === "comparable" ? item.commentCount.change : null, 0);
}

function aZeroGrowingIsStillComparable(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 0, 0)]), stored(T2, [post("M1", 3, 1)])]),
  );
  const item = itemOf(evolution, "M1");
  assert.equal(item.likeCount.status === "comparable" ? item.likeCount.change : null, 3);
  assert.equal(item.commentCount.status === "comparable" ? item.commentCount.change : null, 1);
}

function amissingCountIsNeverZero(): void {
  for (const missing of [undefined, null, "5", Number.NaN, true, {}]) {
    const evolution = deriveInstagramMediaEvolution(
      read([
        stored(T1, [post("M1", missing as never, missing as never)]),
        stored(T2, [post("M1", 7, 2)]),
      ]),
    );
    const item = itemOf(evolution, "M1");
    assert.equal(item.likeCount.status, "not-comparable", `"${String(missing)}" is not a count`);
    assert.equal(item.likeCount.status === "not-comparable" ? item.likeCount.gap : null, "previous-not-reported");
    assert.equal(item.likeCount.status === "not-comparable" ? item.likeCount.previous : "x", null);
    /* THE PRESENT ENDPOINT SURVIVES. It is not discarded because its partner is missing. */
    assert.equal(item.likeCount.status === "not-comparable" ? item.likeCount.latest : null, 7);
    assert.ok(!("change" in item.likeCount), "a non-comparable metric has no `change` field at all");
    assert.equal(item.commentCount.status, "not-comparable");
  }
}

function eachMetricIsEvaluatedIndependently(): void {
  /* LIKES COMPARABLE, COMMENTS NOT. */
  const a = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 10, null)]), stored(T2, [post("M1", 14, 3)])]),
  );
  const itemA = itemOf(a, "M1");
  assert.equal(itemA.likeCount.status, "comparable");
  assert.equal(itemA.likeCount.status === "comparable" ? itemA.likeCount.change : null, 4);
  assert.equal(itemA.commentCount.status, "not-comparable");
  assert.equal(itemA.commentCount.status === "not-comparable" ? itemA.commentCount.gap : null, "previous-not-reported");

  /* COMMENTS COMPARABLE, LIKES NOT. */
  const b = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 10, 3)]), stored(T2, [post("M1", null, 5)])]),
  );
  const itemB = itemOf(b, "M1");
  assert.equal(itemB.commentCount.status, "comparable");
  assert.equal(itemB.commentCount.status === "comparable" ? itemB.commentCount.change : null, 2);
  assert.equal(itemB.likeCount.status, "not-comparable");
  assert.equal(itemB.likeCount.status === "not-comparable" ? itemB.likeCount.gap : null, "latest-not-reported");

  /* NEITHER SIDE REPORTED is its own gap, and the item is still returned. */
  const c = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", null, 3)]), stored(T2, [post("M1", null, 4)])]),
  );
  const itemC = itemOf(c, "M1");
  assert.equal(itemC.likeCount.status === "not-comparable" ? itemC.likeCount.gap : null, "neither-reported");
  assert.equal(itemC.commentCount.status === "comparable" ? itemC.commentCount.change : null, 1);
}

function anItemIsNotDiscardedForOneUnavailableMetric(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", null, null)]), stored(T2, [post("M1", null, null)])]),
  );
  const block = compared(evolution);
  assert.equal(block.items.length, 1, "a matched post with no comparable metric is still a matched post");
  assert.equal(block.items[0]!.likeCount.status, "not-comparable");
  assert.equal(block.items[0]!.commentCount.status, "not-comparable");
}

/* ── 4 · the arithmetic ────────────────────────────────────────────────────── */

function theSignIsTheArithmeticAndNotAJudgement(): void {
  const cases: readonly [number, number, number][] = [
    [32, 47, 15],
    [7, 7, 0],
    [10, 4, -6],
  ];
  for (const [previous, latest, expected] of cases) {
    const evolution = deriveInstagramMediaEvolution(
      read([stored(T1, [post("M1", previous, previous)]), stored(T2, [post("M1", latest, latest)])]),
    );
    const item = itemOf(evolution, "M1");
    assert.equal(
      item.likeCount.status === "comparable" ? item.likeCount.change : null,
      expected,
      `${latest} - ${previous} is ${expected}`,
    );
    assert.equal(
      item.commentCount.status === "comparable" ? item.commentCount.change : null,
      expected,
    );
  }
}

/* ── 5 · the states, none collapsed into another ───────────────────────────── */

function anUnavailableReadStaysUnavailable(): void {
  for (const reason of ["unauthenticated", "persistence-unavailable"] as const) {
    const evolution = deriveInstagramMediaEvolution({ status: "unavailable", reason });
    assert.equal(evolution.status, "unavailable");
    assert.equal(evolution.status === "unavailable" ? evolution.reason : null, reason);
    assert.ok(
      /unknown/i.test(INSTAGRAM_MEDIA_EVOLUTION_SENTENCES[reason]),
      "a failed read is reported as unknown, never as nothing changed",
    );
  }
}

function noObservationsIsNotNoChange(): void {
  const evolution = deriveInstagramMediaEvolution({ status: "read", observations: [] } as never);
  assert.equal(evolution.status, "no-observations");
  assert.ok(
    /nothing was asked of Instagram and nothing failed/i.test(
      INSTAGRAM_MEDIA_EVOLUTION_SENTENCES["no-observations"],
    ),
    "an empty history is a fact about Hebun's records, not a failure and not a verdict",
  );
}

function observationsWithoutIdentifiableMediaAreNamedAsSuch(): void {
  for (const facts of [[], "not-an-array", null] as const) {
    const evolution = deriveInstagramMediaEvolution(
      read([
        stored(T1, facts),
        stored(T2, facts),
      ]),
    );
    assert.equal(
      evolution.status,
      "no-usable-media",
      "observations that carry no identifiable post are not no-observations",
    );
    assert.equal(
      evolution.status === "no-usable-media" ? evolution.observationsConsidered : null,
      2,
      "the observations are still counted — they existed",
    );
  }
}

function oneUsableObservationIsInsufficientHistory(): void {
  const evolution = deriveInstagramMediaEvolution(read([stored(T2, [post("M1", 4, 0)])]));
  assert.equal(evolution.status, "insufficient-history");
  assert.equal(evolution.status === "insufficient-history" ? evolution.observationsWithMedia : null, 1);
  assert.ok(
    /will not compare a count against an assumed starting point/i.test(
      INSTAGRAM_MEDIA_EVOLUTION_SENTENCES["insufficient-history"],
    ),
    "one observation is a measurement, not a comparison",
  );
}

function twoObservationsWithNoSharedPostIsItsOwnState(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("A", 1, 0), post("B", 2, 0)]), stored(T2, [post("C", 3, 0)])]),
  );
  assert.equal(
    evolution.status,
    "no-matching-media",
    "history exists and nothing matched — that is not insufficient history",
  );
  const block = evolution as Extract<InstagramMediaEvolution, { status: "no-matching-media" }>;
  assert.equal(block.previousObservedAt, T1);
  assert.equal(block.latestObservedAt, T2);
  assert.equal(block.previousMediaCount, 2);
  assert.equal(block.latestMediaCount, 1);
  assert.ok(
    /caption, position or publication time/i.test(INSTAGRAM_MEDIA_EVOLUTION_SENTENCES["no-matching-media"]),
    "the sentence names the matches Hebun refuses to make",
  );
}

function theSixStatesAreAllDistinct(): void {
  const seen = new Set<string>();
  seen.add(deriveInstagramMediaEvolution({ status: "unavailable", reason: "unauthenticated" }).status);
  seen.add(deriveInstagramMediaEvolution({ status: "read", observations: [] } as never).status);
  seen.add(deriveInstagramMediaEvolution(read([stored(T1, []), stored(T2, [])])).status);
  seen.add(deriveInstagramMediaEvolution(read([stored(T2, [post("M1", 1, 0)])])).status);
  seen.add(deriveInstagramMediaEvolution(read([stored(T1, [post("A", 1, 0)]), stored(T2, [post("B", 1, 0)])])).status);
  seen.add(deriveInstagramMediaEvolution(read([stored(T1, [post("M1", 1, 0)]), stored(T2, [post("M1", 2, 0)])])).status);
  assert.equal(seen.size, 6, `all six states must be reachable and distinct — saw ${[...seen].join(", ")}`);
}

/* ── 6 · the comparison window ─────────────────────────────────────────────── */

function theWindowIsTheLastTwoUsableObservations(): void {
  const T0 = "2026-09-09T14:00:00.000Z";
  const evolution = deriveInstagramMediaEvolution(
    read([
      stored(T0, [post("M1", 1, 0)]),
      stored(T1, [post("M1", 10, 0)]),
      stored(T2, [post("M1", 12, 0)]),
    ]),
  );
  const block = compared(evolution);
  assert.equal(block.previousObservedAt, T1, "the window is the last TWO, not the first and the last");
  assert.equal(block.latestObservedAt, T2);
  assert.equal(block.items[0]!.likeCount.status === "comparable" ? block.items[0]!.likeCount.change : null, 2);
  assert.equal(block.observationsConsidered, 3, "how many were read is reported separately");
}

function anObservationWithoutIdentifiablePostsIsSkippedNotUsed(): void {
  /*
   * THE NEWEST OBSERVATION CARRIES NOTHING IDENTIFIABLE. It must not become half of the window and
   * make every post not-comparable; the window is the last two USABLE observations.
   */
  const T3 = "2026-09-12T14:00:00.000Z";
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 1, 0)]), stored(T2, [post("M1", 4, 0)]), stored(T3, [])]),
  );
  const block = compared(evolution);
  assert.equal(block.previousObservedAt, T1);
  assert.equal(block.latestObservedAt, T2);
}

function theWindowIsNeverDescribedAsAnInterval(): void {
  const text = Object.values(INSTAGRAM_MEDIA_EVOLUTION_SENTENCES)
    .concat(Object.values(INSTAGRAM_MEDIA_GAP_NOTES))
    .concat(Object.values(INSTAGRAM_MEDIA_UNMATCHED_NOTES))
    .join(" ");
  for (const forbidden of [/\bdaily\b/i, /\bper day\b/i, /\bper week\b/i, /\bsince yesterday\b/i, /\brate\b/i]) {
    assert.ok(!forbidden.test(text), `IG-AN3 states two instants, never an interval — matched ${forbidden}`);
  }
}

/* ── 7 · determinism, purity, and the vocabulary ───────────────────────────── */

function outputOrderIsTheProvidersAndIsDeterministic(): void {
  const rows = [
    stored(T1, [post("A", 1, 0), post("B", 1, 0), post("C", 1, 0)]),
    /* The later observation's order, which a change-sort would scramble: C has the biggest delta. */
    stored(T2, [post("B", 2, 0), post("C", 99, 0), post("A", 3, 0)]),
  ];
  const first = compared(deriveInstagramMediaEvolution(read(rows)));
  assert.deepEqual(
    first.items.map((i) => i.mediaId),
    ["B", "C", "A"],
    "rows follow the LATEST observation's own order — not a ranking by change",
  );
  const second = compared(deriveInstagramMediaEvolution(read(rows)));
  assert.deepEqual(first, second, "the same input yields the same output, byte for byte");
}

function aDuplicateMediaIdKeepsItsFirstEntry(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 5, 0), post("M1", 500, 0)]), stored(T2, [post("M1", 6, 0)])]),
  );
  const item = itemOf(evolution, "M1");
  assert.equal(
    item.likeCount.status === "comparable" ? item.likeCount.change : null,
    1,
    "a repeated id keeps the first entry rather than depending on which duplicate came last",
  );
  assert.equal(compared(evolution).items.length, 1);
}

function theSourceObservationsAreNotMutated(): void {
  const rows = [stored(T1, [post("M1", 4, 0)]), stored(T2, [post("M1", 9, 2)])];
  const before = JSON.stringify(rows);
  deriveInstagramMediaEvolution(read(rows));
  assert.equal(JSON.stringify(rows), before, "a pure derivation mutates nothing it was handed");
}

function theResultIsFrozenLikeEveryReleasedDerivation(): void {
  const evolution = deriveInstagramMediaEvolution(
    read([stored(T1, [post("M1", 4, 0)]), stored(T2, [post("M1", 9, 2)])]),
  );
  const block = compared(evolution);
  assert.ok(Object.isFrozen(block));
  assert.ok(Object.isFrozen(block.items));
  assert.ok(Object.isFrozen(block.items[0]));
  assert.ok(Object.isFrozen(block.items[0]!.likeCount));
}

function theVocabularyCarriesNoInferenceOrRecommendation(): void {
  const text = Object.values(INSTAGRAM_MEDIA_EVOLUTION_SENTENCES)
    .concat(Object.values(INSTAGRAM_MEDIA_GAP_NOTES))
    .concat(Object.values(INSTAGRAM_MEDIA_UNMATCHED_NOTES))
    .join(" ");
  for (const forbidden of [
    /\bperform/i,
    /\bengagement\b/i,
    /\btrend/i,
    /\bviral\b/i,
    /\bbest\b/i,
    /\bworst\b/i,
    /\bimprov/i,
    /\bdeclin/i,
    /\bsuccess/i,
    /\bshould\b/i,
    /\brecommend/i,
    /\bsuggest/i,
    /\bgrow/i,
  ]) {
    assert.ok(!forbidden.test(text), `IG-AN3 interprets nothing — matched ${forbidden}`);
  }
}

function thereIsNoSentenceForAComparison(): void {
  assert.ok(
    !("compared" in INSTAGRAM_MEDIA_EVOLUTION_SENTENCES),
    "a comparison speaks in numbers — any sentence Hebun wrote about one would be an interpretation",
  );
}

function theRecommendedLimitIsBoundedAndStated(): void {
  assert.equal(typeof MEDIA_EVOLUTION_OBSERVATION_LIMIT, "number");
  assert.ok(
    MEDIA_EVOLUTION_OBSERVATION_LIMIT > 1 && MEDIA_EVOLUTION_OBSERVATION_LIMIT <= 50,
    "the read is bounded — never unbounded, and never beyond the seam's own maximum",
  );
}

/* ── 8 · the real production evidence, transcribed ─────────────────────────── */

/**
 * The two genuine unattended observations that opened this phase's evidence gate, with the eight
 * mediaIds and counts they actually carried. Every like and comment count was identical across the
 * two, which makes this the case that matters most: the derivation must say `0` eight times and must
 * not mistake eight real zeros for eight absences.
 */
function theRealProductionEvidenceComparesToZero(): void {
  const IDS = [
    "18095861513235931",
    "17856620523692775",
    "18082803746664481",
    "17926274175381125",
    "18079610876298354",
    "18094778861342734",
    "18100702364595629",
    "18153745024495703",
  ] as const;
  const LIKES: Readonly<Record<string, number>> = { "18095861513235931": 5, "17856620523692775": 3 };
  const likesOf = (id: string): number => LIKES[id] ?? 4;

  const evolution = deriveInstagramMediaEvolution(
    read([
      stored(T1, IDS.map((id) => post(id, likesOf(id), 0))),
      stored(T2, IDS.map((id) => post(id, likesOf(id), 0))),
    ]),
  );
  const block = compared(evolution);
  assert.equal(block.previousObservedAt, "2026-09-10T14:00:19.320Z");
  assert.equal(block.latestObservedAt, "2026-09-11T14:00:21.998Z");
  assert.equal(block.items.length, 8, "all eight posts appear in both observations");
  assert.equal(block.onlyInPrevious, 0);
  assert.equal(block.onlyInLatest, 0);
  for (const item of block.items) {
    assert.equal(item.likeCount.status, "comparable", `${item.mediaId} likes are comparable`);
    assert.equal(item.likeCount.status === "comparable" ? item.likeCount.change : null, 0);
    assert.equal(item.commentCount.status, "comparable");
    assert.equal(item.commentCount.status === "comparable" ? item.commentCount.change : null, 0);
  }
}

function main(): void {
  theSameMediaIdMatchesAcrossObservations();
  arrayOrderDoesNotDetermineIdentity();
  aChangedCaptionDoesNotBreakOrCreateIdentity();
  thePermalinkDoesNotDetermineIdentity();
  aCloseTimestampDoesNotDetermineIdentity();
  anEntryWithNoMediaIdIsUnmatchableAndDropped();
  aPostOnlyInTheLatestIsCountedAndNotComparedToZero();
  aPostOnlyInThePreviousIsCountedAndNotTreatedAsDeleted();
  aReportedZeroIsARealValue();
  aZeroGrowingIsStillComparable();
  amissingCountIsNeverZero();
  eachMetricIsEvaluatedIndependently();
  anItemIsNotDiscardedForOneUnavailableMetric();
  theSignIsTheArithmeticAndNotAJudgement();
  anUnavailableReadStaysUnavailable();
  noObservationsIsNotNoChange();
  observationsWithoutIdentifiableMediaAreNamedAsSuch();
  oneUsableObservationIsInsufficientHistory();
  twoObservationsWithNoSharedPostIsItsOwnState();
  theSixStatesAreAllDistinct();
  theWindowIsTheLastTwoUsableObservations();
  anObservationWithoutIdentifiablePostsIsSkippedNotUsed();
  theWindowIsNeverDescribedAsAnInterval();
  outputOrderIsTheProvidersAndIsDeterministic();
  aDuplicateMediaIdKeepsItsFirstEntry();
  theSourceObservationsAreNotMutated();
  theResultIsFrozenLikeEveryReleasedDerivation();
  theVocabularyCarriesNoInferenceOrRecommendation();
  thereIsNoSentenceForAComparison();
  theRecommendedLimitIsBoundedAndStated();
  theRealProductionEvidenceComparesToZero();
  console.log("IG-AN3 media measurement evolution behaviour checks passed");
}

main();
