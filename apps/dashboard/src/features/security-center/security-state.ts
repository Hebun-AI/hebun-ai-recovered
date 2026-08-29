/*
 * security-center/security-state.ts — the honest Security Center state strip (UI Phase 19).
 *
 * Only real/structural values. No KPI cards, no threat level, no counts of attacks. The security
 * feed is not connected, incidents are not available, device posture is read from the disconnected
 * Phase 18 boundary, authentication is a derived technical state, no security evidence is retained,
 * and response requires human authority. Every entry carries a color-independent status token.
 */

import { describeDeviceRuntimeBoundary } from "@/features/device-runtime";
import type { DeviceSecuritySummary, SecurityStateEntry } from "./contracts";

/** A minimal device-security summary derived from the real, disconnected Phase 18 boundary. */
export function getDeviceSecuritySummary(): DeviceSecuritySummary {
  const boundary = describeDeviceRuntimeBoundary();
  return {
    runtimeConnected: boundary.runtimeConnected,
    registeredDevices: boundary.deviceCount,
    // No device is registered, so none is trusted. Derived, never fabricated.
    trustedDevices: 0,
    sensitiveCapabilitiesRestricted: boundary.capabilities.some((c) => c.state === "restricted"),
    detail: boundary.detail,
  };
}

export function getSecurityStateStrip(): readonly SecurityStateEntry[] {
  const device = getDeviceSecuritySummary();
  return [
    /*
     * E2-2. "Not connected" became false the moment the `audit` source connected, and "Connected"
     * would be worse — it would let a reader infer a live security feed, which still does not
     * exist. Both halves are stated, so neither can be read alone.
     *
     *     REQUEST-TIME READ != REAL-TIME STREAM
     */
    { label: "Security feed", value: "No live feed · recorded acts connected", status: "derived" },
    { label: "Incidents", value: "Not available", status: "not-available" },
    { label: "Device posture", value: `${device.registeredDevices} registered · runtime not connected`, status: "derived" },
    { label: "Auth security", value: "Derived technical state", status: "derived" },
    { label: "Evidence", value: "No retained security evidence", status: "none" },
    { label: "Response", value: "Human authority required", status: "human-authority" },
  ];
}
