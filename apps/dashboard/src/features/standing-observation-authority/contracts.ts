/*
 * standing-observation-authority/contracts.ts — the vocabulary of a Governance-owned standing
 * observation authorization (TRH-23).
 *
 * Shared by the writer, the reader, the ephemeral principal, the pre-transport revalidator, the
 * audit sibling and the ceremony. No database handle, no transport, no secret: this module is
 * importable from anywhere and grants nothing by being imported.
 *
 * ── THE OBSERVABLE ALLOW-LIST IS A BINDING, NOT A SECOND REGISTRY ────────────
 *
 * `OBSERVABLE_CAPABILITIES` names no string of its own. Every value in it is imported from the
 * authority that already owns it — the provider's released contracts and the observation-history
 * subject vocabulary — so this file cannot drift from them and cannot invent a capability that the
 * provider catalog does not declare.
 *
 * What it DOES add is the one claim neither of those owners makes: that this exact
 * (provider, capability, subject-kind) triple is a READ that changes nothing outside Hebun, and is
 * therefore eligible to be authorized to RECUR. `writeCapable === false` on a catalog entry is a
 * statement about what is presently possible; it is explicitly "CAPABILITY, NEVER PERMISSION", and
 * a phase that added a write half would silently widen every standing authorization ever issued if
 * this list had been derived from it. So the list is closed, enumerated, and costs a code change to
 * extend.
 */
import {
  YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
  YOUTUBE_PROVIDER_KEY,
} from "@/features/provider-youtube/contracts";
import {
  INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
  INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  INSTAGRAM_PROVIDER_KEY,
} from "@/features/provider-instagram/contracts";
import type { ObservationSubjectKind } from "@/features/provider-observation-history/contracts";

/**
 * The subject kind, TYPED AS THE OWNER'S UNION rather than copied as a bare string.
 *
 * `record-youtube-channel-observation.server.ts` also exports this literal, but importing it here
 * would drag a provider transport closure into a pure contracts module that the ceremony, the audit
 * sibling and every test import. The annotation is what keeps this honest: rename the value in
 * `provider-observation-history/contracts.ts` and this line stops compiling.
 */
const YOUTUBE_CHANNEL_SUBJECT_KIND: ObservationSubjectKind = "youtube-channel";

/* ── Governance vocabulary ─────────────────────────────────────────────────── */

/**
 * The Governance subject. A decision is bound to ONE REVISION, never to the lineage — the defect K4
 * found when a decision named a Knowledge fact instead of a version. "Whatever authorization is
 * current when someone reads this" is not a thing a human can have decided.
 */
/**
 * TRH-25 prerequisite. The control key for the GLOBAL Director kill switch over machine-principal
 * provider READS, in `provider_connectivity_controls`.
 *
 * It is a PERMISSION NAME and not a provider identity, exactly as `external-send` is — the two
 * existing keys already established that this column names a blast radius rather than a vendor. One
 * key covers every observable capability, because `OBSERVABLE_CAPABILITIES` is a closed list and a
 * per-provider key would be a policy model invented ahead of a second provider.
 *
 * Declared HERE, in the authority that owns what may be observed, so the ceremony imports it from
 * the same place the revalidator does and no second spelling can exist.
 */
export const OBSERVATION_READ_CONTROL_KEY = "provider-observation-read" as const;

export const STANDING_OBSERVATION_SUBJECT_TYPE = "standing_observation_authorization" as const;

/** The ledger domain. See `governance_domain`'s own comment for why every neighbour was refused. */
export const STANDING_OBSERVATION_DOMAIN = "standing-observation" as const;

/** Authorizing (or re-authorizing, or narrowing) a standing observation scope. */
export const STANDING_OBSERVATION_AUTHORIZE_DECISION_TYPE = "approve" as const;
/** Withdrawing one. The same `revoke` word Governance uses for ending a delegation — see below. */
export const STANDING_OBSERVATION_WITHDRAW_DECISION_TYPE = "revoke" as const;

