/*
 * P5-3 — agent templates (Director decisions 2026-11-23: narrowest scope; honest partial result).
 *
 * A template is a PRESET for the three released setup acts, nothing more: a suggested name, the
 * mandate purpose that P5-2 sends as the agent's role, the narrowest mandate scope that lets the
 * agent do its one kind of work, and organization-level responsibility. It grants nothing the mandate
 * card could not grant by hand, and every value still passes the released writers' own validation.
 *
 * Pure constants. No I/O, no authority.
 */

export const AGENT_TEMPLATE_IDS = ["content", "research", "operations"] as const;
export type AgentTemplateId = (typeof AGENT_TEMPLATE_IDS)[number];

export interface AgentTemplate {
  readonly id: AgentTemplateId;
  /** Suggested name; the person may change it before creating. */
  readonly name: string;
  /** One line for the form. */
  readonly summary: string;
  /** The mandate purpose — the agent's role brief (P5-2). */
  readonly purpose: string;
  /**
   * The narrowest released scope for the work: `set-work-declared-state` lets the agent prepare
   * drafts for work it is responsible for (a person picks the item and the state); `prepare-research`
   * lets it prepare research reports and nothing else.
   */
  readonly proposalScope: readonly string[];
}

export const AGENT_TEMPLATES: readonly AgentTemplate[] = Object.freeze([
  Object.freeze({
    id: "content",
    name: "Content Agent",
    summary: "Prepares captions, posts and short copy for review.",
    purpose:
      "Prepare content drafts for this organization's channels — captions, posts and short copy — grounded in its records, for a person to review. Never publishes.",
    proposalScope: Object.freeze(["set-work-declared-state"]),
  }),
  Object.freeze({
    id: "research",
    name: "Research Agent",
    summary: "Prepares research reports on markets, buyers and competitors.",
    purpose:
      "Prepare research reports on markets, buyers and competitors for this organization, separating what records show from what is unknown. Never acts on findings.",
    proposalScope: Object.freeze(["prepare-research"]),
  }),
  Object.freeze({
    id: "operations",
    name: "Operations Agent",
    summary: "Prepares operational plans and checklists for review.",
    purpose:
      "Prepare operational plans and checklists for this organization's day-to-day work — stock, shipping, suppliers — for a person to review. Never acts.",
    proposalScope: Object.freeze(["set-work-declared-state"]),
  }),
]);

/** Every template is responsible for organization-level work. */
export const AGENT_TEMPLATE_RESPONSIBILITY = Object.freeze([Object.freeze({ kind: "organization" as const })]);

export function agentTemplateById(id: unknown): AgentTemplate | undefined {
  return AGENT_TEMPLATES.find((template) => template.id === id);
}
