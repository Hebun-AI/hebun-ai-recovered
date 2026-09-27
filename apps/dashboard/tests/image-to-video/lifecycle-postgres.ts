/*
 * IMAGE → VIDEO — an admitted image as the source of a video, end to end on real Postgres, the real
 * MV-4 lifecycle, the real MV-7 admission (real VPS store + ffprobe) and the released Video Content
 * Chain writers. The provider is simulated: a fake `image` transport whose upload and generation are
 * counted separately.
 *
 * THE CLAIM:
 *
 *   "A supplied or generated admitted image of the caller's tenant is read from the PRIVATE store and
 *    verified (size and SHA-256) BEFORE anything is recorded or sent. The attempt records the MEDIA-5
 *    lineage `source_media_asset_id` and a v4 input identity naming the verified digest. The upload
 *    happens after registration and before the ONE generation POST; any upload refusal leaves the row
 *    `registered` with generation POST = 0. A video, another tenant's image, a missing, retired or
 *    mismatched image, or a URL in place of an id, is refused with nothing written and nothing sent.
 *    Nothing retries; dispatch-unknown stays unknown. The provider's public URL is never persisted.
 *    MV-7 admits the result through the image transport, and the admitted video traces back to its
 *    source image and enters review, selection and the Content Package. Text-to-video is unchanged."
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb, type ControlPlaneDatabase } from "../../src/db/client.server";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { createFakeAsyncVideoTransport, type FakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";
import * as lifecycle from "../../src/features/media-assets/async-generation-lifecycle.server";
import { admitGeneratedVideo } from "../../src/features/media-assets/admit-generated-video.server";
import type {
  MediaAsyncGenerationTransport,
  MediaAsyncGenerationTransportResolution,
  MediaAsyncSourcePreparation,
  MediaAsyncTransportRequest,
  MediaPreparedSourceImage,
} from "../../src/features/media-assets/async-generation-transport";
import { digestImageToVideoInput, digestVideoGenerationInput } from "../../src/features/media-assets/input-digest";
import { mediaAssetStorageKey } from "../../src/features/media-assets/contracts";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { retireMediaAsset } from "../../src/features/media-assets/retire-media-asset.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import type { ProviderHopGet } from "../../src/features/media-assets/provider-output-download.server";
import { listArtifactMediaVideos } from "../../src/features/media-assets/read-media-videos.server";
import { acceptMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import { selectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { readContentPackage } from "../../src/features/content-composition/read-content-package.server";

const FFMPEG = process.env.HEBUN_TEST_FFMPEG ?? execFileSync("sh", ["-c", "command -v ffmpeg || true"], { encoding: "utf8" }).trim();
const FFPROBE = process.env.HEBUN_TEST_FFPROBE ?? execFileSync("sh", ["-c", "command -v ffprobe || true"], { encoding: "utf8" }).trim();
const NOW = new Date("2026-09-27T15:00:00.000Z");
const CDN = "cdn.i2v.test";
const PUBLIC_URL_MARK = "I2V-PROVIDER-PUBLIC-URL-MUST-NOT-PERSIST";
const sha = (b: Uint8Array | string): string => createHash("sha256").update(b).digest("hex");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("image-to-video/lifecycle-postgres: exited before completing");
    process.exitCode = 1;
  }
});

/** A fake IMAGE transport: MV-4's fake plus a counted upload, a source-aware dispatch and an output. */
interface ImageProvider {
  readonly transport: FakeAsyncVideoTransport & MediaAsyncGenerationTransport;
  readonly uploads: { bytesDigest: string; contentType: string }[];
  readonly dispatchedSources: (MediaPreparedSourceImage | undefined)[];
  readonly get: ProviderHopGet;
  uploadAnswer: MediaAsyncSourcePreparation["status"] | "upload-refused" | "upload-unknown";
  output: Uint8Array;
}

