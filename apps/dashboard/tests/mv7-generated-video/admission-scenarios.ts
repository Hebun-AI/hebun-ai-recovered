/*
 * MV-7 generated-video admission scenarios, parameterised by the writer module so the SAME claims run
 * against the released writer (admission-postgres.ts) and deliberately broken copies
 * (admission-bite-proofs.ts). Real Postgres, the REAL VPS store process (video on), REAL ffprobe, and
 * the REAL MV-4 lifecycle writer producing every `provider-succeeded` row. The provider is simulated:
 * a fake async transport with a `locateOutput`, and an injected hop GET serving the output bytes.
 *
 * THE CLAIM: "Admission is the ONE owner of `admission_outcome` for an async video. It admits only a
 * provider-succeeded, not-attempted invocation of the caller's tenant, through the transport it was
 * registered with, by ONE status re-observation (never a dispatch) and ONE bounded stream relayed into
 * Storage V2, whose measurement must equal the relay's, and whose PROBED facts must pass the MV-3 video
 * policy. The asset and the `admitted` transition commit together or not at all. A verdict about the
 * bytes is recorded; nothing else is. No URL reaches a row, a result or a read. The generated video
 * opens through the Media read model with its invocation as provenance, and plays by signed Range."
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Client } from "pg";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type * as Writer from "../../src/features/media-assets/admit-generated-video.server";
import * as lifecycle from "../../src/features/media-assets/async-generation-lifecycle.server";
import type {
  MediaAsyncGenerationTransport,
  MediaAsyncOutputLocation,
} from "../../src/features/media-assets/async-generation-transport";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import type { MediaStorageV2Resolution } from "../../src/features/media-assets/media-storage.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import type { ProviderHopGet } from "../../src/features/media-assets/provider-output-download.server";
import { readMediaVideo } from "../../src/features/media-assets/read-media-videos.server";
import type { LocalVpsStore } from "../helpers/media-vps-store-process";
import { createFakeAsyncVideoTransport, type FakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { seedTenant, type Tenant } from "../mv4-async-generation/scenarios";

type WriterModule = typeof Writer;
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");
export const FFMPEG = process.env.HEBUN_TEST_FFMPEG ?? execFileSync("sh", ["-c", "command -v ffmpeg || true"], { encoding: "utf8" }).trim();
export const FFPROBE = process.env.HEBUN_TEST_FFPROBE ?? execFileSync("sh", ["-c", "command -v ffprobe || true"], { encoding: "utf8" }).trim();

export const URL_SECRET = "SIGNATURE-VALUE-MV7-NOT-A-TOKEN";
const CDN = "cdn.mv7.test";

const cache = new Map<string, Uint8Array>();
function synth(name: string, codec: "libx264" | "mpeg4", size = "640x360", seconds = 2): Uint8Array {
  const hit = cache.get(name);
  if (hit) return hit;
  const dir = mkdtempSync(path.join(tmpdir(), "mv7-fx-"));
  const out = path.join(dir, "x.mp4");
  const argv = ["-nostdin", "-hide_banner", "-loglevel", "error", "-y", "-f", "lavfi", "-i", `testsrc2=size=${size}:rate=24:duration=${seconds}`];
  argv.push("-f", "lavfi", "-i", `sine=frequency=440:duration=${seconds}`, "-c:a", "aac");
  argv.push("-c:v", codec, "-pix_fmt", "yuv420p", "-brand", "mp42", out);
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

/** A store whose WRITE-V2 answer lies about the digest. */
function lyingPut(): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const res = await fetch(input, init);
    if (!String(input).includes("/v2/objects/") || res.status !== 201) return res;
    const body = (await res.json()) as Record<string, unknown>;
    body.sha256Hex = "0".repeat(64);
    return new Response(JSON.stringify(body), { status: 201, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

/** The simulated provider: MV-4's fake async transport, plus a `locateOutput` and an output server. */
interface Provider {
  readonly transport: FakeAsyncVideoTransport & MediaAsyncGenerationTransport;
  readonly locateCalls: string[];
  readonly served: string[];
  readonly get: ProviderHopGet;
  /** What the next locate answers, and what the served URL returns. */
  answer: MediaAsyncOutputLocation["status"] | "located-unlisted";
  bytes: Uint8Array;
  onServe: (() => Promise<void>) | null;
}

function provider(options: { locate?: boolean; model?: string } = {}): Provider {
  const base = createFakeAsyncVideoTransport("accept");
  const p: Provider = {
    transport: base as Provider["transport"],
    locateCalls: [],
    served: [],
    answer: "located",
    bytes: new Uint8Array(0),
    onServe: null,
    get: async (url) => {
      p.served.push(url.toString());
      if (p.onServe) await p.onServe();
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
  if (options.model) (base as { model: string }).model = options.model;
  if (options.locate !== false) {
    (p.transport as { locateOutput?: MediaAsyncGenerationTransport["locateOutput"] }).locateOutput = async ({ providerJobId }) => {
      p.locateCalls.push(providerJobId);
      const url = `https://${CDN}/out/${providerJobId}.mp4?sig=${URL_SECRET}`;
      const location = (hosts: string[]) => ({
        status: "located" as const,
        location: Object.freeze({
          shape: Object.freeze({ scheme: "https", hostname: CDN, hasPort: false, hasCredentials: false, queryParameterNames: ["sig"], pathSegmentCount: 2, pathExtension: ".mp4" }),
          allowedHosts: hosts,
          reveal: () => url,
        }),
      });
      switch (p.answer) {
        case "located":
          return location([CDN]);
        case "located-unlisted":
          return location([]);
        case "not-located":
          return { status: "not-located", reason: "pending" };
        case "not-found":
          return { status: "not-found" };
        case "unreadable":
          return { status: "unreadable" };
      }
    };
  }
  return p;
}

/** A provider-succeeded invocation, made by the REAL MV-4 writer through the simulated transport. */
async function succeeded(env: Env, t: Tenant, p: Provider): Promise<string> {
  const deps = { getDb: env.getDb, resolveTransport: () => ({ status: "available" as const, transport: p.transport }) };
  const reg = await lifecycle.registerAsyncMediaGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "A rug.", requestKey: randomUUID() }, deps);
  assert.equal(reg.status, "registered");
  const id = (reg as { invocationId: string }).invocationId;
  assert.equal((await lifecycle.dispatchAsyncMediaGeneration(t.ctx, id, deps)).status, "transitioned");
  p.transport.pollScript.push({ status: "succeeded", outputRef: `sim-job-${p.transport.dispatchCalls.length}` });
  const polled = await lifecycle.pollAsyncMediaGeneration(t.ctx, id, deps);
  assert.deepEqual(polled, { status: "transitioned", from: "provider-pending", state: "provider-succeeded" });
  return id;
}

async function pending(env: Env, t: Tenant, p: Provider): Promise<string> {
  const deps = { getDb: env.getDb, resolveTransport: () => ({ status: "available" as const, transport: p.transport }) };
  const reg = await lifecycle.registerAsyncMediaGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "A rug.", requestKey: randomUUID() }, deps);
  const id = (reg as { invocationId: string }).invocationId;
  await lifecycle.dispatchAsyncMediaGeneration(t.ctx, id, deps);
  return id;
}

