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

/** The account capability. Five facts about the account itself, and nothing about its posts. */
export const INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY = "instagram.account.public.read" as const;

/**
 * The media capability — SEPARATE, and deliberately not folded into the account read.
 *
 * ── WHY A SECOND CAPABILITY RATHER THAN A WIDER FIRST ONE ───────────────────
 *
 * A standing authorization for `instagram.account.public.read` already exists in production. A human
 * approved it when that capability meant five account facts. Teaching that same key to also mean
 * "and every recent post, its caption and its engagement counts" would expand what an
 * ALREADY-GRANTED permission permits, retroactively, with nobody deciding to — which is the exact
 * failure `CONNECTED != AUTHORIZED` exists to prevent.
 *
 * The released YouTube channel capability does carry its videos inside one key. That was decided
 * before anything had been authorized. Instagram's account capability is already authorized, so the
 * same move is no longer available here.
 *
 * A separate key also buys independent cadence (the cadence read keys on capability), independent
 * revocation, and a scope a human can refuse without losing the account read.
 */
export const INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY = "instagram.media.public.read" as const;

/**
 * How many recent media one observation may carry. Ten, matching the released YouTube bound.
 *
 * NOT Meta's maximum. The media edge will serve up to 10K of the most recent media; inheriting that
 * would put a five-figure array in one `jsonb` column on every cadence tick — a denial of service
 * aimed at Hebun's own database, requested politely by Hebun.
 */
export const MAX_RECENT_MEDIA = 10 as const;

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
  /*
   * BY ID. The observation path: an authorization names a subject, and this reads exactly that
   * subject. The id-mismatch guard on this operation is what makes an authorization binding, and it
   * stays.
   */
  Object.freeze({ id: "account.read", path: "/{account-id}", params: ["fields"] }),
  /*
   * THE SELF-READ. `/me` is Meta's documented node for "the account this token belongs to", and it
   * takes NO id at all — which is the point. A real ceremony was lost to the id it used to take:
   * Meta distinguishes the app-scoped `id` from `user_id` (the Instagram professional account id),
   * the token response supplies the latter, and asking for a node by the wrong one is how Hebun
   * ended up telling a Business account it was not professional. A path with no id cannot be given
   * the wrong one.
   */
  Object.freeze({ id: "account.read.self", path: "/me", params: ["fields"] }),
  /*
   * THE MEDIA EDGE, BY ID. Same argument as `account.read`: an authorization names a subject, and
   * this reads exactly that subject's media. `/me/media` would read whatever account the token
   * happens to belong to, which is not the same sentence and would not bind the authorization.
   *
   * `limit` is a permitted parameter so the bound travels IN the request rather than being applied
   * after a large answer has already been paid for and parsed.
   */
  Object.freeze({ id: "account.media.read", path: "/{account-id}/media", params: ["fields", "limit"] }),
] as const);

/**
 * EVERY SHAPE A REQUEST PATH MAY TAKE, as one closed pattern.
 *
 * This replaces the blunt `"/media"` substring that used to sit in the ban list below, and it is
 * stricter than what it replaces: a substring ban says which one word may not appear, while this
 * enumerates the only three paths that may. `/{account-id}/media_publish`, `/{account-id}/comments`
 * and `/{account-id}/insights` are not merely discouraged here — they are unrepresentable.
 */
export const INSTAGRAM_ALLOWED_OPERATION_PATH_PATTERN = /^\/(?:me|\{account-id\})(?:\/media)?$/;

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
 * The exact fields requested for each media. A closed list, and SHORTER than what Meta offers.
 *
 * ── WHAT WAS LEFT OUT, AND WHY EACH ONE WAS REFUSED ─────────────────────────
 *
 * `media_url` and `thumbnail_url` are EPHEMERAL SIGNED CDN URLS. They expire, so storing one inside
 * an immutable observation would record a fact that stops being true while the row still claims it —
 * and it would quietly make the observation history look like an archive of the images themselves,
 * which it is not and must not become. Hebun stores what the provider SAID, not the provider's
 * bytes.
 *
 * `username` is the connected account's own, already carried by the account observation. Repeating
 * it on every item duplicates a fact that has a home and can drift from it.
 *
 * `shortcode` is derivable from `permalink`; storing both is two spellings of one identity.
 *
 * `is_shared_to_feed`, `alt_text`, `is_ai_generated`, `media_audio_type` and the copyright fields
 * are real, and none of them answers a question anybody has asked yet. They can be added by a
 * capability that needs them.
 *
 * WHAT SURVIVED: a stable id, what kind of post it is, what it said, where it lives, when it was
 * published, and the two engagement counts Instagram states publicly.
 */
