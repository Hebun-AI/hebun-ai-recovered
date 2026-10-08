/*
 * HEBY-CONTENT-OPS-1 — human-supplied media joins the governed content chain.
 *
 * Real (disposable) Postgres and migrations; the RELEASED writers and readers for every step:
 * MEDIA-SUPPLIED admission (Drive read injected, memory store), MEDIA-3 review, CONTENT-COMPOSE-1
 * selection, the Content Package reader, the Heby content-media shaper, and YOUTUBE-WRITE-2's
 * proposal and execution-side package binding. Only the Drive read, the YouTube connection and the
 * channel answer are faked — no provider is reached.
 *
 * THE CLAIM:
 *
 *   "An admitted SUPPLIED image or video can receive the released MEDIA-3 decision, whose evidence
 *    names its supplied origin; the asset row is untouched and no invocation is invented. It can be
 *    selected into its OWN draft (custody-gated, exactly as a generated asset — the MEDIA-5 doctrine
 *    the Director kept), never into another draft or another tenant. An unreviewed or declined
 *    selected supplied asset keeps the package from READY and YouTube refuses it; an accepted one
 *    makes the package READY with `origin: supplied`. Heby recommends it and changes nothing.
 *    YOUTUBE-WRITE-2's released proposal accepts the package and its execution-side binding agrees.
 *    Generated media behaves exactly as before. Nothing here widens generative-AI data use."
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import sharp from "sharp";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
/* Loaded FIRST: the schema barrel is the only safe entry point for src/db/schema/*. */
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { seedTenant } from "../mv4-async-generation/scenarios";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore } from "../helpers/media-fakes";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { admitSuppliedDriveImage } from "../../src/features/media-assets/admit-supplied-drive-image.server";
import type { DriveImageResult } from "../../src/features/provider-google/read-drive-image.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { listArtifactMediaAssets } from "../../src/features/media-assets/read-media-assets.server";
import { listArtifactMediaVideos } from "../../src/features/media-assets/read-media-videos.server";
import { listArtifactVideoGenerations } from "../../src/features/media-assets/async-generation-lifecycle.server";
import { listWorkArtifacts } from "../../src/features/work-artifacts/read-work-artifacts.server";
import {
  acceptMediaAsset,
  declineMediaAsset,
  readMediaAssetReviewStates,
} from "../../src/features/media-asset-review/review-media-asset.server";
import { selectMediaForRevision, deselectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { readContentPackage } from "../../src/features/content-composition/read-content-package.server";
import {
  readContentMediaGroundingSource,
  readContentMediaPrefills,
} from "../../src/features/content-composition/heby-content-media-source.server";
import { evaluateMediaChoice } from "../../src/features/content-composition/media-choice";
import { acceptArtifactRevision } from "../../src/features/work-artifact-review/review-revision.server";
import { proposeYouTubePublish } from "../../src/features/heby-action-inlet/youtube-publish-proposal.server";
import { verifyYouTubePackageBinding } from "../../src/features/youtube-publishing/resolve-youtube-publish.server";
import { insertGoogleWorkspaceConnectionRow } from "../helpers/google-workspace-connection-row";

const NOW = new Date("2026-09-28T20:00:00.000Z");
const REASON = "Judged fit for the next internal step of this draft.";
const DRIVE_IMAGE = "1MH8wDjal8C9MPUwT38uhB218HnyraNyQ";
const DRIVE_VIDEO = "1VideoFromTheOrganizationsOwnDrive";
const CHANNEL = { channelId: "UC5Yf5U_YOKR0K38tWF82kjA", title: "Turkish Rug House" };
const sha = (b: string | Uint8Array): string => createHash("sha256").update(b).digest("hex");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("heby-content-ops-1/supplied-package-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_hco1");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = (): ControlPlaneDatabase => handle.db;
  const store = createMemoryMediaObjectStore();
  const resolveStorage = () => ({ status: "available" as const, store });
  try {
    harness.migrateDatabase();
    await client.connect();
    const a = await seedTenant(client, getDb, "Acme");
    const b = await seedTenant(client, getDb, "Beta");

    const count = async (q: string, p: unknown[] = []) => (await client.query<{ n: number }>(q, p)).rows[0]!.n;
    const assetRow = async (id: string) =>
      (await client.query<{ j: string }>(`select row_to_json(m)::text j from media_assets m where id=$1`, [id])).rows[0]!.j;
    const pkg = async (ctx: TenantContext, artifactId: string, revisionNo = 1) => {
      const r = await readContentPackage(ctx, { artifactId, revisionNo }, { getDb });
      assert.equal(r.status, "read", `package readable (${JSON.stringify(r)})`);
      if (r.status !== "read") throw new Error("unreachable");
      return r.package;
    };
    const acceptCopy = async (ctx: TenantContext, artifactId: string) => {
      const rev = (await client.query<{ id: string }>(
        `select id from work_artifact_revisions where tenant_id=$1 and artifact_id=$2 and revision_no=1`,
        [ctx.tenantId, artifactId],
      )).rows[0]!.id;
      await acceptArtifactRevision(ctx, { artifactId, revisionId: rev, justification: REASON }, { getDb, now: () => NOW } as never);
    };

    /* A YouTube content draft for tenant A (seedTenant's draft is an Instagram one). */
    const title = "How a Black Rose kilim is woven";
    const copy = "Three knots per centimetre, dyed by hand. Filmed in our own workshop.";
    const ytDraft = (await client.query<{ id: string }>(
      `insert into work_artifacts (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
         current_revision, intended_destination, created_by, created_by_type)
       values ($1,'content-draft',$2,'draft','operations',1,'youtube',$3,'human') returning id`,
      [a.tenantId, title, a.ctx.userId],
    )).rows[0]!.id;
    await client.query(
      `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
       values ($1,$2,1,$3,$4,'human',$5)`,
      [a.tenantId, ytDraft, copy, sha(copy), a.ctx.userId],
    );

    /* ══ ADMISSION (released MEDIA-SUPPLIED writer; Drive read injected) ══ */
    const jpeg = new Uint8Array(await sharp({ create: { width: 40, height: 30, channels: 3, background: { r: 150, g: 40, b: 60 } } }).jpeg().toBuffer());
    const sourceConnection = await insertGoogleWorkspaceConnectionRow(client, a.tenantId);
    const readImage = async (_t: TenantContext, input: { fileId: string }): Promise<DriveImageResult> => ({
      status: "read",
      capability: "google.drive.file.content.read",
      integrationId: sourceConnection,
      image: { fileId: input.fileId, name: "kilim.jpg", providerMimeType: "image/jpeg", bytes: jpeg, byteLength: jpeg.byteLength },
    });
    const admitted = await admitSuppliedDriveImage(a.ctx, { artifactId: a.draft, revisionNo: 1, driveFileId: DRIVE_IMAGE, pickerBinding: "test-picker-binding" }, { getDb, now: () => NOW, resolveStorage, readImage });
    assert.equal(admitted.status, "admitted", JSON.stringify(admitted));
    const img = admitted.status === "admitted" ? admitted.asset.assetId : "";

    /* A supplied VIDEO, in the exact shape MEDIA-SUPPLIED video admission writes (CHECKs enforce it). */
    const vid = randomUUID();
    const vbytes = new Uint8Array(Array.from({ length: 4096 }, (_, i) => (i * 13) % 256));
    await store.put({ key: `tenants/${a.tenantId}/media/${vid}`, bytes: vbytes, contentType: "video/mp4", sha256Hex: sha(vbytes) });
    await client.query(
      `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key, admitted_at,
         media_kind, video_container, video_duration_ms, video_codec, video_frame_rate,
         supplied_by_actor_type, supplied_by_actor_id, supplied_source, supplied_source_file_id, supplied_source_capability,
         supplied_artifact_id, supplied_revision_no)
       values ($1,$2,'video/mp4',$3,$4,1280,720,'test-memory',$5,$6,'video','mov,mp4,m4a,3gp,3g2,mj2',8000,'h264','30/1',
         'human',$7,'google-drive',$8,'google.drive.file.content.read',$9,1)`,
      [vid, a.tenantId, vbytes.length, sha(vbytes), `tenants/${a.tenantId}/media/${vid}`, NOW, a.ctx.userId, DRIVE_VIDEO, ytDraft],
    );
    const invocationsAtStart = await count(`select count(*)::int n from media_generation_invocations`);

    /* ══ 3 (doctrine form). UNREVIEWED supplied: selectable by custody, but the package is not READY ══ */
    assert.deepEqual(await selectMediaForRevision(a.ctx, { artifactId: ytDraft, revisionNo: 1, mediaAssetId: vid }, { getDb }), { status: "selected" });
    await acceptCopy(a.ctx, ytDraft);
    {
      const p = await pkg(a.ctx, ytDraft);
      assert.equal(p.ready, false);
      assert.deepEqual(p.blockers, ["selected-media-unreviewed"], "only the unreviewed supplied video blocks");
      assert.equal(p.selected[0]!.origin, "supplied", "the package names it supplied, not generated");
    }

    /* ══ YouTube's released proposal: faked connection + channel only ══ */
    const ytDeps = {
      getDb,
      resolveStorage,
      resolveConnection: async () => ({
        status: "available" as const,
        connection: { integrationId: randomUUID(), externalAccountId: "111111111111111111111", accountLabel: "owner@trh.test" },
      }),
      readChannel: async () => ({ status: "one-channel" as const, channel: CHANNEL }),
    } as never;
    const proposeYt = (ctx = a.ctx) =>
      proposeYouTubePublish(
        ctx,
        { draftRef: `work-artifact/${ytDraft}@1`, videoAssetId: vid, privacyStatus: "private", categoryId: "22", madeForKids: "no", syntheticMedia: "no" },
        ytDeps,
      );
    {
      const r = await proposeYt();
      assert.equal(r.status === "refused" && r.reason, "video-not-approved", "an unreviewed supplied video cannot be proposed");
    }

    /* ══ 1. REVIEW: the released MEDIA-3 writer takes a supplied original; the row is untouched ══ */
    const vidBefore = await assetRow(vid);
    const declined = await declineMediaAsset(a.ctx, { assetId: vid, byteDigest: sha(vbytes), justification: REASON }, { getDb, now: () => NOW });
    assert.equal(declined.status, "reviewed", JSON.stringify(declined));
    /* ══ 2 (doctrine form). DECLINED supplied: the package blocks and YouTube refuses ══ */
    {
      const p = await pkg(a.ctx, ytDraft);
      assert.deepEqual(p.blockers, ["selected-media-declined"]);
      const r = await proposeYt();
      assert.equal(r.status === "refused" && r.reason, "video-not-approved", "a declined supplied video cannot be proposed");
    }
    const acceptedV = await acceptMediaAsset(a.ctx, { assetId: vid, byteDigest: sha(vbytes), justification: REASON }, { getDb, now: () => new Date(NOW.getTime() + 1000) });
    assert.equal(acceptedV.status, "reviewed");
    assert.equal(await assetRow(vid), vidBefore, "1: review writes nothing to the Media row — provenance and lifecycle unchanged");
    {
      const ev = (await client.query<{ e: Record<string, unknown> }>(
        `select evidence e from decision_records where subject_type='media_asset' and subject_id=$1 order by decided_at desc limit 1`,
        [vid],
      )).rows[0]!.e;
      assert.equal(ev.origin, "supplied", "1: the ledger names the supplied origin");
      assert.equal(ev.invocationId, null, "1: and no invocation");
      assert.equal(ev.suppliedSourceFileId, DRIVE_VIDEO);
      assert.equal(ev.byteDigest, sha(vbytes));
    }
    /* A digest the reviewer was not shown records nothing (released rule, now also for supplied). */
    assert.equal(
      (await acceptMediaAsset(a.ctx, { assetId: img, byteDigest: sha("other"), justification: REASON }, { getDb })).status === "refused",
      true,
    );
    assert.equal((await acceptMediaAsset(a.ctx, { assetId: img, byteDigest: sha(jpeg), justification: REASON }, { getDb, now: () => NOW })).status, "reviewed");

    /* ══ 9 / 10. ACCEPTED + SELECTED supplied video → package READY, provenance truthful ══ */
    {
      const p = await pkg(a.ctx, ytDraft);
      assert.equal(p.ready, true, `READY (${p.blockers.join(",")})`);
      assert.deepEqual(p.blockers, []);
      assert.equal(p.selected.length, 1);
      assert.equal(p.selected[0]!.origin, "supplied");
      assert.equal(p.selected[0]!.mediaKind, "video");
      assert.equal(p.selected[0]!.sourceRevisionNo, 1, "the revision it was supplied into");
      assert.equal(p.mediaReviewStates[vid], "approved");
      assert.equal(JSON.stringify(p).includes("invocation"), false, "10: the package implies no invocation");
    }

    /* ══ 13. YOUTUBE-WRITE-2's released proposal accepts it; the execution-side binding agrees ══ */
    {
      const permitsBefore = await count(`select count(*)::int n from action_permits`);
      const r = await proposeYt();
      assert.equal(r.status, "proposed", JSON.stringify(r));
      if (r.status !== "proposed") throw new Error("unreachable");
      const payload = (await client.query<{ p: Record<string, unknown> }>(
        `select canonical_payload p from heby_action_requests where id=$1`,
        [r.requestId],
      )).rows[0]!.p;
      assert.equal(payload.videoAssetRef, vid);
      assert.equal(payload.videoAssetDigest, sha(vbytes), "the supplied video's digest is bound");
      assert.equal(payload.containsSyntheticMedia, false, "the human's declaration, never inferred from origin");
      const bound = await verifyYouTubePackageBinding(a.ctx, payload as never, { getDb });
      assert.equal(bound.ok, true, "the execution-side binding re-reads the package and agrees");
      assert.equal(await count(`select count(*)::int n from action_permits`), permitsBefore, "a proposal mints no permit");
      assert.equal(await count(`select count(*)::int n from action_execution_attempts`), 0, "and no attempt");
    }

    /* ══ 4 / 6. selection: own draft yes; another draft, a missing revision — no ══ */
    assert.deepEqual(await selectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 1, mediaAssetId: img }, { getDb }), { status: "selected" }, "4");
    assert.deepEqual(
      await selectMediaForRevision(a.ctx, { artifactId: ytDraft, revisionNo: 1, mediaAssetId: img }, { getDb }),
      { status: "refused", reason: "asset-unresolvable" },
      "6: a supplied image of another draft is unresolvable here",
    );
    assert.deepEqual(
      await selectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 9, mediaAssetId: img }, { getDb }),
      { status: "refused", reason: "revision-unresolvable" },
      "6: a revision that does not exist",
    );

    /* ══ 5. another tenant: cannot review, select or read ══ */
    assert.deepEqual(
      await selectMediaForRevision(b.ctx, { artifactId: b.draft, revisionNo: 1, mediaAssetId: img }, { getDb }),
      { status: "refused", reason: "asset-unresolvable" },
    );
    assert.deepEqual(
      await acceptMediaAsset(b.ctx, { assetId: vid, byteDigest: sha(vbytes), justification: REASON }, { getDb }),
      { status: "refused", reason: "asset-unresolvable" },
    );
    assert.equal((await readContentPackage(b.ctx, { artifactId: ytDraft, revisionNo: 1 }, { getDb })).status, "not-found");
    assert.equal((await proposeYt(b.ctx)).status, "refused", "5: another tenant cannot propose it");

    /* ══ 7. no invocation was invented for any supplied asset ══ */
    assert.equal(await count(`select count(*)::int n from media_generation_invocations`), invocationsAtStart);
    assert.equal(await count(`select count(*)::int n from media_assets where id = any($1) and invocation_id is not null`, [[img, vid]]), 0);

    /* ══ 8. generated media: unchanged — custody-gated selection, origin generated ══ */
    {
      const png = new Uint8Array(await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 180, g: 90, b: 40 } } }).png().toBuffer());
      const gen = await requestMediaGeneration(
        a.ctx,
        { artifactId: a.draft, revisionNo: 1, promptText: "A kilim on the loom.", requestKey: randomUUID() },
        {
          getDb,
          now: () => NOW,
          resolveStorage,
          resolveTransport: () => ({
            status: "available",
            transport: createFakeMediaGenerationTransport({
              kind: "bytes",
              bytes: png,
            }),
          }),
        } as never,
      );
      assert.equal(gen.status, "admitted");
      const genId = gen.status === "admitted" ? gen.assetId : "";
      assert.deepEqual(
        await selectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 1, mediaAssetId: genId }, { getDb }),
        { status: "selected" },
        "8: an UNREVIEWED generated image is still selectable (MEDIA-5 doctrine, unchanged)",
      );
      assert.deepEqual(
        await selectMediaForRevision(a.ctx, { artifactId: ytDraft, revisionNo: 1, mediaAssetId: genId }, { getDb }),
        { status: "refused", reason: "asset-unresolvable" },
        "8: MEDIA-SELECT-INTEGRITY for generated media is unchanged",
      );
      const p = await pkg(a.ctx, a.draft);
      const g = p.selected.find((s) => s.mediaAssetId === genId)!;
      const s = p.selected.find((x) => x.mediaAssetId === img)!;
      assert.equal(g.origin, "generated");
      assert.equal(s.origin, "supplied");
      assert.deepEqual(p.blockers, ["selected-media-unreviewed", "copy-unreviewed"], "the unreviewed generated image blocks, as before");
      assert.equal((await acceptMediaAsset(a.ctx, { assetId: genId, byteDigest: (await client.query<{ d: string }>(`select byte_digest d from media_assets where id=$1`, [genId])).rows[0]!.d, justification: REASON }, { getDb })).status, "reviewed");
      await deselectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 1, mediaAssetId: genId }, { getDb });
    }

    /* ══ 11 / 12. Heby recommends the accepted supplied media and changes nothing ══ */
    {
      const readDeps = {
        listArtifacts: (t: TenantContext) => listWorkArtifacts(t, { getDb }),
        listImages: (t: TenantContext, i: { artifactIds: readonly string[] }) => listArtifactMediaAssets(t, i, { getDb }),
        listVideos: (t: TenantContext, i: { artifactIds: readonly string[] }) => listArtifactMediaVideos(t, i, { getDb }),
        listGenerations: (t: TenantContext, i: { artifactIds: readonly string[] }) => listArtifactVideoGenerations(t, i, { getDb }),
        readReviewStates: (t: TenantContext, ids: readonly string[]) => readMediaAssetReviewStates(t, ids, { getDb }),
        readPackage: (t: TenantContext, i: { artifactId: string; revisionNo: number }) => readContentPackage(t, i, { getDb }),
        readProviderSwitch: async () => true,
      } as never;
      const writes = async () => [
        await count(`select count(*)::int n from media_assets`),
        await count(`select count(*)::int n from decision_records`),
        await count(`select count(*)::int n from content_selected_media`),
        await count(`select count(*)::int n from heby_action_requests`),
        await count(`select count(*)::int n from media_generation_invocations`),
      ];
      const before = await writes();
      const listing = await readContentMediaPrefills(a.ctx, readDeps);
      assert.equal(listing.status, "read");
      if (listing.status !== "read") throw new Error("unreachable");
      const yt = listing.prefills.find((p) => p.artifactId === ytDraft)!;
      assert.equal(yt.kind, "satisfied", "11: the accepted, selected supplied video satisfies the media part");
      if (yt.kind === "satisfied") assert.deepEqual(yt.assetIds, [vid]);
      const ytStep = listing.nextSteps.find((s) => s.artifactId === ytDraft)!;
      assert.equal(ytStep.state, "media-complete");
      assert.equal(ytStep.packageReady, true);
      const ig = listing.prefills.find((p) => p.artifactId === a.draft)!;
      assert.equal(ig.kind, "satisfied", "11: the accepted supplied image already selected for the Instagram draft");
      const grounding = await readContentMediaGroundingSource(a.ctx, readDeps);
      const text = JSON.stringify(grounding);
      assert.match(text, new RegExp(`${vid}[^"]*origin supplied[^"]*review accepted`), "Heby reads it as supplied AND accepted");
      assert.match(text, /media recommendation: use-existing/);
      assert.deepEqual(await writes(), before, "12: Heby's reads write nothing anywhere");
    }

    /* ══ 15. DATA USE: acceptance and selection do not clear a supplied image for generation ══ */
    {
      const choice = evaluateMediaChoice(
        {
          artifactId: a.draft, currentRevision: 1, destination: "instagram", packageReadable: true, attempts: [],
          media: [{ assetId: img, kind: "image", origin: "supplied", lifecycle: "admitted", review: "accepted", selectedInCurrentRevision: true }],
        },
        { textToVideo: true, imageToVideo: true, image: "not-read" },
      );
      const i2v = choice.paths.find((p) => p.path === "generate-image-to-video")!;
      assert.ok(i2v.blockers.includes("data-use-unresolved"), "an accepted, selected supplied image is still not cleared");
      /* The generation doors read no review, selection or package — acceptance cannot reach them. */
      for (const f of [
        "src/features/media-assets/read-verified-source-image.server.ts",
        "src/features/media-assets/async-generation-lifecycle.server.ts",
        "src/features/media-assets/request-media-generation.server.ts",
      ]) {
        const code = readFileSync(f, "utf8");
        for (const banned of ["media-asset-review", "select-media", "read-content-package", "content_selected_media", "decision_records"]) {
          assert.equal(code.includes(banned), false, `${f} must not read ${banned}`);
        }
      }
      /* The surface still never offers a supplied image as a generation reference. */
      const card = readFileSync("src/components/operations-preparation/revision-media-assets.tsx", "utf8");
      /* AP-5A: the card also hands the reference edit the in-service agents to name; the supplied/retired gate is what is pinned. */
      assert.match(card, /\{retired \|\| supplied \? null : <UseAsReference asset=\{asset\} agents=\{agents\} \/>\}/);
    }

    /* ══ 14. INSTAGRAM: the released direct path does not depend on the package ══ */
    {
      const proposal = readFileSync("src/features/heby-action-inlet/instagram-publish-proposal.server.ts", "utf8");
      assert.equal(proposal.includes("read-content-package"), false, "PUBLISH-0 still takes the image directly, not from the package");
      assert.equal(proposal.includes("select-media"), false);
    }

    finished = true;
    console.log("HEBY-CONTENT-OPS-1 supplied → governed Content Package: all checks passed");
  } finally {
    await handle.dispose().catch(() => {});
    await client.end().catch(() => {});
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
