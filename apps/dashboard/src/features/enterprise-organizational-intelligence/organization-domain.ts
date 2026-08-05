/**
 * Enterprise Organizational Intelligence — organization domain contracts (Phase 1).
 *
 * A domain is a bounded area of the enterprise that OI may observe within — never
 * reorganize, own, or govern. Contract shape only: Phase 1 declares what a domain
 * IS; it assigns none, restructures none, and creates no organizational authority.
 */

import type { OrganizationId, OrganizationStatement } from "@/features/enterprise-organizational-intelligence/contracts";

export type OrganizationDomainId = OrganizationId;

/** The canonical categories a domain may fall into. Naming and classification only. */
export type OrganizationDomainCategory =
  | "operational"
  | "financial"
  | "strategic"
  | "human"
  | "technical"
  | "governance";

/** The fixed, canonical properties of a domain category. */
export interface OrganizationDomainCategoryDescriptor {
  readonly category: OrganizationDomainCategory;
  /** A fixed integer for canonical ordering. Ordinal only — not a ranking of worth. */
  readonly order: number;
}

/** The canonical descriptor for every domain category. Frozen and immutable. */
export const ORGANIZATION_DOMAIN_CATEGORY_DESCRIPTORS: Readonly<
  Record<OrganizationDomainCategory, OrganizationDomainCategoryDescriptor>
> = Object.freeze({
  operational: Object.freeze({ category: "operational", order: 0 }),
  financial: Object.freeze({ category: "financial", order: 1 }),
  strategic: Object.freeze({ category: "strategic", order: 2 }),
  human: Object.freeze({ category: "human", order: 3 }),
  technical: Object.freeze({ category: "technical", order: 4 }),
  governance: Object.freeze({ category: "governance", order: 5 }),
});

/** A bounded area of the enterprise OI may observe within. */
export interface OrganizationDomain {
  readonly domainId: OrganizationDomainId;
  readonly category: OrganizationDomainCategory;
  readonly statement: OrganizationStatement;
}
