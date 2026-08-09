/*
 * operations-overview/contracts.ts — read-only presentation contract for the
 * Operations Overview truth surface (Hebun UI Phase 22B).
 *
 * Operations Overview answers: "what operational state can Hebun actually observe
 * today?" It is READ-ONLY and states honest availability only. It never renders an
 * aggregate Operations Health %, uptime, success rate, or any fabricated run / queue
 * / incident / agent / workflow count. Every value is a structural fact or an honest
 * availability state derived from real contracts.
 */

/** Honest availability of one operational subsystem. None is a score. */
export type OperationalStatus =
  /** A real runtime is connected (may still hold nothing). */
  | "connected"
  /** Real but a derived, non-authoritative projection. */
  | "derived"
  /** Real but structurally empty — no records exist. */
  | "empty"
  /** A seeded, non-authoritative simulation. */
  | "seeded"
  /** Simulation-only; no real substrate. */
  | "simulated"
  /** A contract exists, but no substrate is connected. */
  | "not-connected"
  /** Deliberately restricted / not implemented. */
  | "restricted"
  /** In-memory only; nothing is persisted. */
  | "in-memory";

export interface OperationalAreaView {
  readonly area: string;
  readonly question: string;
  readonly status: OperationalStatus;
  readonly detail: string;
  /** Drill-through to the owning surface, when one exists. */
  readonly href?: string;
}

/** The prepared→executed boundary, summarized from the REAL action registry. */
export interface ExecutionBoundaryView {
  /** Total declared action tools (real registry count). */
  readonly declared: number;
  /** Tools actually invokable — READ_ONLY with a connected substrate (real count). */
  readonly invokable: number;
  /** Tools that are non-executable here (declared − invokable). */
  readonly nonExecutable: number;
  readonly summary: readonly string[];
}

export interface OperationsOverviewModel {
  readonly availability: readonly OperationalAreaView[];
  readonly executionBoundary: ExecutionBoundaryView;
  /** Honest note about operational signals — never fabricated sample alerts/events. */
  readonly signalsNote: string;
}
