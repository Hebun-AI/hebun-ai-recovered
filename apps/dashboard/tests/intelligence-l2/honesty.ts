import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getIntelligenceWorkspaceModel } from "../../src/features/intelligence/workspace-model";
import {
  getSignalsAssessmentsModel,
  getCandidatesModel,
  getInsightsModel,
  getReadinessPathwaysModel,
  getRecommendationsModel,
} from "../../src/features/intelligence-surfaces/workspace-model";
import { getHebyWorkspaceProfile } from "../../src/features/heby-integration/workspace-registry";
import { HEBY_AUTHORITY_DESCRIPTORS } from "../../src/features/heby-integration/contracts";

/*
 * Hebun UI Phase 20C — Intelligence L2 honesty contract.
 *
 * Every retained Intelligence surface must reuse the real runtime vocabulary, surface zero
 * fabricated instances, keep confidence ordinal (never a percentage), preserve the candidate →
 * insight and recommendation → decision boundaries, invent no `pattern` kind, import no mock, and
 * keep Heby advisory.
 */

const PAGES = [
  "src/app/(dashboard)/intelligence/signals/page.tsx",
  "src/app/(dashboard)/intelligence/candidates/page.tsx",
  "src/app/(dashboard)/intelligence/evolution/page.tsx",
  "src/app/(dashboard)/director/intelligence/insights/page.tsx",
  "src/app/(dashboard)/director/intelligence/recommendations/page.tsx",
];
const COMPONENTS = [
  "src/components/intelligence-signals/signals-assessments.tsx",
  "src/components/intelligence-candidates/candidates.tsx",
  "src/components/intelligence-insights/insights.tsx",
  "src/components/intelligence-readiness/readiness-pathways.tsx",
  "src/components/intelligence-recommendations/recommendations.tsx",
];
const MODEL = ["src/features/intelligence-surfaces/workspace-model.ts"];

const read = (p: string): string => readFileSync(p, "utf8");
const kinds = (arr: readonly { kind: string }[]): string[] => arr.map((k) => k.kind);
const noPercent = (m: unknown): boolean => !JSON.stringify(m).includes("%");
const noDecimalScore = (m: unknown): boolean => !/\d+\.\d+/.test(JSON.stringify(m));

/* ── No mock imports on any retained Intelligence L2 surface ── */
function noMockImports(): void {
  const importsModule = (src: string, mod: string): boolean =>
    new RegExp(`from\\s+["'][^"']*${mod}["']`).test(src);
  for (const path of [...PAGES, ...COMPONENTS, ...MODEL]) {
    const src = read(path);
    assert.ok(!importsModule(src, "features/intelligence/mock"), `${path} must not import intelligence/mock`);
    assert.ok(!importsModule(src, "features/director/mock"), `${path} must not import director/mock`);
    assert.ok(!importsModule(src, "enterprise-intelligence/mock"), `${path} must not import enterprise-intelligence/mock`);
  }
}

/* ── The runtime taxonomy is the single source, and has no `pattern` kind ── */
function runtimeTaxonomyIsSource(): void {
  const base = getIntelligenceWorkspaceModel();
  const baseKinds = kinds(base.kinds);
  assert.deepEqual(
    baseKinds,
    ["learning", "optimization", "awareness-signal", "awareness-assessment", "evolution-readiness", "evolution-pathway"],
    "the real runtime candidate taxonomy",
  );
  assert.ok(!baseKinds.includes("pattern"), "no invented `pattern` candidate kind exists");
}

/* ── Signals & Assessments: awareness kinds, empty, healthy honesty ── */
function signalsHonest(): void {
  const m = getSignalsAssessmentsModel();
  assert.deepEqual(kinds(m.kinds), ["awareness-signal", "awareness-assessment"], "maps to real awareness kinds");
  assert.deepEqual(m.signals, [], "no fabricated signal");
  assert.deepEqual(m.assessments, [], "no fabricated assessment");
  assert.equal(m.connected, false);
  assert.ok(m.pipeline.length > 0, "pipeline drawn from real lifecycle");
  assert.ok(noPercent(m) && noDecimalScore(m), "no percentage/decimal score");
}

