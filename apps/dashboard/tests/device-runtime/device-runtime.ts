import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  invokableTools,
  invokeTool,
  NAVIGATE_TOOL_ID,
} from "../../src/features/heby-runtime";
import {
  listDevices,
  getDevice,
  isDeviceRuntimeConnected,
  deviceRuntimeStatus,
} from "../../src/features/device-runtime/registry";
import { resolveDeviceTarget } from "../../src/features/device-runtime/target-resolver";
import {
  getCapabilityDescriptor,
  validateCapabilityModel,
  mapCapabilityToSideEffect,
  CREDENTIAL_SURFACES_WITHHELD,
} from "../../src/features/device-runtime/capabilities";
import { validateDeviceSession } from "../../src/features/device-runtime/session";
import { prepareDeviceAction } from "../../src/features/device-runtime/device-action";
import { runDeviceAction, deviceExecutionEligible } from "../../src/features/device-runtime/runtime";
import {
  validateDeviceReceipt,
  checkDeviceExecutionClaim,
  receiptProvesDeviceSideEffect,
} from "../../src/features/device-runtime/result-validator";
import { describeDeviceRuntimeBoundary } from "../../src/features/device-runtime/boundary";
import type {
  DeviceActionReceipt,
  DeviceSession,
} from "../../src/features/device-runtime/contracts";

const TENANT = "tenant-a";
const ORG = "org-a";

function baseRequest(capability: Parameters<typeof getCapabilityDescriptor>[0]) {
  return {
    capability,
    requestingWorkspace: "platform" as const,
    targetQuery: "my laptop",
    tenantId: TENANT,
    organizationId: ORG,
  };
}

/* --- 1. No fabricated devices ------------------------------------------------------- */
function noFabricatedDevices(): void {
  assert.deepEqual(listDevices(TENANT), [], "no devices registered");
  assert.deepEqual(listDevices("other-tenant"), []);
  assert.equal(isDeviceRuntimeConnected(), false);
  const status = deviceRuntimeStatus();
  assert.equal(status.connected, false);
  assert.equal(status.computerUseEnabled, false);
}

/* --- 2. Unknown device unavailable -------------------------------------------------- */
function unknownDeviceUnavailable(): void {
  assert.equal(getDevice("dev-x", TENANT), undefined);
  const target = resolveDeviceTarget({ query: "my laptop", tenantId: TENANT });
  assert.equal(target.state, "unavailable");
  assert.equal(target.deviceId, undefined, "no fabricated device id");
}

/* --- 3. Disconnected device blocks; nothing executes -------------------------------- */
function disconnectedBlocks(): void {
  const outcome = runDeviceAction(baseRequest("SCREEN_READ"));
  assert.equal(outcome.executed, false, "nothing executed");
  assert.equal(outcome.receipt.sideEffectOccurred, false);
  assert.notEqual(outcome.receipt.executionState, "SUCCESS");
  assert.equal(outcome.runtimeStatus.connected, false);
}

/* --- 4. Untrusted device blocks a sensitive capability ------------------------------ */
function untrustedBlocksSensitive(): void {
  const prepared = prepareDeviceAction(baseRequest("CAMERA_READ"));
  assert.equal(prepared.capabilityGate.trusted, false, "no trusted device");
  assert.equal(prepared.permissionRequirement.requiresHumanAuthorization, true);
  assert.equal(prepared.failureMode, "CAPABILITY_RESTRICTED");
}

/* --- 5. Tenant mismatch blocks ------------------------------------------------------ */
function tenantMismatchBlocks(): void {
  // A device would only ever be returned within its tenant; a cross-tenant lookup is undefined.
  assert.equal(getDevice("dev-x", "wrong-tenant"), undefined);
  const target = resolveDeviceTarget({ query: "dev-x", tenantId: "wrong-tenant" });
  assert.notEqual(target.state, "resolved");
}

