/*
 * MV-5 derivation scenarios, parameterised by the writer module so the SAME claims run against the
 * released writer (derivation-postgres.ts) and against deliberately broken copies (bite-proofs.ts).
 * Real Postgres, the REAL VPS store process (video on) and REAL ffmpeg/ffprobe.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { chmodSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Client } from "pg";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type * as Writer from "../../src/features/media-assets/derive-normalized-video.server";
import { admitSuppliedDriveVideo } from "../../src/features/media-assets/admit-supplied-drive-video.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import type { MediaStorageV2Resolution } from "../../src/features/media-assets/media-storage.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import { derivePublishJpeg } from "../../src/features/media-assets/derive-publish-jpeg.server";
import { selectPublishLineage } from "../../src/features/media-assets/read-publish-derivative.server";
import { selectMediaAssetRecord } from "../../src/features/media-assets/read-media-assets.server";
import type { LocalVpsStore } from "../helpers/media-vps-store-process";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { createFakeMediaGenerationTransport } from "../helpers/media-fakes";
import sharp from "sharp";

type WriterModule = typeof Writer;
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");
export const FFMPEG = process.env.HEBUN_TEST_FFMPEG ?? execFileSync("sh", ["-c", "command -v ffmpeg || true"], { encoding: "utf8" }).trim();
export const FFPROBE = process.env.HEBUN_TEST_FFPROBE ?? execFileSync("sh", ["-c", "command -v ffprobe || true"], { encoding: "utf8" }).trim();

const cache = new Map<string, Uint8Array>();
export function synth(name: string, size: string, audio: boolean, seconds = 2): Uint8Array {
  const hit = cache.get(name);
  if (hit) return hit;
  const dir = mkdtempSync(path.join(tmpdir(), "mv5-fx-"));
  const out = path.join(dir, "x.mp4");
  const argv = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=25:duration=${seconds}`];
  if (audio) argv.push("-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`, "-c:a", "aac");
  argv.push("-c:v", "libx264", "-pix_fmt", "yuv420p", "-brand", "mp42", out);
  execFileSync(FFMPEG, argv);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  cache.set(name, bytes);
  return bytes;
}

export interface Env {
  readonly client: Client;
  readonly getDb: () => ControlPlaneDatabase;
  readonly vps: LocalVpsStore;
  readonly vpsNoVideo: LocalVpsStore;
}

const v1For = (s: LocalVpsStore): MediaStorageResolution => ({
  status: "available",
  store: createVpsMediaObjectStore({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret }),
});
const v2For = (s: LocalVpsStore, fetchImpl?: typeof fetch): MediaStorageV2Resolution => ({
  status: "available",
  client: createVpsMediaStorageV2({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret, fetchImpl }),
});

/** A fetch that edits ONE field of the store's derive answer — a lying or broken store. */
function lyingDerive(edit: (body: Record<string, unknown>) => void): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, init);
    if (!String(input).includes("/v2/derive/") || res.status !== 201) return res;
    const body = (await res.json()) as Record<string, unknown>;
    edit(body);
    return new Response(JSON.stringify(body), { status: 201, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

async function admitVideo(env: Env, t: Tenant, bytes: Uint8Array): Promise<string> {
  const relay = async <T,>(_t: unknown, i: { fileId: string }, consume: (b: ReadableStream<Uint8Array>, m: never) => Promise<T>) => ({
    status: "relayed" as const,
    value: await consume(new Blob([bytes as Uint8Array<ArrayBuffer>]).stream(), { fileId: i.fileId, name: "clip.mp4", providerMimeType: "video/mp4", declaredSize: bytes.byteLength } as never),
    capability: "google.drive.file.content.read" as const,
  });
  const r = await admitSuppliedDriveVideo(t.ctx, { artifactId: t.draft, revisionNo: 1, driveFileId: `1Clip${randomUUID().replace(/-/g, "")}` }, {
    getDb: env.getDb,
    resolveStorageV2: () => v2For(env.vps),
    relayVideo: relay as never,
  });
  assert.equal(r.status, "admitted", `source admitted through MV-3 (${JSON.stringify(r)})`);
  return (r as unknown as { asset: { assetId: string } }).asset.assetId;
}

async function rowOf(client: Client, id: string): Promise<Record<string, unknown>> {
  return (await client.query<{ j: Record<string, unknown> }>(`select row_to_json(m)::jsonb j from media_assets m where id=$1`, [id])).rows[0]!.j;
}
function storedFiles(env: Env, tenantId: string): string[] {
  try {
    return readdirSync(path.join(env.vps.root, "tenants", tenantId, "media")).filter((n) => !n.startsWith(".")).sort();
  } catch {
    return [];
  }
}

export async function runScenarios(mod: WriterModule, env: Env, label: string): Promise<void> {
  const { client, getDb, vps } = env;
  const a = await seedTenant(client, getDb, "Acme");
  const b = await seedTenant(client, getDb, "Beta");
  const deps = (over: Partial<Writer.DeriveNormalizedVideoDeps> = {}): Writer.DeriveNormalizedVideoDeps => ({
    getDb,
    resolveStorage: () => v1For(vps),
    resolveStorageV2: () => v2For(vps),
    ...over,
  });
  const rows = async (sourceId: string) => (await client.query<{ n: number }>(`select count(*)::int n from media_assets where derived_from_asset_id=$1`, [sourceId])).rows[0]!.n;

  const hdBytes = synth("hd", "1280x720", true);
  const hd = await admitVideo(env, a, hdBytes);
  const silent = await admitVideo(env, a, synth("silent", "640x360", false));
  const foreign = await admitVideo(env, b, synth("hd", "1280x720", true));
  const hdBefore = await rowOf(client, hd);

  /* ── 1. an admitted video → a normalized derived video, lineage explicit ── */
  const first = await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: hd }, deps());
  assert.equal(first.status, "derived", `${label}: derived (${JSON.stringify(first)})`);
  const d = (first as { derivative: Writer.NormalizedVideoDerivative }).derivative;
  const dr = await rowOf(client, d.assetId);
  assert.equal(dr.derived_from_asset_id, hd, `${label}: lineage names the source`);
  assert.equal(dr.derivation, "mp4-normalize-v1");
  assert.equal(dr.tenant_id, a.tenantId);
  for (const c of ["invocation_id", "supplied_by_actor_id", "supplied_source", "supplied_artifact_id"]) assert.equal(dr[c], null, `${label}: ${c} NULL on a derivative`);
  assert.deepEqual([dr.media_kind, dr.mime_type, dr.video_codec, dr.audio_codec, dr.width, dr.height], ["video", "video/mp4", "h264", "aac", 1280, 720]);
  assert.equal(dr.asset_lifecycle_status, "admitted");
  const storedBytes = new Uint8Array(readFileSync(path.join(vps.root, dr.storage_key as string)));
  assert.equal(sha(storedBytes), dr.byte_digest, `${label}: row digest = stored bytes`);
  assert.equal(storedBytes.byteLength, dr.byte_size);
  assert.ok(Math.abs((dr.video_duration_ms as number) - (hdBefore.video_duration_ms as number)) <= 250);
  assert.deepEqual(await rowOf(client, hd), hdBefore, `${label}: the source row is identical`);
  assert.equal(sha(new Uint8Array(readFileSync(path.join(vps.root, hdBefore.storage_key as string)))), hdBefore.byte_digest, `${label}: the source bytes are identical`);

  /* ── 2. repeat → the SAME derivative, ffmpeg not run again, source untouched ── */
  const filesBefore = storedFiles(env, a.tenantId);
  const again = await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: hd }, deps());
  assert.equal(again.status, "existing", `${label}: a repeat reuses (${JSON.stringify(again)})`);
  assert.equal((again as { derivative: { assetId: string } }).derivative.assetId, d.assetId);
  assert.deepEqual(storedFiles(env, a.tenantId), filesBefore, `${label}: no new object — the transform did not run again`);
  assert.equal(await rows(hd), 1);
  assert.deepEqual(await rowOf(client, hd), hdBefore);

  /* ── 3. a silent source gets no synthetic audio ── */
  const s = await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: silent }, deps());
  assert.equal(s.status, "derived", `${label}: silent (${JSON.stringify(s)})`);
  assert.equal((s as { derivative: Writer.NormalizedVideoDerivative }).derivative.audioCodec, null);

  /* ── 4. tenant isolation, both directions ── */
  assert.deepEqual(await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: foreign }, deps()), { status: "refused", reason: "source-not-found" }, `${label}: A cannot derive B's video`);
  assert.deepEqual(await mod.deriveNormalizedVideo(b.ctx, { sourceAssetId: hd }, deps()), { status: "refused", reason: "source-not-found" }, `${label}: B cannot derive A's video`);
  assert.equal(await rows(foreign), 0);

  /* ── 5. an image, a derivative, a retired video are refused before any call ── */
  const png = new Uint8Array(await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 9, g: 9, b: 9 } } }).png().toBuffer());
  const gen = await requestMediaGeneration(a.ctx, { artifactId: a.draft, revisionNo: 1, promptText: "An image.", requestKey: randomUUID() }, {
    getDb,
    resolveStorage: () => v1For(vps),
    resolveTransport: () => ({ status: "available", transport: createFakeMediaGenerationTransport({ kind: "bytes", bytes: png }) }),
  });
  assert.equal(gen.status, "admitted");
  const image = (gen as unknown as { assetId: string }).assetId;
  assert.deepEqual(await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: image }, deps()), { status: "refused", reason: "source-not-video" }, `${label}: image source`);
  assert.deepEqual(await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: d.assetId }, deps()), { status: "refused", reason: "source-not-original" }, `${label}: a derivative is not a source`);
  const retired = await admitVideo(env, a, synth("small", "320x240", true, 1));
  await client.query(`update media_assets set asset_lifecycle_status='retired', retired_at=now(), retired_by_actor_id=$2 where id=$1`, [retired, a.ctx.userId]);
  assert.deepEqual(await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: retired }, deps()), { status: "refused", reason: "source-retired" });
  assert.deepEqual(await mod.deriveNormalizedVideo(null, { sourceAssetId: hd }, deps()), { status: "refused", reason: "unauthenticated" });
  assert.deepEqual(await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: "../x" }, deps()), { status: "refused", reason: "invalid-input" });

  /* ── 6. stored source bytes that no longer match the row: refused, nothing derived ── */
  const tampered = await admitVideo(env, a, synth("small2", "320x240", false, 1));
  const tr = await rowOf(client, tampered);
  const tpath = path.join(vps.root, tr.storage_key as string);
  chmodSync(tpath, 0o640);
  writeFileSync(tpath, synth("hd", "1280x720", true));
  chmodSync(tpath, 0o440);
  const tFiles = storedFiles(env, a.tenantId);
  assert.deepEqual(await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: tampered }, deps()), { status: "refused", reason: "source-unavailable" }, `${label}: unverified source`);
  assert.deepEqual(storedFiles(env, a.tenantId), tFiles, "nothing was derived");

  /* ── 7. failures after the store: never a false row ── */
  const fresh = async () => admitVideo(env, a, synth("small", "320x240", true, 1));
  const expectNoRow = async (id: string, r: Writer.DeriveNormalizedVideoResult, reason: string, detail: string | null, why: string) => {
    assert.equal(r.status, "failed", `${label}: ${why} (${JSON.stringify(r)})`);
    assert.equal((r as { reason: string }).reason, reason, `${label}: ${why}`);
    if (detail !== null) assert.equal((r as { detail: string }).detail, detail, `${label}: ${why}`);
    assert.equal(await rows(id), 0, `${label}: ${why} — no Media row`);
  };
  let src = await fresh();
  await expectNoRow(src, await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: src }, deps({ resolveStorageV2: () => v2For(env.vpsNoVideo) })), "derive-failed", null, "store refuses (video off / other store)");
  src = await fresh();
  await expectNoRow(src, await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: src }, deps({ resolveStorageV2: () => v2For(vps, lyingDerive((x) => { x.sha256Hex = "0".repeat(64); })) })), "stored-bytes-mismatch", null, "store lies about the digest");
  src = await fresh();
  await expectNoRow(src, await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: src }, deps({ resolveStorageV2: () => v2For(vps, lyingDerive((x) => { (x.probe as { video: { codec: string } }).video.codec = "hevc"; })) })), "output-rejected", "video-codec-not-h264", "probe says wrong codec");
  src = await fresh();
  await expectNoRow(src, await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: src }, deps({ resolveStorageV2: () => v2For(vps, lyingDerive((x) => { (x.probe as { container: string }).container = "matroska,webm"; })) })), "output-rejected", "not-an-mp4-container", "wrong container");
  src = await fresh();
  await expectNoRow(src, await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: src }, deps({ resolveStorageV2: () => v2For(vps, lyingDerive((x) => { (x.probe as { video: { width: number } }).video.width = 319; })) })), "output-rejected", "dimensions-not-even", "odd width");
  src = await fresh();
  await expectNoRow(src, await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: src }, deps({ resolveStorageV2: () => v2For(vps, lyingDerive((x) => { (x as { probe: { audio: unknown } }).probe.audio = null; })) })), "output-rejected", "audio-track-mismatch", "audio dropped");
  src = await fresh();
  await expectNoRow(src, await mod.deriveNormalizedVideo(a.ctx, { sourceAssetId: src }, deps({ resolveStorageV2: () => v2For(vps, lyingDerive((x) => { (x.probe as { durationSeconds: number }).durationSeconds = 9; })) })), "output-rejected", "duration-drift", "duration drift");

  /* ── 8. the video stays out of every image-only path ── */
  assert.equal((await derivePublishJpeg(a.ctx, { originalAssetId: hd }, { getDb, resolveStorage: () => v1For(vps) })).status, "refused", `${label}: no JPEG from a video`);
  assert.equal((await derivePublishJpeg(a.ctx, { originalAssetId: d.assetId }, { getDb, resolveStorage: () => v1For(vps) })).status, "refused", `${label}: no JPEG from a derived video`);
  assert.equal((await selectPublishLineage(getDb() as never, a.tenantId, { originalAssetId: hd, derivedAssetId: d.assetId } as never)).status, "refused", `${label}: not an Instagram image lineage`);
  assert.equal(await selectMediaAssetRecord(getDb() as never, a.tenantId, d.assetId), null, `${label}: not an image record`);
}
