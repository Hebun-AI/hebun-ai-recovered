/*
 * action_execution_attempts — what the machine tried, under which spent authorization, and what
 * the outside world said back (R3B).
 *
 * ── THE ONE FACT ─────────────────────────────────────────────────────────────
 *
 *   "this tenant spent one authorization on one external act, and here is the strongest thing
 *    Hebun can honestly say about what happened."
 *
 * ── WHY NOT THE EXISTING `executions` TABLE ──────────────────────────────────
 *
 * Gate A audited it and the verdict was LEAVE DEAD. Its columns belong to a different design that
 * was never built: `workflow_id`, `task_id`, `plan_id`, `goal_id`, `mission_id`, `effect_ledger_id`,
 * `provider_resolution`, `simulation_mode`, `supersedes_execution_id`. Every one of those foreign
 * keys points at a table with zero rows and zero writers. It has no importer anywhere in `src`, and
 * it is already named as a FORBIDDEN import in the R3A.1 and R3R firewall tests — reviving it would
 * breach a firewall two shipped releases installed. A table is not a foundation just because it has
 * a plausible name.
 *
 * ── WHAT THIS OWNS, AND WHAT IT MUST NEVER OWN ───────────────────────────────
 *
 *   OWNS     what was attempted, under which consumed permit, what the provider reported, and
 *            which outcome Hebun can prove.
 *   REFUSES  legitimacy (that is `decision_records`), authorization state (`action_permits`), and
 *            the authority-bearing event trail (`audit_log`). This table decides nothing. It is a
 *            record of consequence, never a source of permission — no writer here can widen what a
 *            permit allows, and nothing reads it to determine whether an act may proceed.
 *
 * ── THE ROW IS BOTH ATTEMPT AND RECEIPT ──────────────────────────────────────
 *
 * Gate A expected a possible attempt/receipt split and concluded one row. An attempt has at most
 * one provider answer, so the relationship is 1:1 and a second table would be a revision table with
 * no revisions — the same reasoning that gave R3R one immutable table instead of R3W's two.
 *
 * ── WHY `handoff_id` IS THE IDEMPOTENCY KEY, AND WHY NOTHING NEW WAS MINTED ──
 *
 * `action_permits.handoff_id` is already minted exactly once, inside the single statement that
 * spends the permit, and already carries `action_permits_handoff_uq`. It is server-generated,
 * client-unforgeable, and cannot exist for an unspent permit (`action_permits_consumed_chk`).
 * Generating a second execution token would create a second answer to "which act is this", and the
 * two could disagree. `UNIQUE (handoff_id)` here turns "one spend yields one attempt" into a fact
 * the database enforces rather than a sequence application code has to get right.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 * NO raw recipient address. The attempt carries `recipient_id` and `recipient_endpoint_digest`; the
 * address itself is resolved from `external_recipients` moments before the adapter call and is
 * never written here. A second stored copy of third-party personal data would be a second place to
 * leak it and a second place for it to go stale.
 *
 * NO credential, NO provider secret, NO raw provider response body, NO request/response headers.
 * NO model reasoning, NO confidence, NO trust, NO certainty score.
 * NO business-success column — whether the recipient acted is not a fact any provider reports.
 * NO retry counter, because generation one performs zero automatic retries (a second real send
 * requires a new human decision, a new permit and a new attempt).
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import { char, check, foreignKey, index, pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import {
  actionExecutionAttemptStatusEnum,
  actionExecutionFailureClassEnum,
  actionExecutionProviderResponseClassEnum,
} from "./_enums";
import { actionPermits, hebyActionRequests } from "./action-authorization";
import { companies } from "./company";
import { externalRecipients } from "./external-recipient";

export const actionExecutionAttempts = pgTable(
  "action_execution_attempts",
  {
    ...tenantColumns,

    /** The spent authorization. Composite-FK'd to the permit's tenant, never trusted from input. */
    permitId: uuid("permit_id").notNull(),

    /**
     * THE IDEMPOTENCY KEY. Copied from the permit at the instant of the spend, inside the same
     * transaction. It is also the value handed to the provider as its idempotency key, so one
     * approval maps to exactly one provider-visible operation.
     */
    handoffId: uuid("handoff_id").notNull(),

    /** Denormalized so the ledger reads without a three-table join. Composite-FK'd all the same. */
    actionRequestId: uuid("action_request_id").notNull(),

    /** The registry action kind. Exactly one value is executable in this generation. */
    actionKind: text("action_kind").notNull(),

    /** Which adapter implementation was selected. A frozen code-registry id, never a table row. */
    adapterId: text("adapter_id").notNull(),

    /**
     * The three digests the approval froze, copied at spend time.
     *
     * They are stored rather than re-derived so the ledger can answer "what did this attempt
     * believe it was sending" without depending on rows that may since have been retired.
     */
    boundPayloadDigest: char("bound_payload_digest", { length: 64 }).notNull(),
    recipientEndpointDigest: char("recipient_endpoint_digest", { length: 64 }).notNull(),
    draftRevisionDigest: char("draft_revision_digest", { length: 64 }).notNull(),

    /** A REFERENCE to the recipient. Never the address itself. See the header. */
    recipientId: uuid("recipient_id").notNull(),

    status: actionExecutionAttemptStatusEnum("status").notNull().default("pending"),

    /** NULL means the adapter was never invoked — tied to `refused` by a CHECK. */
    providerResponseClass: actionExecutionProviderResponseClassEnum("provider_response_class"),

    /** Bounded receipt metadata: the provider's own id for the operation, and nothing else. */
    providerMessageId: text("provider_message_id"),

    failureClass: actionExecutionFailureClassEnum("failure_class"),

    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    /** NULL exactly while the attempt is `pending`. A CHECK enforces the equivalence. */
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [
    /**
     * ONE SPEND → ONE ATTEMPT, enforced by the database rather than by a check-then-insert. A
     * second attempt for the same handoff is not "handled"; it is impossible.
     */
    uniqueIndex("action_execution_attempts_handoff_uq").on(t.handoffId),

    /** One permit is spent once, so it yields at most one attempt. Belt to the handoff's braces. */
    uniqueIndex("action_execution_attempts_permit_uq").on(t.permitId),

    /** The composite-FK anchor every sibling in this chain carries. */
    uniqueIndex("action_execution_attempts_tenant_id_uq").on(t.tenantId, t.id),

    index("action_execution_attempts_tenant_status_idx").on(t.tenantId, t.status),
    index("action_execution_attempts_tenant_started_idx").on(t.tenantId, t.startedAt),

    /*
     * STRUCTURAL TENANT BINDING, three ways. An attempt that named another tenant's permit,
     * request or recipient is a database error rather than a bug somebody has to notice.
     */
    foreignKey({
      name: "action_execution_attempts_tenant_permit_fk",
      columns: [t.tenantId, t.permitId],
      foreignColumns: [actionPermits.tenantId, actionPermits.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_execution_attempts_tenant_request_fk",
      columns: [t.tenantId, t.actionRequestId],
      foreignColumns: [hebyActionRequests.tenantId, hebyActionRequests.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "action_execution_attempts_tenant_recipient_fk",
      columns: [t.tenantId, t.recipientId],
      foreignColumns: [externalRecipients.tenantId, externalRecipients.id],
    }).onDelete("restrict"),

    /* Stored digest shapes, enforced by the database rather than hoped for by the writer. */
    check("action_execution_attempts_payload_digest_chk", sql`${t.boundPayloadDigest} ~ '^[0-9a-f]{64}$'`),
    check("action_execution_attempts_endpoint_digest_chk", sql`${t.recipientEndpointDigest} ~ '^[0-9a-f]{64}$'`),
    check("action_execution_attempts_revision_digest_chk", sql`${t.draftRevisionDigest} ~ '^[0-9a-f]{64}$'`),

    /** Terminal exactly when completed. A `pending` row with a completion time is incoherent. */
    check(
      "action_execution_attempts_terminal_chk",
      sql`(${t.status} = 'pending') = (${t.completedAt} is null)`,
    ),

    /**
     * THE ACCEPTANCE PROOF, in the schema.
     *
     * `accepted` is claimable if and only if a provider message id exists. A 200 with no id is not
     * acceptance — it is something Hebun cannot reconcile later, which is precisely `unknown`.
     * Putting this in a CHECK means no future writer can quietly relax it.
     */
    check(
      "action_execution_attempts_accepted_chk",
      sql`(${t.status} = 'accepted') = (${t.providerMessageId} is not null)`,
    ),
    check(
      "action_execution_attempts_message_class_chk",
      sql`${t.providerMessageId} is null or ${t.providerResponseClass} = 'accepted'`,
    ),

    /**
     * THE AMBIGUITY INVARIANT — the single most important constraint on this table.
     *
     * `unknown` exists if and only if the transport observed a post-write ambiguity. It can be
     * reached no other way, and an ambiguous observation can end no other way. A future writer
     * cannot downgrade a possible external effect to a clean `failed`, which is the mistake that
     * invites a double send.
     */
    check(
      "action_execution_attempts_unknown_chk",
      sql`(${t.status} = 'unknown') = (${t.providerResponseClass} is not distinct from 'ambiguous')`,
    ),

    /**
     * THE ADAPTER-WAS-INVOKED INVARIANT.
     *
     * A response class exists exactly for the three outcomes the adapter produced. `pending` and
     * `refused` both carry NULL — the first because no answer has arrived, the second because no
     * call was made — so this cannot be written as "refused ⟺ null": that would forbid every
     * pending row, which is the state each attempt is BORN in.
     */
    check(
      "action_execution_attempts_response_class_chk",
      sql`(${t.providerResponseClass} is not null) = (${t.status} in ('accepted', 'failed', 'unknown'))`,
    ),

    /** A reason exists exactly for the two outcomes that have one. */
    check(
      "action_execution_attempts_failure_class_chk",
      sql`(${t.failureClass} is not null) = (${t.status} in ('failed', 'refused'))`,
    ),

    check("action_execution_attempts_adapter_id_chk", sql`char_length(btrim(${t.adapterId})) > 0`),
    check("action_execution_attempts_action_kind_chk", sql`char_length(btrim(${t.actionKind})) > 0`),
  ],
);

export const actionExecutionAttemptsRelations = relations(actionExecutionAttempts, ({ one }) => ({
  tenant: one(companies, {
    fields: [actionExecutionAttempts.tenantId],
    references: [companies.id],
  }),
  permit: one(actionPermits, {
    fields: [actionExecutionAttempts.permitId],
    references: [actionPermits.id],
  }),
  request: one(hebyActionRequests, {
    fields: [actionExecutionAttempts.actionRequestId],
    references: [hebyActionRequests.id],
  }),
  recipient: one(externalRecipients, {
    fields: [actionExecutionAttempts.recipientId],
    references: [externalRecipients.id],
  }),
}));