export const INSTAGRAM_MEDIA_FIELDS: readonly string[] = Object.freeze([
  "id",
  "media_type",
  "caption",
  "permalink",
  "timestamp",
  "like_count",
  "comments_count",
]);

/**
 * Paths, verbs and scopes that must never appear in this provider. Asserted by test against the
 * transport, so a future edit that reaches one of them fails rather than ships.
 *
 * ── WHY `/media` IS NO LONGER ON THIS LIST, AND WHAT REPLACED IT ────────────
 *
 * It was here while this provider could only read the account node, and it was the right rule then.
 * The media READ capability cannot exist under a blanket ban on the word, so the ban was RE-AIMED
 * rather than deleted — the same move the verb ban already made for the OAuth ceremony.
 *
 * What replaced it is stronger, not weaker. `INSTAGRAM_ALLOWED_OPERATION_PATH_PATTERN` enumerates
 * the only three paths any request may take, so `/media_publish` is now unrepresentable as a PATH
 * rather than merely unmentionable as a STRING — and `/media_publish` also stays on this list, so it
 * still may not appear anywhere in this directory in any form.
 *
 * The substring relationship is the trap this comment exists to name: `/media` is a prefix of
 * `/media_publish`, so a careless "just drop the ban" would have unbanned publishing too. It did
 * not, and a test proves it did not.
 */
export const INSTAGRAM_FORBIDDEN_FRAGMENTS: readonly string[] = Object.freeze([
  "graph.facebook.com",
  "/media_publish",
  "/comments",
  "/messages",
  "/conversations",
  "/insights",
  "ig_hashtag_search",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
  "instagram_business_manage_insights",
  "pages_",
]);

/*
 * ── WHY THE VERBS LEFT THE LIST ABOVE, AND WHERE THEY WENT ──────────────────
 *
 * `POST` and `DELETE` were originally in `INSTAGRAM_FORBIDDEN_FRAGMENTS`, which the provider
 * firewall applies to EVERY file in `provider-instagram`. That was correct while the only thing in
 * that directory was a read. It stopped being expressible the moment an OAuth ceremony arrived,
 * because Meta's authorization-code exchange is documented as a POST and there is no GET form of it.
 *
 * THE BAN WAS NOT LOOSENED. It was re-aimed and made narrower: the verbs are banned from every
 * provider file EXCEPT the one module named below, and that module is separately pinned to contain
 * exactly one `POST` whose target is the token endpoint. A second POST anywhere — including a second
 * one in that module — fails a test.
 */
export const INSTAGRAM_FORBIDDEN_VERBS: readonly string[] = Object.freeze(["POST", "DELETE"]);

/**
 * The ONE module permitted to construct a POST, by path. Spelled here rather than in the test so the
 * exemption is part of the provider's declared contract and not a quiet property of a test file.
 */
export const INSTAGRAM_OAUTH_TRANSPORT_MODULE =
  "src/features/provider-instagram/instagram-oauth-transport.server.ts" as const;

/*
 * ════ THE OAUTH CEREMONY'S OWN CONTRACT ═════════════════════════════════════
 *
 * Three DIFFERENT Meta hosts take part, and conflating them is the mistake to avoid:
 *
 *   www.instagram.com    the human-facing consent screen. A browser goes here; Hebun never does.
 *   api.instagram.com    the authorization-code exchange. Server-to-server, once per ceremony.
 *   graph.instagram.com  the long-lived exchange AND every later read. Already declared above.
 *
 * NONE of them is `graph.facebook.com`, which stays banned everywhere in this provider.
 */

/** Where the BROWSER is sent for consent. Hebun never makes a request to this host itself. */
export const INSTAGRAM_AUTHORIZATION_ENDPOINT = "https://www.instagram.com/oauth/authorize" as const;

/** Where the authorization code is exchanged for a short-lived token. The one POST. */
export const INSTAGRAM_TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token" as const;

/** Where a short-lived token becomes a long-lived one. A GET, per Meta's documented contract. */
export const INSTAGRAM_LONG_LIVED_TOKEN_ENDPOINT = "https://graph.instagram.com/access_token" as const;

