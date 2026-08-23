/*
 * INT-3 — THE GOOGLE TRANSPORT, AGAINST A MOCKED GOOGLE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Every way Google can answer is classified into the class that is TRUE about the tenant's
 *    grant — and in particular a provider outage is never classified as a credential problem."
 *
 * The production transport is real; `fetchImpl` is injected here so the classification table can be
 * exercised exhaustively without depending on Google having a bad day on cue.
 */
import assert from "node:assert/strict";
import {
  exchangeAuthorizationCode,
  fetchGoogleIdentity,
  refreshAccessToken,
} from "../../src/features/provider-google/google-transport.server";
import {
  GOOGLE_TOKEN_ENDPOINT,
  GOOGLE_USERINFO_ENDPOINT,
  coversRequiredScopes,
} from "../../src/features/provider-google/contracts";
import type { ConfiguredGoogleOAuth } from "../../src/features/provider-google/google-environment.server";

const CONFIG: ConfiguredGoogleOAuth = Object.freeze({
  status: "configured",
  clientId: "int3-fixture-client-id.apps.googleusercontent.com",
  clientSecret: "int3-fixture-client-secret-DO-NOT-LOG",
  redirectUri: "http://localhost:3000/api/integrations/google/callback",
  stateSecret: "int3-fixture-state-secret-0123456789abcdef",
});

const NOW = new Date("2026-08-23T10:00:00.000Z");
const GRANTED = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ");

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Records what was sent, so the request itself can be asserted rather than assumed. */
function recorder(response: () => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  return {
    calls,
    fetchImpl: async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return response();
    },
  };
}

