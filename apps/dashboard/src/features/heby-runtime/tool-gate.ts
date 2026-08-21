/*
 * heby-runtime/tool-gate.ts — the invocation gate (UI Phase 16).
 *
 * A tool NEVER runs merely because a model (or anything) suggests it. Every invocation
 * passes, in order: tool exists → capability present → governance check → authority check →
 * side-effect admissibility → invoke → result. Only READ_ONLY tools proceed to invocation.
 * CONSEQUENTIAL_MUTATION and PREPARATION_ONLY tools that require human authority return
 * REQUIRES_HUMAN_REVIEW; DEVICE_ACTION and unavailable tools return RESTRICTED/UNAVAILABLE.
 * Nothing self-escalates, and no fake success is ever returned.
 */

import type {
  ExecutiveOverviewLike,
  HebyToolResult,
  ToolResultState,
} from "./contracts";
import { INVOKABLE_SIDE_EFFECTS } from "./contracts";
import { getTool, NAVIGATE_TOOL_ID, INSPECT_SYSTEM_STATE_TOOL_ID } from "./tool-registry";
import { resolveNavigation } from "./navigate-tool";
import { resolveSource } from "./source-resolver";
import { assembleEvidence, assembleProvenance } from "./evidence-assembler";

export interface ToolInvocationInput {
  readonly toolId: string;
  readonly query?: string;
  readonly overview?: ExecutiveOverviewLike;
}

function result(
  toolId: string,
  state: ToolResultState,
  summary: string,
  extra?: Partial<HebyToolResult>,
): HebyToolResult {
  return {
    toolId,
    state,
    sideEffectOccurred: false,
    evidence: extra?.evidence ?? [],
    provenance: extra?.provenance ?? [],
    summary,
    navigationTarget: extra?.navigationTarget,
  };
}

/**
 * Gate and (if admissible) invoke a tool. Pure and deterministic. READ_ONLY tools never
 * cause a side effect (`sideEffectOccurred` stays false).
 */
export function invokeTool(input: ToolInvocationInput): HebyToolResult {
  const tool = getTool(input.toolId);
  if (!tool) return result(input.toolId, "FAILED", "Unknown tool. Nothing was invoked.");

  // Availability.
  if (!tool.available) {
    return result(
      tool.toolId,
      tool.sideEffect === "DEVICE_ACTION" ? "RESTRICTED" : "UNAVAILABLE",
      tool.sideEffect === "DEVICE_ACTION"
        ? "Device actions require a governed device runtime and Director authorization. Not implemented."
        : "This tool is not connected.",
    );
  }

  // Side-effect admissibility: only READ_ONLY is invokable in Phase 16.
  if (!INVOKABLE_SIDE_EFFECTS.includes(tool.sideEffect)) {
    // A consequential/preparation tool that needs human authority is deferred, never run.
    return result(
      tool.toolId,
      "REQUIRES_HUMAN_REVIEW",
      "This action changes state and requires human authority. Heby prepares it; it does not execute.",
    );
  }

  // Invoke the specific read-only tool.
  switch (tool.toolId) {
    case NAVIGATE_TOOL_ID: {
      const resolution = resolveNavigation(input.query ?? "");
      if (resolution.found && resolution.target) {
        return result(tool.toolId, "SUCCESS", `Resolved to ${resolution.target.label}.`, {
          navigationTarget: resolution.target,
          provenance: ["Navigation model (config/workspace-nav) — real product routes only."],
        });
      }
      if (resolution.candidates.length > 0) {
        return result(
          tool.toolId,
          "SUCCESS",
          `No single match. ${resolution.candidates.length} real destinations match: ${resolution.candidates.map((c) => c.label).join(", ")}.`,
          { provenance: ["Navigation model (config/workspace-nav) — real product routes only."] },
        );
      }
      /*
       * HEBY-NAV-0 — this sentence used to read "No real route matches that", which is a claim
       * about the PRODUCT. Heby resolves against the canonical navigation model and knows nothing
       * about which routes exist, so for a real-but-non-canonical path that sentence was false.
       * What it may honestly report is its own failure to resolve, and that it substituted nothing.
       */
      return result(
        tool.toolId,
        "FAILED",
        "Heby could not resolve that to a canonical destination, and did not substitute a different one. Nothing was navigated.",
      );
    }
    case INSPECT_SYSTEM_STATE_TOOL_ID: {
      if (!input.overview) {
        return result(tool.toolId, "UNAVAILABLE", "System state was not supplied to Heby.");
      }
      const operations = resolveSource("operations", input.overview);
      const platform = resolveSource("platform", input.overview);
      const resolutions = [operations, platform];
      const evidence = assembleEvidence(resolutions);
      if (evidence.length === 0) {
        return result(tool.toolId, "UNAVAILABLE", "No system sections are readable.");
      }
      return result(
        tool.toolId,
        "SUCCESS",
        `Read ${evidence.length} system section${evidence.length === 1 ? "" : "s"} from the Executive Overview.`,
        { evidence, provenance: assembleProvenance(resolutions) },
      );
    }
    default:
      return result(tool.toolId, "FAILED", "Tool has no invocation path.");
  }
}
