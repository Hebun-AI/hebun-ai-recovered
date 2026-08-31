/*
 * agent_mandates — the organization's recorded statement of the bounded purpose ONE durable agent
 * serves, and the maximum surface inside which it may propose (AMA-1).
 *
 * ── WHAT A ROW MEANS, IN ONE SENTENCE ────────────────────────────────────────
 *
 * "Under this Governance decision, this organization declares that this agent exists to do THIS,
 *  and may propose nothing outside THIS SET."
 *
 * It is a CEILING. It authorizes nothing on its own, and it can only ever SUBTRACT:
 *
 *   MANDATE      != IDENTITY
 *   MANDATE      != AUTHORITY
 *   MANDATE      != PERMISSION
 *   MANDATE      != CAPABILITY
 *   MANDATE      != PERMIT
 *   MANDATE      != EXECUTION
 *   MANDATED     != AUTHORIZED
 *   IN SCOPE     != APPROVED
 *   WIDER MANDATE != MORE POWER   (it removes a constraint; it grants nothing)
 *
 * ── WHY A NEW TABLE, AND NOT A COLUMN ON `agents` ────────────────────────────
 *
 * Measured, not preferred. Three facts settled it:
 *
 *   1. `features/agent-identity` states "TWO authorities, TWO transitions, and no third" and
 *      exports no update surface. A mandate writer inside it makes that sentence false, and the
 *      retirement writer's own contract enumerates the exact four columns that may ever move.
 *   2. A mandate must be CHANGEABLE and the change must leave history. A column on one mutable row
 *      cannot carry a supersession chain; this repository's answer to versioned governed state is
 *      the `knowledge_facts` / `knowledge_nodes` split, and this table is that shape with `agents`
 *      as the identity side.
 *   3. `agents.authority_ceiling` — the nearest-looking column — has zero writers BUT is already
 *      READ by `canonical-read/actor-resolution.ts`, which summarizes it into
 *      `authority_ceiling_summary`. Writing a mandate there would publish a CONSTRAINT as an
 *      AUTHORITY CEILING through canonical actor resolution, on the same deploy, with no test
 *      failing. It is left exactly as untouched as it was found.
 *
 * ── WHY NOT INSIDE GOVERNANCE ────────────────────────────────────────────────
 *
 * Governance authority itself resolves from `decision_records` and nothing else (G6A). Storing
 * mandate state there would make "what this agent is for" a Governance-derived fact — turning
 * Governance into the workforce authority. Six released subsystems already prove the correct shape:
 * each owns its own subject's state and borrows only `writeGovernanceDecisionWithin`.
 *
 *   AGENT MANDATE AUTHORITY  owns  the mandate, before and after a decision
 *   GOVERNANCE               owns  the decision itself
 *
 * ── THERE IS NO STATUS COLUMN, AND NO `withdrawn` FLAG ───────────────────────
 *
 * A mandate row cannot exist without the decision that established it, so `governance_decision_id`
 * is NOT NULL — that is PROVENANCE, not status, and it is the `action_permits` shape rather than
 * the nullable `knowledge_nodes.ratification_decision_id` shape (a Knowledge version exists before
 * anyone ratifies it; a mandate does not exist before anyone authorizes it).
 *
 * Withdrawal is an EMPTY `proposal_scope`, not a boolean. "The organization decided this agent may
 * propose nothing" and "no mandate has ever been established" are different facts, and they stay
 * distinguishable by the presence of a row rather than by the value of a nullable flag:
 *
 *   NO MANDATE   != EMPTY MANDATE
 *   EMPTY MANDATE != RETIRED AGENT
 *
 * ── NOTHING IN THIS TABLE IS EVER UPDATED ────────────────────────────────────
 *
 * "One effective mandate per agent" is enforced by a UNIQUE ordinal rather than by a partial index
 * over a `superseded_at` column, and the difference matters: a partial index would require the
 * WRITER TO EDIT THE PREVIOUS ROW every time a mandate changes, and a historical record a
 * superseding write can edit was never a record. Here the effective mandate is simply the row with
 * the highest `mandate_revision` for that agent, `(tenant_id, agent_id, mandate_revision)` is
 * UNIQUE, and every earlier revision stays byte-identical to the day it was written.
 *
 * That unique index is also the CONCURRENCY guarantee, and it is why this table needs no table
 * lock. `agents` needed one — its own ceremony records why: *"`agents` carries NO unique index …
 * an application-level pre-check is therefore not uniqueness."* Here the index exists, so two
 * simultaneous revisions both computing N+1 produce one commit and one `unique_violation`.
 *
 * Server-side vocabulary, bounds and refusal codes live in
 * `src/features/agent-mandate/contracts.ts`.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum } from "./_enums";
import { agents } from "./agent";
import { decisionRecords, governanceSessions } from "./governance";

/**
 * THE RELEASED PROPOSAL VOCABULARY, AT THE STORAGE LAYER.
 *
 * The single source of this list is `AGENT_ORIGINABLE_ACTION_KINDS` in
 * `features/agent-origination/contracts.ts`. It is repeated here — and ONLY here — because a
 * PostgreSQL CHECK cannot import TypeScript, and a scope that the database would admit but the
 * released vocabulary does not is exactly the superset this phase exists to make unrepresentable.
 *
 * The two are pinned equal by a firewall test that reads both. If a later phase widens the
 * released vocabulary without widening this CHECK, a mandate naming the new kind is refused BY THE
 * DATABASE — which is the safe direction to fail.
 */
