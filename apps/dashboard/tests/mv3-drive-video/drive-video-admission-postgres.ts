/*
 * MV-3 — a supplied Google Drive video, streamed into the Hebun media store and admitted into Media.
 *
 * Real Postgres, real migrations, the REAL VPS store process (video enabled, a fake ffprobe that
 * answers from marker bytes), the real storage v2 client and the real Drive relay transport.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "A Drive MP4 is relayed as a stream (never buffered whole) to WRITE-V2 with a required probe; the
 *    store's measured size and SHA-256 must equal the relay's; only MP4 + H.264 + (AAC | no audio)
 *    is admitted, as exactly one supplied `video` row carrying only probed facts. Every refusal —
 *    capability, draft, type, size, probe, codec, container, store disabled — writes no row. The
 *    Google token reaches only Google. A video never enters an image path, plays through the signed
 *    read with HEAD and single Range, and the supplied-image door is unchanged."
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { seedLocalIdentity } from "../helpers/r1-identity-seed";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import {
  admitSuppliedDriveVideo,
  evaluateVideoPolicy,
  mp4MajorBrand,
  type AdmitSuppliedDriveVideoDeps,
} from "../../src/features/media-assets/admit-supplied-drive-video.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import { listRevisionMediaAssets, readMediaAsset } from "../../src/features/media-assets/read-media-assets.server";
import { listRevisionMediaVideos, readMediaVideo } from "../../src/features/media-assets/read-media-videos.server";
import { relayDriveFileVideo } from "../../src/features/provider-google/google-transport.server";
import { derivePublishJpeg } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { selectMediaForRevision } from "../../src/features/content-composition/select-media.server";
import { acceptMediaAsset } from "../../src/features/media-asset-review/review-media-asset.server";
import type { DriveVideoResult } from "../../src/features/provider-google/relay-drive-video.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";
import { asHumanTenantContext } from "../../src/features/auth/tenant/tenant-context";

const sha = (b: Uint8Array | string): string => createHash("sha256").update(b).digest("hex");
const DRIVE_ID = "1VideoFileIdAbCdEfGhIjKlMnOp0123";
const TOKEN = "ya29.TEST-GOOGLE-ACCESS-TOKEN-must-never-leave";
const MiB = 1024 * 1024;

interface Seeded {
  readonly tenantId: string;
  readonly userId: string;
  readonly authIdentityId: string;
  readonly membershipId: string;
  readonly roleId: string;
}

function contextFor(s: Seeded): TenantContext {
  return asHumanTenantContext({
    tenantId: s.tenantId,
    userId: s.userId,
    authIdentityId: s.authIdentityId,
    membershipId: s.membershipId,
    membershipVersion: 1,
    roleId: s.roleId,
    sessionContextId: randomUUID(),
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "mv3-video",
    authenticatedAt: new Date().toISOString(),
  });
}

async function seedDraft(client: Client, tenantId: string, authorId: string): Promise<string> {
  const content = `Draft ${randomUUID()}`;
  const a = await client.query<{ id: string }>(
    `insert into work_artifacts (tenant_id, artifact_type, title, artifact_lifecycle_status, owner_workspace,
       current_revision, intended_destination, created_by, created_by_type)
     values ($1,'content-draft','Draft','draft','operations',1,'instagram',$2,'human') returning id`,
    [tenantId, authorId],
  );
  await client.query(
    `insert into work_artifact_revisions (tenant_id, artifact_id, revision_no, content, content_digest,
       authored_by_actor_type, authored_by_actor_id) values ($1,$2,1,$3,$4,'human',$5)`,
    [tenantId, a.rows[0]!.id, content, sha(content), authorId],
  );
  return a.rows[0]!.id;
}

/* A synthetic ISO-BMFF head + marker bytes the fake ffprobe answers from. Not a playable file. */
function mp4(marker: string, size = 256 * 1024, brand = "isom"): Uint8Array {
  const head = new Uint8Array([0, 0, 0, 0x18, ...Buffer.from(`ftyp${brand}`), 0, 0, 0, 0]);
  const out = new Uint8Array(size);
  out.set(head, 0);
  out.set(Buffer.from(marker), head.length);
  for (let i = head.length + marker.length; i < size; i++) out[i] = (i * 31) & 0xff;
  return out;
}

