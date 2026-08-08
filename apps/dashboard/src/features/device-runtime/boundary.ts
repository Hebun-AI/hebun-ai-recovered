/*
 * device-runtime/boundary.ts — the honest Device Runtime boundary view (UI Phase 18).
 *
 * A transparency surface for Platform (and optionally the Heby panel). It states the truth with no
 * fabrication: the Device Runtime is Not connected, Computer Use is Not enabled, NO device is
 * listed (no fake MacBook, no online status), and each capability is shown with its risk,
 * Phase 17 side-effect class, privacy sensitivity, and honest default state — every one
 * non-executable. Derived entirely from the registry and the capability model.
 */

import type {
  DeviceCapability,
  DeviceCapabilityRisk,
  DeviceCapabilityState,
  DevicePrivacyCategory,
  ToolSideEffectClass,
} from "./contracts";
import { listCapabilityDescriptors, CREDENTIAL_SURFACES_WITHHELD } from "./capabilities";
import { deviceRuntimeStatus } from "./registry";

export interface DeviceCapabilityRow {
  readonly capability: DeviceCapability;
  readonly label: string;
  readonly risk: DeviceCapabilityRisk;
  readonly sideEffect: ToolSideEffectClass;
  readonly privacyCategory: DevicePrivacyCategory;
  readonly privacySensitive: boolean;
  readonly state: DeviceCapabilityState;
  /** Always false in Phase 18 — no capability is executable. */
  readonly executable: boolean;
  readonly requiresHumanAuthorization: boolean;
}

export interface DeviceRuntimeBoundaryView {
  readonly runtimeConnected: boolean;
  readonly runtimeStatusLabel: string;
  readonly computerUseLabel: string;
  readonly detail: string;
  readonly deviceCount: number;
  /** No fabricated device is ever listed. */
  readonly devices: readonly string[];
  readonly capabilities: readonly DeviceCapabilityRow[];
  readonly credentialNote: string;
}

function labelFor(capability: DeviceCapability): string {
  return capability
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** The honest Device Runtime boundary. Devices is always empty; every capability non-executable. */
export function describeDeviceRuntimeBoundary(): DeviceRuntimeBoundaryView {
  const status = deviceRuntimeStatus();
  const capabilities: DeviceCapabilityRow[] = listCapabilityDescriptors().map((d) => ({
    capability: d.capability,
    label: labelFor(d.capability),
    risk: d.risk,
    sideEffect: d.sideEffect,
    privacyCategory: d.privacyCategory,
    privacySensitive: d.privacySensitive,
    state: d.defaultState,
    executable: false,
    requiresHumanAuthorization: d.requiresExplicitHumanAuthorization,
  }));

  return {
    runtimeConnected: status.connected,
    runtimeStatusLabel: "Not connected",
    computerUseLabel: "Not enabled",
    detail: status.detail,
    deviceCount: 0,
    devices: [],
    capabilities,
    credentialNote: `Credential surfaces are never exposed as a device capability (${CREDENTIAL_SURFACES_WITHHELD.length} withheld).`,
  };
}
