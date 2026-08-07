/**
 * Enterprise Organizational Intelligence Runtime — Director Briefing rules (Phase 8).
 *
 * Pure, deterministic projection of already-bound Phase 7 artifacts into uniform Director
 * Briefing items, the descriptive derivation of the governance view, and pure projections
 * over both. These carry every bound field — provenance, explainability, confidence,
 * uncertainty, lifecycle, and every supporting reference — through UNCHANGED, exposing the
 * lifecycle explicitly. NO runtime behaviour, NO candidate creation, NO fact creation, NO
 * reasoning, NO confidence calculation, NO uncertainty suppression, NO prioritization, NO
 * ranking, NO recommendation, NO governance decision, NO AI, NO orchestration — only a total,
 * repeatable artifact-to-item mapping and pure projections.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type { RuntimeCandidateKind } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type { CanonicalRuntimeBindingBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";
import type { BoundRuntimeArtifact } from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";
import type {
  DirectorBriefingGovernance,
  DirectorBriefingGovernanceInput,
  DirectorBriefingItem,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-types";

/** The approval marker every briefing item and briefing carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL = Object.freeze({ state: "pending-director" } as const);

/**
 * Projects one Phase 7 bound artifact into a uniform briefing item. Every carried field —
 * identity, kind, statement, provenance, explainability, confidence, uncertainty, and every
 * supporting reference — is UNCHANGED. The lifecycle is exposed explicitly from the artifact's
 * provenance; it is read, never advanced. The approval marker stays pending a Director
 * decision. Organizing forms and preserves; it never filters, ranks, decides, or fabricates.
 */
export function projectBriefingItem(artifact: BoundRuntimeArtifact): DirectorBriefingItem {
  return {
    bindingId: artifact.bindingId,
    sourceKind: artifact.sourceKind,
    sourceCandidateId: artifact.sourceCandidateId,
    statement: artifact.statement,
    provenance: artifact.provenance,
    explainability: artifact.explainability,
    confidence: artifact.confidence,
    evidenceRefs: artifact.evidenceRefs,
    learningRefs: artifact.learningRefs,
    optimizationRefs: artifact.optimizationRefs,
    awarenessRefs: artifact.awarenessRefs,
    evolutionRefs: artifact.evolutionRefs,
    lifecycle: artifact.provenance.lifecycle,
    approval: PENDING_DIRECTOR_APPROVAL,
  };
}

/**
 * Projects every bound artifact of a canonical binding bundle into briefing items, preserving
 * the bundle's own artifact order. Deterministic: the same bundle always yields the same
 * items. Organizing preserves every artifact — it drops none and adds none; normalization is
 * what imposes canonical order, validation is what fails an unqualified request closed.
 */
export function projectBriefingItems(
  bundle: CanonicalRuntimeBindingBundle,
): readonly DirectorBriefingItem[] {
  return bundle.artifacts.map(projectBriefingItem);
}

/**
 * Derives the descriptive governance view: the immutable constraints and declared
 * restrictions carried through UNCHANGED, the single pending-director approval marker, and the
 * binding identities of the briefing items that await a Director decision — one per item, in
 * item order. This EXPOSES governance state; it performs no governance decision — it never
 * approves, rejects, waives, or enforces.
 */
export function describeGovernance(
  input: DirectorBriefingGovernanceInput,
  items: readonly DirectorBriefingItem[],
): DirectorBriefingGovernance {
  return {
    constraints: input.constraints,
    heldImmutable: true,
    restrictions: input.restrictions,
    approval: PENDING_DIRECTOR_APPROVAL,
    pendingDirectorDecisions: items.map((item) => item.bindingId),
  };
}

// --- Projections -------------------------------------------------------------

/** The source candidate identity a briefing item projects. Read-only projection. */
export function briefingItemSource(item: DirectorBriefingItem): {
  readonly kind: RuntimeCandidateKind;
  readonly candidateId: RuntimeId;
} {
  return { kind: item.sourceKind, candidateId: item.sourceCandidateId };
}
