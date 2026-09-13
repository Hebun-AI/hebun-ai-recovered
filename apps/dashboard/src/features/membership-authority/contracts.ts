/*
 * membership-authority/contracts.ts — the typed vocabulary of "who may admit a human" (I1).
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONE IT REFUSES:
 *
 *   ANSWERED   Who is legitimately authorized to permit a new human into a tenant?
 *   REFUSED    How does that human actually arrive? (I2 — invitation, token, acceptance,
 *              credential, identity, membership. None of it exists here.)
 *
 * WHY THIS IS NOT `authority-delegation`. Admitting a human and moving Governance authority are
 * different constitutional acts. A delegation makes someone able to decide; an authorized
 * membership makes someone able to log in and hold an ordinary application role. Filing both under
 * one domain would make the ledger unable to distinguish "we let a person in" from "we handed over
 * the constitution".
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * The `governance_domain` this phase activates. A new enum member, authorized at Gate B, because
 * none of the twelve existing domains could carry membership semantics honestly:
 * `agent-registration` is false for a human, and `authority-delegation` would assert that admitting
 * a human IS delegating Governance authority — the exact conflation this phase must not make.
 */
export const MEMBERSHIP_AUTHORIZATION_DOMAIN = "membership-authorization" as const;

/**
 * The `governance_decision_type`. An EXISTING enum member — no decision-type vocabulary was added.
 *
 * `approve` and not `certify`, `promote` or `delegate-authority`: certification attests a standing
 * that already exists, promotion raises one, delegation moves authority. This grants none of those.
 * It approves a proposed future act.
 */
export const MEMBERSHIP_AUTHORIZATION_DECISION_TYPE = "approve" as const;

/** The `decision_records.subject_type` for this decision. The subject is the durable artifact. */
export const MEMBERSHIP_AUTHORIZATION_SUBJECT_TYPE = "membership_authorization" as const;

/** `decision_records.outcome` is free text; this is the only value I1 ever writes. */
export const MEMBERSHIP_AUTHORIZATION_OUTCOME = "membership-authorized" as const;

/** The `audit_log.action` this phase owns. Distinct from every other governance action. */
export const MEMBERSHIP_AUTHORIZATION_AUDIT_ACTION = "governance.membership.authorized" as const;

/**
 * WHICH ROLE TYPES MAY BE THE TARGET OF AN ONBOARDING AUTHORIZATION.
 *
 * `member` only, and the reasoning is on disk rather than assumed:
 *
 *   owner / director  — the two bands every connected authority check in the repository already
 *                       treats as privileged (`KNOWLEDGE_AUTHOR_ROLE_TYPES`,
 *                       `PROVIDER_CONTROL_ROLE_TYPES`). Onboarding directly into either would let
 *                       one Governance decision hand out Knowledge authorship and provider control
 *                       in a single step. Refused.
 *   operator / auditor — audited and found to carry NO connected privilege anywhere: no runtime
 *                       reads either band for any grant. They are also not defined by any runtime,
 *                       so admitting a human into an undefined band is not safer than refusing —
 *                       it is merely less legible. Excluded until they mean something.
 *   member            — the `roleTypeEnum` default and the only band whose meaning is "an ordinary
 *                       participant with no special authority". Permitted.
 *
 * Widening this set is a Governance decision, not a convenience — the same doctrine
 * `KNOWLEDGE_AUTHOR_ROLE_TYPES` states about its own band list.
 */
export type OnboardingEligibleRoleType = "member" | "owner";

/**
 * The single source of truth for the eligible bands. The Set below is derived from it.
 *
 * ── WHY `owner` JOINED, AND WHAT THAT COST ────────────────────────────────────
 *
 * `owner` was on the exclusion list below, and the repository was consistent about it: tenant
 * provisioning recorded that an owner "can only ever come from tenant birth". That was true and it
 * was also a dead end. A tenant whose only owner must be replaced had NO released path to a second
 * one: provisioning refuses an existing slug, the first-human ceremony refuses once any user exists,
 * and the sole membership UPDATE writer only ever revokes. So the last-owner guard — correctly —
 * made such a tenant permanently unable to change hands.
 *
 * Widening this set was named by this file's own doctrine as "a Governance decision, not a
 * convenience", and it was taken as one: a Director decision to make owner onboarding a governed,
 * repeatable capability rather than a one-off.
 *
 * WHAT DID NOT CHANGE. The authorization still resolves through `resolveGovernanceAuthority`, the
 * role is still resolved server-side from the tenant's OWN active roles, the permit still carries
 * it, and acceptance re-checks it. `director`, `operator` and `auditor` remain excluded — this is
 * two named bands, not "any role".
 */
