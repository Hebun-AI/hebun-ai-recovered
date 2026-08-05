/**
 * Enterprise Organizational Intelligence — organization contracts (Phase 1).
 *
 * The identity of the enterprise OI observes: an organization and the domains it is
 * composed of. Contract shape only — Phase 1 declares what an organization IS to OI;
 * it owns no organizational identity, assigns no responsibility, and creates no
 * authority. Organization identity and ownership remain upstream; OI only references.
 */

import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomain } from "@/features/enterprise-organizational-intelligence/organization-domain";

/** The enterprise, or a bounded part of it, that OI observes — referenced, not owned. */
export interface Organization {
  readonly organizationId: OrganizationId;
  readonly statement: OrganizationStatement;
  readonly domains: readonly OrganizationDomain[];
}
