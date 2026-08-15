/*
 * heby_answer_evidence_set / heby_answer_evidence_item — KR5 historical answer evidence.
 *
 * WHAT THIS IS: the record of which organizational evidence was recorded WITH one historical
 * assistant answer, as that evidence stood at answer time.
 *
 * WHAT THIS IS NOT, and the distinction is the whole reason these tables exist:
 *
 *   Current Knowledge answers  "what does the organization hold as Knowledge NOW?"
 *   Historical answer evidence "what evidence was recorded with THIS answer, THEN?"
 *
 * These are different questions and they are allowed to disagree. A row here is NEVER a second
 * Knowledge authority, a Knowledge record, a Governance decision, a ratification, a retrieval
 * cache, a search index, a memory, or a truth score. Nothing reads these tables to decide what is
 * true; they are read only to reproduce what one answer showed.
 *
 * IMMUTABLE, deliberately NOT using `tenantColumns`. `tenantColumns` models a MUTABLE row —
 * version counter, updatedAt/updatedBy, soft delete. A historical record has none of those: it is
 * never rewritten, never regenerated, never repaired in place. The established precedent for this
 * shape in this repository is `audit_log`, which opens its own file with the same reasoning.
 *
 * Immutability means "never rewritten". It does NOT mean "outlives its parent": these rows are
 * children of the assistant message and cascade with it. A retention policy — windows, expiry,
 * right-to-forget, tenant deletion — is deliberately NOT decided here and remains deferred.
 *
 * TENANT ISOLATION IS STRUCTURAL, not merely checked. The composite foreign key
 * (message_id, tenant_id) → messages(id, tenant_id) makes it impossible to attach one tenant's
 * evidence to another tenant's message even with a hand-crafted insert. That is why
 * `messages` carries a (id, tenant_id) unique index it would not otherwise need.
 */
import {
  boolean,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./company";
import { messages } from "./conversation";

/**
 * One retrieval, as it stood when one assistant message was produced.
 *
 * A SET ROW EXISTS WHENEVER RETRIEVAL RAN — including when it matched nothing. Without it,
 * "no evidence rows" would mean both "retrieval never ran for this answer" and "retrieval ran and
 * found nothing", which are completely different statements about the organization. Preserving
 * that distinction across a reload is the reason this is a table and not a column.
 */
export const hebyAnswerEvidenceSets = pgTable(
  "heby_answer_evidence_set",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    messageId: uuid("message_id").notNull(),

    /** The retrieval's own status — matched / no-match / empty-corpus / empty-query / unavailable. */
    status: text("status").notNull(),
    /** The candidate pool bound was hit: more eligible knowledge existed than was swept. */
    truncated: boolean("truncated").notNull().default(false),
    /** How many candidates the per-source diversity cap removed. */
    diversityPruned: integer("diversity_pruned").notNull().default(0),
    /** How many records matched but were not in force. A gap the reader should not have to guess. */
    excludedCount: integer("excluded_count").notNull().default(0),
    /** A retrieval component that could not run, stated exactly. Null when nothing was missing. */
    degradedReason: text("degraded_reason"),
    /**
     * Several distinct sources answered one question. NOT `conflict` — whether they disagree is a
     * judgement nothing here makes.
     */
    multipleRelevantSources: boolean("multiple_relevant_sources").notNull().default(false),
    /** Why the set is empty, when it is. The retrieval's own sentence, never a generic one. */
    unavailableReason: text("unavailable_reason"),

    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /* One answer, one retrieval. A second set for the same message is a defect, not a variant. */
    uniqueIndex("heby_answer_evidence_set_message_uidx").on(t.messageId),
    /*
     * The composite tenant-safe parent reference. It spans two columns on purpose: a plain
     * message_id FK would happily let tenant A's evidence hang off tenant B's message, and the
     * only thing standing between that and the database would be application code remembering to
     * check. Cascade because these rows are the message's, and outlive nothing it does not.
     */
    foreignKey({
      name: "heby_answer_evidence_set_tenant_message_fk",
      columns: [t.messageId, t.tenantId],
      foreignColumns: [messages.id, messages.tenantId],
    }).onDelete("cascade"),
  ],
);

