/*
 * MV-7 — the PRODUCTION acceptance harness, behind a FAKE Higgsfield, on a DISPOSABLE Postgres and the
 * real local store, through the RELEASED writers. No request leaves the process.
 *
 * THE CLAIM: "The harness is an orchestrator. It stops before registering anything when the released
 * resolver says the transport is unavailable. It dispatches ONCE — a second provider write is refused
 * before sending. A provider failure stops it with the truthful lifecycle and no re-observation. A
 * completed job whose output host is not the approved exact host stops it BEFORE any output byte, with
 * the invocation left provider-succeeded / not-attempted. On the approved host it admits through the
 * released writer and verifies the stored bytes, the read model and a signed Range. The CLI refuses a
 * malformed invocation before reading any file, and names only the env file it needs."
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import {
  HIGGSFIELD_OUTPUT_HOSTS,
  HIGGSFIELD_VIDEO_MODEL,
  createHiggsfieldVideoTransport,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import { createVpsMediaStorageV2 } from "../../src/features/media-assets/vps-media-storage-v2.server";
import { guardProviderFetch, runProductionAcceptance, MV7_PRODUCTION_PROMPT } from "../../scripts/lib/mv7-production-acceptance";
import { seedTenant } from "../mv4-async-generation/scenarios";

const API_KEY = "hf-test-opaque-key-not-real:0077-pppppppppppppppp";
const SECRET = "hidden-output-segment-mv7p";
const APPROVED = HIGGSFIELD_OUTPUT_HOSTS[0]!;

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/production-acceptance: exited before completing");
    process.exitCode = 1;
  }
});

function synthH264(): Uint8Array {
  const ffmpeg = execFileSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).trim();
  const dir = mkdtempSync(path.join(tmpdir(), "mv7p-"));
  const out = path.join(dir, "x.mp4");
  execFileSync(ffmpeg, ["-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=960x540:rate=24:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-brand", "isom", out]);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

/** A fake Higgsfield: POST → queued; status → a scripted answer. */
function provider(status: (id: string) => { status: number; body: unknown }, post: { status: number; body: (id: string) => unknown } = { status: 200, body: (id) => ({ status: "queued", request_id: id }) }) {
  const id = randomUUID();
  const seen: string[] = [];
  const inner = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push(`${init?.method ?? "GET"} ${url}`);
    const a = init?.method === "POST" ? { status: post.status, body: post.body(id) } : status(id);
    return new Response(JSON.stringify(a.body), { status: a.status });
  }) as typeof fetch;
  const guard = guardProviderFetch(inner, "https://api.higgsfield.ai");
  const transport = createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, spendBudget: createLiveSpendBudget(1), fetchImpl: guard.fetchImpl as never });
  return { id, seen, guard, transport };
}