/* --- 6. Session expiry / non-establishment blocks ----------------------------------- */
function sessionExpiryBlocks(): void {
  // No session at all.
  const none = validateDeviceSession({ session: undefined, tenantId: TENANT, capability: "SCREEN_READ" });
  assert.equal(none.valid, false);
  assert.equal(none.state, "not-established");

  // An active session past its lifetime.
  const expiring: DeviceSession = {
    sessionId: "s1", deviceId: "d1", tenantId: TENANT, organizationId: ORG,
    state: "active", capabilitySnapshot: ["SCREEN_READ"], authorityContext: "advisory-only",
    isolationScope: "scoped", expiresAtTick: 10, auditCorrelationId: "a1",
  };
  const expired = validateDeviceSession({ session: expiring, tenantId: TENANT, capability: "SCREEN_READ", nowTick: 100 });
  assert.equal(expired.valid, false, "elapsed lifetime blocks");
}

/* --- 7. Undeclared capability blocks (no device profile) ---------------------------- */
function undeclaredCapabilityBlocks(): void {
  const prepared = prepareDeviceAction(baseRequest("FILE_READ"));
  assert.equal(prepared.capabilityGate.capabilityDeclared, false, "no device declares it");
  assert.equal(prepared.capabilityGate.capabilityEnabled, false);
}

/* --- 8. Restricted capability blocks ------------------------------------------------ */
function restrictedCapabilityBlocks(): void {
  for (const cap of ["CAMERA_READ", "MICROPHONE_READ", "TERMINAL_COMMAND", "CLIPBOARD_READ"] as const) {
    const prepared = prepareDeviceAction(baseRequest(cap));
    assert.equal(prepared.failureMode, "CAPABILITY_RESTRICTED", `${cap} restricted`);
  }
}

/* --- 9. READ_ONLY device capability does not imply mutation ------------------------- */
function readOnlyIsNotMutation(): void {
  assert.equal(mapCapabilityToSideEffect("SCREEN_READ"), "READ_ONLY");
  const outcome = runDeviceAction(baseRequest("SCREEN_READ"));
  assert.equal(outcome.receipt.sideEffectOccurred, false);
  // A tampered read-only receipt claiming a side effect fails.
  const lying: DeviceActionReceipt = { ...outcome.receipt, sideEffectOccurred: true };
  assert.equal(validateDeviceReceipt(lying, outcome.prepared).valid, false);
}

/* --- 10. Device action requires Phase 17 eligibility (never eligible) --------------- */
function requiresPhase17Eligibility(): void {
  const prepared = prepareDeviceAction(baseRequest("SCREEN_READ"));
  // The Phase 17 backbone action is DEVICE_ACTION → not Phase-17-eligible.
  assert.equal(prepared.action.sideEffect, "DEVICE_ACTION");
  assert.equal(deviceExecutionEligible(prepared).eligible, false);
}

/* --- 11. Governance not-connected blocks a consequential device capability ---------- */
function governanceNotConnectedBlocks(): void {
  const prepared = prepareDeviceAction(baseRequest("FILE_WRITE"));
  // The device-action backbone requires governance that is not connected.
  assert.equal(prepared.action.governanceGate.evaluatorConnected, false);
  assert.equal(deviceExecutionEligible(prepared).eligible, false);
}

/* --- 12. Human review required for sensitive/consequential capabilities ------------- */
function humanReviewRequired(): void {
  for (const cap of ["FILE_WRITE", "CAMERA_READ", "KEYBOARD_INPUT", "CLIPBOARD_WRITE"] as const) {
    const prepared = prepareDeviceAction(baseRequest(cap));
    assert.equal(prepared.permissionRequirement.requiresHumanAuthorization, true, `${cap} needs human authorization`);
  }
}

/* --- 13 & 14. Camera + microphone restricted --------------------------------------- */
function cameraMicRestricted(): void {
  for (const cap of ["CAMERA_READ", "MICROPHONE_READ"] as const) {
    const d = getCapabilityDescriptor(cap);
    assert.equal(d.defaultState, "restricted");
    assert.equal(d.risk, "RESTRICTED");
    assert.equal(d.sideEffect, "DEVICE_ACTION");
    assert.equal(d.privacySensitive, true);
    const outcome = runDeviceAction(baseRequest(cap));
    assert.equal(outcome.executed, false);
    assert.equal(outcome.receipt.executionState, "CAPABILITY_RESTRICTED");
  }
}

