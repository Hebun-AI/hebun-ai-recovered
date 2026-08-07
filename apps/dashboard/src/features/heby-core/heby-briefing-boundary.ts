/**
 * Heby Core — briefing boundary (Phase 8, Director Briefing and Interaction Surface).
 *
 * The immutable boundary through which a Phase 7 gated presentation and the Runtime-sourced
 * briefing material enter and a frozen, Director-terminated advisory briefing leaves, and the
 * canonical declaration of what Phase 8 MAY do and MUST NEVER do. It assembles the briefing
 * deterministically: it carries the admitted elements and items UNCHANGED, presents the advisory
 * findings (never an approval), carries prior history as immutable evidence, carries human
 * questions and recorded decisions across the human boundary WITHOUT resolving them, builds the
 * full audit trail over every carried subject, and terminates at the Director Approval boundary.
 *
 * It DECIDES nothing, APPROVES nothing, REJECTS nothing, RESOLVES no human decision, and never
 * advances past the Director. It invents no fact, evidence, or causality, fabricates no
 * confidence or history, suppresses no uncertainty, designs no UI, and never executes, triggers a
 * workflow, orchestrates, calls a model, trusts model output, mutates any upstream system, waives
 * Governance, reinterprets Security, invokes an API, or bypasses the Director. Every permitted
 * capability is assembling, presenting, carrying, or preserving. Every prohibited capability is
 * explicitly modelled so no later phase can quietly acquire it here.
 *
 * Authority: docs/product-vision/heby-vision.md, heby-architecture.md, heby-roadmap.md.
 * Builds on Heby Core Phase 1 (Identity), Phase 2 (Context), Phase 3 (Presentation), Phase 6
 * (Approval Preparation), and Phase 7 (Governance and Security Constraint Enforcement).
 */

import {
  type CanonicalHebyDirectorBriefing,
  type HebyBriefingRequest,
  type HebyDirectorBriefing,
} from "@/features/heby-core/heby-briefing-types";
import { hebyAssembleAudit } from "@/features/heby-core/heby-briefing-rules";
import { normalizeHebyDirectorBriefing } from "@/features/heby-core/heby-briefing-normalization";
import {
  validateHebyBriefingRequest,
  validateHebyDirectorBriefing,
  verifyHebyDirectorBriefingFrozen,
} from "@/features/heby-core/heby-briefing-validation";

/** The things Phase 8 MAY do. Assembling, presenting, carrying, or preserving only. */
export type HebyBriefingCapability =
  | "assemble-briefing"
  | "present-finding"
  | "carry-history"
  | "carry-question"
  | "carry-decision"
  | "build-audit"
  | "terminate-at-director"
  | "preserve-identity"
  | "preserve-context"
  | "preserve-grounding"
  | "preserve-governance"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Phase 8 capabilities. */
export const HEBY_BRIEFING_CAPABILITIES: readonly HebyBriefingCapability[] = Object.freeze([
  "assemble-briefing",
  "present-finding",
  "carry-history",
  "carry-question",
  "carry-decision",
  "build-audit",
  "terminate-at-director",
  "preserve-identity",
  "preserve-context",
  "preserve-grounding",
  "preserve-governance",
  "validate",
  "normalize",
  "freeze",
]);

/** The things Phase 8 MUST NEVER do or become. Every prohibition is explicit. */
export type HebyBriefingNonResponsibility =
  | "decide"
  | "approve"
  | "reject"
  | "resolve-decision"
  | "advance-past-director"
  | "execute"
  | "trigger-workflow"
  | "orchestrate"
  | "author-ui"
  | "invent"
  | "invent-causality"
  | "fabricate-confidence"
  | "fabricate-history"
  | "suppress-uncertainty"
  | "call-ai"
  | "trust-ai-output"
  | "modify-runtime"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "waive-governance"
  | "reinterpret-security"
  | "invoke-api"
  | "bypass-director";

/** The canonical, frozen set of Phase 8 non-responsibilities. */
export const HEBY_BRIEFING_NON_RESPONSIBILITIES: readonly HebyBriefingNonResponsibility[] = Object.freeze([
  "decide",
  "approve",
  "reject",
  "resolve-decision",
  "advance-past-director",
  "execute",
  "trigger-workflow",
  "orchestrate",
  "author-ui",
  "invent",
  "invent-causality",
  "fabricate-confidence",
  "fabricate-history",
  "suppress-uncertainty",
  "call-ai",
  "trust-ai-output",
  "modify-runtime",
  "modify-memory",
  "modify-reasoning",
  "modify-organization",
  "waive-governance",
  "reinterpret-security",
  "invoke-api",
  "bypass-director",
]);

/** A briefing proposal entering the boundary. */
export interface HebyBriefingInput {
  readonly request: HebyBriefingRequest;
}

/** The result of assembling a briefing: canonical Director briefing, or an explicit failure. */
export type HebyBriefingResult =
  | { readonly ok: true; readonly value: CanonicalHebyDirectorBriefing }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, assembles, and freezes a Director briefing. Pure and deterministic: the same input
 * always produces the same result, and it calls no model. A request or output validation failure
 * yields explicit issues and no briefing. This is the only entry Phase 8 exposes, and it neither
 * decides, approves, rejects, resolves a decision, invents, fabricates, nor runs anything, and it
 * mutates no upstream system: it carries the admitted elements and items unchanged, presents the
 * advisory findings, carries history, questions, and recorded decisions across the human boundary
 * without resolving them, builds the full audit trail, and terminates at the Director.
 */
export function assembleHebyBriefing(input: HebyBriefingInput): HebyBriefingResult {
  const requestValidation = validateHebyBriefingRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const { gated, findings, history, questions, decisions } = input.request;

  const audit = hebyAssembleAudit(gated.admittedElements, gated.admittedItems, findings, history, questions, decisions);

  const briefing: HebyDirectorBriefing = {
    presentationId: gated.presentationId,
    intentId: gated.intentId,
    scope: gated.scope,
    context: gated.context,
    constraints: gated.constraints,
    elements: gated.admittedElements,
    items: gated.admittedItems,
    findings,
    history,
    questions,
    decisions,
    audit,
    termination: { authorityBasis: gated.context.authorityBasis, terminatesAtDirector: true },
  };

  const briefingValidation = validateHebyDirectorBriefing(briefing);
  if (!briefingValidation.ok) return { ok: false, issues: briefingValidation.issues };

  const canonical = normalizeHebyDirectorBriefing(briefing);

  const frozenCheck = verifyHebyDirectorBriefingFrozen(canonical);
  if (!frozenCheck.ok) return { ok: false, issues: frozenCheck.issues };

  return { ok: true, value: canonical };
}
