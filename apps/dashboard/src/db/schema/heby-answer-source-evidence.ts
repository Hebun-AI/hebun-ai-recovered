/*
 * heby_answer_source_evidence — G6D generic answer-source evidence.
 *
 * WHAT THIS IS: the record that one historical Heby answer RELIED ON a particular source record,
 * as that record stood at answer time. One row per cited record, per answer.
 *
 * WHAT THIS IS NOT: a source of truth about anything. Governance owns `decision_records`; this
 * table owns only the sentence "answer X cited record Y, and Y was authoritative when it did".
 * Nothing reads it to decide what is true — it is read only to reproduce what one answer showed.
 *
 * ── WHY IT IS NOT THE KR5 TABLES ─────────────────────────────────────────────
 *
 * `heby_answer_evidence_set`/`_item` are KR5's Knowledge retrieval record and stay exactly as they
 * are. Measured against the live database rather than assumed, they cannot carry a Governance
 * citation truthfully:
 *
 *   - `heby_answer_evidence_set_message_uidx` is UNIQUE on `message_id` — ONE set per answer, and
 *     that set means "one retrieval". A Governance read is not a second retrieval.
 *   - `heby_answer_evidence_item` has nine NOT NULL columns that only Knowledge can fill:
 *     `fact_id`, `domain_key`, `fact_key`, `scope`, `title`, `ratified`, `freshness`,
 *     `knowledge_version`, `fact_version`. Putting a decision id in `fact_id` would make the
 *     column name a lie, and nulling them would weaken Knowledge's own guarantees.
 *
 * So this is a SIBLING under the same evidence authority — the durable conversation repository —
 * and not a second one. There is exactly one writer and exactly one reader, both in that module.
 *
 * KNOWLEDGE MAY NOT APPEAR HERE, enforced by CHECK rather than by convention. Knowledge already has
 * an evidence authority; a Knowledge row in both places would be two records of one citation, and
 * the second one would eventually disagree with the first.
 *
 * IMMUTABLE, deliberately NOT using `tenantColumns`, for the reason `heby_answer_evidence_item`
 * gives: a historical record is never rewritten, regenerated or repaired in place. It is a child of
 * the assistant message and cascades with it.
 *
 * TENANT ISOLATION IS STRUCTURAL. The composite foreign key (message_id, tenant_id) →
 * messages(id, tenant_id) makes one tenant's citation unattachable to another tenant's message even
 * with a hand-crafted insert.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 * `provenance` — a property of the RESOLUTION, not of an item; storing it per row would duplicate
 *                one sentence across every citation, and no replay path consumes it today.
 * `lifecycle`  — supplied by the runtime, but every value this table can receive today is the
 *                constant "settled", and nothing in replay reads it. A class with a varying
 *                lifecycle is its own gate.
 * `content`    — `ResolvedSourceItem.content` reaches only the model grounding context, never the
 *                reader's answer. The model is not connected, and copying an authority's own
 *                statements here would start the second Governance store this table exists to
 *                avoid.
 * a set row    — "grounding ran and cited nothing" stays distinguishable from "never ran" WITHOUT
 *                one, because the unresolved branch prints the source's own unavailable reason into
 *                the answer body, and the body is stored as the assistant message.
 */
import { boolean, check, foreignKey, integer, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { companies } from "./company";
import { messages } from "./conversation";

export const hebyAnswerSourceEvidence = pgTable(
  "heby_answer_source_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    /** The assistant message this citation belongs to. Server-generated inside the same insert. */
    messageId: uuid("message_id").notNull(),

    /* ── IDENTITY (referenced, never copied) ── */
    /** The Heby source class that resolved the record. Server-derived from the resolution. */
    sourceClass: text("source_class").notNull(),
    /**
     * The owning authority's own stable reference — a `decision_records.id`, a
     * `governance_sessions.id`, a `roles.id`. DELIBERATELY NO FOREIGN KEY: a FK would let the
     * authority's lifecycle constrain answer history, and history must survive whatever the
     * authority does next. The reference is semantic, not referential.
     */
    recordRef: text("record_ref").notNull(),

    /* ── HISTORICAL SNAPSHOT (answer-time) ── */
    /** The label the reader saw. Copied because the record it describes is mutable. */
    label: text("label").notNull(),
    /** The detail line the reader saw, verbatim. Re-deriving it later would substitute today. */
    detail: text("detail").notNull(),
    /**
     * The STANDING the answer asserted: was this an authoritative organizational record, or a
     * derived read model? Server-derived from the owning resolution; no request shape carries it.
     * Snapshotting it is what stops a reload flattening AUTHORITATIVE into DERIVED.
     */
    authoritative: boolean("authoritative").notNull(),

    /* ── ORDER ── */
    ordinal: integer("ordinal").notNull(),

    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * One answer cites a given record once, per class. This is also the idempotency key: a retried
     * insert inside the transaction cannot duplicate a row, with no check-then-insert race. Its
     * leading column is `message_id`, so it also serves the only read that exists — load one
     * message's citations — and no separate lookup index is added for a table read three rows at a
     * time.
     */
    uniqueIndex("heby_answer_source_evidence_message_record_uidx").on(
      t.messageId,
      t.sourceClass,
      t.recordRef,
    ),
    foreignKey({
      name: "heby_answer_source_evidence_tenant_message_fk",
      columns: [t.messageId, t.tenantId],
      foreignColumns: [messages.id, messages.tenantId],
    }).onDelete("cascade"),
    /* Knowledge has its own evidence authority (KR5). Two records of one citation is one too many. */
    check("heby_answer_source_evidence_not_knowledge_chk", sql`${t.sourceClass} <> 'knowledge'`),
  ],
);
