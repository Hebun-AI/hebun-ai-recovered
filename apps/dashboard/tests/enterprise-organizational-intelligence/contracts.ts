import assert from "node:assert/strict";
import type {
  EvidenceReference,
} from "../../src/features/enterprise-memory-reasoning";
import type {
  Organization,
  OrganizationObjective,
  OrganizationState,
  OrganizationUnderstanding,
} from "../../src/features/enterprise-organizational-intelligence";
import {
  ORGANIZATION_ARTIFACT_DESCRIPTORS,
  ORGANIZATION_DOMAIN_CATEGORY_DESCRIPTORS,
  ORGANIZATION_INTELLIGENCE_NON_RESPONSIBILITIES,
  ORGANIZATION_RISK_SEVERITY_DESCRIPTORS,
  validateOrganizationUnderstanding,
} from "../../src/features/enterprise-organizational-intelligence";

const ev: EvidenceReference = { memoryId: "memory-a", namespace: "enterprise-1", version: 1 };

const organization: Organization = {
  organizationId: "org-1",
  statement: "Acme",
  domains: [
    { domainId: "dom-ops", category: "operational", statement: "operations" },
    { domainId: "dom-fin", category: "financial", statement: "finance" },
  ],
};

const objectives: readonly OrganizationObjective[] = [
  { objectiveId: "obj-1", domainId: "dom-ops", statement: "ship faster" },
];

function state(overrides: Partial<OrganizationState> = {}): OrganizationState {
  return {
    observations: [{ observationId: "obs-1", domainId: "dom-ops", statement: "queue growing", basis: [ev] }],
    constraints: [{ constraintId: "con-1", domainId: "dom-fin", statement: "fixed budget" }],
    capabilities: [{ capabilityId: "cap-1", domainId: "dom-ops", statement: "ci pipeline" }],
    opportunities: [{ opportunityId: "opp-1", domainId: "dom-ops", statement: "automate release", basis: [ev] }],
    risks: [{ riskId: "risk-1", domainId: "dom-fin", statement: "overrun", severity: "high", basis: [ev] }],
    ...overrides,
  };
}

function understanding(overrides: Partial<OrganizationUnderstanding> = {}): OrganizationUnderstanding {
  return {
    organization,
    scope: { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] },
    objectives,
    state: state(),
    producedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

// Descriptor tables are frozen and immutable.
assert.equal(Object.isFrozen(ORGANIZATION_ARTIFACT_DESCRIPTORS), true);
assert.equal(Object.isFrozen(ORGANIZATION_DOMAIN_CATEGORY_DESCRIPTORS), true);
assert.equal(Object.isFrozen(ORGANIZATION_RISK_SEVERITY_DESCRIPTORS), true);
assert.equal(Object.isFrozen(ORGANIZATION_ARTIFACT_DESCRIPTORS.observation), true);

// Artifact descriptors: evidence-asserting kinds require a basis; declared kinds do not.
assert.equal(ORGANIZATION_ARTIFACT_DESCRIPTORS.observation.requiresBasis, true);
assert.equal(ORGANIZATION_ARTIFACT_DESCRIPTORS.opportunity.requiresBasis, true);
assert.equal(ORGANIZATION_ARTIFACT_DESCRIPTORS.risk.requiresBasis, true);
assert.equal(ORGANIZATION_ARTIFACT_DESCRIPTORS.constraint.requiresBasis, false);
assert.equal(ORGANIZATION_ARTIFACT_DESCRIPTORS.capability.requiresBasis, false);
assert.equal(ORGANIZATION_ARTIFACT_DESCRIPTORS.objective.requiresBasis, false);

// Risk severity total ordering.
assert.equal(ORGANIZATION_RISK_SEVERITY_DESCRIPTORS.low.rank < ORGANIZATION_RISK_SEVERITY_DESCRIPTORS.critical.rank, true);
assert.equal(ORGANIZATION_RISK_SEVERITY_DESCRIPTORS.moderate.rank < ORGANIZATION_RISK_SEVERITY_DESCRIPTORS.high.rank, true);

// Domain category descriptors cover the canonical categories in order.
assert.equal(ORGANIZATION_DOMAIN_CATEGORY_DESCRIPTORS.operational.order, 0);
assert.equal(ORGANIZATION_DOMAIN_CATEGORY_DESCRIPTORS.governance.order, 5);

// Boundary non-responsibilities are frozen and include the constitutional separations.
assert.equal(Object.isFrozen(ORGANIZATION_INTELLIGENCE_NON_RESPONSIBILITIES), true);
for (const nr of ["decision", "authority", "action", "execution", "automation", "runtime"] as const) {
  assert.equal(ORGANIZATION_INTELLIGENCE_NON_RESPONSIBILITIES.includes(nr), true);
}

// A consistent understanding validates.
assert.deepEqual(validateOrganizationUnderstanding(understanding()), { ok: true });

// Empty organization id fails.
assert.equal(
  validateOrganizationUnderstanding(understanding({ organization: { ...organization, organizationId: "" } })).ok,
  false,
);
// Scope naming an undeclared domain fails.
assert.equal(
  validateOrganizationUnderstanding(
    understanding({ scope: { scopeId: "scope-1", statement: "x", domains: ["dom-ops", "dom-x"] } }),
  ).ok,
  false,
);
// Objective naming an undeclared domain fails.
assert.equal(
  validateOrganizationUnderstanding(
    understanding({ objectives: [{ objectiveId: "obj-1", domainId: "dom-x", statement: "x" }] }),
  ).ok,
  false,
);
// State artifact naming an undeclared domain fails.
assert.equal(
  validateOrganizationUnderstanding(
    understanding({ state: state({ risks: [{ riskId: "risk-1", domainId: "dom-x", statement: "x", severity: "low", basis: [ev] }] }) }),
  ).ok,
  false,
);
// Observation without evidence basis fails.
assert.equal(
  validateOrganizationUnderstanding(
    understanding({ state: state({ observations: [{ observationId: "obs-1", domainId: "dom-ops", statement: "x", basis: [] }] }) }),
  ).ok,
  false,
);
// Risk without evidence basis fails.
assert.equal(
  validateOrganizationUnderstanding(
    understanding({ state: state({ risks: [{ riskId: "risk-1", domainId: "dom-ops", statement: "x", severity: "low", basis: [] }] }) }),
  ).ok,
  false,
);
// Duplicate objective id fails.
assert.equal(
  validateOrganizationUnderstanding(
    understanding({
      objectives: [
        { objectiveId: "obj-1", domainId: "dom-ops", statement: "a" },
        { objectiveId: "obj-1", domainId: "dom-fin", statement: "b" },
      ],
    }),
  ).ok,
  false,
);
// Duplicate domain id fails.
assert.equal(
  validateOrganizationUnderstanding(
    understanding({
      organization: {
        ...organization,
        domains: [
          { domainId: "dom-ops", category: "operational", statement: "a" },
          { domainId: "dom-ops", category: "technical", statement: "b" },
        ],
      },
    }),
  ).ok,
  false,
);

// Deterministic repeat.
assert.deepEqual(validateOrganizationUnderstanding(understanding()), validateOrganizationUnderstanding(understanding()));

// UTF-8 stability: non-ASCII statements are carried faithfully.
assert.deepEqual(
  validateOrganizationUnderstanding(understanding({ organization: { ...organization, statement: "köken" } })),
  { ok: true },
);

console.log("Enterprise Organizational Intelligence contract checks passed");
