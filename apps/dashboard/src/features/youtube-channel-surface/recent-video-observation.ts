/*
 * youtube-channel-surface/recent-video-observation.ts — which videos YouTube reported, and when
 * Hebun looked (YT-SOC3).
 *
 * ── THE ONE SENTENCE THIS MODULE MAY PRODUCE ────────────────────────────────
 *
 *   "YouTube reported these videos, with these counts, at instant T."
 *
 * NOT "this channel has 3 videos", not "views are up", not "this one did best". A stored channel
 * observation carries ONE bounded page of the channel's uploads, and averages, rates, rankings and
 * trends over it belong to an analytics authority that does not exist.
 *
 * ── A PURE PROJECTION ───────────────────────────────────────────────────────
 *
 * It queries nothing, reaches no provider, fetches nothing, formats no date and writes nothing. It
 * is handed the result the released read seam already produced for `youtube.channel.public.read` —
 * the same read the channel measurement series consumes — and narrows the NEWEST row to what a human
 * may see. Every import is type-only.
 *
 * ── ZERO VIDEOS IS AN OBSERVATION, NOT AN ABSENCE OF ONE ────────────────────
 *
 * A stored observation whose page held no videos is a real answer YouTube gave at a real instant. It
 * projects to `observed` with no items, never to `none`: `none` means Hebun holds no observation at
 * all. Neither state says anything about whether the channel is active, and nothing here may.
 *
 * ── THE COUNT IS READ AS STORED ─────────────────────────────────────────────
 *
 * `recentVideoCount` is the size of the page the writer stored, never the channel's `videoCount`
 * total, and it is not recomputed from the array: if the two ever disagreed, recomputing would hide
 * the disagreement.
 *
 * ── WHAT IS DELIBERATELY NOT CARRIED ────────────────────────────────────────
 *
 * `videoId` is stored and is not projected. The released contract stores no URL, so any link would
 * be Hebun CONSTRUCTING a YouTube address rather than showing one YouTube reported. The surface
 * renders no link, and without a link the identifier has nothing to do on the screen.
 *
 * `null` IS NOT ZERO. YouTube omits a like or comment count the owner hides; that absence is carried
 * to the screen as "not reported", never as `0`.
 */
import type { StoredProviderObservation } from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";

/** One stored video, as a human may see it. No identifier, no URL. */
export interface YouTubeRecentVideoItemView {
  readonly title: string | null;
  /** When YOUTUBE says the video was published. Never the instant Hebun observed the channel. */
  readonly publishedAt: string | null;
  readonly viewCount: number | null;
  readonly likeCount: number | null;
  readonly commentCount: number | null;
}

/**
 * The stored page.
 *
 * `moreVideosExist` is `boolean | null`: a missing or malformed stored fact leaves the continuation
 * state UNKNOWN, a third answer that must not be flattened into "no more exist".
 */
export interface YouTubeRecentVideoObservationView {
  /** When HEBUN observed the channel. */
  readonly observedAt: string;
  readonly recentVideoCount: number | null;
  readonly moreVideosExist: boolean | null;
  readonly items: readonly YouTubeRecentVideoItemView[];
}

export type YouTubeLatestRecentVideos =
  | { readonly status: "observed"; readonly observation: YouTubeRecentVideoObservationView }
  | { readonly status: "none" }
  | {
      readonly status: "unavailable";
      readonly reason: "unauthenticated" | "persistence-unavailable";
    };

/* The exact fact keys the released YouTube mapper writes. Named, never discovered. */
const RECENT_VIDEOS = "recentVideos";
const RECENT_VIDEO_COUNT = "recentVideoCount";
const MORE_VIDEOS_EXIST = "moreVideosExist";

function textFact(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function countFact(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function itemsFrom(facts: Record<string, unknown>): readonly YouTubeRecentVideoItemView[] {
  const raw = facts[RECENT_VIDEOS];
  /* NOT AN ARRAY IS NOT ZERO VIDEOS — it is a shape this surface cannot read, and it shows nothing. */
  if (!Array.isArray(raw)) return Object.freeze([]);

  const items: YouTubeRecentVideoItemView[] = [];
  for (const entry of raw) {
    /* A malformed entry is SKIPPED, never repaired and never allowed to break the page. */
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const video = entry as Record<string, unknown>;
    items.push(
      Object.freeze({
        title: textFact(video, "title"),
        publishedAt: textFact(video, "publishedAt"),
        viewCount: countFact(video, "viewCount"),
        likeCount: countFact(video, "likeCount"),
        commentCount: countFact(video, "commentCount"),
      }),
    );
  }
  return Object.freeze(items);
}

function viewOf(observation: StoredProviderObservation): YouTubeRecentVideoObservationView {
  const facts = observation.facts as Record<string, unknown>;
  const more = facts[MORE_VIDEOS_EXIST];
  return Object.freeze({
    observedAt: observation.observedAt,
    recentVideoCount: countFact(facts, RECENT_VIDEO_COUNT),
    /* ABSENT OR MALFORMED MEANS UNKNOWN. It does not mean "no more exist". */
    moreVideosExist: typeof more === "boolean" ? more : null,
    items: itemsFrom(facts),
  });
}

/** Narrow the read seam's answer to the newest stored page of videos. */
export function projectLatestYouTubeRecentVideos(
  result: ProviderObservationReadResult,
): YouTubeLatestRecentVideos {
  if (result.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: result.reason });
  }
  /* The seam returns newest-first; element zero is the newest, as every released projection assumes. */
  const latest = result.observations[0];
  if (!latest) return Object.freeze({ status: "none" as const });
  return Object.freeze({ status: "observed" as const, observation: viewOf(latest) });
}