function imageProvider(dispatch: "accept" | "unknown" = "accept"): ImageProvider {
  const base = createFakeAsyncVideoTransport(dispatch);
  (base as { model: string }).model = "simulated-image-to-video-v1";
  const originalDispatch = base.dispatch.bind(base);
  const p: ImageProvider = {
    transport: base as ImageProvider["transport"],
    uploads: [],
    dispatchedSources: [],
    uploadAnswer: "prepared",
    output: new Uint8Array(0),
    get: async () => {
      const bytes = p.output;
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
  const t = p.transport as unknown as Record<string, unknown>;
  t.inputMode = "image";
  t.prepareSourceImage = async (input: { bytes: Uint8Array; contentType: string }): Promise<MediaAsyncSourcePreparation> => {
    p.uploads.push({ bytesDigest: sha(input.bytes), contentType: input.contentType });
    if (p.uploadAnswer === "upload-refused" || p.uploadAnswer === "upload-unknown") return { status: "refused", reason: p.uploadAnswer };
    return { status: "prepared", source: Object.freeze({ contentType: input.contentType, byteSize: input.bytes.byteLength, reveal: () => `https://${CDN}/${PUBLIC_URL_MARK}` }) };
  };
  t.dispatch = async (input: Parameters<MediaAsyncGenerationTransport["dispatch"]>[0]) => {
    p.dispatchedSources.push(input.source);
    return originalDispatch(input);
  };
  t.locateOutput = async ({ providerJobId }: { providerJobId: string }) => ({
    status: "located",
    location: Object.freeze({
      shape: Object.freeze({ scheme: "https", hostname: CDN, hasPort: false, hasCredentials: false, queryParameterNames: [], pathSegmentCount: 2, pathExtension: ".mp4" }),
      allowedHosts: [CDN],
      reveal: () => `https://${CDN}/out/${providerJobId}.mp4`,
    }),
  });
  return p;
}

function synthVideo(): Uint8Array {
  const dir = mkdtempSync(path.join(tmpdir(), "i2v-fx-"));
  const out = path.join(dir, "x.mp4");
  execFileSync(FFMPEG, ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=640x360:rate=24:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-brand", "mp42", out]);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

async function one<T>(client: Client, sql: string, args: unknown[] = []): Promise<T> {
  return (await client.query(sql, args)).rows[0] as T;
}

async function main(): Promise<void> {
  assert.ok(FFMPEG && FFPROBE, "ffmpeg and ffprobe are required");
  const harness = createDisposablePostgresHarness("hebun_image_to_video");
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
    const memory = createMemoryMediaObjectStore();
    const resolveStorage = () => ({ status: "available" as const, store: memory });
    const invocations = async () => (await one<{ n: number }>(client, `select count(*)::int n from media_generation_invocations where output_media_kind='video'`)).n;

    /* A SYNTHETIC, non-sensitive source image (Director G2), SUPPLIED into Media for tenant A. */
    const png = new Uint8Array(await sharp({ create: { width: 96, height: 64, channels: 3, background: { r: 30, g: 120, b: 200 } } }).png().toBuffer());
    const suppliedId = randomUUID();
    await client.query(
      `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend,
         storage_key, admitted_at, supplied_by_actor_type, supplied_by_actor_id, supplied_source,
         supplied_source_file_id, supplied_source_capability, supplied_artifact_id, supplied_revision_no)
       values ($1,$2,'image/png',$3,$4,96,64,'test-memory',$5, now(),'human',$6,'google-drive','synthetic-1',
         'google.drive.file.content.read',$7,1)`,
      [suppliedId, a.tenantId, png.byteLength, sha(png), mediaAssetStorageKey(a.tenantId, suppliedId), a.ctx.userId, a.draft],
    );
    memory.objects.set(mediaAssetStorageKey(a.tenantId, suppliedId), { bytes: png, contentType: "image/png" });

    /* A GENERATED source image (MEDIA-5 permits it), made by the released MEDIA-1 path. */
    const imageTransport = createFakeMediaGenerationTransport({ kind: "bytes", bytes: png });
    const genImage = await requestMediaGeneration(
      a.ctx,
      { artifactId: a.draft, revisionNo: 1, promptText: "A synthetic blue tile.", requestKey: randomUUID() },
      { getDb, now: () => NOW, resolveStorage, resolveTransport: () => ({ status: "available", transport: imageTransport }) },
    );
    assert.equal(genImage.status, "admitted");
    const generatedImageId = genImage.status === "admitted" ? genImage.assetId : "";

    const p = imageProvider();
    p.output = synthVideo();
    const asked: (MediaAsyncTransportRequest | undefined)[] = [];
    const deps = (provider: ImageProvider | null = p, textTransport?: MediaAsyncGenerationTransport) => ({
      getDb,
      now: () => NOW,
      resolveStorage,
      resolveTransport: (request?: MediaAsyncTransportRequest): MediaAsyncGenerationTransportResolution => {
        asked.push(request);
        if (request?.inputMode === "image") {
          return provider ? { status: "available", transport: provider.transport } : { status: "unavailable", reason: "video-generation-disabled" };
        }
        return textTransport ? { status: "available", transport: textTransport } : { status: "unavailable", reason: "video-generation-disabled" };
      },
    });
    /* MEDIA-5's own reference edit, for the equivalence proof: it must refuse the same sources the same way. */
    const media5 = (t: Tenant, sourceAssetId: string) =>
      requestMediaGeneration(
        t.ctx,
        { artifactId: t.draft, revisionNo: 1, promptText: "Edit it.", requestKey: randomUUID(), sourceAssetId },
        { getDb, now: () => NOW, resolveStorage, resolveTransport: () => ({ status: "available", transport: imageTransport }) },
      );
    const sameAsMedia5 = async (t: Tenant, id: string, reason: string, label: string) => {
      assert.deepEqual(await media5(t, id), { status: "refused", reason }, `${label}: MEDIA-5 refuses it the same way`);
    };
    const request = (t: Tenant, sourceAssetId: string | null, d = deps(), key = randomUUID()) =>
      lifecycle.requestAsyncVideoGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "A slow push-in on the tile.", requestKey: key, sourceAssetId }, d);

    /* ══ 1. REFUSED BEFORE ANYTHING IS RECORDED OR SENT ══ */
    {
      const videoRow = randomUUID();
      const vInv = await one<{ id: string }>(
        client,
        `insert into media_generation_invocations (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
           source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider, model, state, admission_outcome,
           output_media_kind, provider_job_id, provider_output_ref, requested_at, finalized_at)
         select tenant_id, gen_random_uuid(), 'human', requested_by_actor_id, agent_id, source_artifact_id, 1, 'p', $2, 'fake','fake','fake',
                'provider-succeeded','admitted','video','j','j', now(), now()
           from media_generation_invocations where tenant_id=$1 limit 1 returning id`,
        [a.tenantId, sha(randomUUID())],
      );
      await client.query(
        `insert into media_assets (id, tenant_id, invocation_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key,
           admitted_at, media_kind, video_container, video_duration_ms, video_codec, video_frame_rate)
         values ($1,$2,$3,'video/mp4',10,$4,640,360,'test-memory',$5, now(),'video','mov,mp4,m4a,3gp,3g2,mj2',2000,'h264','24/1')`,
        [videoRow, a.tenantId, vInv.id, sha(videoRow), mediaAssetStorageKey(a.tenantId, videoRow)],
      );
      /* Counted AFTER the fixture invocation above, so only requests are measured. */
      const before = await invocations();
      const cases: [string, Tenant, string, string][] = [
        ["a video is not a source", a, videoRow, "source-asset-not-image"],
        ["another tenant's image", b, suppliedId, "source-asset-unresolvable"],
        ["a missing image", a, randomUUID(), "source-asset-unresolvable"],
        ["a URL in place of an id", a, "https://evil.test/rug.png", "source-asset-unresolvable"],
      ];
      for (const [label, t, id, reason] of cases) {
        assert.deepEqual(await request(t, id), { status: "refused", reason }, label);
        if (!id.startsWith("https://")) await sameAsMedia5(t, id, reason, label);
      }
      /* Mismatched bytes: same row, tampered store object (size), then same size different content (sha). */
      const tamperedId = randomUUID();
      await client.query(
        `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key, admitted_at,
           supplied_by_actor_type, supplied_by_actor_id, supplied_source, supplied_source_file_id, supplied_source_capability, supplied_artifact_id, supplied_revision_no)
         values ($1,$2,'image/png',$3,$4,96,64,'test-memory',$5, now(),'human',$6,'google-drive','synthetic-2','google.drive.file.content.read',$7,1)`,
        [tamperedId, a.tenantId, png.byteLength, sha(png), mediaAssetStorageKey(a.tenantId, tamperedId), a.ctx.userId, a.draft],
      );
      memory.objects.set(mediaAssetStorageKey(a.tenantId, tamperedId), { bytes: png.subarray(0, png.byteLength - 1), contentType: "image/png" });
      assert.deepEqual(await request(a, tamperedId), { status: "refused", reason: "source-asset-unavailable" }, "a byte-size mismatch");
      await sameAsMedia5(a, tamperedId, "source-asset-unavailable", "a byte-size mismatch");
      const flipped = new Uint8Array(png);
      flipped[flipped.length - 5] = flipped[flipped.length - 5]! ^ 0xff;
      memory.objects.set(mediaAssetStorageKey(a.tenantId, tamperedId), { bytes: flipped, contentType: "image/png" });
      assert.deepEqual(await request(a, tamperedId), { status: "refused", reason: "source-asset-unavailable" }, "a SHA-256 mismatch");
      await sameAsMedia5(a, tamperedId, "source-asset-unavailable", "a SHA-256 mismatch");
      assert.equal((await retireMediaAsset(a.ctx, { assetId: tamperedId }, { getDb, now: () => NOW })).status, "retired");
      memory.objects.set(mediaAssetStorageKey(a.tenantId, tamperedId), { bytes: png, contentType: "image/png" });
      assert.deepEqual(await request(a, tamperedId), { status: "refused", reason: "source-asset-retired" }, "a retired image");
      await sameAsMedia5(a, tamperedId, "source-asset-retired", "a retired image");
      assert.deepEqual(await request(a, suppliedId, deps(null)), { status: "refused", reason: "generation-transport-unavailable" }, "image-to-video control OFF");
      assert.equal(await invocations(), before, "nothing was registered");
      assert.equal(p.uploads.length, 0, "nothing was uploaded");
      assert.equal(p.transport.dispatchCalls.length, 0, "generation POST = 0");
    }

    /* ══ 2. AN UPLOAD REFUSAL LEAVES THE ROW REGISTERED, WITH GENERATION POST = 0 ══ */
    for (const answer of ["upload-refused", "upload-unknown"] as const) {
      p.uploadAnswer = answer;
      const r = await request(a, suppliedId);
      assert.equal(r.status, "registered-not-sent", `${answer}: registered, not sent`);
      if (r.status !== "registered-not-sent") throw new Error("unreachable");
      assert.equal(r.reason, answer === "upload-refused" ? "source-upload-refused" : "source-upload-unknown");
      assert.equal((await one<{ state: string }>(client, `select state from media_generation_invocations where id=$1`, [r.invocationId])).state, "registered");
      assert.equal(p.transport.dispatchCalls.length, 0, `${answer}: generation POST = 0`);
      /* A registered image attempt cannot be dispatched without the source prepared for it. */
      assert.deepEqual(await lifecycle.dispatchAsyncMediaGeneration(a.ctx, r.invocationId, deps()), { status: "refused", reason: "source-not-prepared" });
      assert.equal(p.transport.dispatchCalls.length, 0);
    }
    p.uploadAnswer = "prepared";
    const uploadsBefore = p.uploads.length;

    /* ══ 3. THE CHAIN: verify → register (lineage, v4) → upload → ONE POST ══ */
    const key = randomUUID();
    const r = await request(a, suppliedId, deps(), key);
    assert.equal(r.status === "dispatched" && r.state, "provider-pending", JSON.stringify(r));
    const invocationId = r.status === "dispatched" ? r.invocationId : "";
    assert.equal(p.uploads.length, uploadsBefore + 1, "one upload");
    assert.deepEqual(p.uploads.at(-1), { bytesDigest: sha(png), contentType: "image/png" }, "exactly the verified bytes were uploaded");
    assert.equal(p.transport.dispatchCalls.length, 1, "exactly one generation POST");
    assert.ok(p.dispatchedSources.at(-1), "the POST carried the prepared source");
    const row = await one<Record<string, unknown>>(client, `select row_to_json(i)::jsonb j from media_generation_invocations i where id=$1`, [invocationId]).then((x) => (x as { j: Record<string, unknown> }).j);
    assert.equal(row.source_media_asset_id, suppliedId, "MEDIA-5 lineage recorded");
    assert.equal(row.output_media_kind, "video");
    const contentDigest = (await one<{ d: string }>(client, `select content_digest d from work_artifact_revisions where artifact_id=$1 and revision_no=1`, [a.draft])).d;
    assert.equal(
      row.input_digest,
      digestImageToVideoInput({
        promptText: "A slow push-in on the tile.",
        sourceArtifactId: a.draft,
        sourceRevisionNo: 1,
        sourceContentDigest: contentDigest,
        transport: "fake",
        provider: p.transport.provider,
        model: "simulated-image-to-video-v1",
        sourceAsset: { assetId: suppliedId, byteDigest: sha(png) },
      }),
      "v4 identity names the verified source digest",
    );
    assert.ok(!JSON.stringify(row).includes(PUBLIC_URL_MARK), "the provider public URL is not persisted");
    assert.deepEqual(await request(a, suppliedId, deps(), key), { status: "refused", reason: "duplicate-request" }, "the same key registers nothing");
    assert.equal(p.uploads.length, uploadsBefore + 1, "and uploads nothing");
    assert.equal(p.transport.dispatchCalls.length, 1, "and sends nothing — no retry");
    assert.equal(asked.filter((x) => x?.inputMode === "image").length > 0, true, "the image transport was asked for by mode");

    /* A generated image is an eligible source too. */
    const rg = await request(a, generatedImageId);
    assert.equal(rg.status === "dispatched" && rg.state, "provider-pending", "a generated image is a source");
    assert.equal(p.transport.dispatchCalls.length, 2);

    /* dispatch-unknown stays unknown. */
    {
      const u = imageProvider("unknown");
      const ru = await request(a, suppliedId, deps(u));
      assert.equal(ru.status === "dispatched" && ru.state, "dispatch-unknown");
      assert.equal(u.transport.dispatchCalls.length, 1, "one POST, never retried");
    }

    /* ══ 4. PENDING → SUCCEEDED ≠ ADMITTED → MV-7 ADMITS THROUGH THE IMAGE TRANSPORT ══ */
    assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, invocationId, deps()), { status: "observed-pending", state: "provider-pending" });
    p.transport.pollScript.push({ status: "succeeded", outputRef: "sim-i2v-1" });
    assert.deepEqual(await lifecycle.pollAsyncMediaGeneration(a.ctx, invocationId, deps()), { status: "transitioned", from: "provider-pending", state: "provider-succeeded" });
    assert.equal((await one<{ n: number }>(client, `select count(*)::int n from media_assets where invocation_id=$1`, [invocationId])).n, 0, "succeeded is not admitted");
    const admitAsked: (MediaAsyncTransportRequest | undefined)[] = [];
    const admitted = await admitGeneratedVideo(a.ctx, { invocationId }, {
      getDb,
      resolveStorageV2: () => ({ status: "available", client: createVpsMediaStorageV2({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret }) }),
      resolveTransport: (req) => {
        admitAsked.push(req);
        return req?.inputMode === "image" ? { status: "available", transport: p.transport } : { status: "unavailable", reason: "video-generation-disabled" };
      },
      download: { get: p.get },
    });
    assert.equal(admitted.status, "admitted", `MV-7 admits (${JSON.stringify(admitted)})`);
    assert.deepEqual(admitAsked, [{ inputMode: "image" }], "admission asks for the transport the attempt was registered with");
    const videoId = admitted.status === "admitted" ? admitted.asset.assetId : "";
    const lineage = await one<{ source: string }>(
      client,
      `select i.source_media_asset_id source from media_assets m join media_generation_invocations i on i.id=m.invocation_id and i.tenant_id=m.tenant_id where m.id=$1`,
      [videoId],
    );
    assert.equal(lineage.source, suppliedId, "generated video → invocation → source image");
    /* The source bytes live in exactly the three rows this test made (supplied, generated, retired fixture): none was added. */
    assert.equal((await one<{ n: number }>(client, `select count(*)::int n from media_assets where byte_digest=$1`, [sha(png)])).n, 3, "no second copy of the source was written");

    /* ══ 5. THE RESULT ENTERS THE VIDEO CONTENT CHAIN UNCHANGED ══ */
    const listed = await listArtifactMediaVideos(a.ctx, { artifactIds: [a.draft] }, { getDb });
    assert.ok(listed.status === "read" && listed.videos.some((v) => v.assetId === videoId && v.origin === "generated"));
    const digest = admitted.status === "admitted" ? admitted.asset.byteDigest : "";
    assert.equal((await acceptMediaAsset(a.ctx, { assetId: videoId, byteDigest: digest, justification: "Synthetic image-to-video acceptance." }, { getDb, now: () => NOW } as never)).status, "reviewed");
    assert.deepEqual(await selectMediaForRevision(a.ctx, { artifactId: a.draft, revisionNo: 1, mediaAssetId: videoId }, { getDb }), { status: "selected" });
    const pkg = await readContentPackage(a.ctx, { artifactId: a.draft, revisionNo: 1 }, { getDb });
    assert.ok(pkg.status === "read" && pkg.package.selected.some((s) => s.mediaAssetId === videoId && s.mediaKind === "video"));

    /* ══ 6. TEXT-TO-VIDEO IS UNCHANGED ══ */
    {
      const text = createFakeAsyncVideoTransport("accept");
      const rt = await request(a, null, deps(null, text));
      assert.equal(rt.status === "dispatched" && rt.state, "provider-pending");
      const trow = await one<{ source: string | null; digest: string }>(client, `select source_media_asset_id source, input_digest digest from media_generation_invocations where id=$1`, [rt.status === "dispatched" ? rt.invocationId : ""]);
      assert.equal(trow.source, null, "no lineage for text-to-video");
      assert.equal(trow.digest, digestVideoGenerationInput({ promptText: "A slow push-in on the tile.", sourceArtifactId: a.draft, sourceRevisionNo: 1, sourceContentDigest: contentDigest, transport: "fake", provider: text.provider, model: text.model }), "v3 identity unchanged");
      assert.equal(asked.at(-1)?.inputMode, "text");
    }
  } finally {
    await vps?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log("image-to-video/lifecycle-postgres: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
