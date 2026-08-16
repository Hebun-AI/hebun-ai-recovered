/*
 * heby-actions/action-preparer.ts — turns a typed PROPOSAL into a PREPARED action (Phase 17).
 *
 * This is the seam the Director's brief demands between language and execution: a request is a
 * TYPED proposal, and preparing it NEVER runs it. The preparer validates the arguments against
 * the tool's schema, runs the capability, governance, and authority gates, checks evidence
 * freshness and (optionally) expiration, derives a deterministic action identity and idempotency
 * key, and assembles the honest, secret-free package a human would review. It writes no memory,
 * records no decision, executes nothing, and fabricates nothing.
 *
 * "Prepared" is emphatically not "authorized" and not "executed": a mutation lands in
 * REQUIRES_HUMAN_REVIEW, a device action in RESTRICTED, a would-be-runnable action with no
 * substrate in UNAVAILABLE — and only a READ_ONLY action that clears every gate reaches
 * EXECUTION_ELIGIBLE (still not executed until the execution gate runs).
 */

import type {
  HebyEvidenceReference,
  HebyProvenanceFacet,
  HebyUncertaintyState,
} from "@/features/heby-integration";
import type {
  HebyActionLifecycleState,
  HebyActionRequest,
  HebyActionTool,
  HebyArguments,
  HebyCapabilityGateResult,
  HebyEvidenceFreshness,
  HebyPreparedAction,
  HebyStalenessResult,
} from "./contracts";
import { getActionToolByKind } from "./action-registry";
import { validateArguments } from "./arguments";
import { evaluateCapability } from "./capability-gate";
import { evaluateGovernance } from "./governance-gate";
import { evaluateAuthority } from "./authority-gate";

/** Default lifetime, in caller-supplied logical ticks, before a preparation must be revalidated. */
export const DEFAULT_PREPARATION_TTL_TICKS = 100;

/** A stable, non-cryptographic hash (FNV-1a) — deterministic identity, no import, no fabrication. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function evidenceKey(evidence: readonly HebyEvidenceReference[]): string {
  return evidence.map((e) => `${e.sourceClass}:${e.recordRef}:${e.lifecycle}`).sort().join(",");
}

function argumentKey(args: HebyArguments): string {
  return Object.entries(args)
    .map(([k, v]) => `${k}=${String(v)}`)
    .sort()
    .join(",");
}

/** Derive a deterministic action identity from the action's semantic content. */
function deriveActionId(request: HebyActionRequest, tool: HebyActionTool | undefined, args: HebyArguments): string {
  const key = [
    request.actionKind,
    tool?.toolId ?? "unknown",
    request.requestingWorkspace,
    request.target ? `${request.target.kind}:${request.target.ref}` : "no-target",
    argumentKey(args),
    evidenceKey(request.evidence ?? []),
  ].join("|");
  return `act_${fnv1a(key)}`;
}

/** Evidence freshness for a class: heavier class → real, non-superseded grounding required. */
function evaluateStaleness(
  tool: HebyActionTool,
  evidence: readonly HebyEvidenceReference[],
  proposedAtTick: number | undefined,
  nowTick: number | undefined,
  ttlTicks: number,
): HebyStalenessResult {
  const reasons: string[] = [];

  let freshness: HebyEvidenceFreshness;
  if (tool.sideEffect === "READ_ONLY" || tool.sideEffect === "PREPARATION_ONLY") {
    freshness = "not-required";
  } else if (evidence.length === 0) {
    freshness = "unknown";
    reasons.push("No evidence supplied to assess freshness.");
  } else if (evidence.some((e) => e.lifecycle === "superseded" || e.lifecycle === "retired")) {
    freshness = "stale";
    reasons.push("Evidence has been superseded or retired since the action was proposed.");
  } else if (evidence.every((e) => e.lifecycle === "settled")) {
    freshness = "fresh";
  } else {
    freshness = "unknown";
    reasons.push("Evidence lifecycle is unknown.");
  }

  // Expiration is only enforced when BOTH a proposal tick and a current tick are supplied. Absent a
  // real clock we do NOT pretend expiry — it is a documented boundary, not a fabricated timeout.
  let expired = false;
  if (typeof proposedAtTick === "number" && typeof nowTick === "number") {
    if (nowTick - proposedAtTick > ttlTicks) {
      expired = true;
      reasons.push(`Preparation expired: ${nowTick - proposedAtTick} ticks elapsed (ttl ${ttlTicks}).`);
    }
  }

  return { freshness, expired, reasons };
}

