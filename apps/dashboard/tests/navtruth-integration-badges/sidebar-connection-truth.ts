/*
 * NAV-TRUTH — THE NAVIGATION MAY NOT STATE A CONNECTION.
 *
 * ── THE ONE SENTENCE THIS SUITE DEFENDS ─────────────────────────────────────
 *
 *   NO SIDEBAR SURFACE MAY PRESENT SEEDED, STALE OR NONEXISTENT PROVIDER STATE
 *   AS ORGANIZATIONAL TRUTH.
 *
 * Until this phase the Integrations section carried four entries — Gmail, GitHub, Supabase,
 * Vercel — each with a coloured status dot. The dots came from `features/integrations/mock.ts`, a
 * four-element fixture: Gmail `connected`, GitHub `pending`, Supabase `connected`, Vercel `error`.
 * None of the four had ever been connected, Hebun cannot connect any of them, and the destinations
 * resolved to the catch-all placeholder that says the module is not populated yet.
 *
 * ── WHY THE GUARD IS STRUCTURAL AND NOT A NAME LIST ─────────────────────────
 *
 * Banning the four vendor names would leave the mechanism intact — the badge variant, the
 * renderer, and the fixture — so the fifth false dot would pass review. This suite asserts the
 * MECHANISM is gone instead: there is no `status` badge in the union, no renderer for one, and no
 * module for a fixture to live in. A future false badge cannot be added without deleting an
 * assertion that says why it may not exist.
 *
 * ── WHY THE NAV MAY NOT SIMPLY READ THE REAL AUTHORITY ──────────────────────
 *
 * `sidebar.config.ts` is a static module literal, evaluated once and shared by every request of
 * every tenant. Connection truth is per-tenant and per-request — `/integrations` resolves a tenant,
 * reads `listConnections`, and runs `force-dynamic` for exactly that reason. So the fix is not
 * "point the badge at the authority": a build-time badge is either one organization's state shown
 * to all of them, or a cached copy of a state that has since changed. The nav gets no badge at all.
 *
 * It calls no provider, reads no credential and touches no database. It is a statement about this
 * repository, made entirely from this repository.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { sidebarConfig, staticRoutes } from "../../src/config/sidebar.config";

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
/** Comments are stripped before a source assertion, so honest prose can never satisfy a ban. */
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SIDEBAR = "src/config/sidebar.config.ts";
const SIDEBAR_ITEM = "src/components/layout/sidebar-item.tsx";
const TYPES = "src/types/index.ts";
const MOCK_DIR = "src/features/integrations";

function collect(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    return e.isDirectory() ? collect(rel) : /\.tsx?$/.test(e.name) ? [rel] : [];
  });
}

const everyItem = sidebarConfig.flatMap((s) => s.groups.flatMap((g) => g.items));

/* ── 1. THE SEEDED INTEGRATION FIXTURE NO LONGER EXISTS ─────────────────────── */
function theSeededIntegrationFixtureIsGone(): void {
  assert.ok(
    !existsSync(path.join(ROOT, MOCK_DIR)),
    `${MOCK_DIR} still exists — the seeded connection fixture must have no home to return to`,
  );

  /*
   * AND NOTHING IMPORTS IT. Asserted on import specifiers of comment-stripped source across the
   * whole of `src`, because a deleted module referenced by a surviving specifier is a build break
   * waiting to be committed — and because two released suites once referenced deleted files by
   * PATH STRING, which a symbol grep cannot see.
   */
  for (const file of collect("src")) {
    for (const m of codeOf(read(file)).matchAll(/from\s+"([^"]+)"/g)) {
      assert.ok(
        !m[1]!.includes("features/integrations/mock"),
        `${file} imports ${m[1]} — the seeded integration fixture was deleted`,
      );
    }
  }
}

/* ── 2. THE NAVIGATION CANNOT EXPRESS A CONNECTION STATUS ───────────────────── */
function theNavigationHasNoWayToStateAConnection(): void {
  /*
   * THE UNION MEMBER IS GONE. This is the load-bearing assertion: with no `status` variant, a
   * false badge is not merely absent, it is unrepresentable — `badge: { type: "status", ... }`
   * does not typecheck.
   */
  const sidebar = codeOf(read(SIDEBAR));
  /*
   * The declaration is captured to the first SEMICOLON THAT ENDS A LINE. A naive `indexOf(";")`
   * stops inside `{ type: "count"; value: number }` and silently examines a fragment — which is a
   * guard that reads only the first variant and calls it the whole union.
   */
  const union = /export type SidebarBadge =([\s\S]*?);\n/.exec(sidebar)?.[1] ?? "";
  assert.ok(union.length > 0, "the SidebarBadge union still exists");
  assert.ok(
    !/"status"/.test(union),
    "SidebarBadge declares a `status` variant — the navigation must not be able to state a connection",
  );
  assert.ok(/"count"/.test(union) && /"tag"/.test(union), "the surviving variants are unchanged");

  /* THE RENDERER IS GONE TOO. A union member with no renderer would be a half-removal. */
  const item = codeOf(read(SIDEBAR_ITEM));
  assert.ok(!/statusDot/.test(item), `${SIDEBAR_ITEM} still holds a connection-status colour map`);
  assert.ok(
    !/badge\?\.type\s*===\s*"status"/.test(item),
    `${SIDEBAR_ITEM} still renders a status badge`,
  );

  /* AND NO CONFIGURED ITEM CARRIES ONE — checked against the real exported value, not the source. */
  for (const it of everyItem) {
    assert.notEqual(
      (it.badge as { type?: string } | undefined)?.type,
      "status",
      `${it.href} carries a status badge`,
    );
  }
}

