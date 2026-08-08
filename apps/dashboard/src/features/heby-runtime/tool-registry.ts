/*
 * heby-runtime/tool-registry.ts — the declared Heby tool boundary (UI Phase 16).
 *
 * A Heby tool is a DECLARED, gated capability with a side-effect class — never an arbitrary
 * repo function. Phase 16 registers only READ_ONLY tools. Consequential mutation, device
 * actions, shell, filesystem, and browser automation are NOT registered and NOT invokable.
 * A future device runtime is represented as an unavailable, human-authority-bound
 * DEVICE_ACTION declaration so the boundary is explicit — it is never runnable here.
 */

import type { ToolDefinition } from "./contracts";

export const NAVIGATE_TOOL_ID = "heby.navigate.resolve";
export const INSPECT_SYSTEM_STATE_TOOL_ID = "heby.operations.inspect-system-state";

const TOOLS: readonly ToolDefinition[] = [
  {
    toolId: NAVIGATE_TOOL_ID,
    capability: "navigate",
    sideEffect: "READ_ONLY",
    authorityRequirement: "advisory-only",
    governanceGated: false,
    available: true,
    inputSummary: "A navigation phrase or workspace name.",
    outputSummary: "A real in-app route target (or real candidates); never auto-followed.",
    describes: "Resolves a target to a real product route. Read-only; the human navigates.",
  },
  {
    toolId: INSPECT_SYSTEM_STATE_TOOL_ID,
    capability: "expose-runtime",
    sideEffect: "READ_ONLY",
    authorityRequirement: "advisory-only",
    governanceGated: false,
    // Available only when the server supplies the real Executive Overview to the runtime.
    available: true,
    inputSummary: "The current workspace context.",
    outputSummary: "Derived, non-authoritative system health/section state with provenance.",
    describes: "Reads the Executive Overview read model. Read-only; fabricates nothing.",
  },
  {
    // Declared so the boundary is explicit. NOT invokable in Phase 16 — a device runtime is
    // Platform-owned, Director-authorized, and does not exist here.
    toolId: "heby.device.action",
    capability: "future-device-use",
    sideEffect: "DEVICE_ACTION",
    authorityRequirement: "future-authorized-preparation",
    governanceGated: true,
    available: false,
    inputSummary: "—",
    outputSummary: "—",
    describes: "Reserved. Device actions require a governed device runtime and Director authorization; not implemented.",
  },
];

export function listTools(): readonly ToolDefinition[] {
  return TOOLS;
}

export function getTool(toolId: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.toolId === toolId);
}

/** Tools that are actually invokable now (available + READ_ONLY). */
export function invokableTools(): readonly ToolDefinition[] {
  return TOOLS.filter((tool) => tool.available && tool.sideEffect === "READ_ONLY");
}
