/**
 * Enterprise Organizational Intelligence — organization assembly type descriptors (Phase 2).
 *
 * Declares what an assembled organization IS: the kinds of Phase 1 artifact it
 * gathers, and the shapes of an assembly reference, chain, summary, basis, context,
 * artifact, assembly record, and bundle. This is canonical, immutable declarative
 * data — lookup tables and contract shapes, not an engine.
 *
 * This phase ONLY gathers already-published Phase 1 OI artifacts (domains,
 * objectives, observations, constraints, capabilities, opportunities, risks) under a
 * single canonical Organization Assembly. It produces NO intelligence, NO learning,
 * NO optimization, NO awareness, NO scoring, NO recommendation, NO decision. It
 * computes nothing, decides nothing, and mutates nothing — no runtime, no AI, no
 * agent, no dashboard. It builds only on OI Phase 1 and the published Memory and
 * Reasoning foundations.
 */

import type { EvidenceReference } from "@/features/enterprise-memory-reasoning";
import type { Organization } from "@/features/enterprise-organizational-intelligence/organization";
import type { OrganizationScope } from "@/features/enterprise-organizational-intelligence/organization-scope";
import type { OrganizationDomain } from "@/features/enterprise-organizational-intelligence/organization-domain";
import type { OrganizationObjective } from "@/features/enterprise-organizational-intelligence/organization-objective";
import type { OrganizationObservation } from "@/features/enterprise-organizational-intelligence/organization-observation";
import type { OrganizationConstraint } from "@/features/enterprise-organizational-intelligence/organization-constraint";
import type { OrganizationCapability } from "@/features/enterprise-organizational-intelligence/organization-capability";
import type { OrganizationOpportunity } from "@/features/enterprise-organizational-intelligence/organization-opportunity";
import type { OrganizationRisk } from "@/features/enterprise-organizational-intelligence/organization-risk";
import type { OrganizationState } from "@/features/enterprise-organizational-intelligence/organization-state";

/** The kinds of Phase 1 artifact an organization assembly gathers. */
export type OrganizationAssemblyArtifactKind =
  | "domain"
  | "objective"
  | "observation"
  | "constraint"
  | "capability"
  | "opportunity"
  | "risk";

/** The fixed, canonical properties of a gathered assembly artifact kind. */
export interface OrganizationAssemblyArtifactDescriptor {
  readonly artifactKind: OrganizationAssemblyArtifactKind;
  /** Whether the kind carries a read-only evidence basis grounding it in memory. */
  readonly isGrounded: boolean;
  /** A fixed integer for canonical cross-kind ordering. Ordinal only — not a score. */
  readonly layer: number;
}

/**
 * The canonical descriptor for every gathered assembly artifact kind. Frozen and
 * immutable. Layers give a deterministic cross-kind order: structure first (domains,
 * objectives), then the observed state (observations, constraints, capabilities,
 * opportunities, risks). Observations, opportunities, and risks carry an evidence
 * basis; the rest are declared structure.
 */
export const ORGANIZATION_ASSEMBLY_ARTIFACT_DESCRIPTORS: Readonly<
  Record<OrganizationAssemblyArtifactKind, OrganizationAssemblyArtifactDescriptor>
> = Object.freeze({
  domain: Object.freeze({ artifactKind: "domain", isGrounded: false, layer: 0 }),
  objective: Object.freeze({ artifactKind: "objective", isGrounded: false, layer: 1 }),
  observation: Object.freeze({ artifactKind: "observation", isGrounded: true, layer: 2 }),
  constraint: Object.freeze({ artifactKind: "constraint", isGrounded: false, layer: 3 }),
  capability: Object.freeze({ artifactKind: "capability", isGrounded: false, layer: 4 }),
  opportunity: Object.freeze({ artifactKind: "opportunity", isGrounded: true, layer: 5 }),
  risk: Object.freeze({ artifactKind: "risk", isGrounded: true, layer: 6 }),
});

/** One immutable pointer to a gathered artifact, by kind and its canonical id. */
export interface OrganizationAssemblyReference {
  readonly artifactKind: OrganizationAssemblyArtifactKind;
  readonly artifactId: string;
}

/** The canonical, de-duplicated, totally ordered index of every gathered artifact. */
export interface OrganizationAssemblyChain {
  readonly references: readonly OrganizationAssemblyReference[];
}

/** A deterministic tally of what the assembly gathered, by kind. Carried, not judged. */
export interface OrganizationAssemblySummary {
  readonly counts: Readonly<Record<OrganizationAssemblyArtifactKind, number>>;
  readonly total: number;
}

/** The memory grounding of the whole assembly — its de-duplicated evidence references. */
export interface OrganizationAssemblyBasis {
  readonly evidence: readonly EvidenceReference[];
}

/**
 * The concrete Phase 1 artifacts an assembly holds, carried UNCHANGED. Assembly
 * gathers and canonically orders these; it never mutates, enriches, or re-derives
 * any of them, and it produces no new artifact.
 */
export interface OrganizationAssemblyContext {
  readonly organization: Organization;
  readonly scope: OrganizationScope;
  readonly objectives: readonly OrganizationObjective[];
  readonly state: OrganizationState;
}

/** One concrete gathered member, tagged by kind — the inspectable artifact enumeration. */
export type OrganizationAssemblyArtifact =
  | { readonly kind: "domain"; readonly value: OrganizationDomain }
  | { readonly kind: "objective"; readonly value: OrganizationObjective }
  | { readonly kind: "observation"; readonly value: OrganizationObservation }
  | { readonly kind: "constraint"; readonly value: OrganizationConstraint }
  | { readonly kind: "capability"; readonly value: OrganizationCapability }
  | { readonly kind: "opportunity"; readonly value: OrganizationOpportunity }
  | { readonly kind: "risk"; readonly value: OrganizationRisk };

/**
 * The assembled organization record: the organization it covers, the scope it is
 * bounded to, the canonical chain indexing every gathered artifact, a deterministic
 * summary, and the evidence basis it rests on. It carries no new conclusion.
 */
export interface OrganizationAssembly {
  readonly organizationId: string;
  readonly scopeId: string;
  readonly chain: OrganizationAssemblyChain;
  readonly summary: OrganizationAssemblySummary;
  readonly basis: OrganizationAssemblyBasis;
}

/**
 * The complete, immutable deliverable: the assembled organization record together
 * with the concrete Phase 1 artifacts it indexes. This is what a human or a later OI
 * phase consumes — bounded, evidence-grounded, and traceable, with nothing decided.
 */
export interface OrganizationAssemblyBundle {
  readonly assembly: OrganizationAssembly;
  readonly context: OrganizationAssemblyContext;
}

/**
 * A bundle that has passed through assembly normalization: context sets de-duplicated
 * and canonically ordered, and the assembly index derived deterministically from that
 * canonical context. Structurally an {@link OrganizationAssemblyBundle}; the alias
 * marks that canonical form has been applied.
 */
export type CanonicalOrganizationAssembly = OrganizationAssemblyBundle;
