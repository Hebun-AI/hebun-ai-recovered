import assert from "node:assert/strict";
import type {
  Confidence,
  EvidenceReference,
  Explanation,
  Provenance,
  ReasoningContradiction,
  ReasoningGap,
  ReasoningImplication,
  ReasoningRelation,
  UnderstandingContext,
  UnderstandingInput,
} from "../../src/features/enterprise-memory-reasoning";
import {
  assembleUnderstandingBundle,
  canonicalUnderstandingKey,
  evidenceKey,
  normalizeUnderstandingBundle,
  understandingBasisOf,
  understandingReachesEvidenceRoot,
  understandingReferencesOf,
  understandingSummaryOf,
  validateUnderstandingAssembly,
} from "../../src/features/enterprise-memory-reasoning";

const ns = "enterprise-1";
const eA: EvidenceReference = { memoryId: "memory-a", namespace: ns, version: 1 };
const eB: EvidenceReference = { memoryId: "memory-b", namespace: ns, version: 1 };
const eC: EvidenceReference = { memoryId: "memory-c", namespace: ns, version: 1 };
const kA = evidenceKey(eA);
const kB = evidenceKey(eB);

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
const explanations: readonly Explanation[] = [
  {
    explanationKind: "relation",
    subject: { subjectKind: "relation", subjectId: "rel-1" },
    chain: {
      steps: [
        {
          statement: "a supports b",
          references: [
            { referenceKind: "evidence", referenceId: kA },
            { referenceKind: "evidence", referenceId: kB },
          ],
        },
      ],
    },
  },
];
const confidences: readonly Confidence[] = [
  {
    subject: { subjectKind: "relation", subjectId: "rel-1" },
    level: "verified",
    chain: { references: [{ sourceKind: "evidence", referenceId: kA }] },
    factors: [],
    assumptions: [],
    limitations: [],
    uncertainties: [],
  },
];

function context(overrides: Partial<UnderstandingContext> = {}): UnderstandingContext {
  return {
    evidence: { items: [{ reference: eA, describedBy: "a" }, { reference: eB, describedBy: "b" }, { reference: eC, describedBy: "c" }] },
    relations,
    implications,
    contradictions,
    gaps,
    provenances,
    explanations,
    confidences,
    ...overrides,
  };
}
function input(overrides: Partial<UnderstandingInput> = {}): UnderstandingInput {
  return { subject: { subjectId: "goal-1" }, scope: { scopeId: "ns-1" }, context: context(), ...overrides };
}

// Assembly succeeds and produces a frozen, canonical bundle.
const result = assembleUnderstandingBundle(input());
assert.ok(result.ok === true);
if (result.ok) {
  const { understanding, context: ctx } = result.value;
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(understanding), true);
  assert.equal(Object.isFrozen(ctx), true);
  // Summary counts every gathered kind.
  assert.deepEqual(understanding.summary.counts, {
    evidence: 3,
    relation: 1,
    implication: 1,
    contradiction: 1,
    gap: 1,
    provenance: 1,
    explanation: 1,
    confidence: 1,
  });
  assert.equal(understanding.summary.total, 10);
  // Basis carries the evidence root; understanding reaches memory.
  assert.equal(understanding.basis.evidence.length, 3);
  assert.equal(understandingReachesEvidenceRoot(understanding), true);
  // Chain indexes every member, canonically ordered by layer (evidence first, confidence last).
  assert.equal(understanding.chain.references.length, 10);
  assert.equal(understanding.chain.references[0].artifactKind, "evidence");
  assert.equal(understanding.chain.references[understanding.chain.references.length - 1].artifactKind, "confidence");
  // Artifacts are carried UNCHANGED.
  assert.deepEqual(ctx.relations, relations);
  assert.deepEqual(ctx.provenances, provenances);
  assert.deepEqual(ctx.confidences, confidences);
}

