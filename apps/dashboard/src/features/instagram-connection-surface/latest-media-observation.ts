/*
 * instagram-connection-surface/latest-media-observation.ts — what Instagram posted, and when Hebun
 * looked.
 *
 * ── THE ONE SENTENCE THIS MODULE MAY PRODUCE ────────────────────────────────
 *
 *   "Instagram reported these posts, with these counts, at instant T."
 *
 * NOT "this account has 8 posts", not "engagement is up", not "this one did best". A stored media
 * observation is a bounded window on one moment, and everything interesting anyone might want to do
 * with it — averages, rates, rankings, trends — belongs to an analytics authority that does not
 * exist. This module is where that restraint has to be visible, because the arithmetic is trivial
 * and that is exactly what makes it tempting.
 *
 * ── A PURE PROJECTION ───────────────────────────────────────────────────────
 *
 * It queries nothing, reaches no provider, fetches no URL and writes nothing. It is handed the
 * result the released read seam produced and narrows it to what a human may see.
 *
 * ── WHY THE COUNT IS NOT THE ARRAY LENGTH ───────────────────────────────────
 *
 * `recentMediaCount` is a STORED FACT the writer recorded, not something recomputed here. If the
 * stored count and the stored array ever disagreed, recomputing would hide the disagreement; the
 * count is read as written and the items are rendered as stored.
 *
 * ── EVERY FACT IS UNTRUSTED EXTERNAL DATA ───────────────────────────────────
 *
 * Captions are written by whoever posted them and may contain anything, including text shaped like
 * instructions. They are carried as strings, rendered as text by React, and never parsed. Permalinks
 * are provider-supplied URLs: they are validated narrowly before ever becoming a link, and are never
 * fetched — not for a preview, not to check they resolve.
 *
 * `null` IS NOT ZERO. Instagram omits a like count when the owner hides it; that absence is carried
 * all the way to the screen as "not reported", never as `0`.
 */
import type {
  ObservationFacts,
  StoredProviderObservation,
} from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";

/** One stored media, as a human may see it. Provenance and internal ids are deliberately absent. */
export interface InstagramMediaItemView {
  readonly mediaType: string | null;
  readonly caption: string | null;
  /** Only ever a permalink this module has judged safe to link. `null` otherwise. */
  readonly permalink: string | null;
  readonly publishedAt: string | null;
  readonly likeCount: number | null;
  readonly commentCount: number | null;
}

/**
 * The stored window.
 *
 * `moreMediaExist` is `boolean | null`, and the `null` is load-bearing: an observation whose stored
 * fact is missing or malformed leaves the continuation state UNKNOWN, which is a third answer and
 * must not be flattened into "no more exist".
 */
export interface InstagramMediaObservationView {
  readonly observedAt: string;
  readonly recentMediaCount: number | null;
  readonly moreMediaExist: boolean | null;
  readonly items: readonly InstagramMediaItemView[];
}

export type InstagramLatestMediaObservation =
  | { readonly status: "observed"; readonly observation: InstagramMediaObservationView }
  | { readonly status: "none" }
  | {
      readonly status: "unavailable";
      readonly reason: "unauthenticated" | "persistence-unavailable";
    };

/* The exact fact keys the released mapper writes. Named, never discovered. */
const RECENT_MEDIA = "recentMedia";
const RECENT_MEDIA_COUNT = "recentMediaCount";
const MORE_MEDIA_EXIST = "moreMediaExist";

