/*
 * heby-actions — Hebun UI Phase 17: Action Preparation + Controlled Tool Execution.
 *
 * The typed, deterministic action lifecycle that lets Heby PREPARE, PROPOSE, and ROUTE
 * consequential work without ever silently authorizing or executing it. Heby may understand,
 * explain, prepare, propose, and route; it must not silently authorize or execute — the Director
 * (or an authorized human) remains the decision boundary. Prepared ≠ authorized ≠ executed, and
 * eligible ≠ executed.
 *
 * Only READ_ONLY actions are actually invokable (delegating to the Phase 16 gate); every mutation
 * stays honestly non-executable — its requirements reported as unmet/not-connected, never faked.
 * No model, network, provider, shell, filesystem, device, secret, wall-clock timestamp, or actor
 * identity is introduced. Builds on @/features/heby-runtime, @/features/heby-integration, and
 * @/features/heby-core without modifying them.
 */

export * from "./contracts";
export * from "./action-registry";
export * from "./arguments";
export * from "./capability-gate";
export * from "./governance-gate";
export * from "./authority-gate";
export * from "./action-preparer";
export * from "./eligibility";
export * from "./execution-gate";
export * from "./result-validator";
export * from "./runtime";
export * from "./boundary";
