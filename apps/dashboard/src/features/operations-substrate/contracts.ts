/*
 * operations-substrate/contracts.ts — read-only presentation contract for the Execution
 * Substrate surface (Hebun UI Phase 22C).
 *
 * Execution Substrate answers: "what infrastructure would actually have to exist for Hebun
 * to execute?" It is an architectural/runtime READINESS surface — NOT an execution console,
 * NOT a terminal, NOT Computer Use. It states the real execution stack, its gates, and what
 * is missing, from the real Phase 17/18 contracts. It fabricates no run, receipt, session,
 * device, terminal, or browser, and invents no "AUTHORIZED" state.
 */

/** Honest state of one execution-stack layer. */
export type LayerState =
  | "connected"
  | "contract-only"
  | "in-memory"
  | "not-connected"
  | "restricted"
  | "simulation-only"
  | "human-gated";

export interface ExecutionLayerView {
  readonly layer: string;
  readonly owner: string;
  readonly state: LayerState;
  /** Whether this layer is actually implemented as a connected runtime. */
  readonly implemented: boolean;
  readonly detail: string;
}

/** Honest status of one gate that stands between prepared and executed. */
export type GateStatus =
  | "satisfied"
  | "unmet"
  | "not-connected"
  | "not-required"
  | "requires-human-review"
  | "restricted";

export interface ExecutionGateView {
  readonly gate: string;
  readonly status: GateStatus;
  readonly detail: string;
}

export interface SubstrateModel {
  readonly state: { readonly headline: string; readonly detail: string };
  /** The real execution stack, each layer marked connected / contract-only / missing. */
  readonly layers: readonly ExecutionLayerView[];
  /** Why an action cannot execute — the real gate model. */
  readonly gates: readonly ExecutionGateView[];
  readonly computerUse: { readonly status: "simulation-only"; readonly detail: string };
  readonly terminal: { readonly capability: string; readonly state: string; readonly detail: string };
  /** What would have to become true before real execution could ever occur. */
  readonly requiredToExecute: readonly string[];
  readonly receiptBoundary: string;
}
