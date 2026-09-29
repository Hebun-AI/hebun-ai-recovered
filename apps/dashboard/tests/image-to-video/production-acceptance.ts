/*
 * IMAGE → VIDEO — the PRODUCTION acceptance harness, behind a FAKE Higgsfield (API, presigned storage
 * and output host all simulated), on a DISPOSABLE Postgres and the real local store, through the
 * RELEASED writers and the REAL Higgsfield image transport. No request leaves the process.
 *
 * THE CLAIM: "The harness is an orchestrator. It refuses to start without the exact confirmation, and
 * a valid stage stops at its missing target file. The guard lets at most one upload preparation, one
 * PUT and one generation POST leave. With the image control OFF or no credential nothing is
 * registered and nothing is called. A wrong-tenant, non-image or mismatched source reaches no provider
 * at all. DATA-USE-MEDIA-GUARD-1: with the control ON and a credential present, the synthetic supplied
 * source is still refused at the data-use gate — no recorded decision covers Higgsfield image-to-video —
 * so no provider behaviour is ever reached and nothing is registered. No URL reaches the report."
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import {
  HIGGSFIELD_OUTPUT_HOSTS,
  HIGGSFIELD_UPLOAD_PREPARE_URL,
  createHiggsfieldVideoTransport,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { resolveLiveVideoGenerationTransport } from "../../src/features/media-generation-live/live-video-generation-resolver.server";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { mediaAssetStorageKey } from "../../src/features/media-assets/contracts";
import {
  I2V_PRODUCTION_CONFIRMATION,
  I2V_PRODUCTION_PROMPT,
  guardImageToVideoFetch,
  runImageToVideoAcceptance,
} from "../../scripts/lib/i2v-production-acceptance";
import { seedTenant } from "../mv4-async-generation/scenarios";

const API_KEY = "hf-test-opaque-key-not-real:0078-qqqqqqqqqqqqqqqq";
const API = "https://api.higgsfield.ai";
const UPLOAD = "https://storage.i2v-accept.test/put?X-Amz-Signature=UPLOAD-SECRET";
const PUBLIC = "https://uploads.i2v-accept.test/PUBLIC-SECRET.png";
const OUT_SECRET = "hidden-output-segment-i2v";
const APPROVED = HIGGSFIELD_OUTPUT_HOSTS[0]!;
const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("image-to-video/production-acceptance: exited before completing");
    process.exitCode = 1;
  }
});

function synthH264(): Uint8Array {
  const ffmpeg = execFileSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).trim();
  const dir = mkdtempSync(path.join(tmpdir(), "i2vp-"));
  const out = path.join(dir, "x.mp4");
  execFileSync(ffmpeg, ["-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=24:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-an", "-brand", "isom", out]);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

type Answer = { status: number; body?: unknown };

/** A fake Higgsfield: prepare → grant; PUT → 200; generation POST → queued; status → scripted. */
function provider(options: { prepare?: Answer; put?: Answer; status?: (id: string) => Answer } = {}) {
  const id = randomUUID();
  const inner = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    let a: Answer;
    if (url === HIGGSFIELD_UPLOAD_PREPARE_URL) {
      a = options.prepare ?? { status: 200, body: { public_url: PUBLIC, upload_url: UPLOAD, content_type: "image/png", upload_headers: { "Content-Type": "image/png", "x-amz-tagging": "retention=temporary" } } };
    } else if (url === UPLOAD) a = options.put ?? { status: 200 };
    else if (method === "POST") a = { status: 200, body: { status: "queued", request_id: id } };
    else a = (options.status ?? ((rid) => ({ status: 200, body: { status: "completed", request_id: rid, video: { url: `https://${APPROVED}/${OUT_SECRET}/o.mp4` } } })))(id);
    return new Response(a.body === undefined ? null : JSON.stringify(a.body), { status: a.status });
  }) as typeof fetch;
  const guard = guardImageToVideoFetch(inner, API, "https://store.never.test");
  const transport = createHiggsfieldVideoTransport({
    credential: { apiKey: API_KEY },
    profile: "pixverse-v6-image-to-video",
    spendBudget: createLiveSpendBudget(1),
    fetchImpl: guard.fetchImpl as never,
    uploadFetchImpl: guard.fetchImpl as never,
  });
  return { id, guard, transport };
}

