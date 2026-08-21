import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { staticRoutes, placeholderPaths } from "../../src/config/sidebar.config";

/*
 * Operations legacy closure + navigation (Hebun UI Phase 22D).
 *
 * The legacy Operations detail routes are retired to permanent redirects; the dead execution
 * mock/component chain is removed; load-bearing mocks are retained; the authoritative Operations
 * L2 is the four honest surfaces; new routes are not shadowed; Phase 20/21 and the
 * seven-workspace IA are preserved.
 */

const APP = (p: string) => join(process.cwd(), "src", "app", "(dashboard)", ...p.split("/"));
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

const LEGACY_REDIRECTS: ReadonlyArray<{ page: string; target: string }> = [
  { page: "director/execution-center/timeline/page.tsx", target: "/director/execution-center" },
  { page: "director/execution-center/failures/page.tsx", target: "/director/execution-center" },
  { page: "workflows/page.tsx", target: "/operations" },
  { page: "director/orchestration/page.tsx", target: "/operations" },
  { page: "director/task-planning/page.tsx", target: "/operations" },
  { page: "events/page.tsx", target: "/operations" },
];

function legacyRoutesRedirectSafely(): void {
  for (const { page, target } of LEGACY_REDIRECTS) {
    const source = readFileSync(APP(page), "utf8");
    const code = stripComments(source);
    assert.ok(code.includes(`permanentRedirect("${target}")`), `${page} permanently redirects to ${target}`);
    assert.ok(importsOf(source).includes("next/navigation"), `${page} uses the framework redirect`);
    // No loop / no chain: the target is a distinct real route, never the page's own route.
    const ownRoute = "/" + page.replace(/\/page\.tsx$/, "");
    assert.notEqual(target, ownRoute, `${page} does not redirect to itself`);
    // No mock, no seeded component, no legacy-state left.
    for (const banned of ["execution/mock", "operations-legacy-state", "@/features/execution", "@/features/workflow-runtime", "@/features/orchestration"]) {
      assert.ok(!code.includes(banned), `${page} imports nothing legacy (${banned})`);
    }
  }
  // Redirect targets are real, non-redirecting pages (no chain).
  for (const target of ["/operations", "/director/execution-center"]) {
    const targetPage = readFileSync(APP(target.replace(/^\//, "") + "/page.tsx"), "utf8");
    assert.ok(!stripComments(targetPage).includes("permanentRedirect"), `${target} is a real page, not a redirect (no chain)`);
  }
}

function deadExecutionChainRemoved(): void {
  assert.ok(!existsSync(join(process.cwd(), "src", "features", "execution", "mock.ts")), "execution/mock is retired (dead)");
  assert.ok(!existsSync(join(process.cwd(), "src", "components", "execution")), "the dead execution component cluster is removed");
  assert.ok(!existsSync(join(process.cwd(), "src", "components", "dashboard", "execution-status-widget.tsx")), "the dead execution status widget is removed");
}

function loadBearingMocksRetained(): void {
  assert.ok(existsSync(join(process.cwd(), "src", "features", "agents", "mock.ts")), "agents/mock (load-bearing) retained");
  assert.ok(existsSync(join(process.cwd(), "src", "features", "runtime-projection")), "runtimeProjectionRegistry (load-bearing) retained");
}

function operationsAuthoritativeIa(): void {
  const ops = getWorkspace("operations");
  assert.deepEqual(ops.destinations.map((d) => d.label), ["Overview", "Execution", "Runtime & Signals", "Execution Substrate"], "authoritative Operations L2 (four surfaces)");
}

function newRoutesResolveAndAreNotShadowed(): void {
  const shadowed = placeholderPaths();
  for (const route of ["/operations", "/director/execution-center", "/director/runtime-signals", "/director/execution-substrate"]) {
    assert.ok(!shadowed.includes(route), `${route} is not generated as a placeholder`);
    assert.equal(resolveActiveWorkspace(route), "operations", `${route} resolves to Operations`);
  }
  for (const route of ["/director/runtime-signals", "/director/execution-substrate"]) {
    assert.ok(staticRoutes.has(route), `${route} registered in staticRoutes`);
  }
  // Legacy routes still resolve to Operations (they redirect within the workspace).
  for (const route of ["/workflows", "/events", "/director/orchestration", "/director/task-planning"]) {
    assert.equal(resolveActiveWorkspace(route), "operations", `${route} still resolves to Operations`);
  }
}

function phase20And21Preserved(): void {
  assert.equal(WORKSPACES.length, 7, "seven workspaces preserved");
  const command = getWorkspace("command");
  /*
   * CMD-B2 removed Strategic Goals from Command's canonical menu and kept its route. This check was
   * never about the menu — it asks whether the Operations phase disturbed Command's ownership — so
   * it now asks that directly, of the route.
   */
  assert.equal(resolveActiveWorkspace("/director/goals"), "command", "Command still owns /director/goals");
  assert.ok(command.destinations.some((d) => d.label === "Decisions" && d.href === "/approvals"), "Decisions → /approvals intact");
  const knowledge = getWorkspace("knowledge");
  assert.deepEqual(knowledge.destinations.map((d) => d.label), ["Overview", "Company Memory", "Knowledge Graph", "Registries"], "Phase 21 Knowledge intact");
  const gov = getWorkspace("governance");
  assert.ok(gov.destinations.some((d) => d.href === "/director/governance/security"), "Security Center preserved");
}

function main(): void {
  legacyRoutesRedirectSafely();
  deadExecutionChainRemoved();
  loadBearingMocksRetained();
  operationsAuthoritativeIa();
  newRoutesResolveAndAreNotShadowed();
  phase20And21Preserved();
  console.log("operations legacy closure + navigation checks passed");
}

main();
