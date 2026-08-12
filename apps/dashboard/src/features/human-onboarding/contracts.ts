/*
 * human-onboarding/contracts.ts — the typed vocabulary of I2.
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   How does a Governance-authorized prospective membership become a durable membership?
 *   REFUSED    Who may be admitted?      (I1 — membership_authorizations. Already decided.)
 *   REFUSED    Which roles exist?        (I1.1 — the tenant's ordinary member role.)
 *   REFUSED    Who is this human?        (I1.2 / Identity + Credential authority.)
 *   REFUSED    Which tenant is active?   (Session authority. Untouched.)
 *
 * I2 IS AN ORCHESTRATOR. It owns exactly one new canonical truth — the invitation — and calls
 * everything else. It never creates a user, an identity, a credential, a role, a session or a
 * Governance grant, and the modules that own those are not imported.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * The `audit_log.action` values this phase owns. Distinct from every other domain's.
 *
 * Issuance is recorded because minting a bearer capability is a consequential act with a real
 * accountable actor. Acceptance is recorded because a human joined an organization. Neither is a
 * Governance DECISION — the decision was already made at I1 — so neither writes `decision_records`.
 */
export const INVITATION_ISSUED_ACTION = "onboarding.invitation.issued" as const;
export const MEMBERSHIP_CREATED_ACTION = "onboarding.membership.created" as const;

/** The `audit_log.entity_type` this phase owns. */
export const ONBOARDING_ENTITY_TYPE = "invitation" as const;

/**
 * How long an issued capability stays usable. A constant, not a client input: a caller that could
 * choose the window could choose "never expires".
 */
export const INVITATION_LIFETIME_HOURS = 72;

/**
 * WHICH ROLE BANDS AN ONBOARDING MAY PRODUCE.
 *
 * `member` only, and NOT re-derived here: this is I1's `ELIGIBLE_ROLE_TYPE_LIST`, re-checked at
 * acceptance because the authorization was written at a different moment and a role's band is the
 * one fact that must still be true when the membership is finally created. Widening this set is
 * I1's decision to make, not I2's.
 */
export const ONBOARDING_MEMBERSHIP_ROLE_TYPE = "member" as const;

/* ── ACT A — INVITATION ISSUANCE ───────────────────────────────────────────── */

export type InvitationIssuanceRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant has no bootstrap decision: Governance does not exist here yet. */
  | "no-governance-authority"
  /** Authenticated, but holds neither bootstrap nor an unrevoked delegation. */
  | "not-the-governance-authority"
  /** No live authorization with that id inside the caller's tenant. Cross-tenant looks identical. */
  | "authorization-unresolvable"
  /** The authorization exists but has already produced an invitation, or was revoked. */
  | "authorization-not-live"
  /** The authorization names a role whose band may not be onboarded into. */
  | "role-not-eligible"
  /** A pending invitation already exists for this human in this tenant. */
  | "invitation-already-pending"
  /** Somebody else spent the authorization inside the window. */
  | "authorization-already-consumed"
  | "persistence-unavailable";

export type InvitationIssuanceResult =
  | {
      readonly status: "issued";
      readonly invitationId: string;
      /**
       * The bearer capability, returned ONCE and never stored. Hebun has no mail runtime, so this
       * is handed to the issuing Governance authority who delivers it out of band. Issuing is not
       * delivering, and nothing in this phase claims otherwise.
       */
      readonly capability: string;
      readonly expiresAt: string;
      readonly issuedAt: string;
    }
  | { readonly status: "refused"; readonly reason: InvitationIssuanceRefusal };

/* ── ACT B — INVITATION ACCEPTANCE ─────────────────────────────────────────── */

export type InvitationAcceptanceRefusal =
  /**
   * ONE reason for every authentication-shaped failure: unknown email, no credential, wrong
   * password, locked credential, and an authenticated human who is not the invited one. Any
   * externally visible difference between them is an account-enumeration or invitation-probing
   * oracle, so they are indistinguishable in both value and timing.
   */
  | "not-acceptable"
  /** The capability matches no invitation, or is malformed. */
  | "capability-unrecognized"
  /** The invitation exists but is not usable: expired, revoked, or already accepted. */
  | "capability-not-usable"
  /** The human already belongs to this tenant. */
  | "already-a-member"
  /** The authorization behind this invitation is no longer in the state acceptance requires. */
  | "authorization-provenance-broken"
  /** The intended role is gone or its band is no longer eligible. */
  | "role-not-eligible"
  | "persistence-unavailable";

