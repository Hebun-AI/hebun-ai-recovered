import assert from "node:assert/strict";
import type {
  ClassifiedGap,
  EvidenceReference,
  EvidenceSet,
  GapType,
  ReasoningContradiction,
  ReasoningGap,
  ReasoningImplication,
  ReasoningRelation,
} from "../../src/features/enterprise-memory-reasoning";
import {
  canonicalGapKey,
  gapCategoryOf,
  gapIsContextual,
  gapMinimumRelated,
  gapRequiresReference,
  gapScopeOf,
  gapSeverityOf,
  normalizeGap,
  normalizeGaps,
  normalizeGapSet,
  validateGapSet,
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
const implications: readonly ReasoningImplication[] = [
  { implicationId: "imp-1", statement: "b follows", basis: [eA, eB], derivedFrom: ["rel-1"] },
];
const contradictions: readonly ReasoningContradiction[] = [
  { contradictionId: "con-1", statement: "a and b clash", between: [eA, eB] },
];

function gap(id: string, statement: string, relatedTo: readonly EvidenceReference[]): ReasoningGap {
  return { gapId: id, statement, relatedTo };
}
function classified(
  type: GapType,
  g: ReasoningGap,
  rel: readonly string[] = [],
  imp: readonly string[] = [],
  con: readonly string[] = [],
): ClassifiedGap {
  return { type, gap: g, dependencies: { relations: rel, implications: imp, contradictions: con } };
}

// Type rules.
assert.equal(gapCategoryOf("missing-evidence"), "grounding");
assert.equal(gapCategoryOf("missing-relation"), "structural");
assert.equal(gapCategoryOf("coverage"), "coverage");
assert.equal(gapSeverityOf("missing-evidence"), "high");
assert.equal(gapSeverityOf("unresolved-contradiction"), "high");
assert.equal(gapSeverityOf("missing-relation"), "moderate");
assert.equal(gapSeverityOf("coverage"), "low");
assert.equal(gapScopeOf("coverage"), "contextual");
assert.equal(gapIsContextual("coverage"), true);
assert.equal(gapIsContextual("missing-evidence"), false);
assert.equal(gapRequiresReference("coverage"), false);
assert.equal(gapRequiresReference("missing-evidence"), true);
assert.equal(gapMinimumRelated("missing-relation"), 2);
assert.equal(gapMinimumRelated("coverage"), 0);

// Normalization: dedup + order span and dependencies.
const messy = classified("missing-relation", gap("g1", "a and b unrelated", [eB, eA, eA]), ["rel-2", "rel-1", "rel-1"]);
const normalized = normalizeGap(messy);
assert.deepEqual(normalized.gap.relatedTo.map((r) => r.memoryId), ["memory-a", "memory-b"]);
assert.deepEqual([...normalized.dependencies.relations], ["rel-1", "rel-2"]);

// Canonical key is order-independent within the span.
assert.equal(
  canonicalGapKey(classified("missing-relation", gap("g2", "s", [eA, eB]))),
  canonicalGapKey(classified("missing-relation", gap("g3", "s", [eB, eA]))),
);

// Duplicate classified gaps collapse to one.
assert.equal(
  normalizeGaps([
    classified("missing-relation", gap("g4", "s", [eA, eB])),
    classified("missing-relation", gap("g5", "s", [eB, eA])),
  ]).length,
  1,
);

// Validation: a valid missing-evidence gap passes.
assert.deepEqual(
  validateGapSet([classified("missing-evidence", gap("g6", "s", [eA]))], evidence, relations, implications, contradictions),
  { ok: true },
);
// A context-wide coverage gap with no references passes.
assert.deepEqual(
  validateGapSet([classified("coverage", gap("g7", "c is not covered", []))], evidence, relations, implications, contradictions),
  { ok: true },
);
// missing-evidence with no reference fails (requiresReference).
assert.equal(
  validateGapSet([classified("missing-evidence", gap("g8", "s", []))], evidence, relations, implications, contradictions).ok,
  false,
);
// missing-relation below the minimum span fails.
assert.equal(
  validateGapSet([classified("missing-relation", gap("g9", "s", [eA]))], evidence, relations, implications, contradictions).ok,
  false,
);
// unresolved-contradiction citing a declared contradiction passes.
assert.equal(
  validateGapSet([classified("unresolved-contradiction", gap("g10", "s", [eA, eB]), [], [], ["con-1"])], evidence, relations, implications, contradictions).ok,
  true,
);
// Undeclared evidence fails.
assert.equal(
  validateGapSet([classified("missing-evidence", gap("g11", "s", [eZ]))], evidence, relations, implications, contradictions).ok,
  false,
);
// Undeclared relation dependency fails.
assert.equal(
  validateGapSet([classified("missing-relation", gap("g12", "s", [eA, eB]), ["rel-x"])], evidence, relations, implications, contradictions).ok,
  false,
);
// Undeclared implication dependency fails.
assert.equal(
  validateGapSet([classified("missing-implication", gap("g13", "s", [eA]), [], ["imp-x"])], evidence, relations, implications, contradictions).ok,
  false,
);
// Undeclared contradiction dependency fails.
assert.equal(
  validateGapSet([classified("unresolved-contradiction", gap("g14", "s", [eA, eB]), [], [], ["con-x"])], evidence, relations, implications, contradictions).ok,
  false,
);
// Empty statement fails.
assert.equal(
  validateGapSet([classified("missing-evidence", gap("g15", "", [eA]))], evidence, relations, implications, contradictions).ok,
  false,
);

// Boundary: validate + normalize collapses duplicates and freezes.
const ok = normalizeGapSet(
  { gaps: [classified("missing-relation", gap("g16", "s", [eB, eA])), classified("missing-relation", gap("g17", "s", [eA, eB]))] },
  evidence,
  relations,
  implications,
  contradictions,
);
assert.ok(ok.ok === true);
if (ok.ok) {
  assert.equal(ok.value.gaps.length, 1);
  assert.equal(Object.isFrozen(ok.value.gaps), true);
}
const bad = normalizeGapSet(
  { gaps: [classified("missing-evidence", gap("g18", "s", []))] },
  evidence,
  relations,
  implications,
  contradictions,
);
assert.equal(bad.ok, false);

// Deterministic repeat.
const input = {
  gaps: [classified("missing-evidence", gap("g19", "s", [eC])), classified("coverage", gap("g20", "wide", []))],
};
assert.deepEqual(
  normalizeGapSet(input, evidence, relations, implications, contradictions),
  normalizeGapSet(input, evidence, relations, implications, contradictions),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalGapKey(classified("coverage", gap("gN1", "a\u0000b", []))),
  canonicalGapKey(classified("coverage", gap("gN2", "ab", []))),
);
assert.equal(
  normalizeGaps([
    classified("coverage", gap("gN3", "a\u0000b", [])),
    classified("coverage", gap("gN4", "a\u0000b", [])),
  ]).length,
  1,
);
// A multi-byte UTF-8 statement round-trips through the canonical key unchanged.
assert.equal(
  canonicalGapKey(classified("coverage", gap("gU1", "kapsama a\u00e7\u0131\u011f\u0131", []))),
  canonicalGapKey(classified("coverage", gap("gU2", "kapsama a\u00e7\u0131\u011f\u0131", []))),
);

console.log("Enterprise Memory Reasoning gap checks passed");
