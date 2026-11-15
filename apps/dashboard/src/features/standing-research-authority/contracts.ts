/*
 * standing-research-authority/contracts.ts — P6-2 vocabulary. Client-safe: constants and types only.
 *
 * A standing research authorization is Governance saying, for ONE tenant: this agent may prepare
 * research from THIS brief onto THIS work item, until a later revision withdraws it. It is the only
 * permission under which research runs. It authorizes no source, no send and no act; what it lets
 * an agent file is still an UNSOURCED RESEARCH DRAFT waiting for review.
 */

export const STANDING_RESEARCH_SUBJECT_TYPE = "standing_research_authorization" as const;
export const STANDING_RESEARCH_DOMAIN = "standing-research" as const;
export const STANDING_RESEARCH_AUTHORIZE_DECISION_TYPE = "approve" as const;
export const STANDING_RESEARCH_WITHDRAW_DECISION_TYPE = "revoke" as const;
/* Never `membership-authorized` or "Governance authority revoked": withdrawing research takes nobody's authority. */
export const STANDING_RESEARCH_AUTHORIZED_OUTCOME = "standing-research-authorized" as const;
export const STANDING_RESEARCH_WITHDRAWN_OUTCOME = "standing-research-withdrawn" as const;

export const STANDING_RESEARCH_ENTITY_TYPE = "standing_research_authorization" as const;
export const STANDING_RESEARCH_AUDIT_SOURCE = "standing-research-authority" as const;
export const STANDING_RESEARCH_AUDIT_AUTHORIZED = "standing-research.authorized" as const;
export const STANDING_RESEARCH_AUDIT_WITHDRAWN = "standing-research.withdrawn" as const;
/** A person's authorize, withdraw or run attempt that was refused. Nothing changed; it is filed so refusals are visible. */
export const STANDING_RESEARCH_AUDIT_REFUSED = "standing-research.refused" as const;
export type StandingResearchAuditAction =
  | typeof STANDING_RESEARCH_AUDIT_AUTHORIZED
  | typeof STANDING_RESEARCH_AUDIT_WITHDRAWN
  | typeof STANDING_RESEARCH_AUDIT_REFUSED;

/**
 * D5 — the deployment-wide stop for SCHEDULED research, a row in `provider_connectivity_controls`.
 * Absent row, unconfigured database or read error all read as OFF. It can remove permission
 * Governance granted; it can never create one. Manual "run now" by a person does not consult it:
 * the person is present and is their own stop, and the `claude` control still governs every call.
 */
export const RESEARCH_SCHEDULE_CONTROL_KEY = "research-schedule" as const;

export const MAX_RESEARCH_TITLE_CHARACTERS = 200;
export const MAX_RESEARCH_BRIEF_CHARACTERS = 4000;

export type StandingResearchState = "active" | "withdrawn";

export interface StandingResearchAuthorizationRecord {
  readonly authorizationId: string;
  readonly authorizationRevision: number;
  readonly state: StandingResearchState;
  readonly workItemId: string;
  readonly agentId: string;
  readonly title: string;
  readonly brief: string;
  readonly governanceDecisionId: string;
  readonly authorizedByActorId: string;
  readonly authorizedAt: string;
  readonly supersedesAuthorizationId: string | null;
}

export type StandingResearchRefusal =
  | "unauthenticated"
  | "not-the-governance-authority"
  | "justification-required"
  | "invalid-brief"
  /** The agent is not in service, holds no `prepare-research` mandate, or is not responsible for this work. */
  | "agent-not-eligible"
  | "work-unavailable"
  /** The caller was looking at a different revision than the one in force. */
  | "stale-authorization-revision"
  | "concurrent-authorization-change"
  | "no-active-authorization"
  | "already-authorized"
  | "persistence-unavailable";

export type StandingResearchWriteResult =
  | { readonly status: "authorized"; readonly authorization: StandingResearchAuthorizationRecord }
  | { readonly status: "refused"; readonly reason: StandingResearchRefusal };

/** Why a SCHEDULED run may not start. Checked in this order; the switch first, before any read. */
export type ScheduledResearchRefusal = "research-schedule-disabled" | "no-active-authorization" | "persistence-unavailable";

export type ScheduledResearchAdmission =
  | { readonly status: "admitted"; readonly authorization: StandingResearchAuthorizationRecord }
  | { readonly status: "refused"; readonly reason: ScheduledResearchRefusal };
