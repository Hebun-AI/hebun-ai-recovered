import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSubstrateModel } from "../../src/features/operations-substrate";

/*
 * Execution Substrate honesty (Hebun UI Phase 22C).
 *
 * Real Phase 17/18 vocabulary; the dispatcher/device/receipt layers are honestly missing; no
 * invented "AUTHORIZED" state; terminal restricted; Computer Use simulation-only; and a clear
 * statement of what must become true to execute. No execution controls.
 */

function stackMarksMissingLayers(): void {
  const model = getSubstrateModel();
  const byLayer = (l: string) => model.layers.find((x) => x.layer.toLowerCase().includes(l));
  const dispatcher = byLayer("dispatcher");
  assert.ok(dispatcher, "the execution dispatcher layer is shown");
  assert.equal(dispatcher!.implemented, false, "the dispatcher layer is honestly missing");
  assert.equal(dispatcher!.state, "not-connected", "the dispatcher is not connected");
  assert.ok(model.layers.some((l) => l.implemented === false), "missing layers are marked, not faked as connected");
}

function noInventedAuthorizedState(): void {
  const model = getSubstrateModel();
  const labels = [
    ...model.layers.map((l) => l.layer.toLowerCase()),
    ...model.gates.map((g) => g.gate.toLowerCase()),
  ];
  assert.ok(!labels.includes("authorized"), "no invented 'Authorized' layer/gate");
  // Human authority is represented as a gate, not a runtime state.
  assert.ok(model.gates.some((g) => g.status === "requires-human-review"), "authority requires human review");
  assert.ok(model.gates.some((g) => g.gate === "Governance" && g.status === "not-connected"), "governance is not-connected");
}

function terminalAndComputerUseRestricted(): void {
  const model = getSubstrateModel();
  assert.equal(model.terminal.capability, "TERMINAL_COMMAND", "terminal capability sourced from Phase 18");
  assert.equal(model.terminal.state, "restricted", "terminal is restricted, not available");
  assert.equal(model.computerUse.status, "simulation-only", "Computer Use is simulation-only");
  assert.ok(model.requiredToExecute.length >= 3, "states what must become true to execute");
  assert.ok(/no live execution/i.test(model.receiptBoundary), "no receipt is fabricated");
}

function surfaceHasNoExecutionControls(): void {
  const component = readFileSync(join(process.cwd(), "src", "components", "operations-substrate", "execution-substrate-surface.tsx"), "utf8");
  for (const banned of ["<button", "onClick", "<input", "<textarea", "Run(", "Execute(", "Open Terminal", "terminal-emulator"]) {
    assert.ok(!component.includes(banned), `Execution Substrate exposes no execution control (${banned})`);
  }
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "director", "execution-substrate", "page.tsx"), "utf8");
  const imports = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!imports.some((t) => t.includes("/mock")), "Execution Substrate imports no mock");
  assert.ok(imports.some((t) => t.includes("execution-substrate-surface")), "page renders the surface");
}

function featureReadsOnlyProtectedContracts(): void {
  const dir = join(process.cwd(), "src", "features", "operations-substrate");
  const allowed = new Set(["@/features/heby-actions", "@/features/heby-runtime", "@/features/device-runtime"]);
  for (const file of ["model.ts", "contracts.ts", "index.ts"]) {
    const source = readFileSync(join(dir, file), "utf8");
    const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
    for (const banned of ["child_process", "exec(", "spawn(", "execution/mock"]) {
      assert.ok(!code.includes(banned), `${file} has no forbidden coupling (${banned})`);
    }
    for (const target of [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])) {
      if (target.startsWith("@/features/")) {
        assert.ok(allowed.has(target) || target.startsWith("@/features/operations-substrate"), `${file} imports only allowed features (${target})`);
      }
    }
  }
}

function main(): void {
  stackMarksMissingLayers();
  noInventedAuthorizedState();
  terminalAndComputerUseRestricted();
  surfaceHasNoExecutionControls();
  featureReadsOnlyProtectedContracts();
  console.log("operations-substrate honesty checks passed");
}

main();
