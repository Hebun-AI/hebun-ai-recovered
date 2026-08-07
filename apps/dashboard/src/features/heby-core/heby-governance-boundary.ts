/**
 * Heby Core — governance boundary (Phase 7, Governance and Security Constraint Enforcement).
 *
 * The immutable boundary through which a Phase 4 grounded presentation and a Phase 6 prepared
 * approval enter and a frozen, gated presentation leaves, and the canonical declaration of what
 * Phase 7 MAY do and MUST NEVER do. It holds the applicable constraints IMMUTABLE (consume-only)
 * and gates the rendered surface deterministically: an isolation mismatch stops the whole surface
 * and records a presentation-level block; otherwise each rendered element is admitted or blocked
 * for a protected classification, unresolved evidence, or ineligible evidence, and each prepared
 * item survives only if every element it rests on survived. Every block is recorded.
 *
 * It APPROVES nothing, WAIVES nothing, AUTHORS nothing, REINTERPRETS no constraint, and never
 * rejects, decides, resolves a decision, advances past the Director, executes, triggers a
 * workflow, orchestrates, calls a model, trusts model output, invents, fabricates confidence,
 * suppresses uncertainty, exposes a secret, mutates any upstream system, invokes an API, or
 * bypasses the Director. It does NOT trust upstream conclusions — it re-enforces governance
 * independently. Every permitted capability is holding, gating, recording, or preserving. Every
 * prohibited capability is explicitly modelled so no later phase can quietly acquire it here.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Input and Context), Phase 3 (Presentation),
 * Phase 4 (Grounding), Phase 5 (Intent), and Phase 6 (Approval Preparation).
 */

import {
  type CanonicalHebyGatedPresentation,
  type HebyGatedPresentation,
  type HebyGovernanceBlock,
  type HebyGovernanceGateRequest,
} from "@/features/heby-core/heby-governance-types";
import {
  hebyClassifyElementGovernance,
  hebyGovernanceBlockReasonConstraintKind,
  hebyGovernanceScopeOf,
  hebyScopeMismatchReason,
} from "@/features/heby-core/heby-governance-rules";
import { normalizeHebyGatedPresentation } from "@/features/heby-core/heby-governance-normalization";
import {
  validateHebyGatedPresentation,
  validateHebyGovernanceGateRequest,
  verifyHebyGatedPresentationFrozen,
} from "@/features/heby-core/heby-governance-validation";
import { hebyInputIndex } from "@/features/heby-core/heby-input-context-rules";
import type { HebyPresentationElement } from "@/features/heby-core/heby-presentation-types";
import type { HebyPreparedItem } from "@/features/heby-core/heby-approval-types";

/** The things Phase 7 MAY do. Holding, gating, recording, or preserving only. */
export type HebyGovernanceCapability =
  | "hold-constraint-immutable"
  | "gate-presentation"
  | "block-violation"
  | "record-block"
  | "enforce-tenant-isolation"
  | "enforce-organization-isolation"
  | "enforce-evidence-eligibility"
  | "carry-classification"
  | "preserve-identity"
  | "preserve-context"
  | "preserve-grounding"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 7 capabilities. */