async function main(): Promise<void> {
  /* ── 1. A SUCCESSFUL EXCHANGE, AND WHAT IT ACTUALLY SENDS ────────────────── */
  {
    const rec = recorder(() =>
      jsonResponse(200, {
        access_token: "fixture-access-token",
        refresh_token: "fixture-refresh-token",
        expires_in: 3599,
        scope: GRANTED,
        id_token: "fixture-id-token",
        token_type: "Bearer",
      }),
    );
    const result = await exchangeAuthorizationCode(
      { code: "fixture-code", codeVerifier: "fixture-verifier" },
      CONFIG,
      { fetchImpl: rec.fetchImpl, now: () => NOW },
    );
    assert.ok(result.ok);
    assert.equal(result.grant.accessToken, "fixture-access-token");
    assert.equal(result.grant.refreshToken, "fixture-refresh-token");
    assert.equal(result.grant.expiresAt?.toISOString(), new Date(NOW.getTime() + 3599_000).toISOString());
    assert.ok(coversRequiredScopes(result.grant.grantedScopes), "the granted set covers identity");

    assert.equal(rec.calls.length, 1, "one exchange, one call");
    assert.equal(rec.calls[0]!.url, GOOGLE_TOKEN_ENDPOINT, "and it goes to Google's token endpoint");
    const body = String(rec.calls[0]!.init?.body ?? "");
    /* PKCE and the CONFIGURED redirect URI both travel; neither is optional. */
    assert.match(body, /code_verifier=fixture-verifier/);
    assert.match(body, /redirect_uri=http%3A%2F%2Flocalhost%3A3000/);
    assert.match(body, /grant_type=authorization_code/);
  }

  /* ── 2. AN ABSENT REFRESH TOKEN IS NORMAL, NOT A FAILURE ─────────────────── */
  {
    const rec = recorder(() =>
      jsonResponse(200, { access_token: "second-access-token", expires_in: 3599, scope: GRANTED }),
    );
    const result = await exchangeAuthorizationCode(
      { code: "c", codeVerifier: "v" },
      CONFIG,
      { fetchImpl: rec.fetchImpl, now: () => NOW },
    );
    assert.ok(result.ok, "Google omitting a refresh token is an ordinary re-authorization");
    assert.equal(
      result.grant.refreshToken,
      null,
      "and it is reported as ABSENT — never as an empty string a caller might store",
    );
  }

  /* ── 3. THE CLASSIFICATION TABLE — the heart of this file ────────────────── */
  {
    const cases: ReadonlyArray<readonly [string, number, unknown, string]> = [
      ["401", 401, { error: "invalid_token" }, "auth"],
      ["400 invalid_grant", 400, { error: "invalid_grant" }, "auth"],
      ["403 insufficient scope", 403, { error: "insufficient_scope" }, "scope"],
      ["429 rate limited", 429, { error: "rateLimitExceeded" }, "transport"],
      ["500", 500, { error: "backendError" }, "transport"],
      ["503", 503, {}, "transport"],
      ["200 with no access token", 200, { token_type: "Bearer" }, "malformed"],
    ];

    for (const [label, status, body, expected] of cases) {
      const rec = recorder(() => jsonResponse(status, body));
      const result = await refreshAccessToken("fixture-refresh", CONFIG, {
        fetchImpl: rec.fetchImpl,
        now: () => NOW,
      });
      assert.ok(!result.ok, `"${label}" must not succeed`);
      assert.equal(result.failure, expected, `"${label}" must classify as ${expected}`);
    }

    /*
     * THE LINE THAT MATTERS MOST. A 5xx and a 429 say NOTHING about the tenant's grant, and
     * classifying either as `auth` would end a connection because Google had a bad minute.
     */
    for (const status of [429, 500, 502, 503, 504]) {
      const rec = recorder(() => jsonResponse(status, {}));
      const result = await fetchGoogleIdentity("fixture-access", { fetchImpl: rec.fetchImpl });
      assert.ok(!result.ok && result.failure === "transport", `${status} is transport, never auth`);
    }
  }

  /* ── 4. A NETWORK THAT NEVER ANSWERED IS ALSO TRANSPORT ──────────────────── */
  {
    const result = await fetchGoogleIdentity("fixture-access", {
      fetchImpl: async () => {
        throw new Error("ENOTFOUND accounts.google.com");
      },
    });
    assert.ok(!result.ok && result.failure === "transport" && result.reason === "google-unreachable");
    /* And the thrown error's text never becomes the reason a tenant is shown. */
    assert.ok(!result.reason.includes("ENOTFOUND"));
  }

  /* ── 5. IDENTITY: `sub` IS REQUIRED, `hd` IS OPTIONAL ────────────────────── */
  {
    const workspace = recorder(() =>
      jsonResponse(200, {
        sub: "1234567890",
        email: "person@example-workspace.com",
        email_verified: true,
        hd: "example-workspace.com",
      }),
    );
    const ws = await fetchGoogleIdentity("t", { fetchImpl: workspace.fetchImpl });
    assert.ok(ws.ok);
    assert.equal(ws.identity.subject, "1234567890", "`sub` is the identity");
    assert.equal(ws.identity.hostedDomain, "example-workspace.com", "`hd` is a domain observation");
    assert.equal(workspace.calls[0]!.url, GOOGLE_USERINFO_ENDPOINT);
    const auth = (workspace.calls[0]!.init?.headers as Record<string, string>).authorization;
    assert.equal(auth, "Bearer t", "the token travels in the header, never in the URL");

    /* A CONSUMER ACCOUNT. No `hd`, and that is a fact rather than a failure. */
    const consumer = recorder(() =>
      jsonResponse(200, { sub: "999", email: "person@gmail.com", email_verified: true }),
    );
    const personal = await fetchGoogleIdentity("t", { fetchImpl: consumer.fetchImpl });
    assert.ok(personal.ok);
    assert.equal(
      personal.identity.hostedDomain,
      null,
      "a consumer account has no hosted domain, and none is invented",
    );

    /* NO `sub` — there is nothing a connection could be bound to. */
    const anonymous = recorder(() => jsonResponse(200, { email: "person@example.com" }));
    const missing = await fetchGoogleIdentity("t", { fetchImpl: anonymous.fetchImpl });
    assert.ok(!missing.ok && missing.failure === "identity");
  }

  /* ── 6. NO SECRET APPEARS IN ANY RETURNED VALUE ──────────────────────────── */
  {
    const rec = recorder(() =>
      jsonResponse(400, {
        error: "invalid_grant",
        /* Google error bodies really do echo request parameters. */
        error_description: "Bad Request: code=fixture-code client_secret=int3-fixture-client-secret-DO-NOT-LOG",
      }),
    );
    const result = await exchangeAuthorizationCode({ code: "fixture-code", codeVerifier: "v" }, CONFIG, {
      fetchImpl: rec.fetchImpl,
    });
    assert.ok(!result.ok);
    const serialized = JSON.stringify(result);
    for (const secret of [CONFIG.clientSecret, "fixture-code", "error_description"]) {
      assert.ok(
        !serialized.includes(secret),
        `a classified failure must not echo Google's payload — found "${secret}"`,
      );
    }
  }

  console.log("int3-google-connection/google-transport: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
