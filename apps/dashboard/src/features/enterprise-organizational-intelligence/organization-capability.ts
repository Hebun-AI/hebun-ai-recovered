/**
 * Enterprise Organizational Intelligence — organization capability contracts (Phase 1).
 *
 * A capability is a declared thing the enterprise can do. Contract shape only —
 * Phase 1 declares what a capability IS; it grants none, manages none, and allocates
 * no resource. Capability Management remains upstream; OI only references.
 */

import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";

export type OrganizationCapabilityId = OrganizationId;

/** A declared capability of the enterprise, observed by OI, managed by no one here. */
export interface OrganizationCapability {
  readonly capabilityId: OrganizationCapabilityId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
}
