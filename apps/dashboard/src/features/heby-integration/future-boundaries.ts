/*
 * heby-integration/future-boundaries.ts — reserved, UNIMPLEMENTED boundaries for future
 * tool use and device runtime (UI Phase 15).
 *
 * These declare the SHAPE a future, separately-authorized capability would connect
 * through — so Heby can later reach tools and devices SAFELY, always through a capability
 * check, governance, and (where required) human authorization. Phase 15 implements NONE of
 * this. No tool is called; no browser, shell, filesystem, email, API, camera, microphone,
 * screen, keyboard, or mouse is touched. Device Runtime belongs to Platform capability
 * ownership. These are types only — there is no runtime here.
 */

import type { HebyAuthorityMode, HebyCapabilityFamily } from "./contracts";

/* ---------------------------------------------------------------------------
 * Future tool-use boundary:
 *   Heby → Tool Request → Capability Check → Governance → Human Authority (if required)
 *        → Tool Runtime
 * NOT IMPLEMENTED. The stages are named so the boundary is explicit, not so it runs.
 * ------------------------------------------------------------------------- */

export type HebyToolUseStage =
  | "tool-request"
  | "capability-check"
  | "governance-check"
  | "human-authority"
  | "tool-runtime";

export const HEBY_TOOL_USE_STAGES: readonly HebyToolUseStage[] = [
  "tool-request",
  "capability-check",
  "governance-check",
  "human-authority",
  "tool-runtime",
] as const;

export interface HebyFutureToolBoundary {
  readonly family: Extract<HebyCapabilityFamily, "future-tool-use">;
  /** Always false in Phase 15 — no tool runtime exists. */
  readonly implemented: false;
  readonly stages: readonly HebyToolUseStage[];
  readonly authority: HebyAuthorityMode;
}

export const HEBY_FUTURE_TOOL_BOUNDARY: HebyFutureToolBoundary = Object.freeze({
  family: "future-tool-use",
  implemented: false,
  stages: HEBY_TOOL_USE_STAGES,
  authority: "future-authorized-preparation",
});

/* ---------------------------------------------------------------------------
 * Future device-runtime boundary:
 *   Heby → Prepared Device Action → Governance → Director Authorization → Device Runtime
 *        → Computer Use
 * NOT IMPLEMENTED. Device Runtime & Computer Use are owned by Platform, gated by the
 * Director, and absent here.
 * ------------------------------------------------------------------------- */

export type HebyDeviceRuntimeStage =
  | "prepared-device-action"
  | "governance-check"
  | "director-authorization"
  | "device-runtime"
  | "computer-use";

export const HEBY_DEVICE_RUNTIME_STAGES: readonly HebyDeviceRuntimeStage[] = [
  "prepared-device-action",
  "governance-check",
  "director-authorization",
  "device-runtime",
  "computer-use",
] as const;

export interface HebyFutureDeviceBoundary {
  readonly family: Extract<HebyCapabilityFamily, "future-device-use">;
  /** Always false in Phase 15 — no device runtime exists. */
  readonly implemented: false;
  /** Device Runtime is a Platform-owned capability, not a Heby-owned one. */
  readonly ownedBy: "platform";
  readonly stages: readonly HebyDeviceRuntimeStage[];
  readonly authority: HebyAuthorityMode;
}

export const HEBY_FUTURE_DEVICE_BOUNDARY: HebyFutureDeviceBoundary = Object.freeze({
  family: "future-device-use",
  implemented: false,
  ownedBy: "platform",
  stages: HEBY_DEVICE_RUNTIME_STAGES,
  authority: "future-authorized-preparation",
});
