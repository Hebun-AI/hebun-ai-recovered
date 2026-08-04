import assert from "node:assert/strict";
import type {
  EvidenceReference,
  EvidenceSet,
  Provenance,
  ProvenanceArtifactKind,
  ProvenanceChain,
  ProvenanceReference,
  ReasoningContradiction,
  ReasoningGap,
  ReasoningImplication,
  ReasoningRelation,
} from "../../src/features/enterprise-memory-reasoning";
import {
  canonicalProvenanceKey,
  dependencyLineageOf,
  evidenceKey,
  lineageOf,
  normalizeChain,
  normalizeProvenance,
  normalizeProvenances,
  normalizeProvenanceSet,
  provenanceArtifactPermits,
  provenanceRequiresEvidenceRoot,
  provenanceSourceIsRoot,
  validateProvenanceSet,
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

function ref(sourceKind: ProvenanceReference["sourceKind"], sourceId: string): ProvenanceReference {
  return { sourceKind, sourceId };
}
function chain(...references: ProvenanceReference[]): ProvenanceChain {
  return { references };
}
function prov(artifactKind: ProvenanceArtifactKind, artifactId: string, c: ProvenanceChain): Provenance {
  return { artifactKind, artifactId, chain: c };
}

// Source + artifact rules.
assert.equal(provenanceSourceIsRoot("evidence"), true);
assert.equal(provenanceSourceIsRoot("relation"), false);
assert.equal(provenanceRequiresEvidenceRoot("gap"), true);
assert.equal(provenanceArtifactPermits("relation", "evidence"), true);
assert.equal(provenanceArtifactPermits("relation", "relation"), false);
assert.equal(provenanceArtifactPermits("implication", "relation"), true);
assert.equal(provenanceArtifactPermits("implication", "contradiction"), false);
assert.equal(provenanceArtifactPermits("gap", "contradiction"), true);

// Lineage partition preserves order and buckets by kind.
const mixed = chain(ref("evidence", kA), ref("relation", "rel-1"), ref("evidence", kB), ref("implication", "imp-1"));
const lin = lineageOf(mixed);
assert.deepEqual(lin.evidence.map((r) => r.sourceId), [kA, kB]);
assert.deepEqual(lin.relations.map((r) => r.sourceId), ["rel-1"]);
assert.deepEqual(lin.implications.map((r) => r.sourceId), ["imp-1"]);
assert.equal(dependencyLineageOf(mixed).length, 2);

// Normalization: dedup + total order within a chain.
const messy = chain(ref("evidence", kB), ref("evidence", kA), ref("evidence", kA));
const nc = normalizeChain(messy);
assert.deepEqual(nc.references.map((r) => r.sourceId), [kA, kB]);
const np = normalizeProvenance(prov("relation", "rel-1", messy));
assert.equal(np.chain.references.length, 2);

// Canonical key is order-independent within the chain.
assert.equal(
  canonicalProvenanceKey(prov("implication", "imp-1", chain(ref("evidence", kA), ref("relation", "rel-1")))),
  canonicalProvenanceKey(prov("implication", "imp-1", chain(ref("relation", "rel-1"), ref("evidence", kA)))),
);

// Duplicate provenance records collapse to one.
assert.equal(
  normalizeProvenances([
    prov("relation", "rel-1", chain(ref("evidence", kA), ref("evidence", kB))),
    prov("relation", "rel-1", chain(ref("evidence", kB), ref("evidence", kA))),
  ]).length,
  1,
);

// Validation: a valid relation provenance passes.
assert.deepEqual(
  validateProvenanceSet(
    [prov("relation", "rel-1", chain(ref("evidence", kA), ref("evidence", kB)))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  ),
  { ok: true },
);
// Implication resting on evidence + relation passes.
assert.equal(
  validateProvenanceSet(
    [prov("implication", "imp-1", chain(ref("evidence", kA), ref("relation", "rel-1")))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  ).ok,
  true,
);
// Gap resting on evidence + contradiction passes.
assert.equal(
  validateProvenanceSet(
    [prov("gap", "gap-1", chain(ref("evidence", kC), ref("contradiction", "con-1")))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  ).ok,
  true,
);
// Forbidden source kind (relation citing a relation) fails.
assert.equal(
  validateProvenanceSet(
    [prov("relation", "rel-1", chain(ref("evidence", kA), ref("relation", "rel-1")))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  ).ok,
  false,
);
// Missing evidence root fails.
assert.equal(
  validateProvenanceSet(
    [prov("implication", "imp-1", chain(ref("relation", "rel-1")))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  ).ok,
  false,
);
// Undeclared artifact fails.
assert.equal(
  validateProvenanceSet(
    [prov("relation", "rel-x", chain(ref("evidence", kA)))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  ).ok,
  false,
);
// Undeclared source reference fails.
assert.equal(
  validateProvenanceSet(
    [prov("implication", "imp-1", chain(ref("evidence", kA), ref("relation", "rel-x")))],
    evidence,
    relations,
    implications,
    contradictions,
    gaps,
  ).ok,
  false,
);
// Empty chain fails.
assert.equal(
  validateProvenanceSet([prov("relation", "rel-1", chain())], evidence, relations, implications, contradictions, gaps).ok,
  false,
);

// Boundary: validate + normalize collapses duplicates and freezes.
const ok = normalizeProvenanceSet(
  {
    provenances: [
      prov("relation", "rel-1", chain(ref("evidence", kB), ref("evidence", kA))),
      prov("relation", "rel-1", chain(ref("evidence", kA), ref("evidence", kB))),
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
  assert.equal(ok.value.provenances.length, 1);
  assert.equal(Object.isFrozen(ok.value.provenances), true);
}
const bad = normalizeProvenanceSet(
  { provenances: [prov("implication", "imp-1", chain(ref("relation", "rel-1")))] },
  evidence,
  relations,
  implications,
  contradictions,
  gaps,
);
assert.equal(bad.ok, false);

// Deterministic repeat.
const input = {
  provenances: [
    prov("gap", "gap-1", chain(ref("evidence", kC), ref("contradiction", "con-1"))),
    prov("contradiction", "con-1", chain(ref("evidence", kA), ref("evidence", kB))),
  ],
};
assert.deepEqual(
  normalizeProvenanceSet(input, evidence, relations, implications, contradictions, gaps),
  normalizeProvenanceSet(input, evidence, relations, implications, contradictions, gaps),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalProvenanceKey(prov("relation", "rel-1", chain(ref("evidence", "a\u0000b")))),
  canonicalProvenanceKey(prov("relation", "rel-1", chain(ref("evidence", "ab")))),
);
assert.equal(
  canonicalProvenanceKey(prov("relation", "rel-1", chain(ref("evidence", "k\u00f6ken")))),
  canonicalProvenanceKey(prov("relation", "rel-1", chain(ref("evidence", "k\u00f6ken")))),
);

console.log("Enterprise Memory Reasoning provenance checks passed");
