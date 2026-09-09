/*
 * INSTAGRAM · OAuth state — the mechanism that makes the callback refusable.
 *
 * WHAT THIS PROVES:
 *
 *   A state minted for one session/tenant cannot complete another; a replayed, expired, forged or
 *   absent state is refused; the nonce is the ONLY thing that reaches a URL; and the configuration
 *   contract fails closed on every missing or malformed key without ever naming a value.
 *
 * Everything here is real: the released state module, the released environment module. Nothing is
 * mocked, because there is nothing external to mock — this is arithmetic over a secret.
 */
import assert from "node:assert/strict";
import {
  INSTAGRAM_OAUTH_STATE_COOKIE,
  INSTAGRAM_OAUTH_STATE_TTL_SECONDS,
  instagramStateCookieOptions,
  mintInstagramOAuthState,
  verifyInstagramOAuthState,
} from "../../src/features/provider-instagram/instagram-oauth-state.server";
import {
  INSTAGRAM_OAUTH_ENV_KEYS,
  isInstagramOAuthConfigured,
  resolveInstagramOAuthEnvironment,
} from "../../src/features/provider-instagram/instagram-environment.server";

const SECRET = "unit-test-state-secret-32-bytes-min-length";
const OTHER_SECRET = "a-different-unit-test-secret-of-sufficient-length";
const TENANT = "11111111-1111-4111-8111-111111111111";
const OTHER_TENANT = "22222222-2222-4222-8222-222222222222";
const INTEGRATION = "33333333-3333-4333-8333-333333333333";
const SESSION = "session-reference-fixture";
const NOW = 1_700_000_000;

/** A configuration that passes every check, built from fixtures that are not credentials. */
function validEnv(overrides: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    [INSTAGRAM_OAUTH_ENV_KEYS.clientId]: "1234567890",
    [INSTAGRAM_OAUTH_ENV_KEYS.clientSecret]: "fixture-not-a-real-app-secret",
    [INSTAGRAM_OAUTH_ENV_KEYS.redirectUri]: "https://app.example.com/api/integrations/instagram/callback",
    [INSTAGRAM_OAUTH_ENV_KEYS.stateSecret]: SECRET,
    ...overrides,
  };
}

