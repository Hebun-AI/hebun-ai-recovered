import assert from "node:assert/strict";
import {
  createCapability,
  createOrganizationalRelationship,
  createResponsibility,
  createRole,
  validateCapability,
  validateOrganizationalRelationship,
  validateResponsibility,
  validateRole,
  type Capability,
  type OrganizationalRelationship,
  type Responsibility,
  type Role,
} from "../../src/features/organizational-intelligence/canonical";
import { identityInput, inert, lifecycle, period, provenance } from "../helpers/oi-canonical";

const responsibility = createResponsibility({
  identity: identityInput({ canonicalId: "resp-1" }), category: "OPERATIONS", criticality: "HIGH",
  delegable: true, escalationRequired: false, assignable: true, lifecycle: lifecycle(),
  provenance: provenance(), metadata: {}, ...inert,
});
const capability = createCapability({
  identity: identityInput({ canonicalId: "cap-1" }), category: "OPERATIONAL",
  description: "Monitor uptime.", lifecycle: lifecycle(), provenance: provenance(), metadata: {}, ...inert,
});
const role = createRole({
  workspaceId: "ws-1", organizationId: "org-1", organizationalUnitId: "ou-1",
  identity: identityInput({ canonicalId: "role-1" }), responsibilityReferences: ["resp-1"],
  capabilityReferences: ["cap-1"], lifecycle: lifecycle(), effectivePeriod: period(),
  provenance: provenance(), metadata: {}, ...inert,
});
const source = Object.freeze({ referenceType: "ROLE" as const, referenceId: "role-1", workspaceId: "ws-1", organizationId: "org-1", ...inert });
const target = Object.freeze({ referenceType: "CAPABILITY" as const, referenceId: "cap-1", workspaceId: "ws-1", organizationId: "org-1", ...inert });
const relationship = createOrganizationalRelationship({
  relationshipId: "rel-1", relationshipType: "HAS_CAPABILITY", sourceReference: source,
  targetReference: target, workspaceScope: "ws-1", organizationScope: "org-1",
  effectivePeriod: period(), provenance: provenance(), lifecycle: lifecycle(), metadata: {}, ...inert,
});

function main(): void {
  const mutants = [
    validateResponsibility(Object.freeze({ ...responsibility, category: "EXECUTION" }) as unknown as Responsibility),
    validateResponsibility(Object.freeze({ ...responsibility, criticality: "P0" }) as unknown as Responsibility),
    validateCapability(Object.freeze({ ...capability, description: "" }) as Capability),
    validateRole(Object.freeze({ ...role, capabilityReferences: Object.freeze(["cap-1", "cap-1"]) }) as Role),
    validateRole(Object.freeze({ ...role, responsibilityReferences: Object.freeze(["resp-1", "resp-1"]) }) as Role),
    validateOrganizationalRelationship(Object.freeze({ ...relationship, relationshipType: "CALLS" }) as unknown as OrganizationalRelationship),
    validateOrganizationalRelationship(Object.freeze({
      ...relationship,
      targetReference: Object.freeze({ ...target, workspaceId: "ws-2" }),
    }) as OrganizationalRelationship),
    validateOrganizationalRelationship(Object.freeze({
      ...relationship,
      effectivePeriod: Object.freeze({ ...relationship.effectivePeriod, validTo: "2025-01-01T00:00:00Z" }),
    }) as OrganizationalRelationship),
  ];
  assert.equal(mutants.length, 8);
  assert.equal(mutants.every((result) => result.status === "invalid"), true, "Every critical invariant mutant must be killed.");
  console.log("organizational graph mutation checks passed: 8/8 mutants killed");
}

main();
