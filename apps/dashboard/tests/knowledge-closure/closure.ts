import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { staticRoutes, placeholderPaths } from "../../src/config/sidebar.config";
import { REGISTRY_DIRECTORY } from "../../src/features/registry-directory";

/*
 * Knowledge closure contract (Hebun UI Phase 21D).
 *
 * Ties the Phase 21 Knowledge work together: the canonical four-surface IA, the retired
 * /memory orphan, the removed dead document mock, cross-workspace ownership, and — most
 * importantly — a guard so a real authoritative Knowledge route can never again be
 * silently shadowed by the [...slug] placeholder catch-all.
 */

const AUTHORITATIVE_KNOWLEDGE_ROUTES = [
  "/knowledge",
  "/director/memory",
  "/director/knowledge-graph",
  "/director/registries",
] as const;

function pageSource(...segments: string[]): string {
  return readFileSync(join(process.cwd(), "src", "app", "(dashboard)", ...segments), "utf8");
}
function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
}
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function canonicalIa(): void {
  assert.equal(WORKSPACES.length, 7, "seven workspaces preserved");
  const knowledge = getWorkspace("knowledge");
  const labels = knowledge.destinations.map((d) => d.label);
  assert.deepEqual(labels, ["Overview", "Company Memory", "Knowledge Graph", "Registries"], "canonical Knowledge L2");
  assert.equal(knowledge.destinations.length, 4, "exactly four Knowledge surfaces");
  assert.ok(!labels.includes("Knowledge Base"), "no Knowledge Base label / no document corpus fiction");
  const href = (label: string) => knowledge.destinations.find((d) => d.label === label)?.href;
  assert.equal(href("Overview"), "/knowledge");
  assert.equal(href("Company Memory"), "/director/memory");
  assert.equal(href("Knowledge Graph"), "/director/knowledge-graph");
  assert.equal(href("Registries"), "/director/registries");
}

/* The 21B/21C defect: a real page shadowed by the placeholder catch-all. Guard it forever. */
function noAuthoritativeRouteIsShadowed(): void {
  const shadowed = placeholderPaths();
  for (const route of AUTHORITATIVE_KNOWLEDGE_ROUTES) {
    assert.ok(
      !shadowed.includes(route),
      `${route} must not be generated as a [...slug] placeholder (it has a real page)`,
    );
  }
  // The two routes that were actually caught shadowed are explicitly registered.
  assert.ok(staticRoutes.has("/director/memory"), "/director/memory registered in staticRoutes");
  assert.ok(staticRoutes.has("/director/knowledge-graph"), "/director/knowledge-graph registered in staticRoutes");
}

function memoryOrphanRedirected(): void {
  const page = pageSource("memory", "page.tsx");
  const code = stripComments(page);
  assert.ok(code.includes('permanentRedirect("/director/memory")'), "/memory permanently redirects to /director/memory");
  assert.ok(importsOf(page).includes("next/navigation"), "/memory uses the framework redirect");
  assert.ok(!code.includes('permanentRedirect("/memory")') && !code.includes('redirect("/memory")'), "no redirect loop");
  // Executable coupling only — explanatory prose in comments is ignored.
  for (const banned of ["memory-runtime", "MemoryRuntimeService", "memory-registry-workspace", "MemoryEnginePanel", "commandType"]) {
    assert.ok(!code.includes(banned), `/memory no longer renders the legacy memory product (${banned})`);
  }
  assert.equal(resolveActiveWorkspace("/memory"), "knowledge", "/memory still resolves under Knowledge");
}

function deadDocumentMockRemoved(): void {
  assert.ok(
    !existsSync(join(process.cwd(), "src", "features", "knowledge", "mock.ts")),
    "the dead fabricated document-KB mock (features/knowledge/mock.ts) is removed",
  );
}

function authoritativeSurfacesStayClean(): void {
  const memory = pageSource("director", "memory", "page.tsx");
  assert.ok(!importsOf(memory).some((t) => t.includes("memory-runtime")), "Company Memory has no memory-runtime");

  const graph = pageSource("director", "knowledge-graph", "page.tsx");
  assert.ok(
    !importsOf(graph).some((t) => t === "@/features/knowledge-graph" || t.startsWith("@/features/knowledge-graph/")),
    "Knowledge Graph has no mock graph",
  );

  const registries = pageSource("director", "registries", "page.tsx");
  assert.ok(
    !importsOf(registries).some((t) => t === "@/features/registries" || t.startsWith("@/features/registries/")),
    "Registries hub has no registry mock",
  );
}

function ownershipClosure(): void {
  const goals = REGISTRY_DIRECTORY.find((r) => r.id === "goals");
  assert.equal(goals?.authoritativeOwner, "Command", "Goal authority remains Command");
  const policies = REGISTRY_DIRECTORY.find((r) => r.id === "policies");
  assert.equal(policies?.authoritativeOwner, "Governance", "Policy authority remains Governance");

  // Command Strategic Goals is the authoritative goal product; Security Center stays in Governance.
  /*
   * Ownership, asserted of the ROUTE rather than of a menu entry. CMD-B2 took Strategic Goals out of
   * Command's canonical navigation without moving it anywhere: `/director/goals` still resolves
   * under Command, and the registry above still names Command its authoritative owner. Menu
   * membership was only ever a proxy for that, and it is the proxy that changed.
   */
  assert.equal(resolveActiveWorkspace("/director/goals"), "command", "Command owns the goals route");
  const gov = getWorkspace("governance");
  assert.ok(gov.destinations.some((d) => d.href === "/director/governance/security"), "Security Center preserved in Governance");
}

function knowledgeRoutesResolve(): void {
  for (const route of AUTHORITATIVE_KNOWLEDGE_ROUTES) {
    assert.equal(resolveActiveWorkspace(route), "knowledge", `${route} resolves to Knowledge`);
  }
}

function main(): void {
  canonicalIa();
  noAuthoritativeRouteIsShadowed();
  memoryOrphanRedirected();
  deadDocumentMockRemoved();
  authoritativeSurfacesStayClean();
  ownershipClosure();
  knowledgeRoutesResolve();
  console.log("knowledge closure contract checks passed");
}

main();
