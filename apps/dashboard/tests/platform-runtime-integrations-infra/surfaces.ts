import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getProviderRuntimeModel } from "../../src/features/platform-runtime";
import { getIntegrationsModel } from "../../src/features/platform-integrations";
import { getInfrastructureModel } from "../../src/features/platform-infrastructure";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { staticRoutes, placeholderPaths } from "../../src/config/sidebar.config";
import { connectedFixture } from "../helpers/integration-connection-fixtures";

/*
 * Provider Runtime + Integrations + Infrastructure & Settings honesty (Hebun UI Phase 24C).
 *
 * Real offline substrate, told honestly: routing without dispatch, invocation without invoking, no
 * connected integration, in-memory persistence, a strict secrets boundary. No fabricated invocation
 * health/activity, no fake integration connection/sync, no fake infrastructure health, no mutation or
 * secret control. Platform does not duplicate Operations execution. Final Platform IA = five surfaces.
 */

const APP = (p: string) => join(process.cwd(), "src", "app", "(dashboard)", ...p.split("/"));
const SRC = (...p: string[]) => join(process.cwd(), "src", ...p);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

function providerRuntimeIsHonest(): void {
  const model = getProviderRuntimeModel();
  assert.equal(model.state.provenance, "offline-contract", "provider runtime labelled offline/contract");
  assert.ok(model.stages.length >= 6, "runtime stages surfaced");
  assert.ok(model.pipeline.length >= 1, "the real invocation pipeline is surfaced");
  assert.equal(model.liveEligibility.liveEligible, false, "no provider is live-eligible");
  assert.notEqual(model.liveEligibility.mode, "Live Eligible", "runtime does not claim Live Eligible");
  assert.equal(model.activity.realInvocations, 0, "no real invocation activity is fabricated");
  const byStage = (s: string) => model.executionBoundary.find((x) => x.stage === s);
  for (const stage of ["CONNECTED", "INVOKED", "EXECUTED", "SUCCESSFUL"]) {
    assert.equal(byStage(stage)?.reached, false, `${stage} is not reached`);
  }
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage");
  for (const banned of ["invocationHealth", "latencyMs", "tokenUsage", "estimatedCost", "successRate"]) {
    assert.ok(!json.includes(banned), `no fabricated ${banned}`);
  }
}

/*
 * ── PIN AMENDED IN INT-3.1, AND WHY IT IS NOT A WEAKENING ───────────────────
 *
 * This pin used to read `provenance === "not-connected"` and `connected.length === 0`. Both were
 * true when written — no connection authority existed — and both became FALSE CLAIMS the moment a
 * tenant completed a real Google authorization. A pin that asserts a false product statement does
 * not protect anything; it defends the defect.
 *
 * What the pin was FOR was "this surface never fabricates a connection". That property is kept and
 * made stronger: the model is now driven by an injected authority listing, so the test can prove
 * the surface tracks the authority IN BOTH DIRECTIONS — nothing connected renders nothing, and a
 * connected row renders exactly that row. The old assertion could only ever prove one direction,
 * and only while the answer was hard-coded.
 */
function integrationsAreHonest(): void {
  const EMPTY = { status: "read", connections: [] } as const;

  const empty = getIntegrationsModel(EMPTY);
  assert.equal(empty.state.provenance, "integration-authority", "connection truth names its source");
  assert.equal(empty.state.connectedCount, 0, "nothing is fabricated as connected");
  assert.equal(empty.connected.length, 0, "empty authority listing renders no connection");
  assert.ok(/no integration connected/i.test(empty.state.headline), "empty listing says so plainly");
  assert.ok(empty.candidates.length >= 1, "integration-capable descriptors are shown");
  for (const c of empty.candidates) {
    assert.ok(!/^connected$/i.test(c.connectionState), `${c.name} is not shown as connected`);
  }

  // The headline is DERIVED from the count, so it cannot disagree with the list beside it.
  const one = getIntegrationsModel({
    status: "read",
    connections: [connectedFixture()],
  });
  assert.equal(one.state.connectedCount, 1, "a connected authority row is counted");
  assert.equal(one.connected.length, 1, "a connected authority row is rendered");
  assert.ok(!/no integration connected/i.test(one.state.headline), "the false claim cannot survive a connection");

  for (const model of [empty, one]) {
    const json = JSON.stringify(model);
    assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage");
    for (const banned of ["lastSync", "eventsToday", "3m ago", "just now"]) {
      assert.ok(!json.includes(banned), `no fabricated integration activity (${banned})`);
    }
  }
}

