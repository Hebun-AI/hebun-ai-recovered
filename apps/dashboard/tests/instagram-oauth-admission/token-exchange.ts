/*
 * INSTAGRAM · the token exchange, against a FAKE Meta.
 *
 * ── THIS IS AN IMPLEMENTATION CONTRACT TEST, NOT AN ACCEPTANCE ──────────────
 *
 * Everything Meta says here is written by this file. It proves that Hebun's ceremony matches the
 * contract Meta DOCUMENTS, and it proves nothing whatsoever about a real Instagram application, a
 * real consent, or a real token. No real Meta acceptance exists at the time this was written.
 *
 * WHAT IT PROVES:
 *
 *   the authorization URL asks for one scope and carries no secret; the code exchange reads Meta's
 *   documented `data[]` shape and refuses a response that states no permissions; the long-lived
 *   exchange produces a REAL expiry from `expires_in`; every documented refusal becomes its own
 *   classified failure; and no reason string ever carries a token, a code or a URL.
 */
import assert from "node:assert/strict";
import {
  INSTAGRAM_AUTHORIZATION_ENDPOINT,
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
  INSTAGRAM_LONG_LIVED_TOKEN_ENDPOINT,
  INSTAGRAM_REQUESTED_SCOPES,
  INSTAGRAM_TOKEN_ENDPOINT,
  coversRequiredScopes,
  parseGrantedPermissions,
} from "../../src/features/provider-instagram/contracts";
import {
  buildInstagramAuthorizationUrl,
  exchangeAuthorizationCode,
  exchangeForLongLivedToken,
} from "../../src/features/provider-instagram/instagram-oauth-transport.server";
import type { ConfiguredInstagramOAuth } from "../../src/features/provider-instagram/instagram-environment.server";

const CONFIG: ConfiguredInstagramOAuth = Object.freeze({
  status: "configured" as const,
  clientId: "1234567890",
  clientSecret: "fixture-not-a-real-app-secret",
  redirectUri: "https://app.example.com/api/integrations/instagram/callback",
  stateSecret: "unit-test-state-secret-32-bytes-min-length",
});

const CODE = "fixture-authorization-code";
const SHORT = "fixture-short-lived-token";
const LONG = "fixture-long-lived-token";
const ACCOUNT = "17841400000000000";

interface Seen {
  url: string;
  method: string | undefined;
  body: string | null;
}

function fake(
  handler: (seen: Seen) => Response,
  log?: Seen[],
): (input: string, init?: RequestInit) => Promise<Response> {
  return async (input, init) => {
    const seen: Seen = {
      url: String(input),
      method: init?.method,
      body: init?.body instanceof URLSearchParams ? init.body.toString() : null,
    };
    log?.push(seen);
    return handler(seen);
  };
}

