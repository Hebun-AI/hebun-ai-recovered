/*
 * platform-integrations/contracts.ts — read-only view-model contracts for the authoritative
 * Integrations surface (Hebun UI Phase 24C).
 *
 * There is no real integration feature — only a mock the honest surface excludes. What exists are
 * offline provider descriptors that COULD back an external integration. None is connected or
 * authenticated. It surfaces no fabricated connection state, sync timestamp, scope grant, event count,
 * or health, and offers no connect / authenticate / OAuth / secret control.
 */

export type IntegrationState = "descriptor-only" | "adapter-available" | "not-connected" | "auth-not-configured";

export interface IntegrationView {
  readonly id: string;
  readonly name: string;
  readonly providerType: string;
  readonly state: IntegrationState;
  readonly connectionState: string;
  readonly credentialStatus: string;
  readonly note: string;
}

export interface IntegrationsStateBanner {
  readonly provenance: "not-connected";
  readonly headline: string;
  readonly note: string;
}

export interface IntegrationsModel {
  readonly state: IntegrationsStateBanner;
  /** Provider descriptors that could back an integration — none connected. */
  readonly candidates: readonly IntegrationView[];
  /** Actually connected integrations. Always empty: none is authenticated. */
  readonly connected: readonly never[];
  readonly distinctions: readonly string[];
}
