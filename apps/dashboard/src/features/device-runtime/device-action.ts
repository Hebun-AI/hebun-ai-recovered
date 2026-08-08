/*
 * device-runtime/device-action.ts — prepare a device action on the Phase 17 backbone (UI Phase 18).
 *
 * A device action does NOT create a parallel execution system: it composes a Phase 17
 * HebyPreparedAction (the `device-action` kind, side-effect DEVICE_ACTION, owned by Platform) with
 * the device-specific facets — target, capability, session requirement, privacy/permission
 * requirements — and runs the device capability gate. In Phase 18 the gate always blocks (no
 * device is registered, no session is established, no runtime is connected), so every prepared
 * device action carries an honest failure mode. Nothing is executed and nothing is fabricated.
 */

import type {
  HebyEvidenceReference,
  HebyWorkspaceId,
} from "@/features/heby-integration";
import { prepareAction } from "@/features/heby-actions";
import type {
  DeviceCapability,
  DeviceCapabilityGateResult,
  DeviceFailureMode,
  DevicePermissionRequirement,
  DevicePrivacyRequirement,
  DeviceSession,
  DeviceTargetResolution,
  PreparedDeviceAction,
} from "./contracts";
import { getCapabilityDescriptor } from "./capabilities";
import { getDevice, isDeviceRuntimeConnected } from "./registry";
import { resolveDeviceTarget } from "./target-resolver";
import { deviceSessionRequirement, validateDeviceSession } from "./session";

export interface DeviceActionRequest {
  readonly capability: DeviceCapability;
  /** The workspace requesting the device capability (ownership is checked via Phase 17). */
  readonly requestingWorkspace: HebyWorkspaceId;
  readonly targetQuery: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly session?: DeviceSession;
  readonly evidence?: readonly HebyEvidenceReference[];
  readonly nowTick?: number;
}

function buildCapabilityGate(input: {
  target: DeviceTargetResolution;
  tenantId: string;
  capabilityEnabled: boolean;
  workspacePermitted: boolean;
  sessionValid: boolean;
}): DeviceCapabilityGateResult {
  const device = input.target.deviceId ? getDevice(input.target.deviceId, input.tenantId) : undefined;
  const deviceExists = device !== undefined;
  const connected = deviceExists && isDeviceRuntimeConnected();
  const trusted = deviceExists && device!.trustState === "trusted";
  const reasons: string[] = [];
  if (!deviceExists) reasons.push("No registered device resolved.");
  if (!connected) reasons.push("Device Runtime is not connected.");
  if (!input.capabilityEnabled) reasons.push("Capability is not enabled (unavailable or restricted).");
  if (!input.workspacePermitted) reasons.push("Requesting workspace does not own this device capability.");
  if (!input.sessionValid) reasons.push("No valid device session.");
  return {
    status: "not-connected",
    deviceExists,
    connected,
    trusted,
    capabilityDeclared: deviceExists,
    capabilityEnabled: input.capabilityEnabled,
    workspacePermitted: input.workspacePermitted,
    tenantMatches: deviceExists, // a device is only ever returned within its tenant scope
    sessionValid: input.sessionValid,
    reasons,
  };
}

function deriveFailureMode(
  capabilityRestricted: boolean,
  capabilityUnavailable: boolean,
  target: DeviceTargetResolution,
  gate: DeviceCapabilityGateResult,
  governanceSatisfied: boolean,
  humanReviewRequired: boolean,
): DeviceFailureMode {
  if (capabilityRestricted) return "CAPABILITY_RESTRICTED";
  if (!isDeviceRuntimeConnected()) return "DEVICE_UNAVAILABLE"; // no runtime — the dominant honest truth
  if (target.state === "cross-tenant-blocked") return "TARGET_NOT_FOUND";
  if (target.state !== "resolved") return "TARGET_NOT_FOUND";
  if (!gate.connected) return "DEVICE_OFFLINE";
  if (!gate.sessionValid) return "SESSION_EXPIRED";
  if (capabilityUnavailable) return "CAPABILITY_UNAVAILABLE";
  if (!governanceSatisfied) return "GOVERNANCE_BLOCKED";
  if (humanReviewRequired) return "AUTHORITY_REQUIRED";
  return "DEVICE_UNAVAILABLE";
}

export function prepareDeviceAction(request: DeviceActionRequest): PreparedDeviceAction {
  // The Phase 17 backbone: a device-action prepared action (DEVICE_ACTION, owned by Platform).
  const action = prepareAction(
    {
      actionKind: "device-action",
      requestingWorkspace: request.requestingWorkspace,
      evidence: request.evidence,
      proposedAtTick: request.nowTick,
    },
    { nowTick: request.nowTick },
  );

  const descriptor = getCapabilityDescriptor(request.capability);
  const target = resolveDeviceTarget({ query: request.targetQuery, tenantId: request.tenantId });
  const sessionValidation = validateDeviceSession({
    session: request.session,
    tenantId: request.tenantId,
    capability: request.capability,
    nowTick: request.nowTick,
  });

  const capabilityRestricted = descriptor.defaultState === "restricted";
  const capabilityUnavailable = descriptor.defaultState === "unavailable";
  const capabilityEnabled = false; // nothing is enabled in Phase 18

  const gate = buildCapabilityGate({
    target,
    tenantId: request.tenantId,
    capabilityEnabled,
    workspacePermitted: action.capabilityGate.workspacePermitted,
    sessionValid: sessionValidation.valid,
  });

  const governanceSatisfied =
    action.governanceGate.status === "satisfied" || action.governanceGate.status === "not-required";
  const humanReviewRequired =
    action.authorityGate.humanReviewRequired || descriptor.requiresExplicitHumanAuthorization;

  const failureMode = deriveFailureMode(
    capabilityRestricted,
    capabilityUnavailable,
    target,
    gate,
    governanceSatisfied,
    humanReviewRequired,
  );

  const privacyRequirement: DevicePrivacyRequirement = {
    privacySensitive: descriptor.privacySensitive,
    category: descriptor.privacyCategory,
    requiresExplicitConsent: descriptor.privacySensitive || descriptor.requiresExplicitHumanAuthorization,
  };
  const permissionRequirement: DevicePermissionRequirement = {
    capability: request.capability,
    requiresGovernance: descriptor.sideEffect !== "READ_ONLY",
    requiresHumanAuthorization: descriptor.requiresExplicitHumanAuthorization,
  };

  const limitations: string[] = [
    "No Device Runtime is connected; this action cannot be executed.",
    ...gate.reasons,
  ];
  if (capabilityRestricted) {
    limitations.push(`${request.capability} is restricted and not implemented.`);
  }
  if (descriptor.privacySensitive) {
    limitations.push("Privacy-sensitive capability: explicit human consent would be required.");
  }

  return {
    action,
    surface: "external-application",
    deviceTarget: target,
    capability: request.capability,
    sideEffect: descriptor.sideEffect,
    deviceArguments: action.arguments,
    sessionRequirement: deviceSessionRequirement(request.capability),
    privacyRequirement,
    permissionRequirement,
    capabilityGate: gate,
    failureMode,
    limitations,
  };
}
