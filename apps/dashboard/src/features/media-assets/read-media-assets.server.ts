/*
 * media-assets/read-media-assets.server.ts — tenant-controlled reads of admitted images (MEDIA-1).
 *
 * THE ORDER, AND WHY IT IS THIS ORDER:
 *
 *   1. authenticated tenant               otherwise `unauthenticated`
 *   2. storage connected                  otherwise `unavailable` — BEFORE the row is looked up, so an
 *                                         unconnected deployment answers the same thing for every id
 *                                         and can never say "not found" or return an empty success
 *   3. database reachable                 otherwise `unavailable`
 *   4. the row, predicated on tenant      otherwise `not-found` — another tenant's asset and an asset
 *                                         that never existed are one indistinguishable answer
 *   5. the stored object verified         size AND SHA-256 as stored must equal the row; otherwise
 *                                         `unavailable` with `integrity-mismatch` / `object-absent`.
 *                                         A read is never granted on bytes that are not the admitted ones.
 *   6. a short-lived read grant           created per call, never persisted, never logged
 *
 * A retired asset remains readable — retirement keeps the bytes and the history — and says so.
 *
 * Server-only.
 */
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid, type MediaAssetLifecycleStatus, type MediaAssetMimeType } from "./contracts";
import {
  MEDIA_READ_ACCESS_TTL_SECONDS,
  type MediaReadAccess,
  type MediaStorageResolution,
} from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { resolveMediaDbOrNull } from "./media-db.server";

export interface MediaReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
}

export interface MediaAssetRecord {
  readonly assetId: string;
  readonly invocationId: string;
  readonly mimeType: MediaAssetMimeType;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly width: number;
  readonly height: number;
  readonly admittedAt: string;
  readonly lifecycle: MediaAssetLifecycleStatus;
  /** Provenance, read by join from the invocation — never copied onto the asset. */
  readonly sourceArtifactId: string;
  readonly sourceRevisionNo: number;
  readonly agentId: string;
  readonly requestedByActorId: string;
  readonly transport: string;
  readonly provider: string;
  readonly model: string;
  readonly providerJobId: string | null;
  readonly inputDigest: string;
}

export type ReadMediaAssetResult =
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "unavailable";
      readonly reason: "storage-unavailable" | "persistence-unavailable" | "object-absent" | "integrity-mismatch";
    }
  | { readonly status: "not-found" }
  | { readonly status: "read"; readonly asset: MediaAssetRecord; readonly access: MediaReadAccess };

/**
 * The row plus its provenance, tenant-predicated on BOTH tables. Internal to this authority.
 *
 * PUBLISH-0: the INNER join through the invocation is also what keeps a DERIVED asset (no
 * invocation) out of every generated-asset read — gallery, composer, preview. `invocationId` is
 * projected from the joined invocation, which the join makes non-null and equal to the asset's.
 */
export async function selectMediaAssetRecord(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  assetId: string,
): Promise<(MediaAssetRecord & { readonly storageKey: string }) | null> {
  const rows = await db
    .select({
      assetId: mediaAssets.id,
      invocationId: mediaGenerationInvocations.id,
      mimeType: mediaAssets.mimeType,
      byteSize: mediaAssets.byteSize,
      byteDigest: mediaAssets.byteDigest,
      width: mediaAssets.width,
      height: mediaAssets.height,
      admittedAt: mediaAssets.admittedAt,
      lifecycle: mediaAssets.assetLifecycleStatus,
      storageKey: mediaAssets.storageKey,
      sourceArtifactId: mediaGenerationInvocations.sourceArtifactId,
      sourceRevisionNo: mediaGenerationInvocations.sourceRevisionNo,
      agentId: mediaGenerationInvocations.agentId,
      requestedByActorId: mediaGenerationInvocations.requestedByActorId,
      transport: mediaGenerationInvocations.transport,
      provider: mediaGenerationInvocations.provider,
      model: mediaGenerationInvocations.model,
      providerJobId: mediaGenerationInvocations.providerJobId,
      inputDigest: mediaGenerationInvocations.inputDigest,
    })
    .from(mediaAssets)
    .innerJoin(
      mediaGenerationInvocations,
      and(
        eq(mediaGenerationInvocations.id, mediaAssets.invocationId),
        eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId),
      ),
    )
    .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, assetId)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    mimeType: row.mimeType as MediaAssetMimeType,
    lifecycle: row.lifecycle as MediaAssetLifecycleStatus,
    admittedAt: new Date(row.admittedAt).toISOString(),
  };
}

