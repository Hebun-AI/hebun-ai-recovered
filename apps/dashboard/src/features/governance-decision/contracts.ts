/*
 * governance-decision/contracts.ts — the typed vocabulary of Governance decision authority (G2).
 *
 * THE CHAIN, AND WHY NO TWO LINKS MAY MERGE:
 *
 *   deployment/operator root      possession of the machine            (G2.1, external)
 *          ↓
 *   pending genesis nomination    names an eligible human              (G2.1)
 *          ↓
 *   D1 verified-human acceptance  that human accepts, at aal1          (G2.1)
 *          ↓
 *   accepted entitlement          the right to establish, once         (G2.1)
 *          ↓
 *   governance session            the bounded process                  (HERE)
 *          ↓
 *   bootstrap decision            the constitutional event             (HERE)
 *          ↓
 *   first Governance authority    a human may now decide               (HERE)
 *
 * G2.1 is NOT Governance: it is entitlement, and entitlement is not authority.
 * Authentication is NOT Governance: proving who you are grants nothing.
 * A role band is NOT Governance: `roles.type` governs product features, and no ceremony that
 * writes one confers Governance authority — not I1.1's member baseline, and not R4A's bootstrap
 * owner, which exists before any Governance decision does.
 *
 * Pure types and frozen values. No React, no I/O, no database, no authority.
 */

/** The `audit_log.entity_type` this domain owns. Distinct from Knowledge's and from genesis'. */
export const GOVERNANCE_DECISION_ENTITY_TYPE = "governance_decision";

/**
 * The decision vocabulary G2 activates. Deliberately three, not ten.
 *
 * `governance.bootstrap.established` — the genesis. Happens at most once per tenant, ever.
 * `governance.decision.recorded`     — an ordinary ratify/reject decision under that authority.
 *
 * STILL ABSENT, and each absence is a capability that does not exist: no escalate, no suspend, no
 * appeal, no promote. Those are `governance_decision_type` enum values with no runtime, and naming
 * them here would claim otherwise. (`delegate-authority` and `revoke` gained runtimes in G3;
 * `approve` gained one in I1 for membership authorization, and in I1.1 for organizational-role
 * provisioning — two domains, one decision type, and the domain is what distinguishes them.)
 */
export type GovernanceAuditAction =
  | "governance.bootstrap.established"
  | "governance.decision.recorded"
  /**
   * G3 — Governance authority moved. These are separate actions from
   * `governance.decision.recorded` because they are the only decisions that change WHO may decide;
   * filing them under the generic action would make the authority history unqueryable.
   */
  | "governance.authority.delegated"
  | "governance.authority.revoked"
  /**
   * I1 — Governance permitted a future human to be admitted. Separate for the same reason: this is
   * the only decision that changes WHO MAY EXIST in the tenant, and it grants no authority at all.
   */
  | "governance.membership.authorized"
  /**
   * I1.1 — Governance changed the tenant's organizational role structure. Separate again: this is
   * the only decision that changes WHAT KINDS of member can exist, and it grants nothing.
   */
  | "governance.role.provisioned"
  /**
   * I1.2 — the second key. Governance approved, or refused, that a prospective human may become an
   * authenticable Hebun identity. Separate actions again, and separate from each other: an approval
   * and a refusal are different constitutional acts, and a ledger that filed both under one action
   * could not answer "which enrollments were turned away".
   *
   * These are the only Governance actions whose effect is GLOBAL rather than tenant-scoped — an
   * identity belongs to Hebun, not to the tenant whose authority approved it.
   */
  | "governance.identity.enrollment.approved"
  | "governance.identity.enrollment.rejected";

export const GOVERNANCE_AUDIT_ACTIONS: readonly GovernanceAuditAction[] = [
  "governance.bootstrap.established",
  "governance.decision.recorded",
  "governance.authority.delegated",
  "governance.authority.revoked",
  "governance.membership.authorized",
  "governance.role.provisioned",
  "governance.identity.enrollment.approved",
  "governance.identity.enrollment.rejected",
];

/**
 * WHICH ATTEMPTS BECOME GOVERNANCE HISTORY. A sibling of `KNOWLEDGE_AUDIT_BOUNDARY` (G1) and
 * `GENESIS_AUDIT_BOUNDARY` (G2.1) — never an extension of either. Each domain states its own rules
 * so that tightening one can never silently move another.
 */
