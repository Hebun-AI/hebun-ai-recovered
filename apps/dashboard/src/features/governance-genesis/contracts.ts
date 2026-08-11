/*
 * governance-genesis/contracts.ts — the typed vocabulary of pre-Governance entitlement (G2.1).
 *
 * THREE FACTS, KEPT APART. Collapsing any two of these is the mistake this whole phase exists to
 * prevent:
 *
 *   AUTHENTICATION           "I proved this is Human A."           auth_credentials + sessions (D1)
 *   PRE-GOVERNANCE ENTITLEMENT "Human A is the nominated genesis   genesis_nominations  (HERE)
 *                               authority for Tenant T."
 *   GOVERNANCE AUTHORITY     "Governance recorded the bootstrap    decision_records.bootstrap (G2)
 *                             decision establishing authority."
 *
 * G2.1 owns only the middle one. An accepted nomination is the INPUT a future G2 phase will check
 * before it creates the genesis decision — it is never the decision, and it confers no authority by
 * itself.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/** The `audit_log.entity_type` this domain owns. Distinct from Knowledge's. */
export const GENESIS_NOMINATION_ENTITY_TYPE = "genesis_nomination";

/**
 * The ONLY mutation recorded in the shared audit sink by this phase.
 *
 * `governance.genesis-nomination.accepted` is the moment a verified human took on the entitlement.
 * It has a real, server-resolved human actor, so it can be attributed truthfully.
 *
 * Deliberately ABSENT — and this is the phase's most important audit decision:
 *
 *   `governance.genesis-nomination.created` is NOT written. `audit_log.actor_type` and
 *   `audit_log.actor_id` are both NOT NULL, and the operator ceremony is by design unable to say
 *   WHO performed it — deployment possession is the root, and Hebun cannot cryptographically
 *   identify the human at the terminal. Writing the nominated human as the actor would be a lie
 *   (they did not create it); inventing a `system` actor id would fabricate a principal that does
 *   not exist in any registry. The `genesis_nominations` row is itself the durable, timestamped
 *   record of the creation, carrying `nominated_at` and `nomination_source`. A ledger entry that
 *   cannot name its actor truthfully is worse than no ledger entry, so none is written.
 *
 *   `governance.genesis-nomination.revoked` is absent because no code path revokes.
 */
export type GenesisNominationAction = "governance.genesis-nomination.accepted";

export const GENESIS_NOMINATION_ACTIONS: readonly GenesisNominationAction[] = [
  "governance.genesis-nomination.accepted",
];

/**
 * WHICH ATTEMPTS BECOME PRE-GOVERNANCE HISTORY. A sibling of G1's
 * `KNOWLEDGE_AUDIT_BOUNDARY`, deliberately NOT an extension of it: that constant was reasoned for
 * Knowledge mutations and must keep meaning exactly what it meant. This one states its own rules,
 * so tightening or widening either never silently moves the other.
 */
export const GENESIS_AUDIT_BOUNDARY = Object.freeze({
  /** A verified human accepting their own nomination. Real actor, real tenant, real consequence. */
  recordsAcceptance: true as const,
  /** See `GenesisNominationAction` — no truthful actor exists for the operator ceremony. */
  recordsOperatorNomination: false as const,
  /** An unauthenticated caller must never be able to append to a tenant's ledger. */
  recordsUnauthenticatedAttempts: false as const,
  /**
   * A wrong human, a wrong tenant, or a replay is an event about a PRINCIPAL, not a change to the
   * tenant's entitlement — the same boundary G1 drew. It belongs to security telemetry, which is a
   * separate authority and is not connected.
   */
  recordsRefusedAttempts: false as const,
  rationale:
    "Pre-Governance history records the one moment entitlement actually changed: a verified human " +
    "accepting their nomination. The operator ceremony is not recorded here because audit_log " +
    "requires a non-null actor and deployment possession cannot name one truthfully; the " +
    "genesis_nominations row is that act's durable record instead.",
});

/**
 * What acceptance does NOT do. Stated as a VALUE, not prose in a comment, so the product surface
 * renders exactly what a test asserts — the consequence text cannot drift away from the truth.
 */
export const GENESIS_ACCEPTANCE_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not create a Governance decision",
  "does not ratify Knowledge",
  "does not approve company policy",
  "does not grant execution authority",
  "does not enable Computer Use",
  "does not enable providers",
  "does not change your application role",
  "does not create permissions",
]);

/**
 * The one thing acceptance DOES do. Also a value, for the same reason.
 */
export const GENESIS_ACCEPTANCE_EFFECT =
  "records that you are the human eligible to establish this tenant's first Governance authority";

/**
 * The assurance level this ceremony is performed at, and the honest limits of that.
 *
 * D1 issues `aal1` with `mfaVerified = false` and nothing else exists — there is no MFA, SSO,
 * passkey or step-up anywhere in the system. The Director explicitly accepted aal1 for the current
 * development-stage bootstrap. This constant exists so no later phase can quietly narrate the
 * ceremony as having been strongly authenticated.
 */
export const GENESIS_ACCEPTANCE_ASSURANCE = Object.freeze({
  acceptedAssuranceLevel: "aal1" as const,
  mfaRequired: false as const,
  stepUpImplemented: false as const,
  directorAcceptedForDevelopmentStage: true as const,
  limitation:
    "Acceptance is authorised at aal1 (single-factor, mfaVerified=false). This is a constitutional " +
    "act performed at the lowest assurance level the standard defines, accepted deliberately for " +
    "this development stage. Production Governance may later require step-up or MFA.",
});

/**
 * The external root of trust for the nomination half, stated where code can read it.
 *
 * Be precise about what this is NOT: not a verified platform admin, not a certified operator, not
 * any Governance authority. It is possession of the deployment — the same assumption D1.1's
 * credential provisioning already rests on.
 */
export const GENESIS_OPERATOR_ROOT = Object.freeze({
  root: "local-deployment-possession" as const,
  operatorIdentityVerified: false as const,
  isPlatformAdminAuthority: false as const,
  isGovernanceAuthority: false as const,
  limitation:
    "Hebun cannot cryptographically identify which human operates the terminal. Creating a pending " +
    "nomination is authorised by possession of the local deployment and nothing else. This is a " +
    "deliberate bootstrap root-of-trust assumption for this stage.",
});

/** Why an acceptance attempt ended the way it did. A closed set — no free-text excuses. */
export type GenesisAcceptanceRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant has no nomination at all. */
  | "no-nomination"
  /** A nomination exists for this tenant, but it names a different human. */
  | "not-the-nominated-human"
  /** Already accepted. Acceptance is one-time; a replay changes nothing. */
  | "already-accepted"
  /** Revoked nominations can never be accepted. */
  | "revoked"
  /** The durable store is not configured or could not be read. */
  | "persistence-unavailable";

export type GenesisAcceptanceResult =
  | { readonly status: "accepted"; readonly nominationId: string; readonly acceptedAt: string }
  | { readonly status: "refused"; readonly reason: GenesisAcceptanceRefusal };

/** What the acceptance surface may know. Identity references only — never credential material. */
export interface GenesisNominationView {
  readonly nominationId: string;
  readonly status: "pending" | "accepted" | "revoked";
  readonly nominatedAt: string;
  readonly acceptedAt: string | null;
  /** True only when the CURRENTLY authenticated human is the nominated one. */
  readonly viewerIsNominatedHuman: boolean;
}

export type GenesisNominationLookup =
  | { readonly status: "read"; readonly nomination: GenesisNominationView | null }
  | { readonly status: "unavailable"; readonly reason: "no-authorized-tenant-context" | "persistence-unavailable" };
