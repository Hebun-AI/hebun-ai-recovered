/*
 * platform-runtime/contracts.ts — read-only view-model contracts for the authoritative
 * Provider Runtime surface (Hebun UI Phase 24C).
 *
 * Answers "what provider runtime machinery exists, and how far can an invocation actually progress?"
 * The whole substrate is offline: routing decides but does not dispatch; invocation prepares but does
 * not invoke; adapters exist but authenticate nothing. It surfaces real structure only — never a
 * fabricated request count, latency, token, cost, success rate, receipt, or real invocation activity.
 */

export type RuntimeStageState = "contract-only" | "simulation" | "not-connected" | "external-authority";

export interface RuntimeStageView {
  readonly stage: string;
  readonly state: RuntimeStageState;
  readonly note: string;
}

/** One real, ordered step of the offline invocation pipeline (descriptive contract only). */
export interface RuntimePipelineStep {
  readonly order: number;
  readonly label: string;
  readonly description: string;
}

export interface RuntimeLiveEligibilityView {
  readonly provider: string;
  readonly mode: string;
  readonly liveEligible: boolean;
  readonly credentialStatus: string;
  readonly blockingReasons: readonly string[];
}

/** Real executed-invocation activity. Always empty: nothing runs offline. */
export interface RuntimeActivityView {
  readonly realInvocations: number;
  readonly note: string;
}

export interface ProviderExecutionStep {
  readonly stage: string;
  readonly reached: boolean;
  readonly note: string;
}

export interface ProviderRuntimeStateBanner {
  readonly provenance: "offline-contract";
  readonly headline: string;
  readonly note: string;
}

export interface ProviderRuntimeModel {
  readonly state: ProviderRuntimeStateBanner;
  readonly stages: readonly RuntimeStageView[];
  readonly pipeline: readonly RuntimePipelineStep[];
  readonly liveEligibility: RuntimeLiveEligibilityView;
  readonly activity: RuntimeActivityView;
  readonly executionBoundary: readonly ProviderExecutionStep[];
  readonly routingTruth: string;
  readonly invocationTruth: string;
  readonly distinctions: readonly string[];
}