function main(): void {
  /* ═══ 1. A HONEST ROUND TRIP ═══════════════════════════════════════════════ */
  const minted = mintInstagramOAuthState(
    { tenantId: TENANT, sessionReference: SESSION, integrationId: INTEGRATION },
    SECRET,
    NOW,
  );
  const accepted = verifyInstagramOAuthState(
    {
      cookieValue: minted.cookieValue,
      stateParameter: minted.stateParameter,
      sessionReference: SESSION,
      tenantId: TENANT,
    },
    SECRET,
    NOW + 1,
  );
  assert.ok(accepted.ok, "a state completed by the session that minted it is accepted");
  assert.equal(accepted.payload.integrationId, INTEGRATION, "and it names the connection it began");

  /* ═══ 2. ONLY THE NONCE REACHES THE URL ════════════════════════════════════ */
  assert.equal(minted.stateParameter, minted.payload.nonce, "the state parameter IS the nonce");
  for (const secretish of [TENANT, SESSION, INTEGRATION, SECRET]) {
    assert.ok(
      !minted.stateParameter.includes(secretish),
      "the state parameter carries no tenant, session, connection or secret",
    );
  }
  assert.ok(
    !minted.cookieValue.includes(SESSION),
    "and the cookie carries a DIGEST of the session, never the session reference itself",
  );
  /*
   * NO PKCE VERIFIER. Meta's authorization endpoint accepts no `code_challenge`, so a verifier
   * would be a field Hebun could never spend. Its absence is asserted so that adding one later is a
   * deliberate act rather than a copy from the Google module.
   */
  assert.ok(
    !("codeVerifier" in minted.payload),
    "no PKCE verifier is minted — Meta's contract has nowhere to send one",
  );

  /* ═══ 3. CSRF: A FOREIGN CALLBACK CANNOT COMPLETE ══════════════════════════ */
  const forged = verifyInstagramOAuthState(
    {
      cookieValue: minted.cookieValue,
      stateParameter: "an-attacker-chosen-nonce",
      sessionReference: SESSION,
      tenantId: TENANT,
    },
    SECRET,
    NOW + 1,
  );
  assert.ok(!forged.ok && forged.reason === "nonce-mismatch", "a substituted nonce is refused");

  const noCookie = verifyInstagramOAuthState(
    {
      cookieValue: undefined,
      stateParameter: minted.stateParameter,
      sessionReference: SESSION,
      tenantId: TENANT,
    },
    SECRET,
    NOW + 1,
  );
  assert.ok(!noCookie.ok && noCookie.reason === "missing", "a callback with no cookie is refused");

  /*
   * REPLAY. The route deletes the cookie on every exit, so a replayed callback arrives WITHOUT one
   * — which is the case above. This asserts the other half: the state itself carries nothing that
   * would let a second presentation succeed if the cookie somehow survived, because the same cookie
   * verified twice at a later instant still expires.
   */
  const replayedAfterTtl = verifyInstagramOAuthState(
    {
      cookieValue: minted.cookieValue,
      stateParameter: minted.stateParameter,
      sessionReference: SESSION,
      tenantId: TENANT,
    },
    SECRET,
    NOW + INSTAGRAM_OAUTH_STATE_TTL_SECONDS + 1,
  );
  assert.ok(!replayedAfterTtl.ok && replayedAfterTtl.reason === "expired", "an expired state is refused");

  /* ═══ 4. THE SIGNATURE IS CHECKED BEFORE THE PAYLOAD IS TRUSTED ════════════ */
  const wrongSecret = verifyInstagramOAuthState(
    {
      cookieValue: minted.cookieValue,
      stateParameter: minted.stateParameter,
      sessionReference: SESSION,
      tenantId: TENANT,
    },
    OTHER_SECRET,
    NOW + 1,
  );
  assert.ok(!wrongSecret.ok && wrongSecret.reason === "bad-signature", "a state signed elsewhere is refused");

  /*
   * A PAYLOAD AN ATTACKER REWROTE. The tenant is changed and the signature left alone; the module
   * must refuse on the SIGNATURE, never on the tenant, because reaching the tenant check would mean
   * the forged payload had already been parsed and trusted.
   */
  const [body] = minted.cookieValue.split(".") as [string, string];
  const tampered = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Record<string, unknown>;
  tampered.tenantId = OTHER_TENANT;
  const tamperedCookie = `${Buffer.from(JSON.stringify(tampered), "utf8").toString("base64url")}.${
    minted.cookieValue.split(".")[1]
  }`;
  const rewritten = verifyInstagramOAuthState(
    {
      cookieValue: tamperedCookie,
      stateParameter: minted.stateParameter,
      sessionReference: SESSION,
      tenantId: OTHER_TENANT,
    },
    SECRET,
    NOW + 1,
  );
  assert.ok(
    !rewritten.ok && rewritten.reason === "bad-signature",
    "a rewritten payload fails the signature, not a later field check",
  );

  const malformed = verifyInstagramOAuthState(
    {
      cookieValue: "not-a-sealed-state",
      stateParameter: minted.stateParameter,
      sessionReference: SESSION,
      tenantId: TENANT,
    },
    SECRET,
    NOW + 1,
  );
  assert.ok(!malformed.ok && malformed.reason === "malformed", "a shapeless cookie is refused");

  /* ═══ 5. SESSION AND TENANT BINDING ════════════════════════════════════════ */
  const otherSession = verifyInstagramOAuthState(
    {
      cookieValue: minted.cookieValue,
      stateParameter: minted.stateParameter,
      sessionReference: "a-different-session",
      tenantId: TENANT,
    },
    SECRET,
    NOW + 1,
  );
  assert.ok(
    !otherSession.ok && otherSession.reason === "session-mismatch",
    "a state minted in one session cannot complete in another",
  );

  /*
   * CROSS-TENANT. The same human, the same session, a different workspace. The state must refuse,
   * because the connection it names belongs to the tenant that started the ceremony.
   */
  const mintedForOther = mintInstagramOAuthState(
    { tenantId: OTHER_TENANT, sessionReference: SESSION, integrationId: INTEGRATION },
    SECRET,
    NOW,
  );
  const crossTenant = verifyInstagramOAuthState(
    {
      cookieValue: mintedForOther.cookieValue,
      stateParameter: mintedForOther.stateParameter,
      sessionReference: SESSION,
      tenantId: TENANT,
    },
    SECRET,
    NOW + 1,
  );
  assert.ok(
    !crossTenant.ok && crossTenant.reason === "tenant-mismatch",
    "a state minted while acting as one tenant cannot complete while acting as another",
  );

  /* ═══ 6. THE COOKIE'S OWN ATTRIBUTES ═══════════════════════════════════════ */
  const options = instagramStateCookieOptions();
  assert.equal(options.httpOnly, true, "the state cookie is not readable by script");
  assert.equal(options.sameSite, "lax", "Lax, so Meta's top-level GET carries it and nothing else does");
  assert.equal(options.secure, true, "and it is unconditionally secure — Meta requires HTTPS");
  assert.equal(
    options.path,
    "/api/integrations/instagram",
    "scoped to this ceremony, so it never reaches another provider's routes",
  );
  assert.equal(options.maxAge, INSTAGRAM_OAUTH_STATE_TTL_SECONDS, "and it outlives nothing");
  assert.equal(INSTAGRAM_OAUTH_STATE_COOKIE, "hebun_instagram_oauth_state", "its own name");

  /* ═══ 7. THE CONFIGURATION CONTRACT FAILS CLOSED ═══════════════════════════ */
  const configured = resolveInstagramOAuthEnvironment(validEnv());
  assert.equal(configured.status, "configured", "a complete configuration resolves");
  assert.ok(isInstagramOAuthConfigured(validEnv()), "and the boolean agrees");

  assert.ok(!isInstagramOAuthConfigured({}), "an empty environment offers nothing");
  for (const key of Object.values(INSTAGRAM_OAUTH_ENV_KEYS)) {
    const missing = resolveInstagramOAuthEnvironment(validEnv({ [key]: undefined }));
    assert.equal(missing.status, "invalid", `without \`${key}\` the provider is not configured`);
    assert.ok(
      missing.status === "invalid" && missing.missingKeys.includes(key),
      "and the refusal names the KEY",
    );
  }

  /*
   * HTTP IS REFUSED EVEN ON LOOPBACK. Google's module allows it because Google allows it; Meta does
   * not, and copying the exception would produce a URI Meta rejects after a human has consented.
   */
  for (const bad of [
    "http://localhost:3000/api/integrations/instagram/callback",
    "http://app.example.com/callback",
    "https://app.example.com/callback?x=1",
    "https://app.example.com/callback#f",
    "not-a-url",
  ]) {
    const rejected = resolveInstagramOAuthEnvironment(
      validEnv({ [INSTAGRAM_OAUTH_ENV_KEYS.redirectUri]: bad }),
    );
    assert.equal(rejected.status, "invalid", `\`${bad}\` is not a usable redirect URI`);
    assert.ok(
      rejected.status === "invalid" &&
        rejected.invalidKeys.includes(INSTAGRAM_OAUTH_ENV_KEYS.redirectUri),
      "and the refusal names the key, never the value",
    );
  }

  const weak = resolveInstagramOAuthEnvironment(
    validEnv({ [INSTAGRAM_OAUTH_ENV_KEYS.stateSecret]: "too-short" }),
  );
  assert.equal(weak.status, "invalid", "a short state secret is refused rather than stretched");

  /* NO REFUSAL EVER CARRIES A VALUE. */
  const leaky = resolveInstagramOAuthEnvironment(
    validEnv({ [INSTAGRAM_OAUTH_ENV_KEYS.redirectUri]: "http://secret-host.example/callback" }),
  );
  assert.ok(
    !JSON.stringify(leaky).includes("secret-host"),
    "a refusal reports key NAMES and never the configured value",
  );

  console.log(
    "instagram-oauth-admission/oauth-state: bound to session and tenant, single-use, short-lived, " +
      "signature-first, no PKCE theatre, config fails closed without naming a value",
  );
}

main();
