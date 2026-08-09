/*
 * operations-execution/contracts.ts — read-only presentation contract for the
 * Execution surface (Hebun UI Phase 22B).
 *
 * The Execution surface distinguishes EXECUTION ACTIVITY (what has run — nothing) from
 * EXECUTION CAPABILITY (what could run — only READ_ONLY, everything else non-executable).
 * It is READ-ONLY: no execution/mock, no fabricated run / receipt / timestamp / status,
 * and no run / retry / kill / execute controls. All capability facts are sourced from the
 * real Phase 17 action registry and Phase 18 device capabilities.
 */

import type { ToolSideEffectClass } from "@/features/heby-runtime";

/** Honest status of a side-effect class in the current runtime. */
export type ExecutionCapabilityStatus =
  /** Connected substrate + READ_ONLY — the only invokable class. */
  | "available"
  /** Prepared/described only; produces no side effect. */
  | "prepared-only"
  /** Contract exists, no substrate connected. */
  | "not-connected"
  /** Would require a human authority before it could ever run. */
  | "requires-human-review"
  /** Deliberately restricted / not implemented. */
  | "restricted";

export interface ExecutionCapabilityRow {
  readonly sideEffect: ToolSideEffectClass;
  readonly label: string;
  readonly status: ExecutionCapabilityStatus;
  /** Real registry fact: whether a runtime is connected for this class. */
  readonly substrateConnected: boolean;
  readonly detail: string;
}

/** A real Phase 18 device capability and its honest default state. */
export interface ExecutionDeviceRow {
  readonly capability: string;
  readonly sideEffect: ToolSideEffectClass;
  readonly state: string;
  readonly describes: string;
}

/** One stage of the real authority chain (separation preserved; no invented "AUTHORIZED"). */
export interface AuthorityStageView {
  readonly stage: string;
  readonly owner: string;
  readonly detail: string;
  /** Whether a side effect has actually occurred by this stage. */
  readonly sideEffectOccurred: boolean;
}

export interface ExecutionSurfaceModel {
  /** Honest execution-substrate state. */
  readonly state: { readonly headline: string; readonly detail: string };
  /** Execution activity — always absent; nothing has run. */
  readonly activity: { readonly present: false; readonly note: string };
  /** Capability matrix by side-effect class (from the real action registry). */
  readonly capabilities: readonly ExecutionCapabilityRow[];
  /** Device capabilities (from the real Phase 18 device runtime). */
  readonly deviceCapabilities: readonly ExecutionDeviceRow[];
  /** Computer Use is simulation-only. */
  readonly computerUse: { readonly status: "simulation-only"; readonly detail: string };
  /** The prepared→executed authority chain (real vocabulary). */
  readonly authorityChain: readonly AuthorityStageView[];
  /** Receipts — always absent; no live execution occurred. */
  readonly receipts: { readonly present: false; readonly note: string };
}
