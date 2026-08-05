/**
 * Enterprise Organizational Intelligence — organization state contracts (Phase 1).
 *
 * The state is the current known condition of the enterprise as OI has observed it:
 * its observations, constraints, capabilities, opportunities, and risks. Contract
 * shape only — Phase 1 declares what a state IS; it assembles none, computes none,
 * and changes nothing in the enterprise. It is an immutable snapshot, not a store.
 */

import type { OrganizationObservation } from "@/features/enterprise-organizational-intelligence/organization-observation";
import type { OrganizationConstraint } from "@/features/enterprise-organizational-intelligence/organization-constraint";
import type { OrganizationCapability } from "@/features/enterprise-organizational-intelligence/organization-capability";
import type { OrganizationOpportunity } from "@/features/enterprise-organizational-intelligence/organization-opportunity";
import type { OrganizationRisk } from "@/features/enterprise-organizational-intelligence/organization-risk";

/** The current known condition of the enterprise, as an immutable observed snapshot. */
export interface OrganizationState {
  readonly observations: readonly OrganizationObservation[];
  readonly constraints: readonly OrganizationConstraint[];
  readonly capabilities: readonly OrganizationCapability[];
  readonly opportunities: readonly OrganizationOpportunity[];
  readonly risks: readonly OrganizationRisk[];
}
