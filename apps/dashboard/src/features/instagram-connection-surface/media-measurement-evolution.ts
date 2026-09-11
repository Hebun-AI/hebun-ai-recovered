/*
 * instagram-connection-surface/media-measurement-evolution.ts — IG-AN3.
 *
 * ── THE ONE SENTENCE THIS MODULE MAY PRODUCE ────────────────────────────────
 *
 *   "For the post Instagram identifies as M, the count Instagram reported at the instant Hebun
 *    observed T₁ and the count it reported at T₂ differ by N."
 *
 * NOT "this post performed well", not "engagement is growing", not "this one is the best". A number,
 * the two numbers it came from, and the post they belong to. Whether +15 likes is good news is a
 * judgement about a business, and this module has no evidence for one and no field to carry it.
 *
 * ── WHY THIS SHARES NO TYPES WITH IG-AN2 ────────────────────────────────────
 *
 * IG-AN2 compares ONE subject — the account — across two instants. This compares MANY subjects, each
 * of which may appear in one observation and not the other. The two are not the same question with a
 * different noun: an account cannot go missing between observations and a post routinely can, so the
 * media derivation needs states IG-AN2 has no use for (`no-matching-media`) and a per-item identity
 * IG-AN2 has no field for.
 *
 * A shared `InstagramMetricComparison` would let a caller build one list containing a FOLLOWER delta
 * and a LIKE delta and ask "how did Instagram change?" — a question neither derivation answers and
 * neither has the evidence for. That is the same refusal IG-AN2 already makes against YT-SOC2, kept
 * rather than undone here, and it is why the shapes below look alike and are deliberately distinct.
 *
 * ── IDENTITY IS `mediaId`, AND NOTHING ELSE ─────────────────────────────────
 *
 * Two entries describe the same post when Instagram gives them the same `mediaId`. Never when they
 * share a caption — captions are edited. Never when they sit at the same array index — the provider
 * reorders. Never when their permalinks match — a permalink is a URL the provider chooses and this
 * module already refuses to treat as authoritative anywhere else. Never when their publication times
 * are close — proximity is not identity.
 *
 * A stored entry with no usable `mediaId` is UNMATCHABLE and is dropped from the comparison. It is
 * not given a synthetic key: a generated identity would silently match two different posts the
 * moment the provider omitted the field twice.
 *
 * ── THE CONTENT FIELDS COME FROM THE LATEST OBSERVATION ─────────────────────
 *
 * A caption can be edited between observations, so there are two different true answers to "what
 * does this post say" and the module must pick one and say which. It takes the LATEST, because the
 * later observation is the more recent thing Instagram said — and because a card showing yesterday's
 * caption beside today's count would attribute a number to text that no longer carries it.
 *
 * ── A PURE DERIVATION ───────────────────────────────────────────────────────
 *
 * No database, no provider, no tenant, no clock, no persistence, no cache. It is handed the result
 * the released read seam already produced. Nothing is stored: the calculation is reproducible from
 * the observations at any time, which is why there is no analytics table.
 */
import type {
  ObservationFacts,
  StoredProviderObservation,
} from "@/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";
import { safeInstagramPermalink } from "./latest-media-observation";

/**
 * How many media observations a caller should ask the read seam for.
 *
 * ── WHY THIS IS A SEPARATE CONSTANT FROM THE ACCOUNT SERIES' 30 ─────────────
 *
 * It is deliberately equal to `ACCOUNT_SERIES_OBSERVATION_LIMIT` and deliberately not the same
 * constant. The two capabilities are observed under separate authorizations and could be given
 * separate cadences tomorrow; one shared number would make a change to either silently change the
 * other. Equal values that can diverge are not a duplication — they are two decisions that currently
 * agree.
 *
 * The derivation below works on whatever it is given. This is the RECOMMENDATION a caller passes,
 * not a bound this module enforces.
 */
export const MEDIA_EVOLUTION_OBSERVATION_LIMIT = 30 as const;

/** The exact fact keys the released Instagram media mapper writes. Named, never discovered. */
const RECENT_MEDIA = "recentMedia";
const MEDIA_ID = "mediaId";

