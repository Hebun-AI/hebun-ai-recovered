/**
 * Enterprise Organizational Intelligence — organization awareness boundary (Phase 5).
 *
 * The boundary through which an awareness context enters and leaves the awareness
 * foundation, and the canonical declaration of what Strategic Awareness must never
 * become. It validates a proposed context, then canonicalizes it into an immutable
 * form. It performs NO awareness detection, NO assessment, NO scoring, NO
 * self-evaluation, NO governance, and mutates NOTHING — it only accepts, checks, and
 * canonicalizes the artifacts it is given.
 */

import type {
  AwarenessContext,
  CanonicalAwarenessContext,
} from "@/features/enterprise-organizational-intelligence/organization-awareness-types";
import { normalizeOrganizationAwarenessContext } from "@/features/enterprise-organizational-intelligence/organization-awareness-normalization";
import { validateOrganizationAwarenessContext } from "@/features/enterprise-organizational-intelligence/organization-awareness-validation";

/** The things Strategic Awareness must never become or do. Naming only. */
export type OrganizationAwarenessNonResponsibility =
  | "governance"
  | "policy-enforcement"
  | "decision"
  | "approval"
  | "authority"
  | "mitigation"
  | "pursuit"
  | "drift-correction"
  | "reorganization"
  | "work-prioritization"
  | "action"
  | "execution"
  | "automation"
  | "runtime";

/** The canonical, frozen set of Strategic Awareness non-responsibilities. */
export const ORGANIZATION_AWARENESS_NON_RESPONSIBILITIES: readonly OrganizationAwarenessNonResponsibility[] =
  Object.freeze([
    "governance",
    "policy-enforcement",
    "decision",
    "approval",
    "authority",
    "mitigation",
    "pursuit",
    "drift-correction",
    "reorganization",
    "work-prioritization",
    "action",
    "execution",
    "automation",
    "runtime",
  ]);

/** A proposed awareness context entering the boundary. */
export interface OrganizationAwarenessInput {
  readonly context: AwarenessContext;
}

/** The result of preparing an awareness context: canonical, or an explicit failure. */
export type OrganizationAwarenessResult =
  | { readonly ok: true; readonly value: CanonicalAwarenessContext }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then canonicalizes an awareness context. Pure and deterministic: the same
 * input always produces the same result. A validation failure yields explicit issues
 * and no canonical context.
 */
export function prepareOrganizationAwarenessContext(
  input: OrganizationAwarenessInput,
): OrganizationAwarenessResult {
  const validation = validateOrganizationAwarenessContext(input.context);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: normalizeOrganizationAwarenessContext(input.context) };
}
