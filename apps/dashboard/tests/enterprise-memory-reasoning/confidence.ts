import assert from "node:assert/strict";
import type {
  Confidence,
  ConfidenceChain,
  ConfidenceReference,
  ConfidenceSubjectKind,
  EvidenceReference,
  EvidenceSet,
  ReasoningConfidenceLevel,
  ReasoningContradiction,
  ReasoningGap,
  ReasoningImplication,
  ReasoningRelation,
  Uncertainty,
} from "../../src/features/enterprise-memory-reasoning";
import {
  canonicalConfidenceKey,
  compareConfidenceLevel,
  confidenceClassificationOf,
  confidenceEvidenceOf,
  confidenceFactorPolarityOf,
  confidenceLineageOf,
  confidenceRank,
  confidenceReachesEvidenceRoot,
  confidenceRequiresEvidenceRoot,
  confidenceRequiresUncertainty,
  confidenceSourceIsGrounding,
  confidenceSubjectPermits,
  evidenceKey,
  normalizeConfidence,
  normalizeConfidenceChain,
  normalizeConfidences,
  normalizeConfidenceSet,
  uncertaintyCategoryDescriptorOf,
  uncertaintyIsResolvable,
  validateConfidenceSet,
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

function ref(sourceKind: ConfidenceReference["sourceKind"], referenceId: string): ConfidenceReference {
  return { sourceKind, referenceId };
}
function chain(...references: ConfidenceReference[]): ConfidenceChain {
  return { references };
}
function conf(
  subjectKind: ConfidenceSubjectKind,
  subjectId: string,
  level: ReasoningConfidenceLevel,
  c: ConfidenceChain,
  uncertainties: Uncertainty[] = [],
  factors: Confidence["factors"] = [],
  assumptions: Confidence["assumptions"] = [],
  limitations: Confidence["limitations"] = [],
): Confidence {
  return { subject: { subjectKind, subjectId }, level, chain: c, factors, assumptions, limitations, uncertainties };
}

// Level descriptor rules + total ordering.
assert.equal(confidenceRank("low") < confidenceRank("verified"), true);
assert.equal(compareConfidenceLevel("low", "high") < 0, true);
assert.equal(compareConfidenceLevel("verified", "verified"), 0);
assert.equal(confidenceClassificationOf("medium"), "supported");
assert.equal(confidenceClassificationOf("verified"), "established");
assert.equal(confidenceRequiresUncertainty("low"), true);
assert.equal(confidenceRequiresUncertainty("verified"), false);

// Source + subject + factor + uncertainty descriptor rules.
assert.equal(confidenceSourceIsGrounding("evidence"), true);
assert.equal(confidenceSourceIsGrounding("relation"), false);
assert.equal(confidenceRequiresEvidenceRoot("gap"), true);
assert.equal(confidenceSubjectPermits("relation", "evidence"), true);
assert.equal(confidenceSubjectPermits("relation", "relation"), false);
assert.equal(confidenceSubjectPermits("implication", "relation"), true);
assert.equal(confidenceSubjectPermits("implication", "contradiction"), false);
assert.equal(confidenceSubjectPermits("gap", "contradiction"), true);
assert.equal(confidenceFactorPolarityOf("evidence-strength"), "supporting");
assert.equal(confidenceFactorPolarityOf("staleness"), "limiting");
assert.equal(uncertaintyIsResolvable("incompleteness"), true);
assert.equal(uncertaintyIsResolvable("scope"), false);
assert.equal(uncertaintyCategoryDescriptorOf("scope").isResolvable, false);

// Lineage + evidence projection + reaches-root.
const mixed = chain(ref("evidence", kA), ref("relation", "rel-1"), ref("evidence", kB));
const lin = confidenceLineageOf(mixed);
assert.deepEqual(lin.evidence.map((r) => r.referenceId), [kA, kB]);
assert.deepEqual(lin.relations.map((r) => r.referenceId), ["rel-1"]);
assert.equal(confidenceEvidenceOf(mixed).references.length, 2);
assert.equal(confidenceReachesEvidenceRoot(mixed), true);
assert.equal(confidenceReachesEvidenceRoot(chain(ref("relation", "rel-1"))), false);

// Normalization: chain refs dedup + total order.
const nc = normalizeConfidenceChain(chain(ref("evidence", kB), ref("evidence", kA), ref("evidence", kA)));
assert.deepEqual(nc.references.map((r) => r.referenceId), [kA, kB]);

// Uncertainty + factor + assumption + limitation dedup within a record.
const un1: Uncertainty = { category: "incompleteness", reason: { statement: "c missing" }, sources: [{ sourceKind: "gap", sourceId: "gap-1" }] };
const un1dup: Uncertainty = { category: "incompleteness", reason: { statement: "c missing" }, sources: [{ sourceKind: "gap", sourceId: "gap-1" }, { sourceKind: "gap", sourceId: "gap-1" }] };
const normRecord = normalizeConfidence(
  conf("implication", "imp-1", "medium", chain(ref("relation", "rel-1"), ref("evidence", kA), ref("evidence", kA)), [un1, un1dup], ["recency", "recency", "corroboration"], [{ statement: "x" }, { statement: "x" }], [{ statement: "y" }, { statement: "y" }]),
);
assert.equal(normRecord.chain.references.length, 2);
assert.deepEqual(normRecord.factors, ["corroboration", "recency"]);
assert.equal(normRecord.assumptions.length, 1);
assert.equal(normRecord.limitations.length, 1);
assert.equal(normRecord.uncertainties.length, 1);
assert.equal(normRecord.uncertainties[0].sources.length, 1);

// Canonical key is order-independent within each set.
assert.equal(
  canonicalConfidenceKey(conf("implication", "imp-1", "high", chain(ref("evidence", kA), ref("relation", "rel-1")), [], ["recency", "corroboration"])),
  canonicalConfidenceKey(conf("implication", "imp-1", "high", chain(ref("relation", "rel-1"), ref("evidence", kA)), [], ["corroboration", "recency"])),
);
// But level is significant.
assert.notEqual(
  canonicalConfidenceKey(conf("relation", "rel-1", "high", chain(ref("evidence", kA)))),
  canonicalConfidenceKey(conf("relation", "rel-1", "low", chain(ref("evidence", kA)), [un1])),
);

// Duplicate confidence records collapse to one.
assert.equal(
  normalizeConfidences([
    conf("relation", "rel-1", "high", chain(ref("evidence", kA), ref("evidence", kB))),
    conf("relation", "rel-1", "high", chain(ref("evidence", kB), ref("evidence", kA))),
  ]).length,
  1,
);

// Validation: valid records pass for each subject kind.
assert.deepEqual(
  validateConfidenceSet([conf("relation", "rel-1", "verified", chain(ref("evidence", kA), ref("evidence", kB)))], evidence, relations, implications, contradictions, gaps),
  { ok: true },
);
assert.equal(
  validateConfidenceSet([conf("implication", "imp-1", "high", chain(ref("evidence", kA), ref("relation", "rel-1")))], evidence, relations, implications, contradictions, gaps).ok,
  true,
);
assert.equal(
  validateConfidenceSet([conf("gap", "gap-1", "medium", chain(ref("evidence", kC), ref("contradiction", "con-1")), [un1])], evidence, relations, implications, contradictions, gaps).ok,
  true,
);

// Weak level without uncertainty fails.
assert.equal(
  validateConfidenceSet([conf("relation", "rel-1", "low", chain(ref("evidence", kA)))], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Forbidden source (relation resting on a relation) fails.
assert.equal(
  validateConfidenceSet([conf("relation", "rel-1", "verified", chain(ref("evidence", kA), ref("relation", "rel-1")))], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Self-reference fails.
assert.equal(
  validateConfidenceSet([conf("implication", "imp-1", "verified", chain(ref("evidence", kA), ref("implication", "imp-1")))], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Missing evidence root fails.
assert.equal(
  validateConfidenceSet([conf("implication", "imp-1", "verified", chain(ref("relation", "rel-1")))], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Undeclared subject fails.
assert.equal(
  validateConfidenceSet([conf("relation", "rel-x", "verified", chain(ref("evidence", kA)))], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Undeclared reference fails.
assert.equal(
  validateConfidenceSet([conf("implication", "imp-1", "verified", chain(ref("evidence", kA), ref("relation", "rel-x")))], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Empty chain fails.
assert.equal(
  validateConfidenceSet([conf("relation", "rel-1", "verified", chain())], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Uncertainty with empty reason fails.
assert.equal(
  validateConfidenceSet([conf("gap", "gap-1", "medium", chain(ref("evidence", kC)), [{ category: "scope", reason: { statement: "" }, sources: [] }])], evidence, relations, implications, contradictions, gaps).ok,
  false,
);
// Uncertainty citing undeclared source fails.
assert.equal(
  validateConfidenceSet([conf("gap", "gap-1", "medium", chain(ref("evidence", kC)), [{ category: "incompleteness", reason: { statement: "x" }, sources: [{ sourceKind: "relation", sourceId: "rel-x" }] }])], evidence, relations, implications, contradictions, gaps).ok,
  false,
);

// Boundary: validate + normalize collapses duplicates and freezes.
const ok = normalizeConfidenceSet(
  {
    confidences: [
      conf("relation", "rel-1", "high", chain(ref("evidence", kB), ref("evidence", kA))),
      conf("relation", "rel-1", "high", chain(ref("evidence", kA), ref("evidence", kB))),
    ],
  },
  evidence,
  relations,
  implications,
  contradictions,
  gaps,
);
assert.ok(ok.ok === true);
if (ok.ok) {
  assert.equal(ok.value.confidences.length, 1);
  assert.equal(Object.isFrozen(ok.value.confidences), true);
}
const bad = normalizeConfidenceSet(
  { confidences: [conf("implication", "imp-1", "verified", chain(ref("relation", "rel-1")))] },
  evidence,
  relations,
  implications,
  contradictions,
  gaps,
);
assert.equal(bad.ok, false);

// Deterministic repeat.
const input = {
  confidences: [
    conf("gap", "gap-1", "medium", chain(ref("evidence", kC), ref("contradiction", "con-1")), [un1]),
    conf("relation", "rel-1", "verified", chain(ref("evidence", kA), ref("evidence", kB))),
  ],
};
assert.deepEqual(
  normalizeConfidenceSet(input, evidence, relations, implications, contradictions, gaps),
  normalizeConfidenceSet(input, evidence, relations, implications, contradictions, gaps),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalConfidenceKey(conf("relation", "rel-1", "verified", chain(ref("evidence", "a\u0000b")))),
  canonicalConfidenceKey(conf("relation", "rel-1", "verified", chain(ref("evidence", "ab")))),
);
assert.equal(
  canonicalConfidenceKey(conf("relation", "rel-1", "verified", chain(ref("evidence", "köken")))),
  canonicalConfidenceKey(conf("relation", "rel-1", "verified", chain(ref("evidence", "köken")))),
);

console.log("Enterprise Memory Reasoning confidence checks passed");
