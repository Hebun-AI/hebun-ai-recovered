/*
 * organization-authority/structure-contracts.ts — the vocabulary, the bounds and the boundary of
 * the Organization Structure Authority (OSA-1).
 *
 * ── WHAT OSA OWNS, AND THE COMPLETE LIST ─────────────────────────────────────
 *
 *   1. department identity     — that a part of this organization exists, and what it is called
 *   2. department lifecycle    — whether it is in service
 *   3. department ownership    — which human is accountable for it
 *
 * Three facts. Each one had NO owner before this milestone: `departments` shipped in the foundation
 * baseline and was never written, never read and never populated by any migration.
 *
 * ── WHAT OSA DOES NOT OWN, AND WILL NOT ──────────────────────────────────────
 *
 *   company identity           L3 (`readOrganizationAuthority` over `companies`)
 *   tenant membership          Membership Authority
 *   roles                      the tenant role baseline
 *   Governance authority       `resolveGovernanceAuthority`, from `decision_records.bootstrap`
 *   agent identity + lifecycle Agent Identity — "TWO authorities, TWO transitions, and no third"
 *   Knowledge                  Knowledge
 *   the Live Map               a derived projection, never a truth owner
 *
 * And these do not exist at all, here or anywhere: teams, reporting hierarchy, manager trees,
 * positions, job titles, cost centres, business units, regions.
 *
 * ── OWNERSHIP IS ATTRIBUTION, NOT AUTHORITY ──────────────────────────────────
 *
 * Naming a human as a department's owner grants them NOTHING. Every one of these is a fact about
 * this repository, not a promise:
 *
 *   DEPARTMENT OWNER != GOVERNANCE AUTHORITY   `resolveGovernanceAuthority` reads
 *                                              `decision_records.bootstrap` and active delegations,
 *                                              and consults no department, ever.
 *   DEPARTMENT OWNER != APPROVER               every approve/authorize surface in the schema is
 *                                              CHECK-constrained to a human resolved through
 *                                              Governance; none reads `departments`.
 *   DEPARTMENT OWNER != PERMIT HOLDER          `action_permits.authorized_by_actor_type = 'human'`
 *                                              is unchanged and unreachable from here.
 *   DEPARTMENT OWNER != TENANT MEMBERSHIP      the writer VERIFIES an active membership before
 *                                              recording ownership; it never creates, changes or
 *                                              revokes one.
 *   DEPARTMENT       != ROLE                   `roles` is a tenant membership band and is not
 *                                              consulted for authority at all.
 *
 * ── WHY THERE IS NO GOVERNANCE DECISION ──────────────────────────────────────
 *
 * Measured at the OSA-0 gate against the released bar, not chosen for convenience. Every Governance
 * decision Hebun writes today either MOVES AUTHORITY (delegation, membership authorization,
 * identity enrollment) or carries IRREVERSIBLE OR EXTERNAL CONSEQUENCE (action authorization,
 * knowledge ratification, an agent mandate ceiling). Recording that a department exists, renaming
 * it, retiring it, or naming who is accountable for it does neither: nothing moves, nothing leaves
 * the database, and every one of them is reversible by the same authority that performed it.
 *
 * The released precedent for a governed mutation that writes NO decision is R6D — Knowledge source
 * retraction — which is gated on its own authority band, writes audit in the same transaction, and
 * creates no `decision_records` row. OSA follows it exactly. `organizational-role` was considered
 * and REFUSED as the domain: `tenant-role-baseline` already owns it, and reusing it would make "a
 * department was created" indistinguishable from "a role was provisioned" in the one place the
 * ledger is queried by domain.
 *
 * So: NO Governance decision, NO new `governance_domain` value, NO schema change to Governance.
 * The administrative gate is the tenant's EXISTING Governance authority holder, consumed as a
 * permission to write structure and never as a decision.
 */

/** The `audit_log.entity_type` every OSA event carries. Its own type, not borrowed from L3. */
export const DEPARTMENT_ENTITY_TYPE = "department" as const;

/** The `audit_log.action` vocabulary. Closed: an act with no verb here cannot be recorded. */
export const DEPARTMENT_AUDIT_CREATED = "organization.department.created" as const;
export const DEPARTMENT_AUDIT_RENAMED = "organization.department.renamed" as const;
export const DEPARTMENT_AUDIT_RETIRED = "organization.department.retired" as const;
export const DEPARTMENT_AUDIT_OWNER_SET = "organization.department.owner-set" as const;

