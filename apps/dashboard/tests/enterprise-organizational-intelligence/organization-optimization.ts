import assert from "node:assert/strict";
import type { EvidenceReference } from "../../src/features/enterprise-memory-reasoning";
import type {
  OptimizationContext,
  OptimizationEffectivenessAnalysis,
  OptimizationOpportunity,
  OptimizationPriority,
  OrganizationScope,
} from "../../src/features/enterprise-organizational-intelligence";
import {
  OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS,
  ORGANIZATION_OPTIMIZATION_NON_RESPONSIBILITIES,
  canonicalOptimizationContextKey,
  compareOptimizationLifecycle,
  normalizeOptimizationBasis,
  normalizeOrganizationOptimizationContext,
  optimizationBasisReachesSource,
  optimizationLifecycleIsTerminal,
  prepareOrganizationOptimizationContext,
  validateOrganizationOptimizationContext,
} from "../../src/features/enterprise-organizational-intelligence";

const ev: EvidenceReference = { memoryId: "memory-a", namespace: "enterprise-1", version: 1 };
const ev2: EvidenceReference = { memoryId: "memory-b", namespace: "enterprise-1", version: 1 };

const scope: OrganizationScope = { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] };

const analysis: OptimizationEffectivenessAnalysis = {
  analysisId: "an-1",
  domainId: "dom-ops",
  statement: "release pipeline underutilized",
  basis: { learnings: ["lrn-1"], evidence: [ev] },
  provenance: { attributedTo: "director", version: 1 },
};
function opportunity(overrides: Partial<OptimizationOpportunity> = {}): OptimizationOpportunity {
  return {
    opportunityId: "opp-1",
    domainId: "dom-ops",
    statement: "parallelize release stages",
    derivedFrom: "an-1",
    basis: { learnings: ["lrn-1"], evidence: [ev] },
    uncertainties: [{ statement: "limited sample" }],
    ...overrides,
  };
}
const opportunity2: OptimizationOpportunity = {
  opportunityId: "opp-2",
  domainId: "dom-fin",
  statement: "reduce idle spend",
  derivedFrom: "an-1",
  basis: { learnings: [], evidence: [ev2] },
  uncertainties: [],
};
const priority: OptimizationPriority = { priorityId: "pri-1", opportunityId: "opp-1", rank: 1 };
const priority2: OptimizationPriority = { priorityId: "pri-2", opportunityId: "opp-2", rank: 2 };

function context(overrides: Partial<OptimizationContext> = {}): OptimizationContext {
  return {
    organizationId: "org-1",
    purpose: "effectiveness review",
    scope,
    analyses: [analysis],
    opportunities: [opportunity(), opportunity2],
    priorities: [priority, priority2],
    ...overrides,
  };
}

// Descriptor frozen + rules.
assert.equal(Object.isFrozen(OPTIMIZATION_LIFECYCLE_STATE_DESCRIPTORS), true);
assert.equal(compareOptimizationLifecycle("context-declared", "output-qualified") < 0, true);
assert.equal(optimizationLifecycleIsTerminal("closed"), true);
assert.equal(optimizationLifecycleIsTerminal("escalated"), true);
assert.equal(optimizationLifecycleIsTerminal("output-qualified"), false);
assert.equal(optimizationBasisReachesSource({ learnings: ["lrn-1"], evidence: [] }), true);
assert.equal(optimizationBasisReachesSource({ learnings: [], evidence: [ev] }), true);
assert.equal(optimizationBasisReachesSource({ learnings: [], evidence: [] }), false);

// Non-responsibilities frozen and complete.
assert.equal(Object.isFrozen(ORGANIZATION_OPTIMIZATION_NON_RESPONSIBILITIES), true);
for (const nr of ["decision", "authority", "work-prioritization", "reorganization", "runtime", "execution"] as const) {
  assert.equal(ORGANIZATION_OPTIMIZATION_NON_RESPONSIBILITIES.includes(nr), true);
}