export const ELIGIBLE_ROLE_TYPE_LIST: readonly OnboardingEligibleRoleType[] = Object.freeze([
  "member",
  "owner",
]);

export const ONBOARDING_ELIGIBLE_ROLE_TYPES: ReadonlySet<string> = Object.freeze(
  new Set<string>(ELIGIBLE_ROLE_TYPE_LIST),
);

/** Stated so the surface and the tests read the same list. */
/**
 * The `roles.type` value that means "can administer this tenant".
 *
 * It lives here because this module owns the onboarding band vocabulary, and because two different
 * rules now need it: which bands may be onboarded, and who is senior enough to authorize the owner
 * one. Spelled once so those two rules cannot drift apart.
 */
export const OWNER_ROLE_TYPE = "owner" as const;

export const ONBOARDING_EXCLUDED_ROLE_TYPES: readonly string[] = Object.freeze([
  "director",
  "operator",
  "auditor",
]);

/** Same bound as `invitations.normalized_email`, so the two tables cannot disagree. */
export const NORMALIZED_EMAIL_MAX_LENGTH = 320;

export type MembershipAuthorizationRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant has no bootstrap decision: Governance does not exist here yet. */
  | "no-governance-authority"
  /** Authenticated, but holds neither bootstrap nor an unrevoked delegation. */
  | "not-the-governance-authority"
  /** Missing, malformed, or over-long email for the intended human. */
  | "invalid-target-email"
  /** Justification missing, too short, or too long. */
  | "justification-required"
  /** The named role does not exist inside the caller's tenant. */
  | "role-unresolvable"
  /**
   * The role exists but its band may not be onboarded into. Distinct from
   * `role-unresolvable` on purpose: refusing to say "that role exists but is too
   * privileged" would make a legitimate authority debug by guessing.
   */
  | "role-not-eligible"
  /**
   * THE BAND IS ELIGIBLE, BUT THIS CALLER IS NOT SENIOR ENOUGH TO AUTHORIZE IT.
   *
   * Only `owner` reaches this today. A Governance DELEGATE may authorize a `member`, because a
   * member carries no connected privilege anywhere; it may not authorize an `owner`, because an
   * owner is a tenant-level privilege boundary and delegation must not quietly become the power to
   * mint additional owners. Bootstrap authority — the tenant's genesis actor — may authorize both.
   *
   * Distinct from `not-the-governance-authority`, which means "no Governance authority at all". A
   * delegate genuinely holds Governance authority; collapsing the two would tell a legitimate
   * delegate they are not an authority, and they would debug the wrong thing.
   */
  | "owner-requires-bootstrap-authority"
  /**
   * The tenant holds no role of an eligible band at all. This is NOT the caller's
   * mistake and is reported separately: it is the tenant role-baseline gap, and I1
   * deliberately refuses rather than creating a role to paper over it.
   */
  | "no-eligible-role-in-tenant"
  /** A live authorization already exists for this intended human in this tenant. */
  | "already-authorized"
  /** The durable store is not configured, or the transaction failed. */
  | "persistence-unavailable";

export type MembershipAuthorizationResult =
  | {
      readonly status: "authorized";
      readonly authorizationId: string;
      readonly decisionId: string;
      readonly sessionId: string;
      readonly authorizedAt: string;
    }
  | { readonly status: "refused"; readonly reason: MembershipAuthorizationRefusal };

/**
 * What authorizing a membership DOES and DOES NOT do. Values rather than prose, so the surface
 * renders exactly what a test asserts — the same shape as `BOOTSTRAP_NON_EFFECTS`.
 */
