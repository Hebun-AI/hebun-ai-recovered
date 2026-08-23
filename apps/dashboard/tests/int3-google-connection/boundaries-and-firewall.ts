/*
 * INT-3 — STRUCTURAL BOUNDARIES AROUND THE FIRST REAL PROVIDER.
 *
 * These prove claims about what does NOT exist and what cannot be reached: no second place that
 * talks to Google, no Drive/Calendar/Admin scope, no write capability, no logging on the token
 * path, no client secret in the vault, no tenant id taken from a request, and no new authority.
 *
 * No database. No network. Source inspection plus the real import graph.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  GOOGLE_REQUESTED_SCOPES,
  GOOGLE_REQUIRED_GRANTED_SCOPES,
  coversRequiredScopes,
} from "../../src/features/provider-google/contracts";
import { PROVIDER_CATALOG, listConnectableProviders } from "../../src/features/provider-catalog/catalog";
import { I1_PRODUCIBLE_STATES } from "../../src/features/integration-authority/contracts";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
/** Comments AND string literals removed — a guard must read code, not honest prose. */
const codeOnly = (s: string) =>
  codeOf(s).replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");

const GOOGLE = "src/features/provider-google";
const TRANSPORT = `${GOOGLE}/google-transport.server.ts`;
const START = "src/app/api/integrations/google/start/route.ts";
const CALLBACK = "src/app/api/integrations/google/callback/route.ts";

function collect(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

function resolveImport(spec: string, from: string): string | null {
  const base = spec.startsWith("@/")
    ? path.join("src", spec.slice(2))
    : spec.startsWith(".")
      ? path.join(path.dirname(from), spec)
      : null;
  if (!base) return null;
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(path.join(ROOT, candidate)) && statSync(path.join(ROOT, candidate)).isFile()) {
      return candidate;
    }
  }
  return null;
}

function reachableFrom(entry: string): Set<string> {
  const seen = new Set<string>();
  const stack = [entry];
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const match of codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)) {
      const target = resolveImport(match[1]!, file);
      if (target) stack.push(target);
    }
  }
  return seen;
}