/**
 * WHY A MEDIA METRIC COULD NOT BE COMPARED.
 *
 * Never "no data". Which SIDE is missing is the fact a reader needs: a count Instagram stopped
 * reporting for a post and one it only just started reporting are different situations, and both
 * differ from one it has never reported for that post.
 *
 * Structurally identical to the account gap today, and deliberately its own type — see the header.
 */
export type InstagramMediaComparabilityGap =
  | "previous-not-reported"
  | "latest-not-reported"
  | "neither-reported";

/**
 * One metric of one post across two instants.
 *
 * `comparable` carries the arithmetic AND both inputs, so a reader can recheck the subtraction
 * against the evidence rather than trust it. `not-comparable` carries whatever WAS reported — a
 * present endpoint is not discarded because its partner is missing — and never substitutes zero for
 * the absent one. **An absent baseline does not make the latest value a change from nothing; it
 * makes the change unknowable.**
 *
 * There is no `change` field on the `not-comparable` arm. The absence of the field is the guarantee.
 */
export type InstagramMediaMetricComparison =
  | {
      readonly status: "comparable";
      readonly previous: number;
      readonly latest: number;
      /** HEBUN CALCULATED: `latest - previous`. Zero is a result, not an absence. */
      readonly change: number;
    }
  | {
      readonly status: "not-comparable";
      readonly gap: InstagramMediaComparabilityGap;
      readonly previous: number | null;
      readonly latest: number | null;
    };

/**
 * One post, present in BOTH compared observations.
 *
 * ── EACH METRIC IS EVALUATED INDEPENDENTLY ─────────────────────────────────
 *
 * A post whose like count is comparable and whose comment count is not keeps both answers. Dropping
 * the whole item because one metric was withheld would discard evidence Instagram actually gave.
 *
 * `mediaId` is here because it is the identity the match was made on, and a reader who cannot see it
 * cannot audit the match. It is a PROVIDER IDENTIFIER, not a measurement: nothing below ranks by it,
 * and no surface is obliged to print it.
 */
export interface InstagramMediaEvolutionItem {
  /** INSTAGRAM REPORTED. The matching identity, from both observations, identical by definition. */
  readonly mediaId: string;
  /* INSTAGRAM REPORTED, as of the LATEST observation. See the header. */
  readonly mediaType: string | null;
  readonly caption: string | null;
  /** Only ever a permalink the released policy judged safe to link. `null` otherwise. */
  readonly permalink: string | null;
  readonly publishedAt: string | null;
  /* HEBUN CALCULATED, per metric, independently. */
  readonly likeCount: InstagramMediaMetricComparison;
  readonly commentCount: InstagramMediaMetricComparison;
}

/**
 * What the evidence supports — six distinguishable answers, none collapsed into another.
 *
 * The distinctions are the whole point of the phase:
 *
 *   unavailable            Hebun could not read its own history. Nothing is known.
 *   no-observations        Hebun read successfully and holds no media observation at all.
 *   no-usable-media        Observations exist, but none carried a post Hebun could identify.
 *   insufficient-history   One usable observation. Two are needed and the second does not exist.
 *   no-matching-media      Two usable observations, and not one post appears in both.
 *   compared               The comparison, per post, per metric.
 *
 * `no-matching-media` is the state IG-AN2 has no analogue for. It is a real and honest outcome — an
 * account that posted eight new items and dropped eight old ones out of the stored window has two
 * genuine observations and nothing to compare — and reporting it as "insufficient history" would
 * blame Hebun's records for a fact about the account's activity.
 */
export type InstagramMediaEvolution =
  | {
      readonly status: "unavailable";
      readonly reason: "unauthenticated" | "persistence-unavailable";
    }
  | { readonly status: "no-observations" }
  | {
      readonly status: "no-usable-media";
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "insufficient-history";
      readonly observationsWithMedia: number;
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "no-matching-media";
      /** HEBUN OBSERVED — the window that turned up no shared post. */
      readonly previousObservedAt: string;
      readonly latestObservedAt: string;
      readonly previousMediaCount: number;
      readonly latestMediaCount: number;
      readonly observationsConsidered: number;
    }
  | {
      readonly status: "compared";
      /** HEBUN OBSERVED — the window the arithmetic below spans. */
      readonly previousObservedAt: string;
      readonly latestObservedAt: string;
      readonly observationsConsidered: number;
      /** Posts in BOTH observations, in the LATEST observation's own order. Never a ranking. */
      readonly items: readonly InstagramMediaEvolutionItem[];
      /** Identified in the earlier observation only. A COUNT, because there is nothing to compare. */
      readonly onlyInPrevious: number;
      /** Identified in the later observation only. A first sighting is not a change from zero. */
      readonly onlyInLatest: number;
    };

