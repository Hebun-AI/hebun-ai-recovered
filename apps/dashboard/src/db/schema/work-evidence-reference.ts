/*
 * work_evidence_references — the ONE place Hebun records that a piece of an organization's WORK
 * declares what it CONCERNS (WEV-1).
 *
 * ── WHAT A ROW MEANS, IN ONE SENTENCE ────────────────────────────────────────
 *
 * "A human of this organization declared that this work item concerns this referent."
 *
 * That is the whole of it. The row is a DECLARED RELATIONSHIP and nothing else:
 *
 *     WORK REFERENCES X   != WORK OWNS X
 *     REFERENCE EXISTS    != REFERENT IS CURRENT != REFERENT IS AUTHORITATIVE
 *     DECLARED BY A HUMAN != INFERRED BY HEBUN
 *
 * Organizational Work stays the authority for the relationship. Knowledge stays the authority for
 * a fact's version, lifecycle, ratification and authority class; Work Artifacts stays the authority
 * for an artifact's revisions and retirement. NOTHING about a referent's standing is stored here,
 * so there is no second copy of it to drift.
 *
 * ── WHY TWO TYPED NULLABLE COLUMNS, AND NOT `kind` + `key` ───────────────────
 *
 * The first design for this table was a polymorphic `reference_kind` + `reference_key` pair. It was
 * rejected at the architecture gate for a reason worth keeping written down: NO FOREIGN KEY CAN
 * ENFORCE IT. A string pair cannot say that the thing it names exists, cannot say it belongs to
 * this tenant, and lets the kind disagree with the key — three guarantees that would then have to
 * be re-implemented in application code and re-proved in every test.
 *
 * Two typed nullable columns, each with a COMPOSITE foreign key on `(tenant_id, …)`, give the
 * database all three:
 *
 *   the referent EXISTS                 the FK says so
 *   the referent is THIS TENANT'S       the composite FK says so — cross-tenant is unrepresentable
 *   the kind matches the referent       there is no separate kind to disagree
 *
 * THE REFERENCE KIND IS DERIVED, NEVER STORED. Which column is populated IS the kind. Two places
 * that could disagree about what a row references is one place too many, and this table has one.
 *
 * ── WHY A FACT, AND NOT A NODE ───────────────────────────────────────────────
 *
 * `knowledge_facts` is the version-STABLE identity; `knowledge_nodes` is the VERSION. Referencing a
 * node would pin a reference to bytes that Knowledge supersedes on its own schedule, so a work
 * item's declaration would silently become historical the first time anybody revised what it is
 * about. `knowledge_external_references` settled this exact question first, and its header says the
 * same thing in the same words: the subject is the fact, never a node.
 *
 * The fact deliberately FOLLOWS its active node, and that float is KNOWLEDGE'S, not this table's.
 *
 * ── WHY AN ARTIFACT, AND NOT A REVISION ──────────────────────────────────────
 *
 * The same distinction, drawn the other way round. R3A.1 freezes `work-artifact/<uuid>@<n>` because
 * an approval must bind to bytes nobody can change afterwards — a send transmits those exact bytes.
 * A work item is about the DOCUMENT, not one draft of it, so it names the artifact and the current
 * revision is the artifact authority's answer. `work_artifact_revisions` also carries no tenant
 * anchor, so a tenant-safe composite FK to a revision is not available without changing another
 * authority's schema, which this phase does not do.
 *
 * ── WHAT IS DELIBERATELY NOT A COLUMN ────────────────────────────────────────
 *
 * No provider key, capability, record type or record id. `knowledge_external_references` (KR-EXT1)
 * ALREADY owns external identity, per knowledge fact, with its own provenance and its own
 * withdrawal. A GitHub repository or a Drive file reaches work THROUGH the fact that declares it.
 * Repeating that identity here would create a second provenance authority for one object and a
 * generic external-object ontology built for flexibility rather than for a job.
 *
 * No relation vocabulary ("supports", "blocks", "derives-from"). One relationship exists — CONCERNS
 * — and a vocabulary with one member is a column nobody reads.
 *
 * No rank, score, confidence or ordering. Nothing here measures anything.
 *
 * No copy of the referent's title, lifecycle, ratification or authority class. A read resolves each
 * referent through its owning authority's released seam, every time.
 *
 * ── WITHDRAWAL IS NOT DELETION ───────────────────────────────────────────────
 *
 * `withdrawn_at` means exactly one thing: "Work no longer declares this relationship as CURRENT."
 * It does not mean the referent was deleted, that it became invalid, or that the relationship never
 * existed. The row stays, the audit event stays, and a later re-declaration is a NEW row rather
 * than a resurrection — the shape `knowledge_external_references` established.
 *
 * There is no automatic withdrawal. A superseded fact or a retired artifact is the referent
 * authority's news to report; this table does not react to it, because reacting would make Work a
 * reader of a lifecycle it does not own.
 *
 * Server-side vocabulary, bounds and refusal codes live in
 * `src/features/organizational-work/work-contracts.ts`.
 */
