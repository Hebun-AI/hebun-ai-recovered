import assert from "node:assert/strict";
import type { EvidenceReference, EvidenceSet, ReasoningRelation } from "../../src/features/enterprise-memory-reasoning";
import {
  cardinalityOf,
  canonicalRelationKey,
  directionOf,
  isOneToOne,
  isSymmetric,
  normalizeRelation,
  normalizeRelationSet,
  normalizeRelations,
  validateRelationSet,
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

function rel(id: string, type: ReasoningRelation["type"], from: EvidenceReference, to: EvidenceReference): ReasoningRelation {
  return { relationId: id, type, from, to, describedBy: `${id}` };
}

function pairs(relations: readonly ReasoningRelation[]): string[] {
  return relations.map((r) => `${r.type}:${r.from.memoryId}->${r.to.memoryId}`);
}

// Type rules.
assert.equal(isSymmetric("relates-to"), true);
assert.equal(isSymmetric("supports"), false);
assert.equal(isOneToOne("supersedes"), true);
assert.equal(directionOf("supports"), "directed");
assert.equal(cardinalityOf("contradicts"), "many-to-many");

// Symmetric normalization: endpoints ordered canonically (a before b).
assert.deepEqual(pairs([normalizeRelation(rel("r1", "relates-to", eB, eA))]), ["relates-to:memory-a->memory-b"]);
// Directed relations are left as-is.
assert.deepEqual(pairs([normalizeRelation(rel("r2", "supports", eB, eA))]), ["supports:memory-b->memory-a"]);

// Symmetric duplicates (a-b and b-a) collapse to one; canonical keys match.
const dupA = rel("r3", "relates-to", eA, eB);
const dupB = rel("r4", "relates-to", eB, eA);
assert.equal(canonicalRelationKey(dupA), canonicalRelationKey(normalizeRelation(dupB)));
assert.equal(normalizeRelations([dupA, dupB]).length, 1);

// Directed a->b and b->a are distinct; both kept, deterministic order.
const directed = normalizeRelations([rel("r5", "supports", eB, eA), rel("r6", "supports", eA, eB)]);
assert.equal(directed.length, 2);
assert.deepEqual(directed, normalizeRelations([rel("r6", "supports", eA, eB), rel("r5", "supports", eB, eA)]));

// Validation: valid set passes.
assert.deepEqual(validateRelationSet([rel("r7", "supports", eA, eB)], evidence), { ok: true });
// Self-relation fails.
assert.equal(validateRelationSet([rel("r8", "relates-to", eA, eA)], evidence).ok, false);
// Undeclared evidence fails.
assert.equal(validateRelationSet([rel("r9", "supports", eA, eZ)], evidence).ok, false);
// One-to-one cardinality: one source superseding two targets fails.
assert.equal(
  validateRelationSet([rel("r10", "supersedes", eA, eB), rel("r11", "supersedes", eA, eC)], evidence).ok,
  false,
);
// One-to-one with distinct sources/targets passes.
assert.equal(validateRelationSet([rel("r12", "supersedes", eA, eB), rel("r13", "supersedes", eC, eA)], evidence).ok, true);

// Boundary: validate + normalize.
const ok = normalizeRelationSet({ relations: [rel("r14", "relates-to", eB, eA), rel("r15", "relates-to", eA, eB)] }, evidence);
assert.ok(ok.ok === true);
if (ok.ok) {
  assert.equal(ok.value.relations.length, 1);
  assert.equal(Object.isFrozen(ok.value.relations), true);
  assert.deepEqual(pairs(ok.value.relations), ["relates-to:memory-a->memory-b"]);
}
const bad = normalizeRelationSet({ relations: [rel("r16", "supports", eA, eZ)] }, evidence);
assert.equal(bad.ok, false);

// Deterministic repeat.
const input = { relations: [rel("r17", "relates-to", eB, eA), rel("r18", "supports", eA, eC)] };
const a = normalizeRelationSet(input, evidence);
const b = normalizeRelationSet(input, evidence);
assert.deepEqual(a, b);

console.log("Enterprise Memory Reasoning relation checks passed");
