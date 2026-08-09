/*
 * platform-integrations/model.ts — the authoritative Integrations truth model (Hebun UI Phase 24C).
 *
 * Reads the REAL offline provider catalog and surfaces the descriptors that could back an external
 * integration (repository, communication, browser). It deliberately EXCLUDES the integrations mock
 * (fabricated "Gmail connected / eventsToday 12 / Supabase connected"). Nothing is connected: every
 * descriptor is offline with placeholder credentials. The connected list is honestly empty.
 */

import { providerCatalog } from "@/features/provider-matrix/provider-catalog";
import type { IntegrationView, IntegrationsModel } from "@/features/platform-integrations/contracts";

// Provider descriptor types that represent an external integration surface (not model inference).
const INTEGRATION_TYPES = new Set(["Repository Provider", "Communication Provider", "Browser Provider"]);

export function getIntegrationsModel(): IntegrationsModel {
  const candidates: IntegrationView[] = providerCatalog
    .filter((entry) => INTEGRATION_TYPES.has(entry.providerType))
    .map((entry) => ({
      id: entry.id,
      name: entry.name,
      providerType: entry.providerType,
      state: "descriptor-only",
      // Proven from the catalog: liveSupport is false, so nothing is connected.
      connectionState: entry.liveSupport ? "Connected" : "Not connected",
      credentialStatus: entry.credentialStatus,
      note: "Offline descriptor. No adapter is authenticated and no credential is injected.",
    }));

  return {
    state: {
      provenance: "not-connected",
      headline: "No integration connected",
      note:
        "No external integration is connected or authenticated. The mock integration catalog (fabricated " +
        "connection state, sync times, scopes, and event counts) is excluded. Only offline provider " +
        "descriptors exist; none is configured or connected.",
    },
    candidates,
    connected: [],
    distinctions: [
      "A provider descriptor is not an authenticated integration.",
      "An adapter is not a connection.",
      "Credential placeholder is not a configured credential.",
      "No connected integration exists; the connected list is honestly empty.",
    ],
  };
}