function textFact(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function countFact(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * A permalink is linkable only if it is an `https:` URL on Instagram's own host.
 *
 * ── WHY A POLICY AND NOT A SANITIZER ────────────────────────────────────────
 *
 * The value is chosen by the provider, and the only thing a surface needs from it is "the post this
 * observation is about". An allow-list of one scheme and one host expresses that; a general URL
 * sanitizer would be a bigger, more permissive answer to a smaller question, and would happily pass
 * `javascript:` variants that a parser disagrees with.
 *
 * A permalink that fails is not a broken observation — the media is still shown, just not as a link.
 */
const INSTAGRAM_HOSTS: readonly string[] = Object.freeze(["www.instagram.com", "instagram.com"]);

export function safeInstagramPermalink(raw: unknown): string | null {
  if (typeof raw !== "string" || raw.length === 0) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (!INSTAGRAM_HOSTS.includes(parsed.hostname.toLowerCase())) return null;
  return parsed.toString();
}

function itemsFrom(facts: ObservationFacts): readonly InstagramMediaItemView[] {
  const raw = (facts as Record<string, unknown>)[RECENT_MEDIA];
  /* NOT AN ARRAY IS NOT ZERO MEDIA — it is a shape this surface cannot read, and it shows nothing. */
  if (!Array.isArray(raw)) return Object.freeze([]);

  const items: InstagramMediaItemView[] = [];
  for (const entry of raw) {
    /* A malformed entry is SKIPPED, never repaired and never allowed to break the page. */
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const media = entry as Record<string, unknown>;
    items.push(
      Object.freeze({
        mediaType: textFact(media, "mediaType"),
        caption: textFact(media, "caption"),
        permalink: safeInstagramPermalink(media.permalink),
        publishedAt: textFact(media, "publishedAt"),
        likeCount: countFact(media, "likeCount"),
        commentCount: countFact(media, "commentCount"),
      }),
    );
  }
  return Object.freeze(items);
}

function viewOf(observation: StoredProviderObservation): InstagramMediaObservationView {
  const facts = observation.facts as Record<string, unknown>;
  const more = facts[MORE_MEDIA_EXIST];
  return Object.freeze({
    observedAt: observation.observedAt,
    recentMediaCount: countFact(facts, RECENT_MEDIA_COUNT),
    /* ABSENT OR MALFORMED MEANS UNKNOWN. It does not mean "no more exist". */
    moreMediaExist: typeof more === "boolean" ? more : null,
    items: itemsFrom(observation.facts),
  });
}

/** Narrow the read seam's answer to the one media observation this surface shows. */
export function projectLatestInstagramMediaObservation(
  result: ProviderObservationReadResult,
): InstagramLatestMediaObservation {
  if (result.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: result.reason });
  }
  const latest = result.observations[0];
  if (!latest) return Object.freeze({ status: "none" as const });
  return Object.freeze({ status: "observed" as const, observation: viewOf(latest) });
}

/* ── The words this section is allowed to say ─────────────────────────────── */

export const INSTAGRAM_MEDIA_HEADING = "Latest media observation" as const;

export const INSTAGRAM_MEDIA_MEANING: string =
  "These are the posts Instagram reported at the instant below, kept exactly as they were said. " +
  "It is a record of one provider answer, not a statement of what this account holds now, and Hebun " +
  "derives nothing from it.";

/** Said instead of a value the provider withheld. Never `0`, and never a blank. */
export const INSTAGRAM_MEDIA_NO_CAPTION = "Instagram did not report a caption." as const;
export const INSTAGRAM_MEDIA_NO_LIKES = "Instagram did not report the like count." as const;
export const INSTAGRAM_MEDIA_NO_COMMENTS = "Instagram did not report the comment count." as const;
export const INSTAGRAM_MEDIA_NO_TYPE = "Instagram did not report the media type." as const;
export const INSTAGRAM_MEDIA_NO_PUBLISHED_AT = "Instagram did not report when this was published." as const;

/**
 * What the window's edge means. THREE ANSWERS, because there are three facts.
 *
 * The bounded case says the bound in the same breath as the count, so a reader cannot mistake a
 * ceiling for a total. The complete case still speaks in the past tense: Instagram said there was
 * nothing further AT THAT MOMENT, which is not a promise about now.
 */
export const INSTAGRAM_MEDIA_WINDOW: Readonly<Record<"bounded" | "complete" | "unknown", string>> =
  Object.freeze({
    bounded:
      "Hebun stored only the media this single observation returned, and Instagram indicated more " +
      "existed beyond that stored window. This is not the whole account.",
    complete:
      "Instagram reported no additional media beyond this observed collection at that instant.",
    unknown:
      "Whether more media existed beyond this stored window is unknown — the observation does not " +
      "say either way.",
  });

