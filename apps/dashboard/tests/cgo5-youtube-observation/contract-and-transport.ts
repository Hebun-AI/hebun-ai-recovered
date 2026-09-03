/*
 * CGO-5 — THE YOUTUBE PROVIDER CONTRACT AND ITS TRANSPORT. No key, no network, no database.
 *
 *   1. the operation table is list-only and names nothing that could write
 *   2. handles are validated and normalised, never trusted
 *   3. every provider failure lands in ONE class, from the provider's own words
 *   4. the key goes on the `key` parameter and appears in no failure reason
 *   5. counts are what YouTube said or null — never a fabricated zero
 *   6. one observation is exactly three calls in order, one page, bounded
 */
import assert from "node:assert/strict";
import {
  MAX_RECENT_VIDEOS,
  OBSERVATION_QUOTA_UNITS,
  YOUTUBE_ALLOWED_OPERATIONS,
  YOUTUBE_API_ORIGIN,
  YOUTUBE_FORBIDDEN_FRAGMENTS,
  normalizeYouTubeHandle,
} from "../../src/features/provider-youtube/contracts";
import {
  listChannelByHandle,
  listVideos,
  type FetchLike,
} from "../../src/features/provider-youtube/youtube-transport.server";
import { observeChannelWithKey } from "../../src/features/provider-youtube/read-channel-observation.server";

const KEY = "test-key-never-logged";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function googleError(status: number, reason: string): Response {
  return json(status, { error: { code: status, message: "x", errors: [{ reason, domain: "global" }] } });
}

function channelBody(overrides: Record<string, unknown> = {}) {
  return {
    items: [
      {
        id: "UC123",
        snippet: { title: "Can Damlaları", customUrl: "@candamlalari", publishedAt: "2015-01-02T00:00:00Z" },
        statistics: { viewCount: "8420", subscriberCount: "1200", hiddenSubscriberCount: false, videoCount: "57" },
        contentDetails: { relatedPlaylists: { uploads: "UU123" } },
        ...overrides,
      },
    ],
  };
}