// Rules projections work directly on a context.
assert.equal(understandingReferencesOf(context()).length, 10);
assert.equal(understandingSummaryOf(context()).total, 10);
assert.equal(understandingBasisOf(context()).evidence.length, 3);

// Direct validation passes for a consistent context.
assert.deepEqual(validateUnderstandingAssembly({ subjectId: "goal-1" }, { scopeId: "ns-1" }, context()), { ok: true });

// Evidence root required: no evidence fails.
assert.equal(assembleUnderstandingBundle(input({ context: context({ evidence: { items: [] } }) })).ok, false);
// Empty subject fails.
assert.equal(assembleUnderstandingBundle(input({ subject: { subjectId: "" } })).ok, false);
// Empty scope fails.
assert.equal(assembleUnderstandingBundle(input({ scope: { scopeId: "" } })).ok, false);
// Duplicate artifact within a kind fails.
assert.equal(
  assembleUnderstandingBundle(input({ context: context({ relations: [...relations, ...relations] }) })).ok,
  false,
);
// Dangling provenance subject fails.
assert.equal(
  assembleUnderstandingBundle(
    input({
      context: context({
        provenances: [{ artifactKind: "relation", artifactId: "rel-x", chain: { references: [{ sourceKind: "evidence", sourceId: kA }] } }],
      }),
    }),
  ).ok,
  false,
);
// Dangling explanation subject fails.
assert.equal(
  assembleUnderstandingBundle(
    input({
      context: context({
        explanations: [
          {
            explanationKind: "relation",
            subject: { subjectKind: "relation", subjectId: "rel-x" },
            chain: { steps: [{ statement: "x", references: [{ referenceKind: "evidence", referenceId: kA }] }] },
          },
        ],
      }),
    }),
  ).ok,
  false,
);
// Dangling confidence subject fails.
assert.equal(
  assembleUnderstandingBundle(
    input({
      context: context({
        confidences: [
          {
            subject: { subjectKind: "relation", subjectId: "rel-x" },
            level: "verified",
            chain: { references: [{ sourceKind: "evidence", referenceId: kA }] },
            factors: [],
            assumptions: [],
            limitations: [],
            uncertainties: [],
          },
        ],
      }),
    }),
  ).ok,
  false,
);

// Canonical ordering is independent of input order (scrambled evidence order).
const scrambled = context({
  evidence: { items: [{ reference: eC, describedBy: "c" }, { reference: eA, describedBy: "a" }, { reference: eB, describedBy: "b" }] },
});
const a = assembleUnderstandingBundle(input({ context: scrambled }));
const b = assembleUnderstandingBundle(input());
assert.ok(a.ok === true && b.ok === true);
if (a.ok && b.ok) {
  assert.deepEqual(
    a.value.understanding.chain.references.map((r) => r.artifactId),
    b.value.understanding.chain.references.map((r) => r.artifactId),
  );
}

// Deterministic repeat via normalization.
assert.deepEqual(
  normalizeUnderstandingBundle({ subjectId: "goal-1" }, { scopeId: "ns-1" }, context()),
  normalizeUnderstandingBundle({ subjectId: "goal-1" }, { scopeId: "ns-1" }, context()),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
const bundleNul = normalizeUnderstandingBundle({ subjectId: "a\u0000b" }, { scopeId: "ns-1" }, context());
const bundlePlain = normalizeUnderstandingBundle({ subjectId: "ab" }, { scopeId: "ns-1" }, context());
assert.notEqual(canonicalUnderstandingKey(bundleNul), canonicalUnderstandingKey(bundlePlain));
assert.equal(
  canonicalUnderstandingKey(normalizeUnderstandingBundle({ subjectId: "köken" }, { scopeId: "ns-1" }, context())),
  canonicalUnderstandingKey(normalizeUnderstandingBundle({ subjectId: "köken" }, { scopeId: "ns-1" }, context())),
);

console.log("Enterprise Memory Reasoning understanding checks passed");
