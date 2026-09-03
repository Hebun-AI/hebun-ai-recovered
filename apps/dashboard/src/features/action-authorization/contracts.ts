/*
 * action-authorization/contracts.ts — the typed vocabulary of "this one act may happen" (R3A).
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONE IT REFUSES:
 *
 *   ANSWERED   May this exact consequential action, with these exact parameters, become
 *              executable once, before this instant, under whose authority?
 *   REFUSED    Does it then run? (R3B — dispatcher, adapter, receipt, outcome. None exists here.)
 *
 * WHY THIS IS NOT `authority-delegation` OR `membership-authorization`. A delegation makes someone
 * able to decide, and an authorized membership makes someone able to log in. A permit makes ONE
 * act performable and then dies. Filing it under either would make the ledger unable to answer
 * "what consequential acts has this tenant authorized?" — the one question an execution runtime
 * has to ask before it runs anything.
 *
 * THE FIVE DISTINCTIONS THIS PHASE EXISTS TO KEEP:
 *
 *   DECISION ≠ APPROVAL ≠ PERMIT ≠ EXECUTION ≠ SUCCESS
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/**
 * The `governance_domain` this phase activates. A new enum member, because none of the fifteen
 * existing domains could carry action-authorization semantics honestly: `provider-tool` says a
 * capability exists rather than that one use of it is permitted, `command` is a Tier-2 canonical
 * domain with no writer describing dispatch rather than legitimacy, and `authority-delegation`
 * would assert that authorizing an act IS moving Governance authority — which is the exact
 * conflation a permit must never make, since a permit grants nothing and expires.
 */
export const ACTION_AUTHORIZATION_DOMAIN = "action-authorization" as const;

/**
 * The `governance_decision_type` for approving an action. An EXISTING enum member.
 *
 * `approve` and not `certify` or `promote`: certification attests a standing that already exists
 * and promotion raises one. This approves a proposed future act and confers no standing at all.
 */
export const ACTION_APPROVAL_DECISION_TYPE = "approve" as const;

/** Refusing a proposed action. An EXISTING enum member, same as I1.2's refusal path. */
export const ACTION_REJECTION_DECISION_TYPE = "reject" as const;

/**
 * Revoking a live permit. An EXISTING enum member, and the same type G3 already uses to end a
 * delegation — ending an authorization is one act with one name, whatever it ended.
 */
export const ACTION_REVOCATION_DECISION_TYPE = "revoke" as const;

/** The `decision_records.subject_type`. The subject is the durable proposal being decided. */
export const ACTION_REQUEST_SUBJECT_TYPE = "heby_action_request" as const;

/**
 * The `subject_type` of a revocation. The subject is the PERMIT, not the request: revoking ends
 * the authorization while leaving the approved proposal exactly as it was decided.
 */
export const ACTION_PERMIT_SUBJECT_TYPE = "action_permit" as const;

/** `decision_records.outcome` is free text; these are the only three values R3A ever writes. */
export const ACTION_APPROVED_OUTCOME = "action-authorized" as const;
export const ACTION_REJECTED_OUTCOME = "action-refused" as const;
export const ACTION_PERMIT_REVOKED_OUTCOME = "action-authorization-revoked" as const;

/* The `audit_log.action` values this phase owns. One per authority-bearing event, and nothing
 * else: a proposal moves no authority, and an expiry is derived rather than performed. */
export const ACTION_AUDIT_APPROVED = "governance.action.approved" as const;
export const ACTION_AUDIT_REJECTED = "governance.action.rejected" as const;
export const ACTION_AUDIT_PERMIT_ISSUED = "governance.action.permit.issued" as const;
export const ACTION_AUDIT_PERMIT_REVOKED = "governance.action.permit.revoked" as const;
export const ACTION_AUDIT_PERMIT_CONSUMED = "governance.action.permit.consumed" as const;

