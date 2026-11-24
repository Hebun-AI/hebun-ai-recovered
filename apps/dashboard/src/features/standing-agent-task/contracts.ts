/*
 * standing-agent-task/contracts.ts — P5-5 vocabulary. Client-safe: constants and types only.
 *
 * A standing agent task authorization is Governance saying, for ONE tenant and ONE template: this agent
 * may prepare this weekly internal draft from THIS brief onto THIS work item, until a later revision
 * withdraws it. It authorizes no send and no act; what the weekly run files is a draft waiting for review.
 */
import { STANDING_AGENT_TASK_TEMPLATES } from "@/db/schema/standing-agent-task";

export { STANDING_AGENT_TASK_TEMPLATES };
export type StandingAgentTaskTemplate = (typeof STANDING_AGENT_TASK_TEMPLATES)[number];

export const STANDING_AGENT_TASK_SUBJECT_TYPE = "standing_agent_task_authorization" as const;
export const STANDING_AGENT_TASK_DOMAIN = "standing-agent-task" as const;
export const STANDING_AGENT_TASK_AUTHORIZE_DECISION_TYPE = "approve" as const;
export const STANDING_AGENT_TASK_WITHDRAW_DECISION_TYPE = "revoke" as const;
/* Never `membership-authorized` or "authority revoked": withdrawing a weekly task takes nobody's authority. */
export const STANDING_AGENT_TASK_AUTHORIZED_OUTCOME = "standing-agent-task-authorized" as const;
export const STANDING_AGENT_TASK_WITHDRAWN_OUTCOME = "standing-agent-task-withdrawn" as const;

/**
 * The deployment-wide stop for SCHEDULED agent tasks, a row in `provider_connectivity_controls`. Absent,
 * unreadable or not exactly `true` reads as OFF. It can remove permission Governance granted; never create one.
 */
export const AGENT_TASK_SCHEDULE_CONTROL_KEY = "agent-task-schedule" as const;

export const MAX_AGENT_TASK_TITLE_CHARACTERS = 200;
export const MAX_AGENT_TASK_BRIEF_CHARACTERS = 4000;

export const AGENT_TASK_TEMPLATE_LABELS: Readonly<Record<StandingAgentTaskTemplate, string>> = Object.freeze({
  "weekly-content-plan": "Weekly content plan",
  "weekly-operations-summary": "Weekly operations summary",
});

export type StandingAgentTaskState = "active" | "withdrawn";

export interface StandingAgentTaskAuthorizationRecord {
  readonly authorizationId: string;
  readonly template: StandingAgentTaskTemplate;
  readonly authorizationRevision: number;
  readonly state: StandingAgentTaskState;
  readonly workItemId: string;
  readonly agentId: string;
  readonly title: string;
  readonly brief: string;
  readonly governanceDecisionId: string;
  readonly authorizedByActorId: string;
  readonly authorizedAt: string;
  readonly supersedesAuthorizationId: string | null;
}

export type StandingAgentTaskRefusal =
  | "unauthenticated"
  | "not-the-governance-authority"
  | "justification-required"
  | "invalid-template"
  | "invalid-brief"
  /** The agent is not in service, holds no draft mandate, or is not responsible for this work. */
  | "agent-not-eligible"
  | "work-unavailable"
  | "stale-authorization-revision"
  | "concurrent-authorization-change"
  | "no-active-authorization"
  | "already-authorized"
  /** P5-4 — the organization's plan holds no schedule (Free). Withdrawing is always admitted. */
  | "plan-schedule-not-included"
  | "persistence-unavailable";

export type StandingAgentTaskWriteResult =
  | { readonly status: "authorized"; readonly authorization: StandingAgentTaskAuthorizationRecord }
  | { readonly status: "refused"; readonly reason: StandingAgentTaskRefusal };
