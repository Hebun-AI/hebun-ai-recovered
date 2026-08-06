/**
 * Enterprise Organizational Intelligence — organization learning boundary (Phase 3).
 *
 * The boundary through which a learning context enters and leaves the learning
 * foundation, and the canonical declaration of what Organizational Learning must
 * never become. It validates a proposed context, then canonicalizes it into an
 * immutable form. It performs NO learning identification, NO generation, NO memory
 * admission, and mutates NOTHING — it only accepts, checks, and canonicalizes the
 * learnings it is given.
 */

import type {
  CanonicalOrganizationLearningContext,
  OrganizationLearningContext,
} from "@/features/enterprise-organizational-intelligence/organization-learning-types";
import { normalizeOrganizationLearningContext } from "@/features/enterprise-organizational-intelligence/organization-learning-normalization";
import { validateOrganizationLearningContext } from "@/features/enterprise-organizational-intelligence/organization-learning-validation";

/** The things Organizational Learning must never become or do. Naming only. */
export type OrganizationLearningNonResponsibility =
  | "memory-admission"
  | "knowledge-creation"
  | "evidence-creation"
  | "reasoning"
  | "decision"
  | "approval"
  | "authority"
  | "action"
  | "execution"
  | "automation"
  | "runtime";

/** The canonical, frozen set of Organizational Learning non-responsibilities. */
export const ORGANIZATION_LEARNING_NON_RESPONSIBILITIES: readonly OrganizationLearningNonResponsibility[] =
  Object.freeze([
    "memory-admission",
    "knowledge-creation",
    "evidence-creation",
    "reasoning",
    "decision",
    "approval",
    "authority",
    "action",
    "execution",
    "automation",
    "runtime",
  ]);

/** A proposed learning context entering the boundary. */
export interface OrganizationLearningInput {
  readonly context: OrganizationLearningContext;
}

/** The result of preparing a learning context: canonical, or an explicit failure. */
export type OrganizationLearningResult =
  | { readonly ok: true; readonly value: CanonicalOrganizationLearningContext }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then canonicalizes a learning context. Pure and deterministic: the same
 * input always produces the same result. A validation failure yields explicit issues
 * and no canonical context.
 */
export function prepareOrganizationLearningContext(input: OrganizationLearningInput): OrganizationLearningResult {
  const validation = validateOrganizationLearningContext(input.context);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: normalizeOrganizationLearningContext(input.context) };
}