/**
 * PBGA-1 — a human declared which Work item a pending request serves.
 *
 * A SIXTH VERB IN THIS AUTHORITY'S VOCABULARY, added deliberately: the declaration changes a
 * request row, so the event belongs to the authority that owns requests and to the one audit writer
 * that speaks for it. A second sink, or a second writer, would be a second version of what happened
 * to a request.
 *
 * It is NOT an approval, NOT a decision and NOT a permit. Its outcome is always `committed` and its
 * `executed` stays `false`, exactly as every other event here.
 */
export const ACTION_AUDIT_PURPOSE_DECLARED = "governance.action.purpose-declared" as const;

/** The `audit_log.entity_type` for both permit and request events. */
export const ACTION_REQUEST_ENTITY_TYPE = "heby_action_request" as const;
export const ACTION_PERMIT_ENTITY_TYPE = "action_permit" as const;

/**
 * THE SERVER-BOUNDED PERMIT LIFETIME.
 *
 * A client may request less and may never widen beyond the maximum. The bound is a server
 * constant rather than tenant configuration because no configuration authority exists to change
 * it: inventing one here would create a second place that decides how long authority lasts.
 *
 * 24 hours, matching the only comparable bound the repository already ships — the 72-hour
 * invitation window is deliberately longer because it waits on a human's inbox, whereas a permit
 * waits on a machine that is either ready now or not.
 */
export const PERMIT_MAX_TTL_SECONDS = 86_400;
export const PERMIT_DEFAULT_TTL_SECONDS = 3_600;
export const PERMIT_MIN_TTL_SECONDS = 60;

/**
 * The side-effect classes R3A will accept a request for.
 *
 * `DEVICE_ACTION` is absent and a database CHECK enforces the same thing. Computer Use is
 * Platform-owned, stays RESTRICTED in the Heby lifecycle before human review is even reached, and
 * R3A must not become the back door that authorizes it. `READ_ONLY` and `PREPARATION_ONLY` are
 * absent for the opposite reason: they need no permit, and issuing one would teach the system that
 * reading requires authorization.
 */
export const AUTHORIZABLE_SIDE_EFFECTS: readonly string[] = Object.freeze([
  "REVERSIBLE_MUTATION",
  "CONSEQUENTIAL_MUTATION",
]);

export const JUSTIFICATION_MIN_LENGTH = 12;
export const REJECTION_REASON_MAX_LENGTH = 256;
export const REVOCATION_REASON_MAX_LENGTH = 256;

export type ActionRequestRefusal =
  | "unauthenticated"
  /** The prepared action did not reach a state that needs authorizing. */
  | "not-authorizable"
  /** The side-effect class is not one R3A issues permits for. */
  | "side-effect-not-authorizable"
  /** Arguments failed the tool's typed schema, so there is nothing stable to freeze. */
  | "arguments-invalid"
  /** A live pending request already exists for this exact action in this tenant. */
  | "already-pending"
  /**
   * PBGA-1. A declared Work purpose named a work item this tenant does not have. Absent and
   * foreign-tenant are ONE answer, because the composite foreign key answers both with one
   * violation and telling them apart would leak that a work item exists somewhere else.
   */
  | "purpose-work-not-found"
  /**
   * AGENT-PROPOSAL-1. An agent proposer was offered without proof that the authoritative
   * durable-agent read seam produced it. Unreachable through the human entry point — it is the
   * writer's guard against a forged `AgentProposer`, and a refusal rather than a thrown error so
   * a caller gets an answer in the same vocabulary as every other failure here.
   */
  | "unverified-agent-proposer"
  /*
   * ── AMA-2. THE THREE MANDATE STATES, AND WHY THEY MAY NEVER COLLAPSE ───────
   *
   * All three refuse and all three write nothing, so a caller that only needed to know "was it
   * filed?" could have been served by one value. They are three because they are three different
   * facts about the ORGANIZATION, and the difference is what somebody reading a refusal has to
   * act on: repair the control plane, ask a human to bound the agent, or accept that the bound
   * excludes this act. One value would make an outage indistinguishable from a deliberate
   * withdrawal — the fabricated-absence defect this repository has repaired more than once.
   */
  /**
   * (A) The mandate authority could not produce trustworthy truth. Hebun could not LOOK.
   *
   * Fail closed, and never fall back to the released global vocabulary: an unreachable ceiling is
   * not an absent one. UNAVAILABLE != NO MANDATE.
   */
  | "agent-mandate-authority-unavailable"
  /**
   * (B) The agent is known, the authority answered, and NO mandate exists. Nobody has bounded it.
   *
   * The load-bearing refusal of AMA-2. NO MANDATE != UNLIMITED MANDATE: an unbounded agent is
   * exactly the thing a mandate exists to prevent, so the absence of a bound is a refusal rather
   * than a permission.
   */
  | "no-agent-mandate"
  /**
   * (C) A mandate exists and the requested action kind is outside its `proposal_scope`.
   *
   * Includes withdrawal, which is an EMPTY scope rather than a flag: an agent withdrawn from
   * proposing lands here for every kind, because nothing is inside an empty ceiling.
   */
  | "action-outside-agent-mandate"
  | "persistence-unavailable";

