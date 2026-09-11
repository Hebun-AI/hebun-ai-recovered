/*
 * INSTAGRAM · the OAuth ceremony's structural rules.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * WHAT THIS FILE REFUSES TO LET HAPPEN:
 *
 *   1. A TENANT FROM THE CLIENT. Identity comes from the authenticated session, never a parameter.
 *   2. AN UNORDERED CALLBACK. State is verified BEFORE the code is exchanged, every time.
 *   3. A SECOND AUTHORITY. The ceremony reuses connection and credential authority and mints none.
 *   4. AN AUTHORIZATION. No Governance decision, no standing observation, no observation run.
 *   5. A LEAK. No console, no secret in a URL a browser sees, no token in an outcome.
 *   6. A NEW CREDENTIAL KIND OR A MIGRATION.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { INTEGRATION_CREDENTIAL_KINDS } from "../../src/features/integration-credentials/contracts";
import {
  INSTAGRAM_PROVIDER_KEY,
  INSTAGRAM_REQUESTED_SCOPES,
  INSTAGRAM_BUSINESS_BASIC_SCOPE,
} from "../../src/features/provider-instagram/contracts";
import { INSTAGRAM_OAUTH_ENV_KEYS } from "../../src/features/provider-instagram/instagram-environment.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const START = "src/app/api/integrations/instagram/start/route.ts";
const CALLBACK = "src/app/api/integrations/instagram/callback/route.ts";
const ENVIRONMENT = "src/features/provider-instagram/instagram-environment.server.ts";
const STATE = "src/features/provider-instagram/instagram-oauth-state.server.ts";
const OAUTH_TRANSPORT = "src/features/provider-instagram/instagram-oauth-transport.server.ts";
const SURFACE = "src/features/instagram-connection-surface/model.ts";
const PAGE = "src/app/(dashboard)/integrations/instagram/page.tsx";

const CEREMONY = [START, CALLBACK, ENVIRONMENT, STATE, OAUTH_TRANSPORT];

function main(): void {
  for (const f of CEREMONY.concat([SURFACE, PAGE])) {
    assert.ok(existsSync(path.join(ROOT, f)), `${f} exists`);
  }
  const start = codeOf(read(START));
  const callback = codeOf(read(CALLBACK));

  /* ═══ 1. THE TENANT IS NEVER TAKEN FROM THE REQUEST ════════════════════════ */
  for (const [f, code] of [[START, start], [CALLBACK, callback]] as const) {
    assert.ok(
      code.includes("resolveTenantContext()"),
      `${f} resolves the tenant from the authenticated session`,
    );
    for (const spoof of [
      'get("tenant")',
      'get("tenantId")',
      'get("organization")',
      'get("integrationId")',
      'get("redirect")',
      'get("scope")',
      'get("next")',
    ]) {
      assert.ok(!code.includes(spoof), `${f} never reads \`${spoof}\` from the request`);
    }
  }
  /*
   * THE START ROUTE READS NOTHING AT ALL. Google's equivalent accepts one capability name; this
   * provider has one capability, so there is nothing to name and no parameter to validate.
   */
  assert.ok(
    !start.includes("searchParams"),
    "the start route reads no query parameter whatsoever",
  );
  /* And the CONNECTION it authorizes comes from the signed state, not from the callback's URL. */
  assert.ok(
    callback.includes("verified.payload.integrationId"),
    "the callback takes the connection from the SIGNED state, never from a parameter",
  );

  /* ═══ 2. STATE IS VERIFIED BEFORE THE CODE IS SPENT ════════════════════════ */
  const stateAt = callback.indexOf("verifyInstagramOAuthState(");
  const exchangeAt = callback.indexOf("exchangeAuthorizationCode(");
  const longLivedAt = callback.indexOf("exchangeForLongLivedToken(");
  const storeAt = callback.indexOf("storeCredential(");
  const verifyAt = callback.indexOf("verifyInstagramConnection(");
  const recordAt = callback.indexOf("recordVerifiedConnectionWithin(");
  for (const [name, at] of [
    ["state verification", stateAt],
    ["code exchange", exchangeAt],
    ["long-lived exchange", longLivedAt],
    ["credential store", storeAt],
    ["connection verification", verifyAt],
    ["connected record", recordAt],
  ] as const) {
    assert.ok(at > 0, `the callback performs ${name}`);
  }
  assert.ok(stateAt < exchangeAt, "the state is verified BEFORE the authorization code is spent");
  assert.ok(exchangeAt < longLivedAt, "the code is spent before a long-lived token is asked for");
  assert.ok(longLivedAt < storeAt, "and only a long-lived token is ever stored");
  assert.ok(storeAt < verifyAt, "the credential is stored before it is proved");
  assert.ok(verifyAt < recordAt, "and a connection is only recorded after a REAL provider answer");

  /* ── ONE LABEL FOR EVERY STATE REFUSAL. No oracle. ────────────────────── */
  assert.equal(
    (callback.match(/outcome\("invalid-state"\)/g) ?? []).length,
    1,
    "every state refusal collapses to one outcome",
  );
  for (const reason of ["bad-signature", "nonce-mismatch", "session-mismatch", "tenant-mismatch", "expired"]) {
    assert.ok(!callback.includes(reason), `the callback never discloses \`${reason}\``);
  }
  /* ── THE COOKIE IS DESTROYED ON EVERY EXIT ────────────────────────────── */
  assert.ok(
    /cookies\.delete\(\s*INSTAGRAM_OAUTH_STATE_COOKIE/.test(callback),
    "the state cookie is deleted inside the single function every exit path goes through",
  );

  /*
   * ═══ 2b. THE CALLBACK IS NOT A SECOND SCOPE AUTHORITY ═════════════════════
   *
   * It refuses a grant Instagram STATED and that falls short. It does NOT refuse a grant Instagram
   * never stated: inventing a scope verdict from an absent field is exactly the second authority
   * this repository refuses to grow. Coverage in that case is settled by the verifier, which reads
   * the account for real.
   *
   * A production ceremony was lost to the older shape, which treated an unread grant as an
   * insufficient one. These lines exist so that regression fails here rather than at Meta.
   */
  assert.ok(
    /statedScopes\s*!==\s*null\s*&&\s*!coversRequiredScopes\(/.test(callback),
    "the scope refusal fires ONLY when Instagram actually stated the grant",
  );
  assert.equal(
    (callback.match(/outcome\("insufficient-scope"\)/g) ?? []).length,
    1,
    "and there is exactly one such refusal, so no second path can refuse on a scope",
  );
  assert.ok(
    !/!\s*exchanged\.grant\.grantedScopes/.test(callback),
    "an absent grant is never treated as an empty one",
  );
  /*
   * AND WHATEVER THE GRANT SAID, THE VERIFIER STILL RUNS AND STILL GATES. There is no branch that
   * records a connection without one: `recordVerifiedConnectionWithin` is reached from exactly one
   * place, after the verifier answered, and the facts it writes are the VERIFIER'S — never the
   * token response's self-report.
   */
  assert.equal(
    (callback.match(/verifyInstagramConnection\(/g) ?? []).length,
    1,
    "the real read happens on exactly one path — it cannot be skipped",
  );
  assert.equal(
    (callback.match(/recordVerifiedConnectionWithin\(/g) ?? []).length,
    1,
    "and a connection is recorded from exactly one place",
  );
  assert.ok(
    /recordVerifiedConnectionWithin\(\s*tx,\s*tenant,\s*integrationId,\s*verification\.facts/.test(
      callback,
    ),
    "with the VERIFIER's facts — the grant Hebun proves, not the grant Meta reports",
  );
  assert.ok(
    callback.indexOf("if (!verification.ok)") > 0 &&
      callback.indexOf("if (!verification.ok)") < callback.indexOf("recordVerifiedConnectionWithin("),
    "a failed verification returns before anything is recorded — fail closed after an unstated grant",
  );
  /* The transport, not the route, is what refuses an unreadable statement. */
  assert.ok(
    codeOf(read(OAUTH_TRANSPORT)).includes('fail("malformed", "instagram-permissions-unreadable")'),
    "a present-but-unreadable grant is refused as malformed, never carried forward as unstated",
  );
  assert.ok(
    !codeOf(read(OAUTH_TRANSPORT)).includes('fail("scope", "instagram-grant-not-stated")'),
    "and an unstated grant is no longer misreported as an insufficient scope",
  );

  /*
   * ═══ 2c. THE CALLBACK IS NOT A SECOND IDENTITY AUTHORITY ══════════════════
   *
   * It hands the verifier NO account id. The only id it could hand over is the token response's
   * `user_id`, and that is exactly the value that addressed nothing in production — Meta's node
   * carries an app-scoped `id` that differs from it. Identity is established by the verifier from
   * the provider's own answer at `/me`, so there is no id for a route to be wrong about.
   */
  assert.ok(
    /verifyInstagramConnection\(\s*tenant,\s*integrationId,\s*\{/.test(callback),
    "the verifier is called with the tenant and the connection, and no account id",
  );
  assert.ok(
    !/verifyInstagramConnection\([^)]*accountId/.test(callback),
    "no account id is passed to the verifier — identity is not the route's to supply",
  );

  /*
   * ═══ 2d. `not-professional` IS A FACT ABOUT A TYPE, NOWHERE ELSE ══════════
   *
   * It may be produced ONLY by the verifier, and only from `classifyAccountType`. A production
   * ceremony once refused a real Business account with this label because a NODE error carried it;
   * the transport may no longer say it at all.
   */
  const verifier = "src/features/provider-instagram/verify-instagram-connection.server.ts";
  const observationTransport = "src/features/provider-instagram/instagram-transport.server.ts";
  assert.ok(
    codeOf(read(observationTransport)).includes('fail("not-found", "instagram-node-unavailable")'),
    "a node Instagram could not load is reported as a NODE fact",
  );
  assert.ok(
    !codeOf(read(observationTransport)).includes("not-professional"),
    "and the transport cannot claim an account is not professional — it never read its type",
  );
  assert.ok(
    codeOf(read(verifier)).includes("classifyAccountType("),
    "the verifier decides professional status from the account's OWN stated type",
  );
  assert.ok(
    codeOf(read(verifier)).includes('failure: "not-professional"'),
    "and it is the one place that may say so",
  );
  assert.ok(
    codeOf(read(verifier)).includes("readOwnAccount("),
    "the verifier reads `/me` — the node that cannot be given a wrong id",
  );
  assert.ok(
    !codeOf(read(verifier)).includes("readAccount("),
    "and it does not use the by-id read, whose subject a caller would have to supply",
  );

  /* ═══ 3. NO SECOND AUTHORITY IS MINTED ═════════════════════════════════════ */
  for (const [f, code] of [[START, start], [CALLBACK, callback]] as const) {
    for (const banned of ["drizzle-orm", "@/db/schema", ".insert(", "sealSecret", "decrypt"]) {
      assert.ok(!code.includes(banned), `${f} contains no \`${banned}\` — it owns no table and no key`);
    }
  }
  assert.ok(
    callback.includes("storeCredential") && callback.includes("replaceCredential"),
    "the callback admits credentials through the RELEASED credential authority",
  );
  assert.ok(
    start.includes("createConnection") && start.includes("listConnections"),
    "and connections through the released connection authority",
  );
  assert.ok(
    callback.includes("recordVerificationFailureWithin"),
    "a failed verification is recorded by the lifecycle OWNER, not by the route",
  );

  /* ── THE CREDENTIAL KIND IS THE RELEASED ONE, AND THE UNION DID NOT GROW ── */
  assert.ok(callback.includes('"oauth_access"'), "the credential kind is `oauth_access`");
  assert.deepEqual(
    [...INTEGRATION_CREDENTIAL_KINDS],
    ["oauth_access", "oauth_refresh", "api_key"],
    "and the credential vocabulary is unchanged — no fourth kind was invented",
  );
  /*
   * NO `oauth_refresh` ROW. Instagram issues no separate refresh credential: a long-lived token is
   * renewed by presenting itself. Writing one would describe a credential that does not exist.
   */
  assert.ok(
    !callback.includes("oauth_refresh"),
    "no refresh credential is written — Instagram issues none",
  );

  /* ═══ 4. A CEREMONY IS NOT AN AUTHORIZATION ════════════════════════════════ */
  for (const [f, code] of [[START, start], [CALLBACK, callback]] as const) {
    for (const banned of [
      "standing-observation-authority",
      "observation-trigger",
      "observe-once-under-authorization",
      "observe-authorized-subject",
      "governance",
      "ObservationPrincipal",
      "scan-due-observations",
      "read-account-observation",
    ]) {
      assert.ok(
        !code.includes(banned),
        `${f} does not reach \`${banned}\` — connecting is not being authorized to look`,
      );
    }
  }

  /* ═══ 5. NOTHING LEAKS ═════════════════════════════════════════════════════ */
  for (const f of CEREMONY.concat([SURFACE, PAGE])) {
    const code = codeOf(read(f));
    for (const leak of ["console.log", "console.error", "console.warn", "console.debug"]) {
      assert.ok(!code.includes(leak), `${f} never ${leak}s`);
    }
  }
  /* The surface and the page cannot even see the credential authority or the configuration. */
  for (const f of [SURFACE, PAGE]) {
    const code = codeOf(read(f));
    for (const banned of [
      "credential-repository",
      "resolveInstagramOAuthEnvironment",
      "clientSecret",
      "stateSecret",
      "accessToken",
    ]) {
      assert.ok(!code.includes(banned), `${f} cannot see \`${banned}\``);
    }
  }
  assert.ok(
    codeOf(read(PAGE)).includes("isInstagramOAuthConfigured"),
    "the page learns configuration as a BOOLEAN and nothing more",
  );
  /*
   * THE APP SECRET NEVER REACHES A URL A BROWSER SEES. The authorization URL is built in the
   * transport from the client id alone; the one place a secret is a query parameter is Meta's own
   * `ig_exchange_token` GET, which is server-to-server and confined to that function.
   */
  const transport = codeOf(read(OAUTH_TRANSPORT));
  const authorizationBuilder = transport.slice(
    transport.indexOf("export function buildInstagramAuthorizationUrl"),
    transport.indexOf("function classifyTokenFailure"),
  );
  assert.ok(authorizationBuilder.length > 0, "the authorization builder was located");
  assert.ok(
    !authorizationBuilder.includes("clientSecret"),
    "the URL a browser is sent to is built without the App secret",
  );
  assert.equal(
    (transport.match(/searchParams\.set\("client_secret"/g) ?? []).length,
    1,
    "the secret appears in exactly one URL — Meta's documented long-lived exchange",
  );

  /* ═══ 6. NO OPEN REDIRECT ══════════════════════════════════════════════════ */
  for (const [f, code] of [[START, start], [CALLBACK, callback]] as const) {
    const redirects = code.match(/new URL\(\s*`([^`]*)`/g) ?? [];
    assert.ok(redirects.length > 0, `${f} builds its redirect from a literal path`);
    for (const r of redirects) {
      assert.ok(
        r.includes("/integrations/instagram?outcome="),
        `${f} redirects only to its own outcome page`,
      );
    }
    assert.ok(
      code.includes("process.env.INSTAGRAM_OAUTH_REDIRECT_URI"),
      `${f} takes its origin from CONFIGURATION, never from a request header`,
    );
    for (const header of ["x-forwarded-host", "headers()", "request.headers", "nextUrl.origin"]) {
      assert.ok(!code.includes(header), `${f} builds no origin from \`${header}\``);
    }
  }

  /* ═══ 7. LEAST PRIVILEGE, END TO END ═══════════════════════════════════════ */
  assert.deepEqual(
    [...INSTAGRAM_REQUESTED_SCOPES],
    [INSTAGRAM_BUSINESS_BASIC_SCOPE],
    "the ceremony requests exactly one scope",
  );
  for (const f of CEREMONY) {
    const code = codeOf(read(f));
    for (const escalation of [
      "instagram_business_content_publish",
      "instagram_business_manage_comments",
      "instagram_business_manage_messages",
      "instagram_business_manage_insights",
      "pages_",
      "business_management",
      "graph.facebook.com",
    ]) {
      assert.ok(!code.includes(escalation), `${f} contains no \`${escalation}\``);
    }
  }
  assert.ok(start.includes(`INSTAGRAM_PROVIDER_KEY`), "the connection is created for this provider");
  assert.equal(INSTAGRAM_PROVIDER_KEY, "instagram", "and the provider is `instagram`, not `meta`");

  /* ═══ 8. THE CONFIG CONTRACT CARRIES NO CONFIGURATION ══════════════════════ */
  const environment = codeOf(read(ENVIRONMENT));
  for (const key of Object.values(INSTAGRAM_OAUTH_ENV_KEYS)) {
    assert.ok(environment.includes(`"${key}"`), `the contract names \`${key}\``);
  }
  /*
   * A CONTRACT IS NOT A CONFIGURATION. No default, no fallback, no generated secret — an
   * unconfigured deployment must refuse rather than improvise.
   */
  for (const improvisation of ["randomBytes", "?? \"http", "|| \"http", "process.env.NODE_ENV"]) {
    assert.ok(
      !environment.includes(improvisation),
      `the environment module never improvises with \`${improvisation}\``,
    );
  }

  /* ═══ 9. NO MIGRATION ══════════════════════════════════════════════════════ */
  const journal = JSON.parse(read("src/db/migrations/meta/_journal.json")) as {
    entries: readonly unknown[];
  };
  assert.equal(
    journal.entries.length,
    53,
    "the ceremony added no migration — the released schema already expresses everything it stores",
  );
  /*
   * ── WHICH MIGRATIONS MAY SAY "instagram", AS AN EXACT SET ────────────────
   *
   * Exactly one released migration does, and it is not this provider's: CGO-1 created the
   * `content_destination` enum, whose members are the places a DRAFT may be prepared for. That
   * word describes an editorial destination, not a connection, a credential or an observation —
   * the two subsystems share a noun and nothing else.
   *
   * Pinned as a SET rather than as an absence, so a new migration mentioning Instagram fails here
   * and has to be justified, while the released one is not misread as this provider's table.
   */
  const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) =>
    f.endsWith(".sql"),
  );
  const mentioning = migrations
    .filter((m) => read(`src/db/migrations/${m}`).toLowerCase().includes("instagram"))
    .sort();
  assert.deepEqual(
    mentioning,
    ["20260903093716_cgo1_content_draft_destination.sql"],
    "only CGO-1's content-destination enum names Instagram — this provider owns no table",
  );
  assert.ok(
    read(`src/db/migrations/${mentioning[0]!}`).includes(
      `CREATE TYPE "public"."content_destination"`,
    ),
    "and that is what it says — a draft destination, not a connection",
  );

  console.log(
    "instagram-oauth-admission/ceremony-firewall: tenant from session, state before exchange, " +
      "released authorities reused, no governance, no observation, no leak, no new kind, no migration",
  );
}

main();
