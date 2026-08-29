import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { WORKSPACES, getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { resolveNavigation } from "../../src/features/heby-runtime/navigate-tool";

/*
 * Hebun UI Phase 20D — cross-workspace + legacy closure contract.
 *
 * Verifies: superseded Command/Intelligence legacy routes redirect safely (no loop/chain), the
 * authoritative Command (8) + Intelligence (6) IA is intact, no authoritative L2 surface imports a
 * mock, retired routes are not surfaced by Heby navigation, and the seven-workspace architecture,
 * Decisions authority, and Security Center are preserved.
 */

const APP = "src/app/(dashboard)";
const read = (p: string): string => readFileSync(p, "utf8");
const pageFor = (route: string): string =>
  route === "/" ? `${APP}/page.tsx` : `${APP}/${route.replace(/^\//, "")}/page.tsx`;

/* The Phase 20D redirect map: superseded source route → canonical destination. */
const REDIRECTS: Record<string, string> = {
  "/director/alerts": "/command/inbox",
  "/director/insights": "/director/intelligence/insights",
  "/director/recommendations": "/director/intelligence/recommendations",
  "/director/intelligence/patterns": "/intelligence",
  "/director/intelligence/organization-health": "/director/organization-health",
  "/director/intelligence/learning": "/intelligence",
  "/director/intelligence": "/intelligence",
};

/* ── Every retired route redirects to its declared canonical destination ── */
function redirectsDeclared(): void {
  for (const [source, target] of Object.entries(REDIRECTS)) {
    const src = read(pageFor(source));
    assert.ok(/from "next\/navigation"/.test(src), `${source} imports next/navigation`);
    assert.ok(
      new RegExp(`redirect\\(\\s*["']${target}["']\\s*\\)`).test(src),
      `${source} redirects to ${target}`,
    );
    // A retired page renders no mock and no workspace body — it is a redirect only.
    assert.ok(!/features\/(director|intelligence|enterprise-intelligence)\/mock/.test(src), `${source} renders no mock`);
  }
}

/* ── No redirect loops or chains: every target is a real, non-redirecting page ── */
function noRedirectLoops(): void {
  for (const target of new Set(Object.values(REDIRECTS))) {
    const file = pageFor(target);
    assert.ok(existsSync(file), `redirect target ${target} has a real page`);
    assert.ok(!/\bredirect\(/.test(read(file)), `redirect target ${target} does not itself redirect (no chain/loop)`);
  }
}

/* ── Authoritative IA intact (Phase 20B + 20C preserved) ── */
function authoritativeIaIntact(): void {
  assert.equal(WORKSPACES.length, 7, "still exactly seven workspaces");
  /*
   * CMD-B2 amended this from the Phase 20B eight to the canonical three; L4 added Live Map as a
   * fourth. The property Phase 20D cares about is that its redirect closure did not disturb the
   * authoritative IA — it is the IA this file must match, not a particular count. The five removed
   * labels keep their routes, and `retiredRoutesStillResolveToWorkspace` below still proves the
   * redirect targets stay reachable.
   */
  assert.deepEqual(
    getWorkspace("command").destinations.map((d) => d.label),
    ["Overview", "Decisions", "Director Intent", "Live Map"],
    "Command canonical L2 intact (CMD-B2, extended by L4)",
  );
  assert.deepEqual(
    getWorkspace("intelligence").destinations.map((d) => d.label),
    ["Overview", "Signals & Assessments", "Candidates", "Insights", "Readiness & Pathways", "Recommendations"],
    "Intelligence 6-surface IA intact",
  );
  assert.equal(getWorkspace("command").destinations.find((d) => d.label === "Decisions")?.href, "/approvals");
  const sec = getWorkspace("governance").destinations.find((d) => d.href === "/director/governance/security");
  assert.ok(sec && sec.label === "Security Center", "Security Center preserved under Governance");
}

/* ── No authoritative Command/Intelligence L2 surface imports a mock ── */
function noMockOnAuthoritative(): void {
  const authoritativePages = [
    "command/page.tsx", "command/inbox/page.tsx", "command/briefings/page.tsx", "command/intent/page.tsx",
    "approvals/page.tsx", "director/goals/page.tsx", "director/organization-health/page.tsx", "director/reports/page.tsx",
    "intelligence/page.tsx", "intelligence/signals/page.tsx", "intelligence/candidates/page.tsx",
    "intelligence/evolution/page.tsx", "director/intelligence/insights/page.tsx", "director/intelligence/recommendations/page.tsx",
  ];
  for (const rel of authoritativePages) {
    const src = read(`${APP}/${rel}`);
    assert.ok(
      !/from\s+["'][^"']*features\/(director|intelligence|enterprise-intelligence)\/mock["']/.test(src),
      `${rel} imports no mock`,
    );
  }
}

/* ── Heby navigation never surfaces a retired route as a destination ── */
function hebyNavClean(): void {
  const retired = Object.keys(REDIRECTS);
  for (const workspace of WORKSPACES) {
    for (const d of workspace.destinations) {
      assert.ok(!retired.includes(d.href ?? ""), `${d.label} does not point at a retired route`);
    }
  }
  // The navigate tool resolves real destinations, never a retired one.
  for (const term of ["alerts", "patterns", "pattern discovery", "learning center"]) {
    const res = resolveNavigation(term);
    const routes = [res.target?.route, ...res.candidates.map((c) => c.route)].filter(Boolean) as string[];
    for (const r of routes) assert.ok(!retired.includes(r), `navigate("${term}") never resolves to a retired route (${r})`);
  }
}

/* ── Legacy deep links still resolve to a workspace (redirects keep them alive) ── */
function retiredRoutesStillResolveToWorkspace(): void {
  assert.equal(resolveActiveWorkspace("/director/alerts"), "command", "retired alerts still resolves under Command");
  assert.equal(resolveActiveWorkspace("/director/intelligence/patterns"), "intelligence", "retired patterns resolves under Intelligence");
}

function main(): void {
  redirectsDeclared();
  noRedirectLoops();
  authoritativeIaIntact();
  noMockOnAuthoritative();
  hebyNavClean();
  retiredRoutesStillResolveToWorkspace();
  console.log("phase 20D closure contract checks passed");
}

main();
