/*
 * media-assets/media-asset-records.server.ts — the image record read model and the draft-wide
 * listing of admitted images (MEDIA-1, MEDIA-SUPPLIED, MEDIA-4A).
 *
 * WHY THIS IS ITS OWN MODULE (SUITE-RECOVERY-1, RC-A): Heby's content-media grounding (HEBY-MEDIA-1)
 * lists a draft's images. While the listing lived in `read-media-assets.server.ts`, Heby's answer
 * graph reached the object-store resolver that module needs for signed byte reads, and through it
 * the VPS storage clients' `fetch` — what the INT-5A/INT-5B1/INT-5C network firewalls forbid. The
 * record projection, its row mapping and the draft listing moved here verbatim; the byte read
 * (`readMediaAsset`), the revision listing and `selectMediaAssetRecord` stay in
 * `read-media-assets.server.ts`, which imports and re-exports what moved, so every caller is
 * unchanged. This module is a DATABASE read: it imports no store, no storage resolver and no
 * transport, and it must stay that way.
 *
 * Server-only.
 */
import { and, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid, type MediaAssetLifecycleStatus, type MediaAssetMimeType } from "./contracts";
import type { MediaStorageResolution } from "./media-object-store";
import { resolveMediaDbOrNull } from "./media-db.server";

export interface MediaReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
}

/*
 * ── MEDIA-SUPPLIED: A RECORD SAYS WHERE ITS BYTES CAME FROM ─────────────────
 *
 * Every record carries `origin`. A GENERATED record carries the invocation's provenance (agent,
 * transport, provider, model); a SUPPLIED record carries the human who supplied it and the Drive
 * file it came from — and NONE of the generation fields, so no surface can render a photograph a
 * human chose as something a model made. DERIVED assets are not records of this reader at all: they
 * are publish plumbing, not creative work, and every read below excludes them.
 *
 * `sourceArtifactId` / `sourceRevisionNo` mean the same thing for both origins — the exact draft
 * revision the image is FOR — read from the invocation for a generated asset and from the asset's
 * own composite foreign key for a supplied one.
 */
interface MediaAssetRecordBase {
  readonly assetId: string;
  /**
   * MV-2 — read from `media_kind`, never guessed from the MIME type. These records are the IMAGE
   * gallery/composer/review read model, so a video row is not a record here (see `toRecord`).
   */
  readonly mediaKind: "image";
  readonly mimeType: MediaAssetMimeType;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly admittedAt: string;
  readonly lifecycle: MediaAssetLifecycleStatus;
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
}

export interface GeneratedMediaAssetRecord extends MediaAssetRecordBase {
  readonly origin: "generated";
  readonly invocationId: string;
  /** Provenance, read by join from the invocation — never copied onto the asset. */
  readonly agentId: string;
  readonly requestedByActorId: string;
  readonly transport: string;
  readonly provider: string;
  readonly model: string;
  readonly providerJobId: string | null;
  readonly inputDigest: string;
}

export interface SuppliedMediaAssetRecord extends MediaAssetRecordBase {
  readonly origin: "supplied";
  readonly suppliedByActorId: string;
  readonly suppliedSource: "google-drive";
  /** Drive's opaque id — where the bytes came from, never a pointer anything re-reads. */
  readonly suppliedSourceFileId: string;
  readonly suppliedSourceCapability: string;
}

export type MediaAssetRecord = GeneratedMediaAssetRecord | SuppliedMediaAssetRecord;

/*
 * THE ONE PROJECTION every record read uses — so a single read, a revision listing and a draft
 * listing cannot drift into shapes that disagree about provenance.
 *
 * LEFT join to the invocation, tenant-predicated IN the join, so a supplied asset (no invocation)
 * survives and a generated asset can only ever meet its own tenant's invocation. Derived assets are
 * excluded by predicate (`derived_from_asset_id is null`), as the inner join used to exclude them.
 */
