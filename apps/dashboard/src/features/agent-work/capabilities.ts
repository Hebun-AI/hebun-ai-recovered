/*
 * agent-work/capabilities.ts — AGENT-EXECUTION-1: what an agent may DO, not only propose.
 *
 * Until now an agent's mandate bounded one thing: the action kinds it may PROPOSE for Governance
 * (`proposal_scope`). Proposing is not work. This file declares the agent WORK capabilities — bounded
 * tasks an agent performs itself when a person assigns them — and the conditions under which each is
 * available. It is a contract, not an authority:
 *
 *   - it creates no table, no lifecycle and no permission. Every condition below is answered by the
 *     authority that already owns it (Agent Identity, Agent Mandate, Organizational Work, External-AI
 *     Data Use, the Director's provider control);
 *   - it grants nothing. An assignment is not an authorization, and the output of every capability
 *     here is something a human reviews before anything consequential can follow;
 *   - it is pure and client-safe, so Heby can explain a capability without reaching a server module.
 *
 * Adding a capability is adding an entry here and the server seam that performs it; a contract test
 * pins every entry to the mandate vocabulary and the platform data-use policy, so an entry cannot
 * claim a kind or a data class those authorities do not hold.
 */
import { AGENT_ORIGINABLE_REGISTRY_KIND } from "@/features/agent-origination/contracts";
import {
  refuseOutsideAgentMandate,
  refuseOutsideAgentPreparation,
  refuseOutsideAgentResponsibility,
  type AgentMandateCeilingRefusal,
  type AgentResponsibilityRefusal,
  type MandateReadForCeiling,
  type MandateReadForResponsibility,
} from "@/features/action-authorization/agent-mandate-ceiling";
import { isAgentPreparationKind, type MandateScopeKind } from "@/features/agent-mandate/contracts";
import type { WorkScope } from "@/features/work-domain/work-scope";

export type AgentWorkCapabilityId = "prepare-work-draft" | "prepare-research-report";

export interface AgentWorkCapability {
  readonly id: AgentWorkCapabilityId;
  /** The authority whose seam performs the work. The capability never writes on its own. */
  readonly performedBy: string;
  /** What the person is asking for, in their words. */
  readonly label: string;
  readonly objective: string;
  /** Side-effect class, in the action registry's vocabulary. A work capability is never consequential. */
  readonly sideEffect: "PREPARATION_ONLY";
  /**
   * The mandate condition: the agent's in-force mandate must admit at least one of these responsibility-
   * scoped kinds AND grant responsibility for the work item's recorded scope. An agent drafts only for
   * work it is already responsible for. RA-AUTH-1: a kind is either an origination alias (answered by
   * the action ceiling) or a preparation kind (answered by the preparation ceiling) — never both.
   */
  readonly mandateKindsAnyOf: readonly MandateScopeKind[];
  /**
   * The External-AI Data Use purpose and classes the model call declares. The gate enforces them.
   * RA-AUTH-1: `null` declares no disclosure at all — the capability has no performing seam yet and
   * cannot reach a model until its purpose and classes exist in the platform policy.
   */
  readonly dataUse: { readonly purpose: "assistance"; readonly dataClasses: readonly ("conversation" | "work-artifact")[] } | null;
  /** What the agent is given. Nothing else reaches the model. */
  readonly input: readonly string[];
  readonly output: string;
  /** When the task counts as done, and who decides. */
  readonly completion: string;
  /** What the agent cannot do under this capability. Shown to the person before they assign. */
  readonly cannot: readonly string[];
  /** Governance authorization needed to perform the capability itself. */
  readonly authorizationRequired: false;
}

