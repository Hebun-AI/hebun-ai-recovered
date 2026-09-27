/*
 * VIDEO CONTENT CHAIN — a generated video enters the SAME content chain an image does. Real Postgres,
 * real migrations, the REAL VPS store process (video on), REAL ffprobe, and the released writers for
 * every step. The provider is simulated (MV-4's fake async transport + an injected output hop), and
 * the live resolver is exercised with its own injected env/control for the fail-closed cases.
 *
 * THE CLAIM:
 *
 *   "An authenticated human requests text-to-video through ONE register-then-dispatch of the MV-4
 *    lifecycle; completion is observed by explicit polls; a succeeded job is admitted only by MV-7.
 *    The admitted GENERATED video is listed for its draft, reviewed by the MEDIA-3 Governance review
 *    (same subject type, same digest binding), selected by CONTENT-COMPOSE-1 (same MEDIA-SELECT-
 *    INTEGRITY draft binding) and represented in the Content Package as a VIDEO with its probed
 *    facts. Connectivity OFF, a missing credential, dispatch-unknown, pending, succeeded-but-not-
 *    admitted and admission refusal are each represented as themselves. Nothing retries. Another
 *    tenant, another draft and a nonexistent revision are refused. A video whose kind contradicts its
 *    own invocation is refused by review and selection. The publish chain still refuses a video."
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { createFakeAsyncVideoTransport, type FakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";
import * as lifecycle from "../../src/features/media-assets/async-generation-lifecycle.server";
import { admitGeneratedVideo, type AdmitGeneratedVideoDeps } from "../../src/features/media-assets/admit-generated-video.server";
import type {
  MediaAsyncGenerationTransport,
  MediaAsyncGenerationTransportResolution,
} from "../../src/features/media-assets/async-generation-transport";
import { resolveMediaAsyncGenerationTransport } from "../../src/features/media-assets/async-generation-transport.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import type { ProviderHopGet } from "../../src/features/media-assets/provider-output-download.server";
import { listArtifactMediaVideos, readMediaVideo } from "../../src/features/media-assets/read-media-videos.server";
import { selectMediaAssetRecord } from "../../src/features/media-assets/read-media-assets.server";
import { derivePublishJpeg } from "../../src/features/media-assets/derive-publish-jpeg.server";
import {
  acceptMediaAsset,
  declineMediaAsset,
  readMediaAssetReviewStates,
} from "../../src/features/media-asset-review/review-media-asset.server";
import { deselectMediaForRevision, selectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { readContentPackage } from "../../src/features/content-composition/read-content-package.server";
import { acceptArtifactRevision } from "../../src/features/work-artifact-review/review-revision.server";

const FFMPEG = process.env.HEBUN_TEST_FFMPEG ?? execFileSync("sh", ["-c", "command -v ffmpeg || true"], { encoding: "utf8" }).trim();
const FFPROBE = process.env.HEBUN_TEST_FFPROBE ?? execFileSync("sh", ["-c", "command -v ffprobe || true"], { encoding: "utf8" }).trim();
const NOW = new Date("2026-09-27T12:00:00.000Z");
const REASON = "Judged fit for the next internal step of this draft.";
const CDN = "cdn.vcc.test";
const URL_SECRET = "SIGNATURE-VALUE-VCC-NOT-A-TOKEN";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("video-content-chain/chain-postgres: exited before completing");
    process.exitCode = 1;
  }
});

function synth(): Uint8Array {
  const dir = mkdtempSync(path.join(tmpdir(), "vcc-fx-"));
  const out = path.join(dir, "x.mp4");
  execFileSync(FFMPEG, [
    "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=2",
    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-brand", "mp42", out,
  ]);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

interface Provider {
  readonly transport: FakeAsyncVideoTransport & MediaAsyncGenerationTransport;
  readonly served: string[];
  readonly get: ProviderHopGet;
  hosts: string[];
  bytes: Uint8Array;
}

function provider(): Provider {
  const base = createFakeAsyncVideoTransport("accept");
  const p: Provider = {
    transport: base as Provider["transport"],
    served: [],
    hosts: [CDN],
    bytes: new Uint8Array(0),
    get: async (url) => {
      p.served.push(url.toString());
      const bytes = p.bytes;
      let offset = 0;
      const body = new ReadableStream<Uint8Array>({
        pull(c) {
          if (offset >= bytes.byteLength) return c.close();
          c.enqueue(bytes.subarray(offset, offset + 256 * 1024));
          offset += 256 * 1024;
        },
      });
      return { status: 200, headers: { "content-type": "video/mp4" }, body };
    },
  };
  (p.transport as { locateOutput?: MediaAsyncGenerationTransport["locateOutput"] }).locateOutput = async ({ providerJobId }) => ({
    status: "located",
    location: Object.freeze({
      shape: Object.freeze({ scheme: "https", hostname: CDN, hasPort: false, hasCredentials: false, queryParameterNames: ["sig"], pathSegmentCount: 2, pathExtension: ".mp4" }),
      allowedHosts: p.hosts,
      reveal: () => `https://${CDN}/out/${providerJobId}.mp4?sig=${URL_SECRET}`,
    }),
  });
  return p;
}

async function one<T>(client: Client, sql: string, args: unknown[]): Promise<T> {
  return (await client.query(sql, args)).rows[0] as T;
}

async function main(): Promise<void> {
  assert.ok(FFMPEG && FFPROBE, "ffmpeg and ffprobe are required");
  const harness = createDisposablePostgresHarness("hebun_video_content_chain");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = (): ControlPlaneDatabase => handle.db;
  let vps: LocalVpsStore | undefined;
  try {
    harness.migrateDatabase();
    await client.connect();
    vps = await startLocalVpsStore({ HEBUN_MEDIA_STORE_ENABLE_VIDEO: "1", HEBUN_MEDIA_STORE_FFPROBE: FFPROBE, HEBUN_MEDIA_STORE_FFMPEG: FFMPEG });
    const store = vps;
    const a: Tenant = await seedTenant(client, getDb, "Acme");
    const b: Tenant = await seedTenant(client, getDb, "Beta");
    /* A second draft of tenant A, for the wrong-draft proof. */
    const secondDraft = (
      await one<{ id: string }>(
        client,
        `insert into work_artifacts (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
           current_revision, intended_destination, created_by, created_by_type)
         values ($1,'content-draft','Other draft','draft','operations',1,'instagram',$2,'human') returning id`,
        [a.tenantId, a.ctx.userId],
      )
    ).id;
    await client.query(
      `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest, authored_by_actor_type, authored_by_actor_id)
       values ($1,$2,1,'Other copy',$3,'human',$4)`,
      [a.tenantId, secondDraft, createHash("sha256").update("Other copy").digest("hex"), a.ctx.userId],
    );
    const other: Tenant = { ...a, draft: secondDraft };
    const invocations = async () => (await one<{ n: number }>(client, `select count(*)::int n from media_generation_invocations`, [])).n;

    const p = provider();
    p.bytes = synth();
    const lifeDeps = (t: MediaAsyncGenerationTransport | null) => ({
      getDb,
      now: () => NOW,
      resolveTransport: (): MediaAsyncGenerationTransportResolution | Promise<MediaAsyncGenerationTransportResolution> =>
        t ? { status: "available", transport: t } : { status: "unavailable", reason: "video-generation-disabled" },
    });
    const admitDeps: AdmitGeneratedVideoDeps = {
      getDb,
      resolveStorageV2: () => ({
        status: "available",
        client: createVpsMediaStorageV2({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret }),
      }),
      resolveTransport: () => ({ status: "available", transport: p.transport }),
      download: { get: p.get },
    };
    const request = (t: Tenant, deps: ReturnType<typeof lifeDeps>, key = randomUUID(), revisionNo = 1) =>
      lifecycle.requestAsyncVideoGeneration(t.ctx, { artifactId: t.draft, revisionNo, promptText: "A slow pan across a kilim.", requestKey: key }, deps);

    /* ══ 1. FAIL-CLOSED BEFORE ANY CALL: control OFF, credential absent, nothing selected ══ */
    {
      const before = await invocations();
      const liveResolver = (env: Record<string, string>, enabled: boolean) => ({
        ...lifeDeps(null),
        resolveTransport: () => resolveMediaAsyncGenerationTransport({ env, resolveDirectorEnabled: async () => enabled }),
      });
      const KEY = "hf-test-opaque-key-not-real:0009-vccvccvccvccvccv";
      const cases: [Record<string, string>, boolean, string][] = [
        [{}, true, "no-video-generation-provider"],
        [{ HEBUN_VIDEO_GENERATION_TRANSPORT: "live" }, true, "video-generation-misconfigured"],
        [{ HEBUN_VIDEO_GENERATION_TRANSPORT: "live", HEBUN_HIGGSFIELD_API_KEY: KEY }, false, "video-generation-disabled"],
      ];
      for (const [env, enabled, reason] of cases) {
        assert.deepEqual(
          await resolveMediaAsyncGenerationTransport({ env, resolveDirectorEnabled: async () => enabled }),
          { status: "unavailable", reason },
          `the live resolver answers ${reason}`,
        );
        assert.deepEqual(
          await request(a, liveResolver(env, enabled)),
          { status: "refused", reason: "generation-transport-unavailable" },
          `${reason}: the application door refuses before registering`,
        );
      }
      assert.deepEqual(await request(a, lifeDeps(null)), { status: "refused", reason: "generation-transport-unavailable" }, "resolver unavailable");
      assert.equal(await invocations(), before, "no attempt is registered when the transport is refused");
      assert.equal(p.transport.dispatchCalls.length, 0, "no provider call");
    }

    /* ══ 2. DISPATCH-UNKNOWN is unknown, and a repeated key sends nothing ══ */
    {
      const unknown = createFakeAsyncVideoTransport("unknown");
      const key = randomUUID();
      const r = await request(a, lifeDeps(unknown), key);
      assert.equal(r.status, "dispatched");
      assert.equal(r.status === "dispatched" && r.state, "dispatch-unknown", "an ambiguous dispatch is recorded as unknown");
      const again = await request(a, lifeDeps(unknown), key);
      assert.deepEqual(again, { status: "refused", reason: "duplicate-request" }, "the same key registers nothing");
      assert.equal(unknown.dispatchCalls.length, 1, "ONE POST, never retried");
      const id = r.status === "dispatched" ? r.invocationId : "";
      const row = await one<{ state: string; provider_failure: string | null }>(client, `select state, provider_failure from media_generation_invocations where id=$1`, [id]);
      assert.deepEqual(row, { state: "dispatch-unknown", provider_failure: null }, "unknown is not failure");
      assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, id, lifeDeps(unknown)), { status: "no-transition", state: "dispatch-unknown" }, "unknown is never observed into success");
    }

    /* ══ 3. REQUEST → PENDING → OBSERVED → SUCCEEDED-NOT-ADMITTED → ADMITTED ══ */
    const r = await request(a, lifeDeps(p.transport));
    assert.equal(r.status === "dispatched" && r.state, "provider-pending", `request is one register + one dispatch (${JSON.stringify(r)})`);
    const invocationId = r.status === "dispatched" ? r.invocationId : "";
    assert.equal(p.transport.dispatchCalls.length, 1);
    assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, invocationId, lifeDeps(p.transport)), { status: "observed-pending", state: "provider-pending" });
    p.transport.pollScript.push(new Error("network"));
    assert.deepEqual(
      await lifecycle.pollAsyncMediaGeneration(a.ctx, invocationId, lifeDeps(p.transport)),
      { status: "observation-unreadable", state: "provider-pending" },
      "an unreadable observation stays pending — not failed",
    );
    /* Another tenant cannot observe it. */
    assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(b.ctx, invocationId, lifeDeps(p.transport)), { status: "refused", reason: "invocation-not-found" });
    p.transport.pollScript.push({ status: "succeeded", outputRef: "sim-job-vcc-1" });
    assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, invocationId, lifeDeps(p.transport)), { status: "transitioned", from: "provider-pending", state: "provider-succeeded" });

    const listing = await lifecycle.listArtifactVideoGenerations(a.ctx, { artifactIds: [a.draft] }, { getDb });
    assert.equal(listing.status, "read");
    const g = listing.status === "read" ? listing.generations.find((x) => x.invocationId === invocationId) : undefined;
    assert.ok(g, "the attempt is listed for its draft");
    assert.equal(g!.state, "provider-succeeded");
    assert.equal(g!.admissionOutcome, "not-attempted", "provider-succeeded is not admitted");
    assert.equal(g!.providerOutputReported, true);
    assert.equal(g!.sourceRevisionNo, 1);
    assert.ok(!JSON.stringify(listing).includes("sim-job-vcc-1"), "the provider output reference never leaves the lifecycle");
    const bList = await lifecycle.listArtifactVideoGenerations(b.ctx, { artifactIds: [a.draft] }, { getDb });
    assert.deepEqual(bList, { status: "read", generations: [] }, "another tenant lists nothing of A's");
    const videosBefore = await listArtifactMediaVideos(a.ctx, { artifactIds: [a.draft] }, { getDb });
    assert.deepEqual(videosBefore, { status: "read", videos: [] }, "succeeded but not admitted: no video exists in Media");

    /* Admission refused before a verdict (host not approved): nothing recorded. */
    p.hosts = [];
    const refusedAdmit = await admitGeneratedVideo(a.ctx, { invocationId }, admitDeps);
    assert.equal(refusedAdmit.status, "refused", "an unapproved output host is refused");
    assert.equal(p.served.length, 0, "no output fetch from an unapproved host");
    assert.equal(
      (await one<{ o: string }>(client, `select admission_outcome o from media_generation_invocations where id=$1`, [invocationId])).o,
      "not-attempted",
      "a refusal without a verdict records nothing",
    );
    /* Another tenant cannot admit it. */
    p.hosts = [CDN];
    assert.equal((await admitGeneratedVideo(b.ctx, { invocationId }, admitDeps)).status, "refused");
    assert.equal(p.served.length, 0);

    const admitted = await admitGeneratedVideo(a.ctx, { invocationId }, admitDeps);
    assert.equal(admitted.status, "admitted", `MV-7 admits (${JSON.stringify(admitted)})`);
    assert.ok(!JSON.stringify(admitted).includes(URL_SECRET), "no URL in the result");
    assert.equal(p.served.length, 1, "ONE output fetch");
    assert.equal(p.transport.dispatchCalls.length, 1, "admission never dispatches");
    const assetId = admitted.status === "admitted" ? admitted.asset.assetId : "";
    const digest = admitted.status === "admitted" ? admitted.asset.byteDigest : "";

    /* ══ 4. THE VIDEO READ MODEL LISTS IT, WITH ITS PROVENANCE ══ */
    const videos = await listArtifactMediaVideos(a.ctx, { artifactIds: [a.draft, other.draft] }, { getDb });
    assert.equal(videos.status, "read");
    const v = videos.status === "read" ? videos.videos : [];
    assert.equal(v.length, 1);
    assert.equal(v[0]!.origin, "generated");
    assert.equal(v[0]!.mediaKind, "video");
    assert.equal(v[0]!.invocationId, invocationId);
    assert.equal(v[0]!.sourceArtifactId, a.draft);
    assert.equal(v[0]!.sourceRevisionNo, 1);
    assert.equal(v[0]!.byteDigest, digest);
    assert.deepEqual(await listArtifactMediaVideos(b.ctx, { artifactIds: [a.draft] }, { getDb }), { status: "read", videos: [] }, "another tenant sees none");
    const play = await readMediaVideo(a.ctx, assetId, {
      getDb,
      resolveStorage: () => ({ status: "available", store: createVpsMediaObjectStore({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret }) }),
    });
    assert.equal(play.status, "read", "the admitted video plays from its authoritative read");
    if (play.status === "read") assert.equal((await fetch(play.access.url, { headers: { range: "bytes=0-1023" } })).status, 206);

    /* ══ 5. REVIEW — the MEDIA-3 authority, unchanged in shape ══ */
    const reviewDeps = { getDb, now: () => NOW } as never;
    assert.deepEqual(
      await acceptMediaAsset(a.ctx, { assetId, byteDigest: "0".repeat(64), justification: REASON }, reviewDeps),
      { status: "refused", reason: "asset-digest-mismatch" },
      "the digest the reviewer was shown binds the decision",
    );
    assert.deepEqual(
      await acceptMediaAsset(b.ctx, { assetId, byteDigest: digest, justification: REASON }, reviewDeps),
      { status: "refused", reason: "asset-unresolvable" },
      "another tenant cannot review it",
    );
    const declined = await declineMediaAsset(a.ctx, { assetId, byteDigest: digest, justification: REASON }, reviewDeps);
    assert.equal(declined.status, "reviewed");
    const accepted = await acceptMediaAsset(a.ctx, { assetId, byteDigest: digest, justification: REASON }, { getDb, now: () => new Date(NOW.getTime() + 1000) } as never);
    assert.equal(accepted.status, "reviewed", "a generated video is reviewed");
    const decision = await one<{ subject_type: string; evidence: Record<string, unknown>; outcome: string }>(
      client,
      `select subject_type, evidence, outcome from decision_records where id=$1`,
      [accepted.status === "reviewed" ? accepted.decisionId : ""],
    );
    assert.equal(decision.subject_type, "media_asset", "the same subject type as an image");
    assert.equal(decision.outcome, "media-asset-accepted");
    assert.equal(decision.evidence.byteDigest, digest);
    assert.equal(decision.evidence.mediaKind, "video", "the evidence names the kind from the row");
    assert.equal(typeof decision.evidence.videoDurationMs, "number");
    const states = await readMediaAssetReviewStates(a.ctx, [assetId], { getDb });
    const st = states.get(assetId);
    assert.equal(st?.status === "read" ? st.decision : null, "accepted", "the latest decision is derived");
    const assetRow = await one<Record<string, unknown>>(client, `select row_to_json(m)::jsonb j from media_assets m where id=$1`, [assetId]);
    assert.ok(assetRow, "review wrote nothing to the asset");

    /* ══ 6. SELECTION — CONTENT-COMPOSE-1, with MEDIA-SELECT-INTEGRITY intact ══ */
    const sel = (t: Tenant, artifactId: string, revisionNo: number) =>
      selectMediaForRevision(t.ctx, { artifactId, revisionNo, mediaAssetId: assetId }, { getDb });
    assert.deepEqual(await sel(b, a.draft, 1), { status: "refused", reason: "revision-unresolvable" }, "cross-tenant");
    assert.deepEqual(await sel(a, other.draft, 1), { status: "refused", reason: "asset-unresolvable" }, "another draft's video is unresolvable");
    assert.deepEqual(await sel(a, a.draft, 7), { status: "refused", reason: "revision-unresolvable" }, "a revision that does not exist");
    assert.deepEqual(await sel(a, a.draft, 1), { status: "selected" }, "a reviewed generated video is selected");
    assert.deepEqual(await sel(a, a.draft, 1), { status: "selected" }, "re-selecting is a no-op");
    assert.equal((await one<{ n: number }>(client, `select count(*)::int n from content_selected_media where media_asset_id=$1`, [assetId])).n, 1);

    /* ══ 7. THE CONTENT PACKAGE REPRESENTS THE VIDEO TRUTHFULLY ══ */
    const pkg = async () => readContentPackage(a.ctx, { artifactId: a.draft, revisionNo: 1 }, { getDb });
    let p1 = await pkg();
    assert.equal(p1.status, "read");
    if (p1.status !== "read") throw new Error("unreachable");
    assert.equal(p1.package.selected.length, 1);
    const s = p1.package.selected[0]!;
    assert.equal(s.mediaKind, "video", "the package says VIDEO, from the row");
    assert.equal(s.mimeType, "video/mp4");
    assert.ok(s.video && s.video.durationMs > 0 && s.video.videoCodec === "h264", "the probed facts ride along");
    assert.equal(s.video?.audioCodec, null, "a silent video is silent, not unknown");
    assert.equal(s.sourceRevisionNo, 1);
    assert.equal(p1.package.mediaReviewStates[assetId], "approved");
    assert.deepEqual([...p1.package.blockers], ["copy-unreviewed"], "the video is judged; the copy is not");
    const revisionId = (await one<{ id: string }>(client, `select id from work_artifact_revisions where artifact_id=$1 and revision_no=1`, [a.draft])).id;
    await acceptArtifactRevision(a.ctx, { artifactId: a.draft, revisionId, justification: REASON }, { getDb, now: () => NOW } as never);
    p1 = await pkg();
    if (p1.status !== "read") throw new Error("unreachable");
    assert.equal(p1.package.ready, true, "a package whose one chosen medium is a reviewed video is READY");
    assert.equal((await readContentPackage(b.ctx, { artifactId: a.draft, revisionNo: 1 }, { getDb })).status, "not-found", "another tenant reads no package");

    /* ══ 8. THE PUBLISH CHAIN STILL REFUSES A VIDEO — fail-closed, not repaired ══ */
    assert.equal(await selectMediaAssetRecord(handle.db, a.tenantId, assetId), null, "the publish inlet's asset read does not return a video");
    assert.deepEqual(
      await derivePublishJpeg(a.ctx, { originalAssetId: assetId }, {
        getDb,
        resolveStorage: () => ({ status: "available", store: createVpsMediaObjectStore({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret }) }),
      }),
      { status: "refused", reason: "source-not-image" },
      "no publish JPEG is derived from a video",
    );

    /* ══ 9. A ROW WHOSE KIND CONTRADICTS ITS INVOCATION IS NOT A SUBJECT ══ */
    {
      const inv = await one<{ id: string }>(
        client,
        `insert into media_generation_invocations
           (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
            source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider,
            model, state, admission_outcome, requested_at, finalized_at)
         select tenant_id, gen_random_uuid(), 'human', requested_by_actor_id, agent_id, source_artifact_id, 1,
                'p', $2, 'fake','fake','fake','provider-succeeded','admitted', now(), now()
           from media_generation_invocations where id=$1 returning id`,
        [invocationId, createHash("sha256").update(randomUUID()).digest("hex")],
      );
      const id = randomUUID();
      const incoherentDigest = createHash("sha256").update(id).digest("hex");
      await client.query(
        `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height,
           storage_backend, storage_key, admitted_at, media_kind, video_container, video_duration_ms, video_codec, video_frame_rate)
         values ($1,$2,$3,'video/mp4',10,$4,640,360,'test-memory',$5, now(),'video','mov,mp4,m4a,3gp,3g2,mj2',2000,'h264','24/1')`,
        [id, a.tenantId, inv.id, incoherentDigest, `tenants/${a.tenantId}/media/${id}`],
      );
      assert.deepEqual(
        await acceptMediaAsset(a.ctx, { assetId: id, byteDigest: incoherentDigest, justification: REASON }, reviewDeps),
        { status: "refused", reason: "asset-kind-incoherent" },
        "a video under an IMAGE invocation is not reviewed",
      );
      assert.deepEqual(
        await selectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 1, mediaAssetId: id }, { getDb }),
        { status: "refused", reason: "asset-kind-incoherent" },
        "nor selected",
      );
    }

    /* ══ 10. DESELECTION leaves the video and its review untouched ══ */
    assert.deepEqual(await deselectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 1, mediaAssetId: assetId }, { getDb }), { status: "deselected" });
    p1 = await pkg();
    if (p1.status !== "read") throw new Error("unreachable");
    assert.deepEqual([...p1.package.blockers], ["no-media-selected"]);
    assert.equal((await one<{ l: string }>(client, `select asset_lifecycle_status l from media_assets where id=$1`, [assetId])).l, "admitted");
  } finally {
    await vps?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log("video-content-chain/chain-postgres: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
