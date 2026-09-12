/*
 * INSTAGRAM ACCOUNT LIFECYCLE — the boundaries, proved from source.
 *
 * Two controls were added to a released OAuth surface: "connect a different account", and
 * "disconnect". Both are consequential, both sit on a multi-tenant page, and one of them ends a
 * grant. This file proves what they are INCAPABLE of doing.
 *
 * The property that matters most here is not new: two tenants in this deployment hold connections
 * to the SAME external Instagram account. Anything keyed on the provider's account id rather than
 * on the tenant would let one customer's disconnect end another customer's connection.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
/** Source with comments stripped. A rule about CODE must not be broken by prose that denies it. */
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return collect(p);
    return entry.isFile() && /\.tsx?$/.test(entry.name) ? [p.replace(/\\/g, "/")] : [];
  });
}

const TRANSPORT = "src/features/provider-instagram/instagram-oauth-transport.server.ts";
const START = "src/app/api/integrations/instagram/start/route.ts";
const CALLBACK = "src/app/api/integrations/instagram/callback/route.ts";
const ACTION = "src/app/(dashboard)/integrations/instagram/actions.ts";
const PAGE = "src/app/(dashboard)/integrations/instagram/page.tsx";
const MODEL = "src/features/instagram-connection-surface/model.ts";
/*
 * WHERE THE COMPOSITION ACTUALLY LIVES. An earlier version of this surface did it inline in the
 * server action and imported the credential authority from `src/app`; a released INT-2 firewall
 * refused that, and the composition moved here rather than the boundary moving for it.
 */
const LIFECYCLE = "src/features/provider-connection-lifecycle/disconnect-connection.server.ts";

const TRANSPORT_CODE = codeOf(read(TRANSPORT));
const START_CODE = codeOf(read(START));
const ACTION_CODE = codeOf(read(ACTION));
const PAGE_CODE = codeOf(read(PAGE));
const LIFECYCLE_CODE = codeOf(read(LIFECYCLE));

/* ── 1 · the authorization URL gains one field, and only when asked ─────────── */

function forceReauthIsOptOutByDefault(): void {
  assert.match(
    TRANSPORT_CODE,
    /if \(options\.forceReauth === true\) url\.searchParams\.set\("force_reauth", "true"\)/,
    "`force_reauth` is set only on an explicit true — never defaulted on",
  );
  /*
   * ABSENT RATHER THAN FALSE. Meta's documentation describes the login page as shown "if the
   * `force_reauth` parameter field is passed in" — the FIELD, not its value. Sending
   * `force_reauth=false` is therefore not obviously the same as omitting it, and the code omits it.
   */
  assert.ok(
    !/force_reauth", "false"/.test(TRANSPORT_CODE),
    "a false value is never sent — the field is omitted instead",
  );
}