/** Said when the section can show no observation. One sentence per DIFFERENT fact. */
export const INSTAGRAM_MEDIA_ABSENCE: Readonly<
  Record<"none" | "unauthenticated" | "persistence-unavailable", string>
> = Object.freeze({
  /* A FACT about Hebun's records — never a claim that the account has no posts. */
  none:
    "No stored Instagram media observation is available yet. Nothing was asked of Instagram and " +
    "nothing failed.",
  unauthenticated:
    "This session could not be resolved, so no stored media observation was read. Whether one " +
    "exists is unknown.",
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so whether a media observation " +
    "exists is unknown. This is not a statement that there is none.",
});

/**
 * A human-readable publication date, or `null` when the provider did not report one.
 *
 * ── FIXED LOCALE, FIXED ZONE, AND NO CLOCK ──────────────────────────────────
 *
 * The repository's released convention for rendering an instant: a server-rendered timestamp must
 * not depend on ambient locale or time zone, or the server and the browser disagree and the value
 * changes meaning with whoever is looking.
 *
 * THIS FORMATS A STORED VALUE; IT DOES NOT READ A CLOCK. There is no `Date.now()` here and there
 * never may be: "28 Jul 2026" is what the provider said, while "43 days ago" would be a statement
 * about the present that no stored observation supports.
 */
export function formatPublishedOn(iso: string | null): string | null {
  if (iso === null) return null;
  const parsed = new Date(iso);
  /* An unparseable provider string is not a date, and is reported as absent rather than as `Invalid Date`. */
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" }).format(parsed);
}

/**
 * A readable label for a provider media type.
 *
 * PRESENTATION ONLY. The stored fact keeps the provider's own spelling; this changes how it reads,
 * never what it means. A type outside the documented set is shown AS THE PROVIDER SAID IT rather
 * than mapped to a guess or hidden — Meta may add one, and inventing a label for an unknown value
 * would be this surface claiming to understand something it does not.
 */
const MEDIA_TYPE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  IMAGE: "Image",
  VIDEO: "Video",
  CAROUSEL_ALBUM: "Carousel",
});

export function mediaTypeLabel(raw: string | null): string | null {
  if (raw === null) return null;
  return MEDIA_TYPE_LABELS[raw] ?? raw;
}

/** Shown in place of a count the provider did not report. Never `0`. */
export const INSTAGRAM_MEDIA_COUNT_UNREPORTED = "—" as const;

/**
 * One rendered row of an item's counts.
 *
 * `value` is the full sentence — used where the meaning must be spelled out, including for assistive
 * technology. `display` is the compact glyph a card shows beside an icon. They must never disagree,
 * which is why one function produces both: a `0` displays as `0` and reads as `0`, while a withheld
 * count displays as an em dash and reads as "Instagram did not report the like count".
 */
export interface InstagramMediaCountRow {
  readonly label: string;
  readonly value: string;
  readonly display: string;
  readonly reported: boolean;
}

/**
 * The two engagement counts as label/value text.
 *
 * A REAL ZERO IS RENDERED AS `0`; a withheld count says so in words. Those are different facts about
 * the world and the difference survives to the screen.
 */
export function describeMediaCounts(item: InstagramMediaItemView): readonly InstagramMediaCountRow[] {
  const row = (label: string, count: number | null, withheld: string): InstagramMediaCountRow =>
    Object.freeze({
      label,
      value: count === null ? withheld : String(count),
      display: count === null ? INSTAGRAM_MEDIA_COUNT_UNREPORTED : String(count),
      reported: count !== null,
    });

  return Object.freeze([
    row("Likes Instagram reported", item.likeCount, INSTAGRAM_MEDIA_NO_LIKES),
    row("Comments Instagram reported", item.commentCount, INSTAGRAM_MEDIA_NO_COMMENTS),
  ]);
}

/** Which window sentence this observation earns. */
export function windowStateOf(
  view: InstagramMediaObservationView,
): "bounded" | "complete" | "unknown" {
  if (view.moreMediaExist === null) return "unknown";
  return view.moreMediaExist ? "bounded" : "complete";
}
