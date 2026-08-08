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

export function evaluateCapability(input: {
  tool: HebyActionTool | undefined;
  requestingWorkspace: HebyWorkspaceId;
  target?: HebyActionTarget;
  evidence: readonly HebyEvidenceReference[];
}): HebyCapabilityGateResult {
  const { tool, requestingWorkspace, target, evidence } = input;
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
  const evidenceSufficient = evidence.length >= need;
  if (!evidenceSufficient) {
    reasons.push(`This action requires at least ${need} evidence reference(s); ${evidence.length} supplied.`);
  }

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
