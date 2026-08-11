/*
 * Governance — the constitutional authorization layer (Spec 49).
 *
 * Two tables:
 *   - governance_sessions : one bounded authorization process (intake → decide).
 *   - decision_records    : the immutable, versioned record of each decision.
 *
 * Governance is the ONLY authority that may approve / ratify / promote / certify /
 * suspend / revoke / delegate / escalate authority. This file is SCHEMA ONLY —
 * NO authorization engine, NO approval workflow, NO policy evaluation, NO runtime.
 *
 * ── BOOTSTRAP AUTHORITY MODEL ───────────────────────────────────────────────
 * The system must NEVER create its own authority. The genesis of all authority
 * is a HUMAN. This is represented explicitly by the `bootstrap` flag on a
 * decision: a bootstrap decision is the first authority in a tenant and its
 * `actorType` MUST be "human" (Spec 49 §4 — human supremacy; agents may never
 * self-elevate). This invariant is DOCUMENTED here and enforced at the write
 * layer later — NOT by a fabricated default user and NOT by runtime logic in
 * this phase. No default users are created.
 *
 * Actor references use the canonical polymorphic (actorType, actorId) pair (S2).
 * Sessions/decisions are audit- and event-compatible via actorType/actorId +
 * correlationId/causationId (Spec 48 §7.3/§10.1) — writers are deferred.
 */

import { sql } from "drizzle-orm";
import {
  pgTable,
  boolean,
  check,
  index,
  integer,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import {
  actorTypeEnum,
  governanceDecisionTypeEnum,
  governanceDomainEnum,
  governanceHealthEnum,
  governanceLifecycleStatusEnum,
  riskClassEnum,
  votingModeEnum,
} from "./_enums";

export const governanceSessions = pgTable(
  "governance_sessions",
  {
    ...tenantColumns,

    governanceDomain: governanceDomainEnum("governance_domain").notNull(),
    decisionType: governanceDecisionTypeEnum("decision_type").notNull(),

    /** What is being authorized (polymorphic: a mission version, a policy, …). */
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id"),

    /* Proposer (may recommend; agents may never self-approve). */
    proposerActorType: actorTypeEnum("proposer_actor_type").notNull(),
    proposerActorId: uuid("proposer_actor_id").notNull(),

    riskClass: riskClassEnum("risk_class").notNull().default("medium"),
    votingMode: votingModeEnum("voting_mode"),

    /* The authority under which the session decides (actor pair; nullable until decided). */
    authoritySourceActorType: actorTypeEnum("authority_source_actor_type"),
    authoritySourceActorId: uuid("authority_source_actor_id"),

    justification: text("justification"),
    evidence: jsonb("evidence"),
    /** Typed gate results (compliance/security/legal/financial/operational/ai-safety). */
    gates: jsonb("gates"),
    /** Ordered approval-chain / voting / quorum config + progress. */
    approvalChain: jsonb("approval_chain"),

    governanceLifecycleStatus: governanceLifecycleStatusEnum(
      "governance_lifecycle_status",
    )
      .notNull()
      .default("created"),
    governanceHealth: governanceHealthEnum("governance_health")
      .notNull()
      .default("unknown"),

    correlationId: text("correlation_id"),
    causationId: text("causation_id"),
    governanceVersion: integer("governance_version").notNull().default(1),
  },
  (t) => [
    index("governance_sessions_tenant_idx").on(t.tenantId),
    index("governance_sessions_subject_idx").on(t.subjectType, t.subjectId),
    index("governance_sessions_domain_idx").on(t.governanceDomain),
    index("governance_sessions_correlation_idx").on(t.correlationId),
  ],
);

export const decisionRecords = pgTable(
  "decision_records",
  {
    ...tenantColumns,

    sessionId: uuid("session_id").references(() => governanceSessions.id),

    decisionType: governanceDecisionTypeEnum("decision_type").notNull(),
    subjectType: text("subject_type").notNull(),
    subjectId: uuid("subject_id"),

    /** The accountable deciding actor (never "the system decided"). */
    actorType: actorTypeEnum("actor_type").notNull(),
    actorId: uuid("actor_id").notNull(),

    /* The authority source the decision was made under. */
    authoritySourceActorType: actorTypeEnum("authority_source_actor_type"),
    authoritySourceActorId: uuid("authority_source_actor_id"),

    /** BOOTSTRAP AUTHORITY: true only for the genesis decision; actorType MUST be
     *  "human" (documented invariant, enforced at write layer later). */
    bootstrap: boolean("bootstrap").notNull().default(false),

    outcome: text("outcome").notNull(),
    justification: text("justification").notNull(),
    evidence: jsonb("evidence"),
    gateResults: jsonb("gate_results"),
    chainResults: jsonb("chain_results"),

    decidedAt: timestamp("decided_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    decisionVersion: integer("decision_version").notNull().default(1),
    /** Lineage — a superseding decision (e.g. an overturned appeal). */
    supersedesDecisionId: uuid("supersedes_decision_id").references(
      (): AnyPgColumn => decisionRecords.id,
    ),

    correlationId: text("correlation_id"),
    causationId: text("causation_id"),
  },
  (t) => [
    index("decision_records_tenant_idx").on(t.tenantId),
    index("decision_records_session_idx").on(t.sessionId),
    index("decision_records_subject_idx").on(t.subjectType, t.subjectId),
    index("decision_records_correlation_idx").on(t.correlationId),

    /* ── G2: THE BOOTSTRAP INVARIANTS, NOW ENFORCED BY POSTGRES ──────────────
     *
     * The header above has documented both of these since the governance foundation
     * migration, with the honest note that they were "enforced at the write layer
     * later". G2 is that write layer, and a constitutional invariant that only the
     * application enforces is not an invariant: two concurrent requests both read
     * "no bootstrap yet" and both insert. These two constraints are what make the
     * genesis of authority unrepeatable and non-delegable to a machine.
     */

    /** A tenant has exactly ONE genesis. Partial, so ordinary decisions are unconstrained. */
    uniqueIndex("decision_records_one_bootstrap_per_tenant_uq")
      .on(t.tenantId)
      .where(sql`${t.bootstrap}`),

    /** Spec 49 §4 human supremacy: an agent may never self-elevate into the genesis. */
    check(
      "decision_records_bootstrap_human_chk",
      sql`${t.bootstrap} = false or ${t.actorType} = 'human'`,
    ),
  ],
);