export type ActionDecisionRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-the-governance-authority"
  | "justification-required"
  /** The named request does not exist inside the caller's tenant. */
  | "request-unresolvable"
  /** The request is not pending — already approved, rejected, or withdrawn. */
  | "request-not-pending"
  /** A rejection with no stated reason is not a decision anybody can review. */
  | "rejection-reason-required"
  /**
   * The proposal's frozen digest no longer matches its own payload. Refused rather than repaired:
   * a request whose content drifted is not a thing a human can be asked to approve.
   */
  | "digest-mismatch"
  | "persistence-unavailable";

export type ActionRevocationRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-the-governance-authority"
  | "justification-required"
  | "revocation-reason-required"
  /** The named permit does not exist inside the caller's tenant. */
  | "permit-unresolvable"
  /** Already consumed, or already revoked. A spent permit cannot be un-spent. */
  | "permit-not-active"
  | "persistence-unavailable";

export type PermitConsumptionRefusal =
  | "unauthenticated"
  /** No live permit matched the tenant, id, and active-and-unexpired predicate. */
  | "permit-not-consumable"
  /**
   * The permit's bound digest and its request's digest disagree, or the recomputed payload digest
   * does not match. WHAT WAS APPROVED is no longer WHAT WOULD RUN, so nothing is authorized.
   */
  | "digest-mismatch"
  /**
   * The caller's in-transaction record of what this authorization is being spent on could not be
   * written (R3B). The spend rolled back with it, so the permit is still `active`: Hebun does not
   * become entitled to act when it cannot write down what it is about to do.
   */
  | "handoff-record-failed"
  | "persistence-unavailable";

export type ActionRequestResult =
  | {
      readonly status: "recorded";
      readonly requestId: string;
      readonly payloadDigest: string;
    }
  | { readonly status: "refused"; readonly reason: ActionRequestRefusal };

export type ActionApprovalResult =
  | {
      readonly status: "authorized";
      readonly requestId: string;
      readonly permitId: string;
      readonly decisionId: string;
      readonly sessionId: string;
      readonly expiresAt: string;
    }
  | { readonly status: "refused"; readonly reason: ActionDecisionRefusal };

export type ActionRejectionResult =
  | {
      readonly status: "rejected";
      readonly requestId: string;
      readonly decisionId: string;
      readonly sessionId: string;
    }
  | { readonly status: "refused"; readonly reason: ActionDecisionRefusal };

export type ActionRevocationResult =
  | {
      readonly status: "revoked";
      readonly permitId: string;
      readonly decisionId: string;
      readonly sessionId: string;
    }
  | { readonly status: "refused"; readonly reason: ActionRevocationRefusal };

/**
 * THE EXECUTION HANDOFF — everything R3B needs to verify an authorization, and nothing more.
 *
 * It carries no adapter, no credential, no endpoint and no instruction. R3B receives this, checks
 * the digest against the payload it is about to run, and refuses on any mismatch. Producing one of
 * these is the LAST thing R3A does; performing the act is the FIRST thing R3A does not do.
 */