/* --- 15. Terminal restricted / no generic shell ------------------------------------ */
function terminalRestricted(): void {
  const d = getCapabilityDescriptor("TERMINAL_COMMAND");
  assert.equal(d.defaultState, "restricted");
  assert.equal(d.risk, "RESTRICTED");
  const outcome = runDeviceAction(baseRequest("TERMINAL_COMMAND"));
  assert.equal(outcome.executed, false);
}

/* --- 18. External browser control restricted; internal navigation separate ---------- */
function browserExternalRestrictedInternalSeparate(): void {
  for (const cap of ["BROWSER_NAVIGATION", "BROWSER_INTERACTION"] as const) {
    assert.equal(getCapabilityDescriptor(cap).defaultState, "restricted");
  }
  const prepared = prepareDeviceAction(baseRequest("BROWSER_READ"));
  assert.equal(prepared.surface, "external-application", "device actions target external apps only");
  // Internal product navigation is a separate Phase 16 READ_ONLY tool and still works.
  const nav = invokeTool({ toolId: NAVIGATE_TOOL_ID, query: "governance" });
  assert.equal(nav.state, "SUCCESS");
  assert.equal(nav.sideEffectOccurred, false);
}

/* --- 20. Receipt identity mismatch fails ------------------------------------------- */
function receiptMismatchFails(): void {
  const outcome = runDeviceAction(baseRequest("SCREEN_READ"));
  const good = outcome.receipt;
  assert.equal(validateDeviceReceipt(good, outcome.prepared).valid, true);
  assert.equal(validateDeviceReceipt({ ...good, actionId: "act_ffffffff" }, outcome.prepared).valid, false);
  assert.equal(validateDeviceReceipt({ ...good, capability: "CAMERA_READ" }, outcome.prepared).valid, false);
}

/* --- 21. Fabricated device-execution claim rejected -------------------------------- */
function fabricatedClaimRejected(): void {
  const outcome = runDeviceAction(baseRequest("SCREEN_CAPTURE"));
  assert.equal(receiptProvesDeviceSideEffect(outcome.receipt), false);
  const claim = checkDeviceExecutionClaim("Heby opened the camera and captured the screen.", outcome.receipt);
  assert.equal(claim.safe, false);
  assert.ok(claim.offendingClaims.length >= 1);
  assert.equal(checkDeviceExecutionClaim("Heby explained the device runtime boundary.").safe, true);
  // A fabricated SUCCESS + side effect receipt fails validation (no runtime).
  const fake: DeviceActionReceipt = { ...outcome.receipt, executionState: "SUCCESS", sideEffectOccurred: true };
  assert.equal(validateDeviceReceipt(fake, outcome.prepared).valid, false);
}

/* --- 25. No secret exposure; credential surfaces withheld --------------------------- */
function noSecretExposure(): void {
  assert.ok(CREDENTIAL_SURFACES_WITHHELD.length > 0, "credential surfaces are named as withheld");
  // None of the device capabilities is a credential surface.
  const boundary = describeDeviceRuntimeBoundary();
  for (const row of boundary.capabilities) {
    assert.equal(/credential|password|keychain|token|secret/i.test(row.capability), false);
  }
}

/* --- 27. No cross-tenant target ----------------------------------------------------- */
function noCrossTenantTarget(): void {
  const target = resolveDeviceTarget({ query: "dev-x", tenantId: "attacker-tenant" });
  assert.notEqual(target.state, "resolved");
  assert.equal(target.deviceId, undefined);
}

