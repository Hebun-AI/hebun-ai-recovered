import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getProvidersModel } from "../../src/features/platform-providers";

/*
 * Providers & Models honesty (Hebun UI Phase 24B).
 *
 * Reads the real offline provider catalog and the real claude-live eligibility engine. Surfaces only
 * proven facts; no fabricated per-provider health, conformance score, aggregate "Health %", or
 * token/cost/latency. No provider is shown as connected (liveSupport === false). `claude-live` does
 * not imply live execution. Computer Use is not live execution. No mutation/invocation/secret control.
 */

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

function providersAreOfflineDescriptors(): void {
  const model = getProvidersModel();
  assert.equal(model.state.provenance, "offline-simulation", "labelled offline/simulation");
  assert.equal(model.providers.length, 6, "the six registered providers are surfaced");
  for (const p of model.providers) {
    assert.equal(p.liveSupport, false, `${p.name} has no live support`);
    assert.ok(/not connected/i.test(p.connectionState), `${p.name} is not shown as connected`);
    // The view carries no fabricated health/score field.
    for (const banned of ["health", "conformance", "availability", "latency", "score"]) {
      assert.ok(!Object.keys(p).some((k) => k.toLowerCase().includes(banned)), `${p.name} carries no fabricated ${banned}`);
    }
  }
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage");
  for (const banned of ["overallHealth", "latencyMs", "uptime", "estimatedCost", "conformanceScore", "healthScore"]) {
    assert.ok(!json.includes(banned), `no fabricated ${banned}`);
  }
}

function claudeLiveIsProvenBlocked(): void {
  const model = getProvidersModel();
  assert.equal(model.futureLive.liveEligible, false, "claude-live is not live-eligible");
  assert.notEqual(model.futureLive.mode, "Live Eligible", "claude-live does not claim Live Eligible");
  assert.ok(model.futureLive.blockingReasons.length >= 1, "blocking reasons are shown from the real engine");
}

function computerUseIsNotLive(): void {
  const model = getProvidersModel();
  const cu = model.providers.find((p) => p.id === "computer-use");
  assert.ok(cu, "computer-use provider is present");
  assert.equal(cu!.liveSupport, false, "Computer Use is not live");
  assert.ok(/approval|simulation|read only/i.test(cu!.executionMode), `Computer Use execution mode is guarded (${cu!.executionMode})`);
}

function coverageIsStructural(): void {
  const model = getProvidersModel();
  assert.ok(model.capabilityCoverage.length >= 1, "capability coverage is shown");
  assert.equal(
    model.coverage.covered + model.coverage.partial + model.coverage.missing,
    model.coverage.total,
    "coverage counts are a consistent structural partition",
  );
}

function featureReadsRealSeamsOnly(): void {
  const base = join(process.cwd(), "src", "features", "platform-providers");
  for (const file of readdirSync(base).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(base, file), "utf8");
    for (const target of importsOf(source)) {
      if (target.startsWith("@/features/")) {
        const ok =
          target.startsWith("@/features/provider-matrix") ||
          target.startsWith("@/features/providers/claude-live") ||
          target.startsWith("@/features/platform-providers");
        assert.ok(ok, `${file} reads only the real provider seam (${target})`);
      }
      assert.ok(!/\/mock(\b|"|\/)/.test(target), `${file} imports no mock (${target})`);
    }
  }
}

function pageAndComponentAreCleanReadOnly(): void {
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "director", "provider-matrix", "page.tsx"), "utf8");
  const imports = importsOf(page);
  assert.ok(imports.some((t) => t.includes("platform-providers")), "the page renders the truth surface");
  assert.ok(!page.includes("providerMatrixMetrics"), "the page drops the fabricated provider health metric");
  assert.ok(!/Health\s*\{/.test(page), "the page drops the fabricated Health % badge");
  const component = readFileSync(join(process.cwd(), "src", "components", "platform-providers", "providers-models-surface.tsx"), "utf8");
  const code = stripComments(component);
  // Structural proof of read-only + no secret field. (Bare verb substrings like "Connect" are avoided
  // because they collide with legitimate state nouns such as the "Connection" column header.)
  for (const banned of ["<button", "onClick", "onSubmit", "<input", "<form", "<select", "<textarea", "API key", "api-key", "apiKey", "password", "secret", "Test connection", "Rotate key"]) {
    assert.ok(!code.includes(banned), `Providers surface exposes no control/secret UI (${banned})`);
  }
}

function main(): void {
  providersAreOfflineDescriptors();
  claudeLiveIsProvenBlocked();
  computerUseIsNotLive();
  coverageIsStructural();
  featureReadsRealSeamsOnly();
  pageAndComponentAreCleanReadOnly();
  console.log("platform providers & models honesty checks passed");
}

main();