export interface ExecutionAuthorization {
  /** Minted at the instant of consumption. Durable, unique, and R3B's reference back to here. */
  readonly handoffId: string;
  readonly permitId: string;
  readonly tenantId: string;
  readonly actionRequestId: string;
  readonly actionKind: string;
  readonly toolId: string;
  readonly targetKind: string | null;
  readonly targetRef: string | null;
  /** The approved typed scalars, exactly as a human saw them. */
  readonly canonicalPayload: Readonly<Record<string, string | number | boolean>>;
  /** SHA-256 over the canonical serialization. R3B MUST re-verify this before acting. */
  readonly boundPayloadDigest: string;
  readonly authorizationDecisionId: string;
  readonly authorizedByActorId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly consumedAt: string;
}

/**
 * What issuing a permit DOES and DOES NOT do. Values rather than prose, so the surface renders
 * exactly what a test asserts — the same shape as `MEMBERSHIP_AUTHORIZATION_NON_EFFECTS`.
 */
export const ACTION_PERMIT_EFFECT =
  "records that Governance has authorized ONE execution of this exact action, with these exact " +
  "parameters, before this expiry, unless revoked first";

/*
 * REPAIRED AT R3B. Two entries were true when written and became false when an execution runtime
 * shipped: issuing a permit still does not execute anything, but "does not connect an execution
 * substrate" and "does not send any communication" described the REPOSITORY rather than the act,
 * and the repository changed. Leaving them would have let a green test suite stay green because a
 * stale claim survived.
 *
 * What replaced them says the same protective thing about the ACT, which is what this constant is
 * about: issuing a permit does not itself perform, dispatch or schedule anything. A separate,
 * explicit human step spends it, and even that refuses while the durable kill switch is off.
 */
export const ACTION_PERMIT_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not execute the action",
  "does not send any communication by itself",
  "does not dispatch, queue or schedule an execution",
  "does not call any external provider, browser, shell, or device",
  "does not dispatch an agent",
  "does not enable Computer Use",
  "does not grant Governance authority",
  "does not grant a standing privilege or role",
  "does not authorize any second action",
  "does not authorize a retry of a failed or unknown attempt",
  "does not survive its expiry",
  "does not authorize a changed parameter",
]);

/**
 * THE EXECUTION SUBSTRATE GAP — recorded at R3A, CLOSED at R3B, and replaced by a narrower one.
 *
 * WHAT R3A RECORDED. `substrateConnected` was `false` for every mutation tool, no attempt table,
 * dispatcher or adapter existed, and an issued permit was authorization nothing could spend into
 * an effect. All four statements were true then and none is true now.
 *
 * WHAT R3B BUILT. `action_execution_attempts` (a durable attempt keyed by the permit's own
 * `handoff_id`), one bounded HTTPS adapter behind a four-scalar contract, an explicit
 * Director-triggered Execute, and a receipt with a first-class UNKNOWN outcome.
 *
 * WHAT REPLACED THE GAP, AND WHY IT IS SMALLER. The substrate exists and is NOT ARMED: the
 * durable `external-send` control ships disabled and no provider credential is configured, so
 * every execution refuses at the switch. Building the runtime and arming it are deliberately two
 * decisions, and only the first has been made.
 */
export const EXECUTION_SUBSTRATE_GAP = Object.freeze({
  /** Can Hebun authorize a consequential action? Since R3A: yes. */
  authorizationPresent: true as const,
  /** Does an execution runtime exist? Since R3B: yes, for exactly one action kind. */
  executionPresent: true as const,
  /** Can a real external effect happen today? No — the switch is off and no credential exists. */
  executionArmed: false as const,
  owner: "R3B — First Executed Action",
  observedRealityAt: "2026-08-17",
  observation:
    "Exactly one tool — `heby.operations.send-communication` — declares a connected substrate, " +
    "and the registry validator refuses a second. Resend is the selected vendor and its request " +
    "mapping is implemented, but the durable `external-send` connectivity control is disabled and " +
    "deployment has supplied none of the three values the adapter requires before it exists.",
  consequence:
    "Hebun may truthfully say a consequential action has been AUTHORIZED, and that an execution " +
    "runtime exists but is disabled. It may not say any action has been executed, sent, " +
    "delivered or succeeded, because no real send has ever occurred.",
});
