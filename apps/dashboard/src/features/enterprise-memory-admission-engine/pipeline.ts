/**
 * Enterprise Memory Admission Engine — deterministic pipeline.
 *
 * The execution sequence is fixed and immutable. There is no plugin model, no
 * runtime registration, no dynamic dispatch, and no reflection. The stages run in
 * exactly the declared order, every time, for every input.
 */

import { assessEvaluation } from "@/features/enterprise-memory-admission-engine/evaluator";
import { evaluatePolicies } from "@/features/enterprise-memory-admission-engine/policies";
import { evaluateAuthority } from "@/features/enterprise-memory-admission-engine/authority";
import { buildResult, deriveDecision } from "@/features/enterprise-memory-admission-engine/results";
import type {
  AdmissionEngineInput,
  MemoryAdmissionResult,
} from "@/features/enterprise-memory-admission-engine/contracts";

/** The fixed, ordered stage names. Exposed for introspection only. */
export const PIPELINE_STAGES = Object.freeze([
  "evaluation-assessment",
  "policy-evaluation",
  "authority-evaluation",
  "decision",
  "result-assembly",
] as const);

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/**
 * Runs the admission pipeline in the fixed order. Pure: no shared state, no clock
 * read, no side effect. The same input always yields the same result.
 */
export function runAdmissionPipeline(input: AdmissionEngineInput): MemoryAdmissionResult {
  const policies = input.policySet.policies;

  // Stage 1 — evaluation assessment (consumes the supplied evaluation as-is).
  const assessment = assessEvaluation(input.evaluation, policies);

  // Stage 2 — policy evaluation (deterministic predicates, input order preserved).
  const policyChecks = evaluatePolicies(policies, input.candidate, input.evaluation, input.authority);

  // Stage 3 — authority evaluation (membership only; never elevated or inferred).
  const authorityCheck = evaluateAuthority(input.authority, policies);

  // Stage 4 — decision (single explicit precedence over the stage findings).
  const decision = deriveDecision({
    authorityCheck,
    assessment,
    policyChecks,
    authority: input.authority,
    policySetId: input.policySet.policySetId,
    decidedAt: input.evaluatedAt,
  });

  // Stage 5 — result assembly (immutable record of the whole run).
  return buildResult({
    candidate: input.candidate,
    evaluation: input.evaluation,
    authority: input.authority,
    appliedPolicies: policies,
    assessment,
    authorityCheck,
    policyChecks,
    decision,
    decidedAt: input.evaluatedAt,
  });
}
