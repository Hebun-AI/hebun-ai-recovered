/*
 * provider-instagram/contracts.ts — the closed vocabulary of Hebun's Instagram READ provider.
 *
 * ── WHICH INSTAGRAM API THIS IS, AND WHY ────────────────────────────────────
 *
 * **Instagram API with Instagram Login**, and deliberately not "Instagram API with Facebook Login
 * for Business". Meta's own documentation states the first "Requires an Instagram Business or
 * Creator Account" while the second "Requires an Instagram Business or Creator Account linked to a
 * Facebook Page". Hebun takes the first: it needs no Facebook Page, mints no Page token, and creates
 * no dependency on Commerce Manager or Business Manager. A Page dependency would be an authority
 * this capability does not need and could not justify.
 *
 * PERSONAL ACCOUNTS ARE NOT SUPPORTED BY THE PROVIDER, not by Hebun's choice. Both API variants
 * require a professional (Business or Creator) account. Hebun does not attempt to soften that.
 *
 * ── ONE CAPABILITY, ONE SCOPE, ONE OPERATION ────────────────────────────────
 *
 * `instagram.account.public.read` reads five authoritative account facts and nothing else. It asks
 * for `instagram_business_basic` and no other scope: not insights, not comments, not messages, and
 * emphatically not `instagram_business_content_publish`. A capability that could publish is a
 * different phase with a different Governance conversation.
 *
 * ── WHAT THIS FILE DELIBERATELY DOES NOT DECLARE ────────────────────────────
 *
 * No media edge, no insights edge, no hashtag search, no comment vocabulary. Each of those is a
 * separate capability with a separate scope, and listing one here early would make the availability
 * seam offer something Hebun cannot deliver — the exact mistake the Google entry's own header
 * records and refuses.
 */

/** The provider key. `instagram`, NOT `meta`. */
export const INSTAGRAM_PROVIDER_KEY = "instagram" as const;
export const INSTAGRAM_PROVIDER_LABEL = "Instagram" as const;

/**
 * The Instagram Login API host. It is NOT `graph.facebook.com`: that host serves the Facebook-Login
 * variant, which this provider does not use and must never reach.
 */
export const INSTAGRAM_API_ORIGIN = "https://graph.instagram.com" as const;

/**
 * The pinned Graph API version.
 *
 * Meta versions its API and retires each version on its own published date — roughly two years, but
 * stated per release rather than as a policy. An unversioned call silently follows Meta's default
 * and would change behaviour underneath Hebun without a commit, so the version is pinned here and
 * moving it is a code change somebody has to justify.
 */
export const INSTAGRAM_API_VERSION = "v23.0" as const;

/** The one capability this provider offers. */
export const INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY = "instagram.account.public.read" as const;

/** How this provider's subject is identified in an authorization and an observation. */
export const INSTAGRAM_ACCOUNT_SUBJECT_KIND = "instagram-account" as const;

/**
 * The ONLY scope this provider requests.
 *
 * `instagram_business_basic` covers account identity and the follower/following/media counts below.
 * Insights would additionally require `instagram_business_manage_insights`; it is not requested,
 * so the availability seam will correctly refuse any insights capability that does not exist.
 */
export const INSTAGRAM_BUSINESS_BASIC_SCOPE = "instagram_business_basic" as const;

export const INSTAGRAM_CONNECTION_LABEL =
  "Instagram Login — professional account read (no Facebook Page)" as const;

/**
 * Every request this provider may make. There is no generic `request(path)`, so a caller cannot
 * reach an endpoint this list does not name — the shape the released YouTube transport already uses.
 *
 * ONE OPERATION. The account node, by id, with an explicit field list.
 */
export const INSTAGRAM_ALLOWED_OPERATIONS = Object.freeze([
  Object.freeze({ id: "account.read", path: "/{account-id}", params: ["fields"] }),
] as const);

export type InstagramOperationId = (typeof INSTAGRAM_ALLOWED_OPERATIONS)[number]["id"];