function deriveLifecycle(
  tool: HebyActionTool,
  argumentsValid: boolean,
  cap: HebyCapabilityGateResult,
  govSatisfied: boolean,
  govRequired: boolean,
  humanReviewRequired: boolean,
  staleness: HebyStalenessResult,
): HebyActionLifecycleState {
  if (!argumentsValid) return "FAILED";
  if (!cap.workspacePermitted) return "RESTRICTED"; // confused-deputy: not owned in this context
  if (!cap.targetValid) return "FAILED";
  /*
   * R3W MOVED THIS ABOVE THE HUMAN-REVIEW BRANCH, and the move is the point.
   *
   * It used to sit below, so a consequential mutation whose record-refs named nothing still
   * reached REQUIRES_HUMAN_REVIEW — and `recordActionRequest` accepts exactly that state, so a
   * proposal about a fiction could be persisted and put in front of the Director. Asking a human
   * to decide about records that do not exist is worse than refusing outright: the decision is
   * real, durable, and about nothing.
   *
   * An action that cannot say what it would act upon FAILS. It does not get a human's attention.
   */
  if (!cap.evidenceSufficient) return "FAILED";
  if (tool.sideEffect === "DEVICE_ACTION") return "RESTRICTED";
  if (staleness.expired || staleness.freshness === "stale") return "EXPIRED";
  if (humanReviewRequired) return "REQUIRES_HUMAN_REVIEW";
  if (govRequired && !govSatisfied) return "REQUIRES_GOVERNANCE";
  if (!cap.available) return "UNAVAILABLE";
  if (tool.sideEffect === "READ_ONLY") return "EXECUTION_ELIGIBLE";
  if (tool.sideEffect === "PREPARATION_ONLY") return "PREPARED"; // prepared; nothing to execute
  return "REQUIRES_HUMAN_REVIEW"; // any residual mutation
}

function describeEffect(tool: HebyActionTool): string {
  return tool.outputSummary;
}

function describeConsequences(tool: HebyActionTool): readonly string[] {
  const consequences: string[] = [];
  switch (tool.sideEffect) {
    case "READ_ONLY":
      consequences.push("No state changes — read-only inspection.");
      break;
    case "PREPARATION_ONLY":
      consequences.push("Produces a prepared package for a human. Nothing is executed.");
      break;
    case "REVERSIBLE_MUTATION":
      consequences.push("Would change state; a deterministic inverse is defined.");
      consequences.push("No execution substrate is connected, and human review is required.");
      break;
    case "CONSEQUENTIAL_MUTATION":
      consequences.push("Would change state irreversibly.");
      consequences.push("Always requires human review; Heby never authorizes or executes it.");
      break;
    case "DEVICE_ACTION":
      consequences.push("Device runtime is Platform-owned, Director-authorized, and not implemented.");
      break;
  }
  return consequences;
}

function deriveUncertainty(lifecycle: HebyActionLifecycleState): HebyUncertaintyState {
  switch (lifecycle) {
    case "EXECUTION_ELIGIBLE":
    case "EXECUTED":
    case "PREPARED":
      return "supported";
    case "REQUIRES_HUMAN_REVIEW":
    case "REQUIRES_GOVERNANCE":
      return "incomplete";
    default:
      return "unavailable";
  }
}

export interface PrepareActionOptions {
  /** Optional current logical tick, for expiration checks. Never a fabricated wall clock. */
  readonly nowTick?: number;
  readonly ttlTicks?: number;
}

/**
 * Prepare a typed action request into a HebyPreparedAction. Pure and deterministic. Runs the
 * gates but NEVER invokes a tool — preparation and execution are separate stages.
 */
