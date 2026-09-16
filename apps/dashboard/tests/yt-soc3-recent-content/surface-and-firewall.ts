/*
 * YT-SOC3 · where the recent-video consumer sits, what it renders, and what it cannot do.
 *
 * STRUCTURAL (source, comments stripped):
 *   1. The projection's imports are type-only — it cannot reach anything at runtime.
 *   2. It reaches no database, network, tenant, read seam, credential, YouTube host, Knowledge or Heby.
 *   3. It writes nothing, has no clock, and names no derived quantity or verdict.
 *   4. It imports nothing from Instagram, and no cross-provider abstraction appears.
 *   5. The Social Intelligence read still issues exactly the same capability-scoped reads — no new one.
 *   6. The composition consumes the projection; the page renders it and does not re-project.
 *   7. The surface constructs no YouTube URL and renders no link.
 *   8. No schema, migration, capability or provider scope was touched by the phase's files.
 *
 * BEHAVIOURAL:
 *   9. The composition carries today's zero-video observation as observed-and-empty.
 *  10. A populated observation reaches `model.youtube.content` with its facts intact.
 *  11. Rendered cards say withheld counts in words, real zeros as 0, and "Published" beside the date.
 *  12. The released hardcoded "no released reader" sentence is gone from the page.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { composeSocialDashboard } from "../../src/features/social-intelligence/dashboard-model";
import type { ConnectionListing } from "../../src/features/integration-authority/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import { YouTubeRecentVideos } from "../../src/components/social-intelligence/youtube-recent-videos";
import {
  YOUTUBE_VIDEO_NO_COMMENTS,
  YOUTUBE_VIDEO_NO_LIKES,
  YOUTUBE_VIDEO_NO_PUBLISHED_AT,
  YOUTUBE_VIDEO_NO_TITLE,
} from "../../src/features/youtube-channel-surface/recent-video-observation";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1").replace(/\{\/\*[\s\S]*?\*\/\}/g, " ");

const MODULE = "src/features/youtube-channel-surface/recent-video-observation.ts";
const COMPONENT = "src/components/social-intelligence/youtube-recent-videos.tsx";
const COMPOSITION = "src/features/social-intelligence/dashboard-model.ts";
const READ = "src/features/social-intelligence/dashboard-read.server.ts";
const PAGE = "src/app/(dashboard)/intelligence/social/page.tsx";

const textOf = (markup: string): string =>
  markup
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

function structural(): void {
  const source = codeOf(read(MODULE));

  /* 1 */
  const imports = source.match(/^import[\s\S]*?from\s+"[^"]+";/gm) ?? [];
  assert.ok(imports.length > 0, "the projection imports its contracts — the scan is not vacuous");
  for (const statement of imports) {
    assert.ok(/^import type\b/.test(statement), `every projection import is type-only:\n${statement}`);
  }

  /* 2 */
  for (const [pattern, what] of [
    [/\bgetControlPlaneDb\b|\bdrizzle\b|\bproviderObservations\b/, "a database handle or table"],
    [/\bfetch\s*\(|\bXMLHttpRequest\b|node:https?/, "the network"],
    [/\bresolveTenantContext\b|\bTenantContext\b/, "tenant resolution"],
    [/\breadProviderObservations\b/, "the read seam — it is handed the RESULT"],
    [/\bdecrypt\b|\bcredential\b|\bapiKey\b/i, "a credential"],
    [/googleapis\.com|youtube\.com|youtu\.be|watch\?v=/, "YouTube or a constructed YouTube URL"],
    [/\bknowledge\b/i, "Knowledge"],
    [/\bheby\b/i, "Heby"],
  ] as const) {
    assert.ok(!pattern.test(source), `the projection does not reach ${what}`);
  }

  /* 3 */
  for (const pattern of [/\binsert\b/i, /\bupdate\s*\(/, /\bpersist\w*\(/i, /\bwriteFile/, /\bcache\b/i]) {
    assert.ok(!pattern.test(source), `the projection persists nothing (${pattern})`);
  }
  for (const pattern of [/\bDate\b/, /\bperformance\.now\b/, /\bMath\.random\b/, /\bIntl\b/]) {
    assert.ok(!pattern.test(source), `the projection has no clock (${pattern})`);
  }
  const DERIVED =
    /\b(delta|difference|growth|trend|rate|percent|percentage|average|mean|median|momentum|velocity|score|ranking?|rank|forecast|engagement|top|best|performing|sum|total)\b/i;
  for (const file of [MODULE, COMPONENT]) {
    const words = codeOf(read(file)).replace(/([a-z0-9])([A-Z])/g, "$1 $2");
    assert.ok(!DERIVED.test(words), `${file} names no derived quantity`);
    assert.ok(!/\.(sort|reduce)\s*\(|Math\.(max|min)/.test(codeOf(read(file))), `${file} orders or aggregates nothing`);
  }
  const VERDICT = /\b(recommend|suggest|should|advise|opportunity|underperform|outperform|healthy|inactive|dormant)\b/i;
  assert.ok(!VERDICT.test(read(MODULE)), "no verdict vocabulary in the projection, prose included");
  assert.ok(!VERDICT.test(codeOf(read(COMPONENT))), "and none rendered by the component");

  /* 4 */
  for (const file of [MODULE, COMPONENT]) {
    assert.ok(!/from\s+"[^"]*instagram[^"]*"/.test(codeOf(read(file))), `${file} imports nothing from Instagram`);
  }
  for (const banned of [/\bSocialMeasurementSeries\b/, /\bUnifiedMeasurement\b/, /\bSocialContentItem\b/, /\bcrossPlatform\b/]) {
    assert.ok(!banned.test(source), `no cross-provider abstraction (${banned})`);
  }

  /* 5 — THE READ PATH DID NOT WIDEN */
  const readCode = codeOf(read(READ));
  assert.equal((readCode.match(/readProviderObservations\(/g) ?? []).length, 3, "still exactly three observation reads");
  assert.equal((readCode.match(/YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY/g) ?? []).length, 2, "one import, one YouTube read");
  assert.ok(!/recent-video-observation/.test(readCode), "the read seam knows nothing of the projection");

  /* 6 */
  const composition = codeOf(read(COMPOSITION));
  assert.ok(composition.includes("projectLatestYouTubeRecentVideos(input.youtubeChannel)"), "composed from the EXISTING YouTube read");
  assert.equal((composition.match(/projectLatestYouTubeRecentVideos\(/g) ?? []).length, 1, "projected exactly once");
  const page = codeOf(read(PAGE));
  assert.ok(!page.includes("projectLatestYouTubeRecentVideos"), "the page renders the model; it does not re-project");
  assert.ok(page.includes("<YouTubeRecentVideos"), "the page renders the YouTube recent videos");

  /* 7 */
  for (const file of [COMPONENT, PAGE]) {
    const code = codeOf(read(file));
    assert.ok(!/youtube\.com|youtu\.be|watch\?v=/.test(code), `${file} constructs no YouTube URL`);
  }
  assert.ok(!/<a\b|href=/.test(codeOf(read(COMPONENT))), "the video card renders no link");

  /* 8 */
  for (const file of [MODULE, COMPONENT]) {
    const code = codeOf(read(file));
    assert.ok(!/pgTable|drizzle-kit|migration|CAPABILITY\s*=|scope/i.test(code), `${file} declares no schema, capability or scope`);
  }

  /* 12 */
  assert.ok(!read(PAGE).includes("no\n                released reader for YouTube content"), "the stale hardcoded sentence is gone");
  assert.ok(!/No YouTube content is shown/.test(read(PAGE)), "the stale hardcoded sentence is gone");
}

/* ── behaviour ─────────────────────────────────────────────────────────────── */

const readRows = (rows: readonly { observedAt: string; facts: Record<string, unknown> }[]) =>
  ({
    status: "read",
    observations: rows.map((o, i) => ({
      observationId: `o${i}`,
      providerKey: "youtube",
      capabilityKey: "youtube.channel.public.read",
      subjectKind: "s",
      subjectRef: "r",
      integrationId: null,
      observedAt: o.observedAt,
      recordedAt: o.observedAt,
      observedByActorType: null,
      standingAuthorizationId: null,
      invocationId: null,
      facts: o.facts,
    })),
  }) as unknown as ProviderObservationReadResult;

const NONE: ConnectionListing = { status: "read", connections: [] };
const EMPTY_READ = readRows([]);

function behaviour(): void {
  /* 9 — TODAY'S PRODUCTION SHAPE */
  const production = composeSocialDashboard({
    connections: NONE,
    instagramAccount: EMPTY_READ,
    instagramMedia: EMPTY_READ,
    youtubeChannel: readRows([
      { observedAt: "2026-09-16T14:00:20.113Z", facts: { subscriberCount: 0, videoCount: 0, viewCount: 0, hiddenSubscriberCount: false, recentVideoCount: 0, moreVideosExist: false, recentVideos: [] } },
      { observedAt: "2026-09-16T13:00:20.000Z", facts: { subscriberCount: 0, videoCount: 0, viewCount: 0, hiddenSubscriberCount: false, recentVideoCount: 0, moreVideosExist: false, recentVideos: [] } },
    ]),
  });
  assert.equal(production.youtube.content.status, "observed");
  if (production.youtube.content.status === "observed") {
    assert.equal(production.youtube.content.observation.items.length, 0);
    assert.equal(production.youtube.content.observation.observedAt, "2026-09-16T14:00:20.113Z", "the newest observation");
  }
  assert.equal(production.youtube.points.length, 2, "the channel series is unchanged by the new projection");

  const nothingStored = composeSocialDashboard({ connections: NONE, instagramAccount: EMPTY_READ, instagramMedia: EMPTY_READ, youtubeChannel: EMPTY_READ });
  assert.equal(nothingStored.youtube.content.status, "none");
  const unreadable = composeSocialDashboard({
    connections: NONE,
    instagramAccount: EMPTY_READ,
    instagramMedia: EMPTY_READ,
    youtubeChannel: { status: "unavailable", reason: "persistence-unavailable" } as ProviderObservationReadResult,
  });
  assert.equal(unreadable.youtube.content.status, "unavailable");

  /* 10 */
  const populated = composeSocialDashboard({
    connections: NONE,
    instagramAccount: EMPTY_READ,
    instagramMedia: EMPTY_READ,
    youtubeChannel: readRows([
      {
        observedAt: "2026-10-01T10:00:20.000Z",
        facts: {
          videoCount: 1,
          recentVideoCount: 1,
          moreVideosExist: false,
          recentVideos: [{ videoId: "abc", title: "A rug", publishedAt: "2026-09-30T08:00:00Z", viewCount: 0, likeCount: null, commentCount: 3 }],
        },
      },
    ]),
  });
  assert.equal(populated.youtube.content.status, "observed");
  const items = populated.youtube.content.status === "observed" ? populated.youtube.content.observation.items : [];
  assert.deepEqual(items, [{ title: "A rug", publishedAt: "2026-09-30T08:00:00Z", viewCount: 0, likeCount: null, commentCount: 3 }]);

  /* 11 — WHAT A READER RECEIVES */
  const markup = renderToStaticMarkup(createElement(YouTubeRecentVideos, { items }));
  const text = textOf(markup);
  assert.ok(text.includes("A rug"), "the title is rendered as text");
  assert.ok(/Published 30 Sept 2026|Published 30 Sep 2026/.test(text), `"Published" names YouTube's instant: ${text}`);
  assert.ok(!text.includes("1 Oct 2026"), "the observation instant is not presented as the publication date");
  assert.ok(text.includes("Views YouTube reported for this video: 0"), "a real zero is announced as zero");
  assert.ok(text.includes(YOUTUBE_VIDEO_NO_LIKES), "a withheld like count is said in words, never 0");
  assert.ok(!text.includes("Likes YouTube reported for this video: 0"), "and never announced as zero");
  assert.ok(text.includes("Comments YouTube reported for this video: 3"));
  assert.ok(!/href=/.test(markup), "no link is rendered");

  const bare = textOf(
    renderToStaticMarkup(
      createElement(YouTubeRecentVideos, {
        items: [{ title: null, publishedAt: null, viewCount: null, likeCount: null, commentCount: null }],
      }),
    ),
  );
  assert.ok(bare.includes(YOUTUBE_VIDEO_NO_TITLE) && bare.includes(YOUTUBE_VIDEO_NO_PUBLISHED_AT));
  assert.ok(bare.includes(YOUTUBE_VIDEO_NO_COMMENTS));
  assert.ok(!/Published YouTube did not/.test(bare), "an absent date is not prefixed with 'Published'");
  assert.equal(renderToStaticMarkup(createElement(YouTubeRecentVideos, { items: [] })), "", "no items render no empty grid");
}

function main(): void {
  structural();
  behaviour();
  console.log(
    "yt-soc3-recent-content/surface-and-firewall: type-only projection, no reach/write/clock/derivation/" +
      "verdict, no Instagram import, read path unchanged (3 reads), composed once from the existing read, " +
      "no URL or link, no schema/capability, zero-video production shape observed-and-empty, populated " +
      "facts intact, rendered withheld != 0, Published distinct from observed, stale sentence removed",
  );
}

main();
