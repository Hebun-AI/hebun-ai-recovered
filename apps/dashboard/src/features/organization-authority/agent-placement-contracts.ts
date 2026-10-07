/*
 * AP-2 — AGENT PLACEMENT: which department of this organization an agent is placed in.
 *
 * Vocabulary only. No database handle, no query, no authority — so a client component or a server
 * action may import the TYPES from here without widening its reach by anything.
 *
 * ── WHOSE FACT THIS IS ───────────────────────────────────────────────────────
 *
 * The Organization Authority's. Where something sits in the organization is a structural fact, and
 * the authority that records departments and places humans is the one that places agents. It lives
 * in the pre-existing column `agents.department_id` (Director decision, AP-2: no new table, no
 * migration). Agent Identity does NOT write it: placement is not an identity lifecycle transition,
 * and Agent Identity keeps its two transitions — register and retire — and no third.
 *
 * The writer is COLUMN-SCOPED. It may move `department_id` and the row provenance every governed
 * write advances (`updated_at`, `updated_by`, `updated_by_type`, `version`) — and nothing else on
 * the agent row. Identity, lifecycle, mandate and capability fields are unreachable from it.
 *
 *     PLACEMENT != MANDATE         PLACEMENT != CAPABILITY      PLACEMENT != AUTHORIZATION
 *     PLACEMENT != PROPOSER CHOICE PLACEMENT != EXECUTION       PLACEMENT != MANAGER
 *
 * Nothing in this repository reads an agent's placement to decide anything.
 *
 * ── STATES (AP-2 contract) ───────────────────────────────────────────────────
 *
 *   unplaced                      in service, `department_id` NULL
 *   placed                        in service, in an in-service department
 *   placed-in-retired-department  in service, its department was retired AFTER it was placed (T7);
 *                                 it may still be moved to an in-service department or withdrawn
 *   historical                    the agent is retired and the column still names a department —
 *                                 historical organizational attribution, NOT a current placement (T8)
 *
 * A retired agent's placement is frozen: every transition refuses `agent-retired`.
 */

export const AGENT_PLACEMENT_ENTITY_TYPE = "agent" as const;

export const AGENT_PLACEMENT_AUDIT_SET = "organization.agent-placement.set" as const;
export const AGENT_PLACEMENT_AUDIT_WITHDRAWN = "organization.agent-placement.withdrawn" as const;

export type AgentPlacementAuditAction =
  | typeof AGENT_PLACEMENT_AUDIT_SET
  | typeof AGENT_PLACEMENT_AUDIT_WITHDRAWN;

/**
 * The ONLY agent columns the placement writer may change. Asserted against the writer's own
 * `.set({...})` and against a real row, so it cannot drift into a wider claim.
 */
export const AGENT_PLACEMENT_WRITABLE_COLUMNS = Object.freeze([
  "department_id",
  "updated_at",
  "updated_by",
  "updated_by_type",
  "version",
] as const);

export type AgentPlacementRefusal =
  /** No server-resolved tenant + human. There is no parameter through which a caller supplies one. */
  | "no-authorized-tenant-context"
  /** The caller does not hold this tenant's Governance authority. Fail closed. */
  | "not-authorized"
  /** The control-plane database is not reachable. Never falls back to memory. */
  | "authority-unavailable"
  /** No agent of this tenant carries that id. Another tenant's, an absent and a malformed id look identical. */
  | "agent-unresolved"
  /** The agent is retired; its placement is historical and frozen. */
  | "agent-retired"
  /** No department of this tenant carries that id. Another tenant's, an absent and a malformed id look identical. */
  | "department-unresolved"
  /** The target department is retired. Nothing is placed into a department out of service. */
  | "department-retired"
  /** The agent is already placed in that exact department. Nothing written, nothing audited. */
  | "already-placed"
  /** Withdrawal was asked for an agent that is not placed. Nothing written, nothing audited. */
  | "not-placed"
  /** The placement the caller was shown is no longer the recorded one. Never overwritten. */
  | "placement-changed";

export interface RecordedAgentPlacement {
  readonly agentId: string;
  readonly previousDepartmentId: string | null;
  readonly departmentId: string | null;
}

export type AgentPlacementWriteResult =
  | { readonly status: "recorded"; readonly placement: RecordedAgentPlacement }
  | { readonly status: "withdrawn"; readonly placement: RecordedAgentPlacement }
  | { readonly status: "refused"; readonly reason: AgentPlacementRefusal };

export type AgentPlacementState =
  | "unplaced"
  | "placed"
  | "placed-in-retired-department"
  | "historical";

export interface AgentPlacementView {
  readonly agentId: string;
  readonly agentInService: boolean;
  readonly state: AgentPlacementState;
  readonly department: {
    readonly departmentId: string;
    readonly name: string;
    readonly slug: string;
    readonly inService: boolean;
  } | null;
}

export type AgentPlacementRegister =
  | { readonly status: "unavailable" }
  | { readonly status: "available"; readonly placements: readonly AgentPlacementView[] };

/** Pure: the four states, derived from two facts. Never stored. */
export function deriveAgentPlacementState(
  agentInService: boolean,
  department: { readonly inService: boolean } | null,
): AgentPlacementState {
  if (!department) return "unplaced";
  if (!agentInService) return "historical";
  return department.inService ? "placed" : "placed-in-retired-department";
}

export const AGENT_PLACEMENT_AUTHORITY_MODEL = Object.freeze({
  owner: "organization-authority" as const,
  writesTables: Object.freeze(["agents"]),
  writesColumns: AGENT_PLACEMENT_WRITABLE_COLUMNS,
  /** No Governance decision row; the gate is the Governance holder, the record is the audit row. */
  writesGovernanceDecision: false as const,
  /** Placement is not an Agent Identity transition. */
  agentIdentityTransition: false as const,
  /** Department retirement neither cascades into nor clears an agent's placement. */
  departmentRetirementCascades: false as const,
  /** Placement decides nothing, anywhere. */
  readToAuthorize: false as const,
});
