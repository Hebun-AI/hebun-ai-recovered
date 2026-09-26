/*
 * media-assets/read-publish-derivative.server.ts — the lineage check and the ONE provider read grant
 * a governed Instagram publish may receive (PUBLISH-0).
 *
 * Two readers, one definition of "this derivative is still the approved one":
 *
 *   selectPublishLineage     database only. The original must be THIS tenant's ORIGINAL asset —
 *                            generated, or supplied by a human (MEDIA-SUPPLIED), never derived —
 *                            `admitted`, with the bound digest; the derivative must be THIS tenant's
 *                            `jpeg-publish-v1` of exactly that original — invocation NULL, JPEG,
 *                            `admitted`, with the bound digest. Used in execution pre-flight and
 *                            inside the spend transaction.
 *
 *   readPublishDerivative    the lineage above, THEN both stored objects verified as stored (size
 *                            and SHA-256 against their rows), THEN one short-lived read grant minted
 *                            for the DERIVATIVE ONLY. The original's bytes are verified but never
 *                            granted: a provider can only ever be handed the JPEG a human approved.
 *
 * Neither grants authority. A lineage that verifies is a prerequisite a permit still has to meet.
 *
 * Server-only.
 */
import { and, eq, isNull } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { mediaAssets } from "@/db/schema/media-asset";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { JPEG_PUBLISH_DERIVATION, isUuid } from "./contracts";
import {
  MEDIA_READ_ACCESS_TTL_SECONDS,
  type MediaReadAccess,
  type MediaStorageResolution,
} from "./media-object-store";
import { resolveMediaDbOrNull } from "./media-db.server";
import { resolveMediaObjectStore } from "./media-storage.server";

export interface PublishLineageBinding {
  readonly originalAssetId: string;
  readonly originalDigest: string;
  readonly derivedAssetId: string;
  readonly derivedDigest: string;
}

export type PublishLineageFailure =
  | "original-unresolvable"
  | "original-retired"
  /** MV-2 — the bound original is not an image. An image publish never carries a video. */
  | "original-not-image"
  | "original-digest-mismatch"
  | "derivative-unresolvable"
  | "derivative-retired"
  | "derivative-lineage-mismatch"
  | "derivative-digest-mismatch";

interface LineageRow {
  readonly id: string;
  readonly byteSize: number;
  readonly byteDigest: string;
  readonly storageKey: string;
}

export type PublishLineage =
  | { readonly status: "verified"; readonly original: LineageRow; readonly derivative: LineageRow }
  | { readonly status: "refused"; readonly reason: PublishLineageFailure };

const lineageColumns = {
  id: mediaAssets.id,
  invocationId: mediaAssets.invocationId,
  derivedFromAssetId: mediaAssets.derivedFromAssetId,
  derivation: mediaAssets.derivation,
  suppliedSource: mediaAssets.suppliedSource,
  mediaKind: mediaAssets.mediaKind,
  mimeType: mediaAssets.mimeType,
  byteSize: mediaAssets.byteSize,
  byteDigest: mediaAssets.byteDigest,
  lifecycle: mediaAssets.assetLifecycleStatus,
  storageKey: mediaAssets.storageKey,
};

