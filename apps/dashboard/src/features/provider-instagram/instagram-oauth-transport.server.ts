/*
 * provider-instagram/instagram-oauth-transport.server.ts — THE CEREMONY'S PROVIDER CONTRACT.
 *
 * ── THE ONE MODULE IN THIS PROVIDER PERMITTED TO POST ───────────────────────
 *
 * Meta documents the authorization-code exchange as a POST and offers no GET form of it, so a
 * ceremony is impossible without one. The verb ban was therefore re-aimed rather than lifted: it
 * still applies to every other file in `provider-instagram`, this module is named in
 * `INSTAGRAM_OAUTH_TRANSPORT_MODULE` as the single exemption, and a test pins that this file
 * contains EXACTLY ONE `POST`, aimed at the token endpoint. A second one fails.
 *
 * ── THREE ENDPOINTS, AND WHAT EACH IS ALLOWED TO KNOW ───────────────────────
 *
 *   buildAuthorizationUrl        builds the URL a BROWSER visits. No request is made from here, and
 *                                the App secret is not in it — a client id and a redirect URI are
 *                                public by construction, an App secret is not.
 *   exchangeAuthorizationCode    POST to api.instagram.com. Server-to-server, the secret travels in
 *                                a form body, once per ceremony.
 *   exchangeForLongLivedToken    GET to graph.instagram.com, per Meta's documented contract, which
 *                                carries the secret as a query parameter. See the note below.
 *
 * ── THE ONE PLACE A SECRET RIDES IN A URL, AND WHY ──────────────────────────
 *
 * `ig_exchange_token` is specified by Meta as a GET whose `client_secret` is a query parameter.
 * There is no documented POST alternative. This repository's rule is that a secret never goes in a
 * URL, and this is the single, provider-forced exception: it is confined to one function, the URL is
 * built inside the call and never returned, never logged and never attached to an error, and the
 * failure paths below carry classified reasons rather than any part of the request. Stating the
 * exception is the point — a silent one would be the real defect.
 *
 * ── NOTHING HERE IS LOGGED ──────────────────────────────────────────────────
 *
 * There is no `console` call in this file. No provider body is re-thrown, and no reason string is
 * built from a response body, a token, a code or a URL.
 *
 * Server-only.
 */
import type { FetchLike } from "@/features/provider-youtube/youtube-transport.server";
import {
  INSTAGRAM_AUTHORIZATION_ENDPOINT,
  INSTAGRAM_LONG_LIVED_GRANT_TYPE,
  INSTAGRAM_LONG_LIVED_TOKEN_ENDPOINT,
  INSTAGRAM_REQUESTED_SCOPES,
  INSTAGRAM_TOKEN_ENDPOINT,
  parseGrantedPermissions,
  type InstagramFailureClass,
  type InstagramTokenResult,
} from "./contracts";
import type { ConfiguredInstagramOAuth } from "./instagram-environment.server";

const DEFAULT_TIMEOUT_MS = 10_000;

export interface InstagramOAuthTransportDeps {
  readonly fetchImpl?: FetchLike;
  readonly timeoutMs?: number;
  /** Injected so a test can prove an expiry instant rather than approximate one. */
  readonly now?: () => Date;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("The Instagram OAuth transport is server-only.");
  }
}

function fail(failure: InstagramFailureClass, reason: string): InstagramTokenResult {
  return { ok: false, failure, reason };
}

/**
 * The consent URL a browser is sent to.
 *
 * THE SCOPES COME FROM A FROZEN CONSTANT, never from a parameter. There is no argument by which a
 * caller — or a query string reaching a route — can widen what an Instagram user is asked to grant.
 * `response_type` is `code`, the only value Meta accepts.
 *
 * ── `force_reauth`, AND THE BEHAVIOUR IT EXISTS TO CORRECT ──────────────────
 *
 * Without it, Meta issues a code for whatever Instagram account is ALREADY logged in to that
 * browser and shows no chooser at all. Meta's Business Login reference is explicit about both
 * halves: `force_reauth` "forces an app user to use their Instagram professional account
 * credentials to log into your app even if the user is logged into Instagram", and the login page
 * "is only shown if the user is not logged in prior to beginning authorization flow or if the
 * `force_reauth` parameter field is passed in".
 *
 * That is not a theoretical edge. A tenant connected Instagram in production and silently received
 * the account another tenant was already using, because the operator happened to be signed in to
 * it — the grant was correct, tenant-isolated and useless.
 *
 * IT IS OFF BY DEFAULT AND ASKED FOR EXPLICITLY. A first connection should not force a human to
 * retype a password they are already holding a session for; a deliberate "connect a different
 * account" should. So the caller states the intent and this function spends it.
 *
 * IT CAN ONLY EVER STRENGTHEN THE CHALLENGE. The flag adds an authentication step and touches
 * nothing else — not the scope set, not the redirect, not the state. A request that reached here
 * asking for it has asked to prove MORE, which is why it is safe for the value to originate in a
 * query string when nothing else about this URL may.
 */
