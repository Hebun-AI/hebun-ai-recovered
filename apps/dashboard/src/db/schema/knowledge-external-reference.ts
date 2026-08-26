/*
 * knowledge_external_references — KR-EXT1. WHICH EXTERNAL SYSTEM A KNOWLEDGE FACT IS ABOUT.
 *
 * ── WHAT ONE ROW MEANS, EXACTLY ──────────────────────────────────────────────
 *
 *   "This organization declares that this Knowledge fact concerns this external-system record."
 *
 * That is the whole sentence. It is a DECLARATION a human made, and it is organizational metadata
 * owned by Knowledge.
 *
 * ── WHAT IT DOES NOT MEAN ────────────────────────────────────────────────────
 *
 * Not a copy of the provider record. Not provider health, freshness, verification or availability.
 * Not synchronization, not a cache. Not Knowledge ingestion — nothing here becomes a fact's
 * content. Not Governance approval of the provider record. Not provider authority, and not any part
 * of the provider's lifecycle. Hebun does not own the referenced thing and never claims to.
 *
 * A reference may name a repository that is unreachable, renamed, transferred, or gone. Nothing is
 * checked at write time (that is the Director's explicit decision), so the honest reading of a row
 * is "somebody recorded this association", never "this record exists right now".
 *
 * ── WHY A SIBLING TABLE, AND NOT A COLUMN ON knowledge_nodes ─────────────────
 *
 * K3 holds that `knowledge_nodes` is immutable: only ratification and retraction may update one,
 * each with its columns pinned, and a correction inserts a NEW version. Writing a mutable
 * attach/detach annotation onto a node would need a third exception for exactly the kind of field
 * K3 exists to keep out — and attaching by supersession is worse still, because every new node is
 * written `provisional` and supersession cannot ratify, so annotating a ratified fact would cost the
 * organization its Governance standing.
 *
 * `knowledge_nodes.references` / `.refId` were rejected for the same reason and one more:
 * `ref_id` is load-bearing BY BEING EMPTY. K3 pins that canonical nodes carry none, which is one of
 * two guards keeping a legacy in-place `update knowledge_nodes ... set statement = ...` adapter from
 * ever addressing a canonical node. Populating it would arm that path.
 *
 * ── WHY THE FACT, NOT THE NODE ───────────────────────────────────────────────
 *
 * A reference is a statement about the ORGANIZATIONAL FACT, not about one version of its wording.
 * Keyed to `knowledge_facts` it survives supersession without being copied forward, survives
 * retraction as historical metadata, and leaves `knowledge_nodes` byte-untouched.
 *
 * ── TENANT ISOLATION IS STRUCTURAL ───────────────────────────────────────────
 *
 * The composite foreign key `(knowledge_fact_id, tenant_id) → knowledge_facts(id, tenant_id)` makes
 * one tenant's reference unattachable to another tenant's fact even with a hand-crafted insert.
 * This is the G6D arrangement, unchanged.
 *
 * ── WITHDRAWAL IS A TRANSITION, NOT A DELETE ─────────────────────────────────
 *
 * Removing a reference means "the organization no longer declares this association" — it is a thing
 * somebody did, on a date, and this repository does not tidy such records away. So a row is
 * withdrawn rather than deleted, and the uniqueness index is PARTIAL so the same association can be
 * declared again later without destroying the record that it once ended.
 */