/* --- 28. No capability escalation inside a session --------------------------------- */
function noCapabilityEscalation(): void {
  const session: DeviceSession = {
    sessionId: "s2", deviceId: "d2", tenantId: TENANT, organizationId: ORG,
    state: "active", capabilitySnapshot: ["SCREEN_READ"], authorityContext: "advisory-only",
    isolationScope: "scoped", auditCorrelationId: "a2",
  };
  // Requesting a capability outside the snapshot is escalation → invalid.
  const escalated = validateDeviceSession({ session, tenantId: TENANT, capability: "FILE_WRITE" });
  assert.equal(escalated.valid, false);
  assert.ok(escalated.reasons.some((r) => /snapshot/i.test(r)));
}

/* --- 29 & 30. Phase 17 + Phase 16 invariants preserved ------------------------------ */
function phaseInvariantsPreserved(): void {
  // Phase 17: the device backbone is a real prepared action, DEVICE_ACTION, RESTRICTED.
  const prepared = prepareDeviceAction(baseRequest("SCREEN_READ"));
  assert.equal(prepared.action.sideEffect, "DEVICE_ACTION");
  assert.equal(prepared.action.lifecycleState, "RESTRICTED");
  // Phase 16: only READ_ONLY tools are invokable, no side effect.
  for (const tool of invokableTools()) assert.equal(tool.sideEffect, "READ_ONLY");
}

/* --- Capability model + boundary are honest ---------------------------------------- */
function modelAndBoundaryHonest(): void {
  assert.deepEqual(validateCapabilityModel(), [], "capability model is internally honest");
  const boundary = describeDeviceRuntimeBoundary();
  assert.equal(boundary.runtimeConnected, false);
  assert.equal(boundary.deviceCount, 0);
  assert.deepEqual(boundary.devices, [], "no fabricated device listed");
  for (const row of boundary.capabilities) {
    assert.equal(row.executable, false, `${row.capability} not executable`);
    assert.ok(row.state === "unavailable" || row.state === "restricted");
  }
}

/* --- 16/17/22/23/24/26. No unsafe coupling (shell/fs/model/writes/automation) ------- */
function noUnsafeCoupling(): void {
  const dir = "src/features/device-runtime";
  const forbidden = [
    // model / network
    "openai", "anthropic", "gemini", "generativeai", "mistral", "cohere", "ollama",
    "fetch(", "xmlhttprequest", "websocket", "axios",
    // shell / process / eval
    "child_process", "execsync", "spawn(", "eval(", "process.env",
    // filesystem
    "fs.write", "fs.unlink", "fs.rm", "fs.rename", "writefilesync", "readfilesync",
    // camera / mic / input / screen APIs
    "getusermedia", "mediadevices", "getdisplaymedia", "document.execcommand", "robotjs",
    // browser automation
    "playwright", "puppeteer", "chromium", "webdriver",
    // the simulation provider must not be wired as a live runtime
    "providers/computer-use",
    // auto-writes to protected subsystems
    "features/memory", "features/enterprise-memory", "features/decision", "features/human-approval",
    "features/intelligence", "features/organizational-intelligence", "features/governance",
    "features/policy", "features/execution",
    // persistence
    ".insert(", "persist(", "drizzle",
  ];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".ts")) continue;
    const source = readFileSync(join(dir, file), "utf8").toLowerCase();
    for (const token of forbidden) {
      assert.equal(source.includes(token), false, `${file} must not reference "${token}"`);
    }
  }
}

noFabricatedDevices();
unknownDeviceUnavailable();
disconnectedBlocks();
untrustedBlocksSensitive();
tenantMismatchBlocks();
sessionExpiryBlocks();
undeclaredCapabilityBlocks();
restrictedCapabilityBlocks();
readOnlyIsNotMutation();
requiresPhase17Eligibility();
governanceNotConnectedBlocks();
humanReviewRequired();
cameraMicRestricted();
terminalRestricted();
browserExternalRestrictedInternalSeparate();
receiptMismatchFails();
fabricatedClaimRejected();
noSecretExposure();
noCrossTenantTarget();
noCapabilityEscalation();
phaseInvariantsPreserved();
modelAndBoundaryHonest();
noUnsafeCoupling();

console.log("device-runtime checks passed");
