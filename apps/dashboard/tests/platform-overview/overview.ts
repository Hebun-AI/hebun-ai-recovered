import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPlatformOverviewModel } from "../../src/features/platform-overview";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { staticRoutes, placeholderPaths } from "../../src/config/sidebar.config";

/*
 * Platform Overview honesty (Hebun UI Phase 24B).
 *
 * Contract-only availability/authority map over the deterministic offline provider substrate. No
 * fabricated aggregate Platform health/uptime/latency/availability %, no connection, no mutation. The
 * provider execution ladder proves nothing past REGISTERED. Platform does not own execution (Operations
 * does). Heby is advisory. Authoritative routes are not shadowed by the catch-all placeholder.
 */

const HONEST_STATES = new Set([
  "contract-only",
  "offline",
  "simulation",
  "not-connected",
  "in-memory",
  "advisory",
  "external-authority",
]);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

function modelIsHonest(): void {
  const model = getPlatformOverviewModel();
  assert.equal(model.state.provenance, "contract-only", "Platform is labelled contract-only");
  assert.ok(model.availability.length >= 6, "the substrate availability map is shown");
  for (const area of model.availability) {
    assert.ok(HONEST_STATES.has(area.state), `${area.area} uses an honest state (${area.state})`);
    assert.ok(area.authorityOwner.length > 0, `${area.area} names an authority owner`);
    assert.ok(!/\d+\s*%/.test(area.detail), `${area.area} states no fabricated percentage`);
  }
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage anywhere");
  for (const banned of ["overallHealth", "uptime", "latencyMs", "availability%"]) {
    assert.ok(!json.includes(banned), `no fabricated ${banned}`);
  }
}

function executionLadderProvesNothingLive(): void {
  const model = getPlatformOverviewModel();
  const byStage = (s: string) => model.executionBoundary.find((x) => x.stage === s);
  assert.equal(byStage("REGISTERED")?.reached, true, "providers are registered");
  for (const stage of ["CONFIGURED", "CONNECTED", "INVOKABLE", "AUTHORIZED", "EXECUTED", "SUCCESSFUL"]) {
    assert.equal(byStage(stage)?.reached, false, `${stage} is not reached`);
  }
}

function platformDoesNotOwnExecution(): void {
  const model = getPlatformOverviewModel();
  const exec = model.authorityBoundaries.find((b) => /execution/i.test(b.concept));
  assert.equal(exec?.owner, "Operations", "execution authority is owned by Operations, not Platform");
  const execArea = model.availability.find((a) => /execution/i.test(a.area));
  assert.equal(execArea?.authorityOwner, "Operations", "the execution area is owned by Operations");
  const providerConfig = model.authorityBoundaries.find((b) => /provider|model|tool/i.test(b.concept));
  assert.equal(providerConfig?.owner, "Platform", "Platform owns provider/model/tool configuration");
}

function hebyIsAdvisory(): void {
  const model = getPlatformOverviewModel();
  assert.equal(model.heby.state, "contract-only", "Heby is contract-only");
  const mayNot = model.heby.mayNot.join(" ").toLowerCase();
  for (const forbidden of ["invoke", "credential", "connect", "computer use", "enable"]) {
    assert.ok(mayNot.includes(forbidden), `Heby may-not covers ${forbidden}`);
  }
}

function pageAndComponentAreCleanReadOnly(): void {
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "platform", "page.tsx"), "utf8");
  const imports = importsOf(page);
  assert.ok(imports.some((t) => t.includes("platform-overview")), "the page renders the truth surface");
  assert.ok(!imports.some((t) => t.endsWith("/mock") || t.includes("/mock")), "the page imports no mock");
  const component = readFileSync(join(process.cwd(), "src", "components", "platform-overview", "platform-overview.tsx"), "utf8");
  const code = stripComments(component);
  // Structural proof of read-only + no secret field. (Navigation <Link>s are allowed; bare verb
  // substrings are avoided because they collide with legitimate state nouns.)
  for (const banned of ["<button", "onClick", "onSubmit", "<input", "<form", "<select", "<textarea", "API key", "api-key", "apiKey", "password", "Test connection"]) {
    assert.ok(!code.includes(banned), `Overview exposes no control (${banned})`);
  }
}

function navAndRoutesIntact(): void {
  assert.equal(WORKSPACES.length, 7, "seven workspaces preserved");
  const platform = getWorkspace("platform");
  const labels = platform.destinations.map((d) => d.label);
  assert.equal(labels[0], "Overview", "Overview is the first Platform L2");
  assert.equal(labels[1], "Providers & Models", "Providers & Models is the second Platform L2");
  assert.ok(!labels.includes("Providers & Runtime"), "the legacy 'Providers & Runtime' label is retired");
  const shadowed = placeholderPaths();
  for (const route of ["/platform", "/director/provider-matrix"]) {
    assert.ok(!shadowed.includes(route), `${route} is not a catch-all placeholder`);
    assert.equal(resolveActiveWorkspace(route), "platform", `${route} resolves to Platform`);
  }
  assert.ok(staticRoutes.has("/director/provider-matrix"), "provider-matrix registered in staticRoutes");
}

function main(): void {
  modelIsHonest();
  executionLadderProvesNothingLive();
  platformDoesNotOwnExecution();
  hebyIsAdvisory();
  pageAndComponentAreCleanReadOnly();
  navAndRoutesIntact();
  console.log("platform-overview honesty checks passed");
}

main();
