import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getComplianceRiskModel } from "../../src/features/governance-compliance-risk";
import { getAuditExplainabilityModel } from "../../src/features/governance-audit-explainability";
import { getWorkspace, resolveActiveWorkspace } from "../../src/config/workspace-nav";
import { placeholderPaths, staticRoutes } from "../../src/config/sidebar.config";

/*
 * Governance Compliance & Risk + Audit & Explainability honesty (Hebun UI Phase 23C).
 *
 * Real evaluation structure, DERIVED · SEEDED INPUT; no fabricated compliance/risk/audit score,
 * count, timestamp, or record; no model chain-of-thought; no mutation/approval; the five-surface
 * authoritative Governance IA; Security Center preserved; Decisions not duplicated.
 */

const APP = (p: string) => join(process.cwd(), "src", "app", "(dashboard)", ...p.split("/"));
function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
}

function complianceRiskIsHonest(): void {
  const model = getComplianceRiskModel();
  assert.equal(model.state.provenance, "derived-seeded", "compliance/risk labelled derived from seeded input");
  assert.ok(model.complianceStages.length >= 1 && model.riskStages.length >= 1, "real compliance + risk stages surfaced");
  assert.ok(model.frameworks.length >= 3, "frameworks referenced");
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage");
  // Frameworks carry no fabricated score.
  for (const f of model.frameworks) {
    assert.ok(!Object.keys(f).includes("score"), `framework ${f.name} carries no fabricated score`);
  }
  const distinctions = model.distinctions.join(" ").toLowerCase();
  assert.ok(distinctions.includes("not compliance certification"), "compliance evaluation ≠ certification");
  assert.ok(distinctions.includes("not an incident"), "risk evaluation ≠ incident");
}

function auditExplainabilityIsHonest(): void {
  const model = getAuditExplainabilityModel();
  assert.equal(model.state.provenance, "derived-seeded", "audit/explainability labelled derived from seeded input");
  assert.ok(model.auditStages.length >= 1, "real audit/explanation stages surfaced");
  assert.equal(model.durableRecords.present, false, "no durable audit record is fabricated");
  assert.ok(model.explanationTraces.length >= 3, "explanation trace kinds surfaced");
  assert.ok(/not a model chain-of-thought|not.*chain-of-thought/i.test(model.explainabilityNote), "explainability ≠ model chain-of-thought");
  const distinctions = model.distinctions.join(" ").toLowerCase();
  assert.ok(distinctions.includes("not a model chain-of-thought"), "explanation ≠ chain-of-thought");
  assert.ok(distinctions.includes("not an execution receipt"), "audit ≠ execution receipt");
  assert.ok(distinctions.includes("not a compliance violation"), "security finding ≠ compliance violation");
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage");
}

function pagesAreMockFreeAndReadOnly(): void {
  const checks: ReadonlyArray<{ page: string; surface: string; component: string[] }> = [
    { page: "director/governance/compliance/page.tsx", surface: "compliance-risk-surface", component: ["governance-compliance-risk", "compliance-risk-surface.tsx"] },
    { page: "director/governance/audit/page.tsx", surface: "audit-explainability-surface", component: ["governance-audit-explainability", "audit-explainability-surface.tsx"] },
  ];
  for (const c of checks) {
    const page = readFileSync(APP(c.page), "utf8");
    const imports = importsOf(page);
    assert.ok(!imports.some((t) => t === "@/features/governance" || t.startsWith("@/features/governance/")), `${c.page} imports no governance mock`);
    assert.ok(imports.some((t) => t.includes(c.surface)), `${c.page} renders the truth surface`);
    const component = readFileSync(join(process.cwd(), "src", "components", ...c.component), "utf8");
    for (const banned of ["<button", "onClick", "<input", "Approve", "Reject", "Authorize", "Enforce", "Resolve", "chain-of-thought reasoning", "Create policy"]) {
      assert.ok(!component.includes(banned), `${c.component[0]} exposes no control/leak (${banned})`);
    }
  }
}

function featuresReadRealEngineOnly(): void {
  for (const dir of ["governance-compliance-risk", "governance-audit-explainability"]) {
    const base = join(process.cwd(), "src", "features", dir);
    for (const file of readdirSync(base).filter((f) => f.endsWith(".ts"))) {
      const source = readFileSync(join(base, file), "utf8");
      for (const target of importsOf(source)) {
        if (target.startsWith("@/features/")) {
          assert.ok(target === "@/features/policy/governance-pipeline" || target.startsWith(`@/features/${dir}`), `${dir}/${file} reads only the real pipeline (${target})`);
          assert.ok(target !== "@/features/governance" && !target.startsWith("@/features/governance/"), `${dir}/${file} imports no governance mock`);
        }
      }
    }
  }
}

function finalGovernanceIa(): void {
  const gov = getWorkspace("governance");
  const labels = gov.destinations.map((d) => d.label);
  assert.deepEqual(labels, ["Overview", "Policies & Rules", "Compliance & Risk", "Audit & Explainability", "Security Center"], "final five authoritative Governance surfaces");
  for (const absent of ["Risk", "Explainability", "Permissions", "Approvals", "Policies"]) {
    assert.ok(!labels.includes(absent), `no standalone "${absent}" authoritative L2`);
  }
  assert.ok(!labels.some((l) => /approve|approval/i.test(l)), "Decisions authority is not duplicated in Governance nav");
  // Shadow guard for the new authoritative routes.
  const shadowed = placeholderPaths();
  for (const route of ["/director/governance/compliance", "/director/governance/audit"]) {
    assert.ok(!shadowed.includes(route), `${route} is not a placeholder`);
    assert.ok(staticRoutes.has(route), `${route} registered in staticRoutes`);
    assert.equal(resolveActiveWorkspace(route), "governance", `${route} resolves to Governance`);
  }
}

function main(): void {
  complianceRiskIsHonest();
  auditExplainabilityIsHonest();
  pagesAreMockFreeAndReadOnly();
  featuresReadRealEngineOnly();
  finalGovernanceIa();
  console.log("governance compliance & risk + audit & explainability checks passed");
}

main();