async function main(): Promise<void> {
  /* ── 1. the guard: one provider write, a second refused before sending; the store passes ── */
  {
    const sent: string[] = [];
    const g = guardProviderFetch((async (i: RequestInfo | URL, init?: RequestInit) => { sent.push(`${init?.method ?? "GET"} ${String(i)}`); return new Response("{}"); }) as typeof fetch, "https://api.higgsfield.ai");
    await g.fetchImpl("https://api.higgsfield.ai/pixverse/v6/text-to-video", { method: "POST" });
    await assert.rejects(g.fetchImpl("https://api.higgsfield.ai/pixverse/v6/text-to-video", { method: "POST" }));
    await g.fetchImpl("https://api.higgsfield.ai/requests/x/status", { method: "GET" });
    await g.fetchImpl("https://media.example.test/v2/objects/k", { method: "PUT" });
    assert.deepEqual(g.counts, { posts: 1, gets: 1, refused: 1 });
    assert.equal(sent.filter((s) => s.startsWith("POST")).length, 1, "the second POST never left");
  }

  /* ── 2. CLI refusals, before any file is read ── */
  {
    const cli = (args: string[]) => spawnSync(process.execPath, ["--import", "tsx", "scripts/mv7-production-acceptance.ts", ...args], { encoding: "utf8", env: { ...process.env, MV7_DB_ENV_FILE: "", MV7_STORE_ENV_FILE: "", MV6_HIGGSFIELD_ENV_FILE: "/nonexistent" } });
    const A = randomUUID();
    for (const args of [[], ["run", "--artifact", A, "--revision", "1"], ["run", "--artifact", A, "--revision", "0", "--confirm-one-billable-pixverse-job"], ["preflight", "--artifact", "x", "--revision", "1"], ["generate"], ["backup", "extra"]]) {
      const r = cli(args);
      assert.equal(r.status, 1);
      assert.match(r.stderr, /^REFUSED: usage/m, `usage refusal: ${args.join(" ")}`);
    }
    const r = cli(["preflight", "--artifact", A, "--revision", "1"]);
    assert.match(r.stderr, /REFUSED: MV7_DB_ENV_FILE is not set/, "a valid stage stops at its missing target file");
    const text = readFileSync("scripts/mv7-production-acceptance.ts", "utf8");
    assert.ok(!/reveal\(|console\.[a-z]+\([^)]*apiKey|setProviderConnectivity|provider_connectivity_controls\s+set|insert into|update media_/i.test(text), "the harness reveals no URL, prints no key, and writes nothing itself");
    assert.ok(!/profile:/.test(text), "production keeps the pinned PixVerse profile: the harness names none");
  }

  const harness = createDisposablePostgresHarness("hebun_mv7_production_harness");
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
    const bytes = synthH264();
    const served: string[] = [];
    const base = {
      tenant: t.ctx,
      artifactId: t.draft,
      revisionNo: 1,
      promptText: MV7_PRODUCTION_PROMPT,
      getDb,
      resolveStorageV1: () => ({ status: "available" as const, store: createVpsMediaObjectStore({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret }) }),
      resolveStorageV2: () => ({ status: "available" as const, client: createVpsMediaStorageV2({ origin: s.origin, writeSecret: s.writeSecret, readSecret: s.readSecret }) }),
      countMediaAssets: async () => (await client.query<{ n: number }>("select count(*)::int n from media_assets")).rows[0]!.n,
      invocationRow: async (id: string) => (await client.query<{ j: Record<string, unknown> }>("select to_jsonb(i) j from media_generation_invocations i where id=$1", [id])).rows[0]?.j ?? null,
      assetRows: async (id: string) => (await client.query<{ j: Record<string, unknown> }>("select to_jsonb(m) j from media_assets m where invocation_id=$1", [id])).rows.map((r) => r.j),
      download: { get: async (url: URL) => { served.push(url.hostname); return { status: 200, headers: {}, body: new Blob([bytes as Uint8Array<ArrayBuffer>]).stream() }; } },
      sleep: async () => undefined,
    };
    const invocations = async () => (await client.query<{ n: number }>("select count(*)::int n from media_generation_invocations")).rows[0]!.n;

    /* ── 3. control OFF (resolver unavailable) → nothing registered, nothing called ── */
    {
      const r = await runProductionAcceptance({ ...base, requestKey: randomUUID(), resolveTransport: async () => ({ status: "unavailable", reason: "video-generation-disabled" }) });
      assert.deepEqual([r.stop, r.detail, r.generation], ["transport-unavailable", "video-generation-disabled", null]);
      assert.equal(await invocations(), 0);
    }

    /* ── 4. a documented provider refusal → truthful provider-failed, no re-observation ── */
    {
      const p = provider(() => ({ status: 500, body: {} }), { status: 403, body: () => ({ detail: "Not enough credits" }) });
      const r = await runProductionAcceptance({ ...base, requestKey: randomUUID(), resolveTransport: async () => ({ status: "available", transport: p.transport }) });
      assert.equal(r.stop, "generation-not-succeeded");
      assert.equal(r.invocation?.state, "provider-failed");
      assert.equal(r.generation?.dispatchCalls, 1);
      assert.deepEqual([p.guard.counts.posts, p.guard.counts.gets], [1, 0], "no status read after a refusal");
    }

    /* ── 5. completed on an UNAPPROVED host → stop before any byte; reusable later ── */
    {
      const before = await base.countMediaAssets();
      const p = provider((id) => ({ status: 200, body: { status: "completed", request_id: id, video: { url: `https://d9other.cloudfront.net/${SECRET}/o.mp4` } } }));
      const r = await runProductionAcceptance({ ...base, requestKey: randomUUID(), resolveTransport: async () => ({ status: "available", transport: p.transport }) });
      assert.deepEqual([r.stop, r.detail, r.model], ["host-not-approved", "d9other.cloudfront.net", HIGGSFIELD_VIDEO_MODEL], "production model is the pinned PixVerse profile");
      assert.deepEqual([r.invocation?.state, r.invocation?.admissionOutcome, r.invocation?.outputRefIsJobId], ["provider-succeeded", "not-attempted", true]);
      assert.equal(served.length, 0, "no output byte fetched");
      assert.equal(await base.countMediaAssets(), before);
      assert.deepEqual([p.guard.counts.posts, p.guard.counts.gets], [1, 2], "one POST; one poll + one re-observation");
      assert.ok(!JSON.stringify(r).includes(SECRET), "no URL path in the report");
    }

    /* ── 6. completed on the APPROVED exact host → admitted and verified ── */
    {
      const p = provider((id) => ({ status: 200, body: { status: "completed", request_id: id, video: { url: `https://${APPROVED}/${SECRET}/o.mp4` } } }));
      const r = await runProductionAcceptance({ ...base, requestKey: randomUUID(), resolveTransport: async () => ({ status: "available", transport: p.transport }) });
      assert.equal(r.stop, "admitted", JSON.stringify(r));
      assert.deepEqual([r.invocation?.state, r.invocation?.admissionOutcome, r.invocation?.admissionFailure], ["provider-succeeded", "admitted", null]);
      assert.deepEqual([r.assetsForInvocation, r.storedVerified, r.storedMajorBrand, r.readModelOrigin, r.readModelInvocationLinked, r.grantIssued], [1, true, "isom", "generated", true, true]);
      assert.deepEqual([r.rangeStatus, r.rangeBytes], [206, 1024]);
      assert.deepEqual(served, [APPROVED], "exactly one output fetch, from the approved host");
      assert.deepEqual([p.guard.counts.posts, p.guard.counts.refused], [1, 0]);
      assert.equal(p.guard.counts.gets, 3, "poll + harness re-observation + admission re-observation");
      assert.ok(!JSON.stringify(r).includes(SECRET));
    }
  } finally {
    await vps?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log("mv7-generated-video/production-acceptance: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
