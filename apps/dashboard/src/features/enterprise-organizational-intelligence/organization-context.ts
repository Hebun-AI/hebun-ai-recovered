/**
 * Enterprise Organizational Intelligence — organization context contracts (Phase 1).
 *
 * The context is the bounded input OI consumes: the organization, the scope it is
 * confined to, the observed state, and the published Reasoning understanding it rests
 * on — all read-only. Contract shape only — Phase 1 declares what a context IS; it
 * gathers none, retrieves none, and never bypasses the published foundations to reach
 * raw data. Reasoning understanding is consumed unchanged as given truth.
 */

import type { UnderstandingBundle } from "@/features/enterprise-memory-reasoning";
import type { Organization } from "@/features/enterprise-organizational-intelligence/organization";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";
import type { OrganizationState } from "@/features/enterprise-organizational-intelligence/organization-state";

/** The bounded, read-only input an organizational understanding rests on. */
export interface OrganizationContext {
  readonly organization: Organization;
  readonly scope: OrganizationScope;
  readonly state: OrganizationState;
  readonly reasoning: readonly UnderstandingBundle[];
}
