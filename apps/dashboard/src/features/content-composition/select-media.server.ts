/*
 * content-composition/select-media.server.ts — put an image into a draft revision, or take it out.
 *
 * ── THE ENTIRE AUTHORITY OF THIS MODULE ──────────────────────────────────────
 *
 * It inserts and deletes rows in `content_selected_media`. That is the whole list.
 *
 * It writes NOTHING to `media_assets` (no lifecycle, no retirement), NOTHING to `work_artifacts` or
 * `work_artifact_revisions` (no content, no current revision), and NOTHING to `decision_records`
 * (no approval, no decline, no session). It creates no action request, no permit, no execution
 * attempt, and it reaches no provider. Selecting an image is a human saying "this belongs here",
 * and Hebun records exactly that sentence and no implication of it.
 *
 * ── CUSTODY GATES; GOVERNANCE DOES NOT ───────────────────────────────────────
 *
 * Eligibility is checked against `media_assets.asset_lifecycle_status` alone. An approved, a
 * declined and a never-reviewed image are all equally selectable, because accepting may not
 * authorize an internal act and declining may not forbid one — the MEDIA-5 doctrine, unchanged.
 * Only RETIREMENT blocks selection, because that is a custody fact rather than a judgement.
 * Whether a selection is READY is a different question, answered by the reader, by re-reading
 * Governance at read time.
 *
 * ── TENANT ─────────────────────────────────────────────────────────────────��─
 *
 * Taken from the authenticated session, never from the caller. Both parents are verified to belong
 * to that tenant before the write, and the composite foreign keys make a cross-tenant row
 * unrepresentable even if this check were bypassed. A revision or asset belonging to another tenant
 * is reported as unresolvable — indistinguishable from absent, on purpose.
 *
 * ── RE-SELECTING AND DESELECTING ─────────────────────────────────────────────
 *
 * Selecting twice is a no-op, not a duplicate and not an error: the unique constraint is the lock
 * and `ON CONFLICT DO NOTHING` is the response. Deselecting deletes the row — the row IS the
 * selection, so there is no tombstone, no lifecycle column, and nothing to reconcile. Neither
 * direction touches the image.
 *
 * Server-only.
 */
import { and, eq } from "drizzle-orm";
import type { ControlPlaneDatabase } from "@/db/client.server";
import { contentSelectedMedia } from "@/db/schema/content-selected-media";
import { mediaAssets } from "@/db/schema/media-asset";
import { workArtifactRevisions } from "@/db/schema/work-artifact";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { isUuid } from "@/features/media-assets/contracts";
import { resolveMediaDbOrNull } from "@/features/media-assets/media-db.server";
import type { ContentSelectionRefusal } from "./contracts";

export interface ContentSelectionDeps {
  readonly getDb?: () => ControlPlaneDatabase | null;
}

export interface ContentSelectionInput {
  readonly artifactId: string;
  readonly revisionNo: number;
  readonly mediaAssetId: string;
}

export type ContentSelectionResult =
  | { readonly status: "selected" }
  | { readonly status: "deselected" }
  | { readonly status: "refused"; readonly reason: ContentSelectionRefusal };

function refused(reason: ContentSelectionRefusal): ContentSelectionResult {
  return { status: "refused", reason };
}

function validInput(input: ContentSelectionInput | null): input is ContentSelectionInput {
  if (!input) return false;
  if (!isUuid(input.artifactId) || !isUuid(input.mediaAssetId)) return false;
  return Number.isSafeInteger(input.revisionNo) && input.revisionNo >= 1;
}

/**
 * Both parents, in this tenant. Returns the asset's custody status so the caller can gate on it
 * without a second query, and `null` for either parent that this tenant cannot see.
 */
async function resolveParents(
  db: ControlPlaneDatabase,
  tenantId: string,
  input: ContentSelectionInput,
): Promise<{ revision: boolean; assetLifecycle: string | null }> {
  const [revisionRows, assetRows] = await Promise.all([
    db
      .select({ revisionNo: workArtifactRevisions.revisionNo })
      .from(workArtifactRevisions)
      .where(
        and(
          eq(workArtifactRevisions.tenantId, tenantId),
          eq(workArtifactRevisions.artifactId, input.artifactId),
          eq(workArtifactRevisions.revisionNo, input.revisionNo),
        ),
      )
      .limit(1),
    db
      .select({ lifecycle: mediaAssets.assetLifecycleStatus })
      .from(mediaAssets)
      .where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, input.mediaAssetId)))
      .limit(1),
  ]);
  return {
    revision: revisionRows.length > 0,
    assetLifecycle: assetRows[0]?.lifecycle ?? null,
  };
}

/** Put one admitted image into one draft revision. Idempotent. */
export async function selectMediaForRevision(
  tenant: TenantContext | null,
  input: ContentSelectionInput | null,
  deps: ContentSelectionDeps = {},
): Promise<ContentSelectionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Content selection is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!validInput(input)) return refused("invalid-input");

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");

  let parents;
  try {
    parents = await resolveParents(db, tenant.tenantId, input);
  } catch {
    return refused("persistence-unavailable");
  }
  if (!parents.revision) return refused("revision-unresolvable");
  if (parents.assetLifecycle === null) return refused("asset-unresolvable");
  /* Custody, and ONLY custody. No Governance state is read here at all. */
  if (parents.assetLifecycle !== "admitted") return refused("asset-retired");

  try {
    await db
      .insert(contentSelectedMedia)
      .values({
        tenantId: tenant.tenantId,
        artifactId: input.artifactId,
        revisionNo: input.revisionNo,
        mediaAssetId: input.mediaAssetId,
        selectedByActorId: tenant.userId,
      })
      /* Selecting what is already selected is the same world. Not a duplicate, not an error. */
      .onConflictDoNothing();
  } catch {
    return refused("persistence-unavailable");
  }
  return { status: "selected" };
}

/**
 * Take one image out of one draft revision.
 *
 * A retired asset may be DEselected — removing something is never blocked by the custody fact that
 * makes it unusable, or a retirement would strand it in the package permanently.
 */
export async function deselectMediaForRevision(
  tenant: TenantContext | null,
  input: ContentSelectionInput | null,
  deps: ContentSelectionDeps = {},
): Promise<ContentSelectionResult> {
  if (typeof window !== "undefined") {
    throw new Error("Content selection is server-only.");
  }
  if (!tenant?.tenantId || !tenant.userId) return refused("unauthenticated");
  if (!validInput(input)) return refused("invalid-input");

  const db = (deps.getDb ?? resolveMediaDbOrNull)();
  if (!db) return refused("persistence-unavailable");

  try {
    await db
      .delete(contentSelectedMedia)
      .where(
        and(
          eq(contentSelectedMedia.tenantId, tenant.tenantId),
          eq(contentSelectedMedia.artifactId, input.artifactId),
          eq(contentSelectedMedia.revisionNo, input.revisionNo),
          eq(contentSelectedMedia.mediaAssetId, input.mediaAssetId),
        ),
      );
  } catch {
    return refused("persistence-unavailable");
  }
  /* Deleting nothing is the same world as deleting something. Both leave it deselected. */
  return { status: "deselected" };
}
