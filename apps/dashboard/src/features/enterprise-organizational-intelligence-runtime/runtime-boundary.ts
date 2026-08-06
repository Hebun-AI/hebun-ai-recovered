/**
 * Enterprise Organizational Intelligence Runtime — boundary (Phase 1).
 *
 * The boundary through which a Runtime request enters and leaves the Runtime
 * foundation, and the canonical declaration of what the Runtime MAY do and what it
 * MUST NEVER do. It validates a proposed request, then canonicalizes it into an
 * immutable form. It performs NO runtime behaviour, NO orchestration, NO candidate
 * generation, NO analysis, and mutates NOTHING — it only accepts, checks, and
 * canonicalizes the request it is given.
 *
 * The two capability sets below are the enforceable spine of the Runtime's
 * constitutional boundary. Every permitted capability is read-only, preparatory, or
 * canonicalizing. Every prohibited capability is explicitly modelled so that no later
 * phase can quietly acquire it.
 */

import type {
  CanonicalRuntimeRequest,
  RuntimeRequest,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-types";
import { normalizeRuntimeRequest } from "@/features/enterprise-organizational-intelligence-runtime/runtime-normalization";
import { validateRuntimeRequest } from "@/features/enterprise-organizational-intelligence-runtime/runtime-validation";

/** The things the Runtime MAY do. Read-only, preparatory, or canonicalizing only. */
export type RuntimeCapability =
  | "consume-memory-context"
  | "consume-reasoning-understanding"
  | "consume-organization-assembly"
  | "produce-runtime-candidate"
  | "prepare-director-briefing"
  | "prepare-heby-explanation"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of Runtime capabilities. */
export const RUNTIME_CAPABILITIES: readonly RuntimeCapability[] = Object.freeze([
  "consume-memory-context",
  "consume-reasoning-understanding",
  "consume-organization-assembly",
  "produce-runtime-candidate",
  "prepare-director-briefing",
  "prepare-heby-explanation",
  "validate",
  "normalize",
  "freeze",
]);

/** The things the Runtime MUST NEVER do or become. Every prohibition is explicit. */
export type RuntimeNonResponsibility =
  | "decide"
  | "approve"
  | "execute"
  | "change-memory"
  | "change-reasoning"
  | "change-organization"
  | "plan-work"
  | "trigger-workflow"
  | "call-ai"
  | "call-llm"
  | "schedule-job"
  | "invoke-api"
  | "modify-persistence"
  | "control-ui"
  | "act-autonomously";

/** The canonical, frozen set of Runtime non-responsibilities. */
export const RUNTIME_NON_RESPONSIBILITIES: readonly RuntimeNonResponsibility[] = Object.freeze([
  "decide",
  "approve",
  "execute",
  "change-memory",
  "change-reasoning",
  "change-organization",
  "plan-work",
  "trigger-workflow",
  "call-ai",
  "call-llm",
  "schedule-job",
  "invoke-api",
  "modify-persistence",
  "control-ui",
  "act-autonomously",
]);

/** A proposed Runtime request entering the boundary. */
export interface RuntimeRequestInput {
  readonly request: RuntimeRequest;
}

/** The result of preparing a Runtime request: canonical, or an explicit failure. */
export type RuntimeRequestResult =
  | { readonly ok: true; readonly value: CanonicalRuntimeRequest }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Validates then canonicalizes a Runtime request. Pure and deterministic: the same
 * input always produces the same result. A validation failure yields explicit issues
 * and no canonical request. This is the only entry the Runtime foundation exposes at
 * Phase 1, and it neither runs nor decides anything.
 */
export function prepareRuntimeRequest(input: RuntimeRequestInput): RuntimeRequestResult {
  const validation = validateRuntimeRequest(input.request);
  if (!validation.ok) return { ok: false, issues: validation.issues };
  return { ok: true, value: normalizeRuntimeRequest(input.request) };
}
