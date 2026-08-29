/*
 * LMX-1 — THE AUTHENTICATED DASHBOARD CANNOT BECOME REUSABLE STATIC HTML.
 *
 * ── THE HAZARD THIS GUARDS, STATED EXACTLY ───────────────────────────────────
 *
 * A local build reports every `(dashboard)` route as `○ (Static)`, which reads like a defect and is
 * not one: with authentication DISABLED the resolver returns before touching a request-bound API,
 * nothing tenant-specific is read, and the prerendered page contains no organization, no agent and
 * no identifier. The measured artifact carries zero tenant data.
 *
 * The real hazard is the inverse. If the resolver ever stopped reaching a request-bound API while
 * authentication IS configured, Next.js could prerender an authenticated route, and a signed-in
 * Director would be served build-time HTML — either frozen "unavailable" states, or, if a tenant
 * could ever be resolved at build, one organization's truth handed to another.
 *
 *     BUILD OUTPUT != RUNTIME SEMANTICS        TENANT A != TENANT B
 *
 * ── WHY THIS IS A BEHAVIOURAL PROOF AND NOT A TEXT SCAN ──────────────────────
 *
 * "The layout imports the resolver" proves nothing: an early return added above the call site would
 * satisfy every text scan and silently make the whole group prerenderable. So the resolver is
 * EXECUTED, twice, under the two environments that matter, and the assertions are about what it
 * actually did:
 *
 *   auth disabled    returns null and touches no request API   -> prerenderable, and carries no tenant
 *   auth configured  REACHES `cookies()`                       -> Next cannot prerender it at all
 *
 * The second is the invariant. `cookies()` outside a request scope throws by design, and that throw
 * is the evidence: it can only happen if the request-bound API was actually reached.
 *
 * No database, no network, no build.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import { resolveTenantContext } from "../../src/features/auth-runtime/request-session.server";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const DASHBOARD = "src/app/(dashboard)";
const LAYOUT = `${DASHBOARD}/layout.tsx`;
const RESOLVER = "src/features/auth-runtime/request-session.server.ts";

/** The five keys that make the environment `configured`. Throwaway values; nothing is persisted. */
const CONFIGURED = Object.freeze({
  HEBUN_AUTH_ENABLED: "true",
  HEBUN_AUTH_PROVIDER: "local",
  DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused_invariant_probe",
  HEBUN_AUTH_SESSION_DIGEST_CURRENT_VERSION: "1",
  HEBUN_AUTH_SESSION_DIGEST_SECRET: "rendering-invariant-probe-only-not-a-credential",
});

function withEnv<T>(env: Readonly<Record<string, string | undefined>>, body: () => T): T {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(env)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    return body();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

/* ── 1 · CONFIGURED, THE RESOLVER REACHES A REQUEST-BOUND API ─────────────── */
async function configuredAuthReachesTheRequest(): Promise<void> {
  const outcome = await withEnv(CONFIGURED, async () => {
    try {
      const resolved = await resolveTenantContext();
      return { reached: false as const, resolved };
    } catch (error) {
      return { reached: true as const, message: (error as Error).message };
    }
  });

  assert.equal(
    outcome.reached,
    true,
    "with authentication configured the resolver MUST reach a request-bound API. It returned " +
      `instead (${JSON.stringify(outcome.reached === false ? outcome.resolved : null)}), which is ` +
      "the shape that lets Next.js prerender an authenticated route into reusable static HTML.",
  );
  if (outcome.reached !== true) throw new Error("unreachable");
  assert.match(
    outcome.message,
    /cookies/i,
    `and the API it reached is the request cookie store — got "${outcome.message}"`,
  );
  assert.match(
    outcome.message,
    /outside a request scope|request scope/i,
    "which is request-bound by definition, so a prerender cannot complete through it",
  );
}

/* ── 2 · DISABLED, IT RETURNS WITHOUT TOUCHING THE REQUEST ────────────────── */
async function disabledAuthIsTenantFree(): Promise<void> {
  const resolved = await withEnv({ HEBUN_AUTH_ENABLED: undefined }, () => resolveTenantContext());
  assert.equal(
    resolved,
    null,
    "with authentication disabled the resolver answers null — the pre-auth mode, which is why a " +
      "local build reports these routes as static and why that artifact holds no tenant fact",
  );
}

/* ── 3 · NO `(dashboard)` FILE OPTS BACK INTO REUSABLE OUTPUT ─────────────── */
function nothingForcesStaticOrRevalidation(): void {
  const files = walk(DASHBOARD);
  assert.ok(files.length > 50, `the dashboard group was actually walked (${files.length} files)`);
  for (const file of files) {
    const source = read(file);
    assert.ok(
      !/export\s+const\s+dynamic\s*=\s*["']force-static["']/.test(source),
      `${file}: force-static would make this route reusable across tenants`,
    );
    assert.ok(
      !/export\s+const\s+revalidate\s*=/.test(source),
      `${file}: a revalidate window would cache one tenant's render for the next reader`,
    );
    assert.ok(
      !/export\s+const\s+dynamicParams\s*=\s*false/.test(source),
      `${file}: closing dynamicParams would freeze this segment's output`,
    );
  }
}

/* ── 4 · THE GATE IS THE GROUP LAYOUT, SO IT COVERS EVERY ROUTE ───────────── */
function oneGateCoversTheWholeGroup(): void {
  const layout = read(LAYOUT);
  assert.match(
    layout,
    /getAuthEnvironment\(\)/,
    "the group layout reads the environment gate",
  );
  assert.match(
    layout,
    /env\.status === "configured"[\s\S]{0,160}resolveRequestAuthentication\(env\)/,
    "and on the configured branch it resolves the request — that call is what makes the whole " +
      "group dynamic in ONE decision rather than route by route",
  );
  assert.match(layout, /redirect\("\/login"\)/, "an unauthorized request is redirected, not rendered");

  /* The resolver's request-bound read is the cookie store, taken from Next's own request API. */
  const resolver = read(RESOLVER);
  assert.match(
    resolver,
    /import \{ cookies \} from "next\/headers"/,
    "the request-bound primitive is Next's own cookie store",
  );
  assert.match(
    resolver,
    /async function readSessionReference\(\)[\s\S]{0,200}await cookies\(\)/,
    "and the session reference is read through it",
  );

  /*
   * EVERY TENANT-RESOLVING PAGE IS INSIDE THE GROUP. A route that resolved a tenant from outside
   * `(dashboard)` would not be covered by the gate above and would be prerenderable on its own.
   */
  const outside = walk("src/app")
    .filter((f) => f.endsWith("page.tsx"))
    .filter((f) => !f.startsWith(DASHBOARD))
    .filter((f) => /resolveTenantContext\(/.test(read(f)))
    .filter((f) => !/export const dynamic = "force-dynamic"/.test(read(f)));
  assert.deepEqual(
    outside,
    [],
    "every page that resolves a tenant is either inside the gated group or declares itself dynamic",
  );
}

async function main(): Promise<void> {
  await configuredAuthReachesTheRequest();
  await disabledAuthIsTenantFree();
  nothingForcesStaticOrRevalidation();
  oneGateCoversTheWholeGroup();
  console.log("live-map-experience — rendering invariant holds");
}

void main();