async function main(): Promise<void> {
  /* ── 1. LIST-ONLY OPERATIONS ── */
  for (const op of YOUTUBE_ALLOWED_OPERATIONS) {
    assert.ok(op.id.endsWith(".list"), `${op.id} is a list`);
    for (const fragment of YOUTUBE_FORBIDDEN_FRAGMENTS) {
      assert.ok(!op.path.includes(fragment) && !op.params.join(",").includes(fragment), `${op.id} carries no "${fragment}"`);
    }
  }
  assert.equal(YOUTUBE_ALLOWED_OPERATIONS.length, 3, "channels, playlistItems, videos — and no search");
  assert.equal(OBSERVATION_QUOTA_UNITS, 3);

  /* ── 2. HANDLES ── */
  assert.equal(normalizeYouTubeHandle("Candamlalari"), "@Candamlalari");
  assert.equal(normalizeYouTubeHandle(" @Candamlalari "), "@Candamlalari");
  for (const bad of ["", "@", "@a", "@has space", "@x/../y", "@" + "a".repeat(31), "@x?key=1"]) {
    assert.equal(normalizeYouTubeHandle(bad), null, `refused: ${JSON.stringify(bad)}`);
  }

  /* ── 3 + 4. CLASSIFICATION, AND THE KEY'S PLACE ── */
  const seen: string[] = [];
  const fetchWith =
    (respond: (url: string) => Response | Promise<Response>): FetchLike =>
    async (url, init) => {
      seen.push(url);
      assert.equal(init?.method, "GET", "every call is a GET");
      return respond(url);
    };
  const cases: readonly [Response | (() => never), string][] = [
    [googleError(400, "keyInvalid"), "auth"],
    [googleError(403, "forbidden"), "auth"],
    [googleError(403, "accessNotConfigured"), "disabled"],
    [googleError(403, "quotaExceeded"), "quota"],
    [googleError(429, "rateLimitExceeded"), "quota"],
    [json(500, {}), "transport"],
    [json(200, { items: [] }), "not-found"],
    [json(200, { nope: true }), "malformed"],
    [json(200, { items: [{ id: "UC1" }] }), "malformed"],
    [() => { throw new Error("ECONNRESET"); }, "transport"],
  ];
  for (const [response, expected] of cases) {
    const result = await listChannelByHandle(
      KEY,
      "@x-y-z",
      { fetchImpl: fetchWith(() => (typeof response === "function" ? response() : response)) },
    );
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.failure, expected, `classified as ${expected}`);
      assert.ok(!result.reason.includes(KEY), "the key is never in a reason");
      assert.ok(!result.reason.includes("://") && !result.reason.includes("key="), "no URL and no key in a reason");
    }
  }
  assert.ok(seen.length > 0);
  for (const url of seen) {
    const u = new URL(url);
    assert.ok(url.startsWith(YOUTUBE_API_ORIGIN), "only the YouTube Data API origin");
    assert.equal(u.searchParams.get("key"), KEY, "the key travels as the `key` parameter");
    assert.equal(u.searchParams.get("forHandle"), "@x-y-z");
    assert.equal(u.searchParams.get("part"), "snippet,statistics,contentDetails");
  }

  /* ── 5. COUNTS: SAID, OR NULL ── */
  {
    const hidden = await listChannelByHandle(KEY, "@h", {
      fetchImpl: fetchWith(() => json(200, channelBody({ statistics: { viewCount: "10", hiddenSubscriberCount: true, videoCount: "1" } }))),
    });
    assert.ok(hidden.ok);
    if (hidden.ok) {
      assert.equal(hidden.value.channel.subscriberCount, null, "hidden subscribers are null, not 0");
      assert.equal(hidden.value.channel.hiddenSubscriberCount, true);
      assert.equal(hidden.value.channel.viewCount, 10, "a decimal string becomes a number");
      assert.equal(hidden.value.channel.handle, "@candamlalari");
      assert.equal(hidden.value.uploadsPlaylistId, "UU123");
    }
    const sparse = await listVideos(KEY, ["v1", "v2"], {
      fetchImpl: fetchWith(() =>
        json(200, {
          items: [
            { id: "v2", snippet: { title: "Second", publishedAt: "2026-09-01T00:00:00Z" }, statistics: { viewCount: "5" } },
            { id: "v1", snippet: { title: "First" }, statistics: { viewCount: "7", likeCount: "2", commentCount: "0" } },
          ],
        }),
      ),
    });
    assert.ok(sparse.ok);
    if (sparse.ok) {
      assert.deepEqual(sparse.value.map((v) => v.videoId), ["v1", "v2"], "order follows the ids asked for");
      assert.equal(sparse.value[1]!.likeCount, null, "a withheld like count is null");
      assert.equal(sparse.value[1]!.commentCount, null);
      assert.equal(sparse.value[1]!.publishedAt, "2026-09-01T00:00:00Z");
      assert.equal(sparse.value[0]!.commentCount, 0, "a reported zero is zero");
      assert.equal(sparse.value[0]!.publishedAt, null);
    }
    const empty = await listVideos(KEY, [], { fetchImpl: fetchWith(() => { throw new Error("must not be called"); }) });
    assert.ok(empty.ok && empty.value.length === 0, "no ids means no call");
  }

  /* ── 6. ONE OBSERVATION = THREE CALLS, IN ORDER, ONE PAGE ── */
  {
    const calls: string[] = [];
    const ids = Array.from({ length: MAX_RECENT_VIDEOS }, (_, i) => `v${i}`);
    const fetchImpl: FetchLike = async (url) => {
      const u = new URL(url);
      calls.push(u.pathname);
      if (u.pathname.endsWith("/channels")) return json(200, channelBody());
      if (u.pathname.endsWith("/playlistItems")) {
        assert.equal(u.searchParams.get("playlistId"), "UU123", "the uploads playlist from contentDetails");
        assert.equal(u.searchParams.get("maxResults"), String(MAX_RECENT_VIDEOS));
        assert.equal(u.searchParams.get("pageToken"), null, "never a second page");
        return json(200, { pageInfo: { totalResults: 57 }, items: ids.map((id) => ({ contentDetails: { videoId: id } })) });
      }
      if (u.pathname.endsWith("/videos")) {
        assert.equal(u.searchParams.get("id"), ids.join(","));
        return json(200, { items: ids.map((id) => ({ id, snippet: { title: id }, statistics: { viewCount: "1" } })) });
      }
      throw new Error(`unexpected ${u.pathname}`);
    };
    const observed = await observeChannelWithKey(KEY, "@Candamlalari", { fetchImpl, now: () => new Date("2026-09-03T18:00:00Z") });
    assert.ok(observed.ok);
    if (observed.ok) {
      assert.deepEqual(calls, ["/youtube/v3/channels", "/youtube/v3/playlistItems", "/youtube/v3/videos"]);
      assert.equal(observed.value.recentVideos.length, MAX_RECENT_VIDEOS);
      assert.equal(observed.value.moreVideosExist, true, "57 reported, 10 shown");
      assert.equal(observed.value.quotaUnitsSpent, 3);
      assert.equal(observed.value.observedAt, "2026-09-03T18:00:00.000Z");
    }
    /* A partial failure is a failure: the channel answered, the videos did not. */
    const partial = await observeChannelWithKey(KEY, "@Candamlalari", {
      fetchImpl: async (url) =>
        new URL(url).pathname.endsWith("/channels") ? json(200, channelBody()) : googleError(403, "quotaExceeded"),
    });
    assert.equal(partial.ok, false);
    if (!partial.ok) assert.equal(partial.failure, "quota", "never a channel with videos it did not observe");
  }

  /* A channel with no uploads playlist still observes the channel, with zero video calls. */
  {
    const calls: string[] = [];
    const observed = await observeChannelWithKey(KEY, "@nouploads", {
      fetchImpl: async (url) => {
        calls.push(new URL(url).pathname);
        return json(200, channelBody({ contentDetails: {} }));
      },
    });
    assert.ok(observed.ok);
    if (observed.ok) {
      assert.deepEqual(calls, ["/youtube/v3/channels"]);
      assert.equal(observed.value.recentVideos.length, 0);
      assert.equal(observed.value.quotaUnitsSpent, 1);
    }
  }

  console.log("PASS cgo5 youtube contract and transport");
}

void main();
