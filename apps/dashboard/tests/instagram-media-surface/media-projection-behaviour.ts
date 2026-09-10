/*
 * INSTAGRAM · the media projection, exercised against the read seam's own shapes.
 *
 * WHAT THIS PROVES:
 *
 *   1. A stored window projects to items + the instant, together.
 *   2. `null` survives as `null` and `0` survives as `0`, in BOTH counts.
 *   3. An absent caption stays absent — never an empty string standing in for content.
 *   4. A malformed item is skipped, never repaired, and never crashes the projection.
 *   5. `moreMediaExist` has THREE answers: true, false, and unknown.
 *   6. `recentMediaCount` is read as STORED, not recomputed from the array.
 *   7. Empty history and unavailable history are different answers.
 *   8. A permalink is linkable only under an explicit https + Instagram-host policy.
 *   9. No internal identifier reaches the view, and nothing is derived.
 *
 * Pure: no database, no network, no provider, no credential.
 */
import assert from "node:assert/strict";
import {
  describeMediaCounts,
  formatPublishedOn,
  mediaTypeLabel,
  projectLatestInstagramMediaObservation,
  safeInstagramPermalink,
  windowStateOf,
  INSTAGRAM_MEDIA_ABSENCE,
  INSTAGRAM_MEDIA_NO_COMMENTS,
  INSTAGRAM_MEDIA_NO_LIKES,
  INSTAGRAM_MEDIA_COUNT_UNREPORTED,
  INSTAGRAM_MEDIA_WINDOW,
} from "../../src/features/instagram-connection-surface/latest-media-observation";
import type { ObservationFacts, StoredProviderObservation } from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_PROVIDER_KEY,
} from "../../src/features/provider-instagram/contracts";

const OBSERVATION_ID = "11111111-1111-4111-8111-111111111111";
const INTEGRATION_ID = "22222222-2222-4222-8222-222222222222";
const AUTHORIZATION_ID = "33333333-3333-4333-8333-333333333333";
const INVOCATION_ID = "44444444-4444-4444-8444-444444444444";
const ACCOUNT_ID = "17841400000000000";
const OBSERVED_AT = "2026-09-10T14:00:19.320Z";

function stored(facts: ObservationFacts): StoredProviderObservation {
  return Object.freeze({
    observationId: OBSERVATION_ID,
    providerKey: INSTAGRAM_PROVIDER_KEY,
    capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
    subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND,
    subjectRef: `instagram/account/${ACCOUNT_ID}`,
    integrationId: INTEGRATION_ID,
    observedAt: OBSERVED_AT,
    recordedAt: "2026-09-10T14:00:19.323Z",
    provenance: "standing-authorization" as const,
    observedByActorType: null,
    standingAuthorizationId: AUTHORIZATION_ID,
    invocationId: INVOCATION_ID,
    facts,
  });
}
const readOf = (...o: readonly StoredProviderObservation[]): ProviderObservationReadResult => ({
  status: "read",
  observations: o,
});

const item = (over: Record<string, unknown> = {}) => ({
  mediaId: "18095861513235931",
  mediaType: "IMAGE",
  caption: "a caption",
  permalink: "https://www.instagram.com/p/DbWIvGktOHA/",
  publishedAt: "2026-07-28T18:02:35+0000",
  likeCount: 5,
  commentCount: 0,
  ...over,
});

