import assert from "node:assert/strict";
import type {
  ClassifiedImplication,
  EvidenceReference,
  EvidenceSet,
  ImplicationType,
  ReasoningImplication,
  ReasoningRelation,
} from "../../src/features/enterprise-memory-reasoning";
import {
  canonicalImplicationKey,
  implicationDirectionOf,
  implicationIsBidirectional,
  implicationMinimumBasis,
  implicationRequiresRelation,
  normalizeImplication,
  normalizeImplicationSet,
  normalizeImplications,
  validateImplicationSet,
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
  { relationId: "rel-1", type: "supports", from: eA, to: eB, describedBy: "a supports b" },
];

function imp(id: string, statement: string, basis: readonly EvidenceReference[], derivedFrom: readonly string[]): ReasoningImplication {
  return { implicationId: id, statement, basis, derivedFrom };
}
function classified(type: ImplicationType, implication: ReasoningImplication): ClassifiedImplication {
  return { type, implication };
}

// Type rules.
assert.equal(implicationRequiresRelation("entailment"), true);
assert.equal(implicationRequiresRelation("support"), false);
assert.equal(implicationMinimumBasis("equivalence"), 2);
assert.equal(implicationIsBidirectional("equivalence"), true);
assert.equal(implicationDirectionOf("support"), "forward");

// Normalization: dedup + order basis and dependencies.
const messy = classified("support", imp("i1", "b follows", [eB, eA, eA], ["rel-2", "rel-1", "rel-1"]));
const normalized = normalizeImplication(messy);
assert.deepEqual(normalized.implication.basis.map((r) => r.memoryId), ["memory-a", "memory-b"]);
assert.deepEqual([...normalized.implication.derivedFrom], ["rel-1", "rel-2"]);

// Canonical key is order-independent within basis.
assert.equal(
  canonicalImplicationKey(classified("support", imp("i2", "s", [eA, eB], []))),
  canonicalImplicationKey(classified("support", imp("i3", "s", [eB, eA], []))),
);

// Duplicate classified implications collapse to one.
assert.equal(
  normalizeImplications([
    classified("support", imp("i4", "s", [eA], [])),
    classified("support", imp("i5", "s", [eA], [])),
  ]).length,
  1,
);

// Validation: a valid support implication passes.
assert.deepEqual(validateImplicationSet([classified("support", imp("i6", "s", [eA], []))], evidence, relations), { ok: true });
// Entailment without a relation fails.
assert.equal(validateImplicationSet([classified("entailment", imp("i7", "s", [eA], []))], evidence, relations).ok, false);
// Entailment with a declared relation passes.
assert.equal(validateImplicationSet([classified("entailment", imp("i8", "s", [eA], ["rel-1"]))], evidence, relations).ok, true);
// Equivalence with a single-item basis fails the minimum.
assert.equal(validateImplicationSet([classified("equivalence", imp("i9", "s", [eA], ["rel-1"]))], evidence, relations).ok, false);
// Undeclared evidence fails.
assert.equal(validateImplicationSet([classified("support", imp("i10", "s", [eZ], []))], evidence, relations).ok, false);
// Undeclared relation dependency fails.
assert.equal(validateImplicationSet([classified("entailment", imp("i11", "s", [eA], ["rel-x"]))], evidence, relations).ok, false);
// Empty statement fails.
assert.equal(validateImplicationSet([classified("support", imp("i12", "", [eA], []))], evidence, relations).ok, false);

// Boundary: validate + normalize.
const ok = normalizeImplicationSet(
  { implications: [classified("support", imp("i13", "s", [eB, eA], [])), classified("support", imp("i14", "s", [eA, eB], []))] },
  evidence,
  relations,
);
assert.ok(ok.ok === true);
if (ok.ok) {
  assert.equal(ok.value.implications.length, 1);
  assert.equal(Object.isFrozen(ok.value.implications), true);
}
const bad = normalizeImplicationSet({ implications: [classified("entailment", imp("i15", "s", [eA], []))] }, evidence, relations);
assert.equal(bad.ok, false);

// Deterministic repeat.
const input = { implications: [classified("support", imp("i16", "s", [eC], [])), classified("elaboration", imp("i17", "d", [eA], []))] };
assert.deepEqual(normalizeImplicationSet(input, evidence, relations), normalizeImplicationSet(input, evidence, relations));

console.log("Enterprise Memory Reasoning implication checks passed");
