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
import { and, eq, isNull, or } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets, mediaGenerationInvocations } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid } from "./contracts";
import { MEDIA_READ_ACCESS_TTL_SECONDS, type MediaReadAccess } from "./media-object-store";
import { resolveMediaObjectStore } from "./media-storage.server";
import { resolveMediaDbOrNull } from "./media-db.server";
import {
  recordsOf,
  selectRecordRows,
  toRecord,
  withoutStorageKey,
  type MediaAssetRecord,
  type MediaReadDeps,
  type RevisionMediaAsset,
} from "./media-asset-records.server";

export type ReadMediaAssetResult =
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "unavailable";
      readonly reason: "storage-unavailable" | "persistence-unavailable" | "object-absent" | "integrity-mismatch";
    }
  | { readonly status: "not-found" }
  | { readonly status: "read"; readonly asset: MediaAssetRecord; readonly access: MediaReadAccess };

/**
 * One generated or supplied asset plus its provenance, tenant-predicated. Internal to this
 * authority and to the governed publish chain that must re-read it. A derived asset is never
 * returned: it is not a creative subject.
 */
export async function selectMediaAssetRecord(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  assetId: string,
): Promise<(MediaAssetRecord & { readonly storageKey: string }) | null> {
  const rows = await selectRecordRows(db)
    .where(
      and(
        eq(mediaAssets.tenantId, tenantId),
        eq(mediaAssets.id, assetId),
        isNull(mediaAssets.derivedFromAssetId),
        /* A generated row's invocation is this tenant's too — stated, not only implied by the join. */
        or(isNull(mediaAssets.invocationId), eq(mediaGenerationInvocations.tenantId, tenantId)),
      ),
    )
    .limit(1);
  const row = rows[0];
  return row ? toRecord(row) : null;
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
  return { status: "read", asset: withoutStorageKey(record), access };
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
    const rows = await selectRecordRows(db)
      .where(
        and(
          eq(mediaAssets.tenantId, tenant.tenantId),
          or(isNull(mediaAssets.invocationId), eq(mediaGenerationInvocations.tenantId, tenant.tenantId)),
          isNull(mediaAssets.derivedFromAssetId),
          or(
            and(
              eq(mediaGenerationInvocations.sourceArtifactId, input.artifactId),
              eq(mediaGenerationInvocations.sourceRevisionNo, input.revisionNo),
            ),
            and(
              eq(mediaAssets.suppliedArtifactId, input.artifactId),
              eq(mediaAssets.suppliedRevisionNo, input.revisionNo),
            ),
          ),
        ),
      )
      .orderBy(mediaAssets.admittedAt, mediaAssets.id);

    return { status: "read", assets: recordsOf(rows) };
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
}

/* MEDIA-1 / MEDIA-4A — moved to the store-free record module (SUITE-RECOVERY-1, RC-A); re-exported unchanged. */
export {
  listArtifactMediaAssets,
  type ArtifactMediaAssetListing,
  type GeneratedMediaAssetRecord,
  type MediaAssetRecord,
  type MediaReadDeps,
  type RevisionMediaAsset,
  type SuppliedMediaAssetRecord,
} from "./media-asset-records.server";
