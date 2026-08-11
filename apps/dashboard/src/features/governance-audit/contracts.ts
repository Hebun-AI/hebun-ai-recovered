/*
 * governance-audit/contracts.ts — the typed vocabulary of governed mutation history (G1).
 *
 * WHO OWNS WHAT, STATED ONCE:
 *
 *   CURRENT STATE      `knowledge_facts` / `knowledge_nodes` — what the organization holds now.
 *   MUTATION HISTORY   `audit_log` — what was attempted, by whom, and how it ended.
 *
 * These are different authorities and G1 keeps them different. Current-state columns
 * (`created_by`, `selected_by_actor_id`) answer "who established the record that exists"; they
 * cannot answer "what was attempted and refused", because a refusal leaves no row behind. That gap
 * is exactly what an append-only sink is for.
 *
 * `audit_log` is not new. It has existed since the audit-event-backbone migration, documented as
 * "the shared, cross-domain, immutable audit sink", deliberately built WITHOUT `tenantColumns` so it
 * carries no soft-delete, no `updatedBy`, and no version-update semantics. Its own header says
 * immutability "is enforced at the write layer (later)". G1 is that write layer. No second sink was
 * created, and no migration was needed.
 *
 * Pure types. No React, no I/O, no server, no authority.
 */

/** The audit domain this event belongs to. G1 introduces exactly one. */
export const KNOWLEDGE_ENTITY_TYPE = "knowledge_fact";

/**
 * Mutation classes. ONLY the ones a product capability actually performs today.
 *
 * `knowledge.create` is K2; `knowledge.supersede` is K3's correction — a NEW version replacing the
 * active one, never an in-place edit. G1's prediction held: adding it moved no authority and needed
 * no migration, because `action` is a string on `audit_log` and the metadata already carried
 * prior/new node identity and both version counters.
 *
 * Still deliberately ABSENT: `knowledge.delete`, `knowledge.ratify`, `knowledge.rollback`. A
 * vocabulary entry is a claim, and none of those capabilities exists. Rollback in particular is
 * absent BY DESIGN, not by omission: restoring an older statement must produce a NEW version whose
 * content intentionally restores it, never a silent reactivation of a historical node.
 */
export type KnowledgeMutationAction =
  | "knowledge.create"
  | "knowledge.supersede"
  /**
   * K4 — a Governance ratify decision was BOUND to one exact version, writing that version's
   * ratification linkage. It belongs in this vocabulary because it is a change to Knowledge: the
   * decision itself is separately recorded under the `governance_decision` entity type, by a
   * different sibling writer. Two truthful events about two different authorities, in one
   * transaction — not one event duplicated.
   *
   * `knowledge.reject` is deliberately ABSENT: a rejection records a Governance decision and
   * changes NOTHING in Knowledge, so there is no Knowledge mutation to file.
   */
  | "knowledge.ratify";

export const KNOWLEDGE_MUTATION_ACTIONS: readonly KnowledgeMutationAction[] = [
  "knowledge.create",
  "knowledge.supersede",
  "knowledge.ratify",
];

/**
 * The outcome vocabulary. These are the `audit_result` enum's own values — reused, not duplicated.
 *
 *   committed    the canonical transaction committed. The organization's Knowledge changed.
 *   rejected     a governed rule refused it. Nothing changed, and that refusal is history.
 *   rolled-back  the transaction was attempted and did not survive. Nothing changed.
 *
 * `authorized` is deliberately NOT an outcome. Authorization is the PRECONDITION for being recorded
 * at all (see `KNOWLEDGE_AUDIT_BOUNDARY`), so every event here is already an authorized attempt;
 * collapsing "was allowed to try" into "succeeded" is the confusion this vocabulary prevents.
 */
export type KnowledgeMutationOutcome = "committed" | "rejected" | "rolled-back";

/**
 * Why a non-committed mutation ended as it did. A closed set, so history stays queryable and a
 * free-text excuse cannot drift in.
 */
export type KnowledgeMutationReason =
  /** The fact identity already exists for this tenant; nothing was overwritten. */
  | "duplicate-identity"
  /** The canonical transaction failed and rolled back. */
  | "write-failed"
  /**
   * K3 — the active version moved between reading it and writing. Someone else's correction won,
   * and this one was refused rather than silently overwriting theirs.
   */
  | "stale-version"
  /** The targeted fact does not exist for this tenant, or its active node is unresolvable. */
  | "fact-unresolvable";