function main(): void {
  /* ── 1. EXACTLY ONE MODULE TALKS TO GOOGLE ───────────────────────────────── */
  {
    /*
     * ENDPOINT hosts, not scope strings. `https://www.googleapis.com/auth/userinfo.email` is a
     * SCOPE — it names a permission, not somewhere to send a request — and the catalog legitimately
     * contains it. Matching it here would have flagged the frozen provider definition as a network
     * caller, which is the kind of false positive that gets a guard suppressed rather than fixed.
     */
    const callers = collect("src")
      .filter((f) =>
        /accounts\.google\.com|oauth2\.googleapis\.com|openidconnect\.googleapis\.com/.test(
          codeOf(read(f)),
        ),
      )
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      callers,
      [`${GOOGLE}/contracts.ts`],
      "ONE file may name a Google endpoint, and it is the frozen constants module — the transport " +
        "imports them rather than spelling a host, so no caller can point it elsewhere",
    );

    /* And only the transport performs network I/O at all. */
    const fetchers = collect(GOOGLE)
      .filter((f) => /\bfetch\(|doFetch\(/.test(codeOnly(read(f))))
      .map((f) => f.replace(/\\/g, "/"));
    assert.deepEqual(fetchers, [TRANSPORT], "exactly one module may reach the network");

    /*
     * NO ENDPOINT CROSSES THE MODULE BOUNDARY. The internal helper takes an `endpoint` argument and
     * that is fine — what matters is that no EXPORTED signature and no dependency field lets a
     * caller choose one, which is how R3B's configurable endpoint became an arbitrary-URL hole.
     */
    const transportSource = read(TRANSPORT);
    const depsInterface = transportSource.slice(
      transportSource.indexOf("export interface GoogleTransportDeps"),
      transportSource.indexOf("}", transportSource.indexOf("export interface GoogleTransportDeps")),
    );
    for (const forbidden of ["endpoint", "baseUrl", "url", "host"]) {
      assert.ok(
        !new RegExp(`\\b${forbidden}\\s*\\??:`).test(depsInterface),
        `GoogleTransportDeps must not let a caller choose a "${forbidden}"`,
      );
    }
    for (const exported of ["exchangeAuthorizationCode", "refreshAccessToken", "fetchGoogleIdentity", "revokeGoogleToken"]) {
      const at = transportSource.indexOf(`export async function ${exported}`);
      assert.ok(at > 0, `${exported} must exist`);
      const signature = transportSource.slice(at, transportSource.indexOf("{", transportSource.indexOf(")", at)));
      assert.ok(
        !/endpoint|baseUrl|\burl\b/.test(signature),
        `${exported} must not accept an endpoint — the constants are the only targets`,
      );
    }
    /* Every network call site targets one of the frozen constants. */
    const targets = [...codeOnly(transportSource).matchAll(/(?:postForm|doFetch)\(\s*([A-Za-z_][A-Za-z0-9_]*)/g)]
      .map((m) => m[1]!)
      .filter((name) => name !== "endpoint");
    assert.ok(targets.length > 0, "there is at least one network call to check");
    for (const target of targets) {
      assert.ok(
        target.startsWith("GOOGLE_"),
        `every call must target a frozen endpoint constant — found "${target}"`,
      );
    }
  }

  /* ── 2. NOTHING ON THE TOKEN PATH LOGS ───────────────────────────────────── */
  {
    for (const file of collect(GOOGLE).concat([START, CALLBACK])) {
      const code = codeOnly(read(file));
      for (const forbidden of ["console.", "logger.", "telemetry", "captureException"]) {
        assert.ok(
          !code.includes(forbidden),
          `${file} handles tokens and must not log — found "${forbidden}"`,
        );
      }
    }
  }

  /* ── 3. THE DEPLOYMENT SECRET NEVER ENTERS THE TENANT VAULT ──────────────── */
  {
    /*
     * The two secret classes must not meet. A client secret in `integration_credentials` would put
     * a deployment credential in a tenant's backup; a tenant refresh token in env would put every
     * tenant's secret in one variable.
     */
    for (const file of collect(GOOGLE)) {
      const code = codeOnly(read(file));
      if (/storeCredential|replaceCredential/.test(code)) {
        assert.ok(
          !/plaintext:\s*[^,]*(clientSecret|stateSecret)/.test(code),
          `${file} must never store a DEPLOYMENT secret as a tenant credential`,
        );
      }
    }
    const credentials = codeOnly(read("src/features/integration-credentials/credential-repository.server.ts"));
    for (const forbidden of ["clientSecret", "GOOGLE_OAUTH", "stateSecret"]) {
      assert.ok(
        !credentials.includes(forbidden),
        `the credential authority must not know about Hebun's Google application — found "${forbidden}"`,
      );
    }
  }

  /* ── 4. THE ROUTES TRUST NOTHING FROM THE REQUEST BUT THE FACT OF IT ─────── */
  {
    const start = codeOnly(read(START));
    const callback = codeOnly(read(CALLBACK));

    /* The tenant comes from the session, always. */
    for (const [label, code] of [["start", start], ["callback", callback]] as const) {
      assert.ok(/resolveTenantContext\(\)/.test(code), `${label} must resolve the tenant from the session`);
      assert.ok(
        !/searchParams\.get\(\s*''\s*\)/.test(code) && !/tenantId\s*=\s*params/.test(code),
        `${label} must never take a tenant from the request`,
      );
    }

    /* The redirect URI is configuration, never a header. */
    for (const forbidden of ["headers()", "x-forwarded-host", "request.headers", "req.headers", "nextUrl.origin", "nextUrl.host"]) {
      assert.ok(!start.includes(forbidden), `start must not derive anything from headers — "${forbidden}"`);
      assert.ok(!callback.includes(forbidden), `callback must not derive anything from headers — "${forbidden}"`);
    }
    assert.ok(/config\.redirectUri/.test(start), "start sends the CONFIGURED redirect URI");

    /*
     * ORDER IS THE SECURITY PROPERTY: the state is verified before the code is exchanged. Asserted
     * by position, because a callback that exchanges first has already spent the code by the time
     * it discovers the request was forged.
     */
    /*
     * SCOPED TO THE HANDLER BODY. A module-wide `indexOf` matches the IMPORT lines, whose order is
     * alphabetical and has nothing to do with execution — the assertion would then pass or fail for
     * a reason unrelated to the guard, which this repository has been bitten by before.
     */
    const bodyAt = callback.indexOf("export async function GET");
    assert.ok(bodyAt > 0, "the callback must expose a GET handler");
    const body = callback.slice(bodyAt);
    const stateAt = body.indexOf("verifyOAuthState");
    const exchangeAt = body.indexOf("exchangeAuthorizationCode");
    assert.ok(stateAt > 0 && exchangeAt > 0, "the callback must do both");
    assert.ok(stateAt < exchangeAt, "state MUST be verified before an authorization code is exchanged");

    /*
     * PKCE, with S256 rather than `plain`. Read from the RAW source: the parameter names live in
     * string literals, which `codeOnly` deliberately strips.
     */
    const startRaw = read(START);
    assert.ok(/code_challenge_method/.test(startRaw), "the authorization request must carry PKCE");
    assert.ok(/"S256"/.test(startRaw), "and S256, never `plain`");
    assert.ok(!/"plain"/.test(startRaw));
    assert.ok(/access_type/.test(startRaw) && /"offline"/.test(startRaw), "offline, or no refresh token exists");
  }

  /* ── 5. LEAST PRIVILEGE — NO DRIVE, NO CALENDAR, NO ADMIN ────────────────── */
  {
    assert.deepEqual([...GOOGLE_REQUESTED_SCOPES], ["openid", "email", "profile"]);
    for (const file of collect(GOOGLE).concat(collect("src/features/provider-catalog"))) {
      const code = read(file);
      for (const forbidden of ["auth/drive", "auth/calendar", "admin.directory", "auth/gmail", "auth/spreadsheets"]) {
        assert.ok(!code.includes(forbidden), `${file} must not request "${forbidden}" in INT-3`);
      }
    }
    /* Required scopes are compared in GOOGLE'S spelling, not in the short form Hebun requests. */
    assert.ok(GOOGLE_REQUIRED_GRANTED_SCOPES.every((s) => s === "openid" || s.startsWith("https://")));
    assert.ok(!coversRequiredScopes(["openid", "email", "profile"]), "the short form is NOT the grant");
    assert.ok(coversRequiredScopes([...GOOGLE_REQUIRED_GRANTED_SCOPES]));
  }

  /* ── 6. THE CATALOG OFFERS ONE PROVIDER, AND NO CAPABILITY ───────────────── */
  {
    assert.deepEqual(
      listConnectableProviders().map((d) => d.providerKey),
      ["google-workspace"],
      "exactly one real provider exists",
    );
    const google = PROVIDER_CATALOG[0]!;
    assert.equal(google.authMethod, "oauth2");
    assert.deepEqual(
      google.capabilityScopes,
      {},
      "INT-3 delivers NO capability — a listed one would offer a read this phase cannot perform",
    );
    for (const vendor of ["slack", "github", "microsoft", "notion"]) {
      assert.ok(
        !PROVIDER_CATALOG.some((d) => d.providerKey.includes(vendor)),
        `only Google was implemented, so only Google may be listed — found "${vendor}"`,
      );
    }
    /* Still a frozen code authority: no database row can add one. */
    assert.ok(Object.isFrozen(PROVIDER_CATALOG) && Object.isFrozen(google));
  }

  /* ── 7. `connected` HAS EXACTLY ONE WRITER, AND `revoked` STILL HAS NONE ─── */
  {
    assert.ok(I1_PRODUCIBLE_STATES.includes("connected"), "INT-3 may produce connected");
    assert.ok(I1_PRODUCIBLE_STATES.includes("expired"), "and expired");
    assert.ok(
      !I1_PRODUCIBLE_STATES.includes("revoked"),
      "and NOT revoked — Google's invalid_grant cannot establish that the provider ended the grant",
    );

    const repository = codeOnly(read("src/features/integration-authority/integration-repository.server.ts"));
    const connectedWrites = [...repository.matchAll(/connectionState:\s*nextState/g)].length;
    assert.ok(connectedWrites > 0, "the lifecycle is written through nextState");
    assert.ok(
      !/connectionState:\s*""connected""/.test(repository.replace(/"/g, '""')),
      "no writer hard-codes connected outside the guarded path",
    );

    /* Only ONE module in src/ may call the verified writer. */
    const writers = collect("src")
      .filter((f) => codeOnly(read(f)).includes("recordVerifiedConnectionWithin("))
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    assert.deepEqual(
      writers,
      ["src/features/integration-authority/integration-repository.server.ts", CALLBACK].sort(),
      "only the callback may record a verified connection",
    );
  }

  /* ── 8. THE VERIFIER IS NOT AN AUTHORITY ─────────────────────────────────── */
  {
    const graph = reachableFrom(`${GOOGLE}/verify-google-connection.server.ts`);
    for (const forbidden of [
      "src/features/action-authorization/",
      "src/features/action-execution/",
      "src/features/action-execution-live/",
      "src/features/governance-decision/",
      "src/features/governance-genesis/",
      "src/features/knowledge/",
      "src/features/command-overview/",
    ]) {
      const reached = [...graph].filter((f) => f.replace(/\\/g, "/").startsWith(forbidden));
      assert.deepEqual(reached, [], `the Google verifier must not reach ${forbidden}`);
    }
    for (const file of collect(GOOGLE)) {
      const code = codeOnly(read(file));
      for (const forbidden of ["mintPermit", "actionPermits", "consumeActionPermit", "resolveGovernanceAuthority"]) {
        assert.ok(!code.includes(forbidden), `${file} must not name "${forbidden}"`);
      }
    }
  }

  /* ── 9. COMMAND AND KNOWLEDGE ARE STILL NOT CONNECTION OWNERS ────────────── */
  {
    const foreign = collect("src/features/command-overview")
      .concat(collect("src/features/knowledge"))
      .concat(collect("src/components/command-overview"))
      .filter((f) => {
        const code = codeOf(read(f));
        return (
          code.includes("provider-google") ||
          code.includes("integration-authority") ||
          code.includes("integration-credentials")
        );
      });
    assert.deepEqual(foreign, [], "Command and Knowledge must not read the connection subsystem");

    /*
     * ── PIN AMENDED BY INT-3.1 ──────────────────────────────────────────────
     *
     * INT-3 pinned the Platform Integrations surface as "simulation-only", meaning: THIS phase does
     * not touch it. That was the right scope boundary for INT-3, which had no business editing a
     * released surface while building an OAuth flow.
     *
     * It stopped being the right rule the moment a real connection existed. Held literally, it
     * REQUIRED Platform → Integrations to keep deriving its connection claim from the offline
     * simulation catalog — which is exactly how the page came to state "No integration connected"
     * over a live, verified Google connection. A pin that mandates a simulation as the source of
     * product truth defends the defect.
     *
     * What survives, and is now asserted instead: the surface may RENDER the connection authority's
     * model, and may still not reach a secret or a provider. It performs no I/O of its own — the
     * page does the authorized read — so it cannot become a second connection authority.
     */
    const surface = read("src/components/platform-integrations/integrations-surface.tsx");
    const surfaceCode = codeOf(surface);
    assert.ok(
      !surfaceCode.includes("integration-credentials"),
      "the integrations surface must never reach the credential authority",
    );
    assert.ok(
      !surfaceCode.includes("provider-google"),
      "the integrations surface must never reach a provider transport",
    );
    assert.ok(
      !/\.server(\b|"|\/)/.test(surfaceCode),
      "the integrations surface performs no server I/O of its own",
    );
  }

  /* ── 10. NO WRITE CAPABILITY, NO SYNC, NO BACKGROUND WORK ────────────────── */
  {
    for (const forbidden of [
      "src/app/api/integrations/google/webhook",
      "src/features/integration-sync",
      "src/features/google-drive",
      "src/features/google-calendar",
    ]) {
      assert.ok(!existsSync(path.join(ROOT, forbidden)), `${forbidden} is not part of INT-3`);
    }
    /* The api tree holds exactly the two handlers this phase introduced. */
    const routes = collect("src/app/api").filter((f) => /route\.tsx?$/.test(f)).sort();
    assert.deepEqual(
      routes.map((f) => f.replace(/\\/g, "/")),
      [CALLBACK, START].sort(),
      "INT-3 adds exactly two route handlers, and they are the OAuth pair",
    );
    for (const route of routes) {
      const code = codeOnly(read(route));
      assert.ok(/export async function GET/.test(code), `${route} must expose only GET`);
      assert.ok(!/export async function (POST|PUT|PATCH|DELETE)/.test(code), `${route} must not mutate over POST`);
    }
  }

  console.log("int3-google-connection/boundaries-and-firewall: all assertions passed");
}

main();
