import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/*
 * Knowledge Graph surface boundary contract (Hebun UI Phase 21C).
 *
 * The rebuilt Knowledge Graph surface reads only the REAL canonical knowledge layer.
 * It must never import the legacy seeded graph stack (knowledge-graph mock builder,
 * knowledge-domain mock, registries mock, knowledge-crud), never mutate a graph, and
 * never fabricate relationship strength / confidence / graph-health / coverage / counts.
 */

const featureDir = join(process.cwd(), "src", "features", "knowledge-graph-surface");
const featureFiles = readdirSync(featureDir).filter((name) => name.endsWith(".ts"));

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
}

const ALLOWED_FEATURES = new Set(["@/features/canonical-read"]);

const FORBIDDEN_IMPORT_FRAGMENTS = [
  "@/features/knowledge-graph",
  "knowledge-domain",
  "@/features/registries",
  "knowledge-crud",
  "memory-runtime",
  "runtime-projection",
];

function featureImportsAreClean(): void {
  for (const file of featureFiles) {
    const source = readFileSync(join(featureDir, file), "utf8");
    for (const target of importsOf(source)) {
      for (const fragment of FORBIDDEN_IMPORT_FRAGMENTS) {
        assert.ok(!target.includes(fragment), `${file} must not import ${target} (contains "${fragment}")`);
      }
      if (target.startsWith("@/features/")) {
        const allowed = ALLOWED_FEATURES.has(target) || target.startsWith("@/features/knowledge-graph-surface");
        assert.ok(allowed, `${file} imports a non-allowlisted feature: ${target}`);
      }
    }
  }
}

function noGraphMutationOrFabricatedMetrics(): void {
  for (const file of featureFiles) {
    const code = stripComments(readFileSync(join(featureDir, file), "utf8"));
    for (const token of [
      "createRelationship",
      "createKnowledge",
      "updateKnowledge",
      "deleteKnowledge",
      "companyKnowledgeGraph",
      "buildKnowledgeGraph",
      "knowledgeGraphMetrics",
      "graphHealth",
      "relationshipBlueprints",
    ]) {
      assert.ok(!code.includes(token), `${file} must not reference ${token}`);
    }
  }
}

function pageDroppedSeededGraph(): void {
  const page = readFileSync(
    join(process.cwd(), "src", "app", "(dashboard)", "director", "knowledge-graph", "page.tsx"),
    "utf8",
  );
  for (const target of importsOf(page)) {
    for (const fragment of [
      "knowledge-graph-panel",
      "knowledge-registry-workspace",
      "memory-engine-panel",
      "knowledge-crud",
      "@/features/registries",
    ]) {
      assert.ok(!target.includes(fragment), `/director/knowledge-graph must not import ${target}`);
    }
    // The legacy mock graph feature — precise match so the new -surface feature is allowed.
    const isMockGraph =
      target === "@/features/knowledge-graph" || target.startsWith("@/features/knowledge-graph/");
    assert.ok(!isMockGraph, `/director/knowledge-graph must not import the mock graph (${target})`);
  }
  assert.ok(
    importsOf(page).some((t) => t.includes("knowledge-graph-surface")),
    "/director/knowledge-graph reads the canonical layer via knowledge-graph-surface",
  );
}

function pageRegisteredAsStaticRoute(): void {
  // The rebuilt page must win over the [...slug] placeholder catch-all.
  const sidebar = readFileSync(join(process.cwd(), "src", "config", "sidebar.config.ts"), "utf8");
  assert.ok(
    sidebar.includes('"/director/knowledge-graph",'),
    "/director/knowledge-graph is registered in staticRoutes so the real page renders",
  );
}

function main(): void {
  featureImportsAreClean();
  noGraphMutationOrFabricatedMetrics();
  pageDroppedSeededGraph();
  pageRegisteredAsStaticRoute();
  console.log("knowledge-graph-surface boundary contract checks passed");
}

main();