/**
 * WHICH ATTEMPTS BECOME GOVERNANCE HISTORY. Stated as a value so the rule is testable, and so a
 * later phase cannot quietly widen it.
 *
 * Recorded: an attempt that PASSED the authority gate and carries a well-formed Knowledge identity.
 * Such an attempt is a real actor, with real authority, trying to change a real governed identity —
 * whether it commits or is refused, that is Knowledge governance history.
 *
 * NOT recorded here:
 *   - unauthenticated requests — there is no tenant and no actor to attribute, and an unauthenticated
 *     caller must never be able to append to a tenant's governance ledger;
 *   - forbidden requests (authenticated, insufficient band) — that is an AUTHORIZATION event about a
 *     person, not a change to Knowledge. It belongs to security/auth telemetry, which is a separate
 *     authority and is not connected. Recording it here would both duplicate an authority and let an
 *     unauthorized user write into the governance record at will.
 *   - malformed input — no governed identity is even named, so there is nothing to record it against.
 *
 * The cost of this boundary is stated honestly in the closure doc: Knowledge mutation history is a
 * record of what AUTHORIZED actors did, not a complete intrusion log.
 */
export const KNOWLEDGE_AUDIT_BOUNDARY = Object.freeze({
  recordsAuthorizedAttempts: true as const,
  recordsUnauthenticatedAttempts: false as const,
  recordsForbiddenAttempts: false as const,
  recordsMalformedInput: false as const,
  rationale:
    "Knowledge mutation history records what authorized actors did to governed Knowledge identities. " +
    "Authentication and authorization failures are events about a principal, not changes to Knowledge; " +
    "they belong to security telemetry, which is a separate authority and is not connected.",
});

/** The Knowledge identity a mutation targeted. Identity only — never content. */
export interface KnowledgeMutationIdentity {
  /** The `knowledge_facts` row id this mutation established or targeted. */
  readonly factId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
}

/**
 * The identity metadata carried alongside the event.
 *
 * CONTENT IS NOT DUPLICATED. No statement, no title, no body — this ledger records that a change
 * happened to a named identity, not what the change said. Audit storage must not become a shadow
 * Knowledge database, and reconstructing content is the canonical tables' job, not history's.
 *
 * `priorKnowledgeNodeId` and the version counters are present and currently unused for
 * `knowledge.create`: they are the fields a K3 supersession would populate, and having them here is
 * what makes K3 an added action rather than a new audit authority.
 */
export interface KnowledgeMutationMetadata {
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
  /** The node this mutation selected as active, when one was created. */
  readonly newKnowledgeNodeId?: string;
  /** The node that was active before. Absent for a create; a supersession sets it. */
  readonly priorKnowledgeNodeId?: string;
  /** The fact version AFTER the mutation (1 for a create). */
  readonly factVersion?: number;
  /** The active node's version AFTER the mutation (1 for a create). */
  readonly knowledgeVersion?: number;
  /** The fact version this mutation replaced. Set by a supersession. */
  readonly priorFactVersion?: number;
  /** The active node's version this mutation replaced. Set by a supersession. */
  readonly priorKnowledgeVersion?: number;

  /* ── K4: the Governance linkage a ratification bound, by reference only ── */
  /** The `decision_records` row that authorized this ratification. */
  readonly ratificationDecisionId?: string;
  /** The `governance_sessions` row that decision was made inside. */
  readonly governanceSessionId?: string;
  /** The ratification state BEFORE this mutation. Always false today: re-ratification is refused. */
  readonly previouslyRatified?: boolean;

  readonly reason?: KnowledgeMutationReason;
}

/** One governed Knowledge mutation, as product code sees it. */
export interface KnowledgeMutationEvent {
  readonly action: KnowledgeMutationAction;
  readonly identity: KnowledgeMutationIdentity;
  readonly outcome: KnowledgeMutationOutcome;
  readonly reason?: KnowledgeMutationReason;
  readonly metadata: KnowledgeMutationMetadata;
}

/** One historical record, as a reader sees it. Never the raw database row. */
export interface KnowledgeMutationRecord {
  readonly auditId: string;
  readonly action: string;
  readonly outcome: KnowledgeMutationOutcome;
  readonly factId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly scope: string;
  readonly newKnowledgeNodeId: string | null;
  readonly priorKnowledgeNodeId: string | null;
  readonly reason: KnowledgeMutationReason | null;
  /** The acting principal. Type and id only — no name, no email, no session material. */
  readonly actorType: string;
  readonly actorId: string;
  readonly occurredAt: string;
  readonly recordedAt: string;
}

/** How a history read failed. Fails closed rather than returning a partial history. */
export type KnowledgeMutationHistoryUnavailable =
  | "no-authorized-tenant-context"
  | "persistence-not-configured"
  | "read-failed";

export type KnowledgeMutationHistory =
  | { readonly status: "read"; readonly records: readonly KnowledgeMutationRecord[] }
  | {
      readonly status: "unavailable";
      readonly reason: KnowledgeMutationHistoryUnavailable;
      readonly detail?: string;
    };
