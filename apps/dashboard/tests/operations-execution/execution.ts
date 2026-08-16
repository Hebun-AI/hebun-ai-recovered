import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getExecutionSurfaceModel } from "../../src/features/operations-execution";
import { INVOKABLE_SIDE_EFFECTS } from "../../src/features/heby-runtime";

/*
 * Execution surface honesty (Hebun UI Phase 22B).
 *
 * The Execution surface tells execution truth: nothing has run, only READ_ONLY is invokable,
 * every mutation/device action is non-executable, and there is no fabricated run/receipt and
 * no invented "AUTHORIZED" state. Capability facts come from the real Phase 17/18 contracts.
 */

function activityAndReceiptsHonestlyEmpty(): void {
  const model = getExecutionSurfaceModel();
  assert.equal(model.activity.present, false, "no execution activity is fabricated");
  assert.equal(model.receipts.present, false, "no receipt is fabricated");
  assert.ok(/no execution/i.test(model.state.headline + model.state.detail), "execution state is honestly not-connected");
}

function capabilitiesFromRealContracts(): void {
  const model = getExecutionSurfaceModel();
  const byClass = (c: string) => model.capabilities.find((r) => r.sideEffect === c);

  const readOnly = byClass("READ_ONLY");
  assert.equal(readOnly?.status, "available", "READ_ONLY is the only available class");
  assert.equal(readOnly?.substrateConnected, true, "READ_ONLY has a connected substrate");

  for (const cls of ["REVERSIBLE_MUTATION", "CONSEQUENTIAL_MUTATION", "DEVICE_ACTION"]) {
    const row = byClass(cls);
    assert.ok(row, `${cls} row present`);
    /*
     * THE CLAIM THAT MATTERS IS UNCHANGED: no mutation or device class is ever `available`, i.e.
     * freely invokable. R3B connected a substrate for one CONSEQUENTIAL_MUTATION tool, and that
     * tool is still reachable only through an approved permit and an explicit human Execute —
     * which is exactly why `available` stays false for the class.
     */
    assert.notEqual(row!.status, "available", `${cls} is never available`);
    if (cls !== "CONSEQUENTIAL_MUTATION") {
      assert.equal(row!.substrateConnected, false, `${cls} has no connected substrate`);
    }
  }

  // Only READ_ONLY is in the real invokable set.
  assert.deepEqual([...INVOKABLE_SIDE_EFFECTS], ["READ_ONLY"], "INVOKABLE_SIDE_EFFECTS is READ_ONLY only");
}

function deviceAndComputerUseHonest(): void {
  const model = getExecutionSurfaceModel();
  assert.ok(model.deviceCapabilities.length > 0, "device capabilities sourced from Phase 18");
  const terminal = model.deviceCapabilities.find((d) => d.capability === "TERMINAL_COMMAND");
  assert.ok(terminal, "terminal capability is listed");
  assert.equal(terminal!.state, "restricted", "terminal command is restricted, not available");
  assert.ok(!model.deviceCapabilities.some((d) => d.state === "available"), "no device capability is available");
  assert.equal(model.computerUse.status, "simulation-only", "Computer Use is simulation-only");
}

function noInventedAuthorizedState(): void {
  const model = getExecutionSurfaceModel();
  const stages = model.authorityChain.map((s) => s.stage.toLowerCase());
  assert.ok(!stages.includes("authorized"), "no invented 'Authorized' runtime state");
  assert.ok(model.authorityChain.every((s) => s.sideEffectOccurred === false), "no stage has caused a side effect");
  assert.ok(stages.some((s) => s.includes("human review")), "human review is an explicit stage");
}

function pageIsMockFree(): void {
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "director", "execution-center", "page.tsx"), "utf8");
  const imports = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!imports.some((t) => t.includes("execution/mock")), "Execution page imports no execution/mock");
  assert.ok(imports.some((t) => t.includes("operations-execution")), "Execution page renders the truth surface");
}

function componentHasNoExecutionControls(): void {
  const component = readFileSync(join(process.cwd(), "src", "components", "operations-execution", "execution-surface.tsx"), "utf8");
  for (const banned of ["<button", "onClick", "Approve", "Reject", "Retry", "Kill", "Restart", "Run action", "Execute("]) {
    assert.ok(!component.includes(banned), `Execution surface exposes no execution control (${banned})`);
  }
}

function featureFilesAreReadOnly(): void {
  const dir = join(process.cwd(), "src", "features", "operations-execution");
  const allowed = new Set([
    "@/features/heby-actions",
    "@/features/heby-runtime",
    "@/features/device-runtime",
  ]);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(dir, file), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const banned of ["execution/mock", "child_process", "exec(", "spawn(", "storeApprovedMemory", "createRelationship"]) {
      assert.ok(!code.includes(banned), `${file} has no forbidden coupling (${banned})`);
    }
    for (const target of [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])) {
      if (target.startsWith("@/features/")) {
        assert.ok(allowed.has(target) || target.startsWith("@/features/operations-execution"), `${file} imports only allowed features (${target})`);
      }
    }
  }
}

function main(): void {
  activityAndReceiptsHonestlyEmpty();
  capabilitiesFromRealContracts();
  deviceAndComputerUseHonest();
  noInventedAuthorizedState();
  pageIsMockFree();
  componentHasNoExecutionControls();
  featureFilesAreReadOnly();
  console.log("operations-execution honesty checks passed");
}

main();