/* ── The words this section is allowed to say ─────────────────────────────── */

export const YOUTUBE_RECENT_VIDEOS_MEANING: string =
  "These are the videos YouTube reported at the instant below, kept exactly as they were said. " +
  "It is a record of one provider answer, not a statement of what this channel holds now, and Hebun " +
  "derives nothing from it.";

/** Said instead of a value the provider withheld. Never `0`, and never a blank. */
export const YOUTUBE_VIDEO_NO_TITLE = "YouTube did not report a title." as const;
export const YOUTUBE_VIDEO_NO_PUBLISHED_AT = "YouTube did not report when this was published." as const;
export const YOUTUBE_VIDEO_NO_VIEWS = "YouTube did not report the view count." as const;
export const YOUTUBE_VIDEO_NO_LIKES = "YouTube did not report the like count." as const;
export const YOUTUBE_VIDEO_NO_COMMENTS = "YouTube did not report the comment count." as const;

/** Shown in place of a count the provider did not report. Never `0`. */
export const YOUTUBE_VIDEO_COUNT_UNREPORTED = "—" as const;

/**
 * Why an observed page shows no video. TWO answers, because there are two facts.
 *
 * `reported-none`: the stored page count is `0` — YouTube returned no videos at that instant. It is
 * said as the provider's answer and nothing more: not inactivity, not a failure, not a prompt.
 *
 * `unreadable`: the stored count is absent or non-zero, yet no readable entry exists. Hebun cannot
 * say what YouTube reported, and says so rather than presenting it as zero.
 */
export const YOUTUBE_RECENT_VIDEOS_EMPTY: Readonly<Record<"reported-none" | "unreadable", string>> =
  Object.freeze({
    "reported-none":
      "YouTube reported no recent videos for this channel at the instant Hebun observed it.",
    unreadable:
      "The stored observation holds no readable video entries, so which videos YouTube reported at " +
      "that instant is unknown.",
  });

/**
 * What the page's edge means. THREE answers, because there are three facts. The bounded case says
 * the bound in the same breath as the count, so a page cannot be mistaken for the channel's history.
 */
export const YOUTUBE_RECENT_VIDEOS_WINDOW: Readonly<Record<"bounded" | "complete" | "unknown", string>> =
  Object.freeze({
    bounded:
      "Hebun stored only the videos this single observation returned, and YouTube indicated more " +
      "existed beyond that stored page. This is not the channel's whole history.",
    complete:
      "YouTube reported no additional videos beyond this observed page at that instant.",
    unknown:
      "Whether more videos existed beyond this stored page is unknown — the observation does not " +
      "say either way.",
  });

/** Said when the section can show no observation. One sentence per DIFFERENT fact. */
export const YOUTUBE_RECENT_VIDEOS_ABSENCE: Readonly<
  Record<"none" | "unauthenticated" | "persistence-unavailable", string>
> = Object.freeze({
  /* A FACT about Hebun's records — never a claim about the channel. */
  none:
    "No stored YouTube channel observation is available yet. Nothing was asked of YouTube and " +
    "nothing failed.",
  unauthenticated:
    "This session could not be resolved, so no stored YouTube observation was read. Whether one " +
    "exists is unknown.",
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so which videos YouTube reported is " +
    "unknown. This is not a statement that there are none.",
});

/** Which window sentence this observation earns. */
export function recentVideoWindowStateOf(
  view: YouTubeRecentVideoObservationView,
): "bounded" | "complete" | "unknown" {
  if (view.moreVideosExist === null) return "unknown";
  return view.moreVideosExist ? "bounded" : "complete";
}

/** Which empty sentence an observed page with no items earns. `null` when there are items. */
export function recentVideoEmptyStateOf(
  view: YouTubeRecentVideoObservationView,
): "reported-none" | "unreadable" | null {
  if (view.items.length > 0) return null;
  return view.recentVideoCount === 0 ? "reported-none" : "unreadable";
}

/**
 * One rendered count. `value` is the full sentence for assistive technology; `display` is the
 * compact glyph. One function produces both so they never disagree: a `0` is `0` in both, and a
 * withheld count is an em dash that reads as "YouTube did not report the view count".
 */
export interface YouTubeVideoCountRow {
  readonly label: string;
  readonly value: string;
  readonly display: string;
  readonly reported: boolean;
}

export function describeVideoCounts(item: YouTubeRecentVideoItemView): readonly YouTubeVideoCountRow[] {
  const row = (label: string, count: number | null, withheld: string): YouTubeVideoCountRow =>
    Object.freeze({
      label,
      value: count === null ? withheld : String(count),
      display: count === null ? YOUTUBE_VIDEO_COUNT_UNREPORTED : String(count),
      reported: count !== null,
    });

  return Object.freeze([
    row("Views YouTube reported for this video", item.viewCount, YOUTUBE_VIDEO_NO_VIEWS),
    row("Likes YouTube reported for this video", item.likeCount, YOUTUBE_VIDEO_NO_LIKES),
    row("Comments YouTube reported for this video", item.commentCount, YOUTUBE_VIDEO_NO_COMMENTS),
  ]);
}