async function invocation(client: Client, id: string): Promise<Record<string, unknown>> {
  return (await client.query<{ j: Record<string, unknown> }>(`select row_to_json(i)::jsonb j from media_generation_invocations i where id=$1`, [id])).rows[0]!.j;
}
async function assetsOf(client: Client, id: string): Promise<Record<string, unknown>[]> {
  return (await client.query<{ j: Record<string, unknown> }>(`select row_to_json(m)::jsonb j from media_assets m where invocation_id=$1`, [id])).rows.map((r) => r.j);
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
  const good = synth("h264", "libx264");

  const deps = (p: Provider, over: Partial<Writer.AdmitGeneratedVideoDeps> = {}): Writer.AdmitGeneratedVideoDeps => ({
    getDb,
    resolveStorageV2: () => v2For(vps),
    resolveTransport: () => ({ status: "available", transport: p.transport }),
    download: { get: p.get },
    ...over,
  });
  const noUrl = (x: unknown, why: string) => assert.ok(!JSON.stringify(x).includes(URL_SECRET) && !JSON.stringify(x).includes(CDN + "/out"), `${label}: ${why} — no URL`);
  const untouched = async (id: string, why: string) => {
    const r = await invocation(client, id);
    assert.equal(r.admission_outcome, "not-attempted", `${label}: ${why} — admission not recorded`);
    assert.equal(r.admission_failure, null);
    assert.equal((await assetsOf(client, id)).length, 0, `${label}: ${why} — no asset`);
  };

  /* ── 1. a provider-succeeded generation → ONE admitted generated video ── */
  const p = provider();
  p.bytes = good;
  const id = await succeeded(env, a, p);
  const before = await invocation(client, id);
  const dispatchesBefore = p.transport.dispatchCalls.length;
  const r1 = await mod.admitGeneratedVideo(a.ctx, { invocationId: id }, deps(p));
  assert.equal(r1.status, "admitted", `${label}: admitted (${JSON.stringify(r1)})`);
  noUrl(r1, "admitted result");
  assert.equal(p.transport.dispatchCalls.length, dispatchesBefore, `${label}: admission never dispatches`);
  assert.deepEqual(p.locateCalls, [before.provider_output_ref], `${label}: ONE re-observation of the recorded output reference`);
  assert.equal(p.served.length, 1, `${label}: ONE output fetch`);
  const after = await invocation(client, id);
  assert.equal(after.admission_outcome, "admitted", `${label}: the admission transition is recorded`);
  assert.equal(after.admission_failure, null);
  for (const col of ["state", "provider_output_ref", "provider_completed_at", "finalized_at", "poll_count", "provider_job_id"]) {
    assert.deepEqual(after[col], before[col], `${label}: the lifecycle column ${col} is not the admission writer's`);
  }
  const rows = await assetsOf(client, id);
  assert.equal(rows.length, 1, `${label}: exactly one asset for the invocation`);
  const asset = rows[0]!;
  assert.equal(asset.tenant_id, a.tenantId);
  for (const c of ["derived_from_asset_id", "derivation", "supplied_by_actor_id", "supplied_source", "supplied_source_file_id", "supplied_artifact_id"]) {
    assert.equal(asset[c], null, `${label}: ${c} NULL on a generated asset`);
  }
  assert.deepEqual([asset.media_kind, asset.mime_type, asset.video_codec, asset.audio_codec, asset.width, asset.height], ["video", "video/mp4", "h264", "aac", 640, 360]);
  assert.equal(asset.byte_size, good.byteLength);
  assert.equal(asset.byte_digest, sha(good), `${label}: the row digest is the provider bytes' digest`);
  const stored = new Uint8Array(readFileSync(path.join(vps.root, asset.storage_key as string)));
  assert.equal(sha(stored), sha(good), `${label}: the stored bytes are the provider bytes, unmodified`);
  noUrl([before, after, rows], "rows");
  const a1 = (r1 as { asset: Writer.GeneratedVideoAsset }).asset;
  assert.equal(a1.assetId, asset.id);
  assert.equal(a1.invocationId, id);

  /* Playback through the authoritative video read model, by signed Range. */
  const play = await readMediaVideo(a.ctx, a1.assetId, { getDb, resolveStorage: () => v1For(vps) });
  assert.equal(play.status, "read", `${label}: the read model opens a generated video (${JSON.stringify(play)})`);
  if (play.status === "read") {
    assert.equal(play.video.origin, "generated");
    assert.equal(play.video.invocationId, id);
    assert.equal(play.video.sourceArtifactId, a.draft);
    assert.equal(play.video.sourceRevisionNo, 1);
    assert.equal(play.video.suppliedByActorId, null);
    const part = await fetch(play.access.url, { headers: { range: "bytes=100-1099" } });
    assert.equal(part.status, 206, `${label}: signed Range playback`);
    assert.deepEqual(new Uint8Array(await part.arrayBuffer()), good.slice(100, 1100));
  }
  assert.equal((await readMediaVideo(b.ctx, a1.assetId, { getDb, resolveStorage: () => v1For(vps) })).status, "not-found", `${label}: another tenant cannot open it`);

  /* ── 2. a repeat returns the SAME asset: no re-observation, no fetch, no new object ── */
  const files = storedFiles(env, a.tenantId);
  const r2 = await mod.admitGeneratedVideo(a.ctx, { invocationId: id }, deps(p));
  assert.equal(r2.status, "existing", `${label}: repeat is existing (${JSON.stringify(r2)})`);
  assert.equal((r2 as { asset: { assetId: string } }).asset.assetId, a1.assetId);
  assert.equal(p.locateCalls.length, 1, `${label}: a decided admission is not re-observed`);
  assert.equal(p.served.length, 1, `${label}: nor re-fetched`);
  assert.deepEqual(storedFiles(env, a.tenantId), files, `${label}: no new object`);
  assert.equal((await assetsOf(client, id)).length, 1);

  /* ── 3. not provider-succeeded → refused before anything is called ── */
  {
    const q = provider();
    q.bytes = good;
    const pend = await pending(env, a, q);
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: pend }, deps(q));
    assert.deepEqual(r, { status: "refused", reason: "provider-not-succeeded" }, `${label}: a pending job is not admitted`);
    assert.equal(q.locateCalls.length, 0, `${label}: nothing re-observed`);
    await untouched(pend, "pending");
  }

  /* ── 4. tenant isolation ── */
  {
    const q = provider();
    q.bytes = good;
    const mine = await succeeded(env, a, q);
    assert.deepEqual(await mod.admitGeneratedVideo(b.ctx, { invocationId: mine }, deps(q)), { status: "refused", reason: "invocation-not-found" }, `${label}: B cannot admit A's generation`);
    assert.equal(q.locateCalls.length, 0);
    await untouched(mine, "foreign tenant");
    assert.deepEqual(await mod.admitGeneratedVideo(null, { invocationId: mine }, deps(q)), { status: "refused", reason: "unauthenticated" });
    assert.deepEqual(await mod.admitGeneratedVideo(a.ctx, { invocationId: "../x" }, deps(q)), { status: "refused", reason: "invalid-input" });
  }

  /* ── 5. raw output the policy refuses: recorded, no asset, never normalized, never retried ── */
  {
    const q = provider();
    q.bytes = synth("mpeg4", "mpeg4");
    const bad = await succeeded(env, a, q);
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: bad }, deps(q));
    assert.equal(r.status, "not-admitted", `${label}: mpeg4 is refused (${JSON.stringify(r)})`);
    assert.deepEqual([(r as { outcome: string }).outcome, (r as { failure: string }).failure, (r as { detail: string }).detail], ["refused", "video-not-admissible", "video-codec-not-h264"]);
    const row = await invocation(client, bad);
    assert.deepEqual([row.admission_outcome, row.admission_failure, row.state], ["refused", "video-not-admissible", "provider-succeeded"]);
    assert.equal((await assetsOf(client, bad)).length, 0, `${label}: no asset for refused bytes`);
    assert.deepEqual(await mod.admitGeneratedVideo(a.ctx, { invocationId: bad }, deps(q)), { status: "refused", reason: "admission-already-decided", detail: "refused" });
    assert.equal(q.served.length, 1, `${label}: a decided refusal is not fetched again`);
  }

  /* ── 6. bytes ffprobe cannot read → probe-failed, recorded ── */
  {
    const q = provider();
    q.bytes = new Uint8Array(4096).fill(0x41);
    const junk = await succeeded(env, a, q);
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: junk }, deps(q));
    assert.deepEqual(r, { status: "not-admitted", outcome: "refused", failure: "probe-failed", bytesOrphaned: false }, `${label}: unprobeable`);
    assert.equal((await invocation(client, junk)).admission_failure, "probe-failed");
  }

  /* ── 7. 20 MiB + 1 → byte-size-exceeded, recorded; nothing stored ── */
  {
    const q = provider();
    q.bytes = new Uint8Array(20 * 1024 * 1024 + 1);
    const big = await succeeded(env, a, q);
    const filesBefore = storedFiles(env, a.tenantId);
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: big }, deps(q));
    assert.deepEqual(r, { status: "not-admitted", outcome: "refused", failure: "byte-size-exceeded", bytesOrphaned: false }, `${label}: oversize`);
    assert.deepEqual(storedFiles(env, a.tenantId), filesBefore, `${label}: nothing linked for an oversize output`);
    assert.equal((await assetsOf(client, big)).length, 0);
  }

  /* ── 8. no verdict, nothing recorded: host not approved, not located, gone, unreadable ── */
  for (const [answer, expected] of [
    ["located-unlisted", { status: "refused", reason: "download-host-not-allowed" }],
    ["not-located", { status: "refused", reason: "output-not-located", detail: "pending" }],
    ["not-found", { status: "refused", reason: "output-not-located", detail: "not-found" }],
    ["unreadable", { status: "refused", reason: "output-not-located", detail: "unreadable" }],
  ] as const) {
    const q = provider();
    q.bytes = good;
    const inv = await succeeded(env, a, q);
    q.answer = answer;
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q));
    assert.deepEqual(r, expected, `${label}: ${answer}`);
    noUrl(r, answer);
    assert.equal(q.served.length, 0, `${label}: ${answer} — nothing fetched`);
    await untouched(inv, answer);
  }

  /* ── 9. the transport it was registered with, able to locate, and only that ── */
  {
    const q = provider();
    q.bytes = good;
    const inv = await succeeded(env, a, q);
    const other = provider({ model: "some-other-model" });
    assert.deepEqual(await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q, { resolveTransport: () => ({ status: "available", transport: other.transport }) })), { status: "refused", reason: "transport-mismatch" });
    const blind = provider({ locate: false });
    assert.deepEqual(await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q, { resolveTransport: () => ({ status: "available", transport: blind.transport }) })), { status: "refused", reason: "output-location-unsupported" });
    assert.deepEqual(await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q, { resolveTransport: () => ({ status: "unavailable", reason: "no-video-generation-provider" }) })), { status: "refused", reason: "generation-transport-unavailable" });
    assert.deepEqual(await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q, { resolveStorageV2: () => ({ status: "unavailable" }) as never })), { status: "refused", reason: "storage-unavailable" });
    assert.equal(q.locateCalls.length + other.locateCalls.length, 0);
    await untouched(inv, "transport/storage refusals");

    /* A store that refuses video says nothing about the output: nothing recorded. */
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q, { resolveStorageV2: () => v2For(env.vpsNoVideo) }));
    assert.equal(r.status, "refused", `${label}: store refuses video (${JSON.stringify(r)})`);
    assert.equal((r as { reason: string }).reason, "transfer-failed");
    await untouched(inv, "store refusal");
  }

  /* ── 10. a store whose measurement disagrees with the relay → integrity-mismatch, recorded ── */
  {
    const q = provider();
    q.bytes = good;
    const inv = await succeeded(env, a, q);
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q, { resolveStorageV2: () => v2For(vps, lyingPut()) }));
    assert.deepEqual(r, { status: "not-admitted", outcome: "refused", failure: "integrity-mismatch", bytesOrphaned: true }, `${label}: lying store`);
    assert.equal((await assetsOf(client, inv)).length, 0);
  }

  /* ── 11. another writer decides while the bytes flow: the asset and `admitted` commit together or not at all ── */
  {
    const q = provider();
    q.bytes = good;
    const inv = await succeeded(env, a, q);
    q.onServe = async () => {
      await client.query(`update media_generation_invocations set admission_outcome='refused', admission_failure='probe-failed' where id=$1`, [inv]);
    };
    const r = await mod.admitGeneratedVideo(a.ctx, { invocationId: inv }, deps(q));
    assert.deepEqual(r, { status: "refused", reason: "admission-already-decided" }, `${label}: the other verdict stands (${JSON.stringify(r)})`);
    assert.equal((await assetsOf(client, inv)).length, 0, `${label}: no asset without its admission transition`);
    assert.equal((await invocation(client, inv)).admission_outcome, "refused");
  }
}