const recordColumns = {
  assetId: mediaAssets.id,
  assetInvocationId: mediaAssets.invocationId,
  mediaKind: mediaAssets.mediaKind,
  invocationId: mediaGenerationInvocations.id,
  mimeType: mediaAssets.mimeType,
  byteSize: mediaAssets.byteSize,
  byteDigest: mediaAssets.byteDigest,
  width: mediaAssets.width,
  height: mediaAssets.height,
  admittedAt: mediaAssets.admittedAt,
  lifecycle: mediaAssets.assetLifecycleStatus,
  storageKey: mediaAssets.storageKey,
  invSourceArtifactId: mediaGenerationInvocations.sourceArtifactId,
  invSourceRevisionNo: mediaGenerationInvocations.sourceRevisionNo,
  agentId: mediaGenerationInvocations.agentId,
  requestedByActorId: mediaGenerationInvocations.requestedByActorId,
  transport: mediaGenerationInvocations.transport,
  provider: mediaGenerationInvocations.provider,
  model: mediaGenerationInvocations.model,
  providerJobId: mediaGenerationInvocations.providerJobId,
  inputDigest: mediaGenerationInvocations.inputDigest,
  suppliedByActorId: mediaAssets.suppliedByActorId,
  suppliedSource: mediaAssets.suppliedSource,
  suppliedSourceFileId: mediaAssets.suppliedSourceFileId,
  suppliedSourceCapability: mediaAssets.suppliedSourceCapability,
  suppliedArtifactId: mediaAssets.suppliedArtifactId,
  suppliedRevisionNo: mediaAssets.suppliedRevisionNo,
};

type RecordRow = {
  readonly assetId: string;
  readonly assetInvocationId: string | null;
  readonly mediaKind: string;
  readonly invocationId: string | null;
  readonly mimeType: string;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly admittedAt: Date | string;
  readonly lifecycle: string;
  readonly storageKey: string;
  readonly invSourceArtifactId: string | null;
  readonly invSourceRevisionNo: number | null;
  readonly agentId: string | null;
  readonly requestedByActorId: string | null;
  readonly transport: string | null;
  readonly provider: string | null;
  readonly model: string | null;
  readonly providerJobId: string | null;
  readonly inputDigest: string | null;
  readonly suppliedByActorId: string | null;
  readonly suppliedSource: string | null;
  readonly suppliedSourceFileId: string | null;
  readonly suppliedSourceCapability: string | null;
  readonly suppliedArtifactId: string | null;
  readonly suppliedRevisionNo: number | null;
};

/** The draft revision an asset is FOR, whichever origin recorded it — the draft listing's sort key. */
const sourceRevisionExpr = sql<number>`coalesce(${mediaGenerationInvocations.sourceRevisionNo}, ${mediaAssets.suppliedRevisionNo})`;

export function selectRecordRows(db: Pick<ControlPlaneDatabase, "select">) {
  return db
    .select(recordColumns)
    .from(mediaAssets)
    .leftJoin(
      mediaGenerationInvocations,
      and(
        eq(mediaGenerationInvocations.id, mediaAssets.invocationId),
        eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId),
      ),
    );
}

/**
 * Row → record, or null when the row is not a coherent generated or supplied asset. The database
 * CHECK already makes the origins exclusive; this refuses to invent a record if it ever were not.
 */
export function toRecord(row: RecordRow): (MediaAssetRecord & { readonly storageKey: string }) | null {
  /*
   * MV-2 — a video row is representable in the schema but not in this IMAGE read model. It is left
   * out rather than rendered as an image; video playback/listing belongs to a later phase.
   */
  if (row.mediaKind !== "image") return null;
  const base = {
    assetId: row.assetId,
    mediaKind: "image" as const,
    mimeType: row.mimeType as MediaAssetMimeType,
    byteSize: row.byteSize,
    byteDigest: row.byteDigest,
    width: row.width,
    height: row.height,
    admittedAt: new Date(row.admittedAt).toISOString(),
    lifecycle: row.lifecycle as MediaAssetLifecycleStatus,
    storageKey: row.storageKey,
  };
  if (row.assetInvocationId !== null) {
    if (
      row.invocationId === null ||
      row.invSourceArtifactId === null ||
      row.invSourceRevisionNo === null ||
      row.agentId === null ||
      row.requestedByActorId === null ||
      row.transport === null ||
      row.provider === null ||
      row.model === null ||
      row.inputDigest === null
    ) {
      return null;
    }
    return {
      ...base,
      origin: "generated",
      invocationId: row.invocationId,
      sourceArtifactId: row.invSourceArtifactId,
      sourceRevisionNo: row.invSourceRevisionNo,
      agentId: row.agentId,
      requestedByActorId: row.requestedByActorId,
      transport: row.transport,
      provider: row.provider,
      model: row.model,
      providerJobId: row.providerJobId,
      inputDigest: row.inputDigest,
    };
  }
  if (
    row.suppliedSource !== "google-drive" ||
    row.suppliedByActorId === null ||
    row.suppliedSourceFileId === null ||
    row.suppliedSourceCapability === null ||
    row.suppliedArtifactId === null ||
    row.suppliedRevisionNo === null
  ) {
    return null;
  }
  return {
    ...base,
    origin: "supplied",
    sourceArtifactId: row.suppliedArtifactId,
    sourceRevisionNo: row.suppliedRevisionNo,
    suppliedByActorId: row.suppliedByActorId,
    suppliedSource: "google-drive",
    suppliedSourceFileId: row.suppliedSourceFileId,
    suppliedSourceCapability: row.suppliedSourceCapability,
  };
}

