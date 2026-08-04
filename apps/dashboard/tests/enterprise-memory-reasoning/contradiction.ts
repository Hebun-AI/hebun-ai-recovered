import assert from "node:assert/strict";
import type {
  ClassifiedContradiction,
  ContradictionType,
  EvidenceReference,
  EvidenceSet,
  ReasoningContradiction,
  ReasoningImplication,
  ReasoningRelation,
} from "../../src/features/enterprise-memory-reasoning";
import {
  canonicalContradictionKey,
  contradictionIsCollective,
  contradictionMinimumBetween,
  contradictionRequiresImplication,
  contradictionRequiresRelation,
  contradictionScopeOf,
  contradictionSeverityOf,
  normalizeContradiction,
  normalizeContradictions,
  normalizeContradictionSet,
  validateContradictionSet,
} from "../../src/features/enterprise-memory-reasoning";

const ns = "enterprise-1";
const eA: EvidenceReference = { memoryId: "memory-a", namespace: ns, version: 1 };
const eB: EvidenceReference = { memoryId: "memory-b", namespace: ns, version: 1 };
const eC: EvidenceReference = { memoryId: "memory-c", namespace: ns, version: 1 };
const eZ: EvidenceReference = { memoryId: "memory-z", namespace: ns, version: 9 };

const evidence: EvidenceSet = {
  items: [
    { reference: eA, describedBy: "a" },
    { reference: eB, describedBy: "b" },
    { reference: eC, describedBy: "c" },
  ],
};
const relations: readonly ReasoningRelation[] = [
  { relationId: "rel-1", type: "supersedes", from: eB, to: eA, describedBy: "b supersedes a" },
];
const implications: readonly ReasoningImplication[] = [
  { implicationId: "imp-1", statement: "b follows", basis: [eA, eB], derivedFrom: ["rel-1"] },
];

function con(id: string, statement: string, between: readonly EvidenceReference[]): ReasoningContradiction {
  return { contradictionId: id, statement, between };
}
function classified(
  type: ContradictionType,
  contradiction: ReasoningContradiction,
  rel: readonly string[] = [],
  imp: readonly string[] = [],
): ClassifiedContradiction {
  return { type, contradiction, dependencies: { relations: rel, implications: imp } };
}

// Type rules.
assert.equal(contradictionSeverityOf("direct"), "blocking");
assert.equal(contradictionSeverityOf("partial"), "minor");
assert.equal(contradictionRequiresRelation("temporal"), true);
assert.equal(contradictionRequiresRelation("direct"), false);
assert.equal(contradictionRequiresImplication("derived"), true);
assert.equal(contradictionScopeOf("derived"), "collective");
assert.equal(contradictionIsCollective("derived"), true);
assert.equal(contradictionMinimumBetween("derived"), 3);
assert.equal(contradictionMinimumBetween("direct"), 2);

// Normalization: dedup + order span and dependencies.
const messy = classified("temporal", con("c1", "a and b clash", [eB, eA, eA]), ["rel-2", "rel-1", "rel-1"]);
const normalized = normalizeContradiction(messy);
assert.deepEqual(normalized.contradiction.between.map((r) => r.memoryId), ["memory-a", "memory-b"]);
assert.deepEqual([...normalized.dependencies.relations], ["rel-1", "rel-2"]);

// Canonical key is order-independent within the span.
assert.equal(
  canonicalContradictionKey(classified("direct", con("c2", "s", [eA, eB]))),
  canonicalContradictionKey(classified("direct", con("c3", "s", [eB, eA]))),
);

// Duplicate classified contradictions collapse to one.
assert.equal(
  normalizeContradictions([
    classified("direct", con("c4", "s", [eA, eB])),
    classified("direct", con("c5", "s", [eB, eA])),
  ]).length,
  1,
);

// Validation: a valid direct contradiction passes.
assert.deepEqual(
  validateContradictionSet([classified("direct", con("c6", "s", [eA, eB]))], evidence, relations, implications),
  { ok: true },
);
// Temporal without a relation fails.
assert.equal(
  validateContradictionSet([classified("temporal", con("c7", "s", [eA, eB]))], evidence, relations, implications).ok,
  false,
);
// Temporal with a declared relation passes.
assert.equal(
  validateContradictionSet([classified("temporal", con("c8", "s", [eA, eB]), ["rel-1"])], evidence, relations, implications).ok,
  true,
);
// Derived without an implication fails.
assert.equal(
  validateContradictionSet([classified("derived", con("c9", "s", [eA, eB, eC]))], evidence, relations, implications).ok,
  false,
);
// Derived with a declared implication passes.
assert.equal(
  validateContradictionSet([classified("derived", con("c10", "s", [eA, eB, eC]), [], ["imp-1"])], evidence, relations, implications).ok,
  true,
);
// Derived below the collective minimum fails.
assert.equal(
  validateContradictionSet([classified("derived", con("c11", "s", [eA, eB]), [], ["imp-1"])], evidence, relations, implications).ok,
  false,
);
// Undeclared evidence fails.
assert.equal(
  validateContradictionSet([classified("direct", con("c12", "s", [eA, eZ]))], evidence, relations, implications).ok,
  false,
);
// Undeclared relation dependency fails.
assert.equal(
  validateContradictionSet([classified("temporal", con("c13", "s", [eA, eB]), ["rel-x"])], evidence, relations, implications).ok,
  false,
);
// Undeclared implication dependency fails.
assert.equal(
  validateContradictionSet([classified("derived", con("c14", "s", [eA, eB, eC]), [], ["imp-x"])], evidence, relations, implications).ok,
  false,
);
// Empty statement fails.
assert.equal(
  validateContradictionSet([classified("direct", con("c15", "", [eA, eB]))], evidence, relations, implications).ok,
  false,
);

// Boundary: validate + normalize collapses duplicates and freezes.
const ok = normalizeContradictionSet(
  { contradictions: [classified("direct", con("c16", "s", [eB, eA])), classified("direct", con("c17", "s", [eA, eB]))] },
  evidence,
  relations,
  implications,
);
assert.ok(ok.ok === true);
if (ok.ok) {
  assert.equal(ok.value.contradictions.length, 1);
  assert.equal(Object.isFrozen(ok.value.contradictions), true);
}
const bad = normalizeContradictionSet(
  { contradictions: [classified("temporal", con("c18", "s", [eA, eB]))] },
  evidence,
  relations,
  implications,
);
assert.equal(bad.ok, false);

// Deterministic repeat.
const input = {
  contradictions: [classified("direct", con("c19", "s", [eC, eA])), classified("partial", con("c20", "p", [eA, eB]))],
};
assert.deepEqual(
  normalizeContradictionSet(input, evidence, relations, implications),
  normalizeContradictionSet(input, evidence, relations, implications),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalContradictionKey(classified("direct", con("cN1", "a\u0000b", [eA, eB]))),
  canonicalContradictionKey(classified("direct", con("cN2", "ab", [eA, eB]))),
);
assert.equal(
  canonicalContradictionKey(classified("direct", con("cU1", "\u00e7eli\u015fki", [eA, eB]))),
  canonicalContradictionKey(classified("direct", con("cU2", "\u00e7eli\u015fki", [eA, eB]))),
);

console.log("Enterprise Memory Reasoning contradiction checks passed");