/**
 * The ledger outcomes.
 *
 * BOTH ARE NECESSARY AND BOTH MUST BE MATCHED ON THE SUBJECT FIRST. `approve` is also the
 * membership-authorization and agent-mandate decision type, and `revoke` is also how a Governance
 * DELEGATION is ended. Falling through to either generic branch would record "a human was admitted"
 * or "Governance authority was revoked" in the permanent ledger for an act that did neither.
 *
 * The words avoid `granted` and `permitted` deliberately: what was authorized is OBSERVATION, and a
 * row read years later must not suggest that anything was executed, sent or changed outside Hebun.
 */
export const STANDING_OBSERVATION_AUTHORIZED_OUTCOME = "standing-observation-authorized" as const;
export const STANDING_OBSERVATION_WITHDRAWN_OUTCOME = "standing-observation-withdrawn" as const;

/* ── Audit vocabulary ──────────────────────────────────────────────────────── */

/** The audited entity is the REVISION row. Never the connection, never the subject. */
export const STANDING_OBSERVATION_ENTITY_TYPE = "standing_observation_authorization" as const;

export const STANDING_OBSERVATION_AUDIT_AUTHORIZED = "standing-observation.authorized" as const;
export const STANDING_OBSERVATION_AUDIT_WITHDRAWN = "standing-observation.withdrawn" as const;

export type StandingObservationAuditAction =
  | typeof STANDING_OBSERVATION_AUDIT_AUTHORIZED
  | typeof STANDING_OBSERVATION_AUDIT_WITHDRAWN;

/** The `audit_log.source` for this authority. Its own, so tightening one never moves the others. */
export const STANDING_OBSERVATION_AUDIT_SOURCE = "standing-observation-authority" as const;

/* ── Bounds ────────────────────────────────────────────────────────────────── */

/** Every lineage starts here. */
export const FIRST_AUTHORIZATION_REVISION = 1 as const;

/**
 * The frequency floor, in minutes.
 *
 * The database repeats it as a CHECK. That duplication is deliberate: the constant gives a caller
 * an honest refusal, and the constraint survives a caller that never read the constant.
 */
export const MIN_OBSERVATION_INTERVAL_MINUTES = 60;

/**
 * A sanity ceiling, so `interval_minutes` cannot hold a number that means nothing. 366 days.
 * An authorization is withdrawn by a decision, never by a colossal interval nobody notices.
 */
export const MAX_OBSERVATION_INTERVAL_MINUTES = 366 * 24 * 60;

export const MIN_JUSTIFICATION_CHARACTERS = 24;

/* ── The observable scope allow-list ───────────────────────────────────────── */

/** One eligible standing-observation scope. Every field comes from its released owner. */
export interface ObservableCapability {
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
}

/**
 * THE CLOSED SET OF SCOPES A STANDING AUTHORIZATION MAY NAME.
 *
 * Read-only observation only. Adding an entry is a code change with a review, which is exactly the
 * cost it should have: it is the moment somebody asserts that a provider capability changes nothing
 * outside Hebun and may therefore be authorized to recur unattended one day.
 */
export const OBSERVABLE_CAPABILITIES: readonly ObservableCapability[] = Object.freeze([
  Object.freeze({
    providerKey: YOUTUBE_PROVIDER_KEY,
    capabilityKey: YOUTUBE_CHANNEL_PUBLIC_READ_CAPABILITY,
    subjectKind: YOUTUBE_CHANNEL_SUBJECT_KIND,
  }),
  /*
   * INSTAGRAM ACCOUNT READ. The second entry, and the first proof that this list is a list.
   *
   * It earns its place on the same terms the first one did: this exact triple is a READ that changes
   * nothing outside Hebun. Instagram's write surfaces — publishing, comments, messages — are not
   * expressible by the released transport and none of their scopes is requested, so `writeCapable`
   * on this connection stays false however generous a future grant becomes.
   */
  Object.freeze({
    providerKey: INSTAGRAM_PROVIDER_KEY,
    capabilityKey: INSTAGRAM_ACCOUNT_PUBLIC_READ_CAPABILITY,
    subjectKind: INSTAGRAM_ACCOUNT_SUBJECT_KIND,
  }),
]);

