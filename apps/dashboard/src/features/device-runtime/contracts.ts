/*
 * device-runtime/contracts.ts — the typed FOUNDATION for Device Registration, Device Sessions,
 * Prepared Device Actions, and the Device Runtime / Computer Use boundary (UI Phase 18).
 *
 * This is a FOUNDATION phase. It does NOT turn Heby into a desktop agent. Discovery proved there
 * is NO real device registry, NO device session runtime, NO Computer Use execution runtime, and
 * NO browser/filesystem/terminal/input/screen/camera/microphone runtime in this repository — the
 * only Computer Use surface is an OFFLINE, SIMULATION-ONLY planning provider (no OS control, no
 * input, no execution, no network). So Phase 18 declares the honest CONTRACT the future runtime
 * would connect through, and nothing else: the device registry is EMPTY, no device instance is
 * fabricated, no session is established, and every prepared device action is non-executable.
 *
 * The action backbone stays Phase 17: a PreparedDeviceAction REFERENCES a Phase 17
 * HebyPreparedAction rather than creating a parallel execution system. Every device capability is
 * mapped into a Phase 17 side-effect class, and every path terminates through the same gates —
 * capability → governance → authority → human review → eligibility → controlled invocation →
 * result validation. There is no Heby → OS command, no LLM → mouse click, no user-text → shell
 * string. Camera, microphone, terminal, generic shell, unrestricted filesystem, and external
 * browser control remain RESTRICTED / NOT IMPLEMENTED. Credential surfaces are always WITHHELD.
 *
 * No model, network, provider SDK, shell, filesystem write, device input, screen capture, camera,
 * or microphone is introduced. Builds on @/features/heby-actions, @/features/heby-integration, and
 * @/features/heby-runtime WITHOUT modifying them.
 */

import type {
  HebyAuthorityMode,
  HebyEvidenceReference,
  HebyWorkspaceId,
} from "@/features/heby-integration";
import type {
  HebyArguments,
  HebyPreparedAction,
  HebyRequirementStatus,
  ToolSideEffectClass,
} from "@/features/heby-actions";

/* Re-export the canonical Phase 17 side-effect vocabulary — device capabilities map onto it. */
export type { ToolSideEffectClass } from "@/features/heby-actions";

/* ===========================================================================
 * 1. DEVICE IDENTITY
 *
 * What a device IS — never a fabricated instance. The registry holds none; these shapes are the
 * contract a future, separately-authorized registry would populate. Every device is scoped to an
 * explicit tenant/organization (isolation), owned by Platform, and carries a DECLARED capability
 * profile that is not the same as an ENABLED one.
 * ========================================================================= */

/** A small, stable device vocabulary. Mobile/IoT are intentionally omitted — no runtime justifies them. */
export type DeviceKind = "DESKTOP" | "LAPTOP" | "SERVER" | "VIRTUAL_MACHINE" | "BROWSER_SESSION";

export const DEVICE_KINDS: readonly DeviceKind[] = Object.freeze([
  "DESKTOP", "LAPTOP", "SERVER", "VIRTUAL_MACHINE", "BROWSER_SESSION",
]);

/** Platform vocabulary. Naming a platform is NOT connected support. */
export type DevicePlatform = "MACOS" | "WINDOWS" | "LINUX" | "BROWSER" | "OTHER";

export const DEVICE_PLATFORMS: readonly DevicePlatform[] = Object.freeze([
  "MACOS", "WINDOWS", "LINUX", "BROWSER", "OTHER",
]);

/**
 * Enrollment states are DISTINCT and MUST NOT collapse: a device defined in config is not
 * registered; registered is not connected; connected is not trusted; trusted is not authorized for
 * every capability. Ordered weakest → strongest.
 */
export type DeviceEnrollmentState =
  | "DEFINED"
  | "REGISTERED"
  | "ENROLLED"
  | "CONNECTED"
  | "TRUSTED"
  | "AVAILABLE";

export const DEVICE_ENROLLMENT_STATES: readonly DeviceEnrollmentState[] = Object.freeze([
  "DEFINED", "REGISTERED", "ENROLLED", "CONNECTED", "TRUSTED", "AVAILABLE",
]);

