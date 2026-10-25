/*
 * platform-overview/model.ts — the authoritative Platform Overview truth model (Hebun UI Phase 24B).
 *
 * Pure and static. It states what the offline provider SUBSTRATE is — descriptors, contracts, routing,
 * invocation and adapters — and that substrate connects nothing. Live, per-organization state (connections,
 * model connectivity, arming, execution) is NOT stated here: it is read on the surfaces that own it, which
 * this model only links to (PRODUCT-INTEGRATION-1). It fabricates no health, uptime, latency,
 * availability %, request/token/cost, or connection. The real, non-authoritative dependency availability (Executive Overview technical
 * sections) is rendered separately by the surface from `@/features/platform/workspace-model`.
 */

import type { PlatformOverviewModel } from "@/features/platform-overview/contracts";

export function getPlatformOverviewModel(): PlatformOverviewModel {
  return {
    state: {
      provenance: "contract-only",
      headline: "Provider substrate · contract-only",
      note:
        "Platform holds a deterministic, offline provider substrate: descriptors, contracts, routing, " +
        "invocation, and adapters. The substrate itself connects nothing and executes nothing. Live state " +
        "is read where it is owned: this organization's connections on Integrations; model connectivity, " +
        "external-send arming and recorded usage on Providers & Models; execution under Decisions and " +
        "Operations.",
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
        state: "external-authority",
        authorityOwner: "Platform",
        detail:
          "Registered model descriptors, the platform model connectivity switch, external-send arming " +
          "and recorded provider usage, read live on that page.",
        href: "/director/provider-matrix",
      },
      {
        area: "Integrations",
        state: "external-authority",
        authorityOwner: "Integration authority",
        detail:
          "This organization's provider connections and the capabilities each makes available, read live " +
          "for the signed-in organization on that page. Nothing about them is stated here.",
        href: "/integrations",
      },
      {
        area: "Provider / model execution",
        state: "external-authority",
        authorityOwner: "Operations",
        detail:
          "Model calls and approved external acts do not run through this substrate. Execution and runtime " +
          "observation are Operations' authority, under human decisions; Computer Use remains simulation-only.",
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
      { stage: "REGISTERED", reached: true, note: "Provider descriptors are registered in this substrate as offline contracts." },
      { stage: "CONFIGURED", reached: false, note: "No descriptor here is configured; substrate credentials are placeholders and ignored." },
      { stage: "CONNECTED", reached: false, note: "The substrate connects nothing; live connections are held by Integrations, not here." },
      { stage: "INVOKABLE", reached: false, note: "Invocation through this substrate is simulation-only." },
      { stage: "AUTHORIZED", reached: false, note: "Authorization is not a Platform runtime state — it belongs to Decisions and Operations." },
      { stage: "EXECUTED", reached: false, note: "Nothing executes through this substrate." },
      { stage: "SUCCESSFUL", reached: false, note: "This substrate produces no live result." },
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
