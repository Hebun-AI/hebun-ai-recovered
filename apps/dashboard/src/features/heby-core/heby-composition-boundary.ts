/**
 * Heby Core — composition boundary (Phase 9, Integration and Composition Closure).
 *
 * The immutable boundary through which the per-phase caller inputs enter and a frozen, verified
 * end-to-end composition leaves, and the canonical declaration of what Phase 9 MAY do and MUST
 * NEVER do. It composes the published Phase 1–8 boundaries in the fixed order — admit context,
 * present, ground, interpret intent, prepare approval, gate governance, assemble briefing —
 * threading each stage's real output into the next, then verifies cross-phase consistency and
 * records the stage ledger as replay proof. It regenerates and reinterprets no earlier-phase
 * result; it consumes the published outputs exactly as produced.
 *
 * It introduces NO execution path, holds NO hidden state, gains NO autonomy, and never bypasses
 * the Director. It creates no authority beyond Phase 1–8: it never approves, rejects, decides,
 * resolves a decision, advances past the Director, executes, triggers a workflow, orchestrates,
 * invents, fabricates confidence, suppresses uncertainty, waives Governance, reinterprets
 * Security, calls a model, trusts model output, mutates any upstream system, invokes an API, or
 * bypasses the Director. Every permitted capability is composing, verifying, recording, or
 * preserving. Every prohibited capability is explicitly modelled so no post-Core work can quietly
 * acquire it here. The composition is idempotent, replayable, auditable, and fail-closed.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phases 1–8.
 */

import {
  type CanonicalHebyComposition,
  type HebyComposition,
  type HebyCompositionRequest,
} from "@/features/heby-core/heby-composition-types";
import { hebyBuildStageLedger } from "@/features/heby-core/heby-composition-rules";
import { normalizeHebyComposition } from "@/features/heby-core/heby-composition-normalization";
import {
  validateHebyComposition,
  validateHebyCompositionSeams,
} from "@/features/heby-core/heby-composition-validation";
import { verifyHebyCompositionFrozen } from "@/features/heby-core/heby-composition-validation";
import { admitHebyContext } from "@/features/heby-core/heby-input-context-boundary";
import { presentHebyMaterial } from "@/features/heby-core/heby-presentation-boundary";
import { groundHebyPresentation } from "@/features/heby-core/heby-grounding-boundary";
import { interpretHebyIntent } from "@/features/heby-core/heby-intent-boundary";
import { prepareHebyApproval } from "@/features/heby-core/heby-approval-boundary";
import { gateHebyPresentation } from "@/features/heby-core/heby-governance-boundary";
import { assembleHebyBriefing } from "@/features/heby-core/heby-briefing-boundary";

/** The things Phase 9 MAY do. Composing, verifying, recording, or preserving only. */
export type HebyCompositionCapability =
  | "compose-interface"
  | "replay-path"
  | "verify-cross-phase"
  | "record-stage-ledger"
  | "preserve-identity"
  | "preserve-context"
  | "preserve-grounding"
  | "preserve-governance"
  | "preserve-briefing"
  | "terminate-at-director"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 9 capabilities. */