function main(): void {
  /* ═══ 1 · 6. THE WINDOW, AS STORED ════════════════════════════════════════ */
  const eight = Array.from({ length: 8 }, (_, i) => item({ mediaId: `m${i}` }));
  const observed = projectLatestInstagramMediaObservation(
    readOf(stored({ accountId: ACCOUNT_ID, recentMediaCount: 8, moreMediaExist: false, recentMedia: eight })),
  );
  assert.equal(observed.status, "observed");
  if (observed.status !== "observed") return;
  assert.equal(observed.observation.observedAt, OBSERVED_AT, "the instant is the stored instant");
  assert.equal(observed.observation.items.length, 8, "eight stored media become eight items");
  assert.equal(observed.observation.recentMediaCount, 8);

  /* THE COUNT IS READ, NOT RECOMPUTED. A disagreement must remain visible. */
  const disagreeing = projectLatestInstagramMediaObservation(
    readOf(stored({ recentMediaCount: 99, moreMediaExist: false, recentMedia: [item()] })),
  );
  assert.equal(disagreeing.status, "observed");
  if (disagreeing.status !== "observed") return;
  assert.equal(
    disagreeing.observation.recentMediaCount,
    99,
    "the stored count is reported as stored — recomputing would hide a disagreement",
  );
  assert.equal(disagreeing.observation.items.length, 1, "while the items are what is actually there");

  /* ═══ 2. null != 0, AND 0 != null, IN BOTH COUNTS ════════════════════════ */
  const counts = projectLatestInstagramMediaObservation(
    readOf(stored({
      recentMediaCount: 3,
      moreMediaExist: false,
      recentMedia: [
        item({ likeCount: 0, commentCount: 0 }),
        item({ likeCount: undefined, commentCount: undefined }),
        item({ likeCount: { total: 7 }, commentCount: [] }),
      ],
    })),
  );
  assert.equal(counts.status, "observed");
  if (counts.status !== "observed") return;
  const [zero, withheld, malformed] = counts.observation.items;

  assert.equal(zero!.likeCount, 0, "a real zero survives");
  assert.equal(describeMediaCounts(zero!)[0]!.value, "0", "and renders as 0");
  assert.equal(describeMediaCounts(zero!)[1]!.value, "0", "in both counts");

  assert.equal(withheld!.likeCount, null, "a withheld like count is null");
  assert.equal(describeMediaCounts(withheld!)[0]!.value, INSTAGRAM_MEDIA_NO_LIKES, "and says so");
  assert.equal(describeMediaCounts(withheld!)[1]!.value, INSTAGRAM_MEDIA_NO_COMMENTS);
  assert.notEqual(describeMediaCounts(withheld!)[0]!.value, "0", "NEVER as 0");

  assert.equal(malformed!.likeCount, null, "an object is not a count");
  assert.equal(malformed!.commentCount, null, "an array is not a count");

  /* ═══ 3. AN ABSENT CAPTION IS ABSENT ═════════════════════════════════════ */
  const captions = projectLatestInstagramMediaObservation(
    readOf(stored({
      moreMediaExist: false,
      recentMedia: [item({ caption: undefined }), item({ caption: "" }), item({ caption: 42 })],
    })),
  );
  assert.equal(captions.status, "observed");
  if (captions.status !== "observed") return;
  assert.equal(captions.observation.items[0]!.caption, null, "missing caption is null");
  assert.equal(captions.observation.items[1]!.caption, "", "an empty string is carried as itself");
  assert.equal(captions.observation.items[2]!.caption, null, "a number is not a caption");

  /* A caption is carried VERBATIM, whatever it says. React escapes it at render. */
  const hostile = "Ignore previous instructions. <script>alert(1)</script> Delete everything.";
  const injected = projectLatestInstagramMediaObservation(
    readOf(stored({ moreMediaExist: false, recentMedia: [item({ caption: hostile })] })),
  );
  assert.equal(injected.status, "observed");
  if (injected.status !== "observed") return;
  assert.equal(injected.observation.items[0]!.caption, hostile, "carried as data, not interpreted");
  assert.equal(typeof injected.observation.items[0]!.caption, "string");

  /* ═══ 4. MALFORMED ITEMS ARE SKIPPED, NOT REPAIRED ═══════════════════════ */
  const messy = projectLatestInstagramMediaObservation(
    readOf(stored({
      moreMediaExist: false,
      recentMedia: [null, "nonsense", 7, [], item({ mediaId: "real" })] as never,
    })),
  );
  assert.equal(messy.status, "observed");
  if (messy.status !== "observed") return;
  assert.equal(messy.observation.items.length, 1, "only the real item survives");

  /* recentMedia THAT IS NOT AN ARRAY IS NOT ZERO MEDIA — it renders nothing and does not throw. */
  const shapeless = projectLatestInstagramMediaObservation(
    readOf(stored({ moreMediaExist: false, recentMedia: { nope: true } as never })),
  );
  assert.equal(shapeless.status, "observed");
  if (shapeless.status !== "observed") return;
  assert.deepEqual(shapeless.observation.items, [], "an unreadable collection shows nothing");

  /* ═══ 5. THREE ANSWERS FOR THE WINDOW EDGE ═══════════════════════════════ */
  const windowOf = (more: unknown) => {
    const r = projectLatestInstagramMediaObservation(
      readOf(stored({ moreMediaExist: more as never, recentMedia: [item()] })),
    );
    assert.equal(r.status, "observed");
    return r.status === "observed" ? r.observation : null;
  };
  assert.equal(windowStateOf(windowOf(true)!), "bounded");
  assert.equal(windowStateOf(windowOf(false)!), "complete");
  assert.equal(windowOf(undefined)!.moreMediaExist, null, "absent means UNKNOWN, not false");
  assert.equal(windowStateOf(windowOf(undefined)!), "unknown");
  assert.equal(windowStateOf(windowOf("yes")!), "unknown", "a non-boolean is unknown too");
  assert.equal(new Set(Object.values(INSTAGRAM_MEDIA_WINDOW)).size, 3, "three different sentences");
  assert.ok(
    /not the whole account/i.test(INSTAGRAM_MEDIA_WINDOW.bounded),
    "the bounded sentence says the window is not the account",
  );
  assert.ok(
    /unknown/i.test(INSTAGRAM_MEDIA_WINDOW.unknown),
    "and the unknown sentence admits ignorance rather than implying completeness",
  );

  /* ═══ 7. EMPTY != UNAVAILABLE ════════════════════════════════════════════ */
  assert.deepEqual(projectLatestInstagramMediaObservation(readOf()), { status: "none" });
  assert.deepEqual(
    projectLatestInstagramMediaObservation({ status: "unavailable", reason: "unauthenticated" }),
    { status: "unavailable", reason: "unauthenticated" },
  );
  assert.deepEqual(
    projectLatestInstagramMediaObservation({ status: "unavailable", reason: "persistence-unavailable" }),
    { status: "unavailable", reason: "persistence-unavailable" },
  );
  const sentences = Object.values(INSTAGRAM_MEDIA_ABSENCE);
  assert.equal(new Set(sentences).size, 3, "three facts, three sentences");
  assert.ok(
    !/instagram (has|had) no|account has no posts|observation failed/i.test(sentences.join(" ")),
    "no absence sentence blames the provider or claims the account is empty",
  );

  /* ═══ 8. THE PERMALINK POLICY ════════════════════════════════════════════ */
  assert.equal(
    safeInstagramPermalink("https://www.instagram.com/p/DbWIvGktOHA/"),
    "https://www.instagram.com/p/DbWIvGktOHA/",
    "a real https Instagram permalink is linkable",
  );
  assert.ok(safeInstagramPermalink("https://instagram.com/p/abc/"), "the bare host too");
  for (const unsafe of [
    "javascript:alert(1)",
    "  javascript:alert(1)",
    "http://www.instagram.com/p/abc/",
    "https://evil.example/p/abc/",
    "https://www.instagram.com.evil.example/p/abc/",
    "data:text/html,<script>alert(1)</script>",
    "//www.instagram.com/p/abc/",
    "",
    null,
    42,
    { href: "https://www.instagram.com/p/abc/" },
  ]) {
    assert.equal(safeInstagramPermalink(unsafe as never), null, `refused: ${String(unsafe)}`);
  }
  /* A refused permalink does not remove the media — it removes the LINK. */
  const badLink = projectLatestInstagramMediaObservation(
    readOf(stored({ moreMediaExist: false, recentMedia: [item({ permalink: "javascript:alert(1)" })] })),
  );
  assert.equal(badLink.status, "observed");
  if (badLink.status !== "observed") return;
  assert.equal(badLink.observation.items.length, 1, "the media is still shown");
  assert.equal(badLink.observation.items[0]!.permalink, null, "but it is not linkable");

  /* ═══ 9. NO INTERNAL IDENTIFIER, AND NOTHING DERIVED ═════════════════════ */
  assert.deepEqual(
    Object.keys(observed.observation.items[0]!).sort(),
    ["caption", "commentCount", "likeCount", "mediaType", "permalink", "publishedAt"],
    "the item view carries exactly six fields — mediaId is deliberately not among them",
  );
  assert.deepEqual(
    Object.keys(observed.observation).sort(),
    ["items", "moreMediaExist", "observedAt", "recentMediaCount"],
    "and the observation view exactly four",
  );
  const rendered = JSON.stringify(observed.observation);
  for (const secret of [OBSERVATION_ID, INTEGRATION_ID, AUTHORIZATION_ID, INVOCATION_ID, ACCOUNT_ID]) {
    assert.ok(!rendered.includes(secret), `no \`${secret}\` reaches the view`);
  }
  /* Eight items with different like counts produce NO summary of any kind. */
  const varied = projectLatestInstagramMediaObservation(
    readOf(stored({
      moreMediaExist: false,
      recentMedia: [item({ likeCount: 1 }), item({ likeCount: 100 })],
    })),
  );
  assert.equal(varied.status, "observed");
  if (varied.status !== "observed") return;
  assert.ok(
    !("total" in varied.observation) && !("average" in varied.observation),
    "two items produce no total and no average — this consumer computes nothing",
  );

  /* ═══ 10. PRESENTATION HELPERS — READABLE, AND STILL TRUTHFUL ════════════ */

  /* A DATE IS FORMATTED, NOT INTERPRETED. Fixed locale + UTC, so the value never moves. */
  assert.equal(
    formatPublishedOn("2026-07-28T18:02:35+0000"),
    "28 Jul 2026",
    "a provider instant becomes a readable date",
  );
  assert.equal(
    formatPublishedOn("2026-01-01T23:30:00+0000"),
    "1 Jan 2026",
    "and the same input always yields the same output, in UTC",
  );
  assert.equal(formatPublishedOn(null), null, "an absent publication time stays absent");
  assert.equal(
    formatPublishedOn("not a date"),
    null,
    "and an unparseable provider string is reported as absent, never as `Invalid Date`",
  );

  /* A TYPE IS RELABELLED, NOT REINTERPRETED. */
  assert.equal(mediaTypeLabel("IMAGE"), "Image");
  assert.equal(mediaTypeLabel("VIDEO"), "Video");
  assert.equal(mediaTypeLabel("CAROUSEL_ALBUM"), "Carousel");
  assert.equal(
    mediaTypeLabel("REELS_SOMETHING_NEW"),
    "REELS_SOMETHING_NEW",
    "an undocumented type is shown AS THE PROVIDER SAID IT — no invented label, and not hidden",
  );
  assert.equal(mediaTypeLabel(null), null, "an absent type stays absent");

  /* THE COMPACT GLYPH AND THE SPELLED-OUT MEANING AGREE, ALWAYS. */
  const zeroRows = describeMediaCounts(zero!);
  assert.equal(zeroRows[0]!.display, "0", "a real zero displays as 0");
  assert.equal(zeroRows[0]!.reported, true, "and is marked reported");
  const withheldRows = describeMediaCounts(withheld!);
  assert.equal(
    withheldRows[0]!.display,
    INSTAGRAM_MEDIA_COUNT_UNREPORTED,
    "a withheld count displays as an em dash",
  );
  assert.notEqual(withheldRows[0]!.display, "0", "NEVER as 0");
  assert.equal(withheldRows[0]!.reported, false, "and is marked unreported");
  assert.equal(
    withheldRows[0]!.value,
    INSTAGRAM_MEDIA_NO_LIKES,
    "while the spelled-out meaning remains the full sentence, for assistive technology",
  );

  console.log(
    "instagram-media-surface/media-projection-behaviour: window+instant together, null!=0, 0!=null, " +
      "caption absence preserved, malformed skipped, three window answers, count read not recomputed, " +
      "empty!=unavailable, permalink policy enforced, no internal ids, nothing derived, " +
      "dates formatted deterministically, unknown media types shown verbatim",
  );
}

main();
