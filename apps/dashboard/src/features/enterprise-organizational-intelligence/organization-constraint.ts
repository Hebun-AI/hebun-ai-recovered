/**
 * Enterprise Organizational Intelligence — organization constraint contracts (Phase 1).
 *
 * A constraint is a declared bound within which the enterprise operates. Contract
 * shape only — Phase 1 declares what a constraint IS; it enforces none, waives none,
 * and creates no policy or governance outcome.
 */

import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";

export type OrganizationConstraintId = OrganizationId;

/** A declared bound the enterprise operates within, observed by OI, enforced by no one here. */
export interface OrganizationConstraint {
  readonly constraintId: OrganizationConstraintId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
}