import { check, foreignKey, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { actorTypeEnum } from "./_enums";
import { companies } from "./company";
import { knowledgeFacts } from "./knowledge-fact";

export const knowledgeExternalReferences = pgTable(
  "knowledge_external_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    /** The Knowledge FACT this declaration is about. Never a node — see the header. */
    knowledgeFactId: uuid("knowledge_fact_id").notNull(),

    /* ── THE EXTERNAL IDENTITY, STRUCTURED ──────────────────────────────────
     *
     * Four fields, not one rendered string, because an exact join needs to filter on the record id.
     * Every value is already owned elsewhere: `provider_key` is the provider catalog's key,
     * `capability` is the provider module's capability key, and `record_id` is the PROVIDER'S own
     * immutable identifier. KR-EXT1 mints no identifier scheme, and the rendered form
     * `integrations/<provider>/<capability>/<type>/<id>` is DERIVED from these on read.
     */
    providerKey: text("provider_key").notNull(),
    capability: text("capability").notNull(),
    recordType: text("record_type").notNull(),
    /**
     * The provider's own stable id, as text.
     *
     * TEXT because provider identifiers are not all integers — GitHub's repository id is numeric,
     * a Drive file id is an opaque string — and a column typed for one provider would have to be
     * widened for the next. The CHECK below bounds it; a display name is NEVER stored here, because
     * a name follows a rename and an identity must not.
     */
    recordId: text("record_id").notNull(),

    /* ── WHO DECLARED IT ────────────────────────────────────────────────── */
    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
    declaredBy: uuid("declared_by").notNull(),
    declaredByType: actorTypeEnum("declared_by_type").notNull(),

    /* ── WHO WITHDREW IT, IF ANYBODY ────────────────────────────────────── */
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnBy: uuid("withdrawn_by"),
    withdrawnByType: actorTypeEnum("withdrawn_by_type"),
  },
  (t) => [
    /*
     * ONE LIVE DECLARATION PER (fact, external record). PARTIAL, so withdrawing does not consume the
     * association forever: the same fact may be re-associated with the same record later, and the
     * row that recorded the earlier declaration and its end survives. This is also the idempotency
     * key — a retried attach cannot duplicate a row, with no check-then-insert race.
     */
    uniqueIndex("knowledge_external_references_live_uidx")
      .on(t.tenantId, t.knowledgeFactId, t.providerKey, t.capability, t.recordType, t.recordId)
      .where(sql`${t.withdrawnAt} is null`),
    /*
     * THE JOIN INDEX. The whole point of this table is answering "which Knowledge fact concerns
     * external record X?" without a model, so the lookup direction gets its own index.
     */
    uniqueIndex("knowledge_external_references_record_fact_uidx")
      .on(t.tenantId, t.providerKey, t.capability, t.recordType, t.recordId, t.knowledgeFactId)
      .where(sql`${t.withdrawnAt} is null`),
    foreignKey({
      name: "knowledge_external_references_tenant_fact_fk",
      columns: [t.knowledgeFactId, t.tenantId],
      foreignColumns: [knowledgeFacts.id, knowledgeFacts.tenantId],
    }).onDelete("restrict"),
    /*
     * A HUMAN DECLARED IT. Enforced by the database, not by a code path, because "the model may
     * never author this relationship" is the property the whole phase rests on. `action_permits`
     * states its authorizer the same way.
     */
    check("knowledge_external_references_human_declarer_chk", sql`${t.declaredByType} = 'human'`),
    /* And a withdrawal is a human act too, whenever there is one. */
    check(
      "knowledge_external_references_human_withdrawer_chk",
      sql`${t.withdrawnByType} is null or ${t.withdrawnByType} = 'human'`,
    ),
    /*
     * BOTH-OR-NEITHER, on both halves of the withdrawal. A timestamp without an actor is an act
     * nobody performed; an actor without a timestamp is an act that never happened. The repository
     * enforces this shape on every revocation pair it has.
     */
    check(
      "knowledge_external_references_withdrawal_pair_chk",
      sql`(${t.withdrawnAt} is null) = (${t.withdrawnBy} is null)
          and (${t.withdrawnBy} is null) = (${t.withdrawnByType} is null)`,
    ),
    /*
     * BOUNDED IDENTIFIERS. An unbounded or whitespace-bearing identifier is not a provider id — it
     * is either a mistake or somebody pasting a payload into an identity column. Refused by the
     * database so no writer can be the only thing standing between the two.
     */
    check(
      "knowledge_external_references_bounded_identity_chk",
      sql`length(${t.providerKey}) between 1 and 64
          and length(${t.capability}) between 1 and 128
          and length(${t.recordType}) between 1 and 64
          and length(${t.recordId}) between 1 and 128
          and ${t.providerKey} !~ '\\s'
          and ${t.capability} !~ '\\s'
          and ${t.recordType} !~ '\\s'
          and ${t.recordId} !~ '\\s'`,
    ),
  ],
);
