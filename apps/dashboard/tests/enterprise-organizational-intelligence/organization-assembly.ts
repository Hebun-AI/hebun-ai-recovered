import assert from "node:assert/strict";
import type { EvidenceReference } from "../../src/features/enterprise-memory-reasoning";
import type {
  Organization,
  OrganizationObjective,
  OrganizationScope,
  OrganizationState,
  OrganizationAssemblyContext,
} from "../../src/features/enterprise-organizational-intelligence";
import {
  assembleOrganizationBundle,
  canonicalOrganizationAssemblyKey,
  normalizeOrganizationAssemblyBundle,
  organizationAssemblyArtifactIsGrounded,
  organizationAssemblyBasisOf,
  organizationAssemblyLayerOf,
  organizationAssemblyReachesEvidenceRoot,
  organizationAssemblyReferencesOf,
  organizationAssemblySummaryOf,
  validateOrganizationAssembly,
} from "../../src/features/enterprise-organizational-intelligence";

const ev: EvidenceReference = { memoryId: "memory-a", namespace: "enterprise-1", version: 1 };
const ev2: EvidenceReference = { memoryId: "memory-b", namespace: "enterprise-1", version: 1 };

const organization: Organization = {
  organizationId: "org-1",
  statement: "Acme",
  domains: [
    { domainId: "dom-ops", category: "operational", statement: "operations" },
    { domainId: "dom-fin", category: "financial", statement: "finance" },
  ],
};
const scope: OrganizationScope = { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] };
const objectives: readonly OrganizationObjective[] = [
  { objectiveId: "obj-1", domainId: "dom-ops", statement: "ship faster" },
];

function state(overrides: Partial<OrganizationState> = {}): OrganizationState {
  return {
    observations: [{ observationId: "obs-1", domainId: "dom-ops", statement: "queue growing", basis: [ev] }],
    constraints: [{ constraintId: "con-1", domainId: "dom-fin", statement: "fixed budget" }],
    capabilities: [{ capabilityId: "cap-1", domainId: "dom-ops", statement: "ci pipeline" }],
    opportunities: [{ opportunityId: "opp-1", domainId: "dom-ops", statement: "automate release", basis: [ev2] }],
    risks: [{ riskId: "risk-1", domainId: "dom-fin", statement: "overrun", severity: "high", basis: [ev] }],
    ...overrides,
  };
}
function context(overrides: Partial<OrganizationAssemblyContext> = {}): OrganizationAssemblyContext {
  return { organization, scope, objectives, state: state(), ...overrides };
}

// Descriptor rules.
assert.equal(organizationAssemblyArtifactIsGrounded("observation"), true);
assert.equal(organizationAssemblyArtifactIsGrounded("risk"), true);
assert.equal(organizationAssemblyArtifactIsGrounded("domain"), false);
assert.equal(organizationAssemblyLayerOf("domain") < organizationAssemblyLayerOf("risk"), true);

// Assembly succeeds and produces a frozen, canonical bundle.
const result = assembleOrganizationBundle({ context: context() });
assert.ok(result.ok === true);
if (result.ok) {
  const { assembly, context: ctx } = result.value;
  assert.equal(Object.isFrozen(result.value), true);
  assert.equal(Object.isFrozen(assembly), true);
  assert.equal(Object.isFrozen(ctx), true);
  assert.equal(assembly.organizationId, "org-1");
  assert.equal(assembly.scopeId, "scope-1");
  // Summary counts every gathered kind. 2 domains + 1 each of six others = 8.
  assert.deepEqual(assembly.summary.counts, {
    domain: 2,
    objective: 1,
    observation: 1,
    constraint: 1,
    capability: 1,
    opportunity: 1,
    risk: 1,
  });
  assert.equal(assembly.summary.total, 8);
  // Basis is the de-duplicated union of evidence (ev appears twice, ev2 once) -> 2.
  assert.equal(assembly.basis.evidence.length, 2);
  assert.equal(organizationAssemblyReachesEvidenceRoot(assembly), true);
  // Chain indexes every member, canonically ordered by layer (domain first, risk last).
  assert.equal(assembly.chain.references.length, 8);
  assert.equal(assembly.chain.references[0].artifactKind, "domain");
  assert.equal(assembly.chain.references[assembly.chain.references.length - 1].artifactKind, "risk");
  // Artifacts carried UNCHANGED.
  assert.deepEqual(ctx.objectives, objectives);
  assert.deepEqual(ctx.state.risks, state().risks);
}

