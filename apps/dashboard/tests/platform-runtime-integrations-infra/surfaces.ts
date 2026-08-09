import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getProviderRuntimeModel } from "../../src/features/platform-runtime";
import { getIntegrationsModel } from "../../src/features/platform-integrations";
import { getInfrastructureModel } from "../../src/features/platform-infrastructure";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { staticRoutes, placeholderPaths } from "../../src/config/sidebar.config";

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

function integrationsAreHonest(): void {
  const model = getIntegrationsModel();
  assert.equal(model.state.provenance, "not-connected", "integrations labelled not-connected");
  assert.equal(model.connected.length, 0, "no integration is fabricated as connected");
  assert.ok(model.candidates.length >= 1, "integration-capable descriptors are shown");
  for (const c of model.candidates) {
    assert.ok(/not connected/i.test(c.connectionState), `${c.name} is not shown as connected`);
  }
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage");
  for (const banned of ["lastSync", "eventsToday", "3m ago", "just now"]) {
    assert.ok(!json.includes(banned), `no fabricated integration activity (${banned})`);
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
    "platform-integrations": ["@/features/provider-matrix", "@/features/platform-integrations"],
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
