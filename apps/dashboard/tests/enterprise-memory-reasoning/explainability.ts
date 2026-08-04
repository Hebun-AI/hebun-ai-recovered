import assert from "node:assert/strict";
import type {
  EvidenceReference,
  EvidenceSet,
  Explanation,
  ExplanationChain,
  ExplanationKind,
  ExplanationReference,
  ExplanationStep,
  Provenance,
  ReasoningContradiction,
  ReasoningGap,
  ReasoningImplication,
  ReasoningRelation,
} from "../../src/features/enterprise-memory-reasoning";
import {
  canonicalExplanationKey,
  evidenceKey,
  explanationIsGrounded,
  explanationLineageOf,
  explanationPermitsReference,
  explanationRequiresEvidenceRoot,
  normalizeExplanation,
  normalizeExplanationChain,
  normalizeExplanations,
  normalizeExplanationSet,
  reachesEvidenceRoot,
  referencesOf,
  validateExplanationSet,
} from "../../src/features/enterprise-memory-reasoning";

const ns = "enterprise-1";
const eA: EvidenceReference = { memoryId: "memory-a", namespace: ns, version: 1 };
const eB: EvidenceReference = { memoryId: "memory-b", namespace: ns, version: 1 };
const eC: EvidenceReference = { memoryId: "memory-c", namespace: ns, version: 1 };
const kA = evidenceKey(eA);
const kB = evidenceKey(eB);
const kC = evidenceKey(eC);

const evidence: EvidenceSet = {
  items: [
    { reference: eA, describedBy: "a" },
    { reference: eB, describedBy: "b" },
    { reference: eC, describedBy: "c" },
  ],
};
const relations: readonly ReasoningRelation[] = [
  { relationId: "rel-1", type: "supports", from: eA, to: eB, describedBy: "a supports b" },
];
const implications: readonly ReasoningImplication[] = [
  { implicationId: "imp-1", statement: "b follows", basis: [eA, eB], derivedFrom: ["rel-1"] },
];
const contradictions: readonly ReasoningContradiction[] = [
  { contradictionId: "con-1", statement: "a and b clash", between: [eA, eB] },
];
const gaps: readonly ReasoningGap[] = [{ gapId: "gap-1", statement: "c uncovered", relatedTo: [eC] }];
const provenances: readonly Provenance[] = [
  { artifactKind: "relation", artifactId: "rel-1", chain: { references: [{ sourceKind: "evidence", sourceId: kA }] } },
];

function ref(referenceKind: ExplanationReference["referenceKind"], referenceId: string): ExplanationReference {
  return { referenceKind, referenceId };
}
function step(statement: string, ...references: ExplanationReference[]): ExplanationStep {
  return { statement, references };
}
function chain(...steps: ExplanationStep[]): ExplanationChain {
  return { steps };
}
function expl(kind: ExplanationKind, subjectId: string, c: ExplanationChain): Explanation {
  return { explanationKind: kind, subject: { subjectKind: kind, subjectId }, chain: c };
}

// Kind descriptor rules.
assert.equal(explanationIsGrounded("evidence"), true);
assert.equal(explanationIsGrounded("relation"), false);
assert.equal(explanationRequiresEvidenceRoot("provenance"), true);
assert.equal(explanationPermitsReference("relation", "evidence"), true);
assert.equal(explanationPermitsReference("relation", "relation"), false);
assert.equal(explanationPermitsReference("implication", "relation"), true);
assert.equal(explanationPermitsReference("implication", "contradiction"), false);
assert.equal(explanationPermitsReference("gap", "contradiction"), true);
assert.equal(explanationPermitsReference("provenance", "gap"), true);

// Lineage + reference flattening preserve walk order and bucket by kind.
const walked = chain(
  step("grounds in a", ref("evidence", kA)),
  step("relates to b via rel-1", ref("relation", "rel-1"), ref("evidence", kB)),
  step("so imp-1 follows", ref("implication", "imp-1")),
);
assert.equal(referencesOf(walked).length, 4);
const lin = explanationLineageOf(walked);
assert.deepEqual(lin.evidence.map((r) => r.referenceId), [kA, kB]);
assert.deepEqual(lin.relations.map((r) => r.referenceId), ["rel-1"]);
assert.deepEqual(lin.implications.map((r) => r.referenceId), ["imp-1"]);
assert.equal(reachesEvidenceRoot(walked), true);
assert.equal(reachesEvidenceRoot(chain(step("no root", ref("relation", "rel-1")))), false);

// Normalization: references within a step dedup + total order; step order preserved.
const messyStep = step("b via rel", ref("evidence", kB), ref("evidence", kA), ref("evidence", kA));
const nc = normalizeExplanationChain(chain(messyStep));
assert.deepEqual(nc.steps[0].references.map((r) => r.referenceId), [kA, kB]);

// Exact-duplicate steps collapse; distinct steps and their order stay.
const dupSteps = chain(
  step("first", ref("evidence", kA)),
  step("first", ref("evidence", kA)),
  step("second", ref("evidence", kB)),
);
const ncDup = normalizeExplanationChain(dupSteps);
assert.equal(ncDup.steps.length, 2);
assert.deepEqual(ncDup.steps.map((s) => s.statement), ["first", "second"]);