export interface DeviceEnrollmentDescriptor {
  readonly state: DeviceEnrollmentState;
  readonly order: number;
  /** Whether a device in this state could be a runtime target at all (CONNECTED and up). */
  readonly connectable: boolean;
  readonly label: string;
}

export const DEVICE_ENROLLMENT_DESCRIPTORS: Readonly<
  Record<DeviceEnrollmentState, DeviceEnrollmentDescriptor>
> = Object.freeze({
  DEFINED: Object.freeze({ state: "DEFINED", order: 0, connectable: false, label: "Defined" }),
  REGISTERED: Object.freeze({ state: "REGISTERED", order: 1, connectable: false, label: "Registered" }),
  ENROLLED: Object.freeze({ state: "ENROLLED", order: 2, connectable: false, label: "Enrolled" }),
  CONNECTED: Object.freeze({ state: "CONNECTED", order: 3, connectable: true, label: "Connected" }),
  TRUSTED: Object.freeze({ state: "TRUSTED", order: 4, connectable: true, label: "Trusted" }),
  AVAILABLE: Object.freeze({ state: "AVAILABLE", order: 5, connectable: true, label: "Available" }),
});

export type DeviceTrustState = "unknown" | "untrusted" | "trusted";

export interface DeviceIdentity {
  readonly deviceId: string;
  readonly deviceKind: DeviceKind;
  readonly platform: DevicePlatform;
  /** Platform owns device registration. No other workspace may register a device. */
  readonly ownerWorkspace: Extract<HebyWorkspaceId, "platform">;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly enrollmentState: DeviceEnrollmentState;
  readonly trustState: DeviceTrustState;
  /** DECLARED capabilities — not enabled. Enablement is decided at capability-check time. */
  readonly capabilityProfile: readonly DeviceCapability[];
  readonly restrictedFlags: readonly string[];
}

/* ===========================================================================
 * 2. DEVICE CAPABILITY VOCABULARY
 *
 * The canonical capability families. A capability being DECLARED is never a capability being
 * ENABLED. Every capability carries a risk class, a Phase 17 side-effect class, a privacy
 * sensitivity, whether it requires explicit per-action human authorization, and its honest default
 * state. In Phase 18 no capability is `available` — there is no runtime.
 * ========================================================================= */

export type DeviceCapability =
  | "SCREEN_READ"
  | "SCREEN_CAPTURE"
  | "POINTER_INPUT"
  | "KEYBOARD_INPUT"
  | "BROWSER_READ"
  | "BROWSER_NAVIGATION"
  | "BROWSER_INTERACTION"
  | "FILE_READ"
  | "FILE_WRITE"
  | "APPLICATION_READ"
  | "APPLICATION_LAUNCH"
  | "CLIPBOARD_READ"
  | "CLIPBOARD_WRITE"
  | "TERMINAL_COMMAND"
  | "CAMERA_READ"
  | "MICROPHONE_READ";

export const DEVICE_CAPABILITIES: readonly DeviceCapability[] = Object.freeze([
  "SCREEN_READ", "SCREEN_CAPTURE", "POINTER_INPUT", "KEYBOARD_INPUT",
  "BROWSER_READ", "BROWSER_NAVIGATION", "BROWSER_INTERACTION",
  "FILE_READ", "FILE_WRITE", "APPLICATION_READ", "APPLICATION_LAUNCH",
  "CLIPBOARD_READ", "CLIPBOARD_WRITE", "TERMINAL_COMMAND",
  "CAMERA_READ", "MICROPHONE_READ",
]);

export type DeviceCapabilityRisk = "LOW" | "MEDIUM" | "HIGH" | "RESTRICTED";

/** The privacy category a capability touches. `credential` surfaces are never a capability. */
export type DevicePrivacyCategory = "none" | "screen" | "clipboard" | "camera" | "microphone";

/** Honest default state. Nothing is `available` in Phase 18; sensitive ones are `restricted`. */
export type DeviceCapabilityState = "unavailable" | "restricted";