const ORIGINABLE_ACTION_KINDS_SQL = sql`array['send']::text[]`;

export const agentMandates = pgTable(
  "agent_mandates",
  {
    ...tenantColumns,

    /**
     * WHICH DURABLE AGENT THIS MANDATE BOUNDS.
     *
     * NOT NULL: a mandate about no agent bounds nothing. ONE agent, never a set — a purpose that
     * applied to "the agents" would be an organizational policy, and this phase establishes no
     * policy authority.
     *
     * This is the SUBJECT. It is never the author: see `established_by_actor_*`.
     */
    agentId: uuid("agent_id").notNull(),

    /**
     * THE REVISION ORDINAL, AND THE WHOLE VERSIONING MODEL.
     *
     * Starts at 1 and increases by one. The EFFECTIVE mandate is the row holding the highest
     * ordinal for this agent; every lower ordinal is history and is never touched again.
     *
     * Deliberately NOT the base `version` column from `tenantColumns` — that counts writes to a
     * row, which is a different fact. `knowledge_nodes.knowledge_version` draws the same
     * distinction for the same reason.
     */
    mandateRevision: integer("mandate_revision").notNull(),

    /**
     * WHAT THIS AGENT IS FOR, IN THE ORGANIZATION'S OWN WORDS.
     *
     * Prose, because it is addressed to a human, and NOT NULL because a mandate with no stated
     * purpose is a permission list wearing the word "mandate". Nothing reads this to decide
     * anything — no gate parses it, and no model is grounded on it in this phase.
     */
    purpose: text("purpose").notNull(),

    /**
     * THE CEILING. The action kinds this agent may propose — never more.
     *
     * A `text[]` rather than a row-per-kind child table, because a scope is a VALUE of one mandate
     * revision and has no identity, no lifecycle and no provenance of its own. Splitting it would
     * create rows that could outlive or contradict the revision that means them.
     *
     * EMPTY IS LEGAL AND MEANINGFUL: it is withdrawal — the organization has decided this agent
     * may propose nothing. It is NOT the same as having no mandate at all, and it is not
     * retirement.
     *
     * A SUPERSET IS UNREPRESENTABLE, at the storage layer, by the CHECK below. Canonical form —
     * sorted, duplicate-free — is the writer's invariant and is asserted by test; at today's
     * vocabulary size the cardinality CHECK happens to make duplicates unrepresentable too, and
     * that is stated rather than relied upon.
     */
    proposalScope: text("proposal_scope").array().notNull(),

    /**
     * WHEN THIS REVISION TOOK EFFECT. The establishing transaction's clock.
     *
     * There is deliberately no `effective_until` and no `superseded_at`: a revision stops being
     * effective when a higher ordinal exists, which is a fact about the table rather than a column
     * some writer must remember to stamp. Two places that could disagree about when a mandate
     * ended is one place too many.
     */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }).notNull(),

    /* ── THE GOVERNANCE BINDING. Provenance, never status. ───────────────────── */

    /**
     * The decision that authorized this exact revision. NOT NULL, `restrict` — a mandate's
     * legitimacy is not deletable, exactly as `action_permits` established.
     */
    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    /** The session that decision was recorded in. */
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    /**
     * THE ACCOUNTABLE HUMAN, as the canonical polymorphic pair, CHECK-constrained to `human`.
     *
     * This is where "an agent cannot establish or widen its own mandate" stops being a sentence and
     * becomes a database fact. A row naming an agent as the establisher is REJECTED BY POSTGRES,
     * independently of every line of application code — and independently of anyone remembering to
     * keep this table's writer honest in a later phase.
     */
    establishedByActorType: actorTypeEnum("established_by_actor_type").notNull(),
    establishedByActorId: uuid("established_by_actor_id").notNull(),

    /**
     * LINEAGE. The revision this one replaces.
     *
     * NULL exactly on revision 1, enforced by CHECK below in BOTH directions, so "the first
     * mandate" and "a later mandate that forgot its predecessor" are not the same row shape.
     * Naming a predecessor withdraws nothing and edits nothing: the older row stays exactly as it
     * was written. This is the `knowledge_nodes` and `agent_improvement_hypotheses` supersession
     * shape, kept deliberately.
     */
    supersedesMandateId: uuid("supersedes_mandate_id").references(
      (): AnyPgColumn => agentMandates.id,
    ),
  },
  (t) => [
    index("agent_mandates_tenant_agent_idx").on(t.tenantId, t.agentId),

    /**
     * ONE EFFECTIVE MANDATE PER AGENT, AND NO HISTORY MUTATION.
     *
     * The effective mandate is `max(mandate_revision)`, so exactly one row holds it by arithmetic.
     * This index is what makes that arithmetic trustworthy under concurrency: two simultaneous
     * establishments both reading revision N and both writing N+1 produce one commit and one
     * `unique_violation`, with no table lock and no row ever updated.
     */
    uniqueIndex("agent_mandates_tenant_agent_revision_uq").on(
      t.tenantId,
      t.agentId,
      t.mandateRevision,
    ),

    /** One Governance decision establishes at most one mandate revision. */
    uniqueIndex("agent_mandates_decision_uq").on(t.governanceDecisionId),

    /**
     * A REVISION MAY BE SUPERSEDED AT MOST ONCE. Without this, two later revisions could both
     * claim the same predecessor and the chain would fork while the ordinals stayed unique.
     */
    uniqueIndex("agent_mandates_supersedes_uq")
      .on(t.supersedesMandateId)
      .where(sql`${t.supersedesMandateId} is not null`),

    /**
     * TENANT-SAFE SUBJECT, ENFORCED BY THE DATABASE.
     *
     * The composite key `heby_origination_invocations` (SIA-2.6) and `agent_improvement_hypotheses`
     * (SIA-3) already use, for the identical reason: a mandate must not be able to bound ANOTHER
     * tenant's agent. The anchor it needs — `agents_tenant_id_uq` on `(tenant_id, id)` — already
     * exists, so this phase adds no index to `agents` and changes nothing about that table.
     *
     * `restrict` blocks nothing that happens: agents are never deleted here, and retirement leaves
     * the row in place.
     */
    foreignKey({
      name: "agent_mandates_tenant_agent_fk",
      columns: [t.tenantId, t.agentId],
      foreignColumns: [agents.tenantId, agents.id],
    }).onDelete("restrict"),

    /**
     * THE CEILING, AT THE STORAGE LAYER — the single most important constraint in this table.
     *
     * `<@` is containment: every element of `proposal_scope` must be a member of the released
     * vocabulary. A mandate admitting `grant-permission`, `modify-governance-policy`,
     * `device-action`, or any string a caller invented is not merely refused by the writer — the
     * INSERT FAILS. A firewall a test enforces can be edited by the same commit that breaks it;
     * this one cannot.
     *
     * The cardinality bound is the companion claim: a scope can never be longer than the
     * vocabulary it is drawn from, which at today's size also makes `['send','send']` impossible.
     */
    check(
      "agent_mandates_scope_subset_chk",
      sql`${t.proposalScope} <@ ${ORIGINABLE_ACTION_KINDS_SQL}
          and cardinality(${t.proposalScope}) <= cardinality(${ORIGINABLE_ACTION_KINDS_SQL})`,
    ),

    /**
     * A MANDATE IS ESTABLISHED BY A HUMAN. Not by an agent, not by a system, not by a service.
     * See `established_by_actor_type` above — this is the constraint that sentence rests on.
     */
    check(
      "agent_mandates_human_establisher_chk",
      sql`${t.establishedByActorType} = 'human'`,
    ),

    /** Ordinals start at 1 and count up. Revision 0 and negative revisions are unrepresentable. */
    check("agent_mandates_revision_chk", sql`${t.mandateRevision} >= 1`),

    /**
     * THE CHAIN, IN BOTH DIRECTIONS. Revision 1 has no predecessor; every later revision has one.
     * "A second mandate that forgot what it replaced" is unrepresentable, not merely unlikely.
     */
    check(
      "agent_mandates_lineage_chk",
      sql`(${t.mandateRevision} = 1) = (${t.supersedesMandateId} is null)`,
    ),

    /** A revision cannot supersede itself. */
    check(
      "agent_mandates_supersedes_not_self_chk",
      sql`${t.supersedesMandateId} is null or ${t.supersedesMandateId} <> ${t.id}`,
    ),

    /** A purpose that says nothing is not a purpose. Bounds live in the writer. */
    check("agent_mandates_purpose_chk", sql`char_length(btrim(${t.purpose})) > 0`),
  ],
);
