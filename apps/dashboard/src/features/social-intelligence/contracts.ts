/*
 * social-intelligence/contracts.ts — which social platforms Hebun SUPPORTS, and what each one's
 * numbers are actually called.
 *
 * ── A DEFINITION IS NOT A CONNECTION ────────────────────────────────────────
 *
 * Every platform below is listed unconditionally, because this file records what Hebun has BUILT.
 * Whether a given organization has connected one is a question only the integration authority can
 * answer, and it is asked in `platform-presence.ts`. Nothing here may be read as evidence that an
 * account exists, that a provider was contacted, or that any number was observed.
 *
 * ── WHY THE METRIC NAMES LIVE HERE AND ARE NOT SHARED ───────────────────────
 *
 * The released derivations (IG-AN1, YT-SOC1) already refuse to share a measurement type, for a
 * reason stated in their own headers: a follower is not a subscriber, a post is not a video, and a
 * generic `audience` field would be a question no provider answers. This file inherits that refusal
 * rather than undoing it at the presentation layer. Two platforms share the SHAPE of a metric cell —
 * a label, a number, a reason it might be missing — and share no metric IDENTITY at all.
 *
 * A third platform added later declares its own three names here. It does not reuse Instagram's.
 */

/** The platforms Hebun has built a social read for. Adding one is a code change, never a config. */
export type SocialPlatformKey = "instagram" | "youtube";

/**
 * What a metric cell must carry to be presentable without lying.
 *
 * `shortLabel` is what a human scans in a card; `label` names the PROVIDER that reported it, so a
 * value can never be quoted away from its source. Both are per-platform, never derived from a
 * shared vocabulary.
 */
export interface SocialMetricDefinition {
  /** The fact key the released observation mapper writes. Named, never discovered. */
  readonly factKey: string;
  /** Scannable identity inside the card: "Followers", "Subscribers". */
  readonly shortLabel: string;
  /** Attributed identity: "Followers Instagram reported". Used as the accessible name. */
  readonly label: string;
}

export interface SocialPlatformDefinition {
  readonly key: SocialPlatformKey;
  /** The released provider key. The join to the connection authority and the observation seam. */
  readonly providerKey: string;
  readonly label: string;
  /**
   * What this platform measures. An Instagram ACCOUNT and a YouTube CHANNEL are different objects
   * under different provider rules; the surface says which, rather than calling both a "profile".
   */
  readonly subjectNoun: string;
  /** The three counts this platform reports, in the order a card presents them. */
  readonly metrics: readonly SocialMetricDefinition[];
}

export const INSTAGRAM_PLATFORM: SocialPlatformDefinition = Object.freeze({
  key: "instagram" as const,
  providerKey: "instagram",
  label: "Instagram",
  subjectNoun: "account",
  metrics: Object.freeze([
    Object.freeze({ factKey: "followersCount", shortLabel: "Followers", label: "Followers Instagram reported" }),
    Object.freeze({ factKey: "followsCount", shortLabel: "Following", label: "Accounts Instagram reported this account follows" }),
    Object.freeze({ factKey: "mediaCount", shortLabel: "Posts", label: "Media Instagram reported" }),
  ]),
});

export const YOUTUBE_PLATFORM: SocialPlatformDefinition = Object.freeze({
  key: "youtube" as const,
  providerKey: "youtube",
  label: "YouTube",
  subjectNoun: "channel",
  metrics: Object.freeze([
    Object.freeze({ factKey: "subscriberCount", shortLabel: "Subscribers", label: "Subscribers YouTube reported" }),
    Object.freeze({ factKey: "videoCount", shortLabel: "Videos", label: "Videos YouTube reported" }),
    Object.freeze({ factKey: "viewCount", shortLabel: "Views", label: "Views YouTube reported" }),
  ]),
});

/**
 * The two counts Instagram reports PER POST, in the order a row presents them.
 *
 * ── WHY THESE ARE NOT IN `INSTAGRAM_PLATFORM.metrics` ───────────────────────
 *
 * Those three describe the ACCOUNT: one subject, one value each, at one instant. These describe a
 * POST, and there are as many of each as there are posts. Putting a per-post like count into the
 * platform's metric list would let a card that renders "the platform's metrics" print a number that
 * belongs to one post as though it belonged to the account.
 *
 * `factKey` names the key the released MEDIA mapper writes inside each `recentMedia` entry — not a
 * top-level observation fact. They are different vocabularies under different capabilities.
 */
export const INSTAGRAM_MEDIA_METRICS: readonly SocialMetricDefinition[] = Object.freeze([
  Object.freeze({
    factKey: "likeCount",
    shortLabel: "Likes",
    label: "Likes Instagram reported for this post",
  }),
  Object.freeze({
    factKey: "commentCount",
    shortLabel: "Comments",
    label: "Comments Instagram reported for this post",
  }),
]);

/** In the order the dashboard presents them. Not a ranking — Instagram simply came first. */
export const SOCIAL_PLATFORMS: readonly SocialPlatformDefinition[] = Object.freeze([
  INSTAGRAM_PLATFORM,
  YOUTUBE_PLATFORM,
]);

/**
 * The display for a count the provider did not report.
 *
 * It is an EM DASH and never a zero, and never the words "no data" — the released Instagram media
 * surface settled the same question the same way, and the reason is the whole point of this phase:
 * a number Hebun was not given and a number that is genuinely nought must not look alike.
 */
export const METRIC_UNREPORTED_DISPLAY = "—" as const;
