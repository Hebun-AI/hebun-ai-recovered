/*
 * platform-infrastructure/contracts.ts — read-only view-model contracts for the authoritative
 * Infrastructure & Settings surface (Hebun UI Phase 24C).
 *
 * Exposes only actual Platform configuration / runtime infrastructure truth. Persistence is in-memory;
 * no durable configuration store exists; no credential is injected; secret values are never displayed.
 * It fabricates no CPU, memory, uptime, region, node count, latency, availability, or deployment status,
 * and offers no secret-mutation control. Authentication authority is external, not absorbed by Platform.
 */

export type InfraState = "contract-only" | "in-memory" | "not-connected" | "external-authority" | "structural";

export interface InfraAreaView {
  readonly area: string;
  readonly state: InfraState;
  readonly authorityOwner: string;
  readonly detail: string;
}

export interface InfraStateBanner {
  readonly provenance: "in-memory";
  readonly headline: string;
  readonly note: string;
}

export interface InfrastructureModel {
  readonly state: InfraStateBanner;
  readonly areas: readonly InfraAreaView[];
  /** Count of registered offline adapters — structural, not a health metric. */
  readonly adapterRegistryCount: number;
  readonly secretsBoundary: string;
  readonly distinctions: readonly string[];
}
