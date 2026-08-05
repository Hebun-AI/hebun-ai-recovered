/**
 * Enterprise Organizational Intelligence — organization assembly validation (Phase 2).
 *
 * Validates the STRUCTURAL integrity of a proposed organization assembly: the context
 * is structurally consistent — by REUSING the published Phase 1 structural validator
 * (declared organization and scope, scope within declared domains, every artifact
 * naming a declared domain, evidence-requiring artifacts carrying a basis, no
 * duplicate ids) — and the assembly gathers at least one artifact. This is a plain,
 * deterministic structural check — NOT intelligence, NOT learning, NOT inference. It
 * confirms the assembly is consistent and traceable; it never alters an artifact.
 */

import { validateOrganizationUnderstanding } from "@/features/enterprise-organizational-intelligence/validation";
import type { OrganizationUnderstanding } from "@/features/enterprise-organizational-intelligence/organization-understanding";
import type { OrganizationAssemblyContext } from "@/features/enterprise-organizational-intelligence/organization-assembly-types";
import { referencesOf } from "@/features/enterprise-organizational-intelligence/organization-assembly-rules";

export type OrganizationAssemblyValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

export function validateOrganizationAssembly(context: OrganizationAssemblyContext): OrganizationAssemblyValidation {
  const issues: string[] = [];

  // Reuse the published Phase 1 structural validator against the gathered context.
  // producedAt is unused by the structural check; an empty value is carried only to
  // satisfy the contract shape and is never inspected.
  const understanding: OrganizationUnderstanding = {
    organization: context.organization,
    scope: context.scope,
    objectives: context.objectives,
    state: context.state,
    producedAt: "",
  };
  const structural = validateOrganizationUnderstanding(understanding);
  if (!structural.ok) issues.push(...structural.issues);

  // An assembly must gather at least one artifact.
  if (referencesOf(context).length === 0) {
    issues.push("assembly gathers no artifacts");
  }

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
