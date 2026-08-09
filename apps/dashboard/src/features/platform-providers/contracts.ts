/*
 * platform-providers/contracts.ts — read-only view-model contracts for the authoritative
 * Providers & Models surface (Hebun UI Phase 24B).
 *
 * Surfaces only facts the provider substrate proves: name, type, declared capabilities, execution
 * mode, credential status, connection state. It NEVER surfaces the fabricated per-provider health
 * (static availability/latency), conformance score, aggregate "health %", token/cost estimates, or a
 * connection that does not exist. A descriptor is not a connection; simulation is not execution.
 */

import type { MatrixCapability, PriorityTier } from "@/features/provider-matrix/types";

export interface ProviderView {
  readonly id: string;
  readonly name: string;
  readonly family: string;
  readonly providerType: string;
  readonly executionMode: string;
  readonly simulationSupport: boolean;
  readonly liveSupport: boolean;
  readonly connectionState: string;
  readonly credentialStatus: string;
  readonly priority: PriorityTier;
  readonly primaryCapabilities: readonly MatrixCapability[];
  readonly secondaryCapabilities: readonly MatrixCapability[];
}

/** A "future live" provider scaffold whose blocked state is proven by the real eligibility engine. */
export interface FutureLiveProviderView {
  readonly name: string;
  readonly mode: string;
  readonly liveEligible: boolean;
  readonly credentialStatus: string;
  readonly blockingReasons: readonly string[];
  readonly note: string;
}

/** Structural capability coverage — how the matrix is covered, not a health metric. */
export interface CapabilityCoverageView {
  readonly capability: MatrixCapability;
  readonly status: "covered" | "partial" | "missing";
  readonly providerCount: number;
  readonly note: string;
}

export interface CoverageSummary {
  readonly total: number;
  readonly covered: number;
  readonly partial: number;
  readonly missing: number;
}

export interface FutureDomainView {
  readonly domain: string;
  readonly note: string;
}

export interface ProvidersStateBanner {
  readonly provenance: "offline-simulation";
  readonly headline: string;
  readonly note: string;
}

export interface ProvidersModel {
  readonly state: ProvidersStateBanner;
  readonly providers: readonly ProviderView[];
  readonly futureLive: FutureLiveProviderView;
  readonly coverage: CoverageSummary;
  readonly capabilityCoverage: readonly CapabilityCoverageView[];
  readonly futureDomains: readonly FutureDomainView[];
  readonly distinctions: readonly string[];
}
