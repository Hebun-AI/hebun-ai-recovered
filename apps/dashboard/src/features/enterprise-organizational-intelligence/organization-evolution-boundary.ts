/**
 * Enterprise Organizational Intelligence — organization evolution boundary (Phase 6).
 *
 * The boundary through which an evolution context enters and leaves the evolution
 * foundation, and the canonical declaration of what Strategic Enterprise Evolution must
 * never become. It validates a proposed context, then canonicalizes it into an immutable
 * form. It performs NO evolution, NO assessment, NO prediction, NO simulation, NO roadmap
 * amendment, and mutates NOTHING — it only accepts, checks, and canonicalizes the
 * artifacts it is given. Evolution describes; it never performs.
 */

import type {
  CanonicalEvolutionContext,
  EvolutionContext,
} from "@/features/enterprise-organizational-intelligence/organization-evolution-types";
import { normalizeOrganizationEvolutionContext } from "@/features/enterprise-organizational-intelligence/organization-evolution-normalization";
import { validateOrganizationEvolutionContext } from "@/features/enterprise-organizational-intelligence/organization-evolution-validation";

/** The things Strategic Enterprise Evolution must never become or do. Naming only. */
export type OrganizationEvolutionNonResponsibility =
  | "roadmap-amendment"
  | "roadmap-authority"
  | "governance"
  | "decision"
  | "approval"
  | "authority"
  | "evolution-performance"
  | "transformation"
  | "reorganization"
  | "action"
  | "execution"
  | "automation"
  | "runtime";

/** The canonical, frozen set of Strategic Enterprise Evolution non-responsibilities. */
export const ORGANIZATION_EVOLUTION_NON_RESPONSIBILITIES: readonly OrganizationEvolutionNonResponsibility[] =
  Object.freeze([
    "roadmap-amendment",
    "roadmap-authority",
    "governance",
    "decision",
    "approval",
    "authority",
    "evolution-performance",
    "transformation",
    "reorganization",
    "action",
    "execution",
    "automation",
    "runtime",
  ]);

/** A proposed evolution context entering the boundary. */
export interface OrganizationEvolutionInput {
  readonly context: EvolutionContext;
}

/** The result of preparing an evolution context: canonical, or an explicit failure. */
export type OrganizationEvolutionResult =
  | { readonly ok: true; readonly value: CanonicalEvolutionContext }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then canonicalizes an evolution context. Pure and deterministic: the same
 * input always produces the same result. A validation failure yields explicit issues and
 * no canonical context.
 */
export function prepareOrganizationEvolutionContext(
  input: OrganizationEvolutionInput,
): OrganizationEvolutionResult {
  const validation = validateOrganizationEvolutionContext(input.context);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: normalizeOrganizationEvolutionContext(input.context) };
}
