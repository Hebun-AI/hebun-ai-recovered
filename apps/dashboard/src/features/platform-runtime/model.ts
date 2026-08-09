/*
 * platform-runtime/model.ts — the authoritative Provider Runtime truth model (Hebun UI Phase 24C).
 *
 * Reads the REAL offline provider runtime substrate:
 *   - invocationPipeline (the 13-step descriptive invocation contract; no step executes);
 *   - evaluateClaudeLiveEligibility() (the real live-eligibility gate result).
 *
 * It surfaces the pipeline structure and the eligibility truth, and states honestly that no real
 * invocation has occurred — the seeded/simulated invocation records are NOT presented as activity.
 * It fabricates no request count, latency, token, cost, success rate, receipt, or invocation health.
 */

import { invocationPipeline } from "@/features/provider-invocation/invocation-contract";
import { evaluateClaudeLiveEligibility } from "@/features/providers/claude-live";
import type { ProviderRuntimeModel } from "@/features/platform-runtime/contracts";

export function getProviderRuntimeModel(): ProviderRuntimeModel {
  const eligibility = evaluateClaudeLiveEligibility();

  return {
    state: {
      provenance: "offline-contract",
      headline: "Offline · contract-only · not connected",
      note:
        "The provider runtime machinery is real but offline. A routing decision is computed but never " +
        "dispatched; an invocation is prepared and validated but never invoked; adapters are registered " +
        "but authenticate nothing. No provider can perform a real external invocation.",
    },
    stages: [
      { stage: "Provider descriptor", state: "contract-only", note: "A registered offline descriptor declares type, capabilities, and execution mode." },
      { stage: "Eligibility", state: "contract-only", note: "Deterministic gates decide whether live execution could ever be attempted." },
      { stage: "Routing", state: "contract-only", note: "The routing engine selects a provider structurally. A routing decision is not a dispatch." },
      { stage: "Invocation contract", state: "simulation", note: "A valid decision is turned into a prepared invocation. Preparation is not invocation." },
      { stage: "Adapter", state: "simulation", note: "An adapter is referenced from the registry. An adapter is not an authenticated integration." },
      { stage: "Credential requirement", state: "not-connected", note: "Credentials are placeholders and are ignored; none is injected." },
      { stage: "Execution boundary", state: "external-authority", note: "Execution is Operations' authority; the boundary is not crossed here." },
      { stage: "Provider response", state: "simulation", note: "Only an expected/simulated response shape is produced. No live response exists." },
    ],
    pipeline: invocationPipeline.map((step) => ({ order: step.order, label: step.label, description: step.description })),
    liveEligibility: {
      provider: "Claude (Live)",
      mode: eligibility.mode,
      liveEligible: eligibility.liveEligible,
      credentialStatus: eligibility.credentialStatus,
      blockingReasons: eligibility.reasons,
    },
    activity: {
      realInvocations: 0,
      note:
        "No real provider invocation has occurred — the substrate is offline. Prepared invocations exist " +
        "only as offline simulation contracts; they are not execution activity and carry no real latency, " +
        "token, cost, or receipt.",
    },
    executionBoundary: [
      { stage: "REGISTERED", reached: true, note: "Provider descriptors are registered." },
      { stage: "ROUTED", reached: true, note: "A routing decision can be computed structurally." },
      { stage: "PREPARED", reached: true, note: "An invocation contract can be prepared and validated offline." },
      { stage: "CONNECTED", reached: false, note: "No provider is connected; the substrate is offline." },
      { stage: "INVOKED", reached: false, note: "No live invocation path exists; invocation is simulation-only." },
      { stage: "EXECUTED", reached: false, note: "Nothing has executed — execution is Operations' authority." },
      { stage: "SUCCESSFUL", reached: false, note: "No live result exists." },
    ],
    routingTruth: "The routing engine determines the primary provider, fallbacks, and approval need for a capability. A routing decision is a plan, not a network dispatch.",
    invocationTruth: "The invocation framework prepares, validates, and simulates an invocation contract. An invocation contract is not a live invocation.",
    distinctions: [
      "A routing decision is not a provider dispatch.",
      "An invocation contract is not a live invocation.",
      "A prepared invocation is not an executed invocation.",
      "An adapter is not an authenticated integration.",
      "Simulation is not execution.",
      "Platform owns provider/runtime configuration and contract machinery; Operations owns execution and runtime observation.",
    ],
  };
}
