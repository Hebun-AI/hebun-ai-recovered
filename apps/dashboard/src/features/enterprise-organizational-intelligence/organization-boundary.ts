/**
 * Enterprise Organizational Intelligence — boundary contracts (Phase 1).
 *
 * Declares, as canonical data, what Organizational Intelligence is explicitly NOT
 * responsible for, and the shape of a request that enters the OI boundary. Contract
 * shape only — Phase 1 declares the boundary; it enforces nothing at runtime and
 * grants no capability. The non-responsibilities encode the constitutional
 * separation: observation and analysis never become authority, decision, or action.
 */

import type { OrganizationId } from "@/features/enterprise-organizational-intelligence/contracts";
import type { OrganizationContext } from "@/features/enterprise-organizational-intelligence/organization-context";

/** The things Organizational Intelligence must never become or do. Naming only. */
export type OrganizationIntelligenceNonResponsibility =
  | "decision"
  | "authority"
  | "approval"
  | "action"
  | "execution"
  | "automation"
  | "planning"
  | "reorganization"
  | "roadmap-amendment"
  | "runtime";

/**
 * The canonical, frozen set of Organizational Intelligence non-responsibilities.
 * Each names a boundary OI holds; none reserves design or authorizes any behaviour.
 */
export const ORGANIZATION_INTELLIGENCE_NON_RESPONSIBILITIES: readonly OrganizationIntelligenceNonResponsibility[] =
  Object.freeze([
    "decision",
    "authority",
    "approval",
    "action",
    "execution",
    "automation",
    "planning",
    "reorganization",
    "roadmap-amendment",
    "runtime",
  ]);

export type OrganizationIntelligenceRequestId = OrganizationId;

/** A bounded, read-only request entering the OI boundary. It commands nothing. */
export interface OrganizationIntelligenceRequest {
  readonly requestId: OrganizationIntelligenceRequestId;
  readonly context: OrganizationContext;
}
