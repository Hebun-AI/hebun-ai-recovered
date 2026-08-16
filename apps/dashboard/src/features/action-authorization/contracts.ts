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

export const ACTION_PERMIT_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not execute the action",
  "does not connect an execution substrate",
  "does not call any external provider, browser, shell, or device",
  "does not send any communication",
  "does not dispatch an agent",
  "does not enable Computer Use",
  "does not grant Governance authority",
  "does not grant a standing privilege or role",
  "does not authorize any second action",
  "does not survive its expiry",
  "does not authorize a changed parameter",
]);

/**
 * THE EXECUTION SUBSTRATE GAP — recorded at R3A, to be closed by R3B.
 *
 * WHAT IS TRUE AT R3A CLOSURE. A permit can be issued, revoked, expired and spent, and spending it
 * yields an `ExecutionAuthorization`. Nothing consumes that handoff, because no execution runtime
 * exists: `substrateConnected` is `false` for every mutation tool in the Heby action registry, and
 * a structural test forbids R3A from changing it.
 *
 * WHY THAT IS NOT A DEFECT. A permit whose executor does not exist is exactly as safe as a permit
 * whose executor is broken, and considerably more honest than an executor with no permit. The
 * authorization chain is the half that must be correct BEFORE anything can run, which is why it
 * was built first.
 *
 * WHAT WOULD CLOSE IT. R3B — First Executed Action: one sandboxed adapter, a durable execution
 * attempt keyed by `handoff_id`, a receipt, and enforced revocation at the execution moment.
 */
export const EXECUTION_SUBSTRATE_GAP = Object.freeze({
  /** Can Hebun authorize a consequential action? Since R3A: yes. */
  authorizationPresent: true as const,
  /** Can Hebun execute one? No, and no code here moves toward yes. */
  executionPresent: false as const,
  owner: "R3B — First Executed Action",
  observedRealityAt: "2026-08-16",
  observation:
    "Every mutation tool in the Heby action registry declares `substrateConnected: false`, and " +
    "no execution attempt table, dispatcher, or adapter exists. An issued permit is therefore " +
    "authorization that nothing can currently spend into an effect.",
  consequence:
    "Hebun may truthfully say a consequential action has been AUTHORIZED. It may never say the " +
    "action was executed, attempted, delivered, or succeeded.",
});
