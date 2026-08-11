/*
 * governance-decision/delegation-contracts.ts — the typed vocabulary of Governance authority
 * delegation and revocation (G3).
 *
 * WHAT G3 CHANGES, IN ONE SENTENCE. Governance authority stops being permanently locked to the
 * bootstrap human: an already-authorized human may explicitly delegate it, and an authorized human
 * may explicitly revoke a delegation — both as durable Governance decisions, both reversible only
 * by another decision, and neither ever deleting history.
 *
 * THE AUTHORITY SET, AFTER G3:
 *
 *   H holds Governance authority in tenant T  ⟺
 *       H is the actor on T's bootstrap decision                                  (G2, permanent)
 *     OR ∃ committed `delegate-authority` decision in T whose subject is H,
 *        AND no committed `revoke` decision in T names that delegation.           (G3)
 *
 * There is NO second source of truth. Authority is a query over immutable Governance decisions, not
 * a row somebody keeps in sync. The chain terminates at the bootstrap decision, which terminates at
 * G2.1's consumed entitlement, which terminates outside the application at deployment possession.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * The decision types G3 activates. Deliberately two.
 *
 * These are EXISTING `governance_decision_type` enum values that had zero readers and zero writers
 * before this phase — G2's own contracts named them as the reason authority was non-transferable:
 * "authority moves ONLY by a Governance decision — and that runtime is deliberately not built."
 * G3 is that runtime, and it invented no vocabulary.
 *
 * Still absent, because they still have no runtime: `escalate-authority`, `suspend`, `appeal`,
 * `promote`, `approve`.
 */
export type AuthorityDecisionType = "delegate-authority" | "revoke";

export const AUTHORITY_DECISION_TYPES: readonly AuthorityDecisionType[] = [
  "delegate-authority",
  "revoke",
];

/**
 * The subjects an authority decision binds to.
 *
 *   `user`                — a delegation names the human RECEIVING authority, by `users.id`: the
 *                           canonical `actor_id` for `actor_type = 'human'` everywhere in the
 *                           schema. Never an email, which changes; never a role, which grants
 *                           nothing.
 *   `governance_decision` — a revocation names the DELEGATION DECISION it ends, by row id. Not the
 *                           human: a human may hold several grants over time, and "revoke the
 *                           person" would be ambiguous about which one ended.
 *
 * `subject_type` is `text` in the schema, so adding these cost no migration.
 */
export type AuthoritySubjectType = "user" | "governance_decision";

export const AUTHORITY_SUBJECT_TYPES: readonly AuthoritySubjectType[] = [
  "user",
  "governance_decision",
];

/** `decision_records.outcome` is free text; these are the only values G3 writes. */
export const DELEGATION_OUTCOME = "authority-delegated" as const;
export const REVOCATION_OUTCOME = "authority-revoked" as const;

/**
 * THE REVOCATION POLICY, AS DECIDED BY THE DIRECTOR AT GATE A (A1-c / A2-a / A3-a).
 *
 * The repository could not derive these. `governance.ts` establishes that Governance owns the
 * revoke verb but never says which holder may revoke which grant, so they were put to the Director
 * rather than guessed, and the answers are recorded here as values a test can assert.
 */
export const AUTHORITY_REVOCATION_POLICY = Object.freeze({
  /** A1-c — the bootstrap human may revoke ANY delegation in their tenant. */
  bootstrapMayRevokeAnyDelegation: true as const,
  /** A1-c — a delegate may revoke ONLY delegations they personally granted. */
  delegateMayRevokeOwnGrantsOnly: true as const,
  /** A1-c — peers cannot depose each other. */
  delegateMayRevokePeerGrants: false as const,
  /** A2-a — genesis is constitutional. G3 implements no path to end or move it. */
  bootstrapAuthorityRevocable: false as const,
  bootstrapAuthorityTransferable: false as const,
  /** A3-a — with a permanent bootstrap authority, an empty tenant is unreachable. */
  zeroAuthorityTenantReachable: false as const,
  rationale:
    "The bootstrap human may revoke any delegation because genesis is the tenant's constitutional " +
    "root. A delegate may revoke only what they themselves granted, so accountability follows the " +
    "grant and peers cannot depose one another. Bootstrap authority is neither revocable nor " +
    "transferable in G3; authority transfer is a separate Director phase.",
});

/**
 * WHAT DELEGATION IS AND IS NOT. Values, not prose, so the surface renders exactly what a test
 * asserts and the wording cannot drift from the code.
 */
export const DELEGATION_EFFECT =
  "grants this human the same Governance decision authority you hold, within this tenant only";

