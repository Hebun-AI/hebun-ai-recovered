/*
 * device-runtime/capabilities.ts — the canonical device capability model (UI Phase 18).
 *
 * Each capability is classified by risk, mapped onto a Phase 17 side-effect class (a capability
 * name can NEVER bypass side-effect classification), marked for privacy sensitivity, and given an
 * honest default state. In Phase 18 NOTHING is `available` — sensitive capabilities are
 * `restricted`, the rest are `unavailable`, because no device runtime is connected.
 *
 * Deliberate boundaries encoded here:
 *  - camera and microphone are RESTRICTED, DEVICE_ACTION, privacy-sensitive, and never activated;
 *  - terminal is RESTRICTED — there is NO generic shell and NO arbitrary command capability;
 *  - screen capture is separated from screen read, and there is NO continuous-observation
 *    capability at all (no continuous surveillance is even modelled);
 *  - pointer/keyboard input is HIGH-risk consequential, not a generic input channel;
 *  - external browser interaction and file write are restricted consequential mutations;
 *  - credential surfaces (password managers, keychains, saved passwords, tokens, cookies, SSH
 *    keys) are NEVER a device capability — see CREDENTIAL_SURFACES_WITHHELD.
 */

import type {
  DeviceCapability,
  DeviceCapabilityDescriptor,
  ToolSideEffectClass,
} from "./contracts";

const DESCRIPTORS: Readonly<Record<DeviceCapability, DeviceCapabilityDescriptor>> = Object.freeze({
  SCREEN_READ: Object.freeze({
    capability: "SCREEN_READ", risk: "LOW", sideEffect: "READ_ONLY",
    privacyCategory: "screen", privacySensitive: true, requiresExplicitHumanAuthorization: true,
    defaultState: "unavailable",
    describes: "Read a bounded view of what is on screen. Privacy-sensitive; no runtime is connected.",
  }),
  SCREEN_CAPTURE: Object.freeze({
    capability: "SCREEN_CAPTURE", risk: "MEDIUM", sideEffect: "READ_ONLY",
    privacyCategory: "screen", privacySensitive: true, requiresExplicitHumanAuthorization: true,
    defaultState: "unavailable",
    describes: "Capture a single bounded screenshot artifact. Not continuous observation.",
  }),
  POINTER_INPUT: Object.freeze({
    capability: "POINTER_INPUT", risk: "HIGH", sideEffect: "CONSEQUENTIAL_MUTATION",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: true,
    defaultState: "unavailable",
    describes: "A bounded pointer action on a known target. Not a generic click(x,y) channel.",
  }),
  KEYBOARD_INPUT: Object.freeze({
    capability: "KEYBOARD_INPUT", risk: "HIGH", sideEffect: "CONSEQUENTIAL_MUTATION",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: true,
    defaultState: "unavailable",
    describes: "A bounded keyboard action. Not a generic type(text) channel.",
  }),
  BROWSER_READ: Object.freeze({
    capability: "BROWSER_READ", risk: "LOW", sideEffect: "READ_ONLY",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: false,
    defaultState: "unavailable",
    describes: "Read external page content. No external browser runtime is connected.",
  }),
  BROWSER_NAVIGATION: Object.freeze({
    capability: "BROWSER_NAVIGATION", risk: "MEDIUM", sideEffect: "REVERSIBLE_MUTATION",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "Navigate an external browser. Restricted; internal product navigation is separate and safe.",
  }),
  BROWSER_INTERACTION: Object.freeze({
    capability: "BROWSER_INTERACTION", risk: "HIGH", sideEffect: "CONSEQUENTIAL_MUTATION",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "Interact with (submit/click) external pages. Restricted; no runtime is connected.",
  }),
  FILE_READ: Object.freeze({
    capability: "FILE_READ", risk: "MEDIUM", sideEffect: "READ_ONLY",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: false,
    defaultState: "unavailable",
    describes: "Read a scoped file. Paths must be scoped; no filesystem runtime is connected.",
  }),
  FILE_WRITE: Object.freeze({
    capability: "FILE_WRITE", risk: "HIGH", sideEffect: "CONSEQUENTIAL_MUTATION",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "Write a scoped file. Restricted consequential mutation; no runtime is connected.",
  }),
  APPLICATION_READ: Object.freeze({
    capability: "APPLICATION_READ", risk: "LOW", sideEffect: "READ_ONLY",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: false,
    defaultState: "unavailable",
    describes: "Read the state of an application. No runtime is connected.",
  }),
  APPLICATION_LAUNCH: Object.freeze({
    capability: "APPLICATION_LAUNCH", risk: "MEDIUM", sideEffect: "REVERSIBLE_MUTATION",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: true,
    defaultState: "unavailable",
    describes: "Launch an application. Still capability-checked; no runtime is connected.",
  }),
  CLIPBOARD_READ: Object.freeze({
    capability: "CLIPBOARD_READ", risk: "HIGH", sideEffect: "READ_ONLY",
    privacyCategory: "clipboard", privacySensitive: true, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "Read the clipboard. Privacy-sensitive (may hold secrets); never auto-sent to a model.",
  }),
  CLIPBOARD_WRITE: Object.freeze({
    capability: "CLIPBOARD_WRITE", risk: "HIGH", sideEffect: "CONSEQUENTIAL_MUTATION",
    privacyCategory: "clipboard", privacySensitive: true, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "Write the clipboard. Privacy-sensitive; restricted.",
  }),
  TERMINAL_COMMAND: Object.freeze({
    capability: "TERMINAL_COMMAND", risk: "RESTRICTED", sideEffect: "CONSEQUENTIAL_MUTATION",
    privacyCategory: "none", privacySensitive: false, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "RESTRICTED. There is no generic shell and no arbitrary command; not implemented.",
  }),
  CAMERA_READ: Object.freeze({
    capability: "CAMERA_READ", risk: "RESTRICTED", sideEffect: "DEVICE_ACTION",
    privacyCategory: "camera", privacySensitive: true, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "RESTRICTED / not implemented. Camera requires a governed runtime and explicit authority.",
  }),
  MICROPHONE_READ: Object.freeze({
    capability: "MICROPHONE_READ", risk: "RESTRICTED", sideEffect: "DEVICE_ACTION",
    privacyCategory: "microphone", privacySensitive: true, requiresExplicitHumanAuthorization: true,
    defaultState: "restricted",
    describes: "RESTRICTED / not implemented. Microphone requires a governed runtime and explicit authority.",
  }),
});

