/*
 * identity-enrollment/contracts.ts — the typed vocabulary of the two-key enrollment ceremony (I1.2).
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   How does a human who is not yet in Hebun become an authenticable identity with a
 *              credential, without invitation possession alone being enough?
 *   REFUSED    Does that human belong to a tenant? (I2 — membership. Not here, not ever here.)
 *   REFUSED    May they act? (Membership, Role, Governance, Knowledge, provider — none of it.)
 *
 * THE PRIMARY SECURITY INVARIANT, stated as a value so a test can assert it:
 *
 *   invitation possession  ≠  verified identity
 *   invitation possession + legitimate Governance second key  →  authorized identity enrollment
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * The `governance_domain` this phase activates. A new enum member (Gate B B-3), because none of the
 * fourteen existing domains could carry identity enrollment honestly: `membership-authorization`
 * would assert that verifying a human IS admitting them to a tenant (after this decision they still
 * have no membership), and `authority-delegation` would assert it moves authority (it grants none).
 */
export const IDENTITY_ENROLLMENT_DOMAIN = "identity-enrollment" as const;

/**
 * The `decision_records.subject_type`. The subject is the ceremony artifact, NOT the identity —
 * at approval time no identity row exists, and naming a row that does not exist would be a decision
 * about nothing.
 */
export const IDENTITY_ENROLLMENT_SUBJECT_TYPE = "identity_enrollment_request" as const;

/** Existing `governance_decision_type` members. No decision-type vocabulary was added. */
export const IDENTITY_ENROLLMENT_APPROVE_TYPE = "approve" as const;
export const IDENTITY_ENROLLMENT_REJECT_TYPE = "reject" as const;

/** `decision_records.outcome` is free text; these are the only two values I1.2 ever writes. */
export const IDENTITY_ENROLLMENT_APPROVED_OUTCOME = "identity-enrollment-approved" as const;
export const IDENTITY_ENROLLMENT_REJECTED_OUTCOME = "identity-enrollment-rejected" as const;

/** The `audit_log.action` values this phase owns. Distinct from every other governance action. */
export const IDENTITY_ENROLLMENT_APPROVED_ACTION = "governance.identity.enrollment.approved" as const;
export const IDENTITY_ENROLLMENT_REJECTED_ACTION = "governance.identity.enrollment.rejected" as const;
/** Act 3 is not a Governance act; it is Identity + Credential authority completing the ceremony. */
export const IDENTITY_ENROLLMENT_COMPLETED_ACTION = "identity.enrollment.completed" as const;

/**
 * The local identity coordinates I1.2 writes, and the ONLY ones it may write.
 *
 * These match `scripts/r1-seed.mjs` exactly, because a product-created identity and a seeded one
 * must be the same kind of row — `findActiveLocalIdentityByEmail` filters `provider = 'local'`, and
 * `auth_identities_provider_issuer_subject_uq` means one local identity per email address globally.
 */
export const LOCAL_IDENTITY_PROVIDER = "local" as const;
export const LOCAL_IDENTITY_ISSUER = "hebun-local" as const;
/** `subject` is derived from the normalized email, exactly as the seed derives it. */
export function localIdentitySubject(normalizedEmail: string): string {
  return `local:${normalizedEmail}`;
}

/**
 * Minimum length for a first password. I1.2's own boundary obligation: `insertPasswordCredential`
 * performs no strength check by design — it is a persistence primitive, and policy belongs to the
 * caller that knows what act is being performed.
 */
export const MIN_ENROLLMENT_PASSWORD_LENGTH = 12;

/** Same bound as `invitations.normalized_email`. */
export const NORMALIZED_EMAIL_MAX_LENGTH = 320;

/** Justification bounds for the Governance second key — mirrors `validateJustification`. */
export const MIN_JUSTIFICATION_LENGTH = 24;

/* ── ACT 1 ─────────────────────────────────────────────────────────────────── */

export type EnrollmentStartRefusal =
  /** The presented capability matches no invitation, or is malformed. Deliberately one reason. */
  | "capability-unrecognized"
  /** The invitation exists but is not usable: expired, revoked, or already accepted. */
  | "capability-not-usable"
  /**
   * A Hebun human already exists at this address. I1.2 bootstraps NEW humans only; an existing
   * human joining another tenant is I2's existing-human path and needs no identity.
   */
  | "already-enrolled"
  /** A live ceremony already exists for this invitation. */
  | "enrollment-already-started"
  /** The durable store is not configured, or the transaction failed. */
  | "persistence-unavailable";