/* ── Reading one stored observation ────────────────────────────────────────── */

/** One post as one observation reported it. Internal: never leaves this module. */
interface MediaMeasurement {
  readonly mediaId: string;
  readonly mediaType: string | null;
  readonly caption: string | null;
  readonly permalink: string | null;
  readonly publishedAt: string | null;
  readonly likeCount: number | null;
  readonly commentCount: number | null;
}

interface MediaSnapshot {
  readonly observedAt: string;
  /** Keyed by `mediaId`. A Map because identity is a lookup, not a scan. */
  readonly items: ReadonlyMap<string, MediaMeasurement>;
  /** The provider's own order, preserved so the comparison can present it unchanged. */
  readonly order: readonly string[];
}

function textFact(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  return typeof value === "string" ? value : null;
}

function countFact(source: Record<string, unknown>, key: string): number | null {
  const value = source[key];
  /*
   * A COUNT IS A COUNT ONLY WHEN IT IS A FINITE NUMBER. A numeric string, `NaN`, a boolean or a
   * nested shape are all "the provider did not report a usable count", and are carried as `null`
   * rather than parsed into one — a measurement Hebun had to repair is not one Instagram made.
   */
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Read the identifiable posts out of one stored media observation.
 *
 * A malformed entry is SKIPPED, never repaired. An entry with no usable `mediaId` is skipped for the
 * reason in the header: it cannot be matched, and inventing a key for it would match posts that are
 * not the same post.
 *
 * ── A REPEATED `mediaId` KEEPS ITS FIRST ENTRY ──────────────────────────────
 *
 * The provider should never report one post twice in one window. If it does, this takes the first
 * and ignores the rest, so the result stays a function of the input rather than depending on which
 * duplicate happened to be last. It does not merge them: two entries claiming to be one post
 * disagree about something, and averaging that disagreement away would manufacture a number.
 */
function snapshotOf(observation: StoredProviderObservation): MediaSnapshot | null {
  if (typeof observation.observedAt !== "string" || observation.observedAt.length === 0) return null;

  const raw = (observation.facts as Record<string, unknown>)[RECENT_MEDIA];
  /* NOT AN ARRAY IS NOT ZERO MEDIA — it is a shape this derivation cannot read. */
  if (!Array.isArray(raw)) return null;

  const items = new Map<string, MediaMeasurement>();
  const order: string[] = [];
  for (const entry of raw) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) continue;
    const media = entry as Record<string, unknown>;
    const mediaId = textFact(media, MEDIA_ID);
    if (mediaId === null || mediaId.length === 0) continue;
    if (items.has(mediaId)) continue;

    items.set(
      mediaId,
      Object.freeze({
        mediaId,
        mediaType: textFact(media, "mediaType"),
        /* Carried verbatim, as data. Untrusted external text — never parsed, never a command. */
        caption: textFact(media, "caption"),
        /* The RELEASED policy, imported rather than restated: https, and Instagram's own host. */
        permalink: safeInstagramPermalink(media.permalink),
        publishedAt: textFact(media, "publishedAt"),
        likeCount: countFact(media, "likeCount"),
        commentCount: countFact(media, "commentCount"),
      }),
    );
    order.push(mediaId);
  }

  if (items.size === 0) return null;
  return Object.freeze({ observedAt: observation.observedAt, items, order: Object.freeze(order) });
}

/* ── The arithmetic ────────────────────────────────────────────────────────── */

function gapOf(previous: number | null, latest: number | null): InstagramMediaComparabilityGap {
  if (previous === null && latest === null) return "neither-reported";
  return previous === null ? "previous-not-reported" : "latest-not-reported";
}