/**
 * Credential surfaces that are NEVER exposed as a device capability. Device Runtime must never
 * read these; they are WITHHELD by design until a future explicit secure credential broker is
 * architected. Listed as structural vocabulary — not accessed anywhere.
 */
export const CREDENTIAL_SURFACES_WITHHELD: readonly string[] = Object.freeze([
  "password-manager", "saved-passwords", "system-keychain", "api-key-store",
  "ssh-private-key", "auth-token", "session-cookie", "session-secret",
]);

export function getCapabilityDescriptor(capability: DeviceCapability): DeviceCapabilityDescriptor {
  return DESCRIPTORS[capability];
}

export function listCapabilityDescriptors(): readonly DeviceCapabilityDescriptor[] {
  return Object.values(DESCRIPTORS);
}

export function mapCapabilityToSideEffect(capability: DeviceCapability): ToolSideEffectClass {
  return DESCRIPTORS[capability].sideEffect;
}

/** Capabilities that are privacy-sensitive and require explicit human authorization. */
export function sensitiveCapabilities(): readonly DeviceCapability[] {
  return listCapabilityDescriptors()
    .filter((d) => d.privacySensitive || d.requiresExplicitHumanAuthorization)
    .map((d) => d.capability);
}

export interface CapabilityConsistencyIssue {
  readonly capability: DeviceCapability;
  readonly issue: string;
}

/**
 * Validate the capability model's own honesty invariants:
 *  - nothing is `available` (no runtime), so every default state is `unavailable` or `restricted`;
 *  - camera, microphone, and terminal are RESTRICTED-risk and restricted-state;
 *  - every privacy-sensitive capability requires explicit human authorization;
 *  - a consequential/device capability is never left without human authorization.
 * Returns violations — empty when the model is internally honest.
 */
export function validateCapabilityModel(): readonly CapabilityConsistencyIssue[] {
  const issues: CapabilityConsistencyIssue[] = [];
  for (const d of listCapabilityDescriptors()) {
    if (d.defaultState !== "unavailable" && d.defaultState !== "restricted") {
      issues.push({ capability: d.capability, issue: "no capability may be available in Phase 18" });
    }
    if ((d.capability === "CAMERA_READ" || d.capability === "MICROPHONE_READ" || d.capability === "TERMINAL_COMMAND")) {
      if (d.risk !== "RESTRICTED") issues.push({ capability: d.capability, issue: "must be RESTRICTED risk" });
      if (d.defaultState !== "restricted") issues.push({ capability: d.capability, issue: "must default to restricted" });
    }
    if (d.privacySensitive && !d.requiresExplicitHumanAuthorization) {
      issues.push({ capability: d.capability, issue: "privacy-sensitive capability must require explicit human authorization" });
    }
    if ((d.sideEffect === "CONSEQUENTIAL_MUTATION" || d.sideEffect === "DEVICE_ACTION") && !d.requiresExplicitHumanAuthorization) {
      issues.push({ capability: d.capability, issue: "consequential/device capability must require human authorization" });
    }
  }
  return issues;
}
