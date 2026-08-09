/*
 * platform-overview/model.ts — the authoritative Platform Overview truth model (Hebun UI Phase 24B).
 *
 * Pure and static. It states what platform capability exists and what is actually connected — nothing
 * is connected or live. It fabricates no health, uptime, latency, availability %, request/token/cost,
 * or connection. The real, non-authoritative dependency availability (Executive Overview technical
 * sections) is rendered separately by the surface from `@/features/platform/workspace-model`.
 */

import type { PlatformOverviewModel } from "@/features/platform-overview/contracts";

export function getPlatformOverviewModel(): PlatformOverviewModel {
  return {
    state: {
      provenance: "contract-only",
      headline: "Contract-only · offline",
      note:
        "Platform holds a real, deterministic, offline provider substrate: descriptors, contracts, " +
        "routing, invocation, and adapters. Nothing is connected. There is no live model SDK, no " +
        "network dispatch, and no configured credential. Persistence is in-memory. Platform describes " +
        "and configures capability; it does not execute it.",
    },
    availability: [
      {
        area: "Provider framework",
        state: "contract-only",
        authorityOwner: "Platform",
        detail:
          "Deterministic offline framework: provider registry, contracts, capability mapping, " +
          "validation, conformance, and simulation. No network, SDK, or credentials.",
      },
      {
        area: "Provider contracts",
        state: "contract-only",
        authorityOwner: "Platform",
        detail: "Config, capability, and conformance contracts. Declarations only — not a connection.",
      },
      {
        area: "Provider routing",
        state: "contract-only",
        authorityOwner: "Platform",
        detail: "Deterministic routing decisions over the capability matrix. No network dispatch occurs.",
      },
      {
        area: "Provider invocation",
        state: "simulation",
        authorityOwner: "Platform",
        detail:
          "Offline invocation engine: valid contracts reach a Ready state; no real invocation is ever " +
          "executed. Simulation, not execution.",
      },
      {
        area: "Adapters",
        state: "simulation",
        authorityOwner: "Platform",
        detail: "Adapter registry and simulation harness. No authenticated integration is established.",
      },
      {
        area: "Providers & Models",
        state: "not-connected",
        authorityOwner: "Platform",
        detail:
          "Six providers are registered as offline descriptors; none is configured or connected. " +
          "No live model is loaded.",
        href: "/director/provider-matrix",
      },
      {
        area: "Integrations",
        state: "not-connected",
        authorityOwner: "Platform",
        detail: "No external integration is configured or connected. The mock integration catalog is excluded.",
        href: "/integrations",
      },
      {
        area: "Persistence",
        state: "in-memory",
        authorityOwner: "Platform",
        detail: "The active persistence provider is in-memory: structurally empty and non-durable.",
      },
      {
        area: "Provider / model execution",
        state: "not-connected",
        authorityOwner: "Operations",
        detail:
          "No live model invocation exists (no SDK, no network). Execution and runtime observation are " +
          "Operations' authority; Computer Use remains simulation-only.",
      },
      {
        area: "Heby platform access",
        state: "advisory",
        authorityOwner: "Heby",
        detail: "Platform inspection only. Heby may explain platform state; it changes nothing.",
      },
    ],
    authorityBoundaries: [
      { concept: "Provider / model / tool configuration", owner: "Platform", note: "Descriptors, contracts, routing, adapters — configuration, not execution." },
      { concept: "Execution & runtime observation", owner: "Operations", note: "What runs and what the runtime observes — not Platform." },
      { concept: "Human approval / decisions", owner: "Decisions", note: "Human authority lives at /approvals, not Platform." },
      { concept: "Policy, rules, compliance", owner: "Governance", note: "Guardrails are evaluated in Governance, not Platform." },
      { concept: "AI agents & workforce", owner: "Workforce", note: "Agent definitions are Workforce, not Platform." },
      { concept: "Organizational memory & knowledge", owner: "Knowledge", note: "The settled record is Knowledge, not Platform." },
    ],
    executionBoundary: [
      { stage: "REGISTERED", reached: true, note: "Provider descriptors are registered as offline contracts." },
      { stage: "CONFIGURED", reached: false, note: "No provider is configured; credentials are placeholders and ignored." },
      { stage: "CONNECTED", reached: false, note: "No provider is connected; the substrate is offline with no network." },
      { stage: "INVOKABLE", reached: false, note: "No live invocation path exists; invocation is simulation-only." },
      { stage: "AUTHORIZED", reached: false, note: "Authorization is not a Platform runtime state — it belongs to Decisions and Operations." },
      { stage: "EXECUTED", reached: false, note: "Nothing has executed." },
      { stage: "SUCCESSFUL", reached: false, note: "No live result exists." },
    ],
    heby: {
      mode: "platform-inspection",
      state: "contract-only",
      mayInspect: ["Provider and model capability", "Contract and routing structure", "Connection and execution state", "Gaps and future-provider needs"],
      mayNot: [
        "Add or register a provider",
        "Modify or inject credentials",
        "Enable or load a model",
        "Rotate a key",
        "Connect a service or integration",
        "Invoke a model",
        "Activate Computer Use",
      ],
    },
    distinctions: [
      "Registered is not configured; configured is not connected; connected is not invokable.",
      "A provider descriptor is not a provider connection.",
      "A contract is not a connected runtime.",
      "Simulation is not execution.",
      "Platform configures capability; Operations executes and observes it.",
      "No aggregate Platform health is claimed — there is no live signal to aggregate.",
    ],
  };
}
