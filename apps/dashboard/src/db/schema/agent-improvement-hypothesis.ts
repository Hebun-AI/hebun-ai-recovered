/*
 * agent_improvement_hypotheses — an evidence-backed HYPOTHESIS about one durable agent's
 * selection behaviour, durable so Governance can decide it (SELF-IMPROVING-AGENTS-3).
 *
 * ── WHAT THIS ROW IS, IN ONE SENTENCE ────────────────────────────────────────
 *
 * "From this authoritative evidence, this candidate change MIGHT improve this structural outcome."
 *
 * It is a QUESTION PUT TO A HUMAN, not an answer, not a plan, and not a change. Nothing reads a row
 * here to decide anything, nothing executes from it, and no agent is altered by its existence.
 *
 *   PROPOSED IMPROVEMENT ≠ IMPROVEMENT
 *   HYPOTHESIS           ≠ AUTHORIZATION
 *   AUTHORIZATION        ≠ APPLICATION
 *   APPLICATION          ≠ SUCCESS
 *   STRUCTURAL VALIDITY  ≠ BUSINESS SUCCESS
 *
 * ── WHY A NEW TABLE, AND NOT `improvement_proposals` ─────────────────────────
 *
 * `improvement_proposals` (`src/db/schema/learning.ts`) already exists and was the obvious
 * candidate. It was measured against this phase's requirements and REFUSED, for reasons that are
 * facts about the schema rather than preferences:
 *
 *   1. It carries `applied_at` and `rolled_back_at`. Those are APPLICATION truth. SIA-3 cannot
 *      apply anything, so it would own two columns it may never write and a reader could not tell
 *      "never applied" from "not applicable here".
 *   2. It carries `approved_at`, duplicating a Governance decision into the proposal. The decision
 *      record is authoritative; a second copy can disagree with it.
 *   3. Its `improvement_proposal_type` vocabulary is `skill | procedure | workflow | prompt |
 *      calibration | optimization`. `prompt` is a mutation SIA-3 is forbidden to propose, and none
 *      of the six names selection behaviour.
 *   4. Its `learning_session_id` points at `learning_sessions`, which has zero writers. Filling it
 *      in the shape it was designed for would require SIA-3 to write Learning, which it may not.
 *   5. It has NO agent column — only polymorphic `target_module/target_type/target_id` text with no
 *      foreign key — so it cannot bind a hypothesis to a tenant-consistent agent. That is exactly
 *      the defect SIA-2.6 removed from origination invocations one migration ago.
 *   6. Every column in it is nullable, so it can enforce none of the above.
 *
 * It is a placeholder authored for a DIFFERENT capability (the Learning Engine, which improves the
 * customer's organization). Reviving it would not create an authority; it would create a second
 * source of truth with five fields this phase may never honestly fill. It is left exactly as dead
 * as it was found.
 *
 * ── THERE IS NO STATUS COLUMN, AND THAT IS THE DESIGN ────────────────────────
 *
 *   HYPOTHESIS STATUS ≠ GOVERNANCE DECISION
 *
 * A hypothesis exists or it does not. Whether Governance has decided about it is answered by
 * READING `decision_records` for this row's id — the authoritative ledger — never by a column here
 * that a writer would have to keep in step. A status column would be a second copy of a decision,
 * and the two could disagree. The one this table would lose is the one Governance already owns.
 *
 * Consequently there is no `approved`, no `applied`, no `improved` and no `successful` state,
 * because SIA-3 can prove none of those facts.
 *
 * Server-side vocabulary and evidence contracts live in
 * `src/features/agent-improvement-hypothesis/contracts.ts`.
 */
import { sql } from "drizzle-orm";
import {
  pgTable,
  check,
  foreignKey,
  index,
  integer,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum } from "./_enums";
import { agents } from "./agent";

