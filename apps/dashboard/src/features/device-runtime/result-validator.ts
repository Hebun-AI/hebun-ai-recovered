/*
 * device-runtime/result-validator.ts — device result validation + claim safety (UI Phase 18).
 *
 * A device runtime result is UNTRUSTED. Before it is believed it is validated against the prepared
 * device action: action identity, device identity, capability, side-effect class, and target must
 * match, a non-mutating capability may not claim a side effect, and — crucially — a SUCCESS receipt
 * is only credible if a runtime is actually connected. Because none is, ANY SUCCESS or
 * side-effect-occurred receipt is fabricated and FAILS CLOSED to a RESULT_INVALID receipt.
 *
 * It also owns device execution-claim safety (same invariant as Phase 17): Heby may never say
 * "I opened the camera / clicked it / ran the command / changed the file" unless a validated
 * receipt PROVES the side effect. No receipt can prove one in Phase 18, so such a claim is always
 * unsafe and must be withheld.
 */

import type {
  DeviceActionReceipt,
  PreparedDeviceAction,
} from "./contracts";
import { isDeviceRuntimeConnected } from "./registry";

export interface DeviceReceiptValidation {
  readonly valid: boolean;
  readonly issues: readonly string[];
  readonly receipt: DeviceActionReceipt;
}

/** Phrases that assert a device act occurred. Specific enough not to trip on innocuous words. */
export const DEVICE_EXECUTION_CLAIM_VERBS: readonly string[] = [
  "opened the camera",
  "turned on the microphone",
  "clicked the",
  "typed into",
  "ran the command",
  "wrote the file",
  "captured the screen",
  "recorded the",
  "launched the app",
  "read the clipboard",
];

function invalidReceipt(original: DeviceActionReceipt, reason: string): DeviceActionReceipt {
  return {
    ...original,
    executionState: "RESULT_INVALID",
    sideEffectOccurred: false,
    output: undefined,
    screenshotRef: undefined,
    provenance: ["Device result failed validation; withheld."],
    failureReason: reason,
  };
}

/** Whether a receipt truthfully proves a device side effect occurred. */
export function receiptProvesDeviceSideEffect(receipt: DeviceActionReceipt): boolean {
  return receipt.executionState === "SUCCESS" && receipt.sideEffectOccurred === true;
}

export function validateDeviceReceipt(
  receipt: DeviceActionReceipt,
  prepared: PreparedDeviceAction,
): DeviceReceiptValidation {
  const issues: string[] = [];

  if (receipt.actionId !== prepared.action.actionId) {
    issues.push("Receipt action identity does not match the prepared device action.");
  }
  if (receipt.capability !== prepared.capability) {
    issues.push("Receipt capability does not match the prepared device action.");
  }
  if (receipt.sideEffect !== prepared.sideEffect) {
    issues.push("Receipt side-effect class does not match the prepared device action.");
  }
  if ((receipt.deviceId ?? null) !== (prepared.deviceTarget.deviceId ?? null)) {
    issues.push("Receipt device identity does not match the resolved target.");
  }
  if (receipt.target.state !== prepared.deviceTarget.state) {
    issues.push("Receipt target does not match the resolved target.");
  }
  // A READ_ONLY device capability must never report a side effect.
  if (prepared.sideEffect === "READ_ONLY" && receipt.sideEffectOccurred) {
    issues.push("A read-only device capability must not report a side effect.");
  }
  // A SUCCESS or side-effecting receipt is only credible with a connected runtime — there is none.
  if (!isDeviceRuntimeConnected() && (receipt.executionState === "SUCCESS" || receipt.sideEffectOccurred)) {
    issues.push("No Device Runtime is connected; a success or side-effect receipt is fabricated.");
  }
  // A screenshot reference may only accompany a connected-runtime result.
  if (receipt.screenshotRef && !isDeviceRuntimeConnected()) {
    issues.push("A screenshot reference cannot exist without a connected runtime.");
  }
  if (receipt.provenance.length === 0) {
    issues.push("Receipt carries no provenance.");
  }

  if (issues.length > 0) {
    return { valid: false, issues, receipt: invalidReceipt(receipt, issues.join(" ")) };
  }
  return { valid: true, issues: [], receipt };
}

export interface DeviceClaimCheck {
  readonly safe: boolean;
  readonly offendingClaims: readonly string[];
}

/**
 * Guard response text against an unproven device-execution claim. A claim is safe only when a
 * validated receipt proves the device side effect occurred. In Phase 18 none can, so any such claim
 * is unsafe and must be withheld.
 */
export function checkDeviceExecutionClaim(
  text: string,
  receipt?: DeviceActionReceipt,
): DeviceClaimCheck {
  const lowered = text.toLowerCase();
  const offending = DEVICE_EXECUTION_CLAIM_VERBS.filter((verb) => lowered.includes(verb));
  if (offending.length === 0) return { safe: true, offendingClaims: [] };
  const proven = receipt ? receiptProvesDeviceSideEffect(receipt) : false;
  return { safe: proven, offendingClaims: proven ? [] : offending };
}