/**
 * The exact fields requested. A closed list, because `fields=` is the one place an Instagram request
 * could quietly widen: adding `media` or `insights` here would read data no scope was granted for
 * and no authorization named.
 */
export const INSTAGRAM_ACCOUNT_FIELDS: readonly string[] = Object.freeze([
  "id",
  "username",
  "account_type",
  "followers_count",
  "follows_count",
  "media_count",
]);

/**
 * Paths, verbs and scopes that must never appear in this provider. Asserted by test against the
 * transport, so a future edit that reaches one of them fails rather than ships.
 */
export const INSTAGRAM_FORBIDDEN_FRAGMENTS: readonly string[] = Object.freeze([
  "graph.facebook.com",
  "/media_publish",
  "/comments",
  "/messages",
  "/conversations",
  "/insights",
  "/media",
  "ig_hashtag_search",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
  "instagram_business_manage_insights",
  "pages_",
  "POST",
  "DELETE",
]);

/**
 * Why an Instagram call did not produce an observation. Each is a DIFFERENT fact, and they are not
 * collapsed: "the token is dead" and "Instagram is rate-limiting us" call for different responses,
 * and only the first should ever touch a connection's lifecycle.
 */
export type InstagramFailureClass =
  /** Instagram rejected the credential — expired, revoked, or the wrong account. */
  | "auth"
  /** The token is valid but the granted scope does not cover this read. */
  | "scope"
  /** The account is not a professional (Business/Creator) account, so this API refuses it. */
  | "not-professional"
  /** Instagram answered and reported no such account. */
  | "not-found"
  /** Rate limited or quota exhausted. The credential and the account are fine. */
  | "rate-limited"
  /** A 5xx, a timeout, a DNS or TLS fault. Nothing is known about the credential. */
  | "transport"
  /** Instagram answered in a shape this provider does not understand. */
  | "malformed";

export interface InstagramFailure {
  readonly ok: false;
  readonly failure: InstagramFailureClass;
  /** A CLASSIFIED reason. Never a provider body, never a token, never a URL. */
  readonly reason: string;
}

/**
 * An Instagram professional account as Instagram reported it.
 *
 * EVERY COUNT IS `number | null` AND `null` MEANS THE PROVIDER DID NOT REPORT IT. It is not zero.
 * A brand-new account with no followers reports `0`; an account whose count Instagram withheld
 * reports `null`, and collapsing the two would manufacture a fact.
 */
export interface InstagramAccountView {
  readonly accountId: string;
  readonly username: string | null;
  readonly accountType: string | null;
  readonly followersCount: number | null;
  readonly followsCount: number | null;
  readonly mediaCount: number | null;
}

export interface InstagramAccountObservation {
  readonly account: InstagramAccountView;
  /** Hebun's read instant, UTC. The provider does not timestamp this read. */
  readonly observedAt: string;
}

export type InstagramResult<T> =
  | { readonly ok: true; readonly value: T }
  | InstagramFailure;

/** `instagram/account/{id}` — the canonical subject reference this provider owns. */
export const INSTAGRAM_SUBJECT_PREFIX = "instagram/account/" as const;

/** Instagram account ids are digit strings. A caller-typed handle is deliberately not accepted. */
const INSTAGRAM_ACCOUNT_ID_RE = /^[0-9]{1,32}$/;

/**
 * The account id inside a canonical subject reference, or `null`.
 *
 * BY ID, NEVER BY USERNAME. A username can be changed by its owner between the authorization and
 * the read; the numeric id cannot. An authorization binds the id, which is the whole reason the
 * subject reference stores one.
 */
export function accountIdFromSubjectRef(subjectRef: string): string | null {
  if (typeof subjectRef !== "string") return null;
  if (!subjectRef.startsWith(INSTAGRAM_SUBJECT_PREFIX)) return null;
  const id = subjectRef.slice(INSTAGRAM_SUBJECT_PREFIX.length);
  return INSTAGRAM_ACCOUNT_ID_RE.test(id) ? id : null;
}
