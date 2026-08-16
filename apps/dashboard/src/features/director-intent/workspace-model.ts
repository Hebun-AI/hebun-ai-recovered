/*
 * director-intent/workspace-model.ts — the read model for Command · Director Intent
 * (Hebun UI Phase 20B). Formerly the "Command Console" concept (Phase 20A decision D1).
 *
 * PROVENANCE CONTRACT (no-fake-data, Phase 20A honesty rules):
 *
 *   Director Intent answers: "What do I want Hebun to investigate, prepare, or change?"
 *   It is NOT a shell, NOT a terminal, NOT direct execution, and NOT free-text-to-execution.
 *
 *   The only real substrate is the Phase 17 action lifecycle (`@/features/heby-actions`):
 *
 *     INTENT → EVIDENCE → PROPOSED → PREPARED → CAPABILITY → GOVERNANCE → AUTHORITY
 *            → HUMAN REVIEW (when required) → EXECUTION ELIGIBILITY → CONTROLLED INVOCATION
 *
 *   Heby MAY understand, explain, PREPARE, PROPOSE, and ROUTE. Heby MUST NOT silently
 *   AUTHORIZE or EXECUTE. Prepared ≠ authorized ≠ executed. Only READ_ONLY (and side-effect-
 *   free PREPARATION_ONLY) tools are invokable; every mutation stays non-executable, its
 *   substrate honestly reported as not connected. There is intentionally NO "authorized"
 *   state the system can produce. This model reuses the Phase 17 registry read-only; it
 *   introduces no model, provider, shell, filesystem, device, or execution, and fabricates
 *   no prepared item, result, or receipt.
 */

import {
  listActionTools,
  invokableActionTools,
  HEBY_ACTION_LIFECYCLE_DESCRIPTORS,
  type HebyActionLifecycleDescriptor,
  type HebyActionTool,
} from "@/features/heby-actions";

/** A safe intent category the Director may express. Maps to a Phase 17 side-effect class. */
export interface IntentCategoryView {
  readonly key: string;
  readonly label: string;
  readonly describes: string;
  /** The most consequential side-effect class this category can reach. */
  readonly reaches: "READ_ONLY" | "PREPARATION_ONLY" | "MUTATION";
  /** Whether an action in this category can actually run now (read-only / side-effect-free). */
  readonly invokableNow: boolean;
}

const INTENT_CATEGORIES: readonly IntentCategoryView[] = [
  { key: "explain", label: "Explain", describes: "Explain a state, a candidate, or why something is the way it is.", reaches: "READ_ONLY", invokableNow: true },
  { key: "investigate", label: "Investigate", describes: "Look into a question by reading real, connected state.", reaches: "READ_ONLY", invokableNow: true },
  { key: "summarize", label: "Summarize", describes: "Summarize connected state, with provenance and uncertainty.", reaches: "READ_ONLY", invokableNow: true },
  { key: "prepare-review", label: "Prepare review", describes: "Prepare grounded material for a human review. Nothing is executed.", reaches: "PREPARATION_ONLY", invokableNow: true },
  { key: "prepare-action", label: "Prepare action", describes: "Route toward a consequential change — always gated to human authority; no substrate is connected.", reaches: "MUTATION", invokableNow: false },
];

/** A declared action tool, projected honestly from the Phase 17 registry. */
export interface IntentActionView {
  readonly toolId: string;
  readonly actionKind: string;
  readonly sideEffect: HebyActionTool["sideEffect"];
  readonly authorityRequirement: HebyActionTool["authorityRequirement"];
  readonly substrateConnected: boolean;
  readonly ownerWorkspace: string;
  readonly describes: string;
}

export interface DirectorIntentModel {
  readonly categories: readonly IntentCategoryView[];
  /** The declared action tools, honest about which are actually invokable. */
  readonly actions: readonly IntentActionView[];
  /** The Phase 17 action lifecycle, ordered. Structural — no "authorized" state exists. */
  readonly lifecycle: readonly HebyActionLifecycleDescriptor[];
  /** Count of tools actually invokable now (READ_ONLY + connected substrate). */
  readonly invokableCount: number;
  /** No language model is connected to intent understanding. Always false in this phase. */
  readonly liveModelConnected: false;
  /**
   * Whether ANY consequential action has a connected execution substrate.
   *
   * REPAIRED AT R3B. This was the literal `false`, captioned "always false", and that stopped
   * being true when one execution runtime shipped. It is now DERIVED from the registry, so it
   * cannot drift again. `true` here means a substrate EXISTS — not that anything is armed (the
   * durable external-send switch is disabled) and not that Heby may reach it (it cannot; the
   * execute boundary is a human click on `/approvals`).
   */
  readonly executionConnected: boolean;
  /** How many mutation tools declare a connected substrate. Exactly one since R3B. */
  readonly connectedMutationCount: number;
  /** Free text is never routed to raw execution. Always false — arguments are typed and gated. */
  readonly freeTextToExecution: false;
}

/** Build the Director Intent model from the Phase 17 registry, read-only. Fabricates nothing. */
export function getDirectorIntentModel(): DirectorIntentModel {
  const actions = listActionTools().map<IntentActionView>((tool) => ({
    toolId: tool.toolId,
    actionKind: tool.actionKind,
    sideEffect: tool.sideEffect,
    authorityRequirement: tool.authorityRequirement,
    substrateConnected: tool.substrateConnected,
    ownerWorkspace: tool.ownerWorkspace,
    describes: tool.describes,
  }));

  const lifecycle = Object.values(HEBY_ACTION_LIFECYCLE_DESCRIPTORS)
    .slice()
    .sort((a, b) => a.order - b.order);

  /* Derived, never asserted: a stale literal is exactly what R3B had to repair here. */
  const connectedMutations = listActionTools().filter(
    (tool) =>
      tool.sideEffect !== "READ_ONLY" &&
      tool.sideEffect !== "PREPARATION_ONLY" &&
      tool.substrateConnected,
  );

  return {
    categories: INTENT_CATEGORIES,
    actions,
    lifecycle,
    invokableCount: invokableActionTools().length,
    liveModelConnected: false,
    executionConnected: connectedMutations.length > 0,
    connectedMutationCount: connectedMutations.length,
    freeTextToExecution: false,
  };
}
