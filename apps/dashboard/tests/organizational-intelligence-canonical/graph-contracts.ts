import assert from "node:assert/strict";
import {
  CAPABILITY_CATEGORIES,
  createCapability,
  createOrganizationalRelationship,
  createResponsibility,
  createRole,
  ORGANIZATIONAL_REFERENCE_TYPES,
  ORGANIZATIONAL_RELATIONSHIP_TYPES,
  RESPONSIBILITY_CATEGORIES,
  RESPONSIBILITY_CRITICALITIES,
  validateCapability,
  validateOrganizationalRelationship,
  validateResponsibility,
  validateRole,
} from "../../src/features/organizational-intelligence/canonical";
import { identityInput, inert, lifecycle, period, provenance } from "../helpers/oi-canonical";

function responsibilityInput(overrides: Record<string, unknown> = {}) {
  return {
    identity: identityInput({ canonicalId: "resp-1", displayName: "Approve budgets", normalizedName: "approve budgets" }),
    category: "FINANCE" as const, criticality: "HIGH" as const, delegable: true,
    escalationRequired: true, assignable: true, lifecycle: lifecycle(), provenance: provenance(),
    metadata: { ownerDomain: "finance" }, ...inert, ...overrides,
  };
}

function capabilityInput(overrides: Record<string, unknown> = {}) {
  return {
    identity: identityInput({ canonicalId: "cap-1", displayName: "Approve Purchase", normalizedName: "approve purchase" }),
    category: "BUSINESS" as const, description: "Ability to approve a purchase request.",
    lifecycle: lifecycle(), provenance: provenance(), metadata: { code: "approve_purchase" },
    ...inert, ...overrides,
  };
}

function roleInput(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: "ws-1", organizationId: "org-1", organizationalUnitId: "ou-1",
    identity: identityInput({ canonicalId: "role-1", displayName: "Finance Director", normalizedName: "finance director" }),
    responsibilityReferences: ["resp-1"], capabilityReferences: ["cap-1"],
    lifecycle: lifecycle(), effectivePeriod: period(), provenance: provenance(), metadata: {},
    ...inert, ...overrides,
  };
}

function reference(overrides: Record<string, unknown> = {}) {
  return {
    referenceType: "ROLE" as const, referenceId: "role-1", workspaceId: "ws-1",
    organizationId: "org-1", ...inert, ...overrides,
  };
}

function relationshipInput(overrides: Record<string, unknown> = {}) {
  return {
    relationshipId: "rel-1", relationshipType: "HAS_CAPABILITY" as const,
    sourceReference: reference(),
    targetReference: reference({ referenceType: "CAPABILITY", referenceId: "cap-1" }),
    workspaceScope: "ws-1", organizationScope: "org-1", effectivePeriod: period(),
    provenance: provenance(), lifecycle: lifecycle(), metadata: {}, ...inert, ...overrides,
  };
}

function responsibilityContract(): void {
  const value = createResponsibility(responsibilityInput());
  assert.equal(validateResponsibility(value).status, "valid");
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.identity), true);
  assert.equal(Object.isFrozen(value.metadata), true);
  for (const category of RESPONSIBILITY_CATEGORIES) {
    assert.equal(validateResponsibility(createResponsibility(responsibilityInput({ category }))).status, "valid");
  }
  for (const criticality of RESPONSIBILITY_CRITICALITIES) {
    assert.equal(validateResponsibility(createResponsibility(responsibilityInput({ criticality }))).status, "valid");
  }
  assert.equal(validateResponsibility(createResponsibility(responsibilityInput({ category: "EXECUTE" }))).error?.code, "INVALID_CATEGORY");
  assert.equal(validateResponsibility(createResponsibility(responsibilityInput({ criticality: "URGENT" }))).error?.code, "INVALID_CRITICALITY");
  assert.equal(validateResponsibility(createResponsibility(responsibilityInput({ lifecycle: lifecycle({ status: "invalid" }) }))).error?.code, "INVALID_LIFECYCLE");
  assert.equal(validateResponsibility(createResponsibility(responsibilityInput({ metadata: [] }))).error?.code, "INVALID_METADATA");
}

function capabilityContract(): void {
  const value = createCapability(capabilityInput());
  assert.equal(validateCapability(value).status, "valid");
  assert.equal(Object.isFrozen(value), true);
  for (const category of CAPABILITY_CATEGORIES) {
    assert.equal(validateCapability(createCapability(capabilityInput({ category }))).status, "valid");
  }
  assert.equal(validateCapability(createCapability(capabilityInput({ category: "PERMISSION" }))).error?.code, "INVALID_CATEGORY");
  assert.equal(validateCapability(createCapability(capabilityInput({ description: "" }))).error?.code, "INVALID_DESCRIPTION");
  assert.equal("permissions" in value, false);
  assert.equal("implementation" in value, false);
}