/** Meta's grant type for the long-lived exchange. Not an OAuth 2.0 standard value. */
export const INSTAGRAM_LONG_LIVED_GRANT_TYPE = "ig_exchange_token" as const;

/**
 * EVERY scope this ceremony may request. ONE entry, and the authorization request is built from this
 * constant rather than from anything a caller supplies — so the set of things Hebun can ever ask an
 * Instagram user to grant is the set written on this line.
 */
export const INSTAGRAM_REQUESTED_SCOPES: readonly string[] = Object.freeze([
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
]);

/**
 * What a grant must cover for a connection to mean anything.
 *
 * Identical to the requested set today, and kept as its own name because they answer different
 * questions: one is what Hebun ASKS for, the other is what Hebun REFUSES to proceed without. A
 * future optional scope would widen the first and must not widen the second.
 */
export const INSTAGRAM_REQUIRED_SCOPES: readonly string[] = Object.freeze([
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
]);

/**
 * What the token response said about the grant.
 *
 * ── THREE ANSWERS, BECAUSE THERE ARE THREE FACTS ────────────────────────────
 *
 * The first version of this returned `readonly string[] | null` and folded two unlike things into
 * that `null`: "Instagram did not state the grant" and "Instagram stated it in a shape this code
 * does not understand". A real production ceremony then failed on the difference — Meta issued a
 * token, named the account, and described the grant in a form the parser refused, and Hebun
 * reported that as an insufficient scope. It was not insufficient. It was unread.
 *
 *   STATED      Instagram named the permissions. They can be checked.
 *   UNSTATED    the field was absent or null. NOTHING is claimed either way, and the decision
 *               belongs to the one authority that can actually settle it — a real read.
 *   UNREADABLE  the field was present in a shape with no honest reading. FAIL CLOSED: this is
 *               refused as malformed, never quietly treated as sufficient and never as unstated.
 */
export type GrantedPermissions =
  | { readonly kind: "stated"; readonly scopes: readonly string[] }
  | { readonly kind: "unstated" }
  | { readonly kind: "unreadable" };

/**
 * Read Meta's statement of the grant.
 *
 * BOTH DOCUMENTED AND OBSERVED FORMS ARE ACCEPTED. Meta publishes a comma-separated string; a JSON
 * array of strings is the same statement written differently, and accepting it is not a widening —
 * an explicit list is an explicit list. Anything else is `unreadable`, including an array with a
 * non-string member, because a grant Hebun can only half-read is a grant it cannot check.
 */
export function parseGrantedPermissions(raw: unknown): GrantedPermissions {
  /* ABSENT. Not empty, not denied — simply not said. */
  if (raw === undefined || raw === null) return Object.freeze({ kind: "unstated" as const });

  if (typeof raw === "string") {
    return Object.freeze({
      kind: "stated" as const,
      scopes: Object.freeze(
        raw
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0),
      ),
    });
  }

  if (Array.isArray(raw)) {
    /* EVERY member must be a string. One that is not makes the whole list unreadable. */
    if (!raw.every((entry) => typeof entry === "string")) {
      return Object.freeze({ kind: "unreadable" as const });
    }
    return Object.freeze({
      kind: "stated" as const,
      scopes: Object.freeze(
        (raw as readonly string[]).map((entry) => entry.trim()).filter((entry) => entry.length > 0),
      ),
    });
  }

  /* A number, a boolean, an object. Present, and with no honest reading. */
  return Object.freeze({ kind: "unreadable" as const });
}

/** Whether what Instagram SAID it granted covers what this connection needs. */
export function coversRequiredScopes(granted: readonly string[]): boolean {
  return INSTAGRAM_REQUIRED_SCOPES.every((required) => granted.includes(required));
}

/**
 * A token exactly as the ceremony obtained it.
 *
 * `expiresAt` is `null` for a short-lived token whose lifetime Meta does not state on the response,
 * and a real instant for a long-lived one, computed from `expires_in` against Hebun's clock. It is
 * NOT defaulted to an hour: a guessed expiry stored as a fact is a fact Hebun invented.
 */
export interface InstagramTokenGrant {
  readonly accessToken: string;
  /** The Instagram-scoped account id the token belongs to. Absent on the long-lived exchange. */
  readonly accountId: string | null;
  /**
   * What Instagram SAID it granted, or `null` when it said nothing.
   *
   * `null` IS NOT "GRANTED NOTHING". It means the provider made no statement, so no statement is
   * repeated. It is never the basis for admitting a connection: coverage is settled by a real read,
   * and this field is a claim to be checked when it exists, not a substitute for that read.
   */
  readonly grantedScopes: readonly string[] | null;
  readonly expiresAt: Date | null;
}

