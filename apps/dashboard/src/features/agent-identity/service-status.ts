/*
 * agent-identity/service-status.ts — WHICH out-of-service state an agent is in (L-2a).
 *
 * `isAgentInService` (in-service.ts) answers the only question a permission ever asks: may this
 * agent act now? It is a boolean on purpose. A SURFACE needs more: an agent that is not in service
 * may be retired (terminal), suspended (reversible), or in a state the recorded fields cannot name.
 * Before L-2a every surface rendered `inService === false` as "retired", which would have described
 * the first suspended agent as permanently withdrawn.
 *
 * Derived from the SAME three facts as `isAgentInService`, and never stored. The invariant, proven
 * exhaustively by test: status === "in-service" exactly when `isAgentInService` is true.
 *
 *   retired        retired_at set AND lifecycle 'retired'  (suspended_at is history; it may stay set)
 *   suspended      retired_at NULL, suspended_at set AND lifecycle 'suspended'
 *   in-service     retired_at NULL, suspended_at NULL, lifecycle NULL or 'active'
 *   indeterminate  anything else — the fields disagree (retired_at without 'retired', 'suspended'
 *                  without suspended_at, …), a lifecycle value no writer produces, or a fact that was
 *                  not read. Reported as itself, never rounded to the nearest valid status.
 *
 * Pure: no imports at runtime, so client components may use the labels. Writes nothing.
 */
import type { AgentServiceFacts } from "./in-service";

export const AGENT_SERVICE_STATUSES = ["in-service", "suspended", "retired", "indeterminate"] as const;
export type AgentServiceStatus = (typeof AGENT_SERVICE_STATUSES)[number];

const present = (value: Date | string | null): boolean => value !== null && value !== undefined;

export function agentServiceStatus(facts: AgentServiceFacts): AgentServiceStatus {
  const { retiredAt, suspendedAt, lifecycle } = facts;
  /* A fact that was not read is not an absent fact. */
  if (retiredAt === undefined || suspendedAt === undefined || lifecycle === undefined) return "indeterminate";

  if (present(retiredAt) || lifecycle === "retired") {
    return present(retiredAt) && lifecycle === "retired" ? "retired" : "indeterminate";
  }
  if (present(suspendedAt) || lifecycle === "suspended") {
    return present(suspendedAt) && lifecycle === "suspended" ? "suspended" : "indeterminate";
  }
  return lifecycle === null || lifecycle === "active" ? "in-service" : "indeterminate";
}

/** The word a reader sees. "status unknown" is honest about indeterminate; it claims no state. */
export const AGENT_SERVICE_STATUS_LABEL: Readonly<Record<AgentServiceStatus, string>> = {
  "in-service": "in service",
  suspended: "suspended",
  retired: "retired",
  indeterminate: "status unknown",
};

/** One sentence for evidence and grounding prose. Never says "retired" unless retirement is recorded. */
export function agentServiceSentence(
  status: AgentServiceStatus,
  at: { readonly retiredAt: string | null; readonly suspendedAt: string | null },
): string {
  switch (status) {
    case "in-service":
      return "in service";
    case "suspended":
      return `suspended from service${at.suspendedAt ? ` since ${at.suspendedAt}` : ""} (reversible; it is not acting)`;
    case "retired":
      return `retired from service${at.retiredAt ? ` at ${at.retiredAt}` : ""} (permanent)`;
    case "indeterminate":
      return "of undetermined service status — its recorded lifecycle fields disagree, so it is treated as not in service";
  }
}
