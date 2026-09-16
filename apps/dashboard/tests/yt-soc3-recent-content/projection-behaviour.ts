/*
 * YT-SOC3 · the YouTube recent-video projection, exercised against the read seam's own shapes and the
 * released mapper's own output.
 *
 * WHAT THIS PROVES:
 *
 *   1. No stored observation, and an unreadable history, are different answers — and neither is "zero videos".
 *   2. An authoritative zero-video observation is OBSERVED and empty, with its instant, never `none`.
 *   3. A populated stored page projects title, publishedAt, views, likes, comments — as stored.
 *   4. `null` survives as `null` and `0` survives as `0`, in all three counts.
 *   5. `moreVideosExist` has THREE answers: true, false, unknown.
 *   6. `recentVideoCount` is read as STORED, never recomputed and never the channel's `videoCount`.
 *   7. Publication time and observation time stay separate facts.
 *   8. No identifier and no URL reaches the view.
 *   9. A malformed entry or array is skipped / unreadable, never repaired into zero.
 *  10. The projection touches neither network nor clock when run.
 *
 * Pure: no database, no network, no provider, no credential.
 */
import assert from "node:assert/strict";
import {
  describeVideoCounts,
  projectLatestYouTubeRecentVideos,
  recentVideoEmptyStateOf,
  recentVideoWindowStateOf,
  YOUTUBE_RECENT_VIDEOS_EMPTY,
  YOUTUBE_VIDEO_COUNT_UNREPORTED,
  YOUTUBE_VIDEO_NO_COMMENTS,
  YOUTUBE_VIDEO_NO_LIKES,
  YOUTUBE_VIDEO_NO_VIEWS,
} from "../../src/features/youtube-channel-surface/recent-video-observation";
import { youtubeChannelObservationFacts } from "../../src/features/provider-observation-history/record-youtube-channel-observation.server";
import type { ObservationFacts, StoredProviderObservation } from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
  type YouTubeChannelObservation,
} from "../../src/features/provider-youtube/contracts";

const OBSERVED_AT = "2026-09-16T14:00:20.113Z";

function stored(facts: ObservationFacts, observedAt = OBSERVED_AT): StoredProviderObservation {
  return Object.freeze({
    observationId: "11111111-1111-4111-8111-111111111111",
    providerKey: YOUTUBE_PROVIDER_KEY,
    capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
    subjectKind: "youtube-channel",
    subjectRef: "youtube/channel/UCxxxxxxxxxxxxxxxxxxxxxx",
    integrationId: "22222222-2222-4222-8222-222222222222",
    observedAt,
    recordedAt: observedAt,
    provenance: "standing-authorization" as const,
    observedByActorType: null,
    standingAuthorizationId: "33333333-3333-4333-8333-333333333333",
    invocationId: "44444444-4444-4444-8444-444444444444",
    facts,
  }) as unknown as StoredProviderObservation;
}
const readOf = (...o: readonly StoredProviderObservation[]): ProviderObservationReadResult => ({
  status: "read",
  observations: o,
});

/** Facts exactly as the RELEASED writer produces them — not a hand-shaped approximation. */
function writerFacts(over: Partial<YouTubeChannelObservation> = {}): ObservationFacts {
  const observation: YouTubeChannelObservation = {
    channel: {
      channelId: "UCxxxxxxxxxxxxxxxxxxxxxx",
      title: "Turkish Rug House",
      handle: "@turkishrughouse",
      publishedAt: "2024-01-01T00:00:00Z",
      viewCount: 0,
      subscriberCount: 0,
      hiddenSubscriberCount: false,
      videoCount: 0,
    } as YouTubeChannelObservation["channel"],
    recentVideos: [],
    moreVideosExist: false,
    observedAt: OBSERVED_AT,
    quotaUnitsSpent: 3,
    ...over,
  };
  return youtubeChannelObservationFacts(observation);
}