export type InvitationAcceptanceResult =
  | {
      readonly status: "accepted";
      readonly membershipId: string;
      readonly tenantId: string;
      readonly userId: string;
      readonly roleId: string;
      readonly invitationId: string;
      readonly membershipAuthorizationId: string;
      readonly acceptedAt: string;
    }
  | { readonly status: "refused"; readonly reason: InvitationAcceptanceRefusal };

/* ── WHAT THIS PHASE DOES AND DOES NOT DO ──────────────────────────────────── */

export const ONBOARDING_EFFECT =
  "turns ONE Governance-authorized prospective membership into a durable membership, by issuing a " +
  "bearer capability against that authorization and creating the membership when the invited human " +
  "proves they are the human the authorization named";

export const ONBOARDING_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not create a user",
  "does not create an auth identity",
  "does not create a credential",
  "does not create or change any role",
  "does not issue any session",
  "does not change what a normal tenant session requires",
  "does not grant Governance authority",
  "does not grant Knowledge ratification or authoring authority",
  "does not grant provider access or change the model kill-switch",
  "does not grant execution, Computer Use, or terminal authority",
  "does not send the invitation anywhere",
  "does not verify that the invited human controls the invited email address",
  /* Choosing which workspace to enter belongs to Tenant Selection Authority, not to onboarding. */
  "does not choose which workspace you enter — sign-in asks you that",
]);

/**
 * THE ISSUANCE / DELIVERY DISTINCTION, as a value so a surface renders exactly what a test asserts.
 *
 * Hebun mints the capability and hands it back to the authority who asked for it. What happens next
 * is outside the system, exactly as G2.1's operator ceremony is. Any wording that implies an email
 * was sent would be false.
 */
export const DELIVERY_REALITY = Object.freeze({
  issued: "Hebun created the invitation and returned the capability once, to you.",
  delivered: false as const,
  deliveryOwner: "none — Hebun has no mail runtime and sends nothing",
  operatorObligation:
    "You must hand this capability to the intended human yourself, through a channel you trust. " +
    "Anyone who holds it can attempt to join, and it cannot be shown again.",
});

/**
 * THE CONSUMPTION MEANING, stated where a reader will look for it.
 *
 * `membership_authorizations.consumed_by_invitation_id` is a foreign key to the INVITATION, so the
 * schema's own answer is that an authorization is spent the moment it produces an invitation — not
 * when the invitation is later accepted. I2 preserves that meaning rather than redefining it: a
 * lapsed invitation does NOT un-spend its authorization, and re-inviting is a fresh Governance
 * decision. This is the same shape G2 uses for `genesis_nominations.consumed_by_decision_id`.
 */
export const CONSUMPTION_SEMANTICS = Object.freeze({
  consumedAt: "invitation issuance" as const,
  consumedBy: "the invitation the authorization produced" as const,
  reInviteRequires: "a new Governance decision, because the authorization is already spent" as const,
});

/**
 * TENANT ACCESS AFTER A MEMBERSHIP EXISTS.
 *
 * I2 closed with a documented limitation here: `findPrimaryActiveMembership` resolves the OLDEST
 * active membership, so a human who already belonged somewhere gained a real, correct membership
 * they could not enter. **Tenant Selection Authority resolved it**, and this constant was updated
 * rather than left to describe a world that no longer exists.
 *
 * What is still true and still I2's to state: creating a membership is not the same act as entering
 * a tenant. Sign-in now ASKS when there is more than one, instead of guessing.
 */
export const TENANT_ACCESS_REALITY = Object.freeze({
  firstMembership: "reachable — a sole membership is resolved directly at sign-in" as const,
  additionalMembership:
    "reachable — a human with several memberships is asked to choose a workspace at sign-in" as const,
  chosenBy: "Tenant Selection Authority, at sign-in; the human picks, the server revalidates" as const,
  stillNotImplemented:
    "switching workspace from inside an already-authorized session — sign out and in again" as const,
});
