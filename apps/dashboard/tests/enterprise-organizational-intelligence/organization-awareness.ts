import assert from "node:assert/strict";
import type { EvidenceReference } from "../../src/features/enterprise-memory-reasoning";
import type {
  AwarenessContext,
  OrganizationScope,
  StrategicAssessment,
  StrategicSignal,
} from "../../src/features/enterprise-organizational-intelligence";
import {
  AWARENESS_LIFECYCLE_STATE_DESCRIPTORS,
  ORGANIZATION_AWARENESS_NON_RESPONSIBILITIES,
  STRATEGIC_DIMENSION_DESCRIPTORS,
  awarenessBasisReachesSource,
  awarenessLifecycleIsTerminal,
  canonicalAwarenessContextKey,
  compareAwarenessLifecycle,
  normalizeAwarenessBasis,
  normalizeOrganizationAwarenessContext,
  prepareOrganizationAwarenessContext,
  strategicDimensionOrderOf,
  validateOrganizationAwarenessContext,
} from "../../src/features/enterprise-organizational-intelligence";

const ev: EvidenceReference = { memoryId: "memory-a", namespace: "enterprise-1", version: 1 };
const ev2: EvidenceReference = { memoryId: "memory-b", namespace: "enterprise-1", version: 1 };
const scope: OrganizationScope = { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] };

function signal(overrides: Partial<StrategicSignal> = {}): StrategicSignal {
  return {
    signalId: "sig-1",
    dimension: "risk",
    domainId: "dom-ops",
    statement: "release cadence slowing",
    basis: { learnings: ["lrn-1"], opportunities: ["opp-1"], evidence: [ev] },
    provenance: { attributedTo: "director", version: 1 },
    uncertainties: [{ statement: "partial data" }],
    ...overrides,
  };
}
const signal2: StrategicSignal = {
  signalId: "sig-2",
  dimension: "drift",
  domainId: "dom-fin",
  statement: "spend diverging from plan",
  basis: { learnings: [], opportunities: [], evidence: [ev2] },
  provenance: { attributedTo: "director", version: 1 },
  uncertainties: [],
};
function assessment(overrides: Partial<StrategicAssessment> = {}): StrategicAssessment {
  return {
    assessmentId: "asm-1",
    dimension: "health",
    domainId: "dom-ops",
    statement: "delivery health degrading",
    derivedFrom: ["sig-1", "sig-2"],
    basis: { learnings: ["lrn-1"], opportunities: [], evidence: [ev] },
    provenance: { attributedTo: "director", version: 1 },
    uncertainties: [{ statement: "short window" }],
    ...overrides,
  };
}

function context(overrides: Partial<AwarenessContext> = {}): AwarenessContext {
  return {
    organizationId: "org-1",
    purpose: "strategic review",
    scope,
    signals: [signal(), signal2],
    assessments: [assessment()],
    ...overrides,
  };
}

// Descriptors frozen + rules.
assert.equal(Object.isFrozen(STRATEGIC_DIMENSION_DESCRIPTORS), true);
assert.equal(Object.isFrozen(AWARENESS_LIFECYCLE_STATE_DESCRIPTORS), true);
assert.equal(strategicDimensionOrderOf("position") < strategicDimensionOrderOf("dependency"), true);
assert.equal(compareAwarenessLifecycle("context-declared", "output-qualified") < 0, true);
assert.equal(awarenessLifecycleIsTerminal("closed"), true);
assert.equal(awarenessLifecycleIsTerminal("escalated"), true);
assert.equal(awarenessLifecycleIsTerminal("output-qualified"), false);
assert.equal(awarenessBasisReachesSource({ learnings: [], opportunities: ["opp-1"], evidence: [] }), true);
assert.equal(awarenessBasisReachesSource({ learnings: [], opportunities: [], evidence: [] }), false);

// Non-responsibilities frozen + complete.
assert.equal(Object.isFrozen(ORGANIZATION_AWARENESS_NON_RESPONSIBILITIES), true);
for (const nr of ["governance", "decision", "authority", "mitigation", "pursuit", "runtime", "execution"] as const) {
  assert.equal(ORGANIZATION_AWARENESS_NON_RESPONSIBILITIES.includes(nr), true);
}

// Basis normalization dedups all three source kinds.
const nb = normalizeAwarenessBasis({ learnings: ["b", "a", "a"], opportunities: ["y", "x", "x"], evidence: [ev2, ev, ev] });
assert.deepEqual(nb.learnings, ["a", "b"]);
assert.deepEqual(nb.opportunities, ["x", "y"]);
assert.equal(nb.evidence.length, 2);

// Valid context prepares to a frozen canonical form.
const prepared = prepareOrganizationAwarenessContext({ context: context() });
assert.ok(prepared.ok === true);
if (prepared.ok) {
  assert.equal(Object.isFrozen(prepared.value), true);
  assert.deepEqual(prepared.value.signals.map((s) => s.signalId), ["sig-1", "sig-2"]);
  assert.deepEqual(prepared.value.assessments.map((a) => a.assessmentId), ["asm-1"]);
  assert.deepEqual(prepared.value.signals[1], signal2);
}

// Direct validation passes.
assert.deepEqual(validateOrganizationAwarenessContext(context()), { ok: true });

// Empty org / purpose / scope fail.
assert.equal(validateOrganizationAwarenessContext(context({ organizationId: "" })).ok, false);
assert.equal(validateOrganizationAwarenessContext(context({ purpose: "" })).ok, false);
// Out-of-scope signal domain fails.
assert.equal(
  validateOrganizationAwarenessContext(context({ signals: [signal({ domainId: "dom-x" }), signal2] })).ok,
  false,
);
// Signal with no basis fails.
assert.equal(
  validateOrganizationAwarenessContext(
    context({ signals: [signal({ basis: { learnings: [], opportunities: [], evidence: [] } }), signal2] }),
  ).ok,
  false,
);
// Signal with invalid provenance version fails.
assert.equal(
  validateOrganizationAwarenessContext(
    context({ signals: [signal({ provenance: { attributedTo: "d", version: 0 } }), signal2] }),
  ).ok,
  false,
);
// Assessment derived from no signal fails.
assert.equal(
  validateOrganizationAwarenessContext(context({ assessments: [assessment({ derivedFrom: [] })] })).ok,
  false,
);
// Assessment deriving from undeclared signal fails.
assert.equal(
  validateOrganizationAwarenessContext(context({ assessments: [assessment({ derivedFrom: ["sig-x"] })] })).ok,
  false,
);
// Assessment with no basis fails.
assert.equal(
  validateOrganizationAwarenessContext(
    context({ assessments: [assessment({ basis: { learnings: [], opportunities: [], evidence: [] } })] }),
  ).ok,
  false,
);
// Duplicate signal id fails.
assert.equal(
  validateOrganizationAwarenessContext(context({ signals: [signal(), signal()] })).ok,
  false,
);

// Deterministic repeat.
assert.deepEqual(
  normalizeOrganizationAwarenessContext(context()),
  normalizeOrganizationAwarenessContext(context()),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalAwarenessContextKey(context({ organizationId: "a\u0000b" })),
  canonicalAwarenessContextKey(context({ organizationId: "ab" })),
);
assert.equal(
  canonicalAwarenessContextKey(context({ organizationId: "köken" })),
  canonicalAwarenessContextKey(context({ organizationId: "köken" })),
);

console.log("Enterprise Organizational Intelligence organization-awareness checks passed");
