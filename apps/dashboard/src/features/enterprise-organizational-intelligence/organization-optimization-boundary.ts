/**
 * Enterprise Organizational Intelligence — organization optimization boundary (Phase 4).
 *
 * The boundary through which an optimization context enters and leaves the
 * optimization foundation, and the canonical declaration of what Organizational
 * Optimization Intelligence must never become. It validates a proposed context, then
 * canonicalizes it into an immutable form. It performs NO optimization analysis, NO
 * scoring, NO ranking computation, NO recommendation, and mutates NOTHING — it only
 * accepts, checks, and canonicalizes the artifacts it is given.
 */

import type {
  CanonicalOptimizationContext,
  OptimizationContext,
} from "@/features/enterprise-organizational-intelligence/organization-optimization-types";
import { normalizeOrganizationOptimizationContext } from "@/features/enterprise-organizational-intelligence/organization-optimization-normalization";
import { validateOrganizationOptimizationContext } from "@/features/enterprise-organizational-intelligence/organization-optimization-validation";

/** The things Organizational Optimization Intelligence must never become or do. Naming only. */
export type OrganizationOptimizationNonResponsibility =
  | "decision"
  | "approval"
  | "authority"
  | "recommendation-as-command"
  | "work-prioritization"
  | "reorganization"
  | "action"
  | "execution"
  | "automation"
  | "runtime";

/** The canonical, frozen set of Organizational Optimization non-responsibilities. */
export const ORGANIZATION_OPTIMIZATION_NON_RESPONSIBILITIES: readonly OrganizationOptimizationNonResponsibility[] =
  Object.freeze([
    "decision",
    "approval",
    "authority",
    "recommendation-as-command",
    "work-prioritization",
    "reorganization",
    "action",
    "execution",
    "automation",
    "runtime",
  ]);

/** A proposed optimization context entering the boundary. */
export interface OrganizationOptimizationInput {
  readonly context: OptimizationContext;
}

/** The result of preparing an optimization context: canonical, or an explicit failure. */
export type OrganizationOptimizationResult =
  | { readonly ok: true; readonly value: CanonicalOptimizationContext }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then canonicalizes an optimization context. Pure and deterministic: the
 * same input always produces the same result. A validation failure yields explicit
 * issues and no canonical context.
 */
export function prepareOrganizationOptimizationContext(
  input: OrganizationOptimizationInput,
): OrganizationOptimizationResult {
  const validation = validateOrganizationOptimizationContext(input.context);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: normalizeOrganizationOptimizationContext(input.context) };
}
