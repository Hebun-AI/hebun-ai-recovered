/*
 * organization-authority/placement-contracts.ts — the vocabulary of DEPARTMENTAL PLACEMENT.
 *
 * Pure. No I/O, no database, no writer. It names what a placement is, what it refuses, and — the
 * part that reaches a model — what it must never be read as meaning.
 *
 * ── PLACEMENT IS A RECORDED FACT, NOT AN AUTHORIZATION ───────────────────────
 *
 *     PLACEMENT != ROLE             PLACEMENT != AUTHORITY        PLACEMENT != PERMISSION
 *     PLACEMENT != REPORTING LINE   PLACEMENT != MANAGER          PLACEMENT != TEAM
 *     PLACEMENT != WORK ASSIGNMENT  PLACED    != ACTIVE MEMBER    PLACED    != OBSERVED
 *     UNPLACED  != NOT A MEMBER     NO PLACEMENTS != NOBODY WORKS HERE
 *
 * Nothing in this repository reads a placement to decide anything, exactly as nothing reads
 * `departments.owner_actor_id`. Both publish attribution, and attribution is not authority.
 */

/** The audit entity type. Its own, because a placement is not a department. */
export const PLACEMENT_ENTITY_TYPE = "department_placement" as const;

/**
 * The two acts, as audit actions.
 *
 * `set` covers first placement AND a move, deliberately: both leave the organization saying "this
 * human works in this department", and splitting them would make a reader reconstruct the current
 * fact from a history rather than read it. The metadata carries the department, so a move is fully
 * legible in the event stream.
 */
export const PLACEMENT_AUDIT_SET = "organization.placement.set" as const;
export const PLACEMENT_AUDIT_WITHDRAWN = "organization.placement.withdrawn" as const;

export type PlacementAuditAction =
  | typeof PLACEMENT_AUDIT_SET
  | typeof PLACEMENT_AUDIT_WITHDRAWN;

export const PLACEMENT_AUDIT_ACTIONS: readonly PlacementAuditAction[] = Object.freeze([
  PLACEMENT_AUDIT_SET,
  PLACEMENT_AUDIT_WITHDRAWN,
]);

/**
 * Why a placement act was refused. A CLOSED product vocabulary.
 *
 * `human-not-active-member` is returned identically for a revoked membership, a soft-deleted
 * identity, another tenant's human and nobody at all — so a refusal is never an oracle for who
 * belongs to an organization. That is the released posture of `owner-not-active-member`, kept.
 */
export type PlacementRefusal =
  /** No server-resolved tenant + human. There is no parameter through which a caller supplies one. */
  | "no-authorized-tenant-context"
  /** The caller does not hold this tenant's Governance authority. Fail closed. */
  | "not-authorized"
  /** The control-plane database is not reachable. Never falls back to memory. */
  | "authority-unavailable"
  /** No live department of this tenant carries that id. Another tenant's looks identical. */
  | "department-unresolved"
  /** The department is retired. A human is not placed into a department out of service. */
  | "department-retired"
  /** The human is not a currently eligible member of this tenant. One reason, every cause. */
  | "human-not-active-member"
  /** This human is already recorded in this exact department. Nothing to record. */
  | "already-placed"
  /** Withdrawal was asked for a human this organization has not placed. */
  | "not-placed";

/** The most placements one read will return. A bound, and the surface says when it is reached. */
export const MAX_PLACEMENTS_READ = 200;

/**
 * The boundary, frozen so a test reads this capability's own claim and a later phase must change it
 * deliberately. Every field is a measurement of what was actually built.
 */
export const DEPARTMENTAL_PLACEMENT_AUTHORITY_MODEL = Object.freeze({
  owns: Object.freeze(["human-department-placement"]),
  /** It writes exactly one table, and `audit_log`. */
  writesTables: Object.freeze(["department_placements"]),
  /** It never writes the row a session reads to build a `TenantContext`. */
  writesMemberships: false as const,
  /** It never writes the structural authority's table either. */
  writesDepartments: false as const,
  /** No Governance decision row is written by any path here. */
  writesGovernanceDecision: false as const,
  /** No `governance_domain` value was added. */
  governanceDomainAdded: false as const,
  /**
   * A placement register is not a member roster: an unplaced member is INVISIBLE to every read
   * here. The released member list is the Human Legibility Reach picker, and this is not a second
   * one.
   */
  memberRoster: false as const,
  /** An agent is assigned through `agents.department_id`, which Agent Identity owns. Not here. */
  agentPlacement: false as const,
  /** Placement decides nothing, anywhere. */
  readToAuthorize: false as const,
  limitation:
    "This authority records which department a human is placed in, who recorded it and when. It " +
    "is a declaration by an authorized human, not an observation: Hebun did not watch anyone " +
    "work anywhere. It confers no permission, no Governance authority, no approval right, no " +
    "reporting line and no work assignment, and nothing in this repository reads it to decide " +
    "anything.",
});
