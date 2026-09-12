/*
 * membership-lifecycle/contracts.ts — the vocabulary for ending ONE membership.
 *
 * ── WHY THIS IS A NEW FAMILY AND NOT AN ADDITION TO `membership-authority` ──
 *
 * `membership-authority` sounds like the home for this and is not. It owns the
 * `membership_authorizations` table — a Governance PERMIT for a future human to be onboarded — and
 * its own header states that it "never creates a user, an auth identity, a credential, an
 * invitation, a token, a membership or a role". Writing the `memberships` table from inside a
 * module that declares it never touches memberships is the exact shape of contradiction that
 * produced the K2 `record-account-changed` defect: a flow doing something its stated authority
 * denied.
 *
 * A permit to JOIN and the END of a membership are two lifecycles over two tables. They get two
 * modules.
 */

/** The audited fact. Namespaced under `governance.` because ending a membership needs authority. */
export const MEMBERSHIP_REVOKED_AUDIT_ACTION = "governance.membership.revoked" as const;

/** The audit subject is the membership row itself, never the user and never the tenant. */
export const MEMBERSHIP_ENTITY_TYPE = "membership" as const;

/** Bounded by `memberships.revocation_reason`, which is `varchar(128)`. */
export const REVOCATION_REASON_MAX_LENGTH = 128;

/**
 * The `roles.type` value that means "can administer this tenant".
 *
 * ── WHY THIS IS SPELLED HERE RATHER THAN IMPORTED ────────────────────────────
 *
 * The same string lives in the tenant provisioning vocabulary as `BOOTSTRAP_ROLE_TYPE`, and importing
 * it was the first instinct. A released R4A firewall refused that: it keeps an exhaustive census of
 * every file in `src/` that references tenant provisioning, precisely so "a third module appearing
 * is a decision somebody has to record here rather than a quiet second bootstrap path". This module
 * is not a bootstrap path, and adding it to a census about bootstrap paths would blur what that
 * census means.
 *
 * The boundary was kept and the drift risk was answered a different way: `tests/membership-lifecycle`
 * imports BOTH constants and asserts they are equal. A test may reference provisioning freely — the
 * census scans `src/` only — so the two strings cannot silently diverge.
 */
export const OWNER_ROLE_TYPE = "owner" as const;

export type RevokeMembershipRefusal =
  /** No authenticated tenant context. */
  | "no-authorized-tenant-context"
  /** The caller does not hold Governance authority in this tenant. */
  | "not-authorized"
  /** Persistence is not configured for this process. */
  | "persistence-not-configured"
  /** Malformed identifier, or a reason longer than the column allows. */
  | "invalid-input"
  /**
   * No such membership FOR THIS TENANT. A membership belonging to another tenant answers with this
   * too — absence and inaccessibility are deliberately indistinguishable, because any difference is
   * an oracle for probing another organization's roster.
   */
  | "not-found"
  /** The row moved under the caller between read and write. */
  | "version-conflict"
  /** The membership is not `active`, so there is no active membership to end. */
  | "not-active"
  /**
   * REVOKING THIS WOULD LEAVE THE TENANT WITH NO ACTIVE OWNER.
   *
   * Refused rather than performed, because no operator-recovery authority exists in this repository
   * to undo it: `memberships` has exactly two writers and both are INSERT, so a tenant with zero
   * active owners could not be given one back through any released path. See the authority header.
   */
  | "would-strand-tenant";

export type RevokeMembershipResult =
  | {
      readonly status: "revoked";
      readonly membershipId: string;
      /** The row's version AFTER the transition, for a caller that wants to prove which write won. */
      readonly version: number;
      readonly revokedAt: string;
    }
  /** Already revoked. Reported distinctly from a fresh revocation, and it is NOT an error. */
  | { readonly status: "already-revoked"; readonly membershipId: string }
  | { readonly status: "refused"; readonly reason: RevokeMembershipRefusal };
