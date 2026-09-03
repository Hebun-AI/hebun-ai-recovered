/*
 * provider-youtube/contracts.ts — the YouTube provider vocabulary (CGO-5). Pure.
 *
 * ── WHAT THIS PROVIDER IS ────────────────────────────────────────────────────
 *
 * PUBLIC OBSERVATION of a YouTube channel through the YouTube Data API v3, authenticated with an
 * API key. An API key answers public reads for whoever holds it and identifies nobody — so a
 * connection to this provider is CREDENTIAL-ONLY (`accountIdentity: "none"`): it binds no account,
 * authorizes nothing on YouTube, and says nothing about who owns any channel it observes.
 *
 * The channel observed is a RUNTIME ARGUMENT to a read, never a field on the connection. Storing
 * `@somebody` on the connection row would say "this tenant connected that channel", which is a
 * different fact from "this tenant holds a key that can look at it".
 *
 * ── THREE OPERATIONS, ALL LISTS, ALL PUBLIC ─────────────────────────────────
 *
 *   channels.list        1 unit   the channel by handle: identity, statistics, uploads playlist
 *   playlistItems.list   1 unit   the most recent uploads (video ids) from that playlist
 *   videos.list          1 unit   public statistics for those ids
 *
 * `search.list` is NOT here (it draws from a separate, 100-call daily allocation and this read
 * never needs it), and nothing with a verb other than `list` is here. The transport refuses any
 * operation outside this table; a test asserts the table contains no insert, update, delete, rate,
 * upload, comment, playlist-mutation, subscription or OAuth path.
 *
 * ── WHAT A NUMBER HERE MEANS ────────────────────────────────────────────────
 *
 * `viewCount: 8420` is what YouTube reported at the moment of the read: an OBSERVED provider fact.
 * "performed well" is a derived judgement, "make more like it" is a recommendation, and "sells
 * rugs" needs conversion evidence. None of those is representable in these types, on purpose.
 * A count YouTube withholds (a hidden subscriber count, a disabled like count) is `null`, never 0.
 *
 * Google Workspace does not own this provider. The key lives in a Google Cloud project, but the
 * catalog entry, the credential kind, the verifier and the transport are YouTube's own.
 */

export const YOUTUBE_PROVIDER_KEY = "youtube" as const;
export const YOUTUBE_PROVIDER_LABEL = "YouTube" as const;
export const YOUTUBE_API_ORIGIN = "https://www.googleapis.com/youtube/v3" as const;

/** The one capability this provider offers. Public read; no write half exists. */
export const YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY = "youtube.channel.public.read" as const;

/**
 * The label a credential-only connection carries. There is no account to name, and this says so
 * in the words a surface will show, so nobody has to invent a softer sentence.
 */
export const YOUTUBE_CONNECTION_LABEL = "YouTube Data API v3 — public read (no account)" as const;

/**
 * The channel verification asks about. Verification must make ONE real call to prove the key is
 * accepted and the API is enabled; it asks about YouTube's own channel so that proving the key
 * never involves — or stores — any channel a tenant cares about.
 */
export const YOUTUBE_VERIFICATION_PROBE_HANDLE = "@YouTube" as const;

/** A YouTube handle: 3–30 of letters, digits, `.`, `_`, `-`, with or without the leading `@`. */
export const YOUTUBE_HANDLE_RE = /^@?[A-Za-z0-9._-]{3,30}$/;

export function normalizeYouTubeHandle(raw: string): string | null {
  const trimmed = raw.trim();
  if (!YOUTUBE_HANDLE_RE.test(trimmed)) return null;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

/** How many recent uploads one observation reads. One page, one unit, never a second page. */
export const MAX_RECENT_VIDEOS = 10 as const;

/** Quota units one full observation spends: channels + playlistItems + videos. */
export const OBSERVATION_QUOTA_UNITS = 3 as const;

/**
 * Every request the transport may make, as METHOD + PATH + the query parameters it may carry.
 * `list` methods only. The transport refuses anything else by construction.
 */
export const YOUTUBE_ALLOWED_OPERATIONS = Object.freeze([
  Object.freeze({ id: "channels.list", path: "/channels", params: ["part", "forHandle", "id"] }),
  Object.freeze({ id: "playlistItems.list", path: "/playlistItems", params: ["part", "playlistId", "maxResults"] }),
  Object.freeze({ id: "videos.list", path: "/videos", params: ["part", "id"] }),
] as const);

export type YouTubeOperationId = (typeof YOUTUBE_ALLOWED_OPERATIONS)[number]["id"];

/** Paths and verbs that must never appear in this provider. Asserted by test against the transport. */
export const YOUTUBE_FORBIDDEN_FRAGMENTS: readonly string[] = Object.freeze([
  "/search",
  "/upload",
  "insert",
  "update",
  "delete",
  "/rate",
  "/comment",
  "/subscriptions",
  "/captions",
  "/liveBroadcasts",
  "/thumbnails",
  "oauth",
  "mine=true",
]);

/**
 * Why a YouTube call did not produce an observation. Each is a DIFFERENT fact and reaches the
 * connection lifecycle differently — see `lifecycleClassFor` in the verifier.
 */
export type YouTubeFailureClass =
  /** YouTube rejected the key itself (invalid, deleted, or restricted away from this API). */
  | "auth"
  /** The key is accepted but YouTube Data API v3 is not enabled on its project. */
  | "disabled"
  /** The project's daily quota is exhausted or rate-limited. The key and the API are fine. */
  | "quota"
  /** YouTube answered and reported no such channel or no such playlist. */
  | "not-found"
  /** A 5xx, a timeout, a DNS or TLS fault. Nothing is known about the key. */
  | "transport"
  /** YouTube answered in a shape this provider does not understand. */
  | "malformed";

export interface YouTubeFailure {
  readonly ok: false;
  readonly failure: YouTubeFailureClass;
  /** A CLASSIFIED reason. Never a provider body, never a key, never a URL. */
  readonly reason: string;
}

/** A public channel as YouTube reported it. Every count is what the provider said, or null. */
export interface YouTubeChannelView {
  readonly channelId: string;
  readonly title: string;
  /** `@handle` when YouTube reports a custom URL; null otherwise. */
  readonly handle: string | null;
  readonly publishedAt: string | null;
  readonly viewCount: number | null;
  /** Null when the channel hides it (`hiddenSubscriberCount`), or when YouTube omitted it. */
  readonly subscriberCount: number | null;
  readonly hiddenSubscriberCount: boolean;
  readonly videoCount: number | null;
}

/** A public video as YouTube reported it. Like and comment counts may be withheld by the owner. */
export interface YouTubeVideoView {
  readonly videoId: string;
  readonly title: string;
  readonly publishedAt: string | null;
  readonly viewCount: number | null;
  readonly likeCount: number | null;
  readonly commentCount: number | null;
}

/** One observation: live, provider-derived, stored nowhere. */
export interface YouTubeChannelObservation {
  readonly channel: YouTubeChannelView;
  readonly recentVideos: readonly YouTubeVideoView[];
  /** True when the uploads playlist reported more than `MAX_RECENT_VIDEOS`. */
  readonly moreVideosExist: boolean;
  readonly observedAt: string;
  readonly quotaUnitsSpent: number;
}

export type YouTubeResult<T> = { readonly ok: true; readonly value: T } | YouTubeFailure;
