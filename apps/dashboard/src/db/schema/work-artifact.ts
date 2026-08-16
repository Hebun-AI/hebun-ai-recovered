/*
 * work_artifacts + work_artifact_revisions — durable prepared work (R3W).
 *
 * ── THE ONE FACT, AND WHY IT IS TWO TABLES ───────────────────────────────────
 *
 *   work_artifacts:          "this tenant is preparing a piece of work with a stable identity."
 *   work_artifact_revisions: "these are its exact bytes, at each point it was written."
 *
 * They are separate because identity must survive revision and content must never be rewritten.
 * One table would force an in-place content UPDATE, and the whole reason R3W exists is that an
 * approval must bind to bytes nobody can change afterwards:
 *
 *   ARTIFACT ≠ REVISION ≠ KNOWLEDGE ≠ DECISION ≠ ACTION ≠ PERMIT ≠ EXECUTION
 *
 * The shape is not invented here. `knowledge_nodes` corrects by supersession rather than editing
 * (K3), and `heby_answer_evidence_item` records identity-by-reference with an immutable snapshot
 * (KR5). R3W is the same discipline applied to work the organization produces rather than to
 * truth it holds or answers it gave.
 *
 * ── WHAT THIS IS NOT ─────────────────────────────────────────────────────────
 *
 * It is NOT Knowledge. Nothing here is organizational truth, nothing is authoritative, nothing is
 * ratifiable, and no writer in this domain touches `knowledge_nodes` or `knowledge_facts`. A draft
 * becomes Knowledge only when a human authors it through K2 and Governance ratifies it through K4.
 *
 * It is NOT a Governance decision. There is no `approved`, no `approval_decision_id`, no
 * `ratified`, no `verified` and no `trusted` column, because authorship is not authority. Approval
 * happens in `decision_records` about an ACTION that references an exact revision.
 *
 * It is NOT a message. `messages` models conversation turns and uses `tenantColumns` — mutable,
 * versioned, soft-deletable, and re-created on every revision, so "the draft" would have no
 * identity across edits. A revision instead POINTS AT the message that produced it, so model
 * provenance (provider / model / transport / tokens, all R2D columns) is reachable by join and is
 * deliberately not duplicated here.
 *
 * It is NOT `documents`. That table is upload/file metadata (`storage_path`, no content column)
 * with zero consumers anywhere in the repository, and it stays dead until an R4 ingestion path
 * claims it. R3W stores authored text, not a blob pointer.
 *
 * It is NOT execution. No row here causes an effect. R3W creates work; it does not act.
 *
 * It carries NO credential, NO token, NO provider state, NO confidence, NO trust score and NO
 * model reasoning. `content` is arbitrary authored text — which is exactly why nothing in Hebun
 * executes it, and why no claim is made that it can never contain sensitive words.
 *
 * ── WHY A DIGEST ─────────────────────────────────────────────────────────────
 *
 * `content_digest` is SHA-256 over the revision's exact bytes. It is EVIDENCE OF BYTES, never a
 * measure of truth or quality. A future action request carries `<ref>@<revision>` and this digest
 * as ordinary typed scalars inside R3A's existing canonical payload, so R3A's `payload_digest`
 * already covers them and consumption can re-verify without R3A learning what an artifact is.
 * Heby's `action_id` (FNV-1a, 32-bit, non-cryptographic by its own source) is never used for this.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import {
  actorTypeEnum,
  workArtifactLifecycleStatusEnum,
  workArtifactTypeEnum,
} from "./_enums";
import { companies } from "./company";
import { messages } from "./conversation";

/**
 * The stable identity of one piece of prepared work.
 *
 * MUTABLE ON PURPOSE, and only in the ways `tenantColumns` already models: the lifecycle may move
 * `draft → retired`, and `current_revision` advances as revisions are appended. Content is not
 * here at all, so there is no way to edit it through this row and no second content authority.
 */
