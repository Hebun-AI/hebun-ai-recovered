/*
 * device-runtime/runtime.ts — the Device Runtime interface and its honest disconnected form (P18).
 *
 * The runtime interface accepts ONLY a validated, eligible, authorized, governance-satisfied
 * prepared device action — never a raw prompt, never an arbitrary command. In Phase 18 no runtime
 * is connected, so the provided implementation is `disconnectedDeviceRuntime`: it re-checks and
 * fail-closes, executing nothing, causing no side effect, and returning an honest failure receipt.
 * Device execution eligibility reuses the Phase 17 gates (a device action is DEVICE_ACTION, so it
 * is never Phase-17-eligible) plus the device dimension — it is always false here.
 *
 * There is no Heby → OS path. There is no model. Nothing is fabricated.
 */

import { deriveEligibility } from "@/features/heby-actions";
import type {
  DeviceActionOutcome,
  DeviceActionReceipt,
  PreparedDeviceAction,
} from "./contracts";
import { prepareDeviceAction, type DeviceActionRequest } from "./device-action";
import { deviceRuntimeStatus, isDeviceRuntimeConnected } from "./registry";
import { validateDeviceReceipt } from "./result-validator";

/** The Device Runtime contract a future, separately-authorized runtime would implement. */
export interface DeviceRuntime {
  execute(prepared: PreparedDeviceAction): DeviceActionReceipt;
}

export interface DeviceEligibility {
  readonly eligible: boolean;
  readonly reasons: readonly string[];
}

/**
 * Whether a device action could run. Reuses the Phase 17 action eligibility (DEVICE_ACTION is never
 * Phase-17-eligible) and adds the device dimension (runtime connected, target resolved, session
 * valid, capability enabled). Always false in Phase 18.
 */
export function deviceExecutionEligible(prepared: PreparedDeviceAction): DeviceEligibility {
  const reasons: string[] = [];
  const actionEligibility = deriveEligibility(prepared.action);
  if (!actionEligibility.executionEligible) reasons.push(...actionEligibility.blockingReasons);
  if (!isDeviceRuntimeConnected()) reasons.push("Device Runtime is not connected.");
  if (prepared.deviceTarget.state !== "resolved") reasons.push("Device target is not resolved.");
  if (!prepared.capabilityGate.connected) reasons.push("Device is not connected.");
  if (!prepared.capabilityGate.sessionValid) reasons.push("No valid device session.");
  if (!prepared.capabilityGate.capabilityEnabled) reasons.push("Capability is not enabled.");
  return { eligible: reasons.length === 0, reasons };
}

/** The honest disconnected runtime: executes nothing, fabricates nothing, fails closed. */
export const disconnectedDeviceRuntime: DeviceRuntime = {
  execute(prepared: PreparedDeviceAction): DeviceActionReceipt {
    return {
      actionId: prepared.action.actionId,
      deviceId: prepared.deviceTarget.deviceId,
      capability: prepared.capability,
      executionState: prepared.failureMode,
      sideEffect: prepared.sideEffect,
      sideEffectOccurred: false,
      target: prepared.deviceTarget,
      evidence: prepared.action.evidence,
      provenance: ["Device Runtime is not connected; no device capability ran."],
      authorityBasis: prepared.action.authorityGate.requirement,
      governanceBasis: prepared.action.governanceGate.status,
      limitations: prepared.limitations,
      failureReason: prepared.limitations.join(" "),
    };
  },
};

/**
 * Run the full device action lifecycle. Prepares, derives eligibility, and — because nothing is
 * eligible in Phase 18 — routes to the disconnected runtime, then validates the receipt. `executed`
 * is only ever true for a validated SUCCESS receipt that proves a side effect; that never occurs.
 */
export function runDeviceAction(
  request: DeviceActionRequest,
  runtime: DeviceRuntime = disconnectedDeviceRuntime,
): DeviceActionOutcome {
  const prepared = prepareDeviceAction(request);
  const eligibility = deviceExecutionEligible(prepared);
  const runtimeStatus = deviceRuntimeStatus();

  // Only a fully eligible action would ever reach the injected runtime; none is eligible here, so
  // the disconnected runtime returns an honest withheld receipt.
  const rawReceipt = eligibility.eligible
    ? runtime.execute(prepared)
    : disconnectedDeviceRuntime.execute(prepared);

  const validation = validateDeviceReceipt(rawReceipt, prepared);
  const executed =
    validation.valid &&
    validation.receipt.executionState === "SUCCESS" &&
    validation.receipt.sideEffectOccurred;

  return {
    prepared,
    runtimeStatus,
    receipt: validation.receipt,
    executed,
  };
}
