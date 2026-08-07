/**
 * Enterprise Organizational Intelligence Runtime — binding normalization (Phase 7).
 *
 * Deterministically canonicalizes a Runtime Binding bundle:
 *   - each artifact's evidence, learning, optimization, awareness, and evolution references
 *     are de-duplicated and totally ordered,
 *   - artifacts are de-duplicated by binding identity and ordered by canonical binding key,
 *   - provenance, explainability, confidence, and uncertainty are carried through
 *     UNCHANGED — preserved, never reordered or rewritten,
 *   - the whole bundle is emitted immutable and frozen.
 *
 * This is pure canonical normalization — NO runtime behaviour, NO reasoning, NO confidence
 * calculation, NO uncertainty suppression, NO mutation of any preserved value. Ordering and
 * de-duplication happen by canonical key only. Keys use JSON encoding so they are
 * unambiguous, text-safe, UTF-8 stable, and NUL-safe.
 */

import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";
import type {
  BoundRuntimeArtifact,
  CanonicalRuntimeBindingBundle,
  RuntimeBindingBundle,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-binding-types";

function compareStrings(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/** De-duplicates and totally orders a set of references. */
export function normalizeReferenceIds(refs: readonly RuntimeId[]): readonly RuntimeId[] {
  const seen = new Set<RuntimeId>();
  for (const ref of refs) seen.add(ref);
  return [...seen].sort(compareStrings);
}

/** An unambiguous, text-safe key for one bound artifact. */
export function boundArtifactKey(artifact: BoundRuntimeArtifact): string {
  return JSON.stringify([
    artifact.bindingId,
    artifact.sourceKind,
    artifact.sourceCandidateId,
    artifact.statement,
    normalizeReferenceIds(artifact.evidenceRefs),
    normalizeReferenceIds(artifact.learningRefs),
    normalizeReferenceIds(artifact.optimizationRefs),
    normalizeReferenceIds(artifact.awarenessRefs),
    normalizeReferenceIds(artifact.evolutionRefs),
    artifact.provenance.version,
    artifact.provenance.lifecycle,
    artifact.confidence.level,
    artifact.approval.state,
  ]);
}

/**
 * Canonicalizes a bound artifact: its reference lists de-duplicated and ordered, every
 * other field — identity, kind, statement, provenance, explainability, confidence, approval
 * — carried UNCHANGED. Frozen.
 */
export function normalizeBoundArtifact(artifact: BoundRuntimeArtifact): BoundRuntimeArtifact {
  return Object.freeze({
    bindingId: artifact.bindingId,
    sourceKind: artifact.sourceKind,
    sourceCandidateId: artifact.sourceCandidateId,
    statement: artifact.statement,
    provenance: artifact.provenance,
    explainability: artifact.explainability,
    confidence: artifact.confidence,
    evidenceRefs: normalizeReferenceIds(artifact.evidenceRefs),
    learningRefs: normalizeReferenceIds(artifact.learningRefs),
    optimizationRefs: normalizeReferenceIds(artifact.optimizationRefs),
    awarenessRefs: normalizeReferenceIds(artifact.awarenessRefs),
    evolutionRefs: normalizeReferenceIds(artifact.evolutionRefs),
    approval: artifact.approval,
  });
}

/**
 * De-duplicates artifacts by binding identity (first occurrence wins) and orders them by
 * canonical binding identity. Each artifact is canonicalized. Deterministic — shuffled
 * inputs produce identical canonical output.
 */
export function normalizeBoundArtifacts(
  artifacts: readonly BoundRuntimeArtifact[],
): readonly BoundRuntimeArtifact[] {
  const byId = new Map<RuntimeId, BoundRuntimeArtifact>();
  for (const artifact of artifacts) {
    if (!byId.has(artifact.bindingId)) byId.set(artifact.bindingId, artifact);
  }
  return [...byId.values()]
    .sort((left, right) => compareStrings(left.bindingId, right.bindingId))
    .map(normalizeBoundArtifact);
}

/** A canonical key for a bundle: its request identity, approval state, and ordered artifact keys. */
export function canonicalRuntimeBindingBundleKey(bundle: CanonicalRuntimeBindingBundle): string {
  return JSON.stringify([
    bundle.requestId,
    bundle.approval.state,
    bundle.artifacts.map(boundArtifactKey),
  ]);
}

/**
 * Canonicalizes a Runtime Binding bundle into an immutable, frozen form. Deterministic: the
 * same input always produces the same canonical bundle. Artifacts are canonicalized and
 * ordered; the approval marker and every preserved value are unchanged.
 */
export function normalizeRuntimeBindingBundle(
  bundle: RuntimeBindingBundle,
): CanonicalRuntimeBindingBundle {
  return Object.freeze({
    requestId: bundle.requestId,
    artifacts: Object.freeze(normalizeBoundArtifacts(bundle.artifacts)),
    approval: bundle.approval,
  });
}
