/*
 * heby-integration — Hebun UI Phase 15.
 *
 * The typed context/request/response architecture that turns Heby from an ambient UI
 * affordance into Hebun's shared intelligence interface. Contracts and boundary only:
 * no model, provider, tool, or device is called; no answer, evidence, provenance, or
 * context is fabricated; no approval, execution, or policy mutation occurs; the Director
 * remains the authority boundary. Builds on the immutable Heby Core Phase 1–9 contracts
 * without modifying them.
 */

export * from "./contracts";
export * from "./request-response";
export * from "./future-boundaries";
export * from "./workspace-registry";
export * from "./panel-model";