/**
 * One piece of evidence inside one historical set.
 *
 * IDENTITY IS REFERENCED, STANDING IS SNAPSHOT. `factId` / `knowledgeNodeId` name exactly which
 * fact and which version an answer used; everything else is copied because it is mutable
 * (provenance, ratification), derived against a clock (freshness), or query-dependent
 * (matchedTerms) — re-reading any of it later would substitute today's state for the answer's.
 *
 * DELIBERATELY NO FOREIGN KEY to knowledge_facts / knowledge_nodes. A FK would let Knowledge's
 * lifecycle constrain answer history — and the historical record must survive whatever Knowledge
 * does next. The uuids are references in the semantic sense, not in the referential-integrity one.
 *
 * `excerpt` is the BOUNDED excerpt the reader actually saw (the KR4 evidence contract caps it), not
 * the Knowledge statement. That bound is what keeps this table from becoming a second Knowledge
 * content store.
 *
 * ABSENT BY CONSTRUCTION: lexical/trigram/combined score, rank, weights, sourceDigest, model
 * reasoning, and any trust/confidence/certainty figure. Hebun computes no such score anywhere, and
 * a number beside a policy reads as a claim about how true it is.
 */
export const hebyAnswerEvidenceItems = pgTable(
  "heby_answer_evidence_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    evidenceSetId: uuid("evidence_set_id")
      .notNull()
      .references(() => hebyAnswerEvidenceSets.id, { onDelete: "cascade" }),

    /* ── IDENTITY (referenced) ── */
    factId: uuid("fact_id").notNull(),
    knowledgeNodeId: uuid("knowledge_node_id"),
    domainKey: text("domain_key").notNull(),
    factKey: text("fact_key").notNull(),
    scope: text("scope").notNull(),

    /* ── HISTORICAL SNAPSHOT (answer-time) ── */
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    excerptTruncated: boolean("excerpt_truncated").notNull().default(false),
    authorityClass: text("authority_class"),
    lifecycleStatus: text("lifecycle_status"),
    ratified: boolean("ratified").notNull().default(false),
    ratifiedAt: timestamp("ratified_at", { withTimezone: true }),
    freshness: text("freshness").notNull(),
    knowledgeVersion: integer("knowledge_version").notNull(),
    factVersion: integer("fact_version").notNull(),
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    nextReviewAt: timestamp("next_review_at", { withTimezone: true }),
    origin: text("origin"),
    authoredThrough: text("authored_through"),
    /** Tri-state on purpose: null means "not told either way", never "origin WAS verified". */
    textOriginUnverified: boolean("text_origin_unverified"),
    sourceTitle: text("source_title"),
    sourceType: text("source_type"),
    ingestedByActorType: text("ingested_by_actor_type"),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }),
    chunkIndex: integer("chunk_index"),
    chunkCount: integer("chunk_count"),
    /** The query terms that literally occurred in this record, as the RECORD spells them. */
    matchedTerms: text("matched_terms").array().notNull().default([]),

    /* ── ORDER ── */
    ordinal: integer("ordinal").notNull(),
  },
  (t) => [
    /*
     * One answer cites a given fact once. This is also the idempotency key: a retried write inside
     * the transaction cannot produce a duplicate row, without any check-then-insert race.
     */
    uniqueIndex("heby_answer_evidence_item_set_record_uidx").on(
      t.evidenceSetId,
      t.domainKey,
      t.factKey,
    ),
    /* The only read path that exists: load one set's items in display order. */
    index("heby_answer_evidence_item_set_ordinal_idx").on(t.evidenceSetId, t.ordinal),
  ],
);
