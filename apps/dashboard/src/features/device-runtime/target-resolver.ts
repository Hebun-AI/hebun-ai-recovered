/*
 * device-runtime/target-resolver.ts — typed device target resolution (UI Phase 18).
 *
 * An arbitrary string like "my laptop" is NEVER turned into execution. Resolution produces a typed,
 * real device reference or an honest non-resolution. With an empty registry every resolution is
 * `unavailable` — no local-machine identity is fabricated. A future registry could return
 * `ambiguous` (clarification required) or `resolved` (exactly one real device). Resolution is
 * tenant-scoped, so another tenant's device can never be targeted.
 */

import type { DeviceTargetResolution } from "./contracts";
import { listDevices } from "./registry";

export function resolveDeviceTarget(input: {
  query: string;
  tenantId: string;
}): DeviceTargetResolution {
  const devices = listDevices(input.tenantId);

  if (devices.length === 0) {
    return {
      state: "unavailable",
      candidates: [],
      reason: "No device is registered for this tenant; Device Runtime is not connected. No local machine is assumed.",
    };
  }

  // A real registry would match here. Kept deterministic and honest: an exact id match resolves,
  // multiple matches are ambiguous, none is unavailable. Never a fabricated device id.
  const query = input.query.trim().toLowerCase();
  const matches = devices.filter(
    (device) => device.deviceId.toLowerCase() === query || device.deviceKind.toLowerCase() === query,
  );
  if (matches.length === 1) {
    return { state: "resolved", deviceId: matches[0].deviceId, candidates: [], reason: "Resolved a single registered device." };
  }
  if (matches.length > 1) {
    return {
      state: "ambiguous",
      candidates: matches.map((device) => device.deviceId),
      reason: "Multiple devices match; clarification is required before any device action.",
    };
  }
  return { state: "unavailable", candidates: [], reason: "No registered device matches that target." };
}
