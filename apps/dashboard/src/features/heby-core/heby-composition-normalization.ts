/**
 * Heby Core — composition normalization (Phase 9, Integration and Composition Closure).
 *
 * Deterministically canonicalizes an end-to-end composition:
 *   - the stage ledger is ordered by phase — arrangement only, never a rank, score, priority, or
 *     recommendation,
 *   - the isolation scope is frozen,
 *   - the fixed identity and the terminal Director briefing are carried UNCHANGED — Phase 9
 *     regenerates and reinterprets no earlier-phase result; both are already canonical and
 *     deep-frozen by their own phases,
 *   - the whole composition is emitted immutable and deep-frozen.
 *
 * Pure canonical normalization: NO model call, NO decision, NO mutation of any composed value,
 * and NO change of semantic meaning. Keys use JSON encoding so they are unambiguous, text-safe,
 * UTF-8 stable, and NUL-safe. Normalization is idempotent: the canonical form of a canonical
 * composition is itself.
 */

import {
  type CanonicalHebyComposition,
  type HebyComposition,
  type HebyCompositionStage,
} from "@/features/heby-core/heby-composition-types";
import { hebyCompositionPhaseOrder } from "@/features/heby-core/heby-composition-rules";
import type { HebyGovernanceScope } from "@/features/heby-core/heby-governance-types";

/** Orders the stage ledger by phase — arrangement only. Each stage is frozen. */
function orderStages(stages: readonly HebyCompositionStage[]): readonly HebyCompositionStage[] {
  return [...stages]
    .sort((left, right) => hebyCompositionPhaseOrder(left.phase) - hebyCompositionPhaseOrder(right.phase))
    .map((stage) => Object.freeze({ ...stage }));
}

function freezeScope(scope: HebyGovernanceScope): HebyGovernanceScope {
  return Object.freeze({ tenantId: scope.tenantId, organizationId: scope.organizationId });
}

/**
 * Canonicalizes a composition into an immutable, deep-frozen form. Deterministic and idempotent:
 * the same input always produces the same canonical composition, and the canonical form of a
 * canonical composition is itself. The stage ledger is ordered; the scope is frozen; the identity
 * and the terminal briefing are carried UNCHANGED.
 */
export function normalizeHebyComposition(composition: HebyComposition): CanonicalHebyComposition {
  return Object.freeze({
    identity: composition.identity,
    contextId: composition.contextId,
    presentationId: composition.presentationId,
    intentId: composition.intentId,
    scope: freezeScope(composition.scope),
    stages: Object.freeze(orderStages(composition.stages)),
    briefing: composition.briefing,
  });
}

/**
 * A canonical, text-safe key for a whole composition. The same composition always produces the
 * same key. Unambiguous, UTF-8 stable, and NUL-safe.
 */
export function canonicalHebyCompositionKey(composition: HebyComposition): string {
  return JSON.stringify([
    composition.identity.identity,
    composition.contextId,
    composition.presentationId,
    composition.intentId,
    [composition.scope.tenantId, composition.scope.organizationId],
    orderStages(composition.stages).map((stage) => [stage.phase, stage.artifactId]),
    composition.briefing.presentationId,
    composition.briefing.intentId,
  ]);
}
