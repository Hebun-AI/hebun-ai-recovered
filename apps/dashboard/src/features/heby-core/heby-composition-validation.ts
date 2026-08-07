/**
 * Heby Core — composition validation (Phase 9, Integration and Composition Closure).
 *
 * Validates cross-phase integrity across the composed pass and the integrity of the produced
 * composition: Heby's identity is intact and immutable throughout; the bound context is the same
 * context at every phase; the presentation identity threads unchanged from presentation through
 * grounding and governance into the briefing; the interpreted intent threads unchanged from
 * intent through approval and governance into the briefing; tenant, organization, scope, and
 * constraints stay consistent; the briefing terminates at the Director with a full audit; and the
 * stage ledger records exactly the fixed boundary order with the correct artifact identities.
 *
 * This is a plain, deterministic structural check — NOT reasoning, NOT invention, NOT a decision,
 * NOT a silent repair. It is fail-closed: any cross-phase inconsistency, any omitted or phantom
 * stage, any drifted identity, or any broken Director termination blocks the whole composition.
 * No hidden artifact omission, no silent semantic repair, no inference, no fabrication, and no
 * mutation of any upstream output.
 */

import {
  type HebyComposition,
  type HebyCompositionPhase,
} from "@/features/heby-core/heby-composition-types";
import { isHebyCompositionPhase } from "@/features/heby-core/heby-composition-rules";
import { validateHebyIdentity, verifyHebyIdentityFrozen } from "@/features/heby-core/heby-identity-validation";
import { validateHebyDirectorBriefing } from "@/features/heby-core/heby-briefing-validation";
import type { CanonicalHebyIdentity } from "@/features/heby-core/heby-identity-types";
import type { HebyConstraint, HebyContextBinding } from "@/features/heby-core/heby-input-context-types";
import type { HebyPresentation } from "@/features/heby-core/heby-presentation-types";
import type { HebyGroundedPresentation } from "@/features/heby-core/heby-grounding-types";
import type { HebyRoutedIntent } from "@/features/heby-core/heby-intent-types";
import type { HebyPreparedApproval } from "@/features/heby-core/heby-approval-types";
import type { HebyGatedPresentation } from "@/features/heby-core/heby-governance-types";
import type { HebyDirectorBriefing } from "@/features/heby-core/heby-briefing-types";
import type { HebyId } from "@/features/heby-core/heby-identity-types";

export type HebyCompositionValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly string[] };

function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

/** A stable, order-independent key over a constraint set for consistency comparison. */
function constraintSetKey(constraints: readonly HebyConstraint[]): string {
  return JSON.stringify(
    [...constraints]
      .map((c) => [c.constraintKind, c.constraintId, c.statement] as const)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  );
}

/** Records an inconsistency when two threaded values disagree. */
function requireEqual(left: string, right: string, label: string, issues: string[]): void {
  if (left !== right) issues.push(`${label} is inconsistent across composition ('${left}' vs '${right}')`);
}

/**
 * Validates cross-phase consistency over the intermediate artifacts the composition threaded.
 * Fail-closed: any drift of identity, context, presentation identity, intent identity, scope, or
 * constraints, or any broken Director termination, blocks the composition.
 */