export const agentImprovementHypotheses = pgTable(
  "agent_improvement_hypotheses",
  {
    ...tenantColumns,

    /**
     * WHICH DURABLE AGENT THIS HYPOTHESIS IS ABOUT.
     *
     * NOT NULL: a hypothesis about no agent is not a hypothesis about selection behaviour. One
     * agent, never a set — a candidate change that would apply to "the agents" is a policy change,
     * and this phase does not propose policy.
     *
     * This is the SUBJECT. It is not the author: see `proposed_by_actor_id`, which is a different
     * fact about a different party, and conflating the two would be a false attribution.
     */
    agentId: uuid("agent_id").notNull(),

    /**
     * WHAT CLASS OF CHANGE IS BEING HYPOTHESISED ABOUT.
     *
     * Closed at ONE value — `selection-behaviour` — and enforced by the CHECK below rather than by
     * a convention. The value is deliberately not an enum type: a Postgres enum would make the
     * vocabulary look like a settled taxonomy with five more members waiting, when in fact every
     * additional target is a phase with its own gate.
     *
     * A prompt, a model, a tool, a permission and a policy are all ABSENT here, and absent
     * structurally: no value naming them is admissible, so a hypothesis proposing one cannot be
     * stored at all.
     */
    improvementTarget: text("improvement_target").notNull(),

    /* ── THE EVIDENCE. Referenced and stated, never re-derived here. ─────────── */

    /**
     * WHICH observed weakness caused this hypothesis — one of the closed SIA-1/SIA-2.6 evidence
     * keys. It names a real, released measurement, so a reader can go and look at the same thing.
     */
    evidenceFindingKey: text("evidence_finding_key").notNull(),

    /**
     * The authoritative COLUMN the evidence was read from, as text — e.g.
     * `heby_origination_invocations.state`. A reference to where the truth lives, so the hypothesis
     * points at the record rather than replacing it.
     */
    evidenceSource: text("evidence_source").notNull(),

    /**
     * THE SNAPSHOT, AND WHY IT IS STORED RATHER THAN REFERENCED.
     *
     * The underlying evidence is a COUNT over rows that keep arriving, so it has no stable identity
     * to point at — "selection-invalid for agent A" names a different number every hour. Storing
     * the two numbers WITH the instant they were read is the honest form: it is a measurement that
     * happened, not a claim about now.
     *
     * They are not a score and cannot become one. Nothing divides them, no code path computes a
     * rate from them, and `evidence_observed_value <= evidence_observed_total` is a CHECK so the
     * pair can never describe an impossible observation.
     *
     * SIA-4 will need exactly this as the BASELINE to measure a later change against. It is stored
     * for that reason and no other.
     */
    evidenceObservedValue: integer("evidence_observed_value").notNull(),
    evidenceObservedTotal: integer("evidence_observed_total").notNull(),
    evidenceObservedAt: timestamp("evidence_observed_at", { withTimezone: true }).notNull(),

    /* ── THE HYPOTHESIS ITSELF. Prose, because it is addressed to a human. ───── */

    /** The bounded candidate change. What MIGHT be done — never what was done. */
    candidateChange: text("candidate_change").notNull(),

    /**
     * The STRUCTURAL outcome that would be expected to move. Never a business outcome, never a
     * revenue claim, never a probability — Hebun holds no record any of those could be drawn from.
     */
    expectedEffect: text("expected_effect").notNull(),

    /**
     * What this hypothesis does NOT know, stated as a requirement rather than left to the author's
     * modesty. A hypothesis with no stated limitation is being presented as a finding, and the
     * NOT NULL is what stops that from being possible.
     */
    limitations: text("limitations").notNull(),

    /* ── WHO FILED IT. The actual actor, never an assumed one. ───────────────── */

    /**
     * CHECK-CONSTRAINED TO `human`, and the constraint is the point.
     *
     * SIA-3 ships no autonomous trigger: no scheduler, no agent runtime and no background job can
     * reach the writer. Every row therefore originates in a request carrying a human's resolved
     * tenant context, and recording anything else would be an invented author.
     *
     * The CHECK also makes one firewall claim structural rather than procedural: an agent cannot
     * file a hypothesis about itself, because a row naming an agent as its own proposer is
     * REJECTED BY THE DATABASE. Widening this is a later phase's deliberate act, and it would have
     * to justify what changed.
     */
    proposedByActorType: actorTypeEnum("proposed_by_actor_type").notNull(),
    proposedByActorId: uuid("proposed_by_actor_id").notNull(),

    /**
     * LINEAGE. A later hypothesis that replaces this one names it here.
     *
     * Nullable, self-referencing, and it supersedes NOTHING by itself: naming a predecessor does
     * not withdraw it, does not decide it, and does not alter it. The older row stays exactly as it
     * was written, because a historical record that a superseding write could edit was never a
     * record. This is the `improvement_proposals.supersedes_proposal_id` shape and the
     * `knowledge_nodes` supersession shape, kept deliberately.
     */
    supersedesHypothesisId: uuid("supersedes_hypothesis_id").references(
      (): AnyPgColumn => agentImprovementHypotheses.id,
    ),
  },
  (t) => [
    index("agent_improvement_hypotheses_tenant_agent_idx").on(t.tenantId, t.agentId),
    index("agent_improvement_hypotheses_tenant_time_idx").on(t.tenantId, t.createdAt),
    index("agent_improvement_hypotheses_supersedes_idx").on(t.supersedesHypothesisId),

    /*
     * TENANT-SAFE SUBJECT, ENFORCED BY THE DATABASE.
     *
     * The composite key SIA-2.6 added to `heby_origination_invocations` one migration ago, for the
     * identical reason: a hypothesis must not be able to name ANOTHER tenant's agent. The anchor it
     * needs — `agents_tenant_id_uq` on `(tenant_id, id)` — already exists, so this phase adds no
     * index to `agents` and changes nothing about that table.
     *
     * `restrict` blocks nothing that happens: agents are never deleted in this repository, and
     * retirement leaves the row in place.
     */
    foreignKey({
      name: "agent_improvement_hypotheses_tenant_agent_fk",
      columns: [t.tenantId, t.agentId],
      foreignColumns: [agents.tenantId, agents.id],
    }).onDelete("restrict"),

    /*
     * THE FIRST TARGET BOUNDARY, AT THE STORAGE LAYER.
     *
     * One admissible value. A hypothesis proposing a prompt change, a model switch, a tool change,
     * a permission change or a policy change is UNREPRESENTABLE rather than merely unwritten — the
     * insert fails. A firewall a test enforces can be edited by the same commit that breaks it;
     * this one cannot.
     */
    check(
      "agent_improvement_hypotheses_target_chk",
      sql`${t.improvementTarget} in ('selection-behaviour')`,
    ),

    /*
     * THE CLOSED EVIDENCE VOCABULARY.
     *
     * Every value names a measurement SIA-1 or SIA-2.6 actually publishes. A hypothesis cannot cite
     * evidence Hebun does not hold, because the string naming it would not be admissible.
     */
    check(
      "agent_improvement_hypotheses_finding_chk",
      sql`${t.evidenceFindingKey} in (
        'selection-invalid',
        'no-action',
        'dispatch-failed',
        'not-dispatched',
        'outcome-unrecorded',
        'filing-refused',
        'filing-failed',
        'provenance-coverage'
      )`,
    ),

    /*
     * THE OBSERVATION IS POSSIBLE.
     *
     * A part cannot exceed its whole, and neither can be negative. Without this a row could store
     * "9 of 3" — a number no reader could interpret and no baseline SIA-4 could measure against.
     */
    check(
      "agent_improvement_hypotheses_observation_chk",
      sql`${t.evidenceObservedValue} >= 0
          and ${t.evidenceObservedTotal} >= 0
          and ${t.evidenceObservedValue} <= ${t.evidenceObservedTotal}`,
    ),

    /*
     * ONLY A HUMAN FILES A HYPOTHESIS — see the column comment. This is the database half of "SIA-3
     * cannot approve itself" and "no agent self-modification": the author of a hypothesis is a
     * party structurally distinct from its subject.
     */
    check(
      "agent_improvement_hypotheses_human_author_chk",
      sql`${t.proposedByActorType} = 'human'`,
    ),

    /*
     * A HYPOTHESIS MAY NOT SUPERSEDE ITSELF. A self-loop is not lineage; it is a cycle that would
     * make the chain unreadable in both directions.
     */
    check(
      "agent_improvement_hypotheses_supersedes_not_self_chk",
      sql`${t.supersedesHypothesisId} is null or ${t.supersedesHypothesisId} <> ${t.id}`,
    ),
  ],
);