async function main(): Promise<void> {
  /* ── 1. the guard: one of each provider write; a second of any is refused before sending ── */
  {
    const sent: string[] = [];
    const g = guardImageToVideoFetch((async (i: RequestInfo | URL, init?: RequestInit) => { sent.push(`${init?.method ?? "GET"} ${String(i)}`); return new Response("{}"); }) as typeof fetch, API, "https://store.example.test");
    await g.fetchImpl(HIGGSFIELD_UPLOAD_PREPARE_URL, { method: "POST" });
    await assert.rejects(g.fetchImpl(HIGGSFIELD_UPLOAD_PREPARE_URL, { method: "POST" }));
    await g.fetchImpl(UPLOAD, { method: "PUT" });
    await assert.rejects(g.fetchImpl("https://elsewhere.test/put", { method: "PUT" }));
    await g.fetchImpl(`${API}/pixverse/v6/image-to-video`, { method: "POST" });
    await assert.rejects(g.fetchImpl(`${API}/pixverse/v6/image-to-video`, { method: "POST" }));
    await g.fetchImpl(`${API}/requests/x/status`, { method: "GET" });
    await g.fetchImpl("https://store.example.test/v2/objects/k", { method: "PUT" });
    assert.deepEqual(g.counts, { uploadPreparations: 1, uploadPuts: 1, generationPosts: 1, providerGets: 1, refused: 3 });
    assert.equal(sent.filter((s) => !s.startsWith("GET")).length, 4, "three provider writes and one store write left; the three seconds never did");
  }

  /* ── 2. CLI refusals, before any file is read; and what the harness text may not do ── */
  {
    const cli = (args: string[]) =>
      spawnSync(process.execPath, ["--import", "tsx", "scripts/i2v-production-acceptance.ts", ...args], {
        encoding: "utf8",
        env: { ...process.env, I2V_DB_ENV_FILE: "", I2V_STORE_ENV_FILE: "", MV6_HIGGSFIELD_ENV_FILE: "/nonexistent" },
      });
    const S = randomUUID();
    const A = randomUUID();
    for (const args of [
      [],
      ["run", "--source", S, "--artifact", A, "--revision", "1"],
      ["run", "--source", S, "--artifact", A, "--revision", "1", "--confirm-one-billable-pixverse-job"],
      ["run", "--source", "x", "--artifact", A, "--revision", "1", I2V_PRODUCTION_CONFIRMATION],
      ["preflight", "--artifact", A, "--revision", "1"],
      ["backup", "extra"],
      ["generate"],
    ]) {
      const r = cli(args);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /^REFUSED: usage/m, `usage refusal: ${args.join(" ")}`);
    }
    assert.match(cli(["preflight", "--source", S, "--artifact", A, "--revision", "1"]).stderr, /REFUSED: I2V_DB_ENV_FILE is not set/);
    const text = readFileSync("scripts/i2v-production-acceptance.ts", "utf8") + readFileSync("scripts/lib/i2v-production-acceptance.ts", "utf8");
    assert.ok(!/reveal\(|console\.[a-z]+\([^)]*(apiKey|access\.url|publicUrl|uploadUrl)|setProviderConnectivity|provider_connectivity_controls\s+set|insert into|update media_/i.test(text), "no URL revealed, no key printed, no control or row written");
    assert.ok(!/profile:/.test(text), "the harness names no profile: the resolver's image request decides");
    assert.equal(I2V_PRODUCTION_PROMPT, "A slow camera push-in with soft natural light.");
  }

  const harness = createDisposablePostgresHarness("hebun_i2v_production_harness");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  let vps: LocalVpsStore | undefined;
  try {
    harness.migrateDatabase();
    await client.connect();
    const ffprobe = execFileSync("sh", ["-c", "command -v ffprobe"], { encoding: "utf8" }).trim();
    const ffmpeg = execFileSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).trim();
    vps = await startLocalVpsStore({ HEBUN_MEDIA_STORE_ENABLE_VIDEO: "1", HEBUN_MEDIA_STORE_FFPROBE: ffprobe, HEBUN_MEDIA_STORE_FFMPEG: ffmpeg });
    const s = vps;
    const getDb = () => handle.db;
    const t = await seedTenant(client, getDb, "Turkish Rug House");
    const other = await seedTenant(client, getDb, "Other");
    const v1 = () => ({ status: "available" as const, store: createVpsMediaObjectStore({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret }) });

    /* A synthetic source, SUPPLIED into Media (the MEDIA-SUPPLIED row shape), bytes in the real store. */
    const supply = async (tenantId: string, userId: string, draft: string, bytes: Uint8Array, storeBytes = bytes): Promise<string> => {
      const id = randomUUID();
      const key = mediaAssetStorageKey(tenantId, id);
      await v1().store.put({ key, bytes: storeBytes, contentType: "image/png", sha256Hex: sha(storeBytes) });
      await client.query(
        `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key, admitted_at,
           supplied_by_actor_type, supplied_by_actor_id, supplied_source, supplied_source_file_id, supplied_source_capability, supplied_artifact_id, supplied_revision_no)
         values ($1,$2,'image/png',$3,$4,1280,720,'hebun-vps',$5, now(),'human',$6,'google-drive',$7,'google.drive.file.content.read',$8,1)`,
        [id, tenantId, bytes.byteLength, sha(bytes), key, userId, `synthetic-${id.slice(0, 6)}`, draft],
      );
      return id;
    };
    const png = new Uint8Array(await sharp({ create: { width: 1280, height: 720, channels: 3, background: { r: 230, g: 230, b: 225 } } }).png().toBuffer());
    const sourceId = await supply(t.tenantId, t.ctx.userId, t.draft, png);
    const foreignId = await supply(other.tenantId, other.ctx.userId, other.draft, png);
    const tampered = new Uint8Array(png);
    tampered[tampered.length - 9] = tampered[tampered.length - 9]! ^ 0xff;
    const mismatchId = await supply(t.tenantId, t.ctx.userId, t.draft, png, tampered);

    const video = synthH264();
    const served: string[] = [];
    const base = {
      tenant: t.ctx,
      artifactId: t.draft,
      revisionNo: 1,
      promptText: I2V_PRODUCTION_PROMPT,
      getDb,
      resolveStorageV1: v1,
      resolveStorageV2: () => ({ status: "available" as const, client: createVpsMediaStorageV2({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret }) }),
      countMediaAssets: async () => (await client.query<{ n: number }>("select count(*)::int n from media_assets")).rows[0]!.n,
      invocationRow: async (id: string) => (await client.query<{ j: Record<string, unknown> }>("select to_jsonb(i) j from media_generation_invocations i where id=$1", [id])).rows[0]?.j ?? null,
      assetRows: async (id: string) => (await client.query<{ j: Record<string, unknown> }>("select to_jsonb(m) j from media_assets m where invocation_id=$1", [id])).rows.map((r) => r.j),
      download: { get: async (url: URL) => { served.push(url.hostname); return { status: 200, headers: {}, body: new Blob([video as Uint8Array<ArrayBuffer>]).stream() }; } },
      sleep: async () => undefined,
    };
    const invocations = async () => (await client.query<{ n: number }>("select count(*)::int n from media_generation_invocations where output_media_kind='video'")).rows[0]!.n;
    const noUrl = (r: unknown, why: string) => {
      const j = JSON.stringify(r);
      for (const secret of ["UPLOAD-SECRET", "PUBLIC-SECRET", OUT_SECRET, API_KEY]) assert.ok(!j.includes(secret), `${why}: no ${secret} in the report`);
    };

    /* ── 3. control OFF, and no credential → nothing registered, nothing called ── */
    {
      const off = await runImageToVideoAcceptance({ ...base, sourceAssetId: sourceId, requestKey: randomUUID(), resolveTransport: async () => ({ status: "unavailable", reason: "video-generation-disabled" }) });
      assert.deepEqual([off.stop, off.detail], ["transport-unavailable", "video-generation-disabled"]);
      const env = { HEBUN_VIDEO_GENERATION_TRANSPORT: "live" };
      const nokey = await runImageToVideoAcceptance({ ...base, sourceAssetId: sourceId, requestKey: randomUUID(), resolveTransport: () => resolveLiveVideoGenerationTransport({ env, resolveDirectorEnabled: async () => true }, { inputMode: "image" }) });
      assert.deepEqual([nokey.stop, nokey.detail], ["transport-unavailable", "video-generation-misconfigured"], "credential missing fails closed");
      assert.equal(await invocations(), 0);
    }

    /* ── 4. wrong tenant, non-image, mismatched bytes → all provider calls 0 ── */
    {
      for (const [label, id, reason] of [
        ["another tenant's image", foreignId, "source-asset-unresolvable"],
        ["mismatched bytes", mismatchId, "source-asset-unavailable"],
        ["a missing asset", randomUUID(), "source-asset-unresolvable"],
      ] as const) {
        const p = provider();
        const r = await runImageToVideoAcceptance({ ...base, sourceAssetId: id, requestKey: randomUUID(), resolveTransport: async () => ({ status: "available", transport: p.transport }) });
        assert.deepEqual([r.stop, r.detail], ["not-dispatched", reason], label);
        assert.deepEqual(p.guard.counts, { uploadPreparations: 0, uploadPuts: 0, generationPosts: 0, providerGets: 0, refused: 0 }, `${label}: no provider call`);
      }
      assert.equal(await invocations(), 0, "nothing registered");
    }

    /*
     * ── 5. DATA-USE-MEDIA-GUARD-1: the production harness now stops at the data-use gate ──
     *
     * No recorded data-use decision covers Higgsfield image-to-video (Director G2: real company/customer
     * images are not authorized; provenance cannot tell this synthetic supplied PNG from a real photo,
     * and nothing covers generated sources either). So with the control ON, a credential present and
     * every provider behaviour — a failing upload, an unapproved output host, the approved one — the
     * released request refuses before any row and before the first provider byte. The harness has no
     * seam to pass a decision, and must not. The upload-failure and host-approval mechanics this stage
     * used to reach stay proven below the gate: `image-to-video/lifecycle-postgres` (simulated
     * provider, test-only decision) and `image-to-video/transport-contract` (the real transport).
     */
    for (const [label, opts] of [
      ["prepare refused", { prepare: { status: 401, body: { detail: "x" } } }],
      ["PUT refused", { put: { status: 403 } }],
      ["completed on an unapproved host", { status: (id: string) => ({ status: 200, body: { status: "completed", request_id: id, video: { url: `https://d9other.cloudfront.net/${OUT_SECRET}/o.mp4` } } }) }],
      ["completed on the approved host", {}],
    ] as const) {
      const before = await base.countMediaAssets();
      const p = provider(opts as Parameters<typeof provider>[0]);
      const r = await runImageToVideoAcceptance({ ...base, sourceAssetId: sourceId, requestKey: randomUUID(), resolveTransport: async () => ({ status: "available", transport: p.transport }) });
      assert.deepEqual([r.stop, r.detail, r.invocationId], ["not-dispatched", "source-data-use-not-cleared", null], `${label}: stopped at data-use`);
      assert.deepEqual(p.guard.counts, { uploadPreparations: 0, uploadPuts: 0, generationPosts: 0, providerGets: 0, refused: 0 }, `${label}: no provider call at all`);
      assert.equal(await invocations(), 0, `${label}: nothing registered`);
      assert.equal(await base.countMediaAssets(), before, `${label}: nothing admitted`);
      assert.equal(served.length, 0, `${label}: no output byte fetched`);
      noUrl(r, label);
    }

    /* ── 5b. a VIDEO as the source → all provider calls 0 (custody refuses before data-use) ── */
    {
      const videoId = randomUUID();
      await client.query(
        `insert into media_assets (id, tenant_id, mime_type, byte_size, byte_digest, width, height, storage_backend, storage_key,
           admitted_at, media_kind, video_container, video_duration_ms, video_codec, video_frame_rate,
           supplied_by_actor_type, supplied_by_actor_id, supplied_source, supplied_source_file_id, supplied_source_capability,
           supplied_artifact_id, supplied_revision_no)
         values ($1,$2,'video/mp4',10,$3,640,360,'hebun-vps',$4, now(),'video','mov,mp4,m4a,3gp,3g2,mj2',2000,'h264','24/1',
           'human',$5,'google-drive',$6,'google.drive.file.content.read',$7,1)`,
        [videoId, t.tenantId, sha(new TextEncoder().encode(videoId)), mediaAssetStorageKey(t.tenantId, videoId), t.ctx.userId, `synthetic-video-${videoId.slice(0, 6)}`, t.draft],
      );
      const p = provider();
      const r = await runImageToVideoAcceptance({ ...base, sourceAssetId: videoId, requestKey: randomUUID(), resolveTransport: async () => ({ status: "available", transport: p.transport }) });
      assert.deepEqual([r.stop, r.detail], ["not-dispatched", "source-asset-not-image"]);
      assert.deepEqual(p.guard.counts, { uploadPreparations: 0, uploadPuts: 0, generationPosts: 0, providerGets: 0, refused: 0 }, "a video source reaches no provider");
    }
  } finally {
    await vps?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log("image-to-video/production-acceptance: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
