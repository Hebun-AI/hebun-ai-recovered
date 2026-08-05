/**
 * Enterprise Organizational Intelligence — organization objective contracts (Phase 1).
 *
 * An objective is a declared aim of the enterprise that OI may reason about within a
 * domain. Contract shape only — Phase 1 declares what an objective IS; it sets none,
 * commits to none, and creates no plan, priority, or decision. Objective-setting
 * remains a Human and Director act; OI only references.
 */

import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";

export type OrganizationObjectiveId = OrganizationId;

/** A declared aim of the enterprise, observed by OI, set by no one here. */
export interface OrganizationObjective {
  readonly objectiveId: OrganizationObjectiveId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
}
