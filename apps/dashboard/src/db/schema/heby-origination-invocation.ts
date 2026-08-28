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
import { pgTable, check, index, integer, text, timestamp } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";

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

    /** "fake" | "live" — which transport the released selector chose. Never null: no transport, no row. */
    transport: text("transport").notNull(),

    /** One of ORIGINATION_INVOCATION_STATES. Mutable exactly once, by the origination seam. */
    state: text("state").notNull(),

    /**
     * The released `ModelConnectivityError` code, when one ended the call. A CLOSED code and never
     * a provider message: raw error bodies are not stored, so nothing a provider wrote can leak
     * here. Null means no connectivity failure ended this invocation.
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
