/*
 * GITHUB-2 — THE INSTALLATION AUTHORITY.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   AN `installation_id` FROM A REDIRECT BECOMES A CONNECTION ONLY WHEN GITHUB, ASKED DIRECTLY,
 *   SAYS IT NAMES AN ORGANIZATION THAT GRANTED WHAT THE CONNECTION REQUIRES.
 *
 * GitHub's own Setup URL documentation is the reason: "Bad actors can hit this URL with a spoofed
 * `installation_id`. Therefore, you should not rely on the validity of the `installation_id`
 * parameter."
 *
 * ── WHAT IT NEVER DOES ──────────────────────────────────────────────────────
 *
 * It calls no provider. Every GitHub response in this file is a fixture handed to an injected
 * `fetchImpl`, which is what lets the refusals be proved without an installation existing. A mock
 * cannot prove an external contract — that is what the Director's live installation gate is for —
 * but it can prove that Hebun refuses what it says it refuses.
 *
 * It touches no database: the orchestrator is exercised only through paths that refuse BEFORE any
 * transaction opens, which is itself one of the properties being asserted.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { generateKeyPairSync, createVerify } from "node:crypto";
import path from "node:path";

import { findProviderDefinition, PROVIDER_CATALOG } from "../../src/features/provider-catalog/catalog";
import {
  GITHUB_ACCEPTED_REPOSITORY_SELECTION,
  GITHUB_PROVIDER_KEY,
  GITHUB_REQUESTED_PERMISSIONS,
  GITHUB_REQUIRED_GRANTED_PERMISSIONS,
  coversRequiredPermissions,
  normalizeGrantedPermissions,
} from "../../src/features/provider-github/contracts";
import {
  GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
  GITHUB_APP_JWT_TTL_SECONDS,
  mintGitHubAppJwt,
} from "../../src/features/provider-github/github-app-jwt.server";
import { fetchInstallation } from "../../src/features/provider-github/github-transport.server";
import {
  GITHUB_INSTALL_STATE_COOKIE,
  installStateCookieOptions,
  mintInstallState,
  verifyInstallState,
} from "../../src/features/provider-github/install-state.server";
import { buildGitHubConnectionModel } from "../../src/features/github-connection-surface/model";
import { connectGitHubInstallation } from "../../src/features/provider-github/connect-installation.server";
import { GITHUB_APP_ENV_KEYS } from "../../src/features/provider-github/github-environment.server";
import type { IntegrationView } from "../../src/features/integration-authority/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const GITHUB_DIR = "src/features/provider-github";
const TRANSPORT = `${GITHUB_DIR}/github-transport.server.ts`;
const ORCHESTRATOR = `${GITHUB_DIR}/connect-installation.server.ts`;
const SETUP_ROUTE = "src/app/api/integrations/github/setup/route.ts";
const START_ROUTE = "src/app/api/integrations/github/start/route.ts";

function collect(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

/** One RSA key pair for the whole suite. Generated here; nothing reads a key from disk or env. */
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