export function buildInstagramAuthorizationUrl(
  config: ConfiguredInstagramOAuth,
  stateParameter: string,
  options: { readonly forceReauth?: boolean } = {},
): string {
  assertServerOnly();
  const url = new URL(INSTAGRAM_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  /* THE CONFIGURED VALUE, VERBATIM. Never built from a Host header — see the environment module. */
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  /* Meta accepts a comma-separated list. One entry today, and the join is what keeps it honest. */
  url.searchParams.set("scope", INSTAGRAM_REQUESTED_SCOPES.join(","));
  url.searchParams.set("state", stateParameter);
  /* Absent unless asked for, rather than present-and-false: Meta reads the FIELD, not its value. */
  if (options.forceReauth === true) url.searchParams.set("force_reauth", "true");
  return url.toString();
}

/**
 * Classify a token-endpoint refusal.
 *
 * Meta answers OAuth failures with `error_type`/`code`/`error_message`, and this maps them to the
 * provider's closed vocabulary WITHOUT copying the message: a provider's prose is the one thing most
 * likely to contain an echo of what was sent.
 */
function classifyTokenFailure(status: number, code: number | null): InstagramTokenResult {
  if (status === 429) return fail("rate-limited", "instagram-rate-limited");
  if (status >= 500) return fail("transport", `instagram-${status}`);
  if (code === 190) return fail("auth", "instagram-token-rejected");
  if (code === 10 || code === 200) return fail("scope", "instagram-scope-insufficient");
  if (status === 400) return fail("auth", "instagram-grant-refused");
  if (status === 401 || status === 403) return fail("auth", `instagram-${status}`);
  return fail("transport", `instagram-${status}`);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Read Meta's error code out of either shape it uses, without trusting either to exist. */
function errorCodeOf(json: Record<string, unknown>): number | null {
  const direct = numberOrNull(json.code);
  if (direct !== null) return direct;
  const nested = json.error;
  if (nested && typeof nested === "object") {
    return numberOrNull((nested as Record<string, unknown>).code);
  }
  return null;
}

/** One request, one timeout, one JSON parse. Shared by both exchanges. */
type JsonAnswer =
  | { readonly answered: true; readonly json: Record<string, unknown> }
  | { readonly answered: false; readonly result: InstagramTokenResult };

async function requestJson(
  url: string,
  init: { readonly method: "GET" | "POST"; readonly body?: URLSearchParams },
  deps: InstagramOAuthTransportDeps,
): Promise<JsonAnswer> {
  const fetchImpl = deps.fetchImpl ?? (globalThis.fetch as FetchLike | undefined);
  if (!fetchImpl) return { answered: false, result: fail("transport", "fetch-unavailable") };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  let response: Awaited<ReturnType<FetchLike>>;
  try {
    response = await fetchImpl(url, {
      method: init.method,
      ...(init.body
        ? {
            body: init.body,
            headers: { "content-type": "application/x-www-form-urlencoded" },
          }
        : {}),
      signal: controller.signal,
    });
  } catch {
    /* A DNS fault, a TLS fault, a timeout. NOTHING is known about the credential. */
    return { answered: false, result: fail("transport", "instagram-unreachable") };
  } finally {
    clearTimeout(timer);
  }

  let json: Record<string, unknown>;
  try {
    json = (await response.json()) as Record<string, unknown>;
  } catch {
    return { answered: false, result: fail("malformed", "instagram-body-unparseable") };
  }

  if (!response.ok) {
    return { answered: false, result: classifyTokenFailure(response.status, errorCodeOf(json)) };
  }
  return { answered: true, json };
}

/**
 * Read the code-exchange response.
 *
 * META DOCUMENTS THIS RESPONSE AS `{ data: [ { access_token, user_id, permissions } ] }`. The flat
 * shape is also accepted, because the older Basic Display endpoint returned one and a deployment
 * meeting that variant should not be told its account is malformed — but the tolerance grants
 * nothing: both paths must produce an access token AND an account id, and a response that states no
 * permissions is refused below rather than assumed to have granted the scope Hebun asked for.
 */
function grantFromCodeExchange(json: Record<string, unknown>): InstagramTokenResult {
  const data = json.data;
  const record: Record<string, unknown> =
    Array.isArray(data) && data.length > 0 && typeof data[0] === "object" && data[0] !== null
      ? (data[0] as Record<string, unknown>)
      : json;

  const accessToken = record.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return fail("malformed", "instagram-token-absent");
  }

  /* Meta returns the id as a number in some responses and a string in others. Both are ids. */
  const rawId = record.user_id;
  const accountId =
    typeof rawId === "string" && rawId.length > 0
      ? rawId
      : typeof rawId === "number" && Number.isFinite(rawId)
        ? String(rawId)
        : null;
  if (accountId === null) return fail("malformed", "instagram-account-id-absent");

  /*
   * ── AN UNSTATED GRANT IS NOT AN INSUFFICIENT ONE ────────────────────────
   *
   * This used to refuse with `scope` whenever the permissions could not be read as a string, and a
   * real ceremony died there: Meta issued a token for the right account and described the grant in
   * a form this parser did not accept, and Hebun told the tenant their scope was insufficient. It
   * was not. Hebun simply had not read it.
   *
   * Now the three answers stay apart. UNREADABLE is still a hard refusal — a present-but-unreadable
   * statement is malformed, and nothing proceeds on it. UNSTATED carries `null` forward and decides
   * nothing: whether the grant covers the read is settled by the VERIFIER, which performs a real
   * authenticated read of the account and cannot succeed without `instagram_business_basic`. That is
   * strictly stronger evidence than a list the provider reports about itself.
   */
  const permissions = parseGrantedPermissions(record.permissions);
  if (permissions.kind === "unreadable") {
    return fail("malformed", "instagram-permissions-unreadable");
  }
  const grantedScopes = permissions.kind === "stated" ? permissions.scopes : null;

  return {
    ok: true,
    grant: {
      accessToken,
      accountId,
      grantedScopes,
      /*
       * NOT DEFAULTED TO AN HOUR. Meta does not state this token's lifetime on this response, and a
       * guessed expiry stored as a fact is a fact Hebun invented. The long-lived exchange below
       * supplies a real one.
       */
      expiresAt: null,
    },
  };
}

/** Read the long-lived exchange response — flat, and the only one that states a lifetime. */
function grantFromLongLivedExchange(
  json: Record<string, unknown>,
  now: Date,
): InstagramTokenResult {
  const accessToken = json.access_token;
  if (typeof accessToken !== "string" || accessToken.length === 0) {
    return fail("malformed", "instagram-token-absent");
  }
  const expiresIn = numberOrNull(json.expires_in);
  return {
    ok: true,
    grant: {
      accessToken,
      /* This exchange answers about a token, not an account. The id came from the first call. */
      accountId: null,
      /* And it restates no permissions. The grant is what the first call reported. */
      grantedScopes: null,
      expiresAt: expiresIn === null ? null : new Date(now.getTime() + expiresIn * 1000),
    },
  };
}

/**
 * Exchange the authorization code for a short-lived token.
 *
 * THE SECRET TRAVELS IN THE FORM BODY. The code is single-use at Meta, and this is called exactly
 * once per ceremony, after the state has already been verified and its cookie destroyed.
 */
export async function exchangeAuthorizationCode(
  input: { readonly code: string },
  config: ConfiguredInstagramOAuth,
  deps: InstagramOAuthTransportDeps = {},
): Promise<InstagramTokenResult> {
  assertServerOnly();
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code: input.code,
  });
  const result = await requestJson(INSTAGRAM_TOKEN_ENDPOINT, { method: "POST", body }, deps);
  if (!result.answered) return result.result;
  return grantFromCodeExchange(result.json);
}

/**
 * Exchange a short-lived token for a long-lived one — about sixty days.
 *
 * This is part of the ceremony, not a lifecycle subsystem: it happens once, inline, while the
 * short-lived token is still the only thing Hebun holds. RENEWING the long-lived token later is a
 * different problem with a different owner, and this phase does not solve it — see the closure note.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string,
  config: ConfiguredInstagramOAuth,
  deps: InstagramOAuthTransportDeps = {},
): Promise<InstagramTokenResult> {
  assertServerOnly();
  /*
   * Built here and never returned. See the header: this is the provider-forced exception to the
   * no-secret-in-a-URL rule, and it is confined to these three lines.
   */
  const url = new URL(INSTAGRAM_LONG_LIVED_TOKEN_ENDPOINT);
  url.searchParams.set("grant_type", INSTAGRAM_LONG_LIVED_GRANT_TYPE);
  url.searchParams.set("client_secret", config.clientSecret);
  url.searchParams.set("access_token", shortLivedToken);

  const result = await requestJson(url.toString(), { method: "GET" }, deps);
  if (!result.answered) return result.result;
  return grantFromLongLivedExchange(result.json, (deps.now ?? (() => new Date()))());
}