// Step order is significant: reordered walks are distinct explanations.
assert.notEqual(
  canonicalExplanationKey(
    expl("implication", "imp-1", chain(step("a", ref("evidence", kA)), step("b", ref("relation", "rel-1")))),
  ),
  canonicalExplanationKey(
    expl("implication", "imp-1", chain(step("b", ref("relation", "rel-1")), step("a", ref("evidence", kA)))),
  ),
);
// But reference order WITHIN a step is not significant.
assert.equal(
  canonicalExplanationKey(expl("relation", "rel-1", chain(step("s", ref("evidence", kA), ref("evidence", kB))))),
  canonicalExplanationKey(expl("relation", "rel-1", chain(step("s", ref("evidence", kB), ref("evidence", kA))))),
);

// normalizeExplanation returns a canonicalized copy.
const np = normalizeExplanation(expl("relation", "rel-1", chain(messyStep)));
assert.equal(np.chain.steps[0].references.length, 2);

// Duplicate explanation records collapse to one.
assert.equal(
  normalizeExplanations([
    expl("relation", "rel-1", chain(step("s", ref("evidence", kA), ref("evidence", kB)))),
    expl("relation", "rel-1", chain(step("s", ref("evidence", kB), ref("evidence", kA)))),
  ]).length,
  1,
);

// Validation: valid explanations pass for each kind.
assert.deepEqual(
  validateExplanationSet(
    [expl("evidence", kA, chain(step("memory a", ref("evidence", kA))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ),
  { ok: true },
);
assert.equal(
  validateExplanationSet(
    [expl("relation", "rel-1", chain(step("a supports b", ref("evidence", kA), ref("evidence", kB))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  true,
);
assert.equal(
  validateExplanationSet(
    [expl("implication", "imp-1", chain(step("b follows", ref("evidence", kA), ref("relation", "rel-1"))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  true,
);
assert.equal(
  validateExplanationSet(
    [expl("gap", "gap-1", chain(step("c uncovered", ref("evidence", kC), ref("contradiction", "con-1"))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  true,
);
// Provenance explanation over rel-1's chain passes.
assert.equal(
  validateExplanationSet(
    [expl("provenance", "rel-1", chain(step("rel-1 grounds in a", ref("evidence", kA), ref("relation", "rel-1"))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  true,
);

// Forbidden reference kind (relation explanation citing a relation) fails.
assert.equal(
  validateExplanationSet(
    [expl("relation", "rel-1", chain(step("x", ref("evidence", kA), ref("relation", "rel-1"))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);
// Derived explanation citing itself fails.
assert.equal(
  validateExplanationSet(
    [expl("implication", "imp-1", chain(step("x", ref("evidence", kA), ref("implication", "imp-1"))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);
// Missing evidence root fails.
assert.equal(
  validateExplanationSet(
    [expl("implication", "imp-1", chain(step("x", ref("relation", "rel-1"))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);
// Undeclared subject fails.
assert.equal(
  validateExplanationSet(
    [expl("relation", "rel-x", chain(step("x", ref("evidence", kA))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);
// Undeclared reference fails.
assert.equal(
  validateExplanationSet(
    [expl("implication", "imp-1", chain(step("x", ref("evidence", kA), ref("relation", "rel-x"))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);
// Empty statement fails.
assert.equal(
  validateExplanationSet(
    [expl("relation", "rel-1", chain(step("", ref("evidence", kA))))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);
// No steps fails.
assert.equal(
  validateExplanationSet(
    [expl("relation", "rel-1", chain())],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);
// Mismatched subject kind fails.
assert.equal(
  validateExplanationSet(
    [{ explanationKind: "relation", subject: { subjectKind: "gap", subjectId: "gap-1" }, chain: chain(step("x", ref("evidence", kA))) }],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
  ).ok,
  false,
);

// Boundary: validate + normalize collapses duplicates and freezes.
const ok = normalizeExplanationSet(
  {
    explanations: [
      expl("relation", "rel-1", chain(step("s", ref("evidence", kB), ref("evidence", kA)))),
      expl("relation", "rel-1", chain(step("s", ref("evidence", kA), ref("evidence", kB)))),
    ],
  },
  evidence,
  relations,
  implications,
  contradictions,
  gaps,
  provenances,
);
assert.ok(ok.ok === true);
if (ok.ok) {
  assert.equal(ok.value.explanations.length, 1);
  assert.equal(Object.isFrozen(ok.value.explanations), true);
}
const bad = normalizeExplanationSet(
  { explanations: [expl("implication", "imp-1", chain(step("x", ref("relation", "rel-1"))))] },
  evidence,
  relations,
  implications,
  contradictions,
  gaps,
  provenances,
);
assert.equal(bad.ok, false);

// Deterministic repeat.
const input = {
  explanations: [
    expl("gap", "gap-1", chain(step("c uncovered", ref("evidence", kC), ref("contradiction", "con-1")))),
    expl("relation", "rel-1", chain(step("a supports b", ref("evidence", kA), ref("evidence", kB)))),
  ],
};
assert.deepEqual(
  normalizeExplanationSet(input, evidence, relations, implications, contradictions, gaps, provenances),
  normalizeExplanationSet(input, evidence, relations, implications, contradictions, gaps, provenances),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalExplanationKey(expl("relation", "rel-1", chain(step("a\u0000b", ref("evidence", kA))))),
  canonicalExplanationKey(expl("relation", "rel-1", chain(step("ab", ref("evidence", kA))))),
);
assert.equal(
  canonicalExplanationKey(expl("relation", "rel-1", chain(step("köken", ref("evidence", kA))))),
  canonicalExplanationKey(expl("relation", "rel-1", chain(step("köken", ref("evidence", kA))))),
);

console.log("Enterprise Memory Reasoning explainability checks passed");
