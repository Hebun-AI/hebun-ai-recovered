/**
 * Enterprise Organizational Intelligence — organization assembly rules (Phase 2).
 *
 * Pure, deterministic lookups over the canonical assembly descriptors, and
 * deterministic projections of a context into references, a tagged artifact
 * enumeration, a per-kind summary, and an evidence basis. These answer plain
 * questions — what layer is this kind, does it ground in memory, what did the context
 * gather. NO intelligence, NO learning, NO scoring, NO computation of anything;
 * table reads and pure projections only.
 */

import { evidenceKey } from "@/features/enterprise-memory-reasoning";
import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type {
  OrganizationAssembly,
  OrganizationAssemblyArtifact,
  OrganizationAssemblyArtifactDescriptor,
  OrganizationAssemblyArtifactKind,
  OrganizationAssemblyBasis,
  OrganizationAssemblyContext,
  OrganizationAssemblyReference,
  OrganizationAssemblySummary,
} from "@/features/enterprise-organizational-intelligence/organization-assembly-types";
import { ORGANIZATION_ASSEMBLY_ARTIFACT_DESCRIPTORS } from "@/features/enterprise-organizational-intelligence/organization-assembly-types";

export function organizationAssemblyArtifactDescriptorOf(
  kind: OrganizationAssemblyArtifactKind,
): OrganizationAssemblyArtifactDescriptor {
  return ORGANIZATION_ASSEMBLY_ARTIFACT_DESCRIPTORS[kind];
}

/** True when the kind carries a read-only evidence basis grounding it in memory. */
export function organizationAssemblyArtifactIsGrounded(kind: OrganizationAssemblyArtifactKind): boolean {
  return ORGANIZATION_ASSEMBLY_ARTIFACT_DESCRIPTORS[kind].isGrounded;
}

/** The canonical cross-kind ordering layer of an assembly artifact kind. */
export function organizationAssemblyLayerOf(kind: OrganizationAssemblyArtifactKind): number {
  return ORGANIZATION_ASSEMBLY_ARTIFACT_DESCRIPTORS[kind].layer;
}

/** Enumerates every gathered member of a context as a reference, in natural order. */
export function referencesOf(context: OrganizationAssemblyContext): readonly OrganizationAssemblyReference[] {
  return [
    ...context.organization.domains.map((domain) => ({ artifactKind: "domain" as const, artifactId: domain.domainId })),
    ...context.objectives.map((objective) => ({ artifactKind: "objective" as const, artifactId: objective.objectiveId })),
    ...context.state.observations.map((observation) => ({
      artifactKind: "observation" as const,
      artifactId: observation.observationId,
    })),
    ...context.state.constraints.map((constraint) => ({
      artifactKind: "constraint" as const,
      artifactId: constraint.constraintId,
    })),
    ...context.state.capabilities.map((capability) => ({
      artifactKind: "capability" as const,
      artifactId: capability.capabilityId,
    })),
    ...context.state.opportunities.map((opportunity) => ({
      artifactKind: "opportunity" as const,
      artifactId: opportunity.opportunityId,
    })),
    ...context.state.risks.map((risk) => ({ artifactKind: "risk" as const, artifactId: risk.riskId })),
  ];
}

/** Enumerates every gathered member of a context as a tagged artifact, in natural order. */
export function artifactsOf(context: OrganizationAssemblyContext): readonly OrganizationAssemblyArtifact[] {
  return [
    ...context.organization.domains.map((value) => ({ kind: "domain" as const, value })),
    ...context.objectives.map((value) => ({ kind: "objective" as const, value })),
    ...context.state.observations.map((value) => ({ kind: "observation" as const, value })),
    ...context.state.constraints.map((value) => ({ kind: "constraint" as const, value })),
    ...context.state.capabilities.map((value) => ({ kind: "capability" as const, value })),
    ...context.state.opportunities.map((value) => ({ kind: "opportunity" as const, value })),
    ...context.state.risks.map((value) => ({ kind: "risk" as const, value })),
  ];
}

/** A deterministic per-kind tally of what a context gathered. Carried, never judged. */
export function summaryOf(context: OrganizationAssemblyContext): OrganizationAssemblySummary {
  const counts: Record<OrganizationAssemblyArtifactKind, number> = {
    domain: context.organization.domains.length,
    objective: context.objectives.length,
    observation: context.state.observations.length,
    constraint: context.state.constraints.length,
    capability: context.state.capabilities.length,
    opportunity: context.state.opportunities.length,
    risk: context.state.risks.length,
  };
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return { counts, total };
}

/**
 * The evidence basis a context rests on — the de-duplicated union of the evidence
 * grounding its observations, opportunities, and risks. Ordered by canonical key.
 */
export function basisOf(context: OrganizationAssemblyContext): OrganizationAssemblyBasis {
  const byKey = new Map<string, EvidenceReference>();
  const grounded: readonly (readonly EvidenceReference[])[] = [
    ...context.state.observations.map((observation) => observation.basis),
    ...context.state.opportunities.map((opportunity) => opportunity.basis),
    ...context.state.risks.map((risk) => risk.basis),
  ];
  for (const references of grounded) {
    for (const reference of references) {
      const key = evidenceKey(reference);
      if (!byKey.has(key)) byKey.set(key, reference);
    }
  }
  const evidence = [...byKey.keys()]
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map((key) => {
      const reference = byKey.get(key);
      if (reference === undefined) throw new Error("basisOf: missing reference");
      return reference;
    });
  return { evidence };
}

/** True when the assembly rests on at least one piece of evidence. */
export function reachesEvidenceRoot(assembly: OrganizationAssembly): boolean {
  return assembly.basis.evidence.length > 0;
}
