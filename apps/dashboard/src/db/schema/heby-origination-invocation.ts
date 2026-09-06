/*
 * heby_origination_invocations — AGENT-PROPOSAL-4B.
 *
 * WHAT THIS OWNS: one sentence, about one model call made on the AGENT-ORIGINATION path —
 * "an invocation was registered, this is how far it got, and this is what the provider returned".
 *
 * WHAT THIS DOES NOT OWN, EVER: whether a proposal exists, its status, its attribution, its
 * approval, any permit, any execution, any send. `heby_action_requests` and its existing
 * authorities own all of that and are unchanged. Nothing here is read to decide anything; it is
 * read only to answer, after the fact, "which model call caused that proposal".
 *
 * ── WHY IT IS NOT `messages` ─────────────────────────────────────────────────
 *
 * Measured, not assumed: `messages.conversation_id`, `messages.role` and `messages.content` are
 * all NOT NULL. An origination has no conversation, no role, and no content that may be stored —
 * persisting the model's raw response purely to prove transport is exactly what this phase is
 * forbidden to do. Recording it there would require fabricating all three.
 *
 * ── WHY IT IS NOT `audit_log` ────────────────────────────────────────────────
 *
 * `audit_log.entity_id` and `entity_type` are NOT NULL. Four outcomes below produce NO entity at
 * all — a pre-dispatch refusal, a dispatch failure, an invalid selection, and `no-action` — so
 * those rows would be unwritable without inventing an entity id. `audit_log` is also a Governance
 * audit authority written by nine `governance-audit/` modules, and a model call is not a
 * Governance act.
 *
 * ── TWO ORTHOGONAL AXES, DELIBERATELY NOT ONE ────────────────────────────────
 *
 * `state` describes the MODEL side and stops there. `filing_outcome` describes what the proposal
 * authority RETURNED to this attempt. Collapsing them would make "a valid selection that filed
 * nothing" indistinguishable across five different causes — duplicate refusal, inlet refusal,
 * persistence failure, a crash, and never having attempted at all.
 *
 * ── THE CAUSAL LINK LIVES ON THE OTHER SIDE ──────────────────────────────────
 *
 * There is deliberately NO `action_request_id` here. The link is
 * `heby_action_requests.origination_invocation_id`, written as a VALUE inside the proposal's own
 * INSERT. That direction is chosen because it needs no write after the proposal commits: a crash
 * immediately after that commit still leaves the causal proof durable. Storing the relationship on
 * both sides would be one fact in two places, and the two could disagree.
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
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { agents } from "./agent";

/**
 * The model-side lifecycle, and nothing else.
 *
 * `registered` is the initial state and is NOT a claim that anything was sent. A row left in it
 * means the outcome is UNKNOWN — a call may or may not have gone out — never "no call occurred".
 *
 * `not-dispatched` is the only state that positively proves nothing was spent: the released
 * transport refuses on its output bound, its per-instance cap, or an exhausted process budget
 * BEFORE any network I/O.
 *
 * There is no `provider-contacted`. The released adapter maps a DNS failure and a refused socket
 * to the same code, so "contacted" is not a fact Hebun can prove.
 */
export const ORIGINATION_INVOCATION_STATES = [
  "registered",
  "not-dispatched",
  "dispatch-failed",
  "selection-invalid",
  "no-action",
  "selection-valid",
] as const;

/**
 * What the proposal authority returned to THIS attempt. An observation, never a lifecycle.
 *
 * `not-attempted` covers both "the selection was never valid enough to file" and "the runtime
 * stopped before it could record an answer". It is therefore NEVER evidence that no proposal
 * exists — a proposal carrying this invocation's id is the authority on that, and it outranks
 * this column in every reading.
 */
export const ORIGINATION_FILING_OUTCOMES = [
  "not-attempted",
  "proposed",
  "refused",
  "failed",
] as const;

