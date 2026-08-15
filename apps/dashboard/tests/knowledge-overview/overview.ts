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
  /*
   * K1/K2/ingestion CONNECTED THESE THREE, and the map went on describing the pre-K1 world.
   * `requires-authorized-context` is the narrowest truthful state in this vocabulary: a real
   * governed authority exists, and using it needs an authorized organization context.
   */
  assert.equal(byArea("Sources")?.state, "requires-authorized-context");
  assert.equal(byArea("Provenance & evidence")?.state, "requires-authorized-context");
  assert.equal(
    byArea("Heby Knowledge evidence")?.state,
    "requires-authorized-context",
    "the evidence path is connected — 'Heby retrieval' was renamed because what is connected is not retrieval",
  );
  // Phase 21C: Knowledge Graph now reads the canonical layer (not connected here),
  // no longer the legacy derived projection.
  assert.equal(byArea("Knowledge Graph")?.state, "not-connected");
  assert.equal(byArea("Registries")?.state, "reference-data");

  /* ── NEGATIVE LOCKS: the falsified claims may not come back ──────────────── */
  {
    const allCopy = model.availability.map((item) => `${item.area} ${item.detail}`).join("\n");
    for (const denial of [
      /zero sources are connected/i,
      /no knowledge source is connected/i,
      /no evidence reference is available/i,
      /no retrieval path is connected/i,
      /retrieval and evidence tracing are contract-only/i,
    ]) {
      assert.ok(
        !denial.test(allCopy),
        `the availability map must not claim ${denial} — K1/K2/ingestion made it false`,
      );
    }
    assert.ok(
      !model.availability.some((item) => item.area === "Heby retrieval"),
      "the old 'Heby retrieval' area is gone — listing is not retrieval, and the name implied it was",
    );
  }

  /* ── AND THE ABSENCES THAT ARE STILL REAL STAY STATED ────────────────────── */
  {
    const evidence = byArea("Heby Knowledge evidence")!;
    assert.match(evidence.detail, /listing, not a search/i, "listing is not called retrieval");
    assert.match(
      evidence.detail,
      /no index, no scoring, no semantic or vector retrieval exists/i,
      "search, ranking, semantic and vector retrieval are still stated as absent",
    );
    assert.match(evidence.detail, /advisory/i, "and Heby is still stated as advisory");

    const sources = byArea("Sources")!;
    assert.match(
      sources.detail,
      /no file upload, url, connector or stored-document source exists/i,
      "external source kinds are still stated as unconnected",
    );

    const provenance = byArea("Provenance & evidence")!;
    assert.match(
      provenance.detail,
      /not rendered as a citation surface/i,
      "provenance is backend-only and the copy does not imply a citation UX",
    );
    assert.match(
      provenance.detail,
      /no relevance or scoring engine/i,
      "and no scoring engine is implied",
    );
  }

  /*
   * THE CAP IN THE COPY IS THE CAP IN THE CODE. The model states the number as a literal rather
   * than importing a `.server` module into a bundle-facing file, so this is what stops it drifting.
   */
  {
    const repo = readFileSync(
      join(process.cwd(), "src", "features", "knowledge", "durable-knowledge-repository.server.ts"),
      "utf8",
    );
    const limit = /KNOWLEDGE_LISTING_LIMIT = (\d+)/.exec(repo)?.[1];
    assert.ok(limit, "the listing limit is a real constant");
    assert.match(
      byArea("Heby Knowledge evidence")!.detail,
      new RegExp(`capped at ${limit}\\b`),
      `the copy must state the real cap (${limit})`,
    );
  }
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
