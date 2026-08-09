import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WORKSPACES,
  getWorkspace,
  resolveActiveWorkspace,
} from "../../src/config/workspace-nav";
import { getKnowledgeWorkspaceModel } from "../../src/features/knowledge/workspace-model";

/*
 * Knowledge Overview + Knowledge L2 navigation (Hebun UI Phase 21B).
 *
 * The /knowledge landing is the honest Knowledge Overview; the old "Knowledge Base"
 * label is retired. The Overview surfaces only honest availability states — no counts,
 * freshness, or aggregate score — and preserves the Phase 9 honesty (no fabricated
 * memory, source, or provenance).
 */

const HONEST_STATES = new Set([
  "authority-connected",
  "requires-authorized-context",
  "not-connected",
  "derived-nonauthoritative",
  "reference-data",
  "contract-only",
]);

function sevenWorkspacesPreserved(): void {
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces");
}

function knowledgeL2IsTheOverviewFirstIa(): void {
  const knowledge = getWorkspace("knowledge");
  const labels = knowledge.destinations.map((d) => d.label);
  assert.deepEqual(
    labels,
    ["Overview", "Company Memory", "Knowledge Graph", "Registries"],
    "Knowledge L2 order: Overview first, then Company Memory, Graph, Registries",
  );
  assert.ok(!labels.includes("Knowledge Base"), "the 'Knowledge Base' label is retired");
  assert.equal(knowledge.destinations[0].href, "/knowledge", "Overview is the /knowledge landing");
  const companyMemory = knowledge.destinations.find((d) => d.label === "Company Memory");
  assert.equal(companyMemory?.href, "/director/memory", "Company Memory keeps its L2 route (Director D1)");
}

function knowledgeRoutesResolve(): void {
  for (const route of ["/knowledge", "/director/memory", "/director/knowledge-graph", "/director/registries"]) {
    assert.equal(resolveActiveWorkspace(route), "knowledge", `${route} resolves to Knowledge`);
  }
}

function availabilityIsHonestOnly(): void {
  const model = getKnowledgeWorkspaceModel();
  assert.ok(model.availability.length >= 6, "Overview shows the Knowledge availability map");

  for (const item of model.availability) {
    assert.ok(HONEST_STATES.has(item.state), `${item.area} uses an honest availability state (${item.state})`);
    assert.ok(item.question.length > 0 && item.detail.length > 0, `${item.area} explains itself`);
    // No fabricated numeric counts / percentages / freshness in the copy.
    assert.ok(!/\d+\s*%/.test(item.detail), `${item.area} states no fabricated percentage`);
    assert.ok(!/\b\d+\s+(records?|memories|sources?|nodes?)\b/i.test(item.detail), `${item.area} states no fabricated count`);
  }

  const byArea = (area: string) => model.availability.find((a) => a.area === area);
  assert.equal(byArea("Company Memory")?.state, "requires-authorized-context");
  assert.equal(byArea("Company Memory")?.href, "/director/memory");
  assert.equal(byArea("Sources")?.state, "not-connected");
  // Phase 21C: Knowledge Graph now reads the canonical layer (not connected here),
  // no longer the legacy derived projection.
  assert.equal(byArea("Knowledge Graph")?.state, "not-connected");
  assert.equal(byArea("Registries")?.state, "reference-data");
  assert.equal(byArea("Heby retrieval")?.state, "contract-only", "Heby retrieval is honestly contract-only");
}

function phase9HonestyPreserved(): void {
  const model = getKnowledgeWorkspaceModel();
  assert.equal(model.memories.length, 0, "no memory record is fabricated on the Overview");
  assert.ok(
    model.sourceKinds.every((kind) => kind.connected === 0),
    "no source is fabricated as connected",
  );
}

function overviewRendersAvailability(): void {
  const workspace = readFileSync(
    join(process.cwd(), "src", "components", "knowledge-workspace", "knowledge-workspace.tsx"),
    "utf8",
  );
  assert.ok(
    workspace.includes("KnowledgeAvailability"),
    "the Knowledge Overview renders the availability map",
  );
}

function main(): void {
  sevenWorkspacesPreserved();
  knowledgeL2IsTheOverviewFirstIa();
  knowledgeRoutesResolve();
  availabilityIsHonestOnly();
  phase9HonestyPreserved();
  overviewRendersAvailability();
  console.log("knowledge overview + L2 navigation checks passed");
}

main();