function main(): void {
  /* ═══ 1. NO OBSERVATION, AND UNREADABLE HISTORY ═══════════════════════════ */
  assert.deepEqual(projectLatestYouTubeRecentVideos({ status: "read", observations: [] }), { status: "none" });
  assert.deepEqual(
    projectLatestYouTubeRecentVideos({ status: "unavailable", reason: "persistence-unavailable" }),
    { status: "unavailable", reason: "persistence-unavailable" },
    "an unreadable history is unknown, never 'no videos'",
  );
  assert.deepEqual(
    projectLatestYouTubeRecentVideos({ status: "unavailable", reason: "unauthenticated" }),
    { status: "unavailable", reason: "unauthenticated" },
  );

  /* ═══ 2. TODAY'S PRODUCTION TRUTH: AN AUTHORITATIVE ZERO-VIDEO OBSERVATION ═ */
  const zero = projectLatestYouTubeRecentVideos(readOf(stored(writerFacts())));
  assert.equal(zero.status, "observed", "zero videos is an OBSERVATION, never 'no observation'");
  if (zero.status !== "observed") return;
  assert.equal(zero.observation.observedAt, OBSERVED_AT, "it carries the instant Hebun observed");
  assert.equal(zero.observation.items.length, 0);
  assert.equal(zero.observation.recentVideoCount, 0, "the writer's stored page count, as stored");
  assert.equal(recentVideoEmptyStateOf(zero.observation), "reported-none");
  const emptySentence = YOUTUBE_RECENT_VIDEOS_EMPTY["reported-none"];
  assert.ok(/YouTube reported no recent videos/.test(emptySentence), "said as the provider's answer");
  for (const verdict of [/inactive/i, /dormant/i, /fail/i, /should/i, /publish (a|more|your)/i, /recommend/i, /upload/i]) {
    assert.ok(!verdict.test(emptySentence), `the empty state interprets nothing (${verdict})`);
  }

  /* ═══ 3. A POPULATED STORED PAGE, AS THE WRITER STORED IT ════════════════ */
  const populated = projectLatestYouTubeRecentVideos(
    readOf(
      stored(
        writerFacts({
          recentVideos: [
            { videoId: "vid00000001", title: "Hand-knotted Oushak", publishedAt: "2026-09-12T09:30:00Z", viewCount: 120, likeCount: 9, commentCount: 2 },
            { videoId: "vid00000002", title: "Washing a rug", publishedAt: "2026-09-05T18:00:00Z", viewCount: 0, likeCount: null, commentCount: null },
          ],
          moreVideosExist: true,
        }),
      ),
    ),
  );
  assert.equal(populated.status, "observed");
  if (populated.status !== "observed") return;
  const [first, second] = populated.observation.items;
  assert.deepEqual(first, {
    title: "Hand-knotted Oushak",
    publishedAt: "2026-09-12T09:30:00Z",
    viewCount: 120,
    likeCount: 9,
    commentCount: 2,
  }, "exactly the five facts, as stored — nothing added");
  assert.equal(populated.observation.recentVideoCount, 2);
  assert.equal(recentVideoEmptyStateOf(populated.observation), null, "a populated page earns no empty sentence");

  /* ═══ 4. null != 0, AND 0 != null ═══════════════════════════════════════ */
  assert.equal(second.viewCount, 0, "a real zero stays zero");
  assert.equal(second.likeCount, null, "a withheld like count stays withheld");
  assert.equal(second.commentCount, null, "a withheld comment count stays withheld");
  const rows = describeVideoCounts(second);
  assert.deepEqual(rows.map((r) => r.display), ["0", YOUTUBE_VIDEO_COUNT_UNREPORTED, YOUTUBE_VIDEO_COUNT_UNREPORTED]);
  assert.deepEqual(rows.map((r) => r.value), ["0", YOUTUBE_VIDEO_NO_LIKES, YOUTUBE_VIDEO_NO_COMMENTS]);
  assert.deepEqual(rows.map((r) => r.reported), [true, false, false]);
  assert.equal(describeVideoCounts({ ...second, viewCount: null })[0].value, YOUTUBE_VIDEO_NO_VIEWS);
  for (const row of rows) assert.ok(/YouTube/.test(row.label), `"${row.label}" is attributed to YouTube`);

  /* ═══ 5. moreVideosExist HAS THREE ANSWERS ══════════════════════════════ */
  assert.equal(recentVideoWindowStateOf(populated.observation), "bounded");
  assert.equal(recentVideoWindowStateOf(zero.observation), "complete");
  const unknown = projectLatestYouTubeRecentVideos(readOf(stored({ recentVideoCount: 0, recentVideos: [] })));
  assert.equal(unknown.status === "observed" && unknown.observation.moreVideosExist, null);
  if (unknown.status === "observed") assert.equal(recentVideoWindowStateOf(unknown.observation), "unknown");
  const malformedMore = projectLatestYouTubeRecentVideos(readOf(stored({ moreVideosExist: "yes", recentVideos: [] })));
  assert.equal(malformedMore.status === "observed" && malformedMore.observation.moreVideosExist, null, "malformed is unknown, not false");

  /* ═══ 6. THE COUNT IS READ, NOT RECOMPUTED — AND IS NOT THE CHANNEL TOTAL ═ */
  const disagreeing = projectLatestYouTubeRecentVideos(
    readOf(stored({ videoCount: 57, recentVideoCount: 4, moreVideosExist: false, recentVideos: [{ title: "only one" }] })),
  );
  assert.equal(disagreeing.status, "observed");
  if (disagreeing.status !== "observed") return;
  assert.equal(disagreeing.observation.recentVideoCount, 4, "the stored page count, never recomputed to 1");
  assert.notEqual(disagreeing.observation.recentVideoCount, 57, "and never the channel's videoCount");
  assert.equal(disagreeing.observation.items.length, 1, "while the items are what is actually there");

  /* ═══ 7. TWO INSTANTS, TWO FACTS ════════════════════════════════════════ */
  assert.equal(populated.observation.observedAt, OBSERVED_AT, "HEBUN OBSERVED");
  assert.equal(first.publishedAt, "2026-09-12T09:30:00Z", "YOUTUBE PUBLISHED");
  assert.notEqual(populated.observation.observedAt, first.publishedAt);
  const noPublished = projectLatestYouTubeRecentVideos(readOf(stored({ recentVideoCount: 1, recentVideos: [{ title: "t" }] })));
  assert.equal(
    noPublished.status === "observed" && noPublished.observation.items[0].publishedAt,
    null,
    "an unreported publication time is NOT filled with the observation instant",
  );

  /* ═══ 8. NO IDENTIFIER, NO URL ══════════════════════════════════════════ */
  for (const item of populated.observation.items) {
    assert.deepEqual(Object.keys(item).sort(), ["commentCount", "likeCount", "publishedAt", "title", "viewCount"]);
  }
  assert.ok(!JSON.stringify(populated).includes("vid00000001"), "the stored videoId never reaches the view");
  assert.ok(!/youtube\.com|youtu\.be|watch\?v=/.test(JSON.stringify(populated)), "no URL is constructed");

  /* ═══ 9. MALFORMED SHAPES ═══════════════════════════════════════════════ */
  const junk = projectLatestYouTubeRecentVideos(
    readOf(stored({ recentVideoCount: 3, recentVideos: [null, "x", [1], { title: 5, viewCount: "10", likeCount: Number.NaN }] })),
  );
  assert.equal(junk.status, "observed");
  if (junk.status !== "observed") return;
  assert.equal(junk.observation.items.length, 1, "non-object entries are skipped");
  assert.deepEqual(junk.observation.items[0], { title: null, publishedAt: null, viewCount: null, likeCount: null, commentCount: null });
  const notArray = projectLatestYouTubeRecentVideos(readOf(stored({ recentVideoCount: 2, recentVideos: "nope" })));
  assert.equal(notArray.status, "observed");
  if (notArray.status !== "observed") return;
  assert.equal(notArray.observation.items.length, 0);
  assert.equal(recentVideoEmptyStateOf(notArray.observation), "unreadable", "an unreadable page is never 'reported none'");
  const noCount = projectLatestYouTubeRecentVideos(readOf(stored({ recentVideos: [] })));
  assert.equal(noCount.status === "observed" && recentVideoEmptyStateOf(noCount.observation), "unreadable");

  /* ═══ NEWEST ROW WINS ═══════════════════════════════════════════════════ */
  const newestFirst = projectLatestYouTubeRecentVideos(
    readOf(
      stored(writerFacts(), "2026-09-16T14:00:20.113Z"),
      stored({ recentVideoCount: 1, moreVideosExist: false, recentVideos: [{ title: "older" }] }, "2026-09-16T13:00:20.000Z"),
    ),
  );
  assert.equal(newestFirst.status === "observed" && newestFirst.observation.items.length, 0, "element zero is the newest");

  /* ═══ 10. PURE UNDER A HOSTILE ENVIRONMENT ══════════════════════════════ */
  const globals = globalThis as unknown as Record<string, unknown>;
  const realFetch = globals.fetch;
  const realNow = Date.now;
  let touched: string | null = null;
  globals.fetch = () => {
    touched = "fetch";
    throw new Error("unreachable");
  };
  Date.now = () => {
    touched = "Date.now";
    throw new Error("unreachable");
  };
  try {
    projectLatestYouTubeRecentVideos(readOf(stored(writerFacts())));
  } finally {
    globals.fetch = realFetch;
    Date.now = realNow;
  }
  assert.equal(touched, null, "the projection touched neither the network nor the clock");

  console.log(
    "yt-soc3-recent-content/projection-behaviour: none/unavailable distinct, zero-video observation is " +
      "observed-and-empty, populated facts as stored, null!=0, three window answers, stored page count, " +
      "two instants, no id/url, malformed never zero, newest wins, pure at runtime",
  );
}

main();