export type InstagramTokenResult =
  | { readonly ok: true; readonly grant: InstagramTokenGrant }
  | InstagramFailure;

/*
 * ════ ACCOUNT TYPE ══════════════════════════════════════════════════════════
 *
 * Meta documents `Business` and `Media_Creator` for this API. A live professional account answered
 * `"BUSINESS"` — same value, different casing — so a literal comparison against the documented
 * spelling would refuse a real Business account. Normalization is therefore not a convenience; it
 * is the difference between reading the provider and reading the documentation.
 *
 * `CREATOR` is carried too: Meta's own account-type vocabulary has used it, and this API is
 * documented as serving Business AND Creator accounts.
 */
const NORMALIZED = (raw: string): string => raw.trim().toUpperCase().replace(/[\s-]+/g, "_");

/** Account types this API is documented to serve. */
export const INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES: readonly string[] = Object.freeze([
  "BUSINESS",
  "MEDIA_CREATOR",
  "CREATOR",
]);

/** Account types Meta uses for accounts this API does not serve. */
export const INSTAGRAM_NON_PROFESSIONAL_ACCOUNT_TYPES: readonly string[] = Object.freeze([
  "PERSONAL",
]);

/**
 * What the provider said about the account's type.
 *
 *   professional      a documented professional type. The connection may proceed.
 *   non-professional  a documented type this API does not serve. THIS is the only thing that may
 *                     ever be reported as `not-professional`.
 *   unstated          the field was absent or null. NOT read as personal, and NOT read as Business:
 *                     nothing is claimed, and the successful read stands on its own — this API
 *                     answers for no other kind of account.
 *   unrecognized      a literal outside both lists. Present, and with no honest reading. Refused as
 *                     malformed rather than guessed in either direction.
 */
export type InstagramAccountTypeVerdict =
  | "professional"
  | "non-professional"
  | "unstated"
  | "unrecognized";

export function classifyAccountType(raw: unknown): InstagramAccountTypeVerdict {
  if (raw === undefined || raw === null || raw === "") return "unstated";
  if (typeof raw !== "string") return "unrecognized";
  const normalized = NORMALIZED(raw);
  if (INSTAGRAM_PROFESSIONAL_ACCOUNT_TYPES.includes(normalized)) return "professional";
  if (INSTAGRAM_NON_PROFESSIONAL_ACCOUNT_TYPES.includes(normalized)) return "non-professional";
  return "unrecognized";
}

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

/**
 * One media, exactly as Instagram reported it.
 *
 * EVERY FIELD EXCEPT THE ID IS NULLABLE, AND `null` MEANS THE PROVIDER DID NOT REPORT IT. Instagram
 * documents that `like_count` is omitted when the account owner has hidden like counts — so `null`
 * here is a real, expected, meaningful answer, and rendering it as `0` would state a number the
 * owner deliberately withheld.
 *
 * `caption` is UNTRUSTED EXTERNAL TEXT written by whoever posted it. It is carried verbatim as data
 * and is never a command, never a template, and never interpolated into anything that executes.
 *
 * `permalink` is a PROVIDER-SUPPLIED URL. It is stored and may be shown; it is never fetched,
 * validated by visiting, or treated as a destination Hebun vouches for.
 */
export interface InstagramMediaView {
  readonly mediaId: string;
  readonly mediaType: string | null;
  readonly caption: string | null;
  readonly permalink: string | null;
  readonly publishedAt: string | null;
  readonly likeCount: number | null;
  readonly commentCount: number | null;
}

/**
 * What one media observation is: a BOUNDED, TRUNCATION-DISCLOSING window on the account's recent
 * media at one instant.
 *
 * `recentMediaCount` IS THE SIZE OF THIS WINDOW, NOT THE ACCOUNT'S TOTAL MEDIA COUNT. The account
 * node reports the total; this edge reports a page. Conflating them would let a bound look like a
 * fact about the account.
 */
export interface InstagramMediaObservation {
  readonly accountId: string;
  readonly recentMedia: readonly InstagramMediaView[];
  /** True when Instagram indicated further media exist beyond this bounded window. */
  readonly moreMediaExist: boolean;
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