export const HEBY_GOVERNANCE_CAPABILITIES: readonly HebyGovernanceCapability[] = Object.freeze([
  "hold-constraint-immutable",
  "gate-presentation",
  "block-violation",
  "record-block",
  "enforce-tenant-isolation",
  "enforce-organization-isolation",
  "enforce-evidence-eligibility",
  "carry-classification",
  "preserve-identity",
  "preserve-context",
  "preserve-grounding",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 7 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyGovernanceNonResponsibility =
  | "approve"
  | "waive"
  | "author-constraint"
  | "reinterpret-constraint"
  | "reject"
  | "decide"
  | "resolve-decision"
  | "advance-past-director"
  | "execute"
  | "trigger-workflow"
  | "orchestrate"
  | "call-ai"
  | "trust-ai-output"
  | "invent"
  | "fabricate-confidence"
  | "suppress-uncertainty"
  | "expose-secret"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 7 non-responsibilities. */
export const HEBY_GOVERNANCE_NON_RESPONSIBILITIES: readonly HebyGovernanceNonResponsibility[] = Object.freeze([
  "approve",
  "waive",
  "author-constraint",
  "reinterpret-constraint",
  "reject",
  "decide",
  "resolve-decision",
  "advance-past-director",
  "execute",
  "trigger-workflow",
  "orchestrate",
  "call-ai",
  "trust-ai-output",
  "invent",
  "fabricate-confidence",
  "suppress-uncertainty",
  "expose-secret",
  "modify-runtime",
  "modify-memory",
  "modify-reasoning",
  "modify-organization",
  "invoke-api",
  "bypass-director",
]);

/** A gate proposal entering the boundary. */
export interface HebyGovernanceInput {
  readonly request: HebyGovernanceGateRequest;
}

/** The result of gating a presentation: canonical gated presentation, or an explicit failure. */
export type HebyGovernanceResult =
  | { readonly ok: true; readonly value: CanonicalHebyGatedPresentation }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, gates, and freezes a presentation against Governance and Security constraints. Pure
 * and deterministic: the same input always produces the same result, and it calls no model. A
 * request or output validation failure yields explicit issues and no gated presentation. This is
 * the only entry Phase 7 exposes, and it neither approves, waives, authors, reinterprets a
 * constraint, decides, nor runs anything, and it mutates no upstream system: it holds the
 * constraints immutable and gates the rendered surface — stopping the whole surface on an
 * isolation mismatch, and otherwise blocking each protected, unresolved, or ineligible element
 * and each item resting on a blocked element — recording every block.
 */
export function gateHebyPresentation(input: HebyGovernanceInput): HebyGovernanceResult {
  const requestValidation = validateHebyGovernanceGateRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const { grounded, prepared } = input.request;

  const scope = hebyGovernanceScopeOf(grounded.context);
  const preparedScope = hebyGovernanceScopeOf(prepared.context);
  const inputIndex = hebyInputIndex(grounded.inputs);

  const blocks: HebyGovernanceBlock[] = [];
  const admittedElements: HebyPresentationElement[] = [];
  const admittedItems: HebyPreparedItem[] = [];

  const mismatch = hebyScopeMismatchReason(scope, preparedScope);
  if (mismatch !== null) {
    // Isolation failure stops the whole surface — nothing is admitted, and the block is recorded.
    blocks.push({
      subjectKind: "presentation",
      subjectId: grounded.presentationId,
      reason: mismatch,
      constraintKind: hebyGovernanceBlockReasonConstraintKind(mismatch),
    });
  } else {
    // Per-element governance: admit the clean, block and record the rest.
    const admittedElementIds = new Set<string>();
    for (const element of grounded.groundedElements) {
      const reason = hebyClassifyElementGovernance(element, inputIndex);
      if (reason === null) {
        admittedElements.push(element);
        admittedElementIds.add(element.elementId);
      } else {
        blocks.push({
          subjectKind: "element",
          subjectId: element.elementId,
          reason,
          constraintKind: hebyGovernanceBlockReasonConstraintKind(reason),
        });
      }
    }

    // A prepared item survives only if every element it rests on survived the gate.
    for (const item of prepared.items) {
      const restsOnBlocked = item.subjectRefs.some((ref) => !admittedElementIds.has(ref));
      if (restsOnBlocked) {
        blocks.push({
          subjectKind: "item",
          subjectId: item.itemId,
          reason: "blocked-subject",
          constraintKind: hebyGovernanceBlockReasonConstraintKind("blocked-subject"),
        });
      } else {
        admittedItems.push(item);
      }
    }
  }

  const gated: HebyGatedPresentation = {
    presentationId: grounded.presentationId,
    intentId: prepared.intentId,
    scope,
    context: grounded.context,
    constraints: grounded.context.constraints,
    admittedElements,
    admittedItems,
    blocks,
  };

  const gatedValidation = validateHebyGatedPresentation(gated, inputIndex);
  if (!gatedValidation.ok) return { ok: false, issues: gatedValidation.issues };

  const canonical = normalizeHebyGatedPresentation(gated);

  const frozenCheck = verifyHebyGatedPresentationFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
