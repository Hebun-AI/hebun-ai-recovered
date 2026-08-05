/**
 * Enterprise Organizational Intelligence — organization understanding contracts (Phase 1).
 *
 * An organization understanding is the aggregate shape of what OI has understood
 * about the enterprise: the organization, the scope it is bounded to, its declared
 * objectives, and its observed state, produced at a point in time. Phase 1 defines
 * this shape ONLY — it assembles none (that is a later phase). Nothing here is a
 * decision, authority, plan, action, or roadmap change; it is bounded, explainable
 * understanding that informs Human and Director judgment and nothing more.
 */

import type { OrganizationTimestamp } from "@/features/enterprise-organizational-intelligence/contracts";
import type { Organization } from "@/features/enterprise-organizational-intelligence/organization";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";
import type { OrganizationObjective } from "@/features/enterprise-organizational-intelligence/organization-objective";
import type { OrganizationState } from "@/features/enterprise-organizational-intelligence/organization-state";

/**
 * The complete, immutable shape of an organizational understanding. Every field is
 * readonly. Nothing here is decision, plan, action, authority, or command — it is
 * bounded, observed understanding, and nothing more.
 */
export interface OrganizationUnderstanding {
  readonly organization: Organization;
  readonly scope: OrganizationScope;
  readonly objectives: readonly OrganizationObjective[];
  readonly state: OrganizationState;
  readonly producedAt: OrganizationTimestamp;
}
