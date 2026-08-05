/**
 * Enterprise Organizational Intelligence — organization observation contracts (Phase 1).
 *
 * An observation is a governed, read-only fact OI has noted about the enterprise,
 * grounded in evidence it does not own. Contract shape only — Phase 1 declares what
 * an observation IS; it gathers none, infers none, and asserts nothing beyond the
 * evidence that grounds it. The basis is a read-only reference into published memory
 * evidence; OI never mutates or redefines it.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";

export type OrganizationObservationId = OrganizationId;

/** A read-only, evidence-grounded fact OI has noted about the enterprise. */
export interface OrganizationObservation {
  readonly observationId: OrganizationObservationId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly basis: readonly EvidenceReference[];
}
