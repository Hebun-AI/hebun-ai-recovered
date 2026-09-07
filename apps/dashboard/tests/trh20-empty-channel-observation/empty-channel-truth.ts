/*
 * TRH-20-FIX — A CHANNEL WITH NOTHING IN IT IS AN OBSERVATION, NOT AN OUTAGE.
 *
 * ── THE ONE SENTENCE THIS FILE DEFENDS ──────────────────────────────────────
 *
 *   YOUTUBE SAYING "THERE IS NOTHING HERE" IS A FACT ABOUT THE CHANNEL; ANYTHING ELSE IT SAYS
 *   ABOUT THE PLAYLIST IS STILL A FAILED READ.
 *
 * YouTube materialises a channel's uploads playlist only once something is in it, so
 * `playlistItems.list` answers `404 playlistNotFound` for a channel with no public uploads. The
 * released reading of that was "the videos did not answer". It was wrong: YouTube DID answer, and
 * `videoCount: 0` in the very same channel response states the same fact a second time.
 *
 * EXACTLY ONE STATE CONVERTS, and this file spends most of its length proving the ones that do NOT.
 * A conversion that also swallowed a real playlist failure would turn an outage into a confident
 * "this channel has nothing" — a fabricated fact, which is worse than the defect it replaced.
 *
 * No key, no network, no database, no model.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  MAX_RECENT_VIDEOS,
  OBSERVATION_QUOTA_UNITS,
  YOUTUBE_ALLOWED_OPERATIONS,
  YOUTUBE_FORBIDDEN_FRAGMENTS,
  type YouTubeChannelObservation,
} from "../../src/features/provider-youtube/contracts";
import { observeChannelWithKey } from "../../src/features/provider-youtube/read-channel-observation.server";
import { withConnectedYouTubeApiKey } from "../../src/features/provider-youtube/youtube-api-key-call.server";
import type { FetchLike } from "../../src/features/provider-youtube/youtube-transport.server";
import {
  OBSERVATION_FACTS_HEADER,
  observationSupplementFor,
} from "../../src/features/content-observation/observation-brief";
import {
  GROWTH_OBSERVATION_FENCE,
  UNAVAILABLE_GROWTH_METRICS,
  growthObservationSupplementFor,
} from "../../src/features/content-observation/growth-origination-brief";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const KEY = "test-key-never-logged";
const NO_UPLOADS_SENTENCE = "The platform reported no public uploads for this channel.";

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function googleError(status: number, reason: string): Response {
  return json(status, { error: { code: status, message: "x", errors: [{ reason, domain: "youtube.playlistItem" }] } });
}

/**
 * Turkish Rug House's actual shape as the provider reported it during the forensic: a real channel,
 * a real uploads playlist id, and zero of everything. `statistics` is overridable so the three
 * refusal cases can differ from this one by exactly one field.
 */
function channelBody(statistics: Record<string, unknown>) {
  return {
    items: [
      {
        id: "UCfixture",
        snippet: { title: "Turkish Rug House", customUrl: "@turkishrughouse", publishedAt: "2021-04-02T00:00:00Z" },
        statistics,
        contentDetails: { relatedPlaylists: { uploads: "UUfixture" } },
      },
    ],
  };
}

const EMPTY_STATS = { viewCount: "0", subscriberCount: "0", hiddenSubscriberCount: false, videoCount: "0" };