/* ── 3. THE FOUR FALSE DESTINATIONS ARE GONE, AND NOTHING REPLACED THEM ─────── */
function theFalseIntegrationDestinationsAreGone(): void {
  const integrationHrefs = everyItem.map((i) => i.href).filter((h) => h.startsWith("/integrations"));

  /*
   * `/integrations` SURVIVES. It is the honest surface: it resolves the tenant, reads the
   * connection authority per request, and reports what this organization is actually connected to —
   * including nothing.
   */
  assert.ok(
    integrationHrefs.includes("/integrations"),
    "the Integrations section must keep its authority-backed Overview",
  );

  /*
   * ── WHY THIS IS NOT `deepEqual(["/integrations"])` ────────────────────────
   *
   * It was, briefly, and that exact-list assertion made the rule below UNREACHABLE: any mutation
   * adding a false destination failed on the count first, so the real-page check could never fire
   * and could never be proved to bite. It was also wrong on its own terms — `/integrations/google`
   * is a real page, and listing it one day would be legitimate, yet the count would have refused it
   * while happily accepting a single placeholder entry.
   *
   * Counting destinations is not the rule. Requiring each one to be real is.
   */

  /*
   * ── THE REAL RULE, NOT A VENDOR BAN ───────────────────────────────────────
   *
   * A vendor name list would be satisfied by the fifth false entry. The rule is: every navigation
   * destination under `/integrations/` must be a REAL PAGE. The four removed entries resolved to
   * the catch-all placeholder, which says the module is not populated — while the badge beside
   * them said `connected`. That pairing is the defect, and this assertion makes it structural.
   */
  for (const href of integrationHrefs) {
    const route = path.join("src/app/(dashboard)", href.replace(/^\//, ""), "page.tsx");
    assert.ok(
      existsSync(path.join(ROOT, route)),
      `${href} is in the navigation but has no real page at ${route} — it would resolve to the ` +
        `placeholder, which cannot state anything about a provider`,
    );
    assert.ok(staticRoutes.has(href), `${href} has a real page and must be a static route`);
  }
}

/* ── 4. THE NAV READS NO CONNECTION AUTHORITY EITHER ────────────────────────── */
function theNavigationReadsNoConnectionTruthAtAll(): void {
  /*
   * REPOINTING THE BADGE AT THE REAL AUTHORITY WOULD BE THE NEXT MISTAKE, not the fix. This module
   * is evaluated once at build time and shared across every tenant and every request, so any
   * connection fact it held would be one organization's state served to all of them.
   *
   * The ban is on IMPORT SPECIFIERS of comment-stripped source: the comments in that file discuss
   * the authority at length, and discussion is not reachability.
   */
  const forbidden = [
    "integration-authority",
    "integration-credentials",
    "provider-catalog",
    "provider-github",
    "provider-google",
    "@/db",
  ];
  for (const m of codeOf(read(SIDEBAR)).matchAll(/from\s+"([^"]+)"/g)) {
    for (const f of forbidden) {
      assert.ok(
        !m[1]!.includes(f),
        `${SIDEBAR} imports ${m[1]} — static build-time navigation may not hold per-tenant ` +
          `connection truth, however real its source`,
      );
    }
  }
  /* Same for the item renderer: a client navigation component has no tenant and no request. */
  for (const m of codeOf(read(SIDEBAR_ITEM)).matchAll(/from\s+"([^"]+)"/g)) {
    for (const f of forbidden) {
      assert.ok(!m[1]!.includes(f), `${SIDEBAR_ITEM} imports ${m[1]}`);
    }
  }
}

/* ── 5. NO SECOND CONNECTION SHAPE SURVIVES IN THE SHARED TYPE BARREL ───────── */
function theSharedTypeBarrelHoldsNoConnectionShape(): void {
  /*
   * The deleted `Integration` interface modelled a connection — status, lastSync, scopes — with no
   * relation to the authority that owns one. Its only implementation was the fixture. A second,
   * simpler connection shape sitting in the shared barrel is how a surface ends up modelling a
   * connection without ever touching `IntegrationView`.
   */
  const types = codeOf(read(TYPES));
  assert.ok(
    !/interface\s+Integration\s*\{/.test(types),
    `${TYPES} still declares an \`Integration\` shape — connections are modelled by ` +
      `IntegrationView in the integration authority, and nowhere else`,
  );
  /*
   * `IntegrationStatus` SURVIVES ON PURPOSE and its survival is pinned, so a later sweep does not
   * delete display vocabulary that other domains legitimately use.
   */
  assert.ok(/type\s+IntegrationStatus\s*=/.test(types), "the display vocabulary is retained");
  assert.ok(
    /IntegrationStatus/.test(codeOf(read("src/components/ui/status-badge.tsx"))),
    "and it is retained because status-badge still needs it",
  );
}

function main(): void {
  theSeededIntegrationFixtureIsGone();
  theNavigationHasNoWayToStateAConnection();
  theFalseIntegrationDestinationsAreGone();
  theNavigationReadsNoConnectionTruthAtAll();
  theSharedTypeBarrelHoldsNoConnectionShape();
  console.log("navtruth-integration-badges/sidebar-connection-truth: all assertions passed");
}

main();
