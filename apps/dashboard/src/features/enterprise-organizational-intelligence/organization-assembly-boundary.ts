/**
 * Enterprise Organizational Intelligence — organization assembly boundary (Phase 2).
 *
 * The boundary through which Phase 1 artifacts enter assembly and leave as a single
 * canonical organization bundle. It validates a proposed context, then assembles it
 * into a canonical, immutable bundle. It performs NO intelligence, produces NO new
 * artifact, and mutates NOTHING — it only accepts, checks, gathers, canonically
 * orders, and freezes the published artifacts it is given.
 */

import type { OrganizationAssemblyBundle, OrganizationAssemblyContext } from "@/features/enterprise-organizational-intelligence/organization-assembly-types";
import { normalizeOrganizationAssemblyBundle } from "@/features/enterprise-organizational-intelligence/organization-assembly-normalization";
import { validateOrganizationAssembly } from "@/features/enterprise-organizational-intelligence/organization-assembly-validation";

/** A proposed set of Phase 1 artifacts entering the assembly boundary. */
export interface OrganizationAssemblyInput {
  readonly context: OrganizationAssemblyContext;
}

/** The result of assembling an organization: a canonical bundle, or an explicit failure. */
export type OrganizationAssemblyResult =
  | { readonly ok: true; readonly value: OrganizationAssemblyBundle }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then assembles a canonical, immutable organization bundle from the given
 * context. Pure and deterministic: the same input always produces the same bundle. A
 * validation failure yields explicit issues and no bundle.
 */
export function assembleOrganizationBundle(input: OrganizationAssemblyInput): OrganizationAssemblyResult {
  const validation = validateOrganizationAssembly(input.context);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: normalizeOrganizationAssemblyBundle(input.context) };
}
