/*
 * device-runtime — Hebun UI Phase 18: Device Runtime + Computer Use FOUNDATION.
 *
 * The typed, contract-only foundation for device registration, device sessions, prepared device
 * actions, and the Device Runtime / Computer Use boundary. It does NOT turn Heby into a desktop
 * agent: there is no real device registry (it is empty), no session runtime, and no Computer Use
 * execution — the only Computer Use surface in the repository is an offline, simulation-only
 * planning provider. Every prepared device action is non-executable and honestly reports its
 * failure mode. The action backbone stays Phase 17 (a device action composes a HebyPreparedAction),
 * every capability maps onto a Phase 17 side-effect class, and camera, microphone, terminal,
 * generic shell, unrestricted filesystem, and external browser control remain restricted/not
 * implemented. Credential surfaces are always withheld.
 *
 * No model, network, provider SDK, shell, filesystem write, device input, screen capture, camera,
 * or microphone is introduced. Builds on @/features/heby-actions, @/features/heby-integration, and
 * @/features/heby-runtime without modifying them.
 */

export * from "./contracts";
export * from "./capabilities";
export * from "./registry";
export * from "./target-resolver";
export * from "./session";
export * from "./device-action";
export * from "./runtime";
export * from "./result-validator";
export * from "./boundary";