export type EnrollmentStartResult =
  | {
      readonly status: "started";
      readonly enrollmentId: string;
      /**
       * The continuation reference, returned ONCE and never stored. Act 3 requires it, which is
       * what binds the approval to THIS submission rather than to whoever next holds the invitation.
       */
      readonly continuationReference: string;
      readonly submittedAt: string;
    }
  | { readonly status: "refused"; readonly reason: EnrollmentStartRefusal };

/* ── ACT 2 ─────────────────────────────────────────────────────────────────── */

export type EnrollmentDecision = "approve" | "reject";

export type EnrollmentDecisionRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant has no bootstrap decision: Governance does not exist here yet. */
  | "no-governance-authority"
  /** Authenticated, but holds neither bootstrap nor an unrevoked delegation. */
  | "not-the-governance-authority"
  /** No pending ceremony with that id inside the caller's tenant. Cross-tenant looks identical. */
  | "enrollment-unresolvable"
  /** Missing, too short, or too long justification. */
  | "justification-required"
  /** A rejection must say why, in the same words the row will keep. */
  | "rejection-reason-required"
  /** Somebody else decided it inside the window. */
  | "already-decided"
  | "persistence-unavailable";

export type EnrollmentDecisionResult =
  | {
      readonly status: "approved" | "rejected";
      readonly enrollmentId: string;
      readonly decisionId: string;
      readonly sessionId: string;
      readonly decidedAt: string;
    }
  | { readonly status: "refused"; readonly reason: EnrollmentDecisionRefusal };

/* ── ACT 3 ─────────────────────────────────────────────────────────────────── */

export type EnrollmentCompletionRefusal =
  /** Continuation reference unrecognized, or it does not match the presented invitation. */
  | "continuation-unrecognized"
  /** The ceremony exists but is not approved: still pending, already rejected, or already completed. */
  | "enrollment-not-approved"
  /** The invitation lapsed between approval and completion. */
  | "capability-not-usable"
  /** The chosen password does not meet the minimum policy. */
  | "password-unacceptable"
  /** Somebody claimed this email or local subject first. */
  | "already-enrolled"
  | "persistence-unavailable";

export type EnrollmentCompletionResult =
  | {
      readonly status: "completed";
      readonly enrollmentId: string;
      readonly userId: string;
      readonly authIdentityId: string;
      readonly completedAt: string;
    }
  | { readonly status: "refused"; readonly reason: EnrollmentCompletionRefusal };

/* ── WHAT THIS PHASE DOES AND DOES NOT DO ──────────────────────────────────── */

export const IDENTITY_ENROLLMENT_EFFECT =
  "establishes ONE new Hebun human as a verified local identity holding a first password " +
  "credential, after a Governance authority approved that specific submission";

export const IDENTITY_ENROLLMENT_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not create a membership",
  "does not consume the invitation into a membership",
  "does not issue any session",
  "does not grant a tenant-authorized session",
  "does not create or change any role",
  "does not grant Governance authority",
  "does not grant Knowledge ratification or authoring authority",
  "does not grant provider access or change the model kill-switch",
  "does not grant execution, Computer Use, or terminal authority",
  "does not send anything to anyone",
  "does not verify that the human controls the invited email address",
]);

/**
 * THE PRIMARY SECURITY INVARIANT, as a value so a test asserts the sentence rather than the vibe.
 */
export const TWO_KEY_INVARIANT = Object.freeze({
  key1: "possession of a live invitation capability, and nothing more",
  key1ProvesNot: Object.freeze([
    "email ownership",
    "legal identity",
    "an authenticated Hebun identity",
    "credential ownership",
    "tenant membership",
    "Governance authority",
  ]),
  key2: "approval by a human who currently holds this tenant's Governance authority",
  key2ResolvedBy: "resolveGovernanceAuthority",
  neitherAloneEstablishes: "an active Hebun identity or a credential",
  /**
   * The honest limit, in the same words G2.1 used about its own root of trust: Hebun delivers
   * nothing, so the capability's trust root is possession of whatever channel the Governance
   * authority chose. READ THIS AS A LIMITATION, NOT A CREDENTIAL.
   */
  deliveryLimitation:
    "Hebun has no mail runtime; the capability is handed over out of band, so a token stolen " +
    "before the first act still lets the thief be the submitter. The second key reduces that to a " +
    "human-in-the-loop check with visibility and a veto. It does not eliminate it.",
});
