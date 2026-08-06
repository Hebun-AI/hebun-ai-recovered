import assert from "node:assert/strict";
import type { EvidenceReference } from "../../src/features/enterprise-memory-reasoning";
import type {
  EvolutionConstraint,
  EvolutionContext,
  EvolutionPathway,
  EvolutionReadiness,
  OrganizationScope,
} from "../../src/features/enterprise-organizational-intelligence";
import {
  EVOLUTION_CONSTRAINT_KIND_DESCRIPTORS,
  EVOLUTION_LIFECYCLE_STATE_DESCRIPTORS,
  ORGANIZATION_EVOLUTION_NON_RESPONSIBILITIES,
  canonicalEvolutionContextKey,
  compareEvolutionLifecycle,
  evolutionBasisReachesSource,
  evolutionConstraintKindOrderOf,
  evolutionLifecycleIsTerminal,
  evolutionPathwayPreservesContinuity,
  normalizeEvolutionBasis,
  normalizeOrganizationEvolutionContext,
  prepareOrganizationEvolutionContext,
  validateOrganizationEvolutionContext,
} from "../../src/features/enterprise-organizational-intelligence";

const ev: EvidenceReference = { memoryId: "memory-a", namespace: "enterprise-1", version: 1 };
const ev2: EvidenceReference = { memoryId: "memory-b", namespace: "enterprise-1", version: 1 };
const scope: OrganizationScope = { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] };

const constraint: EvolutionConstraint = { constraintId: "con-1", kind: "continuity", statement: "preserve identity" };
const constraint2: EvolutionConstraint = { constraintId: "con-2", kind: "governance", statement: "respect policy" };

function readiness(overrides: Partial<EvolutionReadiness> = {}): EvolutionReadiness {
  return {
    readinessId: "rdy-1",
    domainId: "dom-ops",
    statement: "prepared for phased rollout",
    basis: { learnings: ["lrn-1"], opportunities: ["opp-1"], assessments: ["asm-1"], evidence: [ev] },
    provenance: { attributedTo: "director", version: 1 },
    uncertainties: [{ statement: "capacity unknown" }],
    ...overrides,
  };
}
function pathway(overrides: Partial<EvolutionPathway> = {}): EvolutionPathway {
  return {
    pathwayId: "pth-1",
    domainId: "dom-ops",
    statement: "incremental platform modularization",
    derivedFrom: "rdy-1",
    respects: ["con-1", "con-2"],
    continuity: { preserved: true, statement: "identity and history preserved" },
    sustainability: { statement: "durable under current constraints" },
    basis: { learnings: ["lrn-1"], opportunities: [], assessments: ["asm-1"], evidence: [ev2] },
    provenance: { attributedTo: "director", version: 1 },
    uncertainties: [{ statement: "long horizon" }],
    ...overrides,
  };
}

function context(overrides: Partial<EvolutionContext> = {}): EvolutionContext {
  return {
    organizationId: "org-1",
    purpose: "evolution review",
    scope,
    constraints: [constraint, constraint2],
    readiness: [readiness()],
    pathways: [pathway()],
    ...overrides,
  };
}

// Descriptors frozen + rules.
assert.equal(Object.isFrozen(EVOLUTION_CONSTRAINT_KIND_DESCRIPTORS), true);
assert.equal(Object.isFrozen(EVOLUTION_LIFECYCLE_STATE_DESCRIPTORS), true);
assert.equal(evolutionConstraintKindOrderOf("continuity") < evolutionConstraintKindOrderOf("roadmap-integrity"), true);
assert.equal(compareEvolutionLifecycle("context-declared", "output-qualified") < 0, true);
assert.equal(evolutionLifecycleIsTerminal("closed"), true);
assert.equal(evolutionLifecycleIsTerminal("escalated"), true);
assert.equal(evolutionLifecycleIsTerminal("readiness-assessed"), false);
assert.equal(evolutionBasisReachesSource({ learnings: [], opportunities: [], assessments: ["asm-1"], evidence: [] }), true);
assert.equal(evolutionBasisReachesSource({ learnings: [], opportunities: [], assessments: [], evidence: [] }), false);
assert.equal(evolutionPathwayPreservesContinuity(pathway()), true);
assert.equal(evolutionPathwayPreservesContinuity(pathway({ continuity: { preserved: false, statement: "x" } })), false);