import { sql } from "drizzle-orm";
import { check, foreignKey, index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum } from "./_enums";
import { knowledgeFacts } from "./knowledge-fact";
import { workArtifacts } from "./work-artifact";
import { workItems } from "./work-item";

export const workEvidenceReferences = pgTable(
  "work_evidence_references",
  {
    ...tenantColumns,

    /**
     * THE WORK ITEM DOING THE DECLARING. The subject, never the referent.
     *
     * NOT NULL: a declaration about no work declares nothing. Same-tenant enforcement is the
     * composite FK below, not this column.
     */
    workItemId: uuid("work_item_id").notNull(),

    /**
     * THE KNOWLEDGE FACT this work concerns, or NULL.
     *
     * Nullable because a row names exactly ONE referent and this is one of two candidates — see the
     * `one_referent` CHECK. Knowledge owns everything about the fact except that work named it.
     */
    knowledgeFactId: uuid("knowledge_fact_id"),

    /**
     * THE PREPARED DOCUMENT this work concerns, or NULL. The artifact, never a revision.
     */
    workArtifactId: uuid("work_artifact_id"),

    /* ── WHO DECLARED IT ─────────────────────────────────────────────────── */

    declaredAt: timestamp("declared_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * THE ACCOUNTABLE HUMAN, CHECK-constrained to `human`.
     *
     * This is where "Hebun did not infer this relationship" stops being a sentence and becomes a
     * database fact. A row naming an agent, a system or a service is REJECTED BY POSTGRES,
     * independently of every line of application code — the same constraint
     * `knowledge_external_references_human_declarer_chk` makes about an external declaration, for
     * the same reason. WEV-1 ships no seam through which Heby, an agent, ingestion or a provider
     * read could reach this table, and this is what makes that true rather than merely arranged.
     */
    declaredBy: uuid("declared_by").notNull(),
    declaredByType: actorTypeEnum("declared_by_type").notNull(),

    /* ── WITHDRAWAL. A statement about the DECLARATION, never about the referent. ─────────── */

    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
    withdrawnBy: uuid("withdrawn_by"),
    withdrawnByType: actorTypeEnum("withdrawn_by_type"),
  },
  (t) => [
    /**
     * A DECLARATION MAY ONLY BE MADE BY WORK OF ITS OWN TENANT — enforced by PostgreSQL.
     *
     * The composite shape `work_items_tenant_department_fk` already established, against the
     * anchor `work_items_tenant_id_uq` that WORK-1 created for exactly this purpose.
     */
    foreignKey({
      name: "work_evidence_references_tenant_work_fk",
      columns: [t.tenantId, t.workItemId],
      foreignColumns: [workItems.tenantId, workItems.id],
    }).onDelete("restrict"),

    /**
     * A DECLARATION MAY ONLY NAME A KNOWLEDGE FACT OF ITS OWN TENANT.
     *
     * Against `knowledge_facts_id_tenant_uidx`, which ALREADY EXISTS — this phase adds no index to
     * Knowledge and changes nothing about it. MATCH SIMPLE (PostgreSQL's default) means a row whose
     * `knowledge_fact_id` is NULL satisfies this without naming anything, which is what makes one
     * table able to hold both kinds without a second table or a nullable-FK workaround.
     *
     * `restrict`: a fact that work declares it concerns is not deletable out from under it.
     */
    foreignKey({
      name: "work_evidence_references_tenant_fact_fk",
      columns: [t.knowledgeFactId, t.tenantId],
      foreignColumns: [knowledgeFacts.id, knowledgeFacts.tenantId],
    }).onDelete("restrict"),

    /** The same guarantee for an artifact, against the anchor R3W already created. */
    foreignKey({
      name: "work_evidence_references_tenant_artifact_fk",
      columns: [t.tenantId, t.workArtifactId],
      foreignColumns: [workArtifacts.tenantId, workArtifacts.id],
    }).onDelete("restrict"),

    /**
     * EXACTLY ONE REFERENT. Not "at least one", and not "at most one".
     *
     * A row naming nothing is a declaration about nothing; a row naming two is two declarations
     * pretending to be one, and a withdrawal of it would withdraw both. Because the kind is DERIVED
     * from which column is populated, this CHECK is also what makes the derivation total: every row
     * has exactly one kind, and no row has none or two.
     */
    check(
      "work_evidence_references_one_referent_chk",
      sql`(case when ${t.knowledgeFactId} is null then 0 else 1 end)
          + (case when ${t.workArtifactId} is null then 0 else 1 end) = 1`,
    ),

    /**
     * A RELATIONSHIP IS DECLARED BY A HUMAN. Not by an agent, a system or a service.
     * See `declared_by_type` above — this is the constraint that sentence rests on.
     */
    check("work_evidence_references_human_declarer_chk", sql`${t.declaredByType} = 'human'`),

    /**
     * THE WITHDRAWAL TRIO MOVES TOGETHER. "Withdrawn with no withdrawer" and "a withdrawer with no
     * withdrawal" are not states this table can hold, in either direction — the both-or-neither
     * shape the revocation pairs elsewhere in this schema already use.
     */
    check(
      "work_evidence_references_withdrawal_pair_chk",
      sql`(${t.withdrawnAt} is null) = (${t.withdrawnBy} is null)
          and (${t.withdrawnAt} is null) = (${t.withdrawnByType} is null)`,
    ),

    /**
     * ONE CURRENT DECLARATION PER (WORK, REFERENT) — and history is unbounded.
     *
     * PARTIAL, on `withdrawn_at is null`, so declaring the same relationship twice while it stands
     * is refused BY THE DATABASE, while a withdrawn declaration and a later re-declaration coexist
     * as two rows. An unconditional unique index would have made re-declaration impossible without
     * editing history, which is the outcome the withdrawal model exists to avoid.
     *
     * Two indexes rather than one over both columns: a partial index over `(work, fact)` treats
     * every artifact row as `(work, NULL)`, and NULLs are distinct in a unique index, so one
     * combined index would enforce nothing for either kind.
     */
    uniqueIndex("work_evidence_references_current_fact_uidx")
      .on(t.tenantId, t.workItemId, t.knowledgeFactId)
      .where(sql`${t.withdrawnAt} is null and ${t.knowledgeFactId} is not null`),
    uniqueIndex("work_evidence_references_current_artifact_uidx")
      .on(t.tenantId, t.workItemId, t.workArtifactId)
      .where(sql`${t.withdrawnAt} is null and ${t.workArtifactId} is not null`),

    /** WORK → REFERENTS: "what is this work about?" */
    index("work_evidence_references_tenant_work_idx").on(t.tenantId, t.workItemId),
    /**
     * REFERENT → WORK: "what work concerns this?" — the inverse, served by the SAME table.
     * Building a second table to answer the question backwards would have made two authorities for
     * one relationship.
     */
    index("work_evidence_references_tenant_fact_idx").on(t.tenantId, t.knowledgeFactId),
    index("work_evidence_references_tenant_artifact_idx").on(t.tenantId, t.workArtifactId),
  ],
);
