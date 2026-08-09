import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getRuntimeSignalsModel } from "../../src/features/operations-runtime-signals";

/*
 * Runtime & Signals honesty (Hebun UI Phase 22C).
 *
 * Real observation sources with honest connection states; honest empty surfaced-signals feed;
 * no fabricated signal/alert/incident/event; signal ≠ alert ≠ incident ≠ failure explicit.
 */

const CONNECTION_STATES = new Set(["connected", "derived", "empty", "partial", "unavailable", "not-connected"]);

function sourcesAreHonest(): void {
  const model = getRuntimeSignalsModel();
  assert.ok(model.sources.length >= 3, "real observation sources are listed");
  for (const source of model.sources) {
    assert.ok(CONNECTION_STATES.has(source.connection), `${source.source} has an honest connection state`);
    assert.ok(source.backing.length > 0 && source.limitations.length > 0, `${source.source} states its backing and limitations`);
    assert.ok(!/\d+\s*%/.test(source.limitations), `${source.source} states no fabricated percentage`);
  }
  assert.equal(model.observation.state, "connected", "runtime self-observation is honestly connected");
}

function signalsHonestlyEmpty(): void {
  const model = getRuntimeSignalsModel();
  assert.equal(model.surfacedSignals.present, false, "no fabricated signals are surfaced");
  assert.ok(/no runtime signals/i.test(model.surfacedSignals.note), "empty state is explicit");
  assert.ok(model.provenanceNote.length > 0, "provenance semantics are stated");
}

function monitoringBoundaryExplicit(): void {
  const model = getRuntimeSignalsModel();
  const pairs = model.monitoringBoundary.map((d) => `${d.left}->${d.right}`);
  assert.ok(pairs.includes("Signal->Alert"), "signal ≠ alert");
  assert.ok(pairs.includes("Alert->Incident"), "alert ≠ incident");
  assert.ok(model.monitoringBoundary.some((d) => /Absence/i.test(d.left)), "absence of signal ≠ healthy");
}

function surfaceHasNoControls(): void {
  const component = readFileSync(join(process.cwd(), "src", "components", "operations-runtime-signals", "runtime-signals-surface.tsx"), "utf8");
  for (const banned of ["<button", "onClick", "Acknowledge", "Resolve", "Restart", "Retry", "Kill", "Execute"]) {
    assert.ok(!component.includes(banned), `Runtime & Signals exposes no control (${banned})`);
  }
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "director", "runtime-signals", "page.tsx"), "utf8");
  const imports = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!imports.some((t) => t.includes("/mock")), "Runtime & Signals imports no mock");
  assert.ok(imports.some((t) => t.includes("runtime-signals-surface")), "page renders the surface");
}

function main(): void {
  sourcesAreHonest();
  signalsHonestlyEmpty();
  monitoringBoundaryExplicit();
  surfaceHasNoControls();
  console.log("operations-runtime-signals honesty checks passed");
}

main();