function roleContract(): void {
  const value = createRole(roleInput());
  assert.equal(validateRole(value).status, "valid");
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.responsibilityReferences), true);
  assert.equal(Object.isFrozen(value.capabilityReferences), true);
  assert.equal(validateRole(createRole(roleInput({ workspaceId: "" }))).error?.code, "INVALID_WORKSPACE_SCOPE");
  assert.equal(validateRole(createRole(roleInput({ organizationId: "" }))).error?.code, "INVALID_ORGANIZATION_REFERENCE");
  assert.equal(validateRole(createRole(roleInput({ organizationalUnitId: "" }))).error?.code, "INVALID_UNIT_REFERENCE");
  assert.equal(validateRole(createRole(roleInput({ responsibilityReferences: ["resp-1", "resp-1"] }))).error?.code, "DUPLICATE_RESPONSIBILITY_REFERENCE");
  assert.equal(validateRole(createRole(roleInput({ capabilityReferences: ["cap-1", "cap-1"] }))).error?.code, "DUPLICATE_CAPABILITY_REFERENCE");
  assert.equal(validateRole(createRole(roleInput({ effectivePeriod: period({ validTo: "2025-01-01T00:00:00Z" }) }))).error?.code, "INVALID_EFFECTIVE_PERIOD");
  assert.equal("occupants" in value, false);
  assert.equal("permissions" in value, false);
}

function relationshipContract(): void {
  const value = createOrganizationalRelationship(relationshipInput());
  assert.equal(validateOrganizationalRelationship(value).status, "valid");
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.sourceReference), true);
  assert.equal(Object.isFrozen(value.targetReference), true);
  for (const relationshipType of ORGANIZATIONAL_RELATIONSHIP_TYPES) {
    assert.equal(validateOrganizationalRelationship(createOrganizationalRelationship(relationshipInput({ relationshipType }))).status, "valid");
  }
  for (const referenceType of ORGANIZATIONAL_REFERENCE_TYPES) {
    assert.equal(validateOrganizationalRelationship(createOrganizationalRelationship(relationshipInput({
      sourceReference: reference({ referenceType }),
    }))).status, "valid");
  }
  assert.equal(validateOrganizationalRelationship(createOrganizationalRelationship(relationshipInput({ relationshipType: "TRAVERSES" }))).error?.code, "INVALID_RELATIONSHIP_TYPE");
  assert.equal(validateOrganizationalRelationship(createOrganizationalRelationship(relationshipInput({
    targetReference: reference(),
  }))).error?.code, "SELF_RELATIONSHIP");
  assert.equal(validateOrganizationalRelationship(createOrganizationalRelationship(relationshipInput({
    targetReference: reference({ referenceType: "CAPABILITY", referenceId: "cap-1", workspaceId: "ws-2" }),
  }))).error?.code, "WORKSPACE_MISMATCH");
  assert.equal(validateOrganizationalRelationship(createOrganizationalRelationship(relationshipInput({
    targetReference: reference({ referenceType: "CAPABILITY", referenceId: "cap-1", organizationId: "org-2" }),
  }))).error?.code, "ORGANIZATION_MISMATCH");
  assert.equal(validateOrganizationalRelationship(createOrganizationalRelationship(relationshipInput({
    effectivePeriod: period({ validTo: "2025-01-01T00:00:00Z" }),
  }))).error?.code, "INVALID_EFFECTIVE_PERIOD");
}

function adversarialConstruction(): void {
  const cases: readonly (() => unknown)[] = [
    () => createRole(roleInput({ metadata: { callback: () => undefined } }) as never),
    () => createResponsibility(responsibilityInput({ metadata: { promise: Promise.resolve() } }) as never),
    () => createCapability(capabilityInput({ metadata: { symbol: Symbol("x") } }) as never),
    () => createOrganizationalRelationship(relationshipInput({ metadata: new (class Example {})() }) as never),
    () => {
      const cyclic: Record<string, unknown> = {};
      cyclic.self = cyclic;
      return createRole(roleInput({ metadata: cyclic }) as never);
    },
    () => {
      const shared = { value: "mutable" };
      return createOrganizationalRelationship(relationshipInput({ metadata: { first: shared, second: shared } }) as never);
    },
  ];
  for (const construct of cases) assert.throws(construct, TypeError);
}

function deepCopyIsolation(): void {
  const capabilities = ["cap-1"];
  const value = createRole(roleInput({ capabilityReferences: capabilities }));
  capabilities.push("cap-2");
  assert.deepEqual(value.capabilityReferences, ["cap-1"]);
}

function main(): void {
  responsibilityContract();
  capabilityContract();
  roleContract();
  relationshipContract();
  adversarialConstruction();
  deepCopyIsolation();
  console.log("organizational graph contract checks passed");
}

main();