export const AGENT_WORK_CAPABILITIES: readonly AgentWorkCapability[] = Object.freeze([
  Object.freeze({
    id: "prepare-work-draft" as const,
    performedBy: "work-artifacts (prepareWorkArtifact); the person links the result through organizational-work's own action",
    label: "Prepare a draft for this work",
    objective: "Write one draft — a plan, a message or content — for a work item the agent is responsible for.",
    sideEffect: "PREPARATION_ONLY" as const,
    mandateKindsAnyOf: Object.freeze(["record-work", "set-work-declared-state"] as const),
    dataUse: Object.freeze({ purpose: "assistance" as const, dataClasses: Object.freeze(["conversation", "work-artifact"] as const) }),
    input: Object.freeze([
      "your instruction, in your words",
      "the draft's title and type you choose",
      "your organization's existing drafts, as Operations already shows them to Heby",
    ]),
    output: "One draft authored by the agent, which you then link to this work item as its evidence.",
    completion: "Done when a person with Governance authority accepts the draft in Operations.",
    cannot: Object.freeze([
      "read this work item or the work register — the work item is never sent to the model",
      "send, publish or change anything — a draft is text for review",
      "change the work item's state",
      "approve its own draft",
    ]),
    authorizationRequired: false as const,
  }),
  /*
   * RA-AUTH-1 — the Research Agent's only capability (Director-approved). DECLARED, NOT PERFORMABLE:
   * no seam performs it and it declares no External-AI disclosure (`dataUse: null`). RA-EAI-1 adds the
   * `research` purpose to the platform policy and RA-PREP-1 adds the seam; until both land, nothing can
   * prepare a research report. Its mandate condition is the PREPARATION kind `prepare-research` alone,
   * so a research mandate grants no general draft and a general draft mandate grants no research.
   */
  Object.freeze({
    id: "prepare-research-report" as const,
    performedBy: "no seam yet — RA-PREP-1 adds it; until then nothing performs this capability",
    label: "Prepare a research report for this work",
    objective:
      "Write one sourced research report — market, customer or opportunity research — for a work item the agent is responsible for.",
    sideEffect: "PREPARATION_ONLY" as const,
    mandateKindsAnyOf: Object.freeze(["prepare-research"] as const),
    dataUse: null,
    input: Object.freeze([
      "your research question, in your words",
      "public web sources found during the research",
      "your organization's ratified, publicly usable statements of what it offers",
    ]),
    output: "One research report authored by the agent, which you then link to this work item as its evidence.",
    completion: "Done when a person with Governance authority accepts the report in Operations.",
    cannot: Object.freeze([
      "contact anyone, send, publish or change anything outside Hebun — a report is text for review",
      "propose actions, receive permits or start machine execution",
      "propose or change the work item's state",
      "prepare any draft other than a research report",
      "approve its own report or widen its own mandate",
    ]),
    authorizationRequired: false as const,
  }),
]);

export function agentWorkCapability(id: AgentWorkCapabilityId): AgentWorkCapability {
  return AGENT_WORK_CAPABILITIES.find((capability) => capability.id === id)!;
}

export type AgentWorkCeilingRefusal = AgentMandateCeilingRefusal | AgentResponsibilityRefusal;

/**
 * The capability's mandate condition, answered by the ONE shared ceiling and nothing else: `null` when
 * some kind in `mandateKindsAnyOf` is admitted by the mandate AND its responsibility covers `workScope`.
 * Pure — the caller hands it what the Agent Mandate Authority said. When no kind admits, the refusal of
 * the kind that came closest is returned (responsibility over kind), so the person is told the real gap.
 */
export function refuseOutsideAgentWorkCapability(
  capability: AgentWorkCapability,
  read: MandateReadForCeiling & MandateReadForResponsibility,
  workScope: WorkScope,
): AgentWorkCeilingRefusal | null {
  let refusal: AgentWorkCeilingRefusal | null = null;
  for (const alias of capability.mandateKindsAnyOf) {
    const refused = isAgentPreparationKind(alias)
      ? refuseOutsideAgentPreparation(read, alias, workScope)
      : refuseOutsideAgentMandate(read, AGENT_ORIGINABLE_REGISTRY_KIND[alias]) ??
        refuseOutsideAgentResponsibility(read, AGENT_ORIGINABLE_REGISTRY_KIND[alias], workScope);
    if (!refused) return null;
    if (refusal === null || refusal === "action-outside-agent-mandate") refusal = refused;
  }
  return refusal ?? "action-outside-agent-mandate";
}

/*
 * AGENT-EXECUTION-2 — WHO AN ELIGIBLE AGENT IS FOR THIS WORK. The registry has no "role" field and none
 * is added: an agent's specialty is what its mandate already records, its responsibility. For work of one
 * recorded kind (a domain scope), an agent responsible for that kind of work and NOT organization-wide is
 * that work's SPECIALIST; an organization-wide agent (Heby) is the COORDINATOR, even when it also holds the
 * domain. Organization-level work has no specialist. Pure; asked of the same mandate read the ceiling used,
 * and only meaningful for an agent the ceiling already admitted.
 */
export type AgentWorkRole = "specialist" | "coordinator";

export function agentWorkRole(read: MandateReadForResponsibility, workScope: WorkScope): AgentWorkRole {
  if (workScope.kind !== "domain" || read.status !== "known" || !read.mandate) return "coordinator";
  return read.mandate.responsibility.some((grant) => grant.kind === "organization") ? "coordinator" : "specialist";
}
