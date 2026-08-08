/*
 * heby-actions/boundary.ts — the honest, arg-free ACTION BOUNDARY view for the Heby panel (Phase 17).
 *
 * A transparency surface: for a given workspace it lists the actions Heby OWNS there, and states —
 * truthfully, with no arguments, no execution, and no fabrication — what each would do, its
 * side-effect class, its reversibility, the authority it requires, and the plain verdict on
 * whether it could run now. It never renders a fake "approved", "authorized", or "executed"
 * state, and it never runs anything. It is derived entirely from the declared action registry.
 */

import type { HebyAuthorityMode, HebyWorkspaceId } from "@/features/heby-integration";
import type {
  HebyActionKind,
  HebyReversibility,
  ToolSideEffectClass,
} from "./contracts";
import { listActionTools } from "./action-registry";

export interface HebyActionBoundaryRow {
  readonly actionKind: HebyActionKind;
  readonly label: string;
  readonly sideEffect: ToolSideEffectClass;
  readonly reversibility: HebyReversibility;
  readonly authorityRequirement: HebyAuthorityMode;
  /** A plain, honest one-line verdict on whether/how this could run. */
  readonly verdict: string;
  /** Whether the action is truly runnable now (READ_ONLY with a connected substrate). */
  readonly invokable: boolean;
  readonly expectedEffect: string;
}

const ACTION_LABELS: Record<HebyActionKind, string> = {
  "inspect-system-state": "Inspect system state",
  "resolve-navigation": "Resolve navigation",
  "prepare-operational-plan": "Prepare operational plan",
  "restart-workflow": "Restart workflow",
  "send-external-communication": "Send external communication",
  "grant-permission": "Grant permission",
  "modify-governance-policy": "Modify governance policy",
  "device-action": "Device action",
};

function verdictFor(sideEffect: ToolSideEffectClass, substrateConnected: boolean): string {
  switch (sideEffect) {
    case "READ_ONLY":
      return substrateConnected ? "Invokable — read-only, no side effect." : "Read-only, but no substrate is connected.";
    case "PREPARATION_ONLY":
      return "Preparable — produces a package for a human; nothing executes.";
    case "REVERSIBLE_MUTATION":
      return "Requires human review — reversible, but no execution substrate is connected.";
    case "CONSEQUENTIAL_MUTATION":
      return "Requires human review — consequential and irreversible; Heby never authorizes it.";
    case "DEVICE_ACTION":
      return "Restricted — device runtime is Platform-owned and not implemented.";
    default:
      return "Unavailable.";
  }
}

/** The declared actions a workspace OWNS, with honest per-action verdicts. */
export function describeActionBoundary(workspace: HebyWorkspaceId): readonly HebyActionBoundaryRow[] {
  return listActionTools()
    .filter((tool) => tool.ownerWorkspace === workspace)
    .map((tool) => ({
      actionKind: tool.actionKind,
      label: ACTION_LABELS[tool.actionKind],
      sideEffect: tool.sideEffect,
      reversibility: tool.reversibility,
      authorityRequirement: tool.authorityRequirement,
      verdict: verdictFor(tool.sideEffect, tool.substrateConnected),
      invokable: tool.sideEffect === "READ_ONLY" && tool.substrateConnected,
      expectedEffect: tool.outputSummary,
    }));
}