export async function readMediaAsset(
  tenant: TenantContext | null,
  assetId: string,
  deps: MediaReadDeps = {},
): Promise<ReadMediaAssetResult> {
  if (typeof window !== "undefined") {
    throw new Error("Media asset reads are server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };

  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status !== "available") return { status: "unavailable", reason: "storage-unavailable" };

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };
  if (!isUuid(assetId)) return { status: "not-found" };

  let record;
  try {
    record = await selectMediaAssetRecord(db, tenant.tenantId, assetId);
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
  if (!record) return { status: "not-found" };

  let stored;
  try {
    stored = await storage.store.verify(record.storageKey);
  } catch {
    return { status: "unavailable", reason: "object-absent" };
  }
  if (stored.status !== "present") return { status: "unavailable", reason: "object-absent" };
  if (stored.byteSize !== record.byteSize || stored.sha256Hex !== record.byteDigest) {
    return { status: "unavailable", reason: "integrity-mismatch" };
  }

  const access = await storage.store.createReadAccess({
    key: record.storageKey,
    contentType: record.mimeType,
    ttlSeconds: MEDIA_READ_ACCESS_TTL_SECONDS,
  });
  const { storageKey: _storageKey, ...asset } = record;
  void _storageKey;
  return { status: "read", asset, access };
}

/*
 * ── MEDIA-3: THE ASSETS OF ONE CONTENT-DRAFT REVISION ────────────────────────
 *
 * The listing a human needs is "what images exist for THIS revision", and the relationship that
 * answers it already exists: the invocation carries `(tenant_id, source_artifact_id,
 * source_revision_no)` as a foreign key, and `media_generation_invocations_source_idx` indexes
 * exactly that triple. So this adds a READER over a relationship MEDIA-1 already owns — no column,
 * no table, no second place where "which draft is this image for" is recorded.
 *
 * IT DELIBERATELY GRANTS NO ACCESS. Listing is a database read; it resolves no store, verifies no
 * bytes and mints no signed URL. A gallery of N assets must not become N store round-trips and N
 * short-lived grants that expire before anyone clicks. Access is requested for ONE asset when a
 * human opens it, by `readMediaAsset`, which verifies size and digest first. That split is the
 * whole point: the list is cheap and authoritative, the preview is verified and expensive.
 *
 * It also carries no review state. Approval lives in the Governance ledger and is read from there.
 */

/**
 * One admitted asset of a revision, as the database records it. No access, no bytes.
 *
 * Deliberately the SAME projection as a single read, so a listed asset and an opened one are the
 * same record and cannot drift into two shapes that disagree about provenance.
 */
export type RevisionMediaAsset = MediaAssetRecord;

export type RevisionMediaAssetListing =
  | { readonly status: "unavailable"; readonly reason: "persistence-unavailable" }
  | { readonly status: "read"; readonly assets: readonly RevisionMediaAsset[] };

/**
 * Every admitted asset generated for one exact content-draft revision, oldest first.
 *
 * Tenant-predicated on both tables. An empty list is a fact, never a failure — and a failure is
 * never rendered as an empty list.
 */
export async function listRevisionMediaAssets(
  tenant: TenantContext | null,
  input: { readonly artifactId: string; readonly revisionNo: number } | null,
  deps: MediaReadDeps = {},
): Promise<RevisionMediaAssetListing> {
  if (typeof window !== "undefined") {
    throw new Error("Media asset reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unavailable", reason: "persistence-unavailable" };
  if (!input || !isUuid(input.artifactId)) return { status: "read", assets: [] };
  if (!Number.isSafeInteger(input.revisionNo) || input.revisionNo < 1) {
    return { status: "read", assets: [] };
  }

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  try {
    const rows = await db
      .select({
        assetId: mediaAssets.id,
        invocationId: mediaGenerationInvocations.id,
        mimeType: mediaAssets.mimeType,
        byteSize: mediaAssets.byteSize,
        byteDigest: mediaAssets.byteDigest,
        width: mediaAssets.width,
        height: mediaAssets.height,
        admittedAt: mediaAssets.admittedAt,
        lifecycle: mediaAssets.assetLifecycleStatus,
        sourceArtifactId: mediaGenerationInvocations.sourceArtifactId,
        sourceRevisionNo: mediaGenerationInvocations.sourceRevisionNo,
        agentId: mediaGenerationInvocations.agentId,
        requestedByActorId: mediaGenerationInvocations.requestedByActorId,
        transport: mediaGenerationInvocations.transport,
        provider: mediaGenerationInvocations.provider,
        model: mediaGenerationInvocations.model,
        providerJobId: mediaGenerationInvocations.providerJobId,
        inputDigest: mediaGenerationInvocations.inputDigest,
      })
      .from(mediaAssets)
      .innerJoin(
        mediaGenerationInvocations,
        and(
          eq(mediaGenerationInvocations.id, mediaAssets.invocationId),
          eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId),
        ),
      )
      .where(
        and(
          eq(mediaAssets.tenantId, tenant.tenantId),
          eq(mediaGenerationInvocations.tenantId, tenant.tenantId),
          eq(mediaGenerationInvocations.sourceArtifactId, input.artifactId),
          eq(mediaGenerationInvocations.sourceRevisionNo, input.revisionNo),
        ),
      )
      .orderBy(asc(mediaAssets.admittedAt));

    return {
      status: "read",
      assets: rows.map((row) => ({
        ...row,
        mimeType: row.mimeType as MediaAssetMimeType,
        lifecycle: row.lifecycle as MediaAssetLifecycleStatus,
        admittedAt: new Date(row.admittedAt).toISOString(),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

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
    const rows = await db
      .select({
        assetId: mediaAssets.id,
        invocationId: mediaGenerationInvocations.id,
        mimeType: mediaAssets.mimeType,
        byteSize: mediaAssets.byteSize,
        byteDigest: mediaAssets.byteDigest,
        width: mediaAssets.width,
        height: mediaAssets.height,
        admittedAt: mediaAssets.admittedAt,
        lifecycle: mediaAssets.assetLifecycleStatus,
        sourceArtifactId: mediaGenerationInvocations.sourceArtifactId,
        sourceRevisionNo: mediaGenerationInvocations.sourceRevisionNo,
        agentId: mediaGenerationInvocations.agentId,
        requestedByActorId: mediaGenerationInvocations.requestedByActorId,
        transport: mediaGenerationInvocations.transport,
        provider: mediaGenerationInvocations.provider,
        model: mediaGenerationInvocations.model,
        providerJobId: mediaGenerationInvocations.providerJobId,
        inputDigest: mediaGenerationInvocations.inputDigest,
      })
      .from(mediaAssets)
      .innerJoin(
        mediaGenerationInvocations,
        and(
          eq(mediaGenerationInvocations.id, mediaAssets.invocationId),
          eq(mediaGenerationInvocations.tenantId, mediaAssets.tenantId),
        ),
      )
      .where(
        and(
          eq(mediaAssets.tenantId, tenant.tenantId),
          eq(mediaGenerationInvocations.tenantId, tenant.tenantId),
          inArray(mediaGenerationInvocations.sourceArtifactId, wanted),
        ),
      )
      .orderBy(desc(mediaGenerationInvocations.sourceRevisionNo), asc(mediaAssets.admittedAt));

    return {
      status: "read",
      assets: rows.map((row) => ({
        ...row,
        mimeType: row.mimeType as MediaAssetMimeType,
        lifecycle: row.lifecycle as MediaAssetLifecycleStatus,
        admittedAt: new Date(row.admittedAt).toISOString(),
      })),
    };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}