export function withoutStorageKey(record: MediaAssetRecord & { readonly storageKey: string }): MediaAssetRecord {
  const { storageKey: _storageKey, ...rest } = record;
  void _storageKey;
  return rest as MediaAssetRecord;
}

/** Listing rows → records. A row that is not a coherent record is left out, never guessed at. */
export function recordsOf(rows: readonly RecordRow[]): MediaAssetRecord[] {
  const out: MediaAssetRecord[] = [];
  for (const row of rows) {
    const record = toRecord(row);
    if (record) out.push(withoutStorageKey(record));
  }
  return out;
}

/**
 * One admitted asset of a revision, as the database records it. No access, no bytes.
 *
 * Deliberately the SAME projection as a single read, so a listed asset and an opened one are the
 * same record and cannot drift into two shapes that disagree about provenance.
 */
export type RevisionMediaAsset = MediaAssetRecord;

/*
 * ── MEDIA-4A: THE ASSETS OF A DRAFT, ACROSS ALL OF ITS REVISIONS ─────────────
 *
 * MEDIA-3 answered "what images exist for THIS revision". The moment a draft advances to revision
 * N+1 that question stops mentioning the images of revision N — they remain authoritative, they
 * remain reviewable, and they vanish from the surface. This reader answers the wider question the
 * human actually has: "what images exist for THIS DRAFT, and which revision did each come from".
 *
 * IT IS THE SAME RELATIONSHIP, READ ONE PREDICATE WIDER. The revision predicate is dropped; the
 * artifact predicate stays. `media_generation_invocations_source_idx` is
 * (tenant_id, source_artifact_id, source_revision_no), so this uses the same index by its leading
 * columns and needs no new index, no column and no table.
 *
 * WHY BATCHED ACROSS DRAFTS. The surface shows several drafts at once. Reading per draft, per
 * revision, would be a product of two N's. One `inArray` over the drafts already on the page
 * answers all of them in a single statement, and it REPLACES the per-draft query MEDIA-3 issued
 * rather than adding to it.
 *
 * IT INVENTS NO REVISION HISTORY. `sourceRevisionNo` is read from the invocation's own composite
 * foreign key into `work_artifact_revisions`, so a revision number here cannot name a revision that
 * does not exist. Which revision is CURRENT is not decided here at all — that is the Work Artifact
 * authority's `current_revision`, and this reader neither reads it nor guesses it.
 *
 * SORTED NEWEST REVISION FIRST, then oldest asset first inside a revision — the order the surface
 * presents, computed once in the database rather than re-sorted per group in React.
 *
 * Like the MEDIA-3 listing, it GRANTS NOTHING: no store, no verification, no signed URL, and the
 * storage key is not even projected.
 */

export type ArtifactMediaAssetListing =
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" }
  | { readonly status: "read"; readonly assets: readonly RevisionMediaAsset[] };

/**
 * Every admitted asset generated for any revision of the given content drafts.
 *
 * Tenant-predicated on both tables, exactly as the per-revision listing is. An empty list is a
 * fact; a read failure is never rendered as one.
 */
export async function listArtifactMediaAssets(
  tenant: TenantContext | null,
  input: { readonly artifactIds: readonly string[] } | null,
  deps: MediaReadDeps = {},
): Promise<ArtifactMediaAssetListing> {
  if (typeof window !== "undefined") {
    throw new Error("Media asset reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "persistence-unavailable" };

  const wanted = [...new Set((input?.artifactIds ?? []).filter(isUuid))];
  if (wanted.length === 0) return { status: "read", assets: [] };

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const rows = await selectRecordRows(db)
      .where(
        and(
          eq(mediaAssets.tenantId, tenant.tenantId),
          or(isNull(mediaAssets.invocationId), eq(mediaGenerationInvocations.tenantId, tenant.tenantId)),
          isNull(mediaAssets.derivedFromAssetId),
          or(
            inArray(mediaGenerationInvocations.sourceArtifactId, wanted),
            inArray(mediaAssets.suppliedArtifactId, wanted),
          ),
        ),
      )
      .orderBy(sql`${sourceRevisionExpr} desc`, mediaAssets.admittedAt, mediaAssets.id);

    return { status: "read", assets: recordsOf(rows) };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