export const HEBY_COMPOSITION_CAPABILITIES: readonly HebyCompositionCapability[] = Object.freeze([
  "compose-interface",
  "replay-path",
  "verify-cross-phase",
  "record-stage-ledger",
  "preserve-identity",
  "preserve-context",
  "preserve-grounding",
  "preserve-governance",
  "preserve-briefing",
  "terminate-at-director",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 9 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyCompositionNonResponsibility =
  | "approve"
  | "reject"
  | "decide"
  | "resolve-decision"
  | "advance-past-director"
  | "execute"
  | "introduce-execution-path"
  | "trigger-workflow"
  | "orchestrate"
  | "hold-hidden-state"
  | "gain-autonomy"
  | "regenerate-phase-output"
  | "reinterpret-phase-output"
  | "invent"
  | "fabricate-confidence"
  | "suppress-uncertainty"
  | "waive-governance"
  | "reinterpret-security"
  | "call-ai"
  | "trust-ai-output"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 9 non-responsibilities. */
export const HEBY_COMPOSITION_NON_RESPONSIBILITIES: readonly HebyCompositionNonResponsibility[] = Object.freeze([
  "approve",
  "reject",
  "decide",
  "resolve-decision",
  "advance-past-director",
  "execute",
  "introduce-execution-path",
  "trigger-workflow",
  "orchestrate",
  "hold-hidden-state",
  "gain-autonomy",
  "regenerate-phase-output",
  "reinterpret-phase-output",
  "invent",
  "fabricate-confidence",
  "suppress-uncertainty",
  "waive-governance",
  "reinterpret-security",
  "call-ai",
  "trust-ai-output",
  "modify-runtime",
  "modify-memory",
  "modify-reasoning",
  "modify-organization",
  "invoke-api",
  "bypass-director",
]);

/** A composition proposal entering the boundary. */
export interface HebyCompositionInput {
  readonly request: HebyCompositionRequest;
}

/** The result of composing the interface: canonical composition, or an explicit failure. */
export type HebyCompositionResult =
  | { readonly ok: true; readonly value: CanonicalHebyComposition }
  | { readonly ok: false; readonly issues: readonly string[] };

function prefix(phase: string, issues: readonly string[]): readonly string[] {
  return issues.map((issue) => `${phase}: ${issue}`);
}

/**
 * Composes, verifies, and freezes the full end-to-end Heby interface. Pure and deterministic:
 * the same input always produces the same composition, and it calls no model. A failure at any
 * composed boundary, any cross-phase inconsistency, or any output-validation failure yields
 * explicit issues and no composition — fail-closed under every named failure mode. This is the
 * only entry Phase 9 exposes, and it neither approves, decides, resolves, executes, invents, nor
 * runs anything of its own, and it mutates no upstream output: it threads the published boundaries
 * from the admitted context to the Director briefing, verifies every seam, records the stage
 * ledger, and terminates at the Director.
 */
export function composeHebyInterface(input: HebyCompositionInput): HebyCompositionResult {
  const req = input.request;

  const bindingResult = admitHebyContext({ request: req.admission });
  if (!bindingResult.ok) return { ok: false, issues: prefix("context", bindingResult.issues) };
  const binding = bindingResult.value;

  const presentationResult = presentHebyMaterial({
    request: { presentationId: req.presentationId, binding, elements: req.elements, explanation: req.explanation },
  });
  if (!presentationResult.ok) return { ok: false, issues: prefix("presentation", presentationResult.issues) };
  const presentation = presentationResult.value;

  const groundedResult = groundHebyPresentation({ request: { presentation } });
  if (!groundedResult.ok) return { ok: false, issues: prefix("grounding", groundedResult.issues) };
  const grounded = groundedResult.value;

  const routedResult = interpretHebyIntent({
    request: { identity: req.identity, grounded, utterance: req.utterance, proposed: req.proposed },
  });
  if (!routedResult.ok) return { ok: false, issues: prefix("intent", routedResult.issues) };
  const routed = routedResult.value;

  const preparedResult = prepareHebyApproval({
    request: { identity: req.identity, grounded, routed, items: req.items },
  });
  if (!preparedResult.ok) return { ok: false, issues: prefix("approval", preparedResult.issues) };
  const prepared = preparedResult.value;

  const gatedResult = gateHebyPresentation({ request: { identity: req.identity, grounded, prepared } });
  if (!gatedResult.ok) return { ok: false, issues: prefix("governance", gatedResult.issues) };
  const gated = gatedResult.value;

  const briefingResult = assembleHebyBriefing({
    request: { identity: req.identity, gated, findings: req.findings, history: req.history, questions: req.questions, decisions: req.decisions },
  });
  if (!briefingResult.ok) return { ok: false, issues: prefix("briefing", briefingResult.issues) };
  const briefing = briefingResult.value;

  const seams = validateHebyCompositionSeams(req.identity, binding, presentation, grounded, routed, prepared, gated, briefing);
  if (!seams.ok) return { ok: false, issues: prefix("cross-phase", seams.issues) };

  const composition: HebyComposition = {
    identity: req.identity,
    contextId: binding.context.contextId,
    presentationId: presentation.presentationId,
    intentId: routed.intentId,
    scope: gated.scope,
    stages: hebyBuildStageLedger(req.identity, binding, presentation, grounded, routed, prepared, gated, briefing),
    briefing,
  };

  const compositionValidation = validateHebyComposition(composition);
  if (!compositionValidation.ok) return { ok: false, issues: compositionValidation.issues };

  const canonical = normalizeHebyComposition(composition);

  const frozenCheck = verifyHebyCompositionFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
