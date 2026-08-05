/**
 * Enterprise Organizational Intelligence — organization opportunity contracts (Phase 1).
 *
 * An opportunity is an evidence-grounded possibility OI has surfaced for the
 * enterprise. Contract shape only — Phase 1 declares what an opportunity IS; it
 * pursues none, prioritizes none, and commits the enterprise to nothing. The basis
 * is a read-only reference into published memory evidence.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";

export type OrganizationOpportunityId = OrganizationId;

/** An evidence-grounded possibility OI has surfaced, pursued by no one here. */
export interface OrganizationOpportunity {
  readonly opportunityId: OrganizationOpportunityId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly basis: readonly EvidenceReference[];
}