/** Whether this exact triple is an eligible standing-observation scope. All three must match. */
export function isObservableCapability(
  providerKey: string,
  capabilityKey: string,
  subjectKind: string,
): boolean {
  return OBSERVABLE_CAPABILITIES.some(
    (entry) =>
      entry.providerKey === providerKey &&
      entry.capabilityKey === capabilityKey &&
      entry.subjectKind === subjectKind,
  );
}

/* ── Records ───────────────────────────────────────────────────────────────── */

export type StandingObservationState = "active" | "withdrawn";

/** One revision, as every reader in this authority sees it. */
export interface StandingObservationAuthorizationRecord {
  readonly authorizationId: string;
  readonly authorizationRevision: number;
  readonly state: StandingObservationState;
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly intervalMinutes: number;
  readonly governanceDecisionId: string;
  readonly governanceSessionId: string;
  readonly authorizedByActorId: string;
  readonly authorizedAt: string;
  readonly supersedesAuthorizationId: string | null;
}

/** The scope a caller names. The tenant is NOT here and has no parameter anywhere. */
export interface StandingObservationScope {
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectKind: string;
  readonly subjectRef: string;
}

/* ── Refusals ──────────────────────────────────────────────────────────────── */

/**
 * Why a standing authorization was not written. Closed, and every value is a fact about the
 * organization's state or the request's shape — never a judgement about the observation.
 */
export type StandingObservationRefusal =
  /** No server-resolved human tenant context. There is no parameter through which one could arrive. */
  | "unauthenticated"
  /** This tenant has no Governance genesis at all. */
  | "no-governance-authority"
  /** The caller is a member, but not the human Governance authority. */
  | "not-the-governance-authority"
  | "justification-required"
  /** The (provider, capability, subject-kind) triple is not in the released observable allow-list. */
  | "capability-not-observable"
  | "subject-required"
  | "interval-out-of-bounds"
  /** The named connection does not belong to this tenant, or does not exist. Indistinguishable. */
  | "connection-unresolvable"
  /** The connection exists but is not for the provider this scope names. */
  | "connection-provider-mismatch"
  /** The caller's view of the lineage was stale — somebody revised it in between. */
  | "stale-authorization-revision"
  /** Another revision for this lineage committed the same ordinal first. */
  | "concurrent-authorization-change"
  /** Withdrawal was asked for where there is nothing active to withdraw. */
  | "no-active-authorization"
  /** Authorizing a scope whose effective revision is already active and identical. */
  | "already-authorized"
  | "persistence-unavailable";

export type StandingObservationWriteResult =
  | {
      readonly status: "authorized";
      readonly authorization: StandingObservationAuthorizationRecord;
    }
  | { readonly status: "refused"; readonly reason: StandingObservationRefusal };

/* ── Read results ──────────────────────────────────────────────────────────── */

/**
 * UNAVAILABLE IS NOT ABSENT. Telling a tenant that it has authorized nothing when the truth is that
 * the authority could not be reached is a fabricated absence — the same rule every read seam in
 * this repository keeps.
 */
export type StandingObservationReadResult =
  | {
      readonly status: "read";
      /** The effective revision for this lineage, or `null` when the lineage has none. */
      readonly effective: StandingObservationAuthorizationRecord | null;
    }
  | { readonly status: "unavailable"; readonly reason: string };

export type StandingObservationHistoryResult =
  | {
      readonly status: "read";
      /** Newest revision first. Every revision ever written for this lineage. */
      readonly revisions: readonly StandingObservationAuthorizationRecord[];
    }
  | { readonly status: "unavailable"; readonly reason: string };
