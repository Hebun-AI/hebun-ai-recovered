/*
 * platform-overview/contracts.ts — read-only view-model contracts for the authoritative
 * Platform Overview (Hebun UI Phase 24B).
 *
 * Platform describes and configures provider/model/tool capability. It does not execute, connect,
 * invoke, authorize, or hold live results. Every state below is honest: a contract/offline/simulation/
 * not-connected/in-memory/advisory fact proven by the provider substrate, never a fabricated health,
 * uptime, latency, availability %, or connection.
 */

export type PlatformAvailabilityState =
  | "contract-only"
  | "offline"
  | "simulation"
  | "not-connected"
  | "in-memory"
  | "advisory"
  | "external-authority";

export interface PlatformStateBanner {
  /** The whole workspace is contract/offline — nothing is connected or live. */
  readonly provenance: "contract-only";
  readonly headline: string;
  readonly note: string;
}

/** One row of the platform substrate availability map. */
export interface PlatformAvailabilityArea {
  readonly area: string;
  readonly state: PlatformAvailabilityState;
  readonly authorityOwner: string;
  readonly detail: string;
  readonly href?: string;
}

/** Who authoritatively owns a concept that touches Platform. */
export interface PlatformAuthorityBoundary {
  readonly concept: string;
  readonly owner: string;
  readonly note: string;
}

/** One rung of the provider execution ladder. `reached` is proven from the substrate. */
export interface ProviderExecutionStep {
  readonly stage: string;
  readonly reached: boolean;
  readonly note: string;
}

/** The real Platform Heby profile — inspection only. */
export interface PlatformHebyBoundary {
  readonly mode: string;
  readonly state: string;
  readonly mayInspect: readonly string[];
  readonly mayNot: readonly string[];
}

export interface PlatformOverviewModel {
  readonly state: PlatformStateBanner;
  readonly availability: readonly PlatformAvailabilityArea[];
  readonly authorityBoundaries: readonly PlatformAuthorityBoundary[];
  readonly executionBoundary: readonly ProviderExecutionStep[];
  readonly heby: PlatformHebyBoundary;
  readonly distinctions: readonly string[];
}
