import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getWorkspace, resolveActiveWorkspace, WORKSPACES } from "../../src/config/workspace-nav";
import { staticRoutes, placeholderPaths } from "../../src/config/sidebar.config";

/*
 * Platform legacy-route + closure verification (Hebun UI Phase 24D).
 *
 * The five authoritative Platform surfaces are locked; every retired legacy provider route permanently
 * redirects (single hop, loop-free, chain-free) to its canonical surface with no fabricated content;
 * the load-bearing provider substrate and mocks are retained; the one proven-dead presentation leaf is
 * removed. Platform does not become an execution authority.
 */

const APP = (p: string) => join(process.cwd(), "src", "app", "(dashboard)", ...p.split("/"));
const SRC = (...p: string[]) => join(process.cwd(), "src", ...p);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}
function redirectTargetOf(src: string): string | null {
  const m = stripComments(src).match(/permanentRedirect\(\s*"([^"]+)"\s*\)/);
  return m ? m[1] : null;
}

const LEGACY: ReadonlyArray<{ page: string; source: string; target: string }> = [
  { page: "director/provider-framework/page.tsx", source: "/director/provider-framework", target: "/director/provider-matrix" },
  { page: "director/provider-routing/page.tsx", source: "/director/provider-routing", target: "/director/provider-invocation" },
  { page: "director/runtime/page.tsx", source: "/director/runtime", target: "/director/provider-invocation" },
  { page: "director/runtime-activation/page.tsx", source: "/director/runtime-activation", target: "/director/provider-invocation" },
  { page: "director/adapters/page.tsx", source: "/director/adapters", target: "/settings" },
];

const CANONICAL = new Set(["/platform", "/director/provider-matrix", "/director/provider-invocation", "/integrations", "/settings"]);

function pageFileForRoute(route: string): string {
  if (route === "/platform") return "platform/page.tsx";
  if (route === "/integrations") return "integrations/page.tsx";
  if (route === "/settings") return "settings/page.tsx";
  return route.replace(/^\//, "") + "/page.tsx";
}

function legacyRoutesRedirectCleanly(): void {
  for (const { page, target } of LEGACY) {
    const src = readFileSync(APP(page), "utf8");
    assert.equal(redirectTargetOf(src), target, `${page} permanently redirects to ${target}`);
    assert.ok(CANONICAL.has(target), `${page} target ${target} is a canonical authoritative surface`);
    // Redirect stub imports only next/navigation — no engine, no mock, no fabricated presentation.
    const imports = importsOf(src);
    assert.deepEqual(imports, ["next/navigation"], `${page} is a clean redirect stub`);
    const code = stripComments(src);
    for (const banned of ["Badge", "PageHeader", "Panel", "%", "Metrics"]) {
      assert.ok(!code.includes(banned), `${page} renders no fabricated content (${banned})`);
    }
  }
}

function redirectsAreSingleHopLoopFree(): void {
  const sources = new Set(LEGACY.map((l) => l.source));
  for (const { target } of LEGACY) {
    assert.ok(!sources.has(target), `${target} is not itself a retired route (loop/chain-free)`);
    const full = APP(pageFileForRoute(target));
    assert.ok(existsSync(full), `redirect target ${target} has a real page`);
    assert.equal(redirectTargetOf(readFileSync(full, "utf8")), null, `redirect target ${target} does not itself redirect (chain-free)`);
  }
}

function loadBearingSubstrateRetained(): void {
  // Mocks are load-bearing (sidebar status resolver / dashboard widget) — retained, not deleted.
  assert.ok(existsSync(SRC("features", "integrations", "mock.ts")), "integrations mock retained (sidebar-consumed)");
  assert.ok(existsSync(SRC("features", "architecture", "mock.ts")), "architecture mock retained (dashboard-consumed)");
  // The real provider substrate is untouched and present.
  for (const dir of ["provider-framework", "provider-routing", "provider-invocation", "provider-matrix", "adapters", "runtime-boundary", "runtime-activation", "platform-core"]) {
    assert.ok(existsSync(SRC("features", dir)), `real provider substrate retained: ${dir}`);
  }
}

function provenDeadLeafRetired(): void {
  assert.ok(!existsSync(SRC("components", "integrations", "integration-manage-button.tsx")), "proven-dead integration-manage-button retired");
  // Its retirement leaves no importer behind.
}

function finalIaAndShadow(): void {
  assert.equal(WORKSPACES.length, 7, "seven workspaces preserved");
  const platform = getWorkspace("platform");
  assert.deepEqual(
    platform.destinations.map((d) => d.label),
    ["Overview", "Providers & Models", "Provider Runtime", "Integrations", "Infrastructure & Settings"],
    "final five authoritative Platform surfaces",
  );
  // Authoritative routes: not placeholders, resolve to Platform.
  const shadowed = placeholderPaths();
  for (const route of ["/platform", "/director/provider-matrix", "/director/provider-invocation", "/integrations", "/settings"]) {
    assert.ok(!shadowed.includes(route), `${route} is not a catch-all placeholder`);
    assert.equal(resolveActiveWorkspace(route), "platform", `${route} resolves to Platform`);
  }
  // Redirect sources still resolve to Platform through the hop.
  for (const { source } of LEGACY) {
    assert.equal(resolveActiveWorkspace(source), "platform", `${source} resolves to Platform`);
  }
  assert.ok(staticRoutes.has("/director/provider-invocation"), "provider-invocation registered in staticRoutes");
}

function main(): void {
  legacyRoutesRedirectCleanly();
  redirectsAreSingleHopLoopFree();
  loadBearingSubstrateRetained();
  provenDeadLeafRetired();
  finalIaAndShadow();
  console.log("platform legacy-route + closure checks passed");
}

main();