function compareMetric(
  previous: number | null,
  latest: number | null,
): InstagramMediaMetricComparison {
  if (previous === null || latest === null) {
    return Object.freeze({
      status: "not-comparable" as const,
      gap: gapOf(previous, latest),
      previous,
      latest,
    });
  }
  /* THE WHOLE CALCULATION. `4 - 4` is `0`, and that is an answer. */
  return Object.freeze({
    status: "comparable" as const,
    previous,
    latest,
    change: latest - previous,
  });
}

/**
 * Compare the posts in the two most recent media observations that carried identifiable posts.
 *
 * ── WHY THE LAST TWO, AND WHY THEY ARE NOT CALLED A DAY APART ───────────────
 *
 * Searching backwards for the most recent observation in which a given post happens to appear would
 * make the comparison window VARY per post, silently — one post's change measured across six days
 * sitting beside another's measured across one, with nothing on the surface saying so. The window is
 * fixed at the last two usable observations and stated in the result, so a post that fell out of the
 * stored window shows up in `onlyInPrevious` rather than as a longer reach nobody mentioned.
 *
 * The result reports both instants and no interval. **Nothing here may be labelled a daily change:**
 * the observation cadence is a separate authority's contract, this derivation cannot see it, and two
 * observations that happen to fall a day apart are not a guarantee that the next two will.
 *
 * ── WHAT IS NOT CALCULATED, DELIBERATELY ───────────────────────────────────
 *
 * No per-day rate, no percentage, no engagement rate, no velocity, no trend, no score, no ranking.
 * There is no field on any type above in which one could be placed — the absence of the field is the
 * boundary, not a promise in a comment.
 *
 * THE CALLER MUST SCOPE THE READ. This function cannot check that the observations it was handed
 * came from `instagram.media.public.read`; it reads the media fact vocabulary, and a caller who
 * passes account observations will correctly get `no-usable-media` rather than nonsense — but naming
 * the capability at the read remains the caller's obligation.
 */
export function deriveInstagramMediaEvolution(
  result: ProviderObservationReadResult,
): InstagramMediaEvolution {
  if (result.status === "unavailable") {
    return Object.freeze({ status: "unavailable" as const, reason: result.reason });
  }

  const observationsConsidered = result.observations.length;
  if (observationsConsidered === 0) return Object.freeze({ status: "no-observations" as const });

  const snapshots: MediaSnapshot[] = [];
  for (const observation of result.observations) {
    const snapshot = snapshotOf(observation);
    if (snapshot !== null) snapshots.push(snapshot);
  }

  if (snapshots.length === 0) {
    return Object.freeze({ status: "no-usable-media" as const, observationsConsidered });
  }
  if (snapshots.length === 1) {
    return Object.freeze({
      status: "insufficient-history" as const,
      observationsWithMedia: 1,
      observationsConsidered,
    });
  }

  /*
   * OLDEST FIRST, CHOSEN RATHER THAN INHERITED. The read seam returns newest-first because a surface
   * showing "the latest" wants that; a comparison wants time to run forwards, so the sign of every
   * change below is fixed by this line rather than by whichever order the caller happened to pass.
   * String comparison is correct for the ISO-8601 UTC instants the writer stores.
   */
  snapshots.sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0));

  const latest = snapshots[snapshots.length - 1]!;
  const previous = snapshots[snapshots.length - 2]!;

  /*
   * ORDER IS THE PROVIDER'S, NOT HEBUN'S.
   *
   * The items are emitted in the LATEST observation's own array order. Sorting by change would be a
   * RANKING — "the biggest mover first" is a judgement about which post matters, and this phase owns
   * no such authority. Provider order is deterministic for a given pair of observations, which is
   * all a surface needs, and it carries no opinion.
   */
  const items: InstagramMediaEvolutionItem[] = [];
  let onlyInLatest = 0;
  for (const mediaId of latest.order) {
    const latestItem = latest.items.get(mediaId)!;
    const previousItem = previous.items.get(mediaId);
    if (previousItem === undefined) {
      /* A FIRST SIGHTING IS NOT A CHANGE FROM ZERO. It is counted, and compared to nothing. */
      onlyInLatest += 1;
      continue;
    }
    items.push(
      Object.freeze({
        mediaId,
        /* The LATEST observation's content. See the header. */
        mediaType: latestItem.mediaType,
        caption: latestItem.caption,
        permalink: latestItem.permalink,
        publishedAt: latestItem.publishedAt,
        likeCount: compareMetric(previousItem.likeCount, latestItem.likeCount),
        commentCount: compareMetric(previousItem.commentCount, latestItem.commentCount),
      }),
    );
  }

  let onlyInPrevious = 0;
  for (const mediaId of previous.order) {
    if (!latest.items.has(mediaId)) onlyInPrevious += 1;
  }

  if (items.length === 0) {
    return Object.freeze({
      status: "no-matching-media" as const,
      previousObservedAt: previous.observedAt,
      latestObservedAt: latest.observedAt,
      previousMediaCount: previous.items.size,
      latestMediaCount: latest.items.size,
      observationsConsidered,
    });
  }

  return Object.freeze({
    status: "compared" as const,
    previousObservedAt: previous.observedAt,
    latestObservedAt: latest.observedAt,
    observationsConsidered,
    items: Object.freeze(items),
    onlyInPrevious,
    onlyInLatest,
  });
}

