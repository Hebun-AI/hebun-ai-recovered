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
