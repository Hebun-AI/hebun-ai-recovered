/**
 * Enterprise Organizational Intelligence — organization risk contracts (Phase 1).
 *
 * A risk is an evidence-grounded exposure OI has surfaced for the enterprise, with a
 * plainly declared severity. Contract shape only — Phase 1 declares what a risk IS;
 * it mitigates none, accepts none, and decides nothing. Severity is an ordinal label,
 * not a computed score. The basis is a read-only reference into memory evidence.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationDomainId } from "@/features/enterprise-organizational-intelligence/organization-domain";

export type OrganizationRiskId = OrganizationId;

/** A plainly declared risk severity. Ordinal in meaning, not a computed score. */
export type OrganizationRiskSeverity = "low" | "moderate" | "high" | "critical";

/** The fixed, canonical properties of a risk severity. */
export interface OrganizationRiskSeverityDescriptor {
  readonly severity: OrganizationRiskSeverity;
  /** A fixed integer for total ordering. Ordinal meaning only — not a score. */
  readonly rank: number;
}

/**
 * The canonical descriptor for every risk severity. Frozen and immutable. Ranks give
 * a deterministic total order (low < moderate < high < critical) for inspection only.
 */
export const ORGANIZATION_RISK_SEVERITY_DESCRIPTORS: Readonly<
  Record<OrganizationRiskSeverity, OrganizationRiskSeverityDescriptor>
> = Object.freeze({
  low: Object.freeze({ severity: "low", rank: 0 }),
  moderate: Object.freeze({ severity: "moderate", rank: 1 }),
  high: Object.freeze({ severity: "high", rank: 2 }),
  critical: Object.freeze({ severity: "critical", rank: 3 }),
});

/** An evidence-grounded exposure OI has surfaced, mitigated by no one here. */
export interface OrganizationRisk {
  readonly riskId: OrganizationRiskId;
  readonly domainId: OrganizationDomainId;
  readonly statement: OrganizationStatement;
  readonly severity: OrganizationRiskSeverity;
  readonly basis: readonly EvidenceReference[];
}