/** Answers the channel call, then whatever the caller wants for the playlist call. */
function fetchWith(statistics: Record<string, unknown>, playlist: () => Response, calls: string[]): FetchLike {
  return async (url) => {
    const u = new URL(url);
    calls.push(u.pathname);
    if (u.pathname.endsWith("/channels")) return json(200, channelBody(statistics));
    if (u.pathname.endsWith("/playlistItems")) return playlist();
    if (u.pathname.endsWith("/videos")) return json(200, { items: [] });
    throw new Error(`unexpected ${u.pathname}`);
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 1. THE ONE STATE THAT CONVERTS.
 * ═════════════════════════════════════════════════════════════════════════ */
async function zeroVideosPlusPlaylistNotFoundIsAnObservation(): Promise<void> {
  const calls: string[] = [];
  const observed = await observeChannelWithKey(KEY, "@TurkishRugHouse", {
    fetchImpl: fetchWith(EMPTY_STATS, () => googleError(404, "playlistNotFound"), calls),
    now: () => new Date("2026-09-07T15:00:00Z"),
  });

  assert.equal(observed.ok, true, `an empty channel observes (got ${JSON.stringify(observed)})`);
  if (!observed.ok) return;

  assert.equal(observed.value.recentVideos.length, 0, "zero videos, because zero were observed");
  assert.equal(observed.value.moreVideosExist, false, "and nothing is claimed to be beyond the page");

  /* THE THIRD CALL WAS NEVER MADE, and the quota says so. */
  assert.deepEqual(
    calls,
    ["/youtube/v3/channels", "/youtube/v3/playlistItems"],
    "videos.list is not called for a channel with no video ids",
  );
  assert.equal(observed.value.quotaUnitsSpent, 2, "two operations happened, so two are reported");
  assert.ok(observed.value.quotaUnitsSpent < OBSERVATION_QUOTA_UNITS, "and it is under the ceiling");

  /* NOTHING WAS INVENTED. Every count is what the provider said. */
  assert.equal(observed.value.channel.videoCount, 0);
  assert.equal(observed.value.channel.viewCount, 0);
  assert.equal(observed.value.channel.subscriberCount, 0);
  assert.equal(observed.value.channel.hiddenSubscriberCount, false);
  assert.equal(observed.value.channel.handle, "@turkishrughouse", "the provider's own spelling, not the input");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 2. EVERY NEIGHBOURING STATE STILL FAILS.
 *
 * These are the assertions that make the conversion narrow. Without them the fix reads as
 * "playlist trouble means the channel is empty", which would fabricate a fact.
 * ═════════════════════════════════════════════════════════════════════════ */
async function everythingElseIsStillAFailure(): Promise<void> {
  /* A channel that SAYS it has uploads whose playlist cannot be read is a real failure. */
  const withUploads = await observeChannelWithKey(KEY, "@x", {
    fetchImpl: fetchWith({ ...EMPTY_STATS, videoCount: "57" }, () => googleError(404, "playlistNotFound"), []),
  });
  assert.equal(withUploads.ok, false, "videoCount > 0 + playlist not-found must still fail");
  if (!withUploads.ok) assert.equal(withUploads.failure, "not-found");

  /* A count the provider did not report is not evidence of emptiness. */
  const noCount = await observeChannelWithKey(KEY, "@x", {
    fetchImpl: fetchWith({ viewCount: "0", hiddenSubscriberCount: false }, () => googleError(404, "playlistNotFound"), []),
  });
  assert.equal(noCount.ok, false, "videoCount null + playlist not-found must still fail");

  /* An unparseable count is null, and null is not zero. */
  const junkCount = await observeChannelWithKey(KEY, "@x", {
    fetchImpl: fetchWith({ ...EMPTY_STATS, videoCount: "not-a-number" }, () => googleError(404, "playlistNotFound"), []),
  });
  assert.equal(junkCount.ok, false, "an unparseable videoCount is not a zero");

  /* Any other failure class on the playlist read is untouched by this fix. */
  for (const [status, reason, expected] of [
    [403, "quotaExceeded", "quota"],
    [403, "keyInvalid", "auth"],
    [403, "accessNotConfigured", "disabled"],
    [500, "backendError", "transport"],
  ] as const) {
    const other = await observeChannelWithKey(KEY, "@x", {
      fetchImpl: fetchWith(EMPTY_STATS, () => googleError(status, reason), []),
    });
    assert.equal(other.ok, false, `${reason} on the playlist must still fail even for an empty channel`);
    if (!other.ok) assert.equal(other.failure, expected, `and it keeps its own class (${reason})`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 3. THE DECISION IS MADE ON A CLASS AND A NUMBER, NEVER ON A REASON STRING.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theConversionDoesNotReadTheReason(): Promise<void> {
  const source = read("src/features/provider-youtube/read-channel-observation.server.ts")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
  assert.equal(
    source.includes("playlistNotFound"),
    false,
    "the observation authority must not name a provider reason token",
  );
  assert.ok(
    source.includes('uploads.failure === "not-found"'),
    "it branches on the TYPED failure class",
  );
  assert.ok(
    source.includes("channel.value.channel.videoCount === 0"),
    "and on the provider's own count, compared to zero exactly",
  );

  /* A 404 that is NOT the playlist reason converts identically — the class is what matters. */
  const otherFourOhFour = await observeChannelWithKey(KEY, "@x", {
    fetchImpl: fetchWith(EMPTY_STATS, () => googleError(404, "notFound"), []),
  });
  assert.equal(otherFourOhFour.ok, true, "the class decides, so a different 404 reason behaves the same");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 4. F2 — THE PROVIDER'S OWN WORD SURVIVES A 404, AND CHANGES NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theDiagnosticIsPreservedAndCarriesNoSecret(): Promise<void> {
  const failed = await observeChannelWithKey(KEY, "@x", {
    fetchImpl: fetchWith({ ...EMPTY_STATS, videoCount: "57" }, () => googleError(404, "playlistNotFound"), []),
  });
  assert.equal(failed.ok, false);
  if (failed.ok) return;
  assert.equal(failed.failure, "not-found", "the CLASS is unchanged by the diagnostic");
  assert.ok(
    failed.reason.includes("playlistNotFound"),
    `the provider's own word is preserved (got "${failed.reason}")`,
  );
  assert.ok(failed.reason.startsWith("youtube-http-404"), "under the released reason shape");

  /* A 404 with no reason at all still classifies, and says so rather than reading empty. */
  const bare = await observeChannelWithKey(KEY, "@x", {
    fetchImpl: fetchWith({ ...EMPTY_STATS, videoCount: "57" }, () => json(404, { error: { code: 404 } }), []),
  });
  assert.equal(bare.ok, false);
  if (!bare.ok) assert.equal(bare.reason, "youtube-http-404:no-reason");

  /* NO SECRET, NO URL, NO BODY, NO HEADER can reach a reason. */
  assert.equal(failed.reason.includes(KEY), false, "the key never appears in a failure reason");
  assert.equal(/https?:\/\//.test(failed.reason), false, "and neither does a URL");
  assert.equal(failed.reason.includes("message"), false, "and neither does the provider's prose");
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 5. BOTH BRIEFS RENDER AN EMPTY CHANNEL, AND INVENT NOTHING.
 * ═════════════════════════════════════════════════════════════════════════ */
function bothBriefsSpeakAnEmptyChannelHonestly(): void {
  const observation: YouTubeChannelObservation = Object.freeze({
    channel: Object.freeze({
      channelId: "UCfixture",
      title: "Turkish Rug House",
      handle: "@turkishrughouse",
      publishedAt: "2021-04-02T00:00:00.000Z",
      viewCount: 0,
      subscriberCount: 0,
      hiddenSubscriberCount: false,
      videoCount: 0,
    }),
    recentVideos: Object.freeze([]),
    moreVideosExist: false,
    observedAt: "2026-09-07T15:00:00.000Z",
    quotaUnitsSpent: 2,
  }) as YouTubeChannelObservation;

  for (const [label, block] of [
    ["draft", observationSupplementFor(observation)],
    ["growth", growthObservationSupplementFor(observation)],
  ] as const) {
    assert.ok(block.includes(NO_UPLOADS_SENTENCE), `the ${label} brief says there are no public uploads`);
    assert.equal(
      block.includes("This is ONE page and is PARTIAL"),
      false,
      `the ${label} brief does not claim uploads exist beyond the page`,
    );
    assert.equal(
      block.toLowerCase().includes("outage") || block.toLowerCase().includes("unavailable"),
      false,
      `the ${label} brief does not describe an empty channel as a provider problem`,
    );
    /*
     * The reported half only. Splitting on the bare words "PUBLIC PLATFORM OBSERVATION" would match
     * the FENCE's own first sentence as well, so the split is on the exported header constant that
     * opens the facts — the same anchor the released suites use.
     */
    const facts = block.split(OBSERVATION_FACTS_HEADER)[1] ?? "";
    assert.ok(facts.length > 0, `${label}: the block has a facts half`);
    for (const metric of UNAVAILABLE_GROWTH_METRICS) {
      assert.equal(facts.toLowerCase().includes(metric.toLowerCase()), false, `${label}: no "${metric}"`);
    }
    /* Zeros are the provider's, printed as such — never softened into an absence. */
    assert.ok(facts.includes("Public views 0"), `${label}: the zero is reported as a zero`);
    assert.equal(
      facts.includes("not reported by the platform"),
      false,
      `${label}: a reported zero is not rewritten as unreported`,
    );
  }

  /* The growth fence is still in front of the first number. */
  const growth = growthObservationSupplementFor(observation);
  const firstNumber = growth.indexOf("Public views 0");
  assert.ok(firstNumber > 0);
  for (const sentence of GROWTH_OBSERVATION_FENCE) {
    assert.ok(growth.indexOf(sentence) < firstNumber, `denial before number: ${sentence}`);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * 6. THE PROVIDER GAINED NOTHING, AND THE AUTHORITY STILL DECIDES FIRST.
 * ═════════════════════════════════════════════════════════════════════════ */
async function theProviderIsUnchanged(): Promise<void> {
  assert.equal(YOUTUBE_ALLOWED_OPERATIONS.length, 3, "still three operations");
  for (const op of YOUTUBE_ALLOWED_OPERATIONS) {
    assert.ok(op.id.endsWith(".list"), `${op.id} is a list`);
    for (const fragment of YOUTUBE_FORBIDDEN_FRAGMENTS) {
      assert.ok(
        !op.path.includes(fragment) && !op.params.join(",").includes(fragment),
        `${op.id} carries no "${fragment}"`,
      );
    }
  }
  assert.equal(MAX_RECENT_VIDEOS, 10, "one page, unchanged");
  assert.equal(OBSERVATION_QUOTA_UNITS, 3, "the ceiling is unchanged");

  const transport = read("src/features/provider-youtube/youtube-transport.server.ts");
  assert.equal(/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(transport), false, "no write verb exists");

  /* TENANT ISOLATION: a null tenant reaches no key, no connection and no provider. */
  let reached = false;
  const refused = await withConnectedYouTubeApiKey(
    null,
    async () => {
      reached = true;
      return { ok: true, value: 1 } as never;
    },
    { fetchImpl: (async () => { throw new Error("no provider call may be made"); }) as FetchLike },
  );
  assert.equal(reached, false, "no callback runs without an authorized tenant");
  assert.deepEqual(refused, { ok: false, refusal: "no-authorized-tenant-context" });

  /* NO SCHEMA, NO MIGRATION. */
  const journal = read("src/db/migrations/meta/_journal.json");
  assert.equal(JSON.parse(journal).entries.length, 51, "the ledger moved for TRH-21; this fix authored none of it"); /* TRH-23 50 -> 51 (`standing_observation_authorizations`, one additive table plus the `standing-observation` governance domain: Governance's permission to observe one exact provider read scope, repeatedly, until a later revision withdraws it). */
  assert.equal(journal.includes("trh20"), false, "this fix authored no migration");
}

async function main(): Promise<void> {
  await zeroVideosPlusPlaylistNotFoundIsAnObservation();
  await everythingElseIsStillAFailure();
  await theConversionDoesNotReadTheReason();
  await theDiagnosticIsPreservedAndCarriesNoSecret();
  bothBriefsSpeakAnEmptyChannelHonestly();
  await theProviderIsUnchanged();
  console.log("PASS trh20-empty-channel-observation empty-channel truth");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