export const DELEGATION_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not change their authentication or password",
  "does not change their membership",
  "does not change their organizational role",
  "does not grant Knowledge ownership or authoring rights",
  "does not grant provider access or change the model kill-switch",
  "does not grant execution, Computer Use, or terminal authority",
  "does not grant platform administration",
  "does not grant authority in any other tenant",
]);

export const REVOCATION_EFFECT =
  "ends that delegated Governance authority from now on";

export const REVOCATION_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not delete the original delegation decision",
  "does not remove anything they already decided",
  "does not change their authentication, membership, or role",
  "does not remove them from the tenant",
]);

/**
 * The scope sentence the surface must show. A delegated authority means exactly the Governance
 * decision capability that G2 and K4 actually implement — nothing broader, and nothing that does
 * not exist.
 */
export const DELEGATION_SCOPE_NOTICE =
  "A delegated authority may make the same Governance decisions you can: ratify or reject a " +
  "Knowledge version, and delegate or revoke authority they granted themselves. There are no " +
  "narrower scopes — Hebun implements no partial Governance permissions.";

/** Why a delegation attempt ended the way it did. A closed set — no free-text excuses. */
export type DelegationRefusal =
  | "unauthenticated"
  /** The tenant has no bootstrap decision, so no Governance authority exists yet. */
  | "no-governance-authority"
  /** Authenticated, but not a Governance authority — including an owner-band peer. */
  | "not-a-governance-authority"
  /** The target is not an active human member of this tenant. */
  | "target-unresolvable"
  /** Delegating to yourself grants nothing you do not already hold. */
  | "self-delegation"
  /** The target already holds Governance authority (bootstrap or an active delegation). */
  | "already-authorized"
  | "justification-required"
  | "persistence-unavailable";

/** Why a revocation attempt ended the way it did. */
export type RevocationRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-a-governance-authority"
  /** No such delegation decision in this tenant. */
  | "delegation-unresolvable"
  /** A1-c: a delegate may revoke only grants they made. */
  | "not-the-grantor"
  /** Already revoked. Revocation happens once. */
  | "already-revoked"
  /**
   * A2-a: bootstrap authority is constitutional. G3 refuses to name it, and the type system refuses
   * too — a revocation's subject is a delegation decision, and the genesis is not one.
   */
  | "bootstrap-not-revocable"
  | "justification-required"
  | "persistence-unavailable";

export type DelegationResult =
  | {
      readonly status: "delegated";
      readonly decisionId: string;
      readonly governanceSessionId: string;
      readonly grantedToUserId: string;
      readonly delegatedAt: string;
    }
  | { readonly status: "refused"; readonly reason: DelegationRefusal };

export type RevocationResult =
  | {
      readonly status: "revoked";
      readonly decisionId: string;
      readonly governanceSessionId: string;
      readonly revokedDelegationId: string;
      readonly revokedAt: string;
    }
  | { readonly status: "refused"; readonly reason: RevocationRefusal };

/* ────────────────────────────── Provenance ────────────────────────────── */

/**
 * How one human came to hold Governance authority. Every field is a real column; nothing is scored,
 * ranked, or inferred.
 */
export interface AuthorityProvenance {
  /** `bootstrap` — the tenant's genesis. `delegated` — granted by an authorized human. */
  readonly kind: "bootstrap" | "delegated";
  /** `users.id` of the human who holds it. */
  readonly actorId: string;
  /** The decision that established it: the genesis, or the delegation. */
  readonly decisionId: string;
  /** Who granted it. Null for the genesis — nobody granted the first authority. */
  readonly grantedByActorId: string | null;
  /** The decision the GRANTOR's own authority came from, walking one step toward the genesis. */
  readonly grantorAuthorityDecisionId: string | null;
  readonly since: string;
  readonly justification: string;
}

export interface RevokedAuthorityRecord extends AuthorityProvenance {
  readonly revokedAt: string;
  readonly revocationDecisionId: string;
  readonly revokedByActorId: string;
  readonly revocationJustification: string;
}

export interface AuthorityRoster {
  /** Active authorities, genesis first. Always at least one — A3-a. */
  readonly active: readonly AuthorityProvenance[];
  /** Delegations that were ended. History is never deleted, so this only grows. */
  readonly revoked: readonly RevokedAuthorityRecord[];
  /** True when the CURRENTLY authenticated human is one of the active authorities. */
  readonly viewerIsAuthority: boolean;
  /** True when the viewer is the genesis human — A1-c gives them the widest revocation rights. */
  readonly viewerIsBootstrapAuthority: boolean;
}

export type AuthorityRosterLookup =
  | { readonly status: "read"; readonly roster: AuthorityRoster }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-unavailable";
    };