export function validateHebyCompositionSeams(
  identity: CanonicalHebyIdentity,
  binding: HebyContextBinding,
  presentation: HebyPresentation,
  grounded: HebyGroundedPresentation,
  routed: HebyRoutedIntent,
  prepared: HebyPreparedApproval,
  gated: HebyGatedPresentation,
  briefing: HebyDirectorBriefing,
): HebyCompositionValidation {
  const issues: string[] = [];

  // Identity: valid and immutable throughout.
  const identityValidation = validateHebyIdentity(identity);
  if (!identityValidation.ok) for (const issue of identityValidation.issues) issues.push(`identity: ${issue}`);
  const frozen = verifyHebyIdentityFrozen(identity);
  if (!frozen.ok) for (const issue of frozen.issues) issues.push(`identity: ${issue}`);

  // Context: the same bound context at every phase.
  const contextId = binding.context.contextId;
  requireEqual(contextId, presentation.context.contextId, "context", issues);
  requireEqual(contextId, grounded.context.contextId, "context", issues);
  requireEqual(contextId, routed.context.contextId, "context", issues);
  requireEqual(contextId, gated.context.contextId, "context", issues);
  requireEqual(contextId, briefing.context.contextId, "context", issues);

  // Presentation identity: threads unchanged.
  requireEqual(binding.requestId, presentation.requestId, "request identity", issues);
  const presentationId = presentation.presentationId;
  requireEqual(presentationId, grounded.presentationId, "presentation identity", issues);
  requireEqual(presentationId, gated.presentationId, "presentation identity", issues);
  requireEqual(presentationId, briefing.presentationId, "presentation identity", issues);

  // Intent identity: threads unchanged.
  const intentId = routed.intentId;
  requireEqual(intentId, prepared.intentId, "intent identity", issues);
  requireEqual(intentId, gated.intentId, "intent identity", issues);
  requireEqual(intentId, briefing.intentId, "intent identity", issues);

  // Tenant / organization / scope: consistent.
  requireEqual(binding.context.tenantId, gated.scope.tenantId, "tenant", issues);
  requireEqual(binding.context.organizationId, gated.scope.organizationId, "organization", issues);
  requireEqual(gated.scope.tenantId, briefing.scope.tenantId, "tenant scope", issues);
  requireEqual(gated.scope.organizationId, briefing.scope.organizationId, "organization scope", issues);

  // Constraints: carried consistently, never authored or dropped.
  requireEqual(constraintSetKey(binding.context.constraints), constraintSetKey(gated.constraints), "constraints", issues);
  requireEqual(constraintSetKey(gated.constraints), constraintSetKey(briefing.constraints), "constraints", issues);

  // Human termination: the briefing terminates at the Director with a full audit.
  if (briefing.termination.terminatesAtDirector !== true) issues.push("composition does not terminate at the Director");
  requireEqual(binding.context.authorityBasis, briefing.termination.authorityBasis, "authority", issues);
  const briefingValidation = validateHebyDirectorBriefing(briefing);
  if (!briefingValidation.ok) for (const issue of briefingValidation.issues) issues.push(`briefing: ${issue}`);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Validates a produced composition. Defensive, post-assembly, and fail-closed: the identity is
 * intact and immutable, the seam identities are present, the scope matches the briefing, the
 * stage ledger records exactly the fixed boundary order with the correct artifact identities, and
 * the terminal briefing terminates at the Director with a full audit.
 */
export function validateHebyComposition(composition: HebyComposition): HebyCompositionValidation {
  const issues: string[] = [];

  const identityValidation = validateHebyIdentity(composition.identity);
  if (!identityValidation.ok) for (const issue of identityValidation.issues) issues.push(`identity: ${issue}`);

  if (!isNonEmpty(composition.contextId)) issues.push("composition declares no contextId");
  if (!isNonEmpty(composition.presentationId)) issues.push("composition declares no presentationId");
  if (!isNonEmpty(composition.intentId)) issues.push("composition declares no intentId");

  requireEqual(composition.scope.tenantId, composition.briefing.scope.tenantId, "tenant scope", issues);
  requireEqual(composition.scope.organizationId, composition.briefing.scope.organizationId, "organization scope", issues);
  requireEqual(composition.presentationId, composition.briefing.presentationId, "presentation identity", issues);
  requireEqual(composition.intentId, composition.briefing.intentId, "intent identity", issues);

  // Stage ledger: exactly the fixed boundary order, correct artifact identity per phase.
  const expected: Readonly<Record<HebyCompositionPhase, HebyId>> = {
    identity: composition.identity.identity,
    context: composition.contextId,
    presentation: composition.presentationId,
    grounding: composition.presentationId,
    intent: composition.intentId,
    approval: composition.intentId,
    governance: composition.presentationId,
    briefing: composition.presentationId,
  };
  const seen = new Set<HebyCompositionPhase>();
  for (const stage of composition.stages) {
    if (!isHebyCompositionPhase(stage.phase)) {
      issues.push(`stage declares unknown phase '${stage.phase}'`);
      continue;
    }
    if (seen.has(stage.phase)) issues.push(`stage '${stage.phase}' appears more than once`);
    seen.add(stage.phase);
    if (stage.artifactId !== expected[stage.phase]) issues.push(`stage '${stage.phase}' records the wrong artifact identity`);
  }
  for (const phase of Object.keys(expected) as HebyCompositionPhase[]) {
    if (!seen.has(phase)) issues.push(`stage '${phase}' is missing from the ledger`);
  }

  if (composition.briefing.termination.terminatesAtDirector !== true) issues.push("composition does not terminate at the Director");
  const briefingValidation = validateHebyDirectorBriefing(composition.briefing);
  if (!briefingValidation.ok) for (const issue of briefingValidation.issues) issues.push(`briefing: ${issue}`);

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}

/**
 * Verifies that a canonical composition is deep-frozen: the composition, its identity, its scope,
 * its stage ledger and every stage, and its terminal briefing are all immutable. Defensive,
 * post-normalization, and fail-closed.
 */
export function verifyHebyCompositionFrozen(composition: HebyComposition): HebyCompositionValidation {
  const issues: string[] = [];

  if (!Object.isFrozen(composition)) issues.push("composition is not frozen");
  if (!Object.isFrozen(composition.identity)) issues.push("identity is not frozen");
  if (!Object.isFrozen(composition.scope)) issues.push("scope is not frozen");
  if (!Object.isFrozen(composition.stages)) issues.push("stage ledger is not frozen");
  for (const stage of composition.stages) {
    if (!Object.isFrozen(stage)) issues.push(`stage '${stage.phase}' is not frozen`);
  }
  if (!Object.isFrozen(composition.briefing)) issues.push("briefing is not frozen");

  return issues.length === 0 ? { ok: true } : { ok: false, issues };
}
