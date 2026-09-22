/*
 * db/schema/content-selected-media.ts — which images are IN a content draft (CONTENT-COMPOSE-1).
 *
 * ── THE ONE FACT THAT IS NOT DERIVABLE ───────────────────────────────────────
 *
 * MEDIA-1 records where an image CAME FROM: every `media_generation_invocations` row carries
 * `(source_artifact_id, source_revision_no)`, and MEDIA-4A reads that to show a revision's images.
 * That is PROVENANCE, and provenance is not usage. A revision may hold several admitted, approved
 * images while the finished post carries one of them — so "which images is this draft actually
 * made of" cannot be computed from any existing row. It has to be recorded, and this is the table
 * that records it. Nothing else here is new: the destination lives on `work_artifacts`, the copy on
 * `work_artifact_revisions`, the bytes on `media_assets`, and every review judgement on
 * `decision_records`. Readiness is DERIVED from those four at read time and is never stored.
 *
 * ── SELECTION IS SCOPED TO A REVISION, NOT TO THE ASSET ──────────────────────
 *
 * The row is `(tenant, artifact, revision, asset)`. An image generated from revision 1 may be
 * selected for revision 2 — MEDIA-4A deliberately kept older images reachable — so the revision an
 * asset was BORN from and the revision it is USED in are different questions and both are kept. A
 * column on `media_assets` could express neither, which is why this is a relation table.
 *
 * ── WHAT A SELECTION DOES NOT MEAN ───────────────────────────────────────────
 *
 * Not approved: Governance decides that, about the asset, in its own ledger.
 * Not published, not scheduled, not sent: no such authority exists in this repository, and this
 * table does not invent one. A row here is a human saying "this image belongs in this draft" and
 * is exactly that much.
 *
 * ── CUSTODY GATES SELECTION; GOVERNANCE DOES NOT ─────────────────────────────
 *
 * Any `admitted` asset of the same tenant may be selected, whether it is approved, declined or
 * never reviewed — the MEDIA-5 doctrine, unchanged: accepting may not authorize, so declining may
 * not forbid. Only RETIREMENT removes the option, because that is a custody fact. Approval is what
 * READINESS asks about, and readiness is a read, not a gate on this writer.
 *
 * Deliberately no ordering column. Nothing consumes an order today — there is no publisher — and
 * MEDIA-4B's own finding was that durable state whose only reader is the surface that writes it
 * should not be built. Selections read back oldest-first by `selected_at`.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { companies } from "./company";
import { mediaAssets } from "./media-asset";
import { workArtifactRevisions } from "./work-artifact";

export const contentSelectedMedia = pgTable(
  "content_selected_media",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id),

    /** The draft revision this image is part of. */
    artifactId: uuid("artifact_id").notNull(),
    revisionNo: integer("revision_no").notNull(),

    /** The admitted image. Its bytes, digest and lifecycle stay owned by `media_assets`. */
    mediaAssetId: uuid("media_asset_id").notNull(),

    /** The human who selected it. Selection is never machine-originated at this phase. */
    selectedByActorId: uuid("selected_by_actor_id").notNull(),
    selectedAt: timestamp("selected_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    /*
     * One image is in a revision once or not at all. Re-selecting is a no-op rather than a
     * duplicate, and deselecting is a delete — the row IS the selection, so there is no
     * lifecycle column and no tombstone to reason about.
     */
    unique("content_selected_media_revision_asset_uq").on(
      t.tenantId,
      t.artifactId,
      t.revisionNo,
      t.mediaAssetId,
    ),

    /* The read is always "what is selected for THIS revision". */
    index("content_selected_media_revision_idx").on(t.tenantId, t.artifactId, t.revisionNo),

    /*
     * Tenant-safe composite keys on BOTH sides. A selection cannot name another tenant's revision
     * or another tenant's image, and neither parent can be deleted out from under it.
     */
    foreignKey({
      name: "content_selected_media_revision_fk",
      columns: [t.tenantId, t.artifactId, t.revisionNo],
      foreignColumns: [
        workArtifactRevisions.tenantId,
        workArtifactRevisions.artifactId,
        workArtifactRevisions.revisionNo,
      ],
    }).onDelete("restrict"),

    foreignKey({
      name: "content_selected_media_asset_fk",
      columns: [t.tenantId, t.mediaAssetId],
      foreignColumns: [mediaAssets.tenantId, mediaAssets.id],
    }).onDelete("restrict"),

    check("content_selected_media_revision_no_chk", sql`${t.revisionNo} >= 1`),
  ],
);