export const GOVERNANCE_AUDIT_BOUNDARY = Object.freeze({
  /** A committed decision. Real actor, real tenant, real constitutional effect. */
  recordsCommittedDecisions: true as const,
  /**
   * An AUTHORIZED actor refused by a governed rule — losing the one-bootstrap race, or spending an
   * entitlement that is already spent. That refusal is Governance history: a real authority tried
   * to do a real thing and the constitution said no. This mirrors G1, which records a refused
   * Knowledge mutation for exactly the same reason.
   */
  recordsRefusedAuthorizedAttempts: true as const,
  /** No tenant, no actor — and an unauthenticated caller must never append to a tenant's ledger. */
  recordsUnauthenticatedAttempts: false as const,
  /**
   * A wrong human, a wrong tenant, or a caller with no authority is an event about a PRINCIPAL,
   * not a change to Governance. That belongs to security telemetry, a separate authority which is
   * not connected.
   */
  recordsUnauthorizedAttempts: false as const,
  /**
   * Justification text is NOT duplicated into the ledger. `decision_records.justification` owns it,
   * is NOT NULL, and is never rewritten; a second copy would be a second authority for the same
   * sentence, free to drift.
   */
  duplicatesJustification: false as const,
  rationale:
    "Governance history records what an actor holding Governance authority did, and what the " +
    "constitution refused them. Authentication and authorization failures are events about a " +
    "principal, not changes to Governance.",
});

/* ────────────────────────────── Bootstrap ────────────────────────────── */

/**
 * The repository-owned vocabulary the genesis uses. Every value is an existing enum member; G2
 * invented no domain and no decision type.
 *
 * `authority-delegation` is the `governance_domain` that owns who holds authority — the only
 * domain in the enum whose subject is authority itself.
 *
 * `certify` is the `governance_decision_type` that formally attests a standing. It is NOT
 * `delegate-authority`: a delegation has a delegator, and at genesis there is nobody to delegate
 * from. That absence is the whole meaning of `bootstrap`.
 */
export const BOOTSTRAP_GOVERNANCE_DOMAIN = "authority-delegation" as const;
export const BOOTSTRAP_DECISION_TYPE = "certify" as const;
export const BOOTSTRAP_SUBJECT_TYPE = "tenant" as const;
/** `decision_records.outcome` is free text; this is the only value G2 writes for a genesis. */
export const BOOTSTRAP_OUTCOME = "authority-established" as const;

export const JUSTIFICATION_LIMITS = Object.freeze({
  minimumLength: 24,
  maximumLength: 2000,
});

export type BootstrapRefusal =
  /** No authenticated session, so there is no tenant and no actor. */
  | "unauthenticated"
  /** The tenant holds no genesis nomination at all. */
  | "no-entitlement"
  /** A nomination exists but has not been accepted (still pending). */
  | "entitlement-not-accepted"
  /** The nomination was revoked and can never be spent. */
  | "entitlement-revoked"
  /** A nomination exists for this tenant, but it names a different human. */
  | "not-the-entitled-human"
  /** This entitlement has already produced a genesis decision. */
  | "entitlement-already-consumed"
  /** The tenant already has a bootstrap decision — including one that just won a race. */
  | "already-bootstrapped"
  /** Justification missing, too short, or too long. */
  | "justification-required"
  /** The durable store is not configured or the transaction failed. */
  | "persistence-unavailable";

export type BootstrapResult =
  | {
      readonly status: "established";
      readonly decisionId: string;
      readonly sessionId: string;
      readonly establishedAt: string;
    }
  | { readonly status: "refused"; readonly reason: BootstrapRefusal };

/* ─────────────────────── Post-bootstrap decisions ─────────────────────── */