/* ── Candidates: all kinds, restrictions visible, ordinal confidence, empty ── */
function candidatesHonest(): void {
  const base = getIntelligenceWorkspaceModel();
  const m = getCandidatesModel();
  assert.deepEqual(kinds(m.kinds), kinds(base.kinds), "candidate kinds are the full real taxonomy");
  assert.deepEqual(m.candidates, [], "no fabricated candidate");
  assert.equal(m.connected, false);
  assert.equal(m.restrictions.length, 3, "restrict/defer/escalate all present — never hidden");
  for (const c of m.confidenceLevels) assert.match(c.label, /^[A-Za-z ]+$/, "confidence label is a word, not a number");
  assert.ok(noPercent(m) && noDecimalScore(m), "no percentage/decimal score");
}

/* ── Insights: validated subset, validation boundary, empty ── */
function insightsHonest(): void {
  const m = getInsightsModel();
  assert.deepEqual(kinds(m.validatedKinds), ["learning", "optimization"], "insights draw from learning + optimization");
  assert.equal(m.validationStage?.stage, "validation", "the boundary is the real validation stage");
  assert.deepEqual(m.insights, [], "no fabricated insight");
  assert.equal(m.connected, false);
  assert.ok(noPercent(m) && noDecimalScore(m), "no confidence percentage");
}

/* ── Readiness & Pathways: evolution kinds, empty ── */
function readinessHonest(): void {
  const m = getReadinessPathwaysModel();
  assert.deepEqual(kinds(m.kinds), ["evolution-readiness", "evolution-pathway"], "maps to real evolution kinds");
  assert.deepEqual(m.readiness, [], "no fabricated readiness");
  assert.deepEqual(m.pathways, [], "no fabricated pathway");
  assert.equal(m.connected, false);
  assert.ok(noPercent(m) && noDecimalScore(m), "no maturity/readiness percentage");
}

/* ── Recommendations: advisory, empty, and distinct from a decision ── */
function recommendationsHonest(): void {
  const m = getRecommendationsModel();
  assert.deepEqual(kinds(m.advisoryKinds), ["optimization", "evolution-pathway"], "advisory kinds");
  assert.deepEqual(m.recommendations, [], "no fabricated recommendation");
  assert.equal(m.connected, false);
  const rec = m.chain.find((s) => s.label === "Recommendation");
  const dec = m.chain.find((s) => /^Decision/.test(s.label));
  assert.ok(rec && rec.owner === "Intelligence", "recommendation is owned by Intelligence");
  assert.ok(dec && dec.owner === "Decisions", "the decision step is owned by Decisions — distinct");
  assert.ok(noPercent(m) && noDecimalScore(m), "no impact/ROI/urgency percentage");
}

/* ── Candidate ≠ insight (structural) ── */
function candidateIsNotInsight(): void {
  const candidates = getCandidatesModel();
  const insights = getInsightsModel();
  assert.ok(
    candidates.kinds.length > insights.validatedKinds.length,
    "the candidate set is broader than the validated-insight set",
  );
  const validated = kinds(insights.validatedKinds);
  assert.ok(validated.every((k) => kinds(candidates.kinds).includes(k)), "insights are a validated subset of candidates");
}

/* ── No approval / execution affordance in any Intelligence surface ── */
function noAuthorityOrExecution(): void {
  for (const path of COMPONENTS) {
    const src = read(path);
    assert.ok(!/\b(Approve|Reject|Authorize)\b/.test(src), `${path} exposes no Approve/Reject/Authorize control`);
    assert.ok(!/from\s+["'][^"']*(child_process|node:|shelljs)/.test(src), `${path} imports no process/shell substrate`);
    assert.ok(!/\beval\s*\(/.test(src), `${path} uses no eval`);
  }
}

/* ── Heby remains advisory on Intelligence ── */
function hebyAdvisory(): void {
  assert.equal(getHebyWorkspaceProfile("intelligence").authority, "advisory-only", "Intelligence Heby is advisory-only");
  assert.equal(HEBY_AUTHORITY_DESCRIPTORS["advisory-only"].hebyMayAct, false, "advisory Heby may not act");
}

function main(): void {
  noMockImports();
  runtimeTaxonomyIsSource();
  signalsHonest();
  candidatesHonest();
  insightsHonest();
  readinessHonest();
  recommendationsHonest();
  candidateIsNotInsight();
  noAuthorityOrExecution();
  hebyAdvisory();
  console.log("intelligence L2 honesty contract checks passed");
}

main();