/** A GitHub installation body, with overrides — so each refusal differs by exactly one field. */
function installationBody(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 42_000_001,
    account: { id: 9_000_001, login: "acme-industries", type: "Organization" },
    target_type: "Organization",
    repository_selection: "selected",
    permissions: { metadata: "read", pull_requests: "read" },
    events: [],
    app_id: 1,
    app_slug: "hebun-ai",
    suspended_at: null,
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/* ── 1. THE APP JWT IS WHAT GITHUB DOCUMENTED ───────────────────────────────── */
function theAppJwtMatchesGithubsStatedRequirements(): void {
  const now = 1_700_000_000;
  const token = mintGitHubAppJwt("123456", privateKey, now);
  const [headerB64, payloadB64, signature] = token.split(".") as [string, string, string];

  const header = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  assert.equal(header.alg, "RS256", 'GitHub: "your JWT must be signed using the RS256 algorithm"');
  assert.equal(header.typ, "JWT");

  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  assert.equal(payload.iss, "123456", "iss is the App id");
  assert.equal(
    payload.iat,
    now - GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
    'GitHub: "Set this 60 seconds in the past"',
  );

  /*
   * ── THE BOUND IS MEASURED AGAINST THE BACKDATED `iat`, NOT AGAINST `now` ──
   *
   * GitHub says the expiry must be "no more than 10 minutes into the future". A token whose `iat`
   * is 60 seconds in the past and whose `exp` is 600 seconds ahead spans 660 seconds of signed
   * lifetime, which is over the limit if GitHub's clock trails ours. The whole drift allowance has
   * to fit INSIDE the ceiling, and this assertion is what says so.
   */
  const signedSpan = payload.exp - payload.iat;
  assert.ok(signedSpan <= 600, `the signed lifetime is ${signedSpan}s — GitHub's ceiling is 600s`);
  assert.equal(payload.exp, now + GITHUB_APP_JWT_TTL_SECONDS);

  /* And it is a real RS256 signature over exactly the first two segments. */
  const verified = createVerify("RSA-SHA256")
    .update(`${headerB64}.${payloadB64}`)
    .verify(publicKey, Buffer.from(signature, "base64url"));
  assert.ok(verified, "the JWT carries a valid RS256 signature over its own header and payload");
}

/* ── 2. THE TRANSPORT KNOWS ONE ENDPOINT, AND IT IS NOT A DATA ENDPOINT ─────── */
async function theTransportCanOnlyReachTheInstallationRecord(): Promise<void> {
  let seenUrl = "";
  let seenHeaders: Record<string, string> = {};
  const fetchImpl = async (input: string, init?: RequestInit) => {
    seenUrl = input;
    seenHeaders = (init?.headers ?? {}) as Record<string, string>;
    return jsonResponse(installationBody());
  };

  const result = await fetchInstallation(42_000_001, "jwt-value", { fetchImpl });
  assert.ok(result.ok, "a 200 with a JSON object is a successful read");
  assert.equal(
    seenUrl,
    "https://api.github.com/app/installations/42000001",
    "the transport requested a data address instead of the installation record",
  );
  assert.equal(seenHeaders.Authorization, "Bearer jwt-value", "GitHub: Authorization: Bearer <JWT>");
  assert.equal(seenHeaders.Accept, "application/vnd.github+json", "the pinned JSON media type");

  /*
   * ── THE SOURCE-CONTENT FIREWALL, PINNED WHERE IT IS CHEAPEST ─────────────
   *
   * GITHUB-2 reads no repository data, and the strongest way to say so is that the only module
   * able to reach GitHub contains no address that could. `pull_requests:read` would permit
   * `/pulls/{n}/files` and a `diff` media type; neither appears here, so neither can be sent.
   */
  const transport = codeOf(read(TRANSPORT));
  for (const forbidden of [
    "/pulls",
    "/contents",
    "/commits",
    "/compare",
    "/git/",
    "/issues",
    "/actions",
    "tarball",
    "zipball",
    "access_tokens",
    "vnd.github.diff",
    "vnd.github.patch",
    "vnd.github.raw",
  ]) {
    assert.ok(
      !transport.includes(forbidden),
      `${TRANSPORT} names ${forbidden} — the installation transport has no data address`,
    );
  }
  /* And no verb other than GET is reachable from it. */
  assert.ok(!/method:\s*"(POST|PUT|PATCH|DELETE)"/.test(transport), "the transport only reads");
}

/* ── 3. FAILURE CLASSES DO NOT COLLAPSE ─────────────────────────────────────── */
async function providerFailureIsNeverConfusedWithSomethingElse(): Promise<void> {
  const cases: ReadonlyArray<{ status: number; failure: string }> = [
    { status: 401, failure: "auth" },
    { status: 403, failure: "auth" },
    /* 404 IS `installation`, NOT `auth`: an uninstalled App says nothing about Hebun's key. */
    { status: 404, failure: "installation" },
    { status: 429, failure: "transport" },
    { status: 500, failure: "transport" },
    { status: 503, failure: "transport" },
  ];
  for (const c of cases) {
    const result = await fetchInstallation(1, "jwt", {
      fetchImpl: async () => jsonResponse({ message: "x" }, c.status),
    });
    assert.equal(result.ok, false);
    assert.equal(
      (result as { failure: string }).failure,
      c.failure,
      `HTTP ${c.status} must classify as ${c.failure}`,
    );
  }

  /* A network failure knows NOTHING about the installation. */
  const thrown = await fetchInstallation(1, "jwt", {
    fetchImpl: async () => {
      throw new Error("ECONNRESET");
    },
  });
  assert.equal((thrown as { failure: string }).failure, "transport");

  /* A 200 that is not an object is malformed, never a successful empty read. */
  const garbage = await fetchInstallation(1, "jwt", {
    fetchImpl: async () => new Response("not json", { status: 200 }),
  });
  assert.equal((garbage as { failure: string }).failure, "malformed");

  /* A non-integer id never reaches the network at all. */
  let called = false;
  const bad = await fetchInstallation(Number.NaN, "jwt", {
    fetchImpl: async () => {
      called = true;
      return jsonResponse({});
    },
  });
  assert.equal((bad as { failure: string }).failure, "malformed");
  assert.equal(called, false, "a malformed id is refused before a request is made");
}

/* ── 4. THE STATE BINDS A FLOW TO ONE TENANT AND ONE SESSION ────────────────── */
function installStateCannotBeReplayedOrRebound(): void {
  const secret = "a".repeat(48);
  const now = 1_700_000_000;
  const minted = mintInstallState(
    { tenantId: "tenant-a", sessionReference: "session-1", integrationId: "int-1" },
    secret,
    now,
  );

  const good = verifyInstallState(
    {
      cookieValue: minted.cookieValue,
      stateParameter: minted.stateParameter,
      sessionReference: "session-1",
      tenantId: "tenant-a",
    },
    secret,
    now,
  );
  assert.ok(good.ok, "the minting session and tenant may finish the flow");
  assert.equal(good.payload.integrationId, "int-1");

  const refuse = (
    input: Partial<Parameters<typeof verifyInstallState>[0]>,
    at: number,
    reason: string,
  ) => {
    const result = verifyInstallState(
      {
        cookieValue: minted.cookieValue,
        stateParameter: minted.stateParameter,
        sessionReference: "session-1",
        tenantId: "tenant-a",
        ...input,
      },
      secret,
      at,
    );
    assert.equal(result.ok, false, `${reason} must be refused`);
    return result as { ok: false; reason: string };
  };

  assert.equal(refuse({ tenantId: "tenant-b" }, now, "another tenant").reason, "tenant-mismatch");
  assert.equal(
    refuse({ sessionReference: "session-2" }, now, "another session").reason,
    "session-mismatch",
  );
  assert.equal(refuse({ stateParameter: "wrong" }, now, "a foreign nonce").reason, "nonce-mismatch");
  assert.equal(refuse({ cookieValue: undefined }, now, "no cookie").reason, "missing");
  assert.equal(refuse({ stateParameter: undefined }, now, "no state").reason, "missing");
  assert.equal(refuse({}, now + 601, "an expired state").reason, "expired");

  /*
   * ── THE FORGERY REWRITES `integrationId`, AND THAT CHOICE IS THE PROOF ────
   *
   * A first version forged `tenantId`, and the signature check was NOT what caught it — the tenant
   * comparison further down did, so deleting the signature check left the suite failing for a
   * different reason and the proof passed while testing the wrong guard.
   *
   * `integrationId` is the one payload field NOTHING else validates: it is not compared to the
   * nonce, the session or the tenant, it is simply returned and then used to decide WHICH
   * connection row a verified installation attaches to. So the signature is the only thing standing
   * between an attacker and pointing a real installation at somebody else's connection, and a
   * forgery of that field can be refused for exactly one reason.
   */
  const forgedBody = Buffer.from(
    JSON.stringify({ ...minted.payload, integrationId: "int-attacker" }),
    "utf8",
  ).toString("base64url");
  const forged = verifyInstallState(
    {
      cookieValue: `${forgedBody}.${minted.cookieValue.split(".")[1]}`,
      stateParameter: minted.stateParameter,
      sessionReference: "session-1",
      tenantId: "tenant-a",
    },
    secret,
    now,
  );
  assert.equal(forged.ok, false, "a forgery must be refused");
  assert.equal((forged as { reason: string }).reason, "bad-signature");

  /*
   * THE SECRET IS ITS OWN. A state sealed with one secret must not verify under another, which is
   * the property that keeps this envelope separate from Google's.
   */
  const otherSecret = verifyInstallState(
    {
      cookieValue: minted.cookieValue,
      stateParameter: minted.stateParameter,
      sessionReference: "session-1",
      tenantId: "tenant-a",
    },
    "b".repeat(48),
    now,
  );
  assert.equal(otherSecret.ok, false, "a state does not verify under a different secret");

  /* The cookie is HttpOnly, Lax, and scoped to the GitHub API path. */
  const options = installStateCookieOptions("https://app.example.com/api/integrations/github/setup");
  assert.equal(options.httpOnly, true);
  assert.equal(options.sameSite, "lax", "Strict would not survive GitHub's cross-site redirect");
  assert.equal(options.secure, true);
  assert.equal(options.path, "/api/integrations/github");
  assert.equal(installStateCookieOptions("http://localhost:3000/x").secure, false);
  assert.equal(GITHUB_INSTALL_STATE_COOKIE, "hebun_github_install_state");
}

/* ── 5. THE ROUTES TAKE NO TENANT AND TRUST NO PARAMETER ────────────────────── */
function noClientCanChooseTheTenantOrTheConnection(): void {
  const setup = codeOf(read(SETUP_ROUTE));
  const start = codeOf(read(START_ROUTE));

  /* The ONLY query parameters either route reads. */
  const params = [...setup.matchAll(/searchParams\.get\("([^"]+)"\)/g)].map((m) => m[1]!).sort();
  assert.deepEqual(
    params,
    ["installation_id", "state"],
    "the setup route reads exactly the two parameters GitHub sends",
  );
  assert.equal(
    [...start.matchAll(/searchParams\.get\("([^"]+)"\)/g)].length,
    0,
    "the start route reads NOTHING from the request",
  );

  /* Neither route can be handed a tenant. */
  for (const [name, code] of [
    [SETUP_ROUTE, setup],
    [START_ROUTE, start],
  ] as const) {
    assert.ok(
      code.includes("resolveTenantContext()"),
      `${name} resolves the tenant server-side, from the session`,
    );
    for (const forbidden of ["tenantId", "tenant_id", "organization", "org="]) {
      assert.ok(
        !new RegExp(`searchParams\\.get\\("${forbidden}`).test(code),
        `${name} must never take ${forbidden} from the request`,
      );
    }
  }

  /*
   * ── THE INTEGRATION ID COMES FROM THE SIGNED STATE, NEVER THE URL ────────
   *
   * Otherwise a caller with a valid installation could point it at another connection row. The
   * authority's tenant predicate is the second gate; this is the first.
   */
  assert.ok(
    /state\.payload\.integrationId/.test(setup),
    "the setup route takes the connection from the signed state",
  );

  /* Both fail closed on configuration before anything else happens. */
  for (const [name, code] of [
    [SETUP_ROUTE, setup],
    [START_ROUTE, start],
  ] as const) {
    assert.ok(
      /config\.status !== "configured"/.test(code),
      `${name} fails closed when the GitHub App is not configured`,
    );
  }

  /* The state cookie is cleared on EVERY outcome of the setup route, not only on success. */
  assert.ok(
    /maxAge:\s*0/.test(setup),
    "the setup route clears the state cookie, so an intercepted URL is worth one attempt",
  );
}

/* ── 6. ORGANIZATION ONLY, SUSPENSION AND BREADTH REFUSED ───────────────────── */
function onlyAnOrganizationInstallationCanEverConnect(): void {
  /*
   * The verifier's own refusals are asserted through the transport fixture in the bite-proofs; here
   * the CONTRACT is pinned, because these are released Director decisions rather than code details.
   */
  assert.deepEqual([...GITHUB_ACCEPTED_REPOSITORY_SELECTION], ["selected"]);

  /*
   * ── NO GREPPING FOR ERROR MESSAGES ────────────────────────────────────────
   *
   * This block used to assert that the verifier and the orchestrator CONTAINED the strings
   * "installation-is-not-an-organization", "installation-suspended" and so on. A bite-proof then
   * disabled the permission check with `if (false && ...)`, leaving every string in place, and the
   * suite stayed green — and worse, the grep for the organization refusal fired BEFORE the real
   * behavioural check and hid it.
   *
   * Searching a file for its own error message proves the message exists, not that anything
   * refuses. Section 10 drives each refusal end to end instead; what remains here is the ORDERING,
   * which is a structural property no behavioural call can observe.
   */
  const orchestrator = codeOf(read(ORCHESTRATOR));

  /*
   * NONE of those refusals may reach the writers. A policy refusal leaves the row where it is —
   * writing a verification failure would say the tenant's grant is in trouble when the truth is
   * that they installed the App somewhere this product does not support.
   */
  /*
   * ── SCOPED TO THE FUNCTION BODY, NOT THE MODULE ──────────────────────────
   *
   * A module-wide `indexOf` finds the IMPORT of `recordVerifiedConnectionWithin` at the top of the
   * file, so the ordering claim would be satisfied by an import statement and could never fail.
   * That exact mistake is on record from an earlier phase; the body is sliced first so the two
   * positions being compared are both real call sites.
   */
  const bodyStart = orchestrator.indexOf("export async function connectGitHubInstallation");
  assert.ok(bodyStart > 0, "the orchestrator entry point exists");
  const body = orchestrator.slice(bodyStart);

  const suspendedIndex = body.indexOf('reason: "installation-suspended"');
  const connectIndex = body.indexOf("recordVerifiedConnectionWithin(");
  assert.ok(suspendedIndex > 0, "the suspension refusal is inside the function body");
  assert.ok(connectIndex > 0, "the verified write is inside the function body");
  assert.ok(
    suspendedIndex < connectIndex,
    "every policy refusal is decided before the connection is written",
  );
  /* The same for the permission gate — the one most tempting to check "later". */
  const permissionIndex = body.indexOf('reason: "insufficient-granted-permissions"');
  assert.ok(permissionIndex > 0 && permissionIndex < connectIndex);
}

/* ── 7. GRANTED, NEVER REQUESTED — AND NO CREDENTIAL EXISTS ─────────────────── */
function grantedPermissionsComeFromGithubAndNothingIsStored(): void {
  assert.notDeepEqual(
    [...GITHUB_REQUESTED_PERMISSIONS],
    [...GITHUB_REQUIRED_GRANTED_PERMISSIONS],
    "requested and required-granted stay distinguishable sets",
  );

  /* GitHub's map, in GitHub's spelling, flattened into the released `string[]` column shape. */
  assert.deepEqual(
    [...normalizeGrantedPermissions(installationBody().permissions as Record<string, unknown>)],
    ["metadata:read", "pull_requests:read"],
  );
  assert.equal(coversRequiredPermissions(["metadata:read"]), true);
  assert.equal(
    coversRequiredPermissions(["pull_requests:read"]),
    false,
    "a different permission does not satisfy the required one",
  );

  /*
   * ── AN EXTRA GRANT IS REPORTED, NOT TREATED AS CAPABILITY ────────────────
   *
   * If an organization installs an App with more than Hebun asked for, the truthful record is what
   * GitHub returned. It is persisted verbatim and the availability seam decides separately what
   * any of it can answer, from the catalog's capability scopes.
   */
  assert.deepEqual(
    [...normalizeGrantedPermissions({ metadata: "read", contents: "write" })],
    ["contents:write", "metadata:read"],
    "an unused grant is still reported, because the organization did give it",
  );

  /*
   * ── ZERO CREDENTIALS, ASSERTED STRUCTURALLY ──────────────────────────────
   *
   * No module in this provider can reach the credential vault or the encryption key registry, so
   * no GitHub credential row can be written by accident rather than by policy. And no module mints
   * an installation ACCESS TOKEN, which is the only GitHub value that would ever be worth storing.
   */
  for (const file of collect(GITHUB_DIR)) {
    const code = codeOf(read(file));
    for (const forbidden of [
      "integration-credentials",
      "secret-encryption",
      "oauth_access",
      "oauth_refresh",
      "access_tokens",
    ]) {
      assert.ok(
        !code.includes(forbidden),
        `${file} names ${forbidden} — this provider stores no tenant secret and mints no token`,
      );
    }
  }
}

/* ── 8. THE CATALOG IS TRUE, AND THE SURFACE INVENTS NOTHING ────────────────── */
function theCatalogAndTheSurfaceStateOnlyWhatIsKnown(): void {
  const github = findProviderDefinition(GITHUB_PROVIDER_KEY);
  assert.ok(github, "GitHub is connectable now that the verifier exists");
  assert.equal(github.connectivity, "connectable");
  assert.equal(
    PROVIDER_CATALOG.filter((p) => p.providerKey.includes("github")).length,
    1,
    "one GitHub entry, and it is the real one — never the simulation",
  );

  /* A tenant with no connection is told exactly that, and offered the act. */
  const none = buildGitHubConnectionModel([], true);
  assert.equal(none.state, "none");
  assert.equal(none.organizationLabel, null);
  assert.equal(none.installationId, null);
  assert.deepEqual([...none.grantedPermissions], []);
  assert.equal(none.connectable, true);

  /* An unconfigured deployment does not offer an act it cannot perform. */
  assert.equal(buildGitHubConnectionModel([], false).connectable, false);
  assert.equal(buildGitHubConnectionModel([], false).unconfigured, true);

  const connected: IntegrationView = {
    integrationId: "11111111-1111-4111-8111-111111111111",
    name: "GitHub",
    providerKey: GITHUB_PROVIDER_KEY,
    connectionState: "connected",
    health: "healthy",
    scopes: ["metadata:read", "pull_requests:read"],
    externalAccountId: "42000001",
    externalAccountLabel: "acme-industries",
    lastVerifiedAt: "2026-08-24T00:00:00.000Z",
    lastSuccessAt: "2026-08-24T00:00:00.000Z",
    lastErrorAt: null,
    failureReason: null,
    revokedAt: null,
    createdAt: "2026-08-24T00:00:00.000Z",
  };
  const live = buildGitHubConnectionModel([connected], true);
  assert.equal(live.state, "connected");
  assert.equal(live.organizationLabel, "acme-industries");
  assert.equal(live.installationId, "42000001");
  assert.equal(live.connectable, false, "a connected tenant is not offered the act again");

  /*
   * ── THE SURFACE SHOWS NO ENGINEERING DATA, BECAUSE NONE WAS READ ─────────
   *
   * The navigation phase removed seeded provider state from the shell; reintroducing a repository
   * count or a "last sync" one screen away would be the same defect with a different address.
   */
  const page = codeOf(read("src/app/(dashboard)/integrations/github/page.tsx"));
  const model = codeOf(read("src/features/github-connection-surface/model.ts"));
  for (const banned of ["repositoryCount", "pullRequest", "lastSync", "eventsToday", "commits"]) {
    assert.ok(!page.includes(banned), `the GitHub surface must not render ${banned}`);
    assert.ok(!model.includes(banned), `the GitHub surface model must not derive ${banned}`);
  }
}

/* ── 9. THE TWO WORLDS STAY APART ───────────────────────────────────────────── */
function theSimulationCannotSatisfyRealConnectionTruth(): void {
  const specifiersOf = (file: string): string[] =>
    [...codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);

  for (const file of collect(GITHUB_DIR)) {
    for (const specifier of specifiersOf(file)) {
      assert.ok(
        !specifier.includes("features/providers/"),
        `${file} imports ${specifier} — the real provider may never reach the simulation tree`,
      );
    }
  }
  for (const file of collect("src/features/providers/github")) {
    for (const specifier of specifiersOf(file)) {
      for (const forbidden of ["provider-github", "provider-catalog", "integration-authority"]) {
        assert.ok(
          !specifier.includes(forbidden),
          `${file} imports ${specifier} — the simulation may never reach real connection truth`,
        );
      }
    }
  }
  /* And the routes reach the real provider only. */
  for (const route of [SETUP_ROUTE, START_ROUTE]) {
    for (const specifier of specifiersOf(route)) {
      assert.ok(
        !specifier.includes("features/providers/"),
        `${route} imports ${specifier} — a route may not reach a simulation`,
      );
    }
  }
}

/* ── 10. THE REFUSALS ARE BEHAVIOUR, NOT SOURCE TEXT ────────────────────────── */
async function everyPolicyRefusalIsProvedByRunningIt(): Promise<void> {
  /*
   * ── WHY THIS SECTION EXISTS ───────────────────────────────────────────────
   *
   * An earlier version asserted these refusals by looking for their names in the orchestrator's
   * source. A bite-proof then disabled the permission check with `if (false && ...)` — leaving the
   * string in place — and the suite stayed green. A guard proved by grepping for its own error
   * message is not proved at all.
   *
   * So each refusal is now driven end to end: a fixture GitHub response goes in, and the outcome
   * is asserted. The App environment is set here from a key generated in this process; nothing is
   * read from the real environment and no request leaves the machine.
   *
   * ── THE DATABASE IS A TRIPWIRE ────────────────────────────────────────────
   *
   * `getDb` throws. Every case below must refuse BEFORE a transaction opens, so reaching the
   * database is itself the failure — which is the strongest available statement that a rejected
   * installation writes nothing.
   */
  const previous = { ...process.env };
  process.env[GITHUB_APP_ENV_KEYS.appId] = "123456";
  process.env[GITHUB_APP_ENV_KEYS.privateKey] = privateKey
    .export({ type: "pkcs8", format: "pem" })
    .toString();
  process.env[GITHUB_APP_ENV_KEYS.appSlug] = "hebun-ai";
  process.env[GITHUB_APP_ENV_KEYS.setupUrl] = "https://app.example.com/api/integrations/github/setup";
  process.env[GITHUB_APP_ENV_KEYS.stateSecret] = "s".repeat(48);

  const tenant = { tenantId: "11111111-1111-4111-8111-111111111111", userId: "u1" } as never;
  const integrationId = "22222222-2222-4222-8222-222222222222";

  const getDb = () => {
    throw new Error("THE DATABASE MUST NOT BE REACHED BY A REFUSED INSTALLATION");
  };

  const attempt = async (body: unknown, status = 200) =>
    connectGitHubInstallation(tenant, integrationId, 42_000_001, {
      fetchImpl: async () => jsonResponse(body, status),
      getDb: getDb as never,
    });

  try {
    /*
     * A RESPONSE WHOSE TWO ACCOUNT-TYPE FIELDS DISAGREE is refused, never resolved in the
     * permissive direction. GitHub reports the target type twice; if they differ, this is not a
     * response Hebun understands, and picking the friendlier one would be inventing a fact.
     */
    const disagreeing = await attempt(
      installationBody({
        account: { id: 5, login: "acme", type: "Organization" },
        target_type: "User",
      }),
    );
    assert.equal(
      (disagreeing as { reason: string }).reason,
      "installation-not-understood",
      "a self-contradicting account type is refused",
    );

    const personal = await attempt(
      installationBody({
        account: { id: 5, login: "a-person", type: "User" },
        target_type: "User",
      }),
    );
    assert.equal(personal.status, "refused");
    assert.equal(
      (personal as { reason: string }).reason,
      "not-an-organization",
      "a personal installation is refused, never silently supported",
    );

    const suspended = await attempt(installationBody({ suspended_at: "2026-01-01T00:00:00Z" }));
    assert.equal(
      (suspended as { reason: string }).reason,
      "installation-suspended",
      "a suspended installation cannot become a healthy connection",
    );

    const broad = await attempt(installationBody({ repository_selection: "all" }));
    assert.equal(
      (broad as { reason: string }).reason,
      "repository-selection-too-broad",
      "an all-repository installation is refused",
    );

    const underPermissioned = await attempt(
      installationBody({ permissions: { pull_requests: "read" } }),
    );
    assert.equal(
      (underPermissioned as { reason: string }).reason,
      "insufficient-granted-permissions",
      "an installation that granted less than required cannot connect",
    );
    /* And the refusal carries the identity, so a human can see WHICH organization to fix. */
    assert.equal(
      (underPermissioned as { identity?: { accountLogin: string } }).identity?.accountLogin,
      "acme-industries",
    );

    /*
     * A WRITE PERMISSION DOES NOT SATISFY A READ REQUIREMENT. `metadata:write` would let GitHub
     * perform the read, and this provider never requests a write — so a grant carrying one must
     * not launder into coverage.
     */
    const writeInsteadOfRead = await attempt(
      installationBody({ permissions: { metadata: "write", pull_requests: "read" } }),
    );
    assert.equal(
      (writeInsteadOfRead as { reason: string }).reason,
      "insufficient-granted-permissions",
      "a write grant does not satisfy the required read",
    );

    /* A 404 is the installation's absence, never a problem with Hebun's own credential. */
    const missing = await attempt({ message: "Not Found" }, 404);
    assert.equal((missing as { reason: string }).reason, "installation-not-found");

    /*
     * ── A PROVIDER OUTAGE SAYS NOTHING ABOUT THE GRANT ────────────────────
     *
     * This is the ONE path that legitimately reaches persistence, because a failed observation is
     * a health fact worth recording — and health is the dimension that exists precisely so a
     * provider's bad minute never ends a tenant's connection.
     *
     * The stub answers the released writer's own first query shape and returns no row, so the
     * writer refuses harmlessly. What is being asserted is the CLASSIFICATION: a network failure
     * becomes `provider-unreachable`, and never `installation-not-found` or an auth problem.
     */
    let transactionOpened = false;
    const noRowTx = {
      select: () => ({
        from: () => ({ where: () => ({ limit: () => ({ for: () => [] }) }) }),
      }),
    };
    const unreachableOutcome = await connectGitHubInstallation(tenant, integrationId, 42_000_001, {
      fetchImpl: async () => {
        throw new Error("ECONNRESET");
      },
      getDb: (() => ({
        transaction: async (fn: (tx: unknown) => unknown) => {
          transactionOpened = true;
          return fn(noRowTx);
        },
      })) as never,
    });
    assert.equal((unreachableOutcome as { reason: string }).reason, "provider-unreachable");
    assert.ok(transactionOpened, "a failed observation is recorded as health, through the authority");
  } finally {
    for (const key of Object.values(GITHUB_APP_ENV_KEYS)) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
}

async function main(): Promise<void> {
  theAppJwtMatchesGithubsStatedRequirements();
  await theTransportCanOnlyReachTheInstallationRecord();
  await providerFailureIsNeverConfusedWithSomethingElse();
  installStateCannotBeReplayedOrRebound();
  noClientCanChooseTheTenantOrTheConnection();
  onlyAnOrganizationInstallationCanEverConnect();
  grantedPermissionsComeFromGithubAndNothingIsStored();
  theCatalogAndTheSurfaceStateOnlyWhatIsKnown();
  theSimulationCannotSatisfyRealConnectionTruth();
  await everyPolicyRefusalIsProvedByRunningIt();
  console.log("github2-installation-authority/installation-authority: all assertions passed");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
