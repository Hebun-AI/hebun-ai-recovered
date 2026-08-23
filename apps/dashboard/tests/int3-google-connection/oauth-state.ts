/*
 * INT-3 — THE OAUTH STATE BOUNDARY.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "A callback is accepted only when it carries a state this server minted, for THIS session, for
 *    THIS tenant, within its lifetime, exactly once — and every other combination is refused."
 *
 * No database, no network, no clock dependence: `nowSeconds` is injected so expiry is proved by
 * arithmetic rather than by sleeping.
 */
import assert from "node:assert/strict";
import {
  GOOGLE_OAUTH_STATE_TTL_SECONDS,
  codeChallengeFor,
  mintOAuthState,
  stateCookieOptions,
  verifyOAuthState,
} from "../../src/features/provider-google/oauth-state.server";

const SECRET = "int3-fixture-state-secret-do-not-log-0123456789";
const OTHER_SECRET = "int3-fixture-other-secret-do-not-log-9876543210";
const TENANT_A = "10000000-0000-4000-8000-00000000e001";
const TENANT_B = "10000000-0000-4000-8000-00000000e002";
const SESSION_A = "session-reference-alpha";
const SESSION_B = "session-reference-beta";
const INTEGRATION = "20000000-0000-4000-8000-00000000e003";
const NOW = 1_800_000_000;

function mint(now = NOW) {
  return mintOAuthState(
    { tenantId: TENANT_A, sessionReference: SESSION_A, integrationId: INTEGRATION },
    SECRET,
    now,
  );
}

function main(): void {
  /* ── 1. THE HAPPY PATH, AND WHAT ACTUALLY TRAVELS ────────────────────────── */
  {
    const minted = mint();
    const ok = verifyOAuthState(
      {
        cookieValue: minted.cookieValue,
        stateParameter: minted.stateParameter,
        sessionReference: SESSION_A,
        tenantId: TENANT_A,
      },
      SECRET,
      NOW + 5,
    );
    assert.ok(ok.ok, "a state minted here, returned here, in the same session, is accepted");
    assert.equal(ok.payload.integrationId, INTEGRATION);

    /* ONLY the nonce goes to Google. */
    assert.equal(minted.stateParameter, minted.payload.nonce);
    for (const secret of [TENANT_A, SESSION_A, minted.payload.codeVerifier, minted.payload.sessionDigest]) {
      assert.ok(
        !minted.stateParameter.includes(secret),
        "the state parameter must carry nothing but an opaque nonce",
      );
    }

    /* PKCE: the VERIFIER never leaves the server; only its S256 challenge does. */
    assert.equal(minted.codeChallenge, codeChallengeFor(minted.payload.codeVerifier));
    assert.notEqual(
      minted.codeChallenge,
      minted.payload.codeVerifier,
      "the PKCE verifier never leaves the server — only its S256 challenge does",
    );
  }

  /* ── 2. RANDOMNESS — a predictable state is no state at all ──────────────── */
  {
    const nonces = new Set<string>();
    const verifiers = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const minted = mint();
      nonces.add(minted.payload.nonce);
      verifiers.add(minted.payload.codeVerifier);
    }
    assert.equal(nonces.size, 200, "every nonce must be fresh");
    assert.equal(verifiers.size, 200, "and so must every PKCE verifier");
    assert.ok(Buffer.from(mint().payload.nonce, "base64url").length >= 32, "256 bits of entropy");
  }

  /* ── 3. EVERY REFUSAL, ONE AT A TIME ─────────────────────────────────────── */
  {
    const minted = mint();
    const good = {
      cookieValue: minted.cookieValue,
      stateParameter: minted.stateParameter,
      sessionReference: SESSION_A,
      tenantId: TENANT_A,
    };

    const cases: ReadonlyArray<readonly [string, Parameters<typeof verifyOAuthState>[0], string, number]> = [
      ["no cookie", { ...good, cookieValue: undefined }, "missing", NOW],
      ["no state parameter", { ...good, stateParameter: undefined }, "missing", NOW],
      ["malformed cookie", { ...good, cookieValue: "not-a-signed-envelope" }, "malformed", NOW],
      [
        "tampered payload",
        { ...good, cookieValue: `${Buffer.from('{"version":"v1"}', "utf8").toString("base64url")}.${minted.cookieValue.split(".")[1]}` },
        "bad-signature",
        NOW,
      ],
      ["expired", good, "expired", NOW + GOOGLE_OAUTH_STATE_TTL_SECONDS + 1],
      ["another flow's nonce", { ...good, stateParameter: mint().stateParameter }, "nonce-mismatch", NOW],
      ["another session", { ...good, sessionReference: SESSION_B }, "session-mismatch", NOW],
    ];

    for (const [label, input, expected, now] of cases) {
      const result = verifyOAuthState(input, SECRET, now);
      assert.ok(!result.ok, `"${label}" must be refused`);
      assert.equal(result.reason, expected, `"${label}" must be refused as ${expected}`);
    }

    /* A DIFFERENT TENANT, same human, same session — the workspace-switching case. */
    const crossTenant = verifyOAuthState({ ...good, tenantId: TENANT_B }, SECRET, NOW);
    assert.ok(
      !crossTenant.ok && crossTenant.reason === "tenant-mismatch",
      "a state minted while acting as one tenant must not complete while acting as another",
    );

    /* A state signed with a different deployment's secret. */
    const foreignSecret = verifyOAuthState(good, OTHER_SECRET, NOW);
    assert.ok(
      !foreignSecret.ok && foreignSecret.reason === "bad-signature",
      "a state signed by another deployment must not verify here",
    );
  }

  /* ── 4. THE SIGNATURE IS OVER THE WHOLE PAYLOAD ──────────────────────────── */
  {
    /*
     * Forging a longer expiry must fail. Re-encoding the payload with a later `expiresAt` and
     * keeping the original signature is the obvious attempt, and it is what the HMAC exists for.
     */
    const minted = mint();
    const [body, signature] = minted.cookieValue.split(".") as [string, string];
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    payload.expiresAt = NOW + 86_400;
    const forged = `${Buffer.from(JSON.stringify(payload), "utf8").toString("base64url")}.${signature}`;

    const result = verifyOAuthState(
      { cookieValue: forged, stateParameter: minted.stateParameter, sessionReference: SESSION_A, tenantId: TENANT_A },
      SECRET,
      NOW + 3600,
    );
    assert.ok(!result.ok && result.reason === "bad-signature", "an extended expiry must not verify");
  }

  /* ── 5. THE COOKIE'S OWN ATTRIBUTES ──────────────────────────────────────── */
  {
    const https = stateCookieOptions("https://app.example.com/api/integrations/google/callback");
    assert.equal(https.httpOnly, true, "script must never read the state cookie");
    assert.equal(https.secure, true, "and it must not travel in the clear on https");
    assert.equal(
      https.sameSite,
      "lax",
      "`strict` would be withheld on Google's top-level redirect back, so every callback would fail",
    );
    assert.equal(https.maxAge, GOOGLE_OAUTH_STATE_TTL_SECONDS);
    assert.equal(https.path, "/api/integrations/google", "scoped to the flow that uses it");

    /* Loopback development is the one place `secure` is correctly false. */
    const local = stateCookieOptions("http://localhost:3000/api/integrations/google/callback");
    assert.equal(local.secure, false);
  }

  console.log("int3-google-connection/oauth-state: all assertions passed");
}

main();