// Basis normalization dedups learnings + evidence.
const nb = normalizeOptimizationBasis({ learnings: ["lrn-2", "lrn-1", "lrn-1"], evidence: [ev2, ev, ev] });
assert.deepEqual(nb.learnings, ["lrn-1", "lrn-2"]);
assert.equal(nb.evidence.length, 2);

// Valid context prepares to a frozen canonical form; priorities in declared rank order.
const prepared = prepareOrganizationOptimizationContext({ context: context() });
assert.ok(prepared.ok === true);
if (prepared.ok) {
  assert.equal(Object.isFrozen(prepared.value), true);
  assert.deepEqual(prepared.value.analyses.map((a) => a.analysisId), ["an-1"]);
  assert.deepEqual(prepared.value.opportunities.map((o) => o.opportunityId), ["opp-1", "opp-2"]);
  assert.deepEqual(prepared.value.priorities.map((p) => p.priorityId), ["pri-1", "pri-2"]);
  // Artifacts carried unchanged.
  assert.deepEqual(prepared.value.opportunities[1], opportunity2);
}

// Priorities surface in declared rank order regardless of input order.
const reordered = prepareOrganizationOptimizationContext({ context: context({ priorities: [priority2, priority] }) });
assert.ok(reordered.ok === true);
if (reordered.ok) {
  assert.deepEqual(reordered.value.priorities.map((p) => p.rank), [1, 2]);
}

// Direct validation passes.
assert.deepEqual(validateOrganizationOptimizationContext(context()), { ok: true });

// Empty org / purpose / scope fail.
assert.equal(validateOrganizationOptimizationContext(context({ organizationId: "" })).ok, false);
assert.equal(validateOrganizationOptimizationContext(context({ purpose: "" })).ok, false);
// Out-of-scope analysis domain fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({ analyses: [{ ...analysis, domainId: "dom-x" }] }),
  ).ok,
  false,
);
// Analysis with no basis fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({ analyses: [{ ...analysis, basis: { learnings: [], evidence: [] } }] }),
  ).ok,
  false,
);
// Invalid provenance version fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({ analyses: [{ ...analysis, provenance: { attributedTo: "d", version: 0 } }] }),
  ).ok,
  false,
);
// Opportunity deriving from undeclared analysis fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({ opportunities: [opportunity({ derivedFrom: "an-x" }), opportunity2] }),
  ).ok,
  false,
);
// Opportunity with no basis fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({ opportunities: [opportunity({ basis: { learnings: [], evidence: [] } }), opportunity2] }),
  ).ok,
  false,
);
// Priority ranking an undeclared opportunity fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({ priorities: [{ priorityId: "pri-1", opportunityId: "opp-x", rank: 1 }] }),
  ).ok,
  false,
);
// Priority ranking the same opportunity twice fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({
      priorities: [
        { priorityId: "pri-1", opportunityId: "opp-1", rank: 1 },
        { priorityId: "pri-3", opportunityId: "opp-1", rank: 2 },
      ],
    }),
  ).ok,
  false,
);
// Invalid rank fails.
assert.equal(
  validateOrganizationOptimizationContext(
    context({ priorities: [{ priorityId: "pri-1", opportunityId: "opp-1", rank: 0 }, priority2] }),
  ).ok,
  false,
);
// Duplicate opportunity id fails.
assert.equal(
  validateOrganizationOptimizationContext(context({ opportunities: [opportunity(), opportunity()] })).ok,
  false,
);

// Deterministic repeat.
assert.deepEqual(
  normalizeOrganizationOptimizationContext(context()),
  normalizeOrganizationOptimizationContext(context()),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
assert.notEqual(
  canonicalOptimizationContextKey(context({ organizationId: "a\u0000b" })),
  canonicalOptimizationContextKey(context({ organizationId: "ab" })),
);
assert.equal(
  canonicalOptimizationContextKey(context({ organizationId: "köken" })),
  canonicalOptimizationContextKey(context({ organizationId: "köken" })),
);

console.log("Enterprise Organizational Intelligence organization-optimization checks passed");
