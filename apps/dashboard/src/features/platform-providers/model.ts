/*
 * platform-providers/model.ts — the authoritative Providers & Models truth model (Hebun UI Phase 24B).
 *
 * Reads the REAL deterministic-offline provider substrate:
 *   - providerCatalog (by reference) for the six registered provider descriptors;
 *   - capabilityGaps / futureProviders for structural capability coverage;
 *   - evaluateClaudeLiveEligibility() for the "future live" provider's proven blocked state.
 *
 * It deliberately DROPS the fabricated fields the substrate also carries — per-provider health
 * (static availability/latency), conformance score, aggregate network "health %", and every
 * token/cost/latency estimate — because none is a real measurement. No provider is shown as
 * connected; every one is an offline descriptor with liveSupport === false.
 */

import { providerCatalog } from "@/features/provider-matrix/provider-catalog";
import { capabilityGaps, futureProviders } from "@/features/provider-matrix/provider-gaps";
import { evaluateClaudeLiveEligibility } from "@/features/providers/claude-live";
import type {
  CapabilityCoverageView,
  CoverageSummary,
  ProvidersModel,
  ProviderView,
} from "@/features/platform-providers/contracts";

function toProviderView(entry: (typeof providerCatalog)[number]): ProviderView {
  return {
    id: entry.id,
    name: entry.name,
    family: entry.family,
    providerType: entry.providerType,
    executionMode: entry.executionMode,
    simulationSupport: entry.simulationSupport,
    liveSupport: entry.liveSupport,
    // Proven, not fabricated: liveSupport is hard-false across the catalog and there is no SDK.
    connectionState: entry.liveSupport ? "Connected" : "Not connected · offline",
    credentialStatus: entry.credentialStatus,
    priority: entry.priority,
    primaryCapabilities: entry.primaryCapabilities,
    secondaryCapabilities: entry.secondaryCapabilities,
  };
}

export function getProvidersModel(): ProvidersModel {
  const providers = providerCatalog.map(toProviderView);

  const capabilityCoverage: CapabilityCoverageView[] = capabilityGaps.map((gap) => ({
    capability: gap.capability,
    status: gap.status,
    providerCount: gap.providerCount,
    note: gap.note,
  }));

  const coverage: CoverageSummary = {
    total: capabilityCoverage.length,
    covered: capabilityCoverage.filter((c) => c.status === "covered").length,
    partial: capabilityCoverage.filter((c) => c.status === "partial").length,
    missing: capabilityCoverage.filter((c) => c.status === "missing").length,
  };

  const eligibility = evaluateClaudeLiveEligibility();

  return {
    state: {
      provenance: "offline-simulation",
      headline: "Offline · simulation",
      note:
        "Every provider is a registered offline descriptor. None is configured or connected: there is " +
        "no live model SDK, no network dispatch, and credentials are placeholders. Execution modes are " +
        "simulation-first; live support is false across the catalog.",
    },
    providers,
    futureLive: {
      name: "Claude (Live)",
      mode: eligibility.mode,
      liveEligible: eligibility.liveEligible,
      credentialStatus: eligibility.credentialStatus,
      blockingReasons: eligibility.reasons,
      note:
        "A future-live provider scaffold. Its state is computed by the real eligibility engine; live " +
        "execution stays blocked and a simulation fallback is mandatory. The descriptor is not a connection.",
    },
    coverage,
    capabilityCoverage,
    futureDomains: futureProviders.map((f) => ({ domain: f.domain, note: f.note })),
    distinctions: [
      "A provider descriptor is not a provider connection.",
      "A model declaration is not a model loaded.",
      "A routing contract is not a network dispatch.",
      "An invocation contract is not a live invocation.",
      "An adapter is not an authenticated integration.",
      "Simulation is not execution.",
      "A Computer Use descriptor is not a Computer Use runtime.",
      "Provider presence is not provider health.",
      "No error is not healthy; no invocation is not unavailable — only the connection state proves it.",
    ],
  };
}
