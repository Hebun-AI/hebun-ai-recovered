/*
 * provider-observation-history/record-instagram-media-observation.server.ts — the Instagram media
 * observation, expressed as this authority's own facts.
 *
 * ── WHY THE MAPPER LIVES HERE AND NOT IN THE PROVIDER ───────────────────────
 *
 * The same placement the released account and channel mappers argue for. A firewall asserts that
 * every file under `provider-instagram/` touches no table; a mapper that produced this authority's
 * storage shape from inside the provider would make the provider module the owner of a sentence it
 * does not own. `ObservationFacts` is Provider Observation History's vocabulary, so the translation
 * into it happens here.
 *
 * ── A WINDOW, AND IT SAYS SO ────────────────────────────────────────────────
 *
 * `recentMediaCount` is the size of THIS OBSERVATION'S WINDOW. It is not the account's total media
 * count — the account node reports that, under a different capability — and the two must never be
 * read as the same number. `moreMediaExist` is carried beside it so a clipped window is legible as
 * clipped rather than mistaken for the whole account.
 *
 * ── `null` SURVIVES AS `null` ───────────────────────────────────────────────
 *
 * A count Instagram declined to report stays `null` all the way into storage. Instagram documents
 * that `like_count` is omitted when the owner hides like counts, so `null` here is a real and
 * expected answer — an account with no likes and an account hiding its likes are different facts,
 * and the whole reason `ObservationValue` admits `null` is so a mapper cannot quietly merge them.
 *
 * ── NOTHING IS DERIVED ──────────────────────────────────────────────────────
 *
 * No total, no average, no engagement rate, no best post, no ordering claim beyond the order
 * Instagram returned. This authority stores what a provider said; the moment a mapper computes a
 * ratio it has become an analytics authority nobody chartered.
 *
 * Server-only.
 */
import {
  INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  type InstagramMediaObservation,
} from "@/features/provider-instagram/contracts";
import type { ObservationFacts } from "./contracts";

/**
 * The subject kind a media observation carries — the ACCOUNT, not the media.
 *
 * The subject of this observation is the account whose media was read: the authorization names an
 * account, the read is performed against that account, and the media are what it reported. Minting a
 * per-media subject kind would make every post its own authorizable subject, which is not a thing
 * any human approved and not a sentence Governance was asked.
 */
export const INSTAGRAM_MEDIA_SUBJECT_KIND = INSTAGRAM_ACCOUNT_SUBJECT_KIND;

/** The capability this mapper's observations were read under, re-exported for the composition. */
export const INSTAGRAM_MEDIA_CAPABILITY = INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY;

/** Every key one media item may contribute. Asserted by test, so the closed set cannot widen. */
export const INSTAGRAM_MEDIA_ITEM_FACT_KEYS: readonly string[] = Object.freeze([
  "mediaId",
  "mediaType",
  "caption",
  "permalink",
  "publishedAt",
  "likeCount",
  "commentCount",
]);

/** Every key the mapper may produce at the top level. Asserted by test. */
export const INSTAGRAM_MEDIA_FACT_KEYS: readonly string[] = Object.freeze([
  "accountId",
  "recentMediaCount",
  "moreMediaExist",
  "recentMedia",
]);

/** The media window, exactly as Instagram reported it. */
export function instagramMediaObservationFacts(
  observation: InstagramMediaObservation,
): ObservationFacts {
  return Object.freeze({
    accountId: observation.accountId,
    recentMediaCount: observation.recentMedia.length,
    moreMediaExist: observation.moreMediaExist,
    recentMedia: observation.recentMedia.map((media) =>
      Object.freeze({
        mediaId: media.mediaId,
        mediaType: media.mediaType,
        /* Carried verbatim, as data. Untrusted external text — never a command. */
        caption: media.caption,
        /* A provider-supplied URL. Stored, never fetched. */
        permalink: media.permalink,
        publishedAt: media.publishedAt,
        likeCount: media.likeCount,
        commentCount: media.commentCount,
      }),
    ),
  }) as ObservationFacts;
}
