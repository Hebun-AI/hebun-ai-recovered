/*
 * command-operating-state/workspace-model.ts — the read model for Command · Organization
 * Health (Hebun UI Phase 20B).
 *
 * PROVENANCE CONTRACT (no-fake-data, Phase 20A honesty rules):
 *
 *   Organization Health answers: "Is the organization operating coherently?" It is a
 *   composed OPERATING-STATE view across organizational domains — NOT CPU/RAM/uptime, and
 *   NEVER a synthetic percentage or aggregate score.
 *
 *   No domain operating-state source is connected here. The only real executive read model
 *   (the Phase 6B director dashboard) reports TECHNICAL system/runtime health, and the
 *   Phase 20A rule is explicit: do not translate technical health into business meaning.
 *   So every domain's operating state is honestly Unknown / Not connected, missing data is
 *   NEVER rendered as "Healthy", and NO global organization score is computed. This model
 *   fabricates no score, percentage, efficiency, utilization, or status, and calls no model.
 */

/** The honest operating state of a domain. Never a number, never a percentage. */
export type OperatingState = "not-connected" | "unknown";

export interface DomainOperatingStateView {
  readonly domain: string;
  readonly question: string;
  readonly state: OperatingState;
  readonly describes: string;
}

const DOMAINS: readonly DomainOperatingStateView[] = [
  { domain: "Operations", question: "Is live work running as expected?", state: "not-connected", describes: "Operations runtime operating-state is not connected." },
  { domain: "Knowledge", question: "Is the settled truth current and coherent?", state: "not-connected", describes: "Knowledge coherence state is not connected." },
  { domain: "Workforce", question: "Is the workforce staffed and within authority?", state: "not-connected", describes: "Workforce operating-state is not connected." },
  { domain: "Governance", question: "Are guardrails holding?", state: "not-connected", describes: "Governance posture state is not connected." },
  { domain: "Platform", question: "Are providers and integrations available?", state: "not-connected", describes: "Platform availability state is not connected." },
  { domain: "Intelligence", question: "Is understanding emerging and grounded?", state: "not-connected", describes: "Intelligence runtime is contract-only; no operating-state is surfaced." },
  { domain: "Strategy", question: "Is the organization moving toward its goals?", state: "not-connected", describes: "Strategic goal progress is not connected." },
];

export interface OrganizationOperatingStateModel {
  readonly domains: readonly DomainOperatingStateView[];
  /**
   * A global organization score. ALWAYS null — no aggregate score is computed, and missing
   * domain data is never collapsed into a single health number.
   */
  readonly aggregateScore: null;
  /** Whether any domain operating-state source is connected. Always false in this phase. */
  readonly connected: false;
}

/** Build the Organization Health model. Pure; computes no score; fabricates nothing. */
export function getOrganizationOperatingStateModel(): OrganizationOperatingStateModel {
  return {
    domains: DOMAINS,
    aggregateScore: null,
    connected: false,
  };
}
