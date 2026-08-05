/**
 * Enterprise Organizational Intelligence — organization scope contracts (Phase 1).
 *
 * A scope is the bounded coverage an organizational understanding is confined to.
 * OI never exceeds its scope. Contract shape only — Phase 1 declares what a scope
 * IS; it grants no access and widens no boundary.
 */

import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";

export type OrganizationScopeId = OrganizationId;

/** The bounded coverage OI is confined to: the domains it may observe within. */
export interface OrganizationScope {
  readonly scopeId: OrganizationScopeId;
  readonly statement: OrganizationStatement;
  readonly domains: readonly OrganizationDomainId[];
}
