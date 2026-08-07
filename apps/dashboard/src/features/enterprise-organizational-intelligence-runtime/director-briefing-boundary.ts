/**
 * Enterprise Organizational Intelligence Runtime — Director Briefing boundary (Phase 8).
 *
 * The immutable boundary through which a proposed briefing request enters and a frozen,
 * canonical Director Briefing leaves, and the canonical declaration of what the briefing pass
 * MAY do and what it MUST NEVER do. It validates a request, organizes every Phase 7 bound
 * artifact into one uniform briefing item, preserves each item's provenance, explainability,
 * confidence, uncertainty, lifecycle, and supporting references, describes the governance state
 * over them (exposing approval, lifecycle, restrictions, and the pending Director decisions),
 * canonicalizes and freezes the briefing, and stops at the Director Approval boundary —
 * producing the settled input the Director Workspace and the Heby Explanation Runtime consume.
 *
 * It ORGANIZES information only. It creates NO candidates, NO facts, performs NO reasoning,
 * calculates NO confidence, suppresses or hides NO uncertainty, and NEVER prioritizes, ranks,
 * recommends, approves, rejects, decides, executes, schedules, assigns work, triggers a
 * workflow, calls AI or an LLM, persists, invokes an API, modifies memory, reasoning,
 * organization, any candidate set, or any Runtime output, performs a governance decision, or
 * bypasses the Director. Governance here is descriptive only. Every permitted capability is
 * read-only, organizing, describing, or preserving. Every prohibited capability is explicitly
 * modelled so that no later phase can quietly acquire it here.
 */

import type { RuntimeApproval } from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import type {
  CanonicalDirectorBriefing,
  DirectorBriefing,
  DirectorBriefingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-types";
import {
  describeGovernance,
  projectBriefingItems,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-rules";
import { normalizeDirectorBriefing } from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-normalization";
import {
  validateDirectorBriefing,
  validateDirectorBriefingRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/director-briefing-validation";

/** The things the briefing pass MAY do. Read-only, organizing, describing, or preserving only. */
export type DirectorBriefingCapability =
  | "consume-runtime-bundle"
  | "consume-learning-candidate-set"
  | "consume-optimization-candidate-set"
  | "consume-awareness-candidate-set"
  | "consume-evolution-candidate-set"
  | "consume-binding-bundle"
  | "consume-governance-constraints"
  | "organize"
  | "validate"
  | "validate-governance-state"
  | "normalize"
  | "canonicalize"
  | "freeze"
  | "preserve-provenance"
  | "preserve-explainability"
  | "preserve-confidence"
  | "preserve-uncertainty"
  | "preserve-evidence-references"
  | "preserve-learning-references"
  | "preserve-optimization-references"
  | "preserve-awareness-references"
  | "preserve-evolution-references"
  | "preserve-source-candidate-identity"
  | "expose-approval-state"
  | "expose-lifecycle"
  | "expose-restrictions"
  | "expose-pending-director-decisions"
  | "prepare-for-director"
  | "prepare-for-heby-explanation";

/** The canonical, frozen set of briefing pass capabilities. */
export const DIRECTOR_BRIEFING_CAPABILITIES: readonly DirectorBriefingCapability[] = Object.freeze([
  "consume-runtime-bundle",
  "consume-learning-candidate-set",
  "consume-optimization-candidate-set",
  "consume-awareness-candidate-set",
  "consume-evolution-candidate-set",
  "consume-binding-bundle",
  "consume-governance-constraints",
  "organize",
  "validate",
  "validate-governance-state",
  "normalize",
  "canonicalize",
  "freeze",
  "preserve-provenance",
  "preserve-explainability",
  "preserve-confidence",
  "preserve-uncertainty",
  "preserve-evidence-references",
  "preserve-learning-references",
  "preserve-optimization-references",
  "preserve-awareness-references",
  "preserve-evolution-references",
  "preserve-source-candidate-identity",
  "expose-approval-state",
  "expose-lifecycle",
  "expose-restrictions",
  "expose-pending-director-decisions",
  "prepare-for-director",
  "prepare-for-heby-explanation",
]);

/** The things the briefing pass MUST NEVER do or become. Every prohibition is explicit. */
export type DirectorBriefingNonResponsibility =
  | "prioritize"
  | "rank"
  | "recommend"
  | "approve"
  | "reject"
  | "decide"
  | "execute"
  | "schedule"
  | "assign-work"
  | "trigger-workflows"
  | "hide-uncertainty"
  | "modify-runtime-outputs"
  | "generate-candidates"
  | "perform-reasoning"
  | "calculate-confidence"
  | "suppress-uncertainty"
  | "call-ai"
  | "call-llm"
  | "persist"
  | "invoke-api"
  | "modify-memory"
  | "modify-reasoning"
  | "modify-organization"
  | "modify-candidate-sets"
  | "perform-governance-decision"
  | "bypass-director";

/** The canonical, frozen set of briefing pass non-responsibilities. */
export const DIRECTOR_BRIEFING_NON_RESPONSIBILITIES: readonly DirectorBriefingNonResponsibility[] =
  Object.freeze([
    "prioritize",
    "rank",
    "recommend",
    "approve",
    "reject",
    "decide",
    "execute",
    "schedule",
    "assign-work",
    "trigger-workflows",
    "hide-uncertainty",
    "modify-runtime-outputs",
    "generate-candidates",
    "perform-reasoning",
    "calculate-confidence",
    "suppress-uncertainty",
    "call-ai",
    "call-llm",
    "persist",
    "invoke-api",
    "modify-memory",
    "modify-reasoning",
    "modify-organization",
    "modify-candidate-sets",
    "perform-governance-decision",
    "bypass-director",
  ]);

/** The approval marker every prepared briefing carries: always pending a Director decision. */
const PENDING_DIRECTOR_APPROVAL: RuntimeApproval = Object.freeze({ state: "pending-director" });

/** A proposed briefing pass entering the boundary. */
export interface DirectorBriefingInput {
  readonly request: DirectorBriefingRequest;
}

/** The result of preparing a briefing: canonical, or an explicit failure. */
export type DirectorBriefingResult =
  | { readonly ok: true; readonly value: CanonicalDirectorBriefing }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates, organizes, describes governance, preserves, canonicalizes, and freezes a Director
 * Briefing. Pure and deterministic: the same input always produces the same result, and
 * shuffled inputs produce identical canonical output. A validation failure yields explicit
 * issues and no briefing. This is the only entry the briefing pass exposes, and it neither
 * creates, reasons, calculates, prioritizes, ranks, recommends, decides, nor runs anything: it
 * organizes already-bound artifacts into one uniform, immutable briefing, preserves their
 * provenance, explanation, confidence, uncertainty, lifecycle, and references, exposes the
 * descriptive governance state, and stops at the Director Approval boundary.
 */
export function prepareDirectorBriefing(input: DirectorBriefingInput): DirectorBriefingResult {
  const requestValidation = validateDirectorBriefingRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const items = projectBriefingItems(input.request.bindingBundle);
  const briefing: DirectorBriefing = {
    requestId: input.request.requestId,
    items,
    governance: describeGovernance(input.request.governance, items),
    approval: PENDING_DIRECTOR_APPROVAL,
  };

  const canonical = normalizeDirectorBriefing(briefing);

  const briefingValidation = validateDirectorBriefing(canonical);
  if (!briefingValidation.ok) return { ok: false, issues: briefingValidation.issues };

  return { ok: true, value: canonical };
}
