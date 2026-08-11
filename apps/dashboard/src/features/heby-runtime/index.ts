/*
 * heby-runtime — Hebun UI Phase 16.
 *
 * The typed, deterministic Heby runtime: resolves real (non-authoritative) sources,
 * assembles evidence, builds validated bounded responses, and gates the first SAFE
 * (read-only) tool use. No model runtime exists in this repository, so generative answers
 * are honestly unavailable and the model boundary reports UNAVAILABLE — model output, when
 * ever connected, stays untrusted and validated. No fabricated response, evidence, or tool
 * result; no memory/decision/execution write; no device runtime; no shell; no secret.
 * Builds on @/features/heby-integration and @/features/heby-core without modifying them.
 */

export * from "./contracts";
export * from "./model-adapter";
export * from "./source-resolver";
export * from "./evidence-assembler";
export * from "./navigate-tool";
export * from "./tool-registry";
export * from "./tool-gate";
export * from "./response-builder";
export * from "./response-validator";
export * from "./prompt-validation";
export * from "./runtime";