/**
 * WHO MAY DECIDE AFTER GENESIS — the narrowest rule the repository actually supports.
 *
 * Derived, not invented, from three facts already on disk:
 *
 *   1. `governance.ts` states a bootstrap decision "is the first authority in a tenant". The
 *      decision's own `actor_id` is therefore the human in whom that authority resides.
 *   2. Governance is documented as "the ONLY authority that may approve / ratify / promote /
 *      certify / suspend / revoke / delegate / escalate authority". Holding Governance authority
 *      IS the right to make Governance decisions.
 *   3. `authority-delegation` (domain) and `delegate-authority` (decision type) exist, so authority
 *      moves ONLY by a Governance decision — and that runtime is deliberately not built. Until it
 *      is, the set of Governance authorities in a tenant is exactly `{ bootstrap actor }`.
 *
 * What was NOT used, and why: `roles.type` (if it conferred Governance authority the bootstrap
 * decision would be redundant — and R4A makes that concrete rather than theoretical: the bootstrap
 * OWNER role is written before any Governance decision exists, so a model that read the band would
 * hand a tenant its first authority without a ceremony ever running. The original wording here said
 * role bands were "seeded, never established by any ceremony"; I1.1's member baseline and R4A's
 * bootstrap owner have both made that origin claim false, while leaving the conclusion untouched);
 * `permissions` /
 * `role_permissions` (schema-only, zero rows, zero readers); `memberships.authority_scope`
 * (unwritten). Borrowing any of them would invent an authority model.
 */
export const POST_BOOTSTRAP_AUTHORITY_MODEL = Object.freeze({
  kind: "bootstrap-established-human" as const,
  /**
   * G3 CONNECTED THE DELEGATION RUNTIME. Authority now moves the only way `governance.ts` ever
   * allowed — by a Governance decision — so `transferable` is true and the sentence that used to
   * say otherwise would now be false.
   */
  transferable: true as const,
  delegationRuntimeConnected: true as const,
  /** A2-a: the genesis itself is constitutional. G3 implements no path to end or move it. */
  bootstrapAuthorityRevocable: false as const,
  /** Unchanged, and still the point: neither of these ever grants Governance authority. */
  roleBandGrantsAuthority: false as const,
  permissionRuntimeConnected: false as const,
  limitation:
    "A tenant's Governance authorities are the actor on its bootstrap decision, plus every human " +
    "holding an unrevoked delegation. The bootstrap human's authority is permanent: G3 implements " +
    "no revocation or transfer of it, so a tenant can never reach zero authorities — and a tenant " +
    "whose bootstrap human becomes unavailable WITHOUT having delegated first is still stranded, " +
    "because only an authority can create one. Authority transfer is a separate phase.",
});

/**
 * The decision types G2 activates for ordinary decisions.
 *
 * RECORDING A DECISION MUTATES NOTHING BUT THE LEDGER. A `ratify` decision does not touch
 * `knowledge_nodes.ratified_at`, and a `reject` does not withdraw anything. G2 owns the decision
 * record; K4 will later bind a ratification decision to a Knowledge version, and that binding is
 * the entire content of K4.
 */
export type GovernanceDecisionType = "ratify" | "reject";
export const GOVERNANCE_DECISION_TYPES: readonly GovernanceDecisionType[] = ["ratify", "reject"];

/**
 * The CLOSED subject vocabulary. A decision must name what it is about without owning it.
 *
 * ONE ENTRY, AND IT IS A VERSION — NOT AN IDENTITY. G2 originally named `knowledge_fact`, which was
 * wrong in a way K4 exposed: a fact is a timeless identity whose active version changes, so a
 * decision bound to it would silently mean "whatever v is current when someone reads this". A
 * ratification must bind to the exact version a human reviewed, so the subject is
 * `knowledge_node` — the version row itself, carrying its own `knowledge_version` and its own
 * place in the supersession chain.
 *
 * `knowledge_fact` was REMOVED rather than kept alongside. Leaving it would allow a fact-level
 * ratify decision to exist and later be mistaken for version ratification, which is exactly the
 * approximation K4 must not make.
 *
 * A free-text subject would let a client name a URL, a path, or a command string; the type makes
 * those unrepresentable rather than filtered. Adding a second subject means proving a second
 * server-side existence check, which is a deliberate edit here.
 *
 * ── THE SECOND SUBJECT (TRH-10), AND ITS EXISTENCE CHECK ─────────────────────
 *
 * `work_artifact_revision` is that deliberate edit, and it obeys the same rule the first entry
 * established: THE SUBJECT IS A VERSION, NOT AN IDENTITY. Binding a review to `work_artifacts.id`
 * would mean "whatever revision is current when someone reads this" — the exact approximation
 * `knowledge_fact` was removed for. `work_artifact_revisions` carries its own uuid primary key, so
 * the exact immutable bytes a human read are nameable without inventing a composite id.
 *
 * The promised second server-side existence check lives in `work-artifact-review`: it resolves the
 * revision inside the caller's tenant AND inside the named artifact, so a wrong tenant, a wrong
 * artifact and a missing revision are one indistinguishable refusal.
 *
 * REVIEWING IS NOT RATIFYING. A ratification settles an organization's own knowledge; an accepted
 * revision is prepared work a human judged fit for the next internal step, and it never becomes
 * Knowledge by being accepted. The two are different subjects in different domains for that reason.
 */
