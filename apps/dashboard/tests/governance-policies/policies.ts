import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getPoliciesRulesModel } from "../../src/features/governance-policies";

/*
 * Policies & Rules honesty (Hebun UI Phase 23B).
 *
 * Surfaces the real policy engine with explicit DERIVED · SEEDED INPUT provenance; no live-truth
 * claim, no fabricated compliance/risk/audit score, no mutation/approval control; policy
 * evaluation is not authorization, execution, or human approval.
 */

function engineIsDerivedSeeded(): void {
  const model = getPoliciesRulesModel();
  assert.equal(model.engine.provenance, "derived-seeded", "engine is labelled derived from seeded input");
  assert.ok(/seed/i.test(model.engine.detail), "engine detail states seeded input");
  assert.ok(model.pipeline.length >= 5, "the real evaluation pipeline is surfaced (structural)");
  assert.ok(model.rules.length >= 1, "policy/rule definitions are surfaced from the real registry");
}

function noFabricatedMetricsOrLiveClaim(): void {
  const model = getPoliciesRulesModel();
  const json = JSON.stringify(model);
  assert.ok(!/\d+\s*%/.test(json), "no fabricated percentage anywhere in the model");
  // Rules are structural — no compliance-score / health / adoption field leaked.
  for (const rule of model.rules) {
    const keys = Object.keys(rule);
    for (const forbidden of ["minComplianceScore", "complianceScore", "health", "adoption", "score", "status"]) {
      assert.ok(!keys.includes(forbidden), `rule ${rule.id} carries no fabricated "${forbidden}" field`);
    }
  }
  assert.ok(model.provenance.some((p) => /DERIVED · SEEDED INPUT|seeded/i.test(p)), "provenance names seeded input");
}

function boundariesKeepDistinctions(): void {
  const model = getPoliciesRulesModel();
  const text = model.boundaries.join(" ").toLowerCase();
  assert.ok(text.includes("not authorization"), "policy evaluation ≠ authorization");
  assert.ok(text.includes("not execution"), "policy evaluation ≠ execution");
  assert.ok(text.includes("not a human decision") || text.includes("approvals belong to decisions"), "constraint ≠ human decision (Decisions)");
  assert.ok(text.includes("not organizational truth") || text.includes("not authoritative"), "seeded ≠ live / derived ≠ authoritative");
}

function pageAndComponentAreCleanReadOnly(): void {
  const page = readFileSync(join(process.cwd(), "src", "app", "(dashboard)", "director", "governance", "policies", "page.tsx"), "utf8");
  const imports = [...page.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(!imports.some((t) => t === "@/features/governance" || t.startsWith("@/features/governance/")), "Policies page imports no governance mock directly");
  assert.ok(imports.some((t) => t.includes("policies-rules-surface")), "Policies page renders the truth surface");

  const component = readFileSync(join(process.cwd(), "src", "components", "governance-policies", "policies-rules-surface.tsx"), "utf8");
  for (const banned of ["<button", "onClick", "<input", "Approve", "Reject", "Enable", "Disable", "Enforce", "Ratify", "Create policy", "Edit policy", "Delete"]) {
    assert.ok(!component.includes(banned), `Policies & Rules exposes no mutation/approval control (${banned})`);
  }
}

function featureReadsRealPolicyEngineOnly(): void {
  const dir = join(process.cwd(), "src", "features", "governance-policies");
  const allowed = new Set(["@/features/policy/policy-registry", "@/features/policy/governance-pipeline", "@/features/policy/types"]);
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(join(dir, file), "utf8");
    for (const target of [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1])) {
      if (target.startsWith("@/features/")) {
        assert.ok(allowed.has(target) || target.startsWith("@/features/governance-policies"), `${file} reads only the real policy engine (${target})`);
        assert.ok(target !== "@/features/governance" && !target.startsWith("@/features/governance/"), `${file} does not import the governance mock (${target})`);
      }
    }
  }
}

function main(): void {
  engineIsDerivedSeeded();
  noFabricatedMetricsOrLiveClaim();
  boundariesKeepDistinctions();
  pageAndComponentAreCleanReadOnly();
  featureReadsRealPolicyEngineOnly();
  console.log("governance-policies honesty checks passed");
}

main();