const FAKE_FFPROBE = (python: string) => `#!${python}
import json, os, sys
fd = int(sys.argv[-1][len("file:/dev/fd/"):])
data = os.read(fd, 64)
if b"BADPROBE" in data:
    sys.exit(1)
video = {"codec_type": "video", "codec_name": "hevc" if b"HEVC" in data else "h264", "width": 1080, "height": 1920, "avg_frame_rate": "30000/1001"}
streams = [video]
if b"OPUS" in data:
    streams.append({"codec_type": "audio", "codec_name": "opus"})
elif b"SILENT" not in data:
    streams.append({"codec_type": "audio", "codec_name": "aac"})
print(json.dumps({"format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2", "duration": "2.500000"}, "streams": streams}))
`;

/** A pull-based source: bytes are produced only as the consumer reads. */
function chunked(bytes: Uint8Array, chunk = 64 * 1024, pulls = { n: 0 }): ReadableStream<Uint8Array> {
  let offset = 0;
  return new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulls.n++;
        if (offset >= bytes.byteLength) return controller.close();
        controller.enqueue(bytes.slice(offset, offset + chunk));
        offset += chunk;
      },
    },
    { highWaterMark: 0 },
  );
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv3-drive-video: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  /* ══ 0. PURE POLICY ══ */
  const probe = (over: object = {}) => ({
    container: "mov,mp4,m4a,3gp,3g2,mj2",
    durationSeconds: 2.5,
    video: { codec: "h264", width: 1080, height: 1920, frameRate: "30000/1001" },
    audio: { codec: "aac" },
    ...over,
  });
  assert.equal(evaluateVideoPolicy(probe(), "isom").status, "admissible");
  assert.equal(evaluateVideoPolicy(probe({ audio: null }), "mp42").status, "admissible", "silent MP4 admissible");
  for (const [p, brand, why] of [
    [probe(), "qt  ", "not-an-mp4-brand"],
    [probe(), null, "not-an-mp4-brand"],
    [probe({ container: "matroska,webm" }), "isom", "not-an-mp4-container"],
    [probe({ video: { codec: "hevc", width: 1, height: 1, frameRate: "25/1" } }), "isom", "video-codec-not-h264"],
    [probe({ audio: { codec: "opus" } }), "isom", "audio-codec-not-aac"],
    [probe({ video: null }), "isom", "no-video-stream"],
    [probe({ video: { codec: "h264", width: 9000, height: 10, frameRate: "25/1" } }), "isom", "frame-size-out-of-bounds"],
    [probe({ video: { codec: "h264", width: 10, height: 10, frameRate: null } }), "isom", "frame-rate-unknown"],
    [probe({ durationSeconds: null }), "isom", "duration-unknown"],
  ] as const) {
    assert.deepEqual(evaluateVideoPolicy(p as never, brand), { status: "refused", detail: why }, why);
  }
  assert.equal(mp4MajorBrand(mp4("x")), "isom");

  /* ══ 1. NO WHOLE-FILE BUFFER, NO TOKEN BEYOND GOOGLE — source guards on the relay path ══ */
  for (const f of [
    "src/features/media-assets/admit-supplied-drive-video.server.ts",
    "src/features/provider-google/relay-drive-video.server.ts",
  ]) {
    const code = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/arrayBuffer\(|Buffer\.concat|\.blob\(|base64/i.test(code), `${f}: never buffers or encodes the whole video`);
  }

  const tools = mkdtempSync(path.join(tmpdir(), "mv3-ffprobe-"));
  const ffprobe = path.join(tools, "ffprobe");
  /* Absolute interpreter: the store runs ffprobe with PATH=/usr/bin:/bin only. */
  writeFileSync(ffprobe, FAKE_FFPROBE(execSync("command -v python3", { encoding: "utf8" }).trim()));
  chmodSync(ffprobe, 0o755);

  const harness = createDisposablePostgresHarness("hebun_mv3_video");
  await harness.createDatabase();
  const setup = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  let vps: LocalVpsStore | null = null;
  let vpsNoVideo: LocalVpsStore | null = null;
  try {
    harness.migrateDatabase();
    await setup.connect();
    vps = await startLocalVpsStore({ HEBUN_MEDIA_STORE_ENABLE_VIDEO: "1", HEBUN_MEDIA_STORE_FFPROBE: ffprobe });
    vpsNoVideo = await startLocalVpsStore();

    const acme = (await seedLocalIdentity(setup, { companyName: "Acme", companySlug: "acme-mv3", email: "a@acme.test" })) as Seeded;
    const globex = (await seedLocalIdentity(setup, { companyName: "Globex", companySlug: "globex-mv3", email: "g@globex.test" })) as Seeded;
    const ctx = contextFor(acme);
    const draft = await seedDraft(setup, acme.tenantId, acme.userId);
    const foreignDraft = await seedDraft(setup, globex.tenantId, globex.userId);

    /* Store traffic is recorded so the token's absence can be proven, not assumed. */
    const storeRequests: { url: string; headers: Record<string, string> }[] = [];
    const recordingFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      storeRequests.push({ url: String(url), headers: Object.fromEntries(new Headers(init?.headers).entries()) });
      return fetch(url, init);
    }) as typeof fetch;
    const v2For = (store: LocalVpsStore) => ({
      status: "available" as const,
      client: createVpsMediaStorageV2({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret, fetchImpl: recordingFetch }),
    });
    const portFor = (store: LocalVpsStore) => ({
      status: "available" as const,
      store: createVpsMediaObjectStore({ origin: store.origin, writeSecret: store.writeSecret, readSecret: store.readSecret }),
    });

    /* The Drive relay, injected: the REAL transport over a fake Google, so the token path is real. */
    const googleCalls: { url: string; auth: string | null }[] = [];
    const driveServes = (bytes: Uint8Array, meta: { mimeType?: string; size?: string } = {}) =>
      (async (url: string | URL | Request, init?: RequestInit) => {
        const u = String(url);
        googleCalls.push({ url: u, auth: new Headers(init?.headers).get("authorization") });
        if (!u.startsWith("https://www.googleapis.com/")) throw new Error("the Google token must only go to Google");
        if (u.includes("alt=media")) return new Response(chunked(bytes), { status: 200 });
        return Response.json({ id: DRIVE_ID, name: "clip.mp4", mimeType: meta.mimeType ?? "video/mp4", size: meta.size ?? String(bytes.byteLength), trashed: false });
      }) as typeof fetch;
    const relayWith =
      (bytes: Uint8Array, meta: { mimeType?: string; size?: string } = {}) =>
      async <T,>(_t: TenantContext, i: { fileId: string }, consume: (b: ReadableStream<Uint8Array>, m: never) => Promise<T>): Promise<DriveVideoResult<T>> => {
        const r = await relayDriveFileVideo(TOKEN, i.fileId, consume as never, { fetchImpl: driveServes(bytes, meta) });
        return r.ok ? { status: "relayed", value: r.value as T, capability: "google.drive.file.content.read" } : { status: "provider-failed", failure: r.failure, reason: r.reason };
      };
    const deps = (bytes: Uint8Array, over: Partial<AdmitSuppliedDriveVideoDeps> = {}, meta = {}): AdmitSuppliedDriveVideoDeps => ({
      getDb,
      resolveStorageV2: () => v2For(vps!),
      relayVideo: relayWith(bytes, meta) as never,
      ...over,
    });
    const rows = async () => (await setup.query<{ n: number }>(`select count(*)::int n from media_assets`)).rows[0]!.n;
    const input = { artifactId: draft, revisionNo: 1, driveFileId: DRIVE_ID };

    /* ══ 2. EVERY REFUSAL WRITES NO ROW ══ */
    const refusals: [string, Uint8Array, Partial<AdmitSuppliedDriveVideoDeps>, object, string, string?][] = [
      ["unsupported codec", mp4("HEVC"), {}, {}, "video-not-admissible", "video-codec-not-h264"],
      ["unsupported audio", mp4("OPUS"), {}, {}, "video-not-admissible", "audio-codec-not-aac"],
      ["quicktime brand", mp4("x", 128 * 1024, "qt  "), {}, {}, "video-not-admissible", "not-an-mp4-brand"],
      ["probe failure", mp4("BADPROBE"), {}, {}, "probe-failed"],
      ["unsupported Drive MIME", mp4("x"), {}, { mimeType: "video/quicktime" }, "drive-read-failed", "google-file-type-unsupported"],
      ["declared oversize", mp4("x"), {}, { size: String(21 * MiB) }, "byte-size-exceeded"],
      ["streamed oversize", mp4("x", 20 * MiB + 1), {}, { size: "1" }, "byte-size-exceeded"],
      ["video storage disabled", mp4("x"), { resolveStorageV2: () => v2For(vpsNoVideo!) }, {}, "storage-write-failed", "store-415"],
      ["storage not connected", mp4("x"), { resolveStorageV2: () => ({ status: "unavailable", reason: "storage-not-connected" }) }, {}, "storage-unavailable"],
    ];
    for (const [label, bytes, over, meta, reason, detail] of refusals) {
      const before = await rows();
      const r = await admitSuppliedDriveVideo(ctx, input, deps(bytes, over, meta));
      assert.equal(r.status, "refused", label);
      if (r.status === "refused") {
        assert.equal(r.reason, reason, label);
        if (detail) assert.equal(r.detail, detail, label);
      }
      assert.equal(await rows(), before, `${label}: no Media row`);
    }
    /* The store's measurement must be the relay's: a store answer that disagrees admits nothing. */
    const lyingFetch = (async (url: string | URL | Request, init?: RequestInit) => {
      const res = await fetch(url, init);
      if (!String(url).includes("/v2/objects/") || res.status !== 201) return res;
      const body = (await res.json()) as Record<string, unknown>;
      return Response.json({ ...body, sha256Hex: sha("not what was relayed") }, { status: 201 });
    }) as typeof fetch;
    {
      const before = await rows();
      const r = await admitSuppliedDriveVideo(ctx, { ...input, driveFileId: "1MismatchClip00000000000000000000" }, deps(mp4("x"), {
        resolveStorageV2: () => ({ status: "available", client: createVpsMediaStorageV2({ origin: vps!.origin, writeSecret: vps!.writeSecret, readSecret: vps!.readSecret, fetchImpl: lyingFetch }) }),
      }));
      assert.deepEqual(r, { status: "refused", reason: "integrity-mismatch" }, "relay/store disagreement");
      assert.equal(await rows(), before);
    }
    /* The relay's own ceiling holds even against a store that would accept anything. */
    {
      const before = await rows();
      let drained = 0;
      const drainingClient = {
        async putStream(i: { body: ReadableStream<Uint8Array> }) {
          const h = createHash("sha256");
          let n = 0;
          for await (const c of i.body as unknown as AsyncIterable<Uint8Array>) {
            n += c.byteLength;
            drained = n;
            h.update(c);
          }
          return { byteSize: n, sha256Hex: h.digest("hex"), probe: probe() };
        },
      };
      const r = await admitSuppliedDriveVideo(ctx, { ...input, driveFileId: "1OverrunClip000000000000000000000" }, deps(mp4("x", 20 * MiB + 1), {
        resolveStorageV2: () => ({ status: "available", client: drainingClient as never }),
      }, { size: "1" }));
      assert.deepEqual(r, { status: "refused", reason: "byte-size-exceeded" }, "relay ceiling");
      assert.ok(drained <= 20 * MiB, `the relay cut the stream at the ceiling (${drained} bytes passed)`);
      assert.equal(await rows(), before);
    }
    /* Capability and tenant refusals never reach Drive or the store. */
    const reached = storeRequests.length;
    const capRefused = await admitSuppliedDriveVideo(ctx, input, deps(mp4("x"), { relayVideo: (async () => ({ status: "refused", reason: "capability-not-available" })) as never }));
    assert.deepEqual(capRefused, { status: "refused", reason: "drive-capability-not-available", detail: "capability-not-available" });
    const unauthorizedFile = await admitSuppliedDriveVideo(ctx, input, deps(mp4("x"), { relayVideo: (async () => ({ status: "provider-failed", failure: "authorization", reason: "google-file-not-found" })) as never }));
    assert.deepEqual(unauthorizedFile, { status: "refused", reason: "drive-read-failed", detail: "google-file-not-found" }, "a file Drive will not serve (not Picker-granted) is refused");
    assert.deepEqual(await admitSuppliedDriveVideo(ctx, { ...input, artifactId: foreignDraft }, deps(mp4("x"))), { status: "refused", reason: "source-revision-unresolvable" }, "another tenant's draft");
    assert.deepEqual(await admitSuppliedDriveVideo(null, input, deps(mp4("x"))), { status: "refused", reason: "unauthenticated" });
    assert.equal(storeRequests.length, reached, "no refused-before-relay supply reached the store");
    assert.equal(await rows(), 0);

    /* ══ 3. A VALID MP4: STREAMED, MEASURED, PROBED, ADMITTED — ONE ROW OF PROBED FACTS ══ */
    const clip = mp4("OK", 3 * MiB);
    const pulls = { n: 0 };
    const streamingRelay = async <T,>(_t: TenantContext, _i: unknown, consume: (b: ReadableStream<Uint8Array>, m: never) => Promise<T>): Promise<DriveVideoResult<T>> => ({
      status: "relayed",
      value: await consume(chunked(clip, 64 * 1024, pulls), { fileId: DRIVE_ID, name: "a.mp4", providerMimeType: "video/mp4", declaredSize: null } as never),
      capability: "google.drive.file.content.read",
    });
    const ok = await admitSuppliedDriveVideo(ctx, input, deps(clip, { relayVideo: streamingRelay as never }));
    assert.equal(ok.status, "admitted", JSON.stringify(ok));
    assert.ok(pulls.n >= 48, `the Drive body was pulled incrementally (${pulls.n} pulls of 64 KiB)`);
    const put = storeRequests.find((r) => r.url.includes("/v2/objects/"));
    assert.ok(put && put.headers["x-hebun-probe"] === "required", "WRITE-V2 with a required probe");
    assert.equal(put!.headers["content-length"], undefined, "streamed without a declared length (chunked)");
    const row = (await setup.query(`select * from media_assets where id=$1`, [ok.status === "admitted" ? ok.asset.assetId : ""])).rows[0];
    assert.deepEqual(
      {
        kind: row.media_kind, mime: row.mime_type, size: row.byte_size, digest: row.byte_digest, w: row.width, h: row.height,
        container: row.video_container, ms: row.video_duration_ms, vc: row.video_codec, ac: row.audio_codec, fps: row.video_frame_rate,
        inv: row.invocation_id, derived: row.derived_from_asset_id, source: row.supplied_source, file: row.supplied_source_file_id,
        cap: row.supplied_source_capability, by: row.supplied_by_actor_id,
      },
      {
        kind: "video", mime: "video/mp4", size: clip.byteLength, digest: sha(clip), w: 1080, h: 1920,
        container: "mov,mp4,m4a,3gp,3g2,mj2", ms: 2500, vc: "h264", ac: "aac", fps: "30000/1001",
        inv: null, derived: null, source: "google-drive", file: DRIVE_ID, cap: "google.drive.file.content.read", by: acme.userId,
      },
      "exactly the probed facts, supplied provenance, no generation provenance",
    );
    assert.equal(await rows(), 1, "exactly one row");

    /* Idempotent: the same supply is the same asset. */
    const again = await admitSuppliedDriveVideo(ctx, input, deps(clip));
    assert.equal(again.status, "existing");
    assert.equal(await rows(), 1);

    /* Silent MP4. */
    const silent = await admitSuppliedDriveVideo(ctx, { ...input, driveFileId: "1SilentClip000000000000000000000" }, deps(mp4("SILENT")));
    assert.equal(silent.status, "admitted");
    if (silent.status === "admitted") assert.equal(silent.asset.audioCodec, null, "silent video admitted with no audio codec");
    assert.equal(await rows(), 2);

    /* ══ 4. THE GOOGLE TOKEN WENT ONLY TO GOOGLE ══ */
    assert.ok(googleCalls.length > 0 && googleCalls.every((c) => c.url.startsWith("https://www.googleapis.com/") && c.auth === `Bearer ${TOKEN}`));
    for (const r of storeRequests) {
      assert.ok(!JSON.stringify(r).includes(TOKEN) && !r.headers.authorization, "no Google credential in any store request");
    }

    /* ══ 5. A VIDEO NEVER ENTERS AN IMAGE PATH ══ */
    const videoId = ok.status === "admitted" ? ok.asset.assetId : "";
    const portDeps = { getDb, resolveStorage: () => portFor(vps!) };
    assert.deepEqual(await derivePublishJpeg(ctx, { originalAssetId: videoId }, portDeps), { status: "refused", reason: "source-not-image" });
    assert.equal((await selectMediaForRevision(ctx, { artifactId: draft, revisionNo: 1, mediaAssetId: videoId }, { getDb })).status, "refused");
    assert.equal((await acceptMediaAsset(ctx, { assetId: videoId, byteDigest: sha(clip), justification: "x".repeat(40) } as never, { getDb } as never)).status, "refused");
    assert.equal((await readMediaAsset(ctx, videoId, portDeps)).status, "not-found", "the image read model never returns a video");
    const images = await listRevisionMediaAssets(ctx, { artifactId: draft, revisionNo: 1 }, portDeps);
    assert.ok(images.status === "read" && images.assets.length === 0, "no video in the image listing");

    /* ══ 6. PLAYBACK: VERIFIED SIGNED READ, HEAD, SINGLE RANGE ══ */
    const listed = await listRevisionMediaVideos(ctx, { artifactId: draft, revisionNo: 1 }, { getDb });
    assert.ok(listed.status === "read" && listed.videos.length === 2 && listed.videos.every((v) => v.mediaKind === "video"));
    const foreign = await listRevisionMediaVideos(contextFor(globex), { artifactId: draft, revisionNo: 1 }, { getDb });
    assert.ok(foreign.status === "read" && foreign.videos.length === 0, "another tenant lists nothing");
    assert.equal((await readMediaVideo(contextFor(globex), videoId, portDeps)).status, "not-found", "another tenant cannot open it");
    const play = await readMediaVideo(ctx, videoId, portDeps);
    assert.equal(play.status, "read");
    if (play.status === "read") {
      assert.ok(!play.access.url.includes(TOKEN));
      const head = await fetch(play.access.url, { method: "HEAD" });
      assert.equal(head.status, 200);
      assert.equal(head.headers.get("content-length"), String(clip.byteLength));
      assert.equal(head.headers.get("accept-ranges"), "bytes");
      const part = await fetch(play.access.url, { headers: { range: "bytes=1000-1999" } });
      assert.equal(part.status, 206);
      assert.deepEqual(new Uint8Array(await part.arrayBuffer()), clip.slice(1000, 2000));
      assert.equal((await fetch(play.access.url, { headers: { range: `bytes=${clip.byteLength}-` } })).status, 416);
      assert.equal((await fetch(play.access.url.replace(/sig=[0-9a-f]+/, "sig=" + "0".repeat(64)), { headers: { range: "bytes=0-9" } })).status, 403);
    }
  } finally {
    await setup.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await vps?.dispose();
    await vpsNoVideo?.dispose();
    await harness.dropDatabase();
    rmSync(tools, { recursive: true, force: true });
  }

  finished = true;
  console.log("mv3-drive-video: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
