/**
 * Enterprise Organizational Intelligence Runtime — assembly boundary (Phase 2).
 *
 * The immutable boundary through which a Runtime assembly request enters and a frozen
 * Runtime bundle leaves, and the canonical declaration of what the assembly MAY do and
 * what it MUST NEVER do. It validates a proposed request, resolves the three
 * foundations read-only, composes the assembly, and canonicalizes it into one
 * immutable bundle. It performs NO reasoning, NO learning, NO optimization, NO
 * awareness, NO evolution, NO orchestration, NO AI, NO LLM, NO execution, NO workflow,
 * NO planning, NO persistence, NO API, and NO UI — it only accepts, resolves, checks,
 * and freezes.
 *
 * The two capability sets below are the enforceable spine of the assembly's boundary.
 * Every permitted capability is read-only, resolving, or canonicalizing. Every
 * prohibited capability is explicitly modelled so that no later phase can quietly
 * acquire it here.
 */

import type {
  CanonicalRuntimeBundle,
  RuntimeAssembly,
  RuntimeAssemblyRequest,
  RuntimeAssemblySession,
  RuntimeBundle,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-types";
import { resolveRuntimeFoundationSources } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-rules";
import { normalizeRuntimeBundle } from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-normalization";
import {
  validateRuntimeAssemblyRequest,
  validateRuntimeBundle,
} from "@/features/enterprise-organizational-intelligence-runtime/runtime-assembly-validation";
import type { RuntimeId } from "@/features/enterprise-organizational-intelligence-runtime/runtime-contracts";

/** The things the assembly MAY do. Read-only, resolving, or canonicalizing only. */
export type RuntimeAssemblyCapability =
  | "consume-enterprise-memory"
  | "consume-enterprise-memory-reasoning"
  | "consume-enterprise-organizational-intelligence"
  | "resolve-dependency"
  | "assemble-bundle"
  | "validate"
  | "normalize"
  | "freeze";

/** The canonical, frozen set of assembly capabilities. */
export const RUNTIME_ASSEMBLY_CAPABILITIES: readonly RuntimeAssemblyCapability[] = Object.freeze([
  "consume-enterprise-memory",
  "consume-enterprise-memory-reasoning",
  "consume-enterprise-organizational-intelligence",
  "resolve-dependency",
  "assemble-bundle",
  "validate",
  "normalize",
  "freeze",
]);

/** The things the assembly MUST NEVER do or become. Every prohibition is explicit. */
export type RuntimeAssemblyNonResponsibility =
  | "reason"
  | "learn"
  | "optimize"
  | "assess-awareness"
  | "evolve"
  | "orchestrate"
  | "decide"
  | "approve"
  | "execute"
  | "plan-work"
  | "trigger-workflow"
  | "call-ai"
  | "call-llm"
  | "schedule-job"
  | "invoke-api"
  | "modify-persistence"
  | "control-ui"
  | "change-foundation"
  | "act-autonomously";

/** The canonical, frozen set of assembly non-responsibilities. */
export const RUNTIME_ASSEMBLY_NON_RESPONSIBILITIES: readonly RuntimeAssemblyNonResponsibility[] = Object.freeze([
  "reason",
  "learn",
  "optimize",
  "assess-awareness",
  "evolve",
  "orchestrate",
  "decide",
  "approve",
  "execute",
  "plan-work",
  "trigger-workflow",
  "call-ai",
  "call-llm",
  "schedule-job",
  "invoke-api",
  "modify-persistence",
  "control-ui",
  "change-foundation",
  "act-autonomously",
]);

/** A proposed Runtime assembly entering the boundary: a request and the bundle identity to mint. */
export interface RuntimeAssemblyInput {
  readonly request: RuntimeAssemblyRequest;
  readonly bundleId: RuntimeId;
}

/** The result of assembling a bundle: canonical, or an explicit failure. */
export type RuntimeAssemblyResult =
  | { readonly ok: true; readonly value: CanonicalRuntimeBundle }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Opens the positional session record for a declared assembly request. Pure and
 * deterministic: no identity is generated — the caller supplies it — and no state is
 * held. A freshly opened session is pending and merely declared.
 */
export function openRuntimeAssemblySession(
  sessionId: RuntimeId,
  request: RuntimeAssemblyRequest,
): RuntimeAssemblySession {
  return Object.freeze({
    sessionId,
    requestId: request.requestId,
    status: "pending",
    lifecycle: "declared",
  });
}

/**
 * Validates, resolves, assembles, and freezes a Runtime bundle. Pure and
 * deterministic: the same input always produces the same result. A validation failure
 * yields explicit issues and no bundle. This is the only entry the assembly exposes,
 * and it neither reasons, decides, nor runs anything: it resolves the three settled
 * foundations read-only, composes them into one immutable Runtime Context, and stops.
 */
export function assembleRuntimeBundle(input: RuntimeAssemblyInput): RuntimeAssemblyResult {
  const requestValidation = validateRuntimeAssemblyRequest(input.request);
  if (!requestValidation.ok) return { ok: false, issues: requestValidation.issues };

  const { context } = input.request;
  const assembly: RuntimeAssembly = {
    organizationId: context.organizationId,
    tenantId: context.tenantId,
    scope: context.scope,
    sources: resolveRuntimeFoundationSources(context),
  };
  const bundle: RuntimeBundle = {
    bundleId: input.bundleId,
    context,
    assembly,
    lifecycle: "bound",
  };

  const bundleValidation = validateRuntimeBundle(bundle);
  if (!bundleValidation.ok) return { ok: false, issues: bundleValidation.issues };

  return { ok: true, value: normalizeRuntimeBundle(bundle) };
}