// Non-responsibilities frozen + complete.
assert.equal(Object.isFrozen(ORGANIZATION_EVOLUTION_NON_RESPONSIBILITIES), true);
for (const nr of ["roadmap-amendment", "governance", "decision", "authority", "evolution-performance", "runtime"] as const) {
  assert.equal(ORGANIZATION_EVOLUTION_NON_RESPONSIBILITIES.includes(nr), true);
}

// Basis normalization dedups all four source kinds.
const nb = normalizeEvolutionBasis({ learnings: ["b", "a", "a"], opportunities: ["y", "x"], assessments: ["m", "m"], evidence: [ev2, ev, ev] });
assert.deepEqual(nb.learnings, ["a", "b"]);
assert.deepEqual(nb.assessments, ["m"]);
assert.equal(nb.evidence.length, 2);

// Valid context prepares to a frozen canonical form.
const prepared = prepareOrganizationEvolutionContext({ context: context() });
assert.ok(prepared.ok === true);
if (prepared.ok) {
  assert.equal(Object.isFrozen(prepared.value), true);
  assert.deepEqual(prepared.value.constraints.map((c) => c.constraintId), ["con-1", "con-2"]);
  assert.deepEqual(prepared.value.readiness.map((r) => r.readinessId), ["rdy-1"]);
  assert.deepEqual(prepared.value.pathways.map((p) => p.pathwayId), ["pth-1"]);
  assert.deepEqual(prepared.value.pathways[0].respects, ["con-1", "con-2"]);
}

// Direct validation passes.
assert.deepEqual(validateOrganizationEvolutionContext(context()), { ok: true });

// Empty org / purpose / scope fail.
assert.equal(validateOrganizationEvolutionContext(context({ organizationId: "" })).ok, false);
assert.equal(validateOrganizationEvolutionContext(context({ purpose: "" })).ok, false);
// Out-of-scope readiness domain fails.
assert.equal(
  validateOrganizationEvolutionContext(context({ readiness: [readiness({ domainId: "dom-x" })] })).ok,
  false,
);
// Readiness with no basis fails.
assert.equal(
  validateOrganizationEvolutionContext(
    context({ readiness: [readiness({ basis: { learnings: [], opportunities: [], assessments: [], evidence: [] } })] }),
  ).ok,
  false,
);
// Pathway deriving from undeclared readiness fails.
assert.equal(
  validateOrganizationEvolutionContext(context({ pathways: [pathway({ derivedFrom: "rdy-x" })] })).ok,
  false,
);
// Pathway respecting undeclared constraint fails.
assert.equal(
  validateOrganizationEvolutionContext(context({ pathways: [pathway({ respects: ["con-x"] })] })).ok,
  false,
);
// Pathway not preserving continuity fails.
assert.equal(
  validateOrganizationEvolutionContext(
    context({ pathways: [pathway({ continuity: { preserved: false, statement: "broken" } })] }),
  ).ok,
  false,
);
// Pathway with empty sustainability statement fails.
assert.equal(
  validateOrganizationEvolutionContext(
    context({ pathways: [pathway({ sustainability: { statement: "" } })] }),
  ).ok,
  false,
);
// Pathway with invalid provenance version fails.
assert.equal(
  validateOrganizationEvolutionContext(
    context({ pathways: [pathway({ provenance: { attributedTo: "d", version: 0 } })] }),
  ).ok,
  false,
);
// Duplicate pathway id fails.
assert.equal(
  validateOrganizationEvolutionContext(context({ pathways: [pathway(), pathway()] })).ok,
  false,
);

// Deterministic repeat.
assert.deepEqual(
  normalizeOrganizationEvolutionContext(context()),
  normalizeOrganizationEvolutionContext(context()),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalEvolutionContextKey(context({ organizationId: "a\u0000b" })),
  canonicalEvolutionContextKey(context({ organizationId: "ab" })),
);
assert.equal(
  canonicalEvolutionContextKey(context({ organizationId: "köken" })),
  canonicalEvolutionContextKey(context({ organizationId: "köken" })),
);

console.log("Enterprise Organizational Intelligence organization-evolution checks passed");