/* ── The words a surface may use about this evidence ───────────────────────── */

/**
 * What each non-comparison state means, in the words a human should read.
 *
 * There is deliberately NO entry for `compared`. A comparison speaks for itself in numbers, and any
 * sentence Hebun wrote about one — "these posts are gaining likes", "engagement improved" — would be
 * an interpretation this phase has no authority to make. The absence of that entry is the boundary.
 */
export const INSTAGRAM_MEDIA_EVOLUTION_SENTENCES: Readonly<
  Record<
    | "unauthenticated"
    | "persistence-unavailable"
    | "no-observations"
    | "no-usable-media"
    | "insufficient-history"
    | "no-matching-media",
    string
  >
> = Object.freeze({
  unauthenticated:
    "This session could not be resolved, so no stored media observations were read. Whether any " +
    "post's counts changed is unknown.",
  "persistence-unavailable":
    "Hebun could not read its own observation history just now, so whether any post's counts " +
    "changed is unknown. This is not a statement that nothing changed.",
  "no-observations":
    "Hebun has stored no Instagram media observation for this organization yet. Nothing was asked " +
    "of Instagram and nothing failed.",
  "no-usable-media":
    "Hebun holds media observations, but Instagram identified no post in them that could be matched " +
    "to a later one. There is nothing to compare — a fact about what the provider said, not about " +
    "this account.",
  "insufficient-history":
    "Hebun holds one media observation carrying posts. A comparison needs the same post in two " +
    "observations, and the second has not been made yet. Hebun will not compare a count against an " +
    "assumed starting point.",
  "no-matching-media":
    "Hebun holds two media observations, and no post Instagram reported in the earlier one was " +
    "reported again in the later one. There is nothing to compare — Hebun will not match posts by " +
    "caption, position or publication time.",
});

/**
 * Why a metric could not be compared, said plainly.
 *
 * WHICH SIDE is missing is the fact a reader needs. None of these describes the numbers; they
 * describe the evidence.
 */
export const INSTAGRAM_MEDIA_GAP_NOTES: Readonly<Record<InstagramMediaComparabilityGap, string>> =
  Object.freeze({
    "previous-not-reported":
      "Instagram did not report this count for this post in the earlier observation, so no change " +
      "can be shown.",
    "latest-not-reported":
      "Instagram did not report this count for this post in the later observation, so no change " +
      "can be shown.",
    "neither-reported":
      "Instagram reported this count for this post in neither observation, so no change can be " +
      "shown.",
  });

/**
 * What the unmatched posts mean, said as facts about the stored window.
 *
 * NEITHER IS A CHANGE. A post seen only in the later observation has no baseline and is not "new
 * engagement"; a post seen only in the earlier one may simply have fallen out of a bounded window
 * and is not "deleted". Both sentences say what Hebun holds, and neither says what happened.
 */
export const INSTAGRAM_MEDIA_UNMATCHED_NOTES: Readonly<Record<"onlyInLatest" | "onlyInPrevious", string>> =
  Object.freeze({
    onlyInLatest:
      "Instagram reported these posts only in the later observation, so there is no earlier count " +
      "to compare them against.",
    onlyInPrevious:
      "Instagram reported these posts only in the earlier observation. They are outside the later " +
      "stored window, which is not a statement that they were removed.",
  });
