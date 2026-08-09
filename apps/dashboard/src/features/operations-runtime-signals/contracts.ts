/*
 * operations-runtime-signals/contracts.ts — read-only presentation contract for the
 * Runtime & Signals surface (Hebun UI Phase 22C).
 *
 * Runtime & Signals answers: "what does Hebun's runtime actually observe about itself?"
 * It is READ-ONLY and states honest observation truth: real signal sources with their
 * backing/authority/connection state, and an honest surfaced-signals state (empty is
 * valid). It fabricates no alert, incident, failure, event history, timestamp, count, or
 * provenance, and keeps signal ≠ alert ≠ incident ≠ failure explicit.
 */

/** Honest connection state of a runtime observation source. */
export type RuntimeConnectionState =
  | "connected"
  | "derived"
  | "empty"
  | "partial"
  | "unavailable"
  | "not-connected";

export interface RuntimeSignalSource {
  readonly source: string;
  readonly backing: string;
  readonly authority: string;
  readonly connection: RuntimeConnectionState;
  readonly derived: boolean;
  readonly limitations: string;
}

/** One explicit distinction the monitoring boundary keeps (left is not right). */
export interface MonitoringDistinction {
  readonly left: string;
  readonly right: string;
  readonly note: string;
}

export interface RuntimeSignalsModel {
  readonly observation: { readonly state: RuntimeConnectionState; readonly detail: string };
  readonly sources: readonly RuntimeSignalSource[];
  /** Surfaced signals — honest empty; a live feed is not surfaced. */
  readonly surfacedSignals: { readonly present: false; readonly note: string };
  readonly monitoringBoundary: readonly MonitoringDistinction[];
  readonly provenanceNote: string;
}