export const MEMBERSHIP_AUTHORIZATION_EFFECT =
  "records that Governance has authorized ONE future onboarding of this human into this tenant " +
  "with this role";

export const MEMBERSHIP_AUTHORIZATION_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not create the account now",
  "does not send an invitation",
  "does not create an invitation token",
  "does not create a credential",
  "does not create a user or identity",
  "does not create the membership",
  "does not create or change any role",
  "does not grant Governance authority",
  "does not grant Knowledge ratification authority",
  "does not grant provider access or change the model kill-switch",
  "does not grant execution, Computer Use, or terminal authority",
]);

/**
 * THE ROLE-BASELINE GAP — recorded at I1, CLOSED by I1.1.
 *
 * WHAT WAS TRUE AT I1 CLOSURE, and is not erased by the fact that it is no longer true. I1 refuses
 * when a tenant holds no onboarding-eligible role, and at that moment nothing in the repository
 * could provision one. Creating a `member` role inside I1 would have hidden the absence behind a
 * convenience, and every fixture that silently added one would have hidden it again in the tests —
 * so I1 refused instead. That refusal is unchanged: `insert(roles)` appears nowhere in I1's runtime,
 * and a test still asserts it never will.
 *
 * WHAT CLOSED IT. I1.1 Tenant Role Baseline Authority provisions exactly the missing role —
 * `provisionMemberRole` writes one `type = 'member'` role under a Governance decision, at most once
 * per tenant, enforced by the partial unique index `roles_one_member_per_tenant_uq`. I1 then finds
 * that role through its ordinary eligible-role read. No I1 code changed, and none needed to.
 *
 * THE DISTINCTION THIS CONSTANT EXISTS TO KEEP. A tenant that has not run the I1.1 ceremony still
 * holds no member role, so I1 still refuses it with `no-eligible-role-in-tenant`. That is an
 * UNEXERCISED CEREMONY, not a missing capability, and the two must never be reported as one thing.
 */
export const TENANT_ROLE_BASELINE_GAP = Object.freeze({
  /** Can the repository provision a tenant's role baseline at all? Since I1.1: yes. */
  capabilityPresent: true as const,
  /** Has the ceremony actually been run in the durable development tenants? Not yet. */
  provisionedInDurableTenants: false as const,
  /*
   * Named as an authority and a surface, never as an importable symbol: a firewall in
   * `tests/i1-1-flow` forbids this module from containing the provisioning runtime's identifiers at
   * all, so that I1 cannot reach it even by accident. Recording who owns the gap does not require
   * being able to call them.
   */
  owner:
    "I1.1 Tenant Role Baseline Authority — the Member Role Provisioning control, taken as a " +
    "Governance decision and constrained to one `member` role per tenant by the partial unique " +
    "index `roles_one_member_per_tenant_uq`",
  observedRealityAt: "2026-08-12",
  observation:
    "Both durable development tenants still hold exactly one role row, of type `owner`, because " +
    "the I1.1 provisioning ceremony has not been run for either of them. Until it is, membership " +
    "authorization in those tenants refuses with `no-eligible-role-in-tenant`.",
  remedy:
    "Provision this organization's member role with the Member Role Provisioning control above. " +
    "It is a Governance decision, it may be taken once, and it adds no human and grants no " +
    "authority.",
  consequence:
    "I1 authority is complete and provable, and product onboarding IS reachable end to end once a " +
    "tenant has run the I1.1 ceremony: I1.1 provisions the role, I1 authorizes the membership, " +
    "I1.2 enrolls the identity and credential, I2 creates the membership, and Tenant Selection " +
    "resolves which workspace the human opens.",
  /**
   * The superseded I1-era statement, kept verbatim so the record shows what was claimed and when,
   * rather than presenting today's truth as though it had always held.
   */
  historicalLimitation: Object.freeze({
    statedAt: "I1 closure, 2026-08-12",
    owner: "none — no runtime provisions a tenant's roles",
    consequence:
      "I1 authority is complete and provable. Product onboarding is NOT reachable end to end " +
      "until a tenant role baseline phase exists, and I2 cannot close that gap by itself.",
    supersededBy: "I1.1 Tenant Role Baseline Authority, 2026-08-12",
  }),
});