export interface DeviceCapabilityDescriptor {
  readonly capability: DeviceCapability;
  readonly risk: DeviceCapabilityRisk;
  /** The Phase 17 side-effect class this capability maps onto — capability names never bypass it. */
  readonly sideEffect: ToolSideEffectClass;
  readonly privacyCategory: DevicePrivacyCategory;
  readonly privacySensitive: boolean;
  /** Sensitive capabilities require an explicit human authorization per action/session. */
  readonly requiresExplicitHumanAuthorization: boolean;
  /** Honest default state — never `available` while no runtime is connected. */
  readonly defaultState: DeviceCapabilityState;
  readonly describes: string;
}

/* ===========================================================================
 * 3. DEVICE SESSION
 *
 * A bounded runtime session. In Phase 18 none is ever established — there is no runtime to
 * establish one. The contract exists so a future runtime can bind a session to an explicit tenant,
 * device, a LEAST-PRIVILEGE capability snapshot, an authority context, and a lifetime, with an
 * audit correlation id. No fabricated active user, no fabricated session.
 * ========================================================================= */

export type DeviceSessionState = "not-established" | "active" | "expired" | "revoked";

export interface DeviceSession {
  readonly sessionId: string;
  readonly deviceId: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly state: DeviceSessionState;
  /** Only the capabilities the prepared action needs — least privilege, never "full access". */
  readonly capabilitySnapshot: readonly DeviceCapability[];
  readonly authorityContext: HebyAuthorityMode;
  readonly isolationScope: string;
  /** Optional caller-supplied logical tick. NEVER a fabricated wall clock. */
  readonly expiresAtTick?: number;
  readonly auditCorrelationId: string;
}

export interface DeviceSessionRequirement {
  readonly required: boolean;
  /** The single capability the session would be scoped to (least privilege). */
  readonly leastPrivilegeCapability: DeviceCapability;
}

/* ===========================================================================
 * 4. TARGET RESOLUTION
 *
 * A device target is a TYPED, real reference — never an arbitrary string like "my laptop" turned
 * into execution. With an empty registry every resolution is `unavailable`; a real registry could
 * return `resolved` (one device), `ambiguous` (clarification required), or `cross-tenant-blocked`.
 * No local-machine identity is ever fabricated.
 * ========================================================================= */

export type DeviceTargetState = "resolved" | "unavailable" | "ambiguous" | "cross-tenant-blocked";

export interface DeviceTargetResolution {
  readonly state: DeviceTargetState;
  /** Present ONLY when a real registered device resolved. Never fabricated. */
  readonly deviceId?: string;
  readonly candidates: readonly string[];
  readonly reason: string;
}

/* ===========================================================================
 * 5. PRIVACY / PERMISSION REQUIREMENTS
 * ========================================================================= */

export interface DevicePrivacyRequirement {
  readonly privacySensitive: boolean;
  readonly category: DevicePrivacyCategory;
  /** Whether explicit human consent is required before this could ever run. */
  readonly requiresExplicitConsent: boolean;
}

export interface DevicePermissionRequirement {
  readonly capability: DeviceCapability;
  readonly requiresGovernance: boolean;
  readonly requiresHumanAuthorization: boolean;
}

/* ===========================================================================
 * 6. CAPABILITY GATE RESULT
 * ========================================================================= */

export interface DeviceCapabilityGateResult {
  readonly status: HebyRequirementStatus;
  readonly deviceExists: boolean;
  readonly connected: boolean;
  readonly trusted: boolean;
  readonly capabilityDeclared: boolean;
  readonly capabilityEnabled: boolean;
  readonly workspacePermitted: boolean;
  readonly tenantMatches: boolean;
  readonly sessionValid: boolean;
  readonly reasons: readonly string[];
}

/* ===========================================================================
 * 7. FAILURE MODES (honest — never a fake success)
 * ========================================================================= */

export type DeviceFailureMode =
  | "DEVICE_UNAVAILABLE"
  | "DEVICE_OFFLINE"
  | "SESSION_EXPIRED"
  | "CAPABILITY_UNAVAILABLE"
  | "CAPABILITY_RESTRICTED"
  | "GOVERNANCE_BLOCKED"
  | "AUTHORITY_REQUIRED"
  | "TARGET_NOT_FOUND"
  | "EXECUTION_FAILED"
  | "RESULT_INVALID";

