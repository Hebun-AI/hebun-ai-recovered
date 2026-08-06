import assert from "node:assert/strict";
import type { EvidenceReference } from "../../src/features/enterprise-memory-reasoning";
import type {
  OrganizationLearning,
  OrganizationLearningContext,
  OrganizationScope,
} from "../../src/features/enterprise-organizational-intelligence";
import {
  LEARNING_LIFECYCLE_STATE_DESCRIPTORS,
  LEARNING_RELATIONSHIP_KIND_DESCRIPTORS,
  ORGANIZATION_LEARNING_NON_RESPONSIBILITIES,
  canonicalLearningContextKey,
  compareLearningLifecycle,
  learningLifecycleIsTerminal,
  learningReachesEvidenceRoot,
  learningRelationshipIsSymmetric,
  learningRelationshipKey,
  normalizeLearning,
  normalizeOrganizationLearningContext,
  prepareOrganizationLearningContext,
  validateOrganizationLearningContext,
} from "../../src/features/enterprise-organizational-intelligence";

const ev: EvidenceReference = { memoryId: "memory-a", namespace: "enterprise-1", version: 1 };
const ev2: EvidenceReference = { memoryId: "memory-b", namespace: "enterprise-1", version: 1 };

const scope: OrganizationScope = { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] };

function learning(overrides: Partial<OrganizationLearning> = {}): OrganizationLearning {
  return {
    learningId: "lrn-1",
    subject: { subjectId: "subj-1", domainId: "dom-ops", statement: "release cadence" },
    statement: "shorter cycles reduced queue time",
    lifecycle: "qualified",
    basis: { evidence: [ev] },
    provenance: { attributedTo: "director", version: 1 },
    uncertainties: [{ statement: "limited sample" }],
    ...overrides,
  };
}
const learning2: OrganizationLearning = {
  learningId: "lrn-2",
  subject: { subjectId: "subj-2", domainId: "dom-fin", statement: "budget" },
  statement: "fixed budget constrained scope",
  lifecycle: "preserved",
  basis: { evidence: [ev2] },
  provenance: { attributedTo: "director", version: 2 },
  uncertainties: [],
};

function context(overrides: Partial<OrganizationLearningContext> = {}): OrganizationLearningContext {
  return {
    organizationId: "org-1",
    purpose: "retrospective",
    scope,
    learnings: [learning(), learning2],
    relationships: [{ relationshipId: "rel-1", kind: "refines", from: "lrn-2", to: "lrn-1" }],
    ...overrides,
  };
}

// Descriptor tables frozen + rules.
assert.equal(Object.isFrozen(LEARNING_LIFECYCLE_STATE_DESCRIPTORS), true);
assert.equal(Object.isFrozen(LEARNING_RELATIONSHIP_KIND_DESCRIPTORS), true);
assert.equal(compareLearningLifecycle("context-declared", "qualified") < 0, true);
assert.equal(learningLifecycleIsTerminal("retired"), true);
assert.equal(learningLifecycleIsTerminal("qualified"), false);
assert.equal(learningRelationshipIsSymmetric("contradicts"), true);
assert.equal(learningRelationshipIsSymmetric("supersedes"), false);
assert.equal(learningReachesEvidenceRoot(learning()), true);
assert.equal(learningReachesEvidenceRoot(learning({ basis: { evidence: [] } })), false);

// Non-responsibilities frozen and complete.
assert.equal(Object.isFrozen(ORGANIZATION_LEARNING_NON_RESPONSIBILITIES), true);
for (const nr of ["memory-admission", "decision", "authority", "runtime", "execution"] as const) {
  assert.equal(ORGANIZATION_LEARNING_NON_RESPONSIBILITIES.includes(nr), true);
}

// Symmetric relationship key is endpoint-order-independent; directional is not.
assert.equal(
  learningRelationshipKey({ relationshipId: "x", kind: "contradicts", from: "a", to: "b" }),
  learningRelationshipKey({ relationshipId: "y", kind: "contradicts", from: "b", to: "a" }),
);
assert.notEqual(
  learningRelationshipKey({ relationshipId: "x", kind: "supersedes", from: "a", to: "b" }),
  learningRelationshipKey({ relationshipId: "y", kind: "supersedes", from: "b", to: "a" }),
);

// Normalization: basis + uncertainties dedup within a learning.
const messy = learning({ basis: { evidence: [ev2, ev, ev] }, uncertainties: [{ statement: "x" }, { statement: "x" }] });
const nl = normalizeLearning(messy);
assert.equal(nl.basis.evidence.length, 2);
assert.equal(nl.uncertainties.length, 1);

// Valid context prepares to a frozen canonical form.
const prepared = prepareOrganizationLearningContext({ context: context() });
assert.ok(prepared.ok === true);
if (prepared.ok) {
  assert.equal(Object.isFrozen(prepared.value), true);
  assert.equal(prepared.value.learnings.length, 2);
  // Learnings ordered by id.
  assert.deepEqual(prepared.value.learnings.map((l) => l.learningId), ["lrn-1", "lrn-2"]);
  // Learning objects carried unchanged.
  assert.deepEqual(prepared.value.learnings[1], learning2);
}

// Direct validation passes.
assert.deepEqual(validateOrganizationLearningContext(context()), { ok: true });

// Empty organization / purpose / scope fail.
assert.equal(validateOrganizationLearningContext(context({ organizationId: "" })).ok, false);
assert.equal(validateOrganizationLearningContext(context({ purpose: "" })).ok, false);
// Out-of-scope domain fails.
assert.equal(
  validateOrganizationLearningContext(
    context({ learnings: [learning({ subject: { subjectId: "s", domainId: "dom-x", statement: "y" } }), learning2] }),
  ).ok,
  false,
);
// Missing evidence basis fails.
assert.equal(
  validateOrganizationLearningContext(context({ learnings: [learning({ basis: { evidence: [] } }), learning2] })).ok,
  false,
);
// Invalid provenance version fails.
assert.equal(
  validateOrganizationLearningContext(
    context({ learnings: [learning({ provenance: { attributedTo: "d", version: 0 } }), learning2] }),
  ).ok,
  false,
);
// Missing attribution fails.
assert.equal(
  validateOrganizationLearningContext(
    context({ learnings: [learning({ provenance: { attributedTo: "", version: 1 } }), learning2] }),
  ).ok,
  false,
);
// Self relationship fails.
assert.equal(
  validateOrganizationLearningContext(
    context({ relationships: [{ relationshipId: "r", kind: "refines", from: "lrn-1", to: "lrn-1" }] }),
  ).ok,
  false,
);
// Dangling relationship fails.
assert.equal(
  validateOrganizationLearningContext(
    context({ relationships: [{ relationshipId: "r", kind: "refines", from: "lrn-1", to: "lrn-x" }] }),
  ).ok,
  false,
);
// Duplicate learning id fails.
assert.equal(
  validateOrganizationLearningContext(context({ learnings: [learning(), learning()] })).ok,
  false,
);

// Deterministic repeat.
assert.deepEqual(
  normalizeOrganizationLearningContext(context()),
  normalizeOrganizationLearningContext(context()),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalLearningContextKey(context({ organizationId: "a\u0000b" })),
  canonicalLearningContextKey(context({ organizationId: "ab" })),
);
assert.equal(
  canonicalLearningContextKey(context({ organizationId: "köken" })),
  canonicalLearningContextKey(context({ organizationId: "köken" })),
);

console.log("Enterprise Organizational Intelligence organization-learning checks passed");