export const hebyOriginationInvocations = pgTable(
  "heby_origination_invocations",
  {
    ...tenantColumns,

    /**
     * WHICH DURABLE AGENT THIS CALL WAS MADE ON BEHALF OF (SIA-2.6).
     *
     * ── WHY IT IS HERE AND NOT INFERRED ──────────────────────────────────
     *
     * Until this column, an invocation could be attributed to an agent only through the proposal
     * that names it. That works for calls which produced a proposal and fails for exactly the
     * calls worth studying: `selection-invalid`, `no-action`, a refused filing. Those produce no
     * proposal, so they were attributable to nobody and were counted only at tenant level.
     *
     * The value was never missing — the origination seam resolves the proposer BEFORE it registers
     * the invocation, and simply did not store what it already held.
     *
     * ── NULLABLE, AND NULL MEANS EXACTLY ONE THING ───────────────────────
     *
     * "Durable agent attribution was not recorded." Every row written before this column existed
     * carries NULL and will carry it for ever: there is no backfill, and none is possible without
     * inventing history. NULL does NOT mean a system invocation, a deterministic invocation, a
     * call where no model was used, or an agent that can be guessed from the tenant having only
     * one. It means Hebun was not yet recording this.
     *
     * ── ATTRIBUTION IS NOT AUTHORITY ─────────────────────────────────────
     *
     * Recording that a call was made on an agent's behalf grants that agent nothing. It is the
     * same class of fact as `heby_action_requests.proposed_by_actor_id`: a recorded reference,
     * read by no decision.
     */
    agentId: uuid("agent_id"),

    /** "fake" | "live" — which transport the released selector chose. Never null: no transport, no row. */
    transport: text("transport").notNull(),

    /** One of ORIGINATION_INVOCATION_STATES. Mutable exactly once, by the origination seam. */
    state: text("state").notNull(),

    /**
     * WHY THE CALL PRODUCED NOTHING — a CLOSED code Hebun wrote, never a sentence anyone else did.
     *
     * TWO closed vocabularies reach this column, and they never overlap:
     *   · the released `ModelConnectivityError` code, when connectivity ended the call — paired
     *     with `state` `not-dispatched` or `dispatch-failed`;
     *   · TRH-18: the released `StructuredOutputRefusal`, when the provider answered and the
     *     answer was not the contract — paired with `state = 'selection-invalid'`.
     *
     * Both are literal unions declared in this repository, so the column can hold no provider
     * message, no model text, no goal text and no fragment of a malformed response. That is a
     * property of what the two writers can pass, not a convention: raw bodies are never read.
     *
     * There is deliberately no CHECK enumerating the union. The two vocabularies belong to
     * released modules that evolve on their own schedules, and a storage constraint that had to be
     * migrated in lockstep with them would eventually make an honest diagnostic UNWRITABLE — which
     * is the one thing this column must never do to the row it describes.
     *
     * DIAGNOSTIC ONLY. Nothing reads it to decide anything. Null means no failure was recorded for
     * this invocation — never that none occurred.
     */
    failureCode: text("failure_code"),

    /* ── Provider-supplied, and only ever what it actually returned ───────── */
    /** Null until a result exists; these are written only from a real ModelGenerationResult. */
    provider: text("provider"),
    model: text("model"),
    /** Null when the provider supplied none. */
    providerRequestId: text("provider_request_id"),
    /** Returned usage. Never an estimate; null when the provider supplied none. */
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),

    /* ── The filing observation ───────────────────────────────────────────── */
    /** One of ORIGINATION_FILING_OUTCOMES. */
    filingOutcome: text("filing_outcome").notNull().default("not-attempted"),
    /**
     * The released `SendProposalRefusal` the inlet returned, verbatim. This is the column that
     * separates a duplicate (`already-pending`) from a retired referent from
     * `persistence-unavailable` — without it those five causes collapse into one silence.
     * Null unless `filing_outcome = 'refused'`.
     */
    filingRefusal: text("filing_refusal"),

    /** When the row was finalized. Null while still `registered`. */
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
  },
  (t) => [
    index("heby_origination_invocations_tenant_time_idx").on(t.tenantId, t.createdAt),
    /** The per-agent aggregate SIA-1 reads. Tenant first, exactly like its sibling above. */
    index("heby_origination_invocations_tenant_agent_idx").on(t.tenantId, t.agentId),

    /*
     * TENANT-SAFE ATTRIBUTION, ENFORCED BY THE DATABASE.
     *
     * A composite key, so an invocation cannot name ANOTHER tenant's agent — the same three-way
     * binding `action_execution_attempts` uses for its permit, request and recipient, and for the
     * same stated reason: a row pointing at another tenant's row should be a database error rather
     * than a bug somebody has to notice.
     *
     * ── WHY AN FK HERE, WHEN THIS TABLE DELIBERATELY HAS NONE TO THE PROPOSAL ──
     *
     * The rule this table was built on is that PROVENANCE MUST NEVER VETO THE ACTS IT OBSERVES —
     * which is why `heby_action_requests.origination_invocation_id` has no foreign key: an FK
     * there would make a provenance row a precondition for a proposal existing.
     *
     * This FK points the other way. Provenance depends on IDENTITY, not identity on provenance. It
     * gives this table no veto over anything; it only stops it from naming an agent that does not
     * exist or belongs elsewhere. `restrict` blocks nothing that happens: agents are never deleted
     * in this repository — retirement leaves the row in place, and no delete writer exists.
     *
     * `proposed_by_actor_id` carries no FK because it is POLYMORPHIC — human, agent, system or
     * service. This column is monomorphic, so the constraint is expressible here and was not there.
     *
     * NULL is unaffected: with MATCH SIMPLE, a composite key containing a NULL is not enforced, so
     * every historical row stays valid without a backfill.
     */
    foreignKey({
      name: "heby_origination_invocations_tenant_agent_fk",
      columns: [t.tenantId, t.agentId],
      foreignColumns: [agents.tenantId, agents.id],
    }).onDelete("restrict"),

    /*
     * THE TWO VOCABULARIES, ENFORCED AT THE STORAGE LAYER.
     *
     * Declared here and not only in the SQL migration so the schema this repository reads is the
     * same schema the database holds: a constraint that exists in one and not the other is a
     * disagreement waiting to be discovered by a write that should have been rejected.
     */
    check(
      "heby_origination_invocations_state_chk",
      sql`${t.state} in ('registered','not-dispatched','dispatch-failed','selection-invalid','no-action','selection-valid')`,
    ),
    check(
      "heby_origination_invocations_transport_chk",
      sql`${t.transport} in ('fake','live')`,
    ),
    check(
      "heby_origination_invocations_filing_outcome_chk",
      sql`${t.filingOutcome} in ('not-attempted','proposed','refused','failed')`,
    ),
    /*
     * A REFUSAL REASON WITHOUT A REFUSAL IS NOT REPRESENTABLE. The reverse is deliberately
     * allowed: a refusal whose reason was lost is still an honest, if incomplete, row.
     */
    check(
      "heby_origination_invocations_filing_refusal_chk",
      sql`(${t.filingRefusal} is null) or (${t.filingOutcome} = 'refused')`,
    ),
  ],
);
