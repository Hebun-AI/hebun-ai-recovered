/*
 * device-runtime/registry.ts — the device registry and runtime status (UI Phase 18).
 *
 * The registry is EMPTY. No device instance is fabricated — there is no real persisted device
 * registry in this repository, so there is nothing to list, and no "MacBook", no "online" status,
 * and no local-machine identity is ever invented. Lookups are TENANT-SCOPED (isolation is not a
 * client-side filter over a global list): a device is only ever returned for its owning tenant, so
 * a cross-tenant lookup fails closed to `undefined`.
 *
 * The runtime status is honestly `not connected` / Computer Use `not enabled` — the single seam a
 * future, separately-authorized Device Runtime would replace.
 */

import type { DeviceIdentity, DeviceRuntimeStatus } from "./contracts";

/** No devices are registered. The contract exists; no instance is fabricated. */
const REGISTERED_DEVICES: readonly DeviceIdentity[] = Object.freeze([]);

/** Devices registered to a tenant. Always empty in Phase 18 — never a fabricated device. */
export function listDevices(tenantId: string): readonly DeviceIdentity[] {
  return REGISTERED_DEVICES.filter(
    (device) => device.tenantId === tenantId,
  );
}

/**
 * Look up a device by id WITHIN a tenant scope. Returns undefined for an unknown device or a
 * cross-tenant lookup — isolation fails closed, never leaks another tenant's device.
 */
export function getDevice(deviceId: string, tenantId: string): DeviceIdentity | undefined {
  return REGISTERED_DEVICES.find(
    (device) => device.deviceId === deviceId && device.tenantId === tenantId,
  );
}

/** Whether a real Device Runtime is connected. ALWAYS false in Phase 18 — a constant, not telemetry. */
export function isDeviceRuntimeConnected(): boolean {
  return false;
}

/** The honest Device Runtime status for the UI. */
export function deviceRuntimeStatus(): DeviceRuntimeStatus {
  return {
    connected: isDeviceRuntimeConnected(),
    reason: "no-runtime",
    computerUseEnabled: false,
    detail: "No Device Runtime is connected. Computer Use is not enabled and no device is registered.",
  };
}
