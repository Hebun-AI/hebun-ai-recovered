import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";

/*
 * Governance legacy-route closure (Hebun UI Phase 23D).
 *
 * Every retired Governance/policy route permanently redirects (single hop, loop-free, chain-free) to
 * its canonical authoritative surface, carries no fabricated content, and imports no governance mock.
 * The governance mock is retained (not deleted) because it remains load-bearing for the real policy
 * engine and cross-system consumers. The authoritative Governance IA stays the five surfaces.
 */

const APP = (p: string) => join(process.cwd(), "src", "app", "(dashboard)", ...p.split("/"));
const SRC = (...p: string[]) => join(process.cwd(), "src", ...p);

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}
function importsOf(src: string): string[] {
  return [...src.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}
function redirectTargetOf(src: string): string | null {
  const m = stripComments(src).match(/permanentRedirect\(\s*"([^"]+)"\s*\)/);
  return m ? m[1] : null;
}

// Retired legacy route → its canonical authoritative target (Phase 23D disposition).
const LEGACY: ReadonlyArray<{ page: string; target: string }> = [
  { page: "director/governance/page.tsx", target: "/governance" },
  { page: "director/policy/page.tsx", target: "/director/governance/policies" },
  { page: "director/governance/risk/page.tsx", target: "/director/governance/compliance" },
  { page: "director/governance/explainability/page.tsx", target: "/director/governance/audit" },
  { page: "director/governance/permissions/page.tsx", target: "/director/governance/policies" },
  { page: "director/governance/approvals/page.tsx", target: "/approvals" },
];

// Canonical, honest, non-redirecting destinations.
const CANONICAL = new Set([
  "/governance",
  "/director/governance/policies",
  "/director/governance/compliance",
  "/director/governance/audit",
  "/director/governance/security",
  "/approvals",
]);

function pageFileForRoute(route: string): string {
  if (route === "/governance") return "governance/page.tsx";
  if (route === "/approvals") return "approvals/page.tsx";
  return route.replace(/^\//, "") + "/page.tsx";
}

function legacyRoutesRedirectCleanly(): void {
  for (const { page, target } of LEGACY) {
    const src = readFileSync(APP(page), "utf8");
    assert.equal(redirectTargetOf(src), target, `${page} permanently redirects to ${target}`);
    assert.ok(CANONICAL.has(target), `${page} target ${target} is a canonical authoritative surface`);
    // The retired page no longer presents the governance mock.
    const imports = importsOf(src);
    assert.ok(
      !imports.some((t) => t === "@/features/governance" || t.startsWith("@/features/governance/")),
      `${page} imports no governance mock`,
    );
    // No fabricated surface survives in the redirect stub (scan code, not the explanatory comment).
    const code = stripComments(src);
    for (const banned of ["StatCard", "Badge", "PageHeader", "EventTimeline", "RiskHeatmap", "ApprovalQueue", "%"]) {
      assert.ok(!code.includes(banned), `${page} renders no fabricated content (${banned})`);
    }
  }
}

function redirectsAreSingleHopLoopFree(): void {
  const sources = new Set(LEGACY.map((l) => "/" + l.page.replace(/\/page\.tsx$/, "")));
  for (const { target } of LEGACY) {
    // No target is itself a retired source (no A→B→C chain, no A→A loop).
    assert.ok(!sources.has(target), `${target} is not itself a retired route (loop/chain-free)`);
    // The target is a real page that does not itself redirect.
    const full = APP(pageFileForRoute(target));
    assert.ok(existsSync(full), `redirect target ${target} has a real page`);
    assert.equal(redirectTargetOf(readFileSync(full, "utf8")), null, `redirect target ${target} does not itself redirect (chain-free)`);
  }
}

function mockRetainedForLoadBearingConsumers(): void {
  // Phase 23D does NOT delete the governance mock: it is load-bearing. Prove the real policy engine
  // still consumes it (so retention is justified, not accidental dead weight).
  assert.ok(existsSync(SRC("features", "governance", "policies.ts")), "governance mock retained on disk");
  const builder = readFileSync(SRC("features", "policy", "policy-builder.ts"), "utf8");
  assert.ok(
    importsOf(builder).some((t) => t.startsWith("@/features/governance")),
    "the real policy engine still consumes the governance mock (load-bearing — do not delete)",
  );
}

function navRemainsFiveAuthoritative(): void {
  const gov = getWorkspace("governance");
  assert.deepEqual(
    gov.destinations.map((d) => d.label),
    ["Overview", "Policies & Rules", "Compliance & Risk", "Audit & Explainability", "Security Center"],
    "Governance L2 remains the five authoritative surfaces after legacy retirement",
  );
  for (const absent of ["Risk", "Explainability", "Permissions", "Approvals", "Policy"]) {
    assert.ok(!gov.destinations.some((d) => d.label === absent), `no legacy "${absent}" L2 was reintroduced`);
  }
  // Redirect sources still resolve to Governance so the workspace stays highlighted through the hop.
  for (const p of ["/director/governance", "/director/policy", "/director/governance/risk", "/director/governance/permissions"]) {
    assert.equal(resolveActiveWorkspace(p), "governance", `${p} still resolves to Governance`);
  }
}

function main(): void {
  legacyRoutesRedirectCleanly();
  redirectsAreSingleHopLoopFree();
  mockRetainedForLoadBearingConsumers();
  navRemainsFiveAuthoritative();
  console.log("governance legacy-route closure checks passed");
}

main();
