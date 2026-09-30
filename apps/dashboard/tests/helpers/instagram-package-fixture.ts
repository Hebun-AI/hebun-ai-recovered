/*
 * tests/helpers/instagram-package-fixture.ts — INSTAGRAM-PACKAGE-READINESS-1: legitimate Content
 * Package preparation for an Instagram draft, through the RELEASED writers only:
 *
 *   selection      selectMediaForRevision / deselectMediaForRevision  (content_selected_media)
 *   media review   acceptMediaAsset / declineMediaAsset                (MEDIA-3, Governance ledger)
 *   copy review    acceptArtifactRevision / requestArtifactRevisionChanges (TRH-10, Governance ledger)
 *
 * No row is inserted by hand: a fixture that bypassed a writer would prove readiness the product
 * could never reach. Review state is the LATEST decision by `decided_at`, so every write here takes
 * a strictly increasing clock.
 */
import assert from "node:assert/strict";
import type { Client } from "pg";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import {
  deselectMediaForRevision,
  selectMediaForRevision,
} from "../../src/features/content-composition/select-media.server";
import { acceptMediaAsset, declineMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import {
  acceptArtifactRevision,
  requestArtifactRevisionChanges,
} from "../../src/features/work-artifact-review/review-revision.server";

const REASON = "Judged fit for the next internal step of this draft.";

export interface InstagramPackageTarget {
  readonly artifactId: string;
  readonly revisionNo: number;
}

export function instagramPackagePreparation(
  client: Pick<Client, "query">,
  getDb: () => ControlPlaneDatabase,
) {
  let tick = Date.now();
  const now = () => new Date((tick += 1000));
  const digestOf = async (ctx: TenantContext, assetId: string) =>
    (await client.query<{ d: string }>(`select byte_digest d from media_assets where tenant_id=$1 and id=$2`, [ctx.tenantId, assetId]))
      .rows[0]!.d;
  const revisionIdOf = async (ctx: TenantContext, t: InstagramPackageTarget) =>
    (await client.query<{ id: string }>(
      `select id from work_artifact_revisions where tenant_id=$1 and artifact_id=$2 and revision_no=$3`,
      [ctx.tenantId, t.artifactId, t.revisionNo],
    )).rows[0]!.id;

  const api = {
    now,
    async select(ctx: TenantContext, t: InstagramPackageTarget, assetId: string) {
      const r = await selectMediaForRevision(ctx, { ...t, mediaAssetId: assetId }, { getDb });
      assert.deepEqual(r, { status: "selected" }, `fixture: select ${assetId}`);
    },
    async deselect(ctx: TenantContext, t: InstagramPackageTarget, assetId: string) {
      const r = await deselectMediaForRevision(ctx, { ...t, mediaAssetId: assetId }, { getDb });
      assert.deepEqual(r, { status: "deselected" }, `fixture: deselect ${assetId}`);
    },
    async approveMedia(ctx: TenantContext, assetId: string) {
      const r = await acceptMediaAsset(ctx, { assetId, byteDigest: await digestOf(ctx, assetId), justification: REASON }, { getDb, now });
      assert.equal(r.status, "reviewed", `fixture: approve ${assetId} ${JSON.stringify(r)}`);
    },
    async declineMedia(ctx: TenantContext, assetId: string) {
      const r = await declineMediaAsset(ctx, { assetId, byteDigest: await digestOf(ctx, assetId), justification: REASON }, { getDb, now });
      assert.equal(r.status, "reviewed", `fixture: decline ${assetId} ${JSON.stringify(r)}`);
    },
    async approveCopy(ctx: TenantContext, t: InstagramPackageTarget) {
      const r = await acceptArtifactRevision(ctx, { artifactId: t.artifactId, revisionId: await revisionIdOf(ctx, t), justification: REASON }, { getDb, now });
      assert.equal(r.status, "reviewed", `fixture: approve copy ${JSON.stringify(r)}`);
    },
    async requestCopyChanges(ctx: TenantContext, t: InstagramPackageTarget) {
      const r = await requestArtifactRevisionChanges(ctx, { artifactId: t.artifactId, revisionId: await revisionIdOf(ctx, t), justification: REASON }, { getDb, now });
      assert.equal(r.status, "reviewed", `fixture: request copy changes ${JSON.stringify(r)}`);
    },
    /** The whole legitimate preparation: select the image, approve it, approve the copy. */
    async makeReady(ctx: TenantContext, t: InstagramPackageTarget, assetId: string) {
      await api.select(ctx, t, assetId);
      await api.approveMedia(ctx, assetId);
      await api.approveCopy(ctx, t);
    },
  };
  return api;
}
