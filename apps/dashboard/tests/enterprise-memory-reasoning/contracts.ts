import assert from "node:assert/strict";
import type { AssembledContext } from "../../src/features/enterprise-memory-context";
import {
  validateUnderstanding,
} from "../../src/features/enterprise-memory-reasoning";
import type {
  EvidenceReference,
  ReasoningRequest,
  ReasoningUnderstanding,
} from "../../src/features/enterprise-memory-reasoning";

const at = "2026-08-03T14:00:00.000Z";
const ns = "enterprise-1";

const evA: EvidenceReference = { memoryId: "memory-a", namespace: ns, version: 1 };
const evB: EvidenceReference = { memoryId: "memory-b", namespace: ns, version: 1 };
const evUndeclared: EvidenceReference = { memoryId: "memory-z", namespace: ns, version: 9 };

function understanding(overrides: Partial<ReasoningUnderstanding> = {}): ReasoningUnderstanding {
  return {
    goal: { goalId: "goal-1", namespace: ns, question: "What does the evidence support?", requestedAt: at },
    evidence: {
      items: [
        { reference: evA, describedBy: "memory a" },
        { reference: evB, describedBy: "memory b" },
      ],
    },
    relations: [
      { relationId: "rel-1", type: "supports", from: evA, to: evB, describedBy: "a supports b" },
    ],
    implications: [
      { implicationId: "imp-1", statement: "b follows from a", basis: [evA, evB], derivedFrom: ["rel-1"] },
    ],
    contradictions: [
      { contradictionId: "con-1", statement: "none material", between: [evA, evB] },
    ],
    gaps: [
      { gapId: "gap-1", statement: "coverage of c is missing", relatedTo: [evA] },
    ],
    confidence: {
      assessmentId: "conf-1",
      level: "high",
      rationale: "grounded in two supporting memories",
      uncertainties: [{ statement: "c is not covered" }],
    },
    producedAt: at,
    ...overrides,
  };
}

// Contract shapes compose; discriminated types are distinct.
const relationTypes = understanding().relations.map((r) => r.type);
assert.deepEqual(relationTypes, ["supports"]);
assert.equal(understanding().confidence.level, "high");

// A boundary request carries an assembled memory context plus a goal.
const emptyContext: AssembledContext = {
  groups: [],
  totalRecords: 0,
  sourceSelectionSize: 0,
  appliedPolicy: {},
};
const request: ReasoningRequest = {
  requestId: "req-1",
  goal: understanding().goal,
  context: emptyContext,
  submittedAt: at,
};
assert.equal(request.context.totalRecords, 0);

// Structural validation passes when every reference is declared.
assert.deepEqual(validateUnderstanding(understanding()), { ok: true });

// Structural validation fails when a relation references undeclared evidence.
const broken = understanding({
  relations: [{ relationId: "rel-x", type: "relates-to", from: evA, to: evUndeclared, describedBy: "x" }],
});
const result = validateUnderstanding(broken);
assert.equal(result.ok, false);
if (!result.ok) {
  assert.ok(result.issues.some((i) => i.includes("undeclared evidence")));
}

// Empty confidence rationale is a structural failure.
const noRationale = understanding({
  confidence: { assessmentId: "conf-2", level: "low", rationale: "", uncertainties: [] },
});
assert.equal(validateUnderstanding(noRationale).ok, false);

// Deterministic: same input yields the same validation verdict.
assert.deepEqual(validateUnderstanding(understanding()), validateUnderstanding(understanding()));

// Frozen understanding remains readable (immutability at the value level).
const frozen = Object.freeze(understanding());
assert.equal(Object.isFrozen(frozen), true);
assert.equal(frozen.relations.length, 1);

console.log("Enterprise Memory Reasoning contract checks passed");