/** Database-only lineage check. Tenant-predicated on both rows. */
export async function selectPublishLineage(
  db: Pick<ControlPlaneDatabase, "select">,
  tenantId: string,
  binding: PublishLineageBinding,
): Promise<PublishLineage> {
  const refused = (reason: PublishLineageFailure): PublishLineage => ({ status: "refused", reason });
  if (!isUuid(binding.originalAssetId)) return refused("original-unresolvable");
  if (!isUuid(binding.derivedAssetId)) return refused("derivative-unresolvable");

  const original = (
    await db
      .select(lineageColumns)
      .from(mediaAssets)
      .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, binding.originalAssetId)))
      .limit(1)
  )[0];
  /* An ORIGINAL: generated (invocation) or MEDIA-SUPPLIED (supplied provenance) — never a derivative. */
  if (
    !original ||
    original.derivedFromAssetId !== null ||
    (original.invocationId === null && original.suppliedSource === null)
  ) {
    return refused("original-unresolvable");
  }
  if (original.mediaKind !== "image") return refused("original-not-image");
  if (original.lifecycle !== "admitted") return refused("original-retired");
  if (original.byteDigest !== binding.originalDigest) return refused("original-digest-mismatch");

  const derivative = (
    await db
      .select(lineageColumns)
      .from(mediaAssets)
      .where(
        and(
          eq(mediaAssets.tenantId, tenantId),
          eq(mediaAssets.id, binding.derivedAssetId),
          isNull(mediaAssets.invocationId),
        ),
      )
      .limit(1)
  )[0];
  if (!derivative) return refused("derivative-unresolvable");
  if (
    derivative.derivedFromAssetId !== original.id ||
    derivative.derivation !== JPEG_PUBLISH_DERIVATION ||
    derivative.mimeType !== "image/jpeg"
  ) {
    return refused("derivative-lineage-mismatch");
  }
  if (derivative.lifecycle !== "admitted") return refused("derivative-retired");
  if (derivative.byteDigest !== binding.derivedDigest) return refused("derivative-digest-mismatch");

  const pick = (r: typeof original): LineageRow => ({
    id: r.id,
    byteSize: r.byteSize,
    byteDigest: r.byteDigest,
    storageKey: r.storageKey,
  });
  return { status: "verified", original: pick(original), derivative: pick(derivative) };
}

export interface PublishDerivativeReadDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
  readonly resolveStorage?: () => MediaStorageResolution;
}

export type ReadPublishDerivativeResult =
  | { readonly status: "unauthenticated" }
  | {
      readonly status: "unavailable";
      readonly reason:
        | "storage-unavailable"
        | "persistence-unavailable"
        | "object-absent"
        | "integrity-mismatch";
    }
  | { readonly status: "refused"; readonly reason: PublishLineageFailure }
  | {
      readonly status: "read";
      readonly derivedAssetId: string;
      readonly derivedDigest: string;
      readonly mimeType: "image/jpeg";
      readonly access: MediaReadAccess;
    };

/** Lineage + both objects verified as stored + ONE grant, for the derivative only. */
export async function readPublishDerivative(
  tenant: TenantContext | null,
  binding: PublishLineageBinding,
  deps: PublishDerivativeReadDeps = {},
): Promise<ReadPublishDerivativeResult> {
  if (typeof window !== "undefined") throw new Error("Media asset reads are server-only.");
  if (!tenant?.tenantId || !tenant.userId) return { status: "unauthenticated" };

  const storage = (deps.resolveStorage ?? resolveMediaObjectStore)();
  if (storage.status !== "available") return { status: "unavailable", reason: "storage-unavailable" };
  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return { status: "unavailable", reason: "persistence-unavailable" };

  let lineage: PublishLineage;
  try {
    lineage = await selectPublishLineage(db, tenant.tenantId, binding);
  } catch {
    return { status: "unavailable", reason: "persistence-unavailable" };
  }
  if (lineage.status !== "verified") return lineage;

  for (const row of [lineage.original, lineage.derivative]) {
    let stored;
    try {
      stored = await storage.store.verify(row.storageKey);
    } catch {
      return { status: "unavailable", reason: "object-absent" };
    }
    if (stored.status !== "present") return { status: "unavailable", reason: "object-absent" };
    if (stored.byteSize !== row.byteSize || stored.sha256Hex !== row.byteDigest) {
      return { status: "unavailable", reason: "integrity-mismatch" };
    }
  }

  const access = await storage.store.createReadAccess({
    key: lineage.derivative.storageKey,
    contentType: "image/jpeg",
    ttlSeconds: MEDIA_READ_ACCESS_TTL_SECONDS,
  });
  return {
    status: "read",
    derivedAssetId: lineage.derivative.id,
    derivedDigest: lineage.derivative.byteDigest,
    mimeType: "image/jpeg",
    access,
  };
}
