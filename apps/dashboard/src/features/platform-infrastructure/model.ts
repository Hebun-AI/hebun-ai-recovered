/*
 * platform-infrastructure/model.ts — the authoritative Infrastructure & Settings truth model
 * (Hebun UI Phase 24C).
 *
 * Reads the REAL adapter registry (a structural count) and states honest platform infrastructure
 * truth: persistence is in-memory and non-durable, no durable configuration store exists, no provider
 * is configured, no integration is connected, authentication authority is external, and no credential
 * is injected. It replaces the fabricated Settings "API Keys: configured" rows. Secret values are
 * never read or displayed. It fabricates no CPU/memory/uptime/region/node/latency/deployment metric.
 */

import { adapterRecords } from "@/features/adapters";
import type { InfrastructureModel } from "@/features/platform-infrastructure/contracts";

export function getInfrastructureModel(): InfrastructureModel {
  return {
    state: {
      provenance: "in-memory",
      headline: "In-memory · no durable configuration store",
      note:
        "Platform runs on an in-memory persistence provider: structurally empty and non-durable. There " +
        "is no durable platform configuration store, no configured provider, and no connected integration. " +
        "No credential is injected, and secret values are never displayed.",
    },
    areas: [
      { area: "Runtime boundary", state: "contract-only", authorityOwner: "Platform", detail: "A deterministic runtime-boundary engine exists offline. It gates provider crossing; nothing crosses." },
      { area: "Persistence", state: "in-memory", authorityOwner: "Platform", detail: "The active persistence provider is in-memory — structurally empty and non-durable." },
      { area: "Adapter registry", state: "structural", authorityOwner: "Platform", detail: "Offline adapters are registered as a structural registry. No adapter authenticates anything." },
      { area: "Provider configuration", state: "not-connected", authorityOwner: "Platform", detail: "No provider is configured; credentials are placeholders and are ignored." },
      { area: "Integration configuration", state: "not-connected", authorityOwner: "Platform", detail: "No integration is connected or authenticated." },
      { area: "Authentication", state: "external-authority", authorityOwner: "Auth", detail: "Authentication/identity authority is external to Platform; Platform does not own or store identity." },
      { area: "Secrets", state: "not-connected", authorityOwner: "Platform", detail: "No secret or credential is injected. Secret values are never read or rendered." },
      { area: "Environment / runtime state", state: "contract-only", authorityOwner: "Platform", detail: "The environment is offline; no live infrastructure health, region, or deployment status exists." },
    ],
    adapterRegistryCount: adapterRecords.length,
    secretsBoundary:
      "Platform never displays a secret value and offers no secret-entry, key-rotation, or credential-mutation control. Credential state is a status label only — never a value.",
    distinctions: [
      "An adapter registry is not a connected runtime.",
      "In-memory is not durable.",
      "A credential status is not a credential value.",
      "Configured is not connected; available code is not an available runtime.",
      "Platform holds technical configuration; it does not own authentication, execution, policy, or memory.",
    ],
  };
}
