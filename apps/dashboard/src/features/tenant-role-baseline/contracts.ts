/*
 * tenant-role-baseline/contracts.ts — the typed vocabulary of provisioning a tenant's ordinary
 * member role (I1.1).
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   Who may establish the tenant's ordinary, onboarding-eligible `member` role?
 *   REFUSED    Role editing, deletion, suspension, renaming, hierarchy, permissions, arbitrary role
 *              creation, and any role of a privileged band. None of them exists here.
 *
 * WHY THIS IS NOT `membership-authorization`. Admitting a human and changing the tenant's role
 * structure are different organizational acts. I1 names an existing role; I1.1 creates the one that
 * makes naming possible. Filing both under one domain would make the ledger unable to distinguish
 * "we let a person in" from "we changed what kinds of people exist here".
 *
 * WHY THIS IS NOT ROLE ADMINISTRATION. Exactly one role type may be provisioned, exactly once per
 * tenant, and the database enforces the "once". There is no name parameter, no type parameter, no
 * scope parameter and no update path — a generic role writer is not merely unused here, it is
 * unrepresentable.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * The `governance_domain` this phase activates. A new enum member, authorized at Gate B, because
 * no existing domain could carry organizational-structure semantics honestly.
 */
export const ORGANIZATIONAL_ROLE_DOMAIN = "organizational-role" as const;

/** The `governance_decision_type`. An EXISTING enum member — no decision type was added. */
export const ORGANIZATIONAL_ROLE_DECISION_TYPE = "approve" as const;

/** The `decision_records.subject_type`. The subject is the exact role row being created. */
export const ORGANIZATIONAL_ROLE_SUBJECT_TYPE = "role" as const;

/** `decision_records.outcome` is free text; this is the only value I1.1 ever writes. */
export const ORGANIZATIONAL_ROLE_OUTCOME = "organizational-role-provisioned" as const;

/** The `audit_log.action` this phase owns. */
export const ORGANIZATIONAL_ROLE_AUDIT_ACTION = "governance.role.provisioned" as const;

/**
 * THE ONLY ROLE TYPE I1.1 MAY CREATE.
 *
 * Not a parameter, not a default, not a client input — a constant. The privileged bands
 * (`owner`, `director`) are excluded because connected authorities already grant on them
 * (`KNOWLEDGE_AUTHOR_ROLE_TYPES`, `PROVIDER_CONTROL_ROLE_TYPES`); `operator` and `auditor` are
 * excluded because no runtime defines them at all, and provisioning into an undefined band is not
 * safer than refusing.
 */
export const BASELINE_ROLE_TYPE = "member" as const;

/**
 * The role's display name. Fixed, because a name parameter is the first step toward arbitrary role
 * creation and this phase is deliberately not that.
 */
export const BASELINE_ROLE_NAME = "Member" as const;

export type RoleBaselineRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant has no bootstrap decision: Governance does not exist here yet. */
  | "no-governance-authority"
  /** Authenticated, but holds neither bootstrap authority nor an unrevoked delegation. */
  | "not-the-governance-authority"
  /** Justification missing, too short, or too long. */
  | "justification-required"
  /**
   * The tenant already has its ordinary member role. NOT an error and NOT a reason to make a
   * second one — the existing role, however it got there, stays exactly as it is.
   */
  | "already-provisioned"
  /** The durable store is not configured, or the transaction failed. */
  | "persistence-unavailable";

export type RoleBaselineResult =
  | {
      readonly status: "provisioned";
      readonly roleId: string;
      readonly decisionId: string;
      readonly sessionId: string;
      readonly provisionedAt: string;
    }
  | { readonly status: "refused"; readonly reason: RoleBaselineRefusal };

/**
 * What provisioning the member role DOES and DOES NOT do. Values rather than prose, so the surface
 * renders exactly what a test asserts.
 */
export const ROLE_BASELINE_EFFECT =
  "establishes this organization's ordinary member role, the least-authority role a new person can " +
  "hold";

export const ROLE_BASELINE_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not add a human",
  "does not create a membership",
  "does not create an invitation",
  "does not create a credential, user, or identity",
  "does not grant Governance authority",
  "does not grant Knowledge authoring authority",
  "does not grant provider access or change the model kill-switch",
  "does not grant execution, Computer Use, or terminal authority",
  "does not change the owner role, or any existing role",
  "does not create permissions or a role hierarchy",
]);

/**
 * WHAT THE PROVISIONED ROLE MEANS, stated as values so no surface can inflate it.
 *
 * Audited rather than assumed: `member` appears in NO connected authority set in the repository.
 * `KNOWLEDGE_AUTHOR_ROLE_TYPES` and `PROVIDER_CONTROL_ROLE_TYPES` are the only role-band grants
 * that exist, and both are `{owner, director}`. A test asserts that, so if a later phase ever
 * grants something to `member`, this claim fails the build instead of silently becoming false.
 */
export const BASELINE_ROLE_SEMANTICS = Object.freeze({
  grantsGovernanceAuthority: false as const,
  grantsKnowledgeAuthoring: false as const,
  grantsProviderControl: false as const,
  grantsExecution: false as const,
  grantsPlatformAdministration: false as const,
  grantsMembershipAuthority: false as const,
  grantsRoleAdministration: false as const,
  usesPermissionTables: false as const,
  usesAuthorityRank: false as const,
  usesPolicyRefs: false as const,
  meaning:
    "Ordinary tenant membership. It makes a human a participant in the organization and nothing " +
    "more; every privileged capability in Hebun is granted by a Governance decision, never by a " +
    "role band.",
});

/**
 * THE UNIQUENESS INVARIANT, as a value the surface and the tests share.
 *
 * Constitutional per Director Gate A (Q2, Option A) and enforced by
 * `roles_one_member_per_tenant_uq` — a PARTIAL unique index over `tenant_id` where
 * `type = 'member'`, so privileged bands stay unconstrained.
 */
export const BASELINE_UNIQUENESS = Object.freeze({
  constraint: "roles_one_member_per_tenant_uq",
  scope: "tenant" as const,
  rule: "A tenant may hold at most one ordinary member role.",
  enforcedBy: "postgres-partial-unique-index" as const,
  /**
   * An honest edge the phase does not solve: the index has no lifecycle predicate, so if a member
   * role ever became non-active it would still occupy the slot while I1's active-only read would
   * stop seeing it. No runtime can reach that state today — I1.1 implements no role deletion,
   * suspension or revocation — and inventing lifecycle handling for an unreachable state would be
   * building the role administration this phase deliberately refuses.
   */
  lifecyclePredicate: "none" as const,
});