// Rules projections work directly on a context.
assert.equal(organizationAssemblyReferencesOf(context()).length, 8);
assert.equal(organizationAssemblySummaryOf(context()).total, 8);
assert.equal(organizationAssemblyBasisOf(context()).evidence.length, 2);

// Direct validation passes for a consistent context.
assert.deepEqual(validateOrganizationAssembly(context()), { ok: true });

// Empty assembly fails.
assert.equal(
  assembleOrganizationBundle({
    context: {
      organization: { organizationId: "org-1", statement: "x", domains: [] },
      scope: { scopeId: "scope-1", statement: "x", domains: [] },
      objectives: [],
      state: { observations: [], constraints: [], capabilities: [], opportunities: [], risks: [] },
    },
  }).ok,
  false,
);
// Undeclared domain (structural, via Phase 1 validator) fails.
assert.equal(
  assembleOrganizationBundle({
    context: context({ objectives: [{ objectiveId: "obj-1", domainId: "dom-x", statement: "x" }] }),
  }).ok,
  false,
);
// Observation without evidence basis fails.
assert.equal(
  assembleOrganizationBundle({
    context: context({ state: state({ observations: [{ observationId: "obs-1", domainId: "dom-ops", statement: "x", basis: [] }] }) }),
  }).ok,
  false,
);
// Duplicate risk id fails.
assert.equal(
  assembleOrganizationBundle({
    context: context({
      state: state({
        risks: [
          { riskId: "risk-1", domainId: "dom-fin", statement: "a", severity: "high", basis: [ev] },
          { riskId: "risk-1", domainId: "dom-ops", statement: "b", severity: "low", basis: [ev] },
        ],
      }),
    }),
  }).ok,
  false,
);

// Canonical ordering independent of input order (scrambled domains).
const scrambled = context({
  organization: {
    ...organization,
    domains: [
      { domainId: "dom-fin", category: "financial", statement: "finance" },
      { domainId: "dom-ops", category: "operational", statement: "operations" },
    ],
  },
});
const a = assembleOrganizationBundle({ context: scrambled });
const b = assembleOrganizationBundle({ context: context() });
assert.ok(a.ok === true && b.ok === true);
if (a.ok && b.ok) {
  assert.deepEqual(
    a.value.assembly.chain.references.map((r) => r.artifactId),
    b.value.assembly.chain.references.map((r) => r.artifactId),
  );
}

// Deterministic repeat.
assert.deepEqual(
  normalizeOrganizationAssemblyBundle(context()),
  normalizeOrganizationAssemblyBundle(context()),
);

// Data integrity: canonical keys are NUL-safe and UTF-8 stable. Source stays ASCII;
// the NUL is a "\u0000" escape, so no binary artifact lands in the file.
const nulOrg: Organization = { organizationId: "a\u0000b", statement: "x", domains: organization.domains };
const plainOrg: Organization = { organizationId: "ab", statement: "x", domains: organization.domains };
assert.notEqual(
  canonicalOrganizationAssemblyKey(normalizeOrganizationAssemblyBundle(context({ organization: nulOrg }))),
  canonicalOrganizationAssemblyKey(normalizeOrganizationAssemblyBundle(context({ organization: plainOrg }))),
);
const kOrg: Organization = { organizationId: "köken", statement: "x", domains: organization.domains };
assert.equal(
  canonicalOrganizationAssemblyKey(normalizeOrganizationAssemblyBundle(context({ organization: kOrg }))),
  canonicalOrganizationAssemblyKey(normalizeOrganizationAssemblyBundle(context({ organization: kOrg }))),
);

console.log("Enterprise Organizational Intelligence organization-assembly checks passed");