function infrastructureIsHonest(): void {
  const model = getInfrastructureModel();
  assert.equal(model.state.provenance, "in-memory", "infrastructure labelled in-memory");
  assert.ok(model.areas.length >= 6, "infrastructure areas surfaced");
  assert.equal(typeof model.adapterRegistryCount, "number", "adapter registry count is a real number");
  const persistence = model.areas.find((a) => a.area === "Persistence");
  assert.equal(persistence?.state, "in-memory", "persistence is honestly in-memory");
  const auth = model.areas.find((a) => a.area === "Authentication");
  assert.equal(auth?.state, "external-authority", "authentication authority is external to Platform");
  assert.ok(/never/i.test(model.secretsBoundary), "secrets boundary states values are never displayed");
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage");
  // No fabricated infrastructure metric VALUE (a number with a unit, or a concrete region/deployment
  // value). Honest prose that names what is NOT fabricated — e.g. "no live health, region, or
  // deployment status exists" — is allowed; a fabricated value is not.
  assert.ok(!/\b\d+(\.\d+)?\s*(ms|gb|mb|kb|cores?|%|rps|qps)\b/i.test(json), "no fabricated infrastructure metric value");
  assert.ok(!/\bus-(east|west|central)-\d|"region"\s*:\s*"[a-z]/i.test(json), "no fabricated region value");
}

function pagesAreCleanAndMockFree(): void {
  const checks: ReadonlyArray<{ page: string; surface: string; banned: readonly string[] }> = [
    { page: "director/provider-invocation/page.tsx", surface: "platform-runtime", banned: ["invocationMetrics", "invocationHealth", "InvocationPanel"] },
    { page: "integrations/page.tsx", surface: "platform-integrations", banned: ["features/integrations/mock", "IntegrationManageButton", "CommandAction", "Add Integration"] },
    { page: "settings/page.tsx", surface: "platform-infrastructure", banned: ["API Keys", "Supabase", "configured"] },
  ];
  for (const c of checks) {
    const page = readFileSync(APP(c.page), "utf8");
    assert.ok(importsOf(page).some((t) => t.includes(c.surface)), `${c.page} renders its truth surface`);
    assert.ok(!importsOf(page).some((t) => t.endsWith("/mock")), `${c.page} imports no mock`);
    // Scan the code, not the explanatory comment (which legitimately quotes the removed fabrication).
    const code = stripComments(page);
    for (const banned of c.banned) {
      assert.ok(!code.includes(banned), `${c.page} drops fabricated/control content (${banned})`);
    }
  }
}

function componentsAreReadOnly(): void {
  const components = [
    ["platform-runtime", "provider-runtime-surface.tsx"],
    ["platform-integrations", "integrations-surface.tsx"],
    ["platform-infrastructure", "infrastructure-settings-surface.tsx"],
  ];
  for (const [dir, file] of components) {
    const code = stripComments(readFileSync(SRC("components", dir, file), "utf8"));
    // Structural proof of read-only + no secret field. Honest disclaimer prose that names absent
    // controls ("no connect, OAuth, or secret control") is allowed; an actual control is not.
    for (const banned of ["<button", "onClick", "onSubmit", "<input", "<form", "<select", "<textarea", 'type="password"', "contentEditable"]) {
      assert.ok(!code.includes(banned), `${dir}/${file} exposes no interactive control or secret field (${banned})`);
    }
  }
}

function featuresReadRealSeamsOnly(): void {
  const allowed: Record<string, readonly string[]> = {
    "platform-runtime": ["@/features/provider-invocation", "@/features/providers/claude-live", "@/features/platform-runtime"],
    /*
     * INT-3.1 adds the two seams a truthful connection surface must read: the connection
     * authority (what is connected) and the provider-catalog definition authority (its label and
     * its capabilities). `@/features/integration-credentials` is NOT here and must never be — a
     * dedicated INT-3.1 test asserts its absence rather than relying on this list staying short.
     */
    "platform-integrations": [
      "@/features/provider-matrix",
      "@/features/platform-integrations",
      "@/features/integration-authority",
      "@/features/provider-catalog",
    ],
    "platform-infrastructure": ["@/features/adapters", "@/features/platform-infrastructure"],
  };
  for (const [dir, prefixes] of Object.entries(allowed)) {
    const base = SRC("features", dir);
    for (const file of readdirSync(base).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(join(base, file), "utf8");
      for (const target of importsOf(source)) {
        if (target.startsWith("@/features/")) {
          assert.ok(prefixes.some((p) => target.startsWith(p)), `${dir}/${file} reads only real seams (${target})`);
        }
        assert.ok(!/\/mock(\b|"|\/)/.test(target), `${dir}/${file} imports no mock (${target})`);
      }
    }
  }
}

function finalPlatformIa(): void {
  assert.equal(WORKSPACES.length, 7, "seven workspaces preserved");
  const platform = getWorkspace("platform");
  assert.deepEqual(
    platform.destinations.map((d) => d.label),
    ["Overview", "Providers & Models", "Provider Runtime", "Integrations", "Infrastructure & Settings"],
    "final five authoritative Platform surfaces",
  );
  for (const absent of ["Providers & Runtime", "Models & Tools", "Architecture Map", "Authentication", "Infrastructure"]) {
    assert.ok(!platform.destinations.some((d) => d.label === absent), `no legacy "${absent}" L2 remains`);
  }
  const shadowed = placeholderPaths();
  for (const route of ["/director/provider-invocation", "/integrations", "/settings"]) {
    assert.ok(!shadowed.includes(route), `${route} is not a catch-all placeholder`);
    assert.ok(staticRoutes.has(route), `${route} registered in staticRoutes`);
    assert.equal(resolveActiveWorkspace(route), "platform", `${route} resolves to Platform`);
  }
}

function main(): void {
  providerRuntimeIsHonest();
  integrationsAreHonest();
  infrastructureIsHonest();
  pagesAreCleanAndMockFree();
  componentsAreReadOnly();
  featuresReadRealSeamsOnly();
  finalPlatformIa();
  console.log("platform runtime + integrations + infrastructure honesty checks passed");
}

main();
