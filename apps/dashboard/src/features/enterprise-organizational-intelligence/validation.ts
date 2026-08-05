/**
 * Enterprise Organizational Intelligence — structural validation (Phase 1).
 *
 * Validates the STRUCTURAL integrity of an organization understanding: the
 * organization and scope are named, the scope stays within the organization's
 * declared domains, every state artifact and objective names a declared domain, every
 * evidence-requiring artifact carries a basis, and no artifact appears twice within a
 * kind. This is a plain, deterministic structural check — NOT learning, NOT
 * optimization, NOT awareness, NOT inference, NOT decision. It confirms shape only.
 */

import { ORGANIZATION_ARTIFACT_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationUnderstanding } from "@/features/enterprise-organizational-intelligence/organization-understanding";
import type { OrganizationState } from "@/features/enterprise-organizational-intelligence/organization-state";

export type OrganizationValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function pushDuplicates(label: string, ids: readonly string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) issues.push(`understanding declares duplicate ${label} ${id}`);
    seen.add(id);
  }
}

function checkDomain(
  label: string,
  id: string,
  domainId: string,
  declaredDomains: ReadonlySet<string>,
  issues: string[],
): void {
  if (!declaredDomains.has(domainId)) {
    issues.push(`${label} ${id} names an undeclared domain ${domainId}`);
  }
}

function checkStateDomainsAndBasis(state: OrganizationState, declaredDomains: ReadonlySet<string>, issues: string[]): void {
  for (const observation of state.observations) {
    checkDomain("observation", observation.observationId, observation.domainId, declaredDomains, issues);
    if (ORGANIZATION_ARTIFACT_DESCRIPTORS.observation.requiresBasis && observation.basis.length === 0) {
      issues.push(`observation ${observation.observationId} has no evidence basis`);
    }
  }
  for (const constraint of state.constraints) {
    checkDomain("constraint", constraint.constraintId, constraint.domainId, declaredDomains, issues);
  }
  for (const capability of state.capabilities) {
    checkDomain("capability", capability.capabilityId, capability.domainId, declaredDomains, issues);
  }
  for (const opportunity of state.opportunities) {
    checkDomain("opportunity", opportunity.opportunityId, opportunity.domainId, declaredDomains, issues);
    if (ORGANIZATION_ARTIFACT_DESCRIPTORS.opportunity.requiresBasis && opportunity.basis.length === 0) {
      issues.push(`opportunity ${opportunity.opportunityId} has no evidence basis`);
    }
  }
  for (const risk of state.risks) {
    checkDomain("risk", risk.riskId, risk.domainId, declaredDomains, issues);
    if (ORGANIZATION_ARTIFACT_DESCRIPTORS.risk.requiresBasis && risk.basis.length === 0) {
      issues.push(`risk ${risk.riskId} has no evidence basis`);
    }
  }
}

export function validateOrganizationUnderstanding(understanding: OrganizationUnderstanding): OrganizationValidation {
  const { organization, scope, objectives, state } = understanding;
  const issues: string[] = [];

  if (organization.organizationId.length === 0) issues.push("understanding has an empty organization id");
  if (scope.scopeId.length === 0) issues.push("understanding has an empty scope id");

  const declaredDomains = new Set(organization.domains.map((domain) => domain.domainId));
  pushDuplicates("domain", organization.domains.map((domain) => domain.domainId), issues);

  // Scope must stay within the organization's declared domains.
  for (const domainId of scope.domains) {
    if (!declaredDomains.has(domainId)) {
      issues.push(`scope ${scope.scopeId} names an undeclared domain ${domainId}`);
    }
  }

  // Objectives and every state artifact must name a declared domain.
  for (const objective of objectives) {
    checkDomain("objective", objective.objectiveId, objective.domainId, declaredDomains, issues);
  }
  checkStateDomainsAndBasis(state, declaredDomains, issues);

  // No artifact may be declared twice within a kind.
  pushDuplicates("objective", objectives.map((objective) => objective.objectiveId), issues);
  pushDuplicates("observation", state.observations.map((observation) => observation.observationId), issues);
  pushDuplicates("constraint", state.constraints.map((constraint) => constraint.constraintId), issues);
  pushDuplicates("capability", state.capabilities.map((capability) => capability.capabilityId), issues);
  pushDuplicates("opportunity", state.opportunities.map((opportunity) => opportunity.opportunityId), issues);
  pushDuplicates("risk", state.risks.map((risk) => risk.riskId), issues);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