export const DEVICE_FAILURE_MODES: readonly DeviceFailureMode[] = Object.freeze([
  "DEVICE_UNAVAILABLE", "DEVICE_OFFLINE", "SESSION_EXPIRED", "CAPABILITY_UNAVAILABLE",
  "CAPABILITY_RESTRICTED", "GOVERNANCE_BLOCKED", "AUTHORITY_REQUIRED", "TARGET_NOT_FOUND",
  "EXECUTION_FAILED", "RESULT_INVALID",
]);

/** The device execution state: every honest failure mode, or SUCCESS (which never occurs in Phase 18). */
export type DeviceExecutionState = DeviceFailureMode | "SUCCESS";

/* ===========================================================================
 * 8. PREPARED DEVICE ACTION (references Phase 17 — never a parallel system)
 *
 * The action authority backbone stays Phase 17: this composes a HebyPreparedAction with the
 * device-specific facets. It contains no secret, no credential, no raw command, and no fabricated
 * device/session/result.
 * ========================================================================= */

/** Device actions target EXTERNAL applications; Hebun's own UI uses semantic product routes instead. */
export type DeviceActionSurface = "external-application";

export interface PreparedDeviceAction {
  /** The Phase 17 prepared action this device action rides on. Phase 17 remains the backbone. */
  readonly action: HebyPreparedAction;
  readonly surface: DeviceActionSurface;
  readonly deviceTarget: DeviceTargetResolution;
  readonly capability: DeviceCapability;
  readonly sideEffect: ToolSideEffectClass;
  /** Typed, validated arguments (from the Phase 17 action). Never free-form. */
  readonly deviceArguments: HebyArguments;
  readonly sessionRequirement: DeviceSessionRequirement;
  readonly privacyRequirement: DevicePrivacyRequirement;
  readonly permissionRequirement: DevicePermissionRequirement;
  readonly capabilityGate: DeviceCapabilityGateResult;
  /** The honest blocking mode at preparation time (there is always one in Phase 18). */
  readonly failureMode: DeviceFailureMode;
  readonly limitations: readonly string[];
}

/* ===========================================================================
 * 9. DEVICE RUNTIME STATUS + EXECUTION RECEIPT
 *
 * The runtime is never connected in Phase 18. A receipt is a runtime artifact of THIS pass — it is
 * NOT a persisted audit record (none exists). It records no fabricated timestamp, actor, or
 * screenshot; `sideEffectOccurred` is always false because nothing runs.
 * ========================================================================= */

export interface DeviceRuntimeStatus {
  /** Always false in Phase 18. */
  readonly connected: boolean;
  readonly reason: "no-runtime" | "not-authorized" | "offline";
  /** Always false in Phase 18. */
  readonly computerUseEnabled: boolean;
  readonly detail: string;
}

export interface DeviceActionReceipt {
  readonly actionId: string;
  /** Present only when a real device resolved. Never fabricated. */
  readonly deviceId?: string;
  readonly capability: DeviceCapability;
  readonly executionState: DeviceExecutionState;
  readonly sideEffect: ToolSideEffectClass;
  /** Whether a side effect actually occurred. ALWAYS false in Phase 18 — nothing runs. */
  readonly sideEffectOccurred: boolean;
  readonly target: DeviceTargetResolution;
  readonly output?: string;
  readonly evidence: readonly HebyEvidenceReference[];
  /** A screenshot reference — never fabricated; absent unless a legitimate runtime produced one. */
  readonly screenshotRef?: string;
  readonly provenance: readonly string[];
  readonly authorityBasis: HebyAuthorityMode;
  readonly governanceBasis: HebyRequirementStatus;
  readonly limitations: readonly string[];
  readonly failureReason: string;
  /** Optional caller-supplied logical tick. NEVER a fabricated wall clock. */
  readonly observedTick?: number;
}

/* ===========================================================================
 * 10. DEVICE ACTION OUTCOME
 * ========================================================================= */

export interface DeviceActionOutcome {
  readonly prepared: PreparedDeviceAction;
  readonly runtimeStatus: DeviceRuntimeStatus;
  readonly receipt: DeviceActionReceipt;
  readonly executed: boolean;
}