export function prepareAction(
  request: HebyActionRequest,
  options: PrepareActionOptions = {},
): HebyPreparedAction {
  const tool = getActionToolByKind(request.actionKind);
  const evidence = request.evidence ?? [];
  const ttlTicks = options.ttlTicks ?? DEFAULT_PREPARATION_TTL_TICKS;

  const argValidation = validateArguments(tool?.argumentSchema ?? { fields: [] }, request.proposedArguments);
  const args = argValidation.arguments;

  const capability = evaluateCapability({
    tool,
    requestingWorkspace: request.requestingWorkspace,
    target: request.target,
    evidence,
    /*
     * R3W: the gate now also checks that every supplied `record-ref` ARGUMENT names something the
     * retrieval layer actually returned. The validated set is passed rather than the raw proposal,
     * so an unvalidated or coerced value can never be the thing that gets resolved.
     */
    arguments: args,
  });
  const governance = evaluateGovernance(tool);
  const authority = evaluateAuthority(tool);

  const actionId = deriveActionId(request, tool, args);
  const idempotencyKey = `idem_${actionId.slice(4)}`;

  // Unknown tool: fail closed with a minimal honest package.
  if (!tool) {
    const provenance = ["heby-actions registry — no tool matches this action kind."];
    const provenanceCovered: HebyProvenanceFacet[] = ["what-was-found", "what-remains-uncertain"];
    return {
      actionId,
      actionKind: request.actionKind,
      toolId: "unknown",
      capability: "unknown",
      sideEffect: "READ_ONLY",
      reversibility: "none",
      ownerWorkspace: request.requestingWorkspace,
      requestingWorkspace: request.requestingWorkspace,
      target: request.target,
      arguments: {},
      argumentsValid: false,
      evidence,
      provenance,
      provenanceCovered,
      uncertainty: "unavailable",
      expectedEffect: "Unknown action — nothing can be prepared.",
      consequences: ["No matching tool; nothing is prepared or executed."],
      capabilityGate: capability,
      governanceGate: governance,
      authorityGate: authority,
      staleness: { freshness: "unknown", expired: false, reasons: ["No tool to assess."] },
      lifecycleState: "FAILED",
      idempotencyKey,
      limitations: ["Unknown action tool."],
    };
  }

  const staleness = evaluateStaleness(tool, evidence, request.proposedAtTick, options.nowTick, ttlTicks);
  const govRequired = governance.required;
  const govSatisfied = governance.status === "satisfied" || governance.status === "not-required";

  const lifecycleState = deriveLifecycle(
    tool,
    argValidation.valid,
    capability,
    govSatisfied,
    govRequired,
    authority.humanReviewRequired,
    staleness,
  );

  const limitations: string[] = [];
  if (!argValidation.valid) limitations.push(...argValidation.issues);
  if (capability.reasons.length > 0) limitations.push(...capability.reasons);
  if (governance.required && governance.status !== "satisfied") limitations.push(...governance.reasons);
  if (authority.humanReviewRequired) limitations.push(...authority.reasons);
  if (staleness.reasons.length > 0) limitations.push(...staleness.reasons);

  const provenance = [
    `heby-actions registry — tool ${tool.toolId} (${tool.sideEffect}).`,
    "Gates: capability, governance, authority — evaluated deterministically.",
  ];
  const provenanceCovered: HebyProvenanceFacet[] = [
    "what-was-found",
    "where-it-came-from",
    "how-authoritative",
    "what-remains-uncertain",
  ];

  return {
    actionId,
    actionKind: request.actionKind,
    toolId: tool.toolId,
    capability: tool.capability,
    sideEffect: tool.sideEffect,
    reversibility: tool.reversibility,
    ownerWorkspace: tool.ownerWorkspace,
    requestingWorkspace: request.requestingWorkspace,
    target: request.target,
    arguments: args,
    argumentsValid: argValidation.valid,
    evidence,
    provenance,
    provenanceCovered,
    uncertainty: deriveUncertainty(lifecycleState),
    expectedEffect: describeEffect(tool),
    consequences: describeConsequences(tool),
    capabilityGate: capability,
    governanceGate: governance,
    authorityGate: authority,
    staleness,
    lifecycleState,
    idempotencyKey,
    limitations,
  };
}
