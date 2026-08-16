/*
 * heby-actions/capability-gate.ts — the capability + ownership + target + evidence gate (Phase 17).
 *
 * Before a proposed action can even be prepared into an eligible one, this gate answers, HONESTLY
 * and without inference:
 *   - does the tool exist (is it a declared action tool)?
 *   - is its capability substrate actually connected (or only a contract)?
 *   - does the REQUESTING workspace OWN this capability? (confused-deputy defense: a workspace may
 *     never wield a capability it does not own — Governance may explain policy, not mutate it;
 *     Workforce may prepare assignments, not grant authority.)
 *   - does the target resolve to something real (a known workspace, a structural route, or an
 *     evidence-backed record)? Heby never acts on an invented target.
 *   - is the evidence sufficient for this side-effect class? Heavier classes require real evidence.
 *
 * No "probably supported", no inferred capability. A missing substrate is reported as
 * `not-connected` (the truthful state), never as a pass.
 */

import { isHebyWorkspaceId } from "@/features/heby-integration";
import type { HebyEvidenceReference } from "@/features/heby-integration";
import type {
  HebyActionTarget,
  HebyActionTool,
  HebyArguments,
  HebyCapabilityGateResult,
  HebyRequirementStatus,
  ToolSideEffectClass,
} from "./contracts";
import type { HebyWorkspaceId } from "@/features/heby-integration";

/** Minimum evidence references required for a side-effect class. Heavier class → real grounding. */
function requiredEvidenceCount(sideEffect: ToolSideEffectClass): number {
  switch (sideEffect) {
    case "REVERSIBLE_MUTATION":
    case "CONSEQUENTIAL_MUTATION":
      return 1;
    case "READ_ONLY":
    case "PREPARATION_ONLY":
    case "DEVICE_ACTION":
    default:
      return 0;
  }
}

/** Whether a target is structurally real. Records must be backed by the supplied evidence. */
function isTargetValid(
  target: HebyActionTarget | undefined,
  evidence: readonly HebyEvidenceReference[],
): { valid: boolean; reason?: string } {
  if (!target) return { valid: true }; // Not every action needs a target (e.g. inspect).
  switch (target.kind) {
    case "workspace":
      return isHebyWorkspaceId(target.ref)
        ? { valid: true }
        : { valid: false, reason: `Target workspace "${target.ref}" is not a known workspace.` };
    case "route":
      return target.ref.startsWith("/") && target.ref.length > 1
        ? { valid: true }
        : { valid: false, reason: `Target route "${target.ref}" is not a structural in-app route.` };
    case "record": {
      // A record target must resolve to a retrieved evidence reference — never invented from prose.
      const backed = evidence.some((e) => e.recordRef === target.ref);
      return backed
        ? { valid: true }
        : { valid: false, reason: `Target record "${target.ref}" is not backed by retrieved evidence.` };
    }
    case "system":
      return target.ref.trim().length > 0
        ? { valid: true }
        : { valid: false, reason: "Target system reference is empty." };
    default: {
      const unreachable: never = target.kind;
      return { valid: false, reason: `Unknown target kind (${String(unreachable)}).` };
    }
  }
}

/**
 * R3W — EVERY `record-ref` ARGUMENT MUST NAME SOMETHING THAT WAS ACTUALLY RETRIEVED.
 *
 * The target check above has always demanded that a `record` target be backed by evidence. The
 * ARGUMENTS did not: `arguments.ts` validates a `record-ref` as a non-empty string and says so in
 * its own header ("whether a `record-ref` resolves to retrieved evidence is a capability/target
 * concern checked in capability-gate") — but capability-gate never checked it. So
 * `{ recipientRef: "r-1", draftRef: "d-1" }` sailed through with neither value naming anything
 * that exists, and a human could be asked to approve an action about a fiction.
 *
 * The rule is GENERIC, keyed off the declared argument KIND rather than off any field name, so it
 * covers `draftRef`, `recipientRef`, `workflowRef`, `subjectRef`, `policyRef` and every record-ref
 * a future tool declares, with no per-tool special case and no allow-list to forget to update.
 *
 * It applies to every side-effect class, exactly as the target rule does. An optional record-ref
 * that is simply absent is fine; one that is SUPPLIED must resolve.
 */
function unbackedRecordRefArguments(
  tool: HebyActionTool,
  args: HebyArguments,
  evidence: readonly HebyEvidenceReference[],
): readonly string[] {
  const unbacked: string[] = [];
  for (const field of tool.argumentSchema.fields) {
    if (field.kind !== "record-ref") continue;
    const value = args[field.name];
    if (value === undefined) continue; // absent optional argument — nothing to resolve
    const backed = typeof value === "string" && evidence.some((e) => e.recordRef === value);
    if (!backed) unbacked.push(field.name);
  }
  return unbacked;
}

export function evaluateCapability(input: {
  tool: HebyActionTool | undefined;
  requestingWorkspace: HebyWorkspaceId;
  target?: HebyActionTarget;
  evidence: readonly HebyEvidenceReference[];
  /**
   * The already schema-validated arguments. Empty when validation failed, which is safe: a failed
   * validation already fails the action, and an empty set has no record-ref to leave unchecked.
   */
  arguments?: HebyArguments;
}): HebyCapabilityGateResult {
  const { tool, requestingWorkspace, target, evidence } = input;
  const args = input.arguments ?? {};
  const reasons: string[] = [];

  if (!tool) {
    return {
      status: "unmet",
      toolExists: false,
      available: false,
      workspacePermitted: false,
      targetValid: false,
      evidenceSufficient: false,
      reasons: ["Unknown action tool. Nothing is prepared."],
    };
  }

  const available = tool.substrateConnected;
  if (!available) {
    reasons.push(
      tool.sideEffect === "DEVICE_ACTION"
        ? "Device runtime is Platform-owned and not connected."
        : "No execution substrate is connected for this capability.",
    );
  }

  const workspacePermitted = requestingWorkspace === tool.ownerWorkspace;
  if (!workspacePermitted) {
    reasons.push(
      `Workspace "${requestingWorkspace}" does not own capability "${tool.capability}" (owner: "${tool.ownerWorkspace}").`,
    );
  }

  const targetCheck = isTargetValid(target, evidence);
  if (!targetCheck.valid && targetCheck.reason) reasons.push(targetCheck.reason);

  const need = requiredEvidenceCount(tool.sideEffect);
  const countSufficient = evidence.length >= need;
  if (!countSufficient) {
    reasons.push(`This action requires at least ${need} evidence reference(s); ${evidence.length} supplied.`);
  }

  const unbacked = unbackedRecordRefArguments(tool, args, evidence);
  for (const name of unbacked) {
    reasons.push(`Argument "${name}" does not name a record that was retrieved as evidence.`);
  }

  /*
   * Both halves, and both are about the same question: does this action refer to anything real?
   * A count of one unrelated reference is not grounding for an argument that names a record
   * nobody read.
   */
  const evidenceSufficient = countSufficient && unbacked.length === 0;

  let status: HebyRequirementStatus;
  if (!workspacePermitted || !targetCheck.valid || !evidenceSufficient) {
    status = "unmet";
  } else if (!available) {
    status = "not-connected";
  } else {
    status = "satisfied";
  }

  return {
    status,
    toolExists: true,
    available,
    workspacePermitted,
    targetValid: targetCheck.valid,
    evidenceSufficient,
    reasons,
  };
}
