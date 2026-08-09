import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getOperationsOverviewModel } from "../../src/features/operations-overview";
import { listActionTools, invokableActionTools } from "../../src/features/heby-actions";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";

/*
 * Operations Overview honesty (Hebun UI Phase 22B).
 *
 * The Overview states operational truth: honest availability states, a real execution
 * boundary (counts from the Phase 17 registry), and no fabricated health / uptime / run /
 * queue / incident / agent / workflow metric, and no execution controls.
 */

const HONEST_STATUSES = new Set([
  "connected",
  "derived",
  "empty",
  "seeded",
  "simulated",
  "not-connected",
  "restricted",
  "in-memory",
]);

function availabilityIsHonest(): void {
  const model = getOperationsOverviewModel();
  assert.ok(model.availability.length >= 6, "Overview shows the operational availability map");
  for (const area of model.availability) {
    assert.ok(HONEST_STATUSES.has(area.status), `${area.area} uses an honest status (${area.status})`);
    assert.ok(area.question.length > 0 && area.detail.length > 0, `${area.area} explains itself`);
    assert.ok(!/\d+\s*%/.test(area.detail), `${area.area} states no fabricated percentage`);
    assert.ok(!/\b\d+\s+(runs?|executions?|tasks?|workflows?|incidents?|agents?|events?)\b/i.test(area.detail), `${area.area} states no fabricated count`);
  }
  // Execution is honestly not-connected; Computer Use honestly simulated.
  const byArea = (a: string) => model.availability.find((x) => x.area === a);
  assert.equal(byArea("Execution records")?.status, "not-connected");
  assert.equal(byArea("Computer Use")?.status, "simulated");
  assert.equal(byArea("Device runtime")?.status, "not-connected");
}

function executionBoundaryIsReal(): void {
  const model = getOperationsOverviewModel();
  const boundary = model.executionBoundary;
  assert.equal(boundary.declared, listActionTools().length, "declared count is the real registry size");
  assert.equal(boundary.invokable, invokableActionTools().length, "invokable count is the real READ_ONLY-connected set");
  assert.ok(boundary.invokable >= 1, "at least one READ_ONLY action is invokable");
  assert.ok(boundary.invokable < boundary.declared, "not everything is invokable — mutations are non-executable");
  assert.equal(boundary.nonExecutable, boundary.declared - boundary.invokable, "non-executable is the honest remainder");
}

function noFabricatedAggregateOrControls(): void {
  const model = getOperationsOverviewModel();
  // No aggregate health/score/uptime field anywhere in the model.
  const json = JSON.stringify(model).toLowerCase();
  for (const banned of ["health%", "healthscore", "uptime", "successrate", "\"health\":", "operationshealth"]) {
    assert.ok(!json.includes(banned), `Overview model carries no ${banned}`);
  }
  const component = readFileSync(join(process.cwd(), "src", "components", "operations-overview", "operations-overview.tsx"), "utf8");
  for (const banned of ["<button", "onClick", "Run ", "Execute", "Retry", "Kill", "Approve", "Restart"]) {
    assert.ok(!component.includes(banned), `Overview exposes no execution control (${banned})`);
  }
}

function pageIsMockFreeAndHonest(): void {
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "operations", "page.tsx"), "utf8");
  const imports = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  for (const target of imports) {
    assert.ok(!target.includes("/mock"), `Operations Overview imports no mock (${target})`);
    assert.ok(!target.includes("execution/mock"), `Operations Overview imports no execution/mock (${target})`);
  }
  assert.ok(imports.some((t) => t.includes("operations-overview")), "Overview renders the truth surface");
}

function navAndRoutesIntact(): void {
  assert.equal(WORKSPACES.length, 7, "seven workspaces preserved");
  const ops = getWorkspace("operations");
  assert.ok(ops.destinations.some((d) => d.href === "/director/execution-center"), "Executions destination present");
  assert.equal(resolveActiveWorkspace("/operations"), "operations", "/operations resolves to Operations");
  assert.equal(resolveActiveWorkspace("/director/execution-center"), "operations", "Execution resolves to Operations");
}

function main(): void {
  availabilityIsHonest();
  executionBoundaryIsReal();
  noFabricatedAggregateOrControls();
  pageIsMockFreeAndHonest();
  navAndRoutesIntact();
  console.log("operations-overview honesty checks passed");
}

main();