function theSwitchFlagCannotWidenAnything(): void {
  /* Scopes still come from the frozen constant, never from a parameter. */
  assert.match(
    TRANSPORT_CODE,
    /url\.searchParams\.set\("scope", INSTAGRAM_REQUESTED_SCOPES\.join\(","\)\)/,
    "the scope set is still the frozen constant",
  );

  /*
   * SCOPED TO THE AUTHORIZATION BUILDER. The first version of this scanned the whole module and
   * swept in the TOKEN-EXCHANGE builders' own parameters (`client_secret`, `access_token`,
   * `grant_type`) — a census of the wrong function. Those belong to a different call, to a
   * different endpoint, and none of them is ever placed on a URL a browser follows.
   */
  const fnStart = TRANSPORT_CODE.indexOf("export function buildInstagramAuthorizationUrl");
  assert.ok(fnStart >= 0, "the authorization builder was located");
  /*
   * THE END BOUNDARY IS ASSERTED, NOT ASSUMED. The first attempt searched for the next
   * `export function` and got -1, because every later export in this module is `export async
   * function` — and `slice(start, -1)` silently returns almost the whole file rather than failing.
   * A scanner that looks scoped and is not is worse than no scanner.
   */
  const fnEnd = TRANSPORT_CODE.indexOf("\n}", fnStart);
  assert.ok(fnEnd > fnStart, "the authorization builder's closing brace was located");
  const authorizeFn = TRANSPORT_CODE.slice(fnStart, fnEnd);
  assert.ok(
    !authorizeFn.includes("client_secret") && !authorizeFn.includes("grant_type"),
    "the slice really is just the authorization builder — no token-exchange code leaked in",
  );
  const params = [...authorizeFn.matchAll(/searchParams\.set\("([a-z_]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(
    params.sort(),
    ["client_id", "force_reauth", "redirect_uri", "response_type", "scope", "state"].sort(),
    "the authorization URL carries exactly these six fields and no seventh",
  );

  /*
   * The route reads ONE query parameter, and it feeds only the re-auth flag. The name is a named
   * constant rather than an inline literal, so the census counts `.get(` CALLS and then pins the
   * constant — matching only string literals would have found none and passed vacuously.
   */
  const gets = [...START_CODE.matchAll(/searchParams\.get\(/g)].length;
  assert.equal(gets, 1, "the start route reads exactly one query parameter");
  assert.match(
    START_CODE,
    /const SWITCH_ACCOUNT_PARAM = "switch" as const/,
    "…and it is the account-switch flag",
  );
  assert.match(
    START_CODE,
    /searchParams\.get\(SWITCH_ACCOUNT_PARAM\) === "1"/,
    "…read as an exact match, not a truthiness test",
  );
  assert.match(
    START_CODE,
    /forceReauth: switchAccount/,
    "…and it reaches nothing but the re-auth flag",
  );
}

function theTenantAndIntegrationStillComeFromTheServer(): void {
  assert.match(START_CODE, /await resolveTenantContext\(\)/, "the tenant comes from the session");
  assert.ok(
    !/searchParams\.get\("(tenant|tenantId|integration|integrationId|scope|redirect_uri)"\)/.test(
      START_CODE,
    ),
    "no authoritative value is ever read from the query string",
  );
  /* The state is still minted over all three bindings. */
  assert.match(
    START_CODE,
    /mintInstagramOAuthState\(\s*\{ tenantId: tenant\.tenantId, sessionReference, integrationId \}/,
    "the signed state still binds tenant, session and integration",
  );
}

function theCallbackStillFailsClosed(): void {
  const cb = codeOf(read(CALLBACK));
  assert.match(cb, /await resolveTenantContext\(\)/, "the callback re-resolves the tenant");
  assert.match(cb, /if \(!verified\.ok\) return outcome\("invalid-state"\)/, "state failure is closed");
  /*
   * THE STATE IS VERIFIED BEFORE THE CODE IS EXCHANGED — order is the property, and it is compared
   * at the CALL SITES. Comparing bare identifiers compared their IMPORT positions instead, where
   * the two happen to appear in the opposite order; that check would have failed on a correct file
   * and passed on a reordered import block, which is precisely backwards.
   */
  const verifyAt = cb.indexOf("= verifyInstagramOAuthState(");
  const exchangeAt = cb.indexOf("await exchangeAuthorizationCode(");
  assert.ok(verifyAt > 0 && exchangeAt > 0, "both call sites were located");
  assert.ok(verifyAt < exchangeAt, "state verification precedes the code exchange");
}

/* ── 2 · the disconnect action ─────────────────────────────────────────────── */

function theDisconnectActionAcceptsNothingFromTheBrowser(): void {
  assert.match(
    ACTION_CODE,
    /export async function disconnectInstagramAction\(\): Promise<void>/,
    "the action takes NO parameters — there is nothing to forge",
  );
  assert.ok(!/formData/.test(ACTION_CODE), "it reads no form data");
  assert.ok(
    !/(tenantId|integrationId|credentialId)\s*[:=]\s*(input|params|formData)/.test(ACTION_CODE),
    "no authoritative id is taken from a caller",
  );
  assert.match(ACTION_CODE, /await resolveTenantContext\(\)/, "the tenant comes from the session");
  /* The action names a PROVIDER, never an integration — the row is re-derived one layer down. */
  assert.match(
    ACTION_CODE,
    /disconnectProviderConnection\(tenant, INSTAGRAM_PROVIDER_KEY\)/,
    "the action passes the tenant and a provider key, and nothing else",
  );
  assert.match(
    LIFECYCLE_CODE,
    /listing\.connections\.find\(/,
    "the connection is re-derived from the tenant's own listing",
  );
  assert.ok(
    !/integrationId\??:/.test(LIFECYCLE_CODE.slice(0, LIFECYCLE_CODE.indexOf("export async function disconnectProviderConnection"))),
    "the lifecycle module exposes no integration-id parameter for a caller to supply",
  );
}

/**
 * THE CREDENTIAL AUTHORITY IS UNREACHABLE FROM `src/app`, AND THAT IS A RELEASED RULE.
 *
 * INT-2 names exactly two exempt files — the Google and Instagram OAuth callbacks — because they
 * hold tokens a provider has just issued. The disconnect surface is not one of them and must not
 * become one: "a surface that could reach the vault would eventually render it."
 */
function theSurfaceCannotReachTheVault(): void {
  for (const [label, code] of [
    ["action", ACTION_CODE],
    ["page", PAGE_CODE],
  ] as const) {
    assert.ok(
      !code.includes("integration-credentials"),
      `${label} must not import the credential authority from src/app`,
    );
    assert.ok(!code.includes("secret-encryption"), `${label} must not import the cipher`);
  }
}

function itComposesTheTwoReleasedAuthoritiesAndCreatesNeither(): void {
  for (const authority of ["revokeCredential", "disconnectConnection", "listCredentialMetadata"]) {
    assert.ok(
      LIFECYCLE_CODE.includes(authority),
      `the lifecycle module calls the released ${authority}`,
    );
  }
  /* It writes nothing itself: no schema import, no insert/update/delete, no transaction. */
  assert.ok(
    !/from "@\/db\/schema/.test(LIFECYCLE_CODE),
    "the lifecycle module names no table — both writes belong to their owning authority",
  );
  for (const forbidden of [".insert(", ".update(", ".delete(", ".transaction("]) {
    assert.ok(
      !LIFECYCLE_CODE.includes(forbidden),
      `the lifecycle module performs no ${forbidden} of its own`,
    );
  }
}

function theSecretIsRevokedBeforeTheLifecycleMoves(): void {
  /*
   * ORDER IS THE WHOLE SAFETY ARGUMENT. Ending the connection first would leave a row that says
   * `disconnected` while a live, decryptable provider token remains — a human told one thing while
   * the secret is still spendable.
   */
  /* CALL SITES, not imports — the same trap as the callback ordering check above. */
  const revokeAt = LIFECYCLE_CODE.indexOf("await revokeCredential(");
  const disconnectAt = LIFECYCLE_CODE.indexOf("await disconnectConnection(");
  assert.ok(revokeAt > 0 && disconnectAt > 0, "both call sites were located");
  assert.ok(revokeAt < disconnectAt, "credentials are revoked BEFORE the connection transitions");
  assert.match(
    LIFECYCLE_CODE,
    /filter\(\(c\) => c\.live\)/,
    "every LIVE credential is revoked, not merely the newest",
  );
}

function itClaimsNoProviderSideRevocation(): void {
  /*
   * Hebun implements no Instagram deauthorization call, so the surface must not imply one. This is
   * asserted on the RENDERED page text, not on the module that documents the limitation.
   */
  assert.match(
    PAGE_CODE,
    /does not remove Hebun from your Instagram account/i,
    "the surface states that the Instagram-side authorization is untouched",
  );
  /*
   * NARROWED TO A META ENDPOINT. A bare `/permissions` scan flagged the public privacy page and the
   * Governance permission matrix — neither of which is a provider call. The rule is about reaching
   * META to revoke, so the pattern names Meta's own hosts.
   */
  const deauth = collect("src").filter((f) => {
    const code = codeOf(read(f));
    return (
      /(graph\.instagram\.com|graph\.facebook\.com|instagram\.com)[^"'`]*\/(permissions|revoke)/i.test(code) ||
      /deauthoriz/i.test(code)
    );
  });
  assert.deepEqual(deauth, [], "no module calls an Instagram deauthorization endpoint");
}

function historyIsNotTouched(): void {
  for (const code of [ACTION_CODE, LIFECYCLE_CODE]) {
    for (const forbidden of ["provider_observations", "providerObservations", "knowledge"]) {
      assert.ok(
        !code.toLowerCase().includes(forbidden.toLowerCase()),
        `disconnect must not reach ${forbidden} — stored history stays true`,
      );
    }
  }
}

/* ── 3 · the surface ───────────────────────────────────────────────────────── */

function disconnectIsASubmitAndNotALink(): void {
  /*
   * A GET that ends a grant would be followed by a prefetch, a crawler or a back button. The
   * control must be a form submit.
   */
  assert.match(PAGE_CODE, /<form action=\{disconnectInstagramAction\}/, "disconnect posts a form");
  assert.ok(
    !/href="[^"]*disconnect/.test(PAGE_CODE),
    "there is no disconnect link — only a submit",
  );
  /* And the switch control IS a link, because starting an OAuth flow is a safe navigation. */
  assert.match(
    PAGE_CODE,
    /href="\/api\/integrations\/instagram\/start\?switch=1"/,
    "connect-a-different-account navigates to the released ceremony",
  );
}

function disconnectableIsNotTheNegationOfConnectable(): void {
  const model = codeOf(read(MODEL));
  /*
   * They answer different questions and genuinely disagree: `degraded` is not connectable AND is
   * disconnectable; `ended` is connectable and NOT disconnectable. A surface that used `!connectable`
   * would offer a control the released authority refuses.
   */
  assert.match(model, /disconnectable: true/, "some states are disconnectable");
  assert.match(model, /disconnectable: false/, "and terminal ones are not");
  assert.ok(
    !/disconnectable: !connectable/.test(model),
    "disconnectable is derived per state, never as the negation of connectable",
  );
  /* Terminal states must not offer it — the authority refuses a second transition. */
  const ended = model.slice(model.indexOf('case "revoked":'));
  assert.match(
    ended.slice(0, 400),
    /state: "ended", connectable: true, disconnectable: false/,
    "an already-ended connection offers no disconnect",
  );
}

function noSecretReachesTheSurface(): void {
  for (const [label, code] of [
    ["page", PAGE_CODE],
    ["action", ACTION_CODE],
    ["model", codeOf(read(MODEL))],
    ["lifecycle", LIFECYCLE_CODE],
  ] as const) {
    for (const forbidden of [
      "plaintext",
      "ciphertext",
      "accessToken",
      "clientSecret",
      "withDecryptedSecret",
      "secret",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${label} must never name credential material — found ${forbidden}`,
      );
    }
    assert.ok(!/console\.(log|info|warn|error)/.test(code), `${label} logs nothing`);
  }
}

/* ── 4 · nothing else on the page moved ────────────────────────────────────── */

function theReleasedCeremonyIsUnchangedForAFirstConNection(): void {
  /* A first connect still uses the plain start URL — no forced re-auth where none is wanted. */
  assert.match(
    PAGE_CODE,
    /href="\/api\/integrations\/instagram\/start"\s*\n?\s*prefetch=\{false\}/,
    "the first-connect control still points at the unmodified ceremony",
  );
}

function main(): void {
  forceReauthIsOptOutByDefault();
  theSwitchFlagCannotWidenAnything();
  theTenantAndIntegrationStillComeFromTheServer();
  theCallbackStillFailsClosed();
  theDisconnectActionAcceptsNothingFromTheBrowser();
  theSurfaceCannotReachTheVault();
  itComposesTheTwoReleasedAuthoritiesAndCreatesNeither();
  theSecretIsRevokedBeforeTheLifecycleMoves();
  itClaimsNoProviderSideRevocation();
  historyIsNotTouched();
  disconnectIsASubmitAndNotALink();
  disconnectableIsNotTheNegationOfConnectable();
  noSecretReachesTheSurface();
  theReleasedCeremonyIsUnchangedForAFirstConNection();
  console.log("Instagram account lifecycle firewall checks passed");
}

main();
