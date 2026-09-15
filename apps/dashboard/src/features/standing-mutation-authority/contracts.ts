/*
 * standing-mutation-authority/contracts.ts — the vocabulary of a Governance-owned STANDING
 * MUTATION AUTHORIZATION (RUNG 2).
 *
 * Shared by the writer, the reader, the issuing seam, the surface and the tests. No database
 * handle, no transport, no secret: this module is importable from anywhere and grants nothing by
 * being imported.
 *
 * ── THE ADMITTED EVIDENCE VOCABULARY IS CLOSED, AND IT IS NOT A POLICY LANGUAGE ──
 *
 * RUNG 2's whole safety claim is that Heby records work that DEMONSTRABLY HAPPENED, rather than
 * work it reasoned itself into. That claim is only as good as what counts as evidence, so the list
 * below is enumerated, closed, and costs a code change to extend.
 *
 * `provider-observations` is the only member, and the reason is not caution — it is that no other
 * released source class describes an EVENT. `organization` evidence (the other class the released
 * record-work proposals attach) is a standing fact about the company: it is equally true today and
 * next year, so it can never be the thing that makes one new work record newly warranted, and an
 * envelope keyed on it would let one unchanging fact consume every act in the quota.
 *
 *     EVIDENCE MUST BE SOMETHING THAT HAPPENED, ONCE, AT A TIME, AND IS WRITTEN DOWN.
 *
 * Provider observations are exactly that: durable, timestamped, append-only rows the released
 * observation history owns, each recording one read that occurred.
 */

/** The Governance subject. A decision is bound to ONE REVISION, never to the lineage. */
export const STANDING_MUTATION_SUBJECT_TYPE = "standing_mutation_authorization" as const;

/** The ledger domain. See `governance_domain`'s own comment for why every neighbour was refused. */
export const STANDING_MUTATION_DOMAIN = "standing-mutation" as const;

/**
 * THE CLOSED ADMITTED EVIDENCE SOURCE CLASSES.
 *
 * Every value is the string the released proposal seam already writes into
 * `heby_action_requests.evidence[].sourceClass` — not a new vocabulary invented here. A proposal
 * carrying no entry from this set is refused issuance, which is the point: the human authorized a
 * class of EVIDENCED acts, not a quota to spend freely.
 */
export const ADMITTED_EVIDENCE_SOURCE_CLASSES: ReadonlySet<string> = new Set([
  "provider-observations",
]);

/**
 * Why an envelope write was refused.
 *
 * Deliberately mirrors the tenant machine-execution authority's refusal vocabulary where the
 * question is the same one, so a reader who has learned one has learned both.
 */
export type StandingMutationWriteRefusal =
  | "unauthenticated"
  | "no-governance-authority"
  | "not-the-governance-authority"
  | "justification-required"
  /** The named agent does not belong to this tenant, or does not exist. */
  | "agent-unresolvable"
  /** The named agent is retired. An envelope for an agent out of service authorizes nothing. */
  | "agent-not-in-service"
  /** A kind outside the frozen machine-executable set, or outside `record-work`. */
  | "unsupported-action-kind"
  /** The window, quota or cadence was absent, malformed, or outside the schema's own bounds. */
  | "invalid-envelope"
  /** Authorizing where an active envelope already stands for this lineage. A no-op decision. */
  | "already-authorized"
  /** Withdrawing where no active envelope stands. */
  | "no-active-authorization"
  /** The human decided against a revision a later one has replaced. */
  | "stale-authorization-revision"
  | "persistence-unavailable";

/** Why issuing a permit under an envelope was refused. */
export type StandingIssuanceRefusal =
  /** No active envelope for this tenant and agent. */
  | "no-standing-authorization"
  /** The effective revision took the permission away. */
  | "standing-authorization-withdrawn"
  /** `now` is outside `[not_before, not_after)`. */
  | "standing-authorization-not-in-window"
  /** `max_acts` permits already issued under this envelope. */
  | "standing-authorization-exhausted"
  /** The most recent issuance is newer than `min_interval_minutes` ago. */
  | "cadence-not-elapsed"
  /** The organization has not enrolled, or withdrew, machine execution for this capability. */
  | "tenant-not-authorized"
  /** The agent named by the envelope has since retired. */
  | "agent-not-in-service"
  /** The request does not exist for this tenant, or is not pending. */
  | "request-unresolvable"
  /** The request was proposed by a human. A standing envelope covers its agent's own proposals. */
  | "not-agent-proposed"
  /** The request names an agent other than the one the envelope authorizes. */
  | "agent-mismatch"
  /** The request's kind is not the one the envelope authorizes. */
  | "action-kind-mismatch"
  /** The stored payload no longer hashes to the digest frozen at proposal time. */
  | "digest-mismatch"
  /** The proposal carries no evidence from the closed admitted set. */
  | "evidence-required"
  /** Another standing-issued permit already cites this exact evidence record. */
  | "evidence-already-consumed"
  /** A permit already exists for this request. */
  | "already-permitted"
  | "persistence-unavailable";

export type StandingMutationState = "active" | "withdrawn";

/* ── Governance vocabulary ─────────────────────────────────────────────────── */

/** Authorizing an envelope is an `approve`. Withdrawing one is a `revoke`. */
export const STANDING_MUTATION_AUTHORIZE_DECISION_TYPE = "approve" as const;
export const STANDING_MUTATION_WITHDRAW_DECISION_TYPE = "revoke" as const;

/**
 * THE LEDGER'S OWN WORDS, and they are neither `approved` nor `revoked`.
 *
 * `approve` is also the membership-authorization decision type, and `revoke` is also how a
 * Governance DELEGATION ends. Without a subject-matched outcome, authorizing an envelope would be
 * recorded as a human being admitted to the organization, and withdrawing one as Governance
 * authority being taken away. Neither is remotely what happened. Both siblings hit this exact trap
 * and defend against it the same way.
 */
export const STANDING_MUTATION_AUTHORIZED_OUTCOME = "standing-mutation-authorized" as const;
export const STANDING_MUTATION_WITHDRAWN_OUTCOME = "standing-mutation-withdrawn" as const;

/**
 * WHY AN ENVELOPE IS NOT CURRENTLY USABLE, as a human is told it.
 *
 * Each member is a DIFFERENT fact calling for a different human response, and none may be collapsed
 * into another: "you withdrew this", "the window closed", "the quota is spent", "an operator
 * stopped everything" and "your organization is not enrolled" are five different conversations.
 * AMA-4 had to repair exactly this collapse at its gate.
 */
export type StandingMutationUnreachableReason =
  | "withdrawn"
  | "expired"
  | "not-yet-valid"
  | "exhausted"
  | "root-control-disabled"
  | "tenant-not-enrolled"
  | "agent-not-in-service";

export type StandingMutationReachability =
  | { readonly status: "reachable" }
  | { readonly status: "unreachable"; readonly reason: StandingMutationUnreachableReason };