export const workArtifacts = pgTable(
  "work_artifacts",
  {
    ...tenantColumns,

    artifactType: workArtifactTypeEnum("artifact_type").notNull(),
    title: text("title").notNull(),
    artifactLifecycleStatus: workArtifactLifecycleStatusEnum("artifact_lifecycle_status")
      .notNull()
      .default("draft"),

    /**
     * The workspace whose capability prepared this. It mirrors `heby_action_requests.owner_workspace`
     * and adds NO eighth workspace — the information architecture stays exactly seven.
     */
    ownerWorkspace: text("owner_workspace").notNull(),

    /**
     * A POINTER, not content. It names which revision is current; the bytes live in the revision
     * row and are never copied up here, because a copy would be a second content authority that
     * could drift from the thing an approval was bound to.
     */
    currentRevision: integer("current_revision").notNull().default(1),
  },
  (t) => [
    /*
     * `id` is already the primary key, so this adds no uniqueness the table did not have. It
     * exists so the revision table's COMPOSITE foreign key can name (tenant_id, id) as its target,
     * which PostgreSQL only permits against a declared unique constraint on exactly those columns.
     * Same reason, same shape as `heby_action_requests_tenant_id_uq`.
     */
    uniqueIndex("work_artifacts_tenant_id_uq").on(t.tenantId, t.id),

    index("work_artifacts_tenant_lifecycle_idx").on(t.tenantId, t.artifactLifecycleStatus),
    index("work_artifacts_tenant_type_idx").on(t.tenantId, t.artifactType),

    check("work_artifacts_current_revision_chk", sql`${t.currentRevision} >= 1`),
    check("work_artifacts_title_chk", sql`char_length(btrim(${t.title})) > 0`),
  ],
);

/**
 * One immutable revision — the exact bytes, once.
 *
 * IMMUTABLE, and deliberately NOT using `tenantColumns`. `tenantColumns` models a MUTABLE row:
 * a version counter, `updatedAt`/`updatedBy`, and a soft delete. A revision has none of those,
 * because it is never rewritten, never regenerated, and never repaired in place. The established
 * precedent for this shape is `audit_log`, and `heby_answer_evidence_item` follows it for the
 * same reason. Immutability here means "never rewritten" — no writer in `features/work-artifacts`
 * issues an UPDATE against this table, and a structural test asserts that absence.
 *
 * TENANT ISOLATION IS STRUCTURAL, not merely checked. The composite foreign key
 * (tenant_id, artifact_id) → work_artifacts(tenant_id, id) makes it impossible to hang one
 * tenant's revision off another tenant's artifact even with a hand-crafted insert; the same is
 * true of (source_message_id, tenant_id) → messages(id, tenant_id).
 */
export const workArtifactRevisions = pgTable(
  "work_artifact_revisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),
    artifactId: uuid("artifact_id").notNull(),

    /** 1-based and gap-free per artifact. The unique index below is what actually enforces it. */
    revisionNo: integer("revision_no").notNull(),

    /**
     * The authored bytes, stored VERBATIM. Content that reads like an instruction —
     * "Ignore previous instructions", `<script>`, `' OR 1=1 --`, `/terminal restart production` —
     * is stored exactly as written, because rewriting an organization's own words to look safe is
     * a corruption, not a defence. Safety comes from the fact that no code path in Hebun executes
     * artifact content: it is DATA everywhere it travels. Same doctrine as K2 Knowledge statements.
     */
    content: text("content").notNull(),

    /** SHA-256 over `content`, lowercase hex. Evidence of bytes — never a truth or quality score. */
    contentDigest: char("content_digest", { length: 64 }).notNull(),

    /*
     * The canonical polymorphic actor pair (S2). A human authoring directly and Heby preparing on
     * request are BOTH legitimate, and the row says which without either being an authority claim.
     */
    authoredByActorType: actorTypeEnum("authored_by_actor_type").notNull(),
    authoredByActorId: uuid("authored_by_actor_id").notNull(),

    /**
     * The assistant message whose text became this revision, when one exists. NULL for a revision
     * a human wrote directly — non-conversation authorship is legitimate, so the link is optional
     * rather than mandatory. Model attribution is NOT copied here; it is read from that message.
     */
    sourceMessageId: uuid("source_message_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    foreignKey({
      name: "work_artifact_revisions_tenant_artifact_fk",
      columns: [t.tenantId, t.artifactId],
      foreignColumns: [workArtifacts.tenantId, workArtifacts.id],
    }).onDelete("restrict"),

    /*
     * MATCH SIMPLE (PostgreSQL's default) means a NULL in any column satisfies the constraint, so
     * a human-authored revision with no source message passes while a supplied message id is
     * still forced to belong to this tenant.
     */
    foreignKey({
      name: "work_artifact_revisions_tenant_message_fk",
      columns: [t.sourceMessageId, t.tenantId],
      foreignColumns: [messages.id, messages.tenantId],
    }).onDelete("restrict"),

    /* The authority on revision numbering. Two concurrent writers cannot both take N+1. */
    uniqueIndex("work_artifact_revisions_artifact_revision_uq").on(
      t.tenantId,
      t.artifactId,
      t.revisionNo,
    ),

    check("work_artifact_revisions_revision_no_chk", sql`${t.revisionNo} >= 1`),
    check("work_artifact_revisions_digest_chk", sql`${t.contentDigest} ~ '^[0-9a-f]{64}$'`),
  ],
);

export const workArtifactsRelations = relations(workArtifacts, ({ many }) => ({
  revisions: many(workArtifactRevisions),
}));