export type GovernanceSubjectType = "knowledge_node" | "work_artifact_revision";
export const GOVERNANCE_SUBJECT_TYPES: readonly GovernanceSubjectType[] = [
  "knowledge_node",
  "work_artifact_revision",
];

/**
 * The `governance_domain` an ordinary G2 decision belongs to, per subject. Existing enum values,
 * kept as literal types so a domain outside the enum cannot compile.
 */
export const SUBJECT_GOVERNANCE_DOMAIN = Object.freeze({
  knowledge_node: "knowledge-ratification",
  work_artifact_revision: "artifact-review",
} as const);

export type DecisionRefusal =
  | "unauthenticated"
  /** The tenant has no bootstrap decision, so no Governance authority exists yet. */
  | "no-governance-authority"
  /** Authenticated, but not the human the bootstrap decision established. */
  | "not-the-governance-authority"
  | "justification-required"
  /** The named subject does not exist in this tenant. */
  | "subject-unresolvable"
  | "invalid-decision-type"
  | "persistence-unavailable";

export type DecisionResult =
  | {
      readonly status: "recorded";
      readonly decisionId: string;
      readonly sessionId: string;
      readonly decidedAt: string;
    }
  | { readonly status: "refused"; readonly reason: DecisionRefusal };

/* ────────────────────────────── Read model ────────────────────────────── */

/**
 * What a Governance read may expose. Every field is a real column.
 *
 * Deliberately ABSENT: confidence, authority score, governance health percentage, approval
 * percentage, quorum progress. `governance_health` exists as a column but no runtime computes it,
 * so surfacing it would be a number with no meaning behind it.
 */
export interface GovernanceDecisionView {
  readonly decisionId: string;
  readonly sessionId: string | null;
  readonly decisionType: string;
  readonly subjectType: string;
  readonly subjectId: string | null;
  readonly actorType: string;
  readonly actorId: string;
  readonly bootstrap: boolean;
  readonly outcome: string;
  readonly justification: string;
  readonly decidedAt: string;
}

export interface GovernanceAuthorityView {
  /** The tenant's genesis decision, or null when Governance has not been established. */
  readonly bootstrap: GovernanceDecisionView | null;
  /** True only when the CURRENTLY authenticated human is the established authority. */
  readonly viewerIsGovernanceAuthority: boolean;
}

export type GovernanceAuthorityLookup =
  | { readonly status: "read"; readonly authority: GovernanceAuthorityView }
  | {
      readonly status: "unavailable";
      readonly reason: "no-authorized-tenant-context" | "persistence-unavailable";
    };

/**
 * What establishing Governance authority DOES and DOES NOT do. Values, not prose, so the surface
 * renders exactly what a test asserts.
 */
export const BOOTSTRAP_EFFECT =
  "records that Governance authority for this tenant now exists, and that it resides in you";

export const BOOTSTRAP_NON_EFFECTS: readonly string[] = Object.freeze([
  "does not ratify any Knowledge",
  "does not grant administrative rights",
  "does not grant Knowledge write access",
  "does not enable providers or the model kill-switch",
  "does not grant execution, Computer Use, or terminal authority",
  "does not change your application role",
  "does not create permissions",
  "does not delegate authority to anyone else",
]);

/** Stated on the surface: a recorded decision is a record, not an effect on its subject. */
export const DECISION_NON_EFFECT =
  "Recording a decision does not change the subject. A ratify decision does not mark Knowledge " +
  "ratified; binding a ratification to a Knowledge version is a later phase.";