function ok(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function err(status: number, code: number | null): Response {
  const error: Record<string, unknown> = {};
  if (code !== null) error.code = code;
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function main(): Promise<void> {
  /* ═══ 1. THE AUTHORIZATION URL ═════════════════════════════════════════════ */
  const authUrl = new URL(buildInstagramAuthorizationUrl(CONFIG, "the-nonce"));
  assert.equal(
    `${authUrl.origin}${authUrl.pathname}`,
    INSTAGRAM_AUTHORIZATION_ENDPOINT,
    "consent happens at Meta's documented Instagram Login endpoint",
  );
  assert.equal(authUrl.searchParams.get("response_type"), "code", "the only value Meta accepts");
  assert.equal(authUrl.searchParams.get("client_id"), CONFIG.clientId);
  assert.equal(authUrl.searchParams.get("redirect_uri"), CONFIG.redirectUri, "verbatim from config");
  assert.equal(authUrl.searchParams.get("state"), "the-nonce");

  /* ── LEAST PRIVILEGE, ASSERTED AS AN EXACT SET ─────────────────────────── */
  const asked = (authUrl.searchParams.get("scope") ?? "").split(",").filter(Boolean);
  assert.deepEqual(asked, [INSTAGRAM_BUSINESS_BASIC_SCOPE], "exactly one scope is ever requested");
  assert.deepEqual([...INSTAGRAM_REQUESTED_SCOPES], [INSTAGRAM_BUSINESS_BASIC_SCOPE]);
  for (const forbidden of [
    "instagram_business_content_publish",
    "instagram_business_manage_comments",
    "instagram_business_manage_messages",
    "instagram_business_manage_insights",
    "pages_show_list",
    "pages_read_engagement",
    "business_management",
    "instagram_basic",
  ]) {
    assert.ok(
      !authUrl.toString().includes(forbidden),
      `the consent screen never asks for \`${forbidden}\``,
    );
  }
  /* AND NO SECRET IS IN THE URL A BROWSER SEES. */
  assert.ok(
    !authUrl.toString().includes(CONFIG.clientSecret),
    "the App secret is not part of the authorization URL",
  );
  assert.ok(!authUrl.searchParams.has("code_challenge"), "no PKCE — Meta accepts none here");

  /* ═══ 2. THE CODE EXCHANGE, IN META'S DOCUMENTED SHAPE ═════════════════════ */
  const log: Seen[] = [];
  const exchanged = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: fake(
      () =>
        ok({
          data: [
            {
              access_token: SHORT,
              user_id: ACCOUNT,
              permissions: "instagram_business_basic",
            },
          ],
        }),
      log,
    ),
  });
  assert.ok(exchanged.ok, "a documented response produces a grant");
  assert.equal(exchanged.grant.accessToken, SHORT);
  assert.equal(exchanged.grant.accountId, ACCOUNT, "the account id comes from the provider");
  assert.deepEqual([...(exchanged.grant.grantedScopes ?? [])], [INSTAGRAM_BUSINESS_BASIC_SCOPE]);
  assert.equal(
    exchanged.grant.expiresAt,
    null,
    "and no expiry is invented for a token whose lifetime Meta did not state",
  );

  /* ── THE REQUEST ITSELF ────────────────────────────────────────────────── */
  assert.equal(log.length, 1, "one request per exchange");
  assert.equal(log[0]!.url, INSTAGRAM_TOKEN_ENDPOINT, "aimed at api.instagram.com");
  assert.equal(log[0]!.method, "POST", "Meta documents this exchange as a POST");
  assert.ok(log[0]!.body?.includes("grant_type=authorization_code"));
  assert.ok(
    !log[0]!.url.includes(CONFIG.clientSecret) && !log[0]!.url.includes(CODE),
    "the secret and the code travel in the body, never in the URL",
  );

  /* A numeric `user_id` is the same id. */
  const numericId = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: fake(() =>
      ok({ data: [{ access_token: SHORT, user_id: 17841400000000000, permissions: "instagram_business_basic" }] }),
    ),
  });
  assert.ok(numericId.ok && typeof numericId.grant.accountId === "string", "a numeric id is read as an id");

  /* ═══ 3. WHAT THE EXCHANGE REFUSES ═════════════════════════════════════════ */
  /*
   * ── THE GRANT, IN EVERY SHAPE A REAL PROVIDER PRODUCED OR MIGHT ─────────
   *
   * A production ceremony failed here once: Meta issued a token for the right account and stated
   * the grant in a form the parser refused, and Hebun reported an insufficient scope. The three
   * facts are now kept apart, and each is asserted.
   */

  /* (a) THE DOCUMENTED FORM — a comma-separated string. Unchanged. */
  const commaString = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: fake(() =>
      ok({ data: [{ access_token: SHORT, user_id: ACCOUNT, permissions: "instagram_business_basic,instagram_business_manage_comments" }] }),
    ),
  });
  assert.ok(commaString.ok, "a comma-separated statement is a grant");
  assert.deepEqual(
    [...(commaString.grant.grantedScopes ?? [])],
    ["instagram_business_basic", "instagram_business_manage_comments"],
    "and every named permission is carried, verbatim and in order",
  );

  /* (b) AN ARRAY OF STRINGS — the same statement written differently, and equally explicit. */
  const arrayForm = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: fake(() =>
      ok({ data: [{ access_token: SHORT, user_id: ACCOUNT, permissions: [INSTAGRAM_BUSINESS_BASIC_SCOPE] }] }),
    ),
  });
  assert.ok(arrayForm.ok, "an array statement is a grant too — a list is a list");
  assert.deepEqual([...(arrayForm.grant.grantedScopes ?? [])], [INSTAGRAM_BUSINESS_BASIC_SCOPE]);

  /*
   * (c) ABSENT, and (d) EXPLICITLY NULL. NOT refused, and NOT read as a grant: the exchange carries
   * `null` forward and decides nothing. The verifier settles coverage with a real read — asserted
   * in the ceremony firewall, which pins that a connection is recorded only after one.
   */
  for (const [label, body] of [
    ["absent", { access_token: SHORT, user_id: ACCOUNT }],
    ["null", { access_token: SHORT, user_id: ACCOUNT, permissions: null }],
  ] as const) {
    const unstated = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
      fetchImpl: fake(() => ok({ data: [body] })),
    });
    assert.ok(unstated.ok, `a ${label} permissions field is not a refusal — nothing was claimed`);
    assert.equal(
      unstated.grant.grantedScopes,
      null,
      `and it states no scopes rather than inventing an empty grant (${label})`,
    );
  }

  /*
   * (e) EXPLICITLY INSUFFICIENT. Stated, and short of what this connection needs. The refusal is
   * UNCHANGED and belongs to the caller: the transport reports the grant truthfully and the
   * callback is what refuses. Asserted here on the arithmetic the callback uses.
   */
  const insufficient = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: fake(() =>
      ok({ data: [{ access_token: SHORT, user_id: ACCOUNT, permissions: "instagram_business_manage_comments" }] }),
    ),
  });
  assert.ok(insufficient.ok, "a stated-but-short grant is still a STATED grant");
  assert.ok(
    !coversRequiredScopes(insufficient.grant.grantedScopes ?? []),
    "and it does not cover the read — the callback refuses it as insufficient-scope",
  );

  /*
   * (f) PRESENT AND UNREADABLE. FAIL CLOSED. A number, an object, or an array with a non-string
   * member is a statement Hebun cannot check, and it is refused as malformed — never carried
   * forward as unstated, and never treated as sufficient.
   */
  for (const shape of [42, true, { a: 1 }, ["instagram_business_basic", 7], [{}]] as const) {
    const unreadable = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
      fetchImpl: fake(() => ok({ data: [{ access_token: SHORT, user_id: ACCOUNT, permissions: shape }] })),
    });
    assert.ok(
      !unreadable.ok && unreadable.failure === "malformed",
      `an unreadable permissions shape (${JSON.stringify(shape)}) is refused as malformed`,
    );
    assert.ok(
      !unreadable.ok && !unreadable.reason.includes(SHORT),
      "and its reason carries no token",
    );
  }

  const noAccount = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: fake(() => ok({ data: [{ access_token: SHORT, permissions: "instagram_business_basic" }] })),
  });
  assert.ok(!noAccount.ok && noAccount.failure === "malformed", "a grant with no account is malformed");

  const noToken = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: fake(() => ok({ data: [{ user_id: ACCOUNT, permissions: "instagram_business_basic" }] })),
  });
  assert.ok(!noToken.ok && noToken.failure === "malformed", "and so is one with no token");

  const garbage = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: async () => new Response("<html>not json</html>", { status: 200 }),
  });
  assert.ok(!garbage.ok && garbage.failure === "malformed", "an unparseable body is malformed");

  for (const [status, code, expected] of [
    [400, 190, "auth"],
    [400, null, "auth"],
    [403, 10, "scope"],
    [429, null, "rate-limited"],
    [500, null, "transport"],
  ] as const) {
    const refused = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
      fetchImpl: fake(() => err(status, code)),
    });
    assert.ok(
      !refused.ok && refused.failure === expected,
      `HTTP ${status} / code ${code} classifies as \`${expected}\``,
    );
    assert.ok(
      !refused.ok && !refused.reason.includes(CODE) && !refused.reason.includes(CONFIG.clientSecret),
      "and the classified reason carries no code and no secret",
    );
  }

  const unreachable = await exchangeAuthorizationCode({ code: CODE }, CONFIG, {
    fetchImpl: async () => {
      throw new Error("socket hang up");
    },
  });
  assert.ok(
    !unreachable.ok && unreachable.failure === "transport",
    "a transport fault says nothing is known about the credential",
  );

  /* ═══ 4. THE LONG-LIVED EXCHANGE ═══════════════════════════════════════════ */
  const at = new Date("2026-09-09T10:00:00.000Z");
  const longLog: Seen[] = [];
  const longLived = await exchangeForLongLivedToken(SHORT, CONFIG, {
    now: () => at,
    fetchImpl: fake(
      () => ok({ access_token: LONG, token_type: "bearer", expires_in: 5_184_000 }),
      longLog,
    ),
  });
  assert.ok(longLived.ok, "the documented long-lived response produces a grant");
  assert.equal(longLived.grant.accessToken, LONG);
  assert.equal(
    longLived.grant.expiresAt?.toISOString(),
    new Date(at.getTime() + 5_184_000 * 1000).toISOString(),
    "the expiry is COMPUTED from Meta's own expires_in against Hebun's clock — about sixty days",
  );
  assert.equal(longLived.grant.accountId, null, "this exchange answers about a token, not an account");
  assert.equal(longLived.grant.grantedScopes, null, "and it restates no permissions");

  assert.equal(longLog[0]!.method, "GET", "Meta documents this one as a GET");
  assert.ok(
    longLog[0]!.url.startsWith(INSTAGRAM_LONG_LIVED_TOKEN_ENDPOINT),
    "aimed at graph.instagram.com",
  );
  assert.ok(
    new URL(longLog[0]!.url).searchParams.get("grant_type") === "ig_exchange_token",
    "with Meta's own grant type",
  );

  /* A response with no `expires_in` yields NO expiry rather than a guessed one. */
  const noExpiry = await exchangeForLongLivedToken(SHORT, CONFIG, {
    now: () => at,
    fetchImpl: fake(() => ok({ access_token: LONG, token_type: "bearer" })),
  });
  assert.ok(noExpiry.ok && noExpiry.grant.expiresAt === null, "an unstated lifetime is not invented");

  const longRefused = await exchangeForLongLivedToken(SHORT, CONFIG, {
    fetchImpl: fake(() => err(400, 190)),
  });
  assert.ok(!longRefused.ok && longRefused.failure === "auth", "a rejected long-lived exchange is auth");
  assert.ok(
    !longRefused.ok && !longRefused.reason.includes(SHORT),
    "and its reason carries no token",
  );

  /* ═══ 5. THE SCOPE ARITHMETIC ══════════════════════════════════════════════ */
  /*
   * THREE ANSWERS, NEVER TWO. `unstated` (the provider said nothing), `stated` (it said something,
   * which may be empty or short), and `unreadable` (it said something with no honest reading). The
   * bug this replaces folded the first and third together and reported both as an insufficient
   * scope, which is a claim about the TENANT'S GRANT that Hebun had no evidence for.
   */
  assert.deepEqual(
    parseGrantedPermissions("a, b ,c"),
    { kind: "stated", scopes: ["a", "b", "c"] },
    "a comma-separated statement is trimmed, split and kept",
  );
  assert.deepEqual(
    parseGrantedPermissions([" a ", "b"]),
    { kind: "stated", scopes: ["a", "b"] },
    "an array statement is trimmed and kept",
  );
  assert.deepEqual(parseGrantedPermissions(undefined), { kind: "unstated" }, "absent is UNSTATED");
  assert.deepEqual(parseGrantedPermissions(null), { kind: "unstated" }, "null is UNSTATED");
  for (const bad of [42, true, { a: 1 }, ["ok", 7], [null]]) {
    assert.deepEqual(
      parseGrantedPermissions(bad),
      { kind: "unreadable" },
      `${JSON.stringify(bad)} is present and UNREADABLE — never unstated, never sufficient`,
    );
  }
  /* AN EMPTY STATEMENT IS STILL A STATEMENT, and it covers nothing. */
  const emptyStatement = parseGrantedPermissions("");
  assert.equal(emptyStatement.kind, "stated", "an empty string is a STATED grant of nothing");
  assert.ok(
    emptyStatement.kind === "stated" && !coversRequiredScopes(emptyStatement.scopes),
    "which the callback refuses as insufficient-scope",
  );
  assert.ok(coversRequiredScopes([INSTAGRAM_BUSINESS_BASIC_SCOPE]), "the one scope covers the read");
  assert.ok(!coversRequiredScopes([]), "an empty grant covers nothing");
  assert.ok(
    !coversRequiredScopes(["instagram_business_content_publish"]),
    "and a WIDER grant that omits the required scope still does not cover it",
  );

  console.log(
    "instagram-oauth-admission/token-exchange: one scope asked, data[] read, grant stated/unstated/" +
      "unreadable kept apart, long-lived expiry computed not guessed, no secret in any reason",
  );
}

void main();