export type DepartmentAuditAction =
  | typeof DEPARTMENT_AUDIT_CREATED
  | typeof DEPARTMENT_AUDIT_RENAMED
  | typeof DEPARTMENT_AUDIT_RETIRED
  | typeof DEPARTMENT_AUDIT_OWNER_SET;

export const DEPARTMENT_AUDIT_ACTIONS: readonly DepartmentAuditAction[] = Object.freeze([
  DEPARTMENT_AUDIT_CREATED,
  DEPARTMENT_AUDIT_RENAMED,
  DEPARTMENT_AUDIT_RETIRED,
  DEPARTMENT_AUDIT_OWNER_SET,
]);

/**
 * Why a structural mutation was refused. A CLOSED product vocabulary: these are what a caller
 * reads, what a test matches on, and what a bite-proof must see before it may claim a guard bit.
 */
export type DepartmentRefusal =
  /** No server-resolved tenant + human. There is no parameter through which a caller supplies one. */
  | "no-authorized-tenant-context"
  /** The caller does not hold this tenant's Governance authority. Fail closed. */
  | "not-authorized"
  /** The control-plane database is not reachable. Never falls back to memory. */
  | "authority-unavailable"
  /** Name absent, blank, or longer than the bound. Never trimmed into validity. */
  | "malformed-department-name"
  /** Slug absent, or not lowercase-hyphenated. Never repaired — a repaired slug is a different one. */
  | "malformed-department-slug"
  /** Another ACTIVE department in this tenant already carries this slug. */
  | "duplicate-active-slug"
  /** No live department of this tenant carries that id. Another tenant's looks identical. */
  | "department-unresolved"
  /** The department is already retired. Retirement is not re-appliable and not reversible here. */
  | "department-retired"
  /** The proposed owner is not an active human member of this tenant. */
  | "owner-not-active-member";

/**
 * THE LONGEST A DEPARTMENT NAME MAY BE.
 *
 * `departments.name` is `text` with no database bound, so the bound is this constant's job — the
 * same reasoning `MAX_AGENT_NAME_LENGTH` records. Chosen to match the display surfaces that already
 * exist rather than an arbitrary round number.
 */
export const MAX_DEPARTMENT_NAME_LENGTH = 120;

/** The longest a slug may be. Shorter than the name: it is an identifier, not a label. */
export const MAX_DEPARTMENT_SLUG_LENGTH = 64;

/**
 * The slug shape, stated ONCE and repeated in the database as
 * `departments_slug_chk`. The two are pinned equal by a firewall test that reads both. A value the
 * database would admit but this rule does not is exactly the superset that would make the partial
 * unique index meaningless.
 */
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A name is accepted EXACTLY as given or refused. Nothing is trimmed, folded or repaired: a
 * repaired name is a different name, and this authority has no mandate to rename anybody's
 * department behind their back.
 */
export function isWellFormedDepartmentName(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_DEPARTMENT_NAME_LENGTH) return false;
  return value.trim() === value;
}

/** A slug is canonical or refused. There is no normalization step, by design. */
export function isWellFormedDepartmentSlug(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > MAX_DEPARTMENT_SLUG_LENGTH) return false;
  return SLUG_RE.test(value);
}

/**
 * The boundary, frozen so a test can read it and a later phase must change it deliberately.
 * Every field is a measurement of what OSA-1 actually did.
 */
export const ORGANIZATION_STRUCTURE_AUTHORITY_MODEL = Object.freeze({
  owns: Object.freeze(["department-identity", "department-lifecycle", "department-ownership"]),
  /** OSA writes exactly one table. */
  writesTables: Object.freeze(["departments"]),
  /** No Governance decision row is written by any OSA path. */
  writesGovernanceDecision: false as const,
  /** No `governance_domain` value was added. */
  governanceDomainAdded: false as const,
  /** OSA-1 ships no human roster read and no human-to-department assignment. */
  humanRoster: false as const,
  humanAssignment: false as const,
  /** The fact lives on `agents`, so its writer must be Agent Identity — not this authority. */
  agentAssignmentWriter: false as const,
  /** `organizations` is untouched, unpopulated, and made unrepresentable by CHECK. */
  organizationsActivated: false as const,
  limitation:
    "This authority records that a department exists, what it is called, whether it is in " +
    "service, and which human is accountable for it. It confers no permission, decides no " +
    "authorization, and cannot mutate any other subsystem's state.",
});
