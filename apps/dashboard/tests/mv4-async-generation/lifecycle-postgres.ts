/*
 * MV-4 — the asynchronous generation lifecycle on the EXISTING `media_generation_invocations`
 * authority. Real Postgres, real migrations, real authority code, SIMULATED provider.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "Migration 65 extends only `media_generation_invocations` and rewrites no row: every existing
 *    invocation stays valid and reads as an image request that was never polled. One CAS writer moves
 *    an asynchronous video request registered → dispatching → provider-pending → provider-succeeded |
 *    provider-failed, or to dispatch-unknown, which is distinct from failure, terminal, and never
 *    retried. Polling is idempotent; a duplicate completion is a no-op. Provider completion records an
 *    opaque reference and creates NO Media asset. Tenants are isolated; the simulated transport is
 *    labelled simulated and is not resolvable in production; the synchronous image path is unchanged."
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import sharp from "sharp";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { MIGRATIONS_DIR } from "../../scripts/lib/canonical-migrations";
import { applyPendingMigrations } from "../../scripts/lib/production-migration";
import * as lifecycle from "../../src/features/media-assets/async-generation-lifecycle.server";
import { resolveMediaAsyncGenerationTransport } from "../../src/features/media-assets/async-generation-transport.server";
import { requestMediaGeneration } from "../../src/features/media-assets/request-media-generation.server";
import { canonicalMediaGenerationInput, digestMediaGenerationInput, digestVideoGenerationInput } from "../../src/features/media-assets/input-digest";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import { createFakeMediaGenerationTransport, createMemoryMediaObjectStore } from "../helpers/media-fakes";
import { createFakeAsyncVideoTransport } from "../helpers/fake-async-video-transport";
import { row, runScenarios, seedTenant } from "./scenarios";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const MV4_TAG = "20260926140423_mv4_async_generation_lifecycle";
const SRC = path.resolve(process.cwd(), "src");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv4-async-generation/lifecycle-postgres: exited before completing");
    process.exitCode = 1;
  }
});

function truncatedMigrations(count: number): string {
  const dir = mkdtempSync(path.join(tmpdir(), "hebun-mv4-"));
  mkdirSync(path.join(dir, "meta"), { recursive: true });
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };
  const entries = journal.entries.slice(0, count);
  for (const e of entries) cpSync(path.join(MIGRATIONS_DIR, `${e.tag}.sql`), path.join(dir, `${e.tag}.sql`));
  writeFileSync(path.join(dir, "meta", "_journal.json"), JSON.stringify({ ...journal, entries }));
  return dir;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function migrationProof(): Promise<void> {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };
  assert.equal(journal.entries.length, 65, "MV-4 authors exactly one migration: 64 -> 65");
  assert.equal(journal.entries[64]!.tag, MV4_TAG, "and it is the newest");
  const sql = readFileSync(path.join(MIGRATIONS_DIR, `${MV4_TAG}.sql`), "utf8");
  assert.ok(!/\b(update|delete|drop\s+table|drop\s+column|truncate|create\s+table|trigger)\b/i.test(sql), "no data rewrite, no dropped column, no table, no trigger");
  const tables = new Set([...sql.matchAll(/(?:ALTER TABLE|ON) "([a-z_]+)"/g)].map((m) => m[1]));
  assert.deepEqual([...tables], ["media_generation_invocations"], "only the existing generation authority is touched");
  assert.deepEqual([...sql.matchAll(/DROP CONSTRAINT "([^"]+)"/g)].map((m) => m[1]!).sort(), ["media_generation_invocations_state_chk", "media_generation_invocations_finalized_chk"].sort(), "only the state and finalized CHECKs are dropped, each re-added wider");
  assert.equal([...sql.matchAll(/CREATE INDEX/g)].length, 1, "one index: the pending-poll partial index");

  /* Existing rows, as production holds them, survive 64 -> 65 unchanged and valid. */
  const harness = createDisposablePostgresHarness("hebun_mv4_backfill");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  await client.connect();
  const folder = truncatedMigrations(64);
  const handle = createControlPlaneDb(harness.dbUrl);
  try {
    await applyPendingMigrations(client, folder);
    const cols = await client.query(`select 1 from information_schema.columns where table_name='media_generation_invocations' and column_name='output_media_kind'`);
    assert.equal(cols.rowCount, 0, "at 64 there is no output_media_kind yet");
    const t = await seedTenant(client, () => handle.db, "Legacy");
    const agent = (await client.query(`select id from agents where tenant_id=$1 limit 1`, [t.tenantId])).rows[0]!.id as string;
    const ids: string[] = [];
    for (const [state, failure, admission] of [["provider-succeeded", null, "refused"], ["provider-failed", "provider-unavailable", "not-attempted"]] as const) {
      const r = await client.query<{ id: string }>(
        `insert into media_generation_invocations (tenant_id, request_key, requested_by_actor_type, requested_by_actor_id, agent_id,
           source_artifact_id, source_revision_no, prompt_text, input_digest, transport, provider, model, provider_job_id,
           provider_failure, state, admission_outcome, admission_failure, requested_at, finalized_at)
         values ($1,$2,'human',$3,$4,$5,1,'Legacy image',$6,'live','openai','gpt-image-1','req_abc',$7,$8,$9,$10, now(), now()) returning id`,
        [t.tenantId, randomUUID(), t.ctx.userId, agent, t.draft, "a".repeat(64), failure, state, admission, admission === "refused" ? "not-an-image" : null],
      );
      ids.push(r.rows[0]!.id);
    }
    const before = await Promise.all(ids.map((id) => row(client, id)));
    await applyPendingMigrations(client);
    for (const [i, id] of ids.entries()) {
      const after = await row(client, id);
      for (const [k, v] of Object.entries(before[i]!)) assert.deepEqual(after[k], v, `existing column ${k} unchanged`);
      assert.equal(after.output_media_kind, "image", "an existing invocation reads as an image request");
      assert.equal(after.poll_count, 0);
      for (const c of ["provider_accepted_at", "provider_completed_at", "last_polled_at", "provider_output_ref"]) assert.equal(after[c], null, `${c} NULL`);
    }
  } finally {
    await client.end();
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
    rmSync(folder, { recursive: true, force: true });
  }
}

async function checkProof(client: Client, id: string): Promise<void> {
  /* Structural invariants hold even against a writer that bypasses the CAS module. */
  const refusedBy = async (set: string, name: string) => {
    await client.query("savepoint c");
    try {
      await client.query(`update media_generation_invocations set ${set} where id=$1`, [id]);
      assert.fail(`${name} accepted: ${set}`);
    } catch (e) {
      assert.equal((e as { code?: string }).code, "23514", `${name} refused by CHECK (${(e as Error).message})`);
    } finally {
      await client.query("rollback to savepoint c");
    }
  };
  await client.query("begin");
  try {
    await refusedBy(`state='provider-pending', provider_job_id=null`, "pending without a job");
    await refusedBy(`state='provider-pending', provider_job_id='j', provider_output_ref='o'`, "output ref before success");
    await refusedBy(`state='provider-succeeded', provider_output_ref='https://cdn.example/x.mp4'`, "a URL as output ref");
    await refusedBy(`state='provider-pending', provider_job_id='j', provider_completed_at=now()`, "completed while pending");
    await refusedBy(`state='registered', provider_accepted_at=now()`, "accepted while registered");
    await refusedBy(`output_media_kind='audio'`, "unknown output kind");
    await refusedBy(`poll_count=-1`, "negative poll count");
    await refusedBy(`poll_count=2`, "polled without a poll time");
    await refusedBy(`state='dispatch-unknown', provider_failure='timeout'`, "unknown carrying a failure");
    await refusedBy(`state='weird'`, "an unknown state");
    await refusedBy(`state='provider-pending', provider_job_id='j', finalized_at=now()`, "a pending job finalized");
    await refusedBy(`state='dispatch-unknown'`, "a terminal state left unfinalized");
    await refusedBy(`state='provider-pending', provider_job_id='j', admission_outcome='admitted'`, "admission before success");
  } finally {
    await client.query("rollback");
  }
}

function firewallProof(): void {
  const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
  const owner = path.join(SRC, "features/media-assets/async-generation-lifecycle.server.ts");
  const writes = /\b(providerOutputRef|providerAcceptedAt|providerCompletedAt|lastPolledAt|pollCount)\s*:|state:\s*"(dispatching|dispatch-unknown|provider-pending)"/;
  const offenders = files.filter((f) => f !== owner && !f.includes("/db/schema/") && writes.test(readFileSync(f, "utf8")));
  assert.deepEqual(offenders, [], "only the lifecycle writer writes the asynchronous lifecycle");
  const ownerText = readFileSync(owner, "utf8");
  assert.ok(!/mediaAssets\b/.test(ownerText), "the lifecycle writer never names media_assets");
  assert.ok(!/admissionOutcome\s*:\s*"/.test(ownerText) && !/admissionFailure/.test(ownerText), "and never writes admission_outcome");
  assert.ok(!/fake-async-video-transport|SIMULATED/.test(readFileSync(path.join(SRC, "features/media-assets/async-generation-transport.server.ts"), "utf8")), "the production resolver cannot reach the simulated transport");
  for (const f of files) {
    assert.ok(!readFileSync(f, "utf8").includes("fake-async-video-transport"), `${f} does not import the simulated transport`);
  }
  assert.ok(!/higgsfield/i.test(ownerText + readFileSync(path.join(SRC, "features/media-assets/async-generation-transport.ts"), "utf8")), "provider-neutral core");
}

async function main(): Promise<void> {
  /* Digest: v1 text-to-image bytes unchanged; a video request digests differently. */
  const base = { promptText: "p", sourceArtifactId: randomUUID(), sourceRevisionNo: 1, sourceContentDigest: "d".repeat(64), transport: "fake", provider: "x", model: "m" };
  assert.ok(canonicalMediaGenerationInput(base).startsWith(`{"v":1,"promptText":"p","source":`), "v1 canonical form unchanged");
  assert.notEqual(digestVideoGenerationInput(base), digestMediaGenerationInput(base), "asking for a video is a different request");
  assert.deepEqual(await resolveMediaAsyncGenerationTransport(), { status: "unavailable", reason: "no-video-generation-provider" }, "REAL PROVIDER: NOT CONNECTED");

  firewallProof();
  await migrationProof();

  const harness = createDisposablePostgresHarness("hebun_mv4_lifecycle");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  const getDb = () => handle.db;
  try {
    harness.migrateDatabase();
    await client.connect();
    await runScenarios(lifecycle, client, getDb, "released");

    /* CHECKs against a real registered video row. */
    const t = await seedTenant(client, getDb, "Checks");
    const fake = createFakeAsyncVideoTransport("accept");
    const reg = await lifecycle.registerAsyncMediaGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "x", requestKey: randomUUID() }, { getDb, resolveTransport: () => ({ status: "available", transport: fake }) });
    assert.equal(reg.status, "registered");
    await checkProof(client, (reg as { invocationId: string }).invocationId);

    /* Regression: the synchronous image path is unchanged and never polled. */
    const store = createMemoryMediaObjectStore();
    const png = new Uint8Array(await sharp({ create: { width: 32, height: 24, channels: 3, background: { r: 10, g: 90, b: 40 } } }).png().toBuffer());
    const img = await requestMediaGeneration(t.ctx, { artifactId: t.draft, revisionNo: 1, promptText: "An image.", requestKey: randomUUID() }, {
      getDb,
      resolveStorage: (): MediaStorageResolution => ({ status: "available", store }),
      resolveTransport: () => ({ status: "available", transport: createFakeMediaGenerationTransport({ kind: "bytes", bytes: png }) }),
    });
    assert.equal(img.status, "admitted", `image generation still admits (${JSON.stringify(img).slice(0, 120)})`);
    const inv = await row(client, (img as { invocationId: string }).invocationId) as Record<string, unknown> & { id: string };
    assert.equal(inv.state, "provider-succeeded");
    assert.equal(inv.output_media_kind, "image");
    assert.equal(inv.poll_count, 0);
    assert.equal(inv.provider_output_ref, null);
    assert.equal(inv.provider_accepted_at, null);
    assert.equal(
      (await lifecycle.pollAsyncMediaGeneration(t.ctx, inv.id, { getDb, resolveTransport: () => ({ status: "available", transport: fake }) })).status,
      "refused",
      "the async writer refuses an image invocation",
    );
    assert.deepEqual(await lifecycle.readAsyncMediaGeneration(t.ctx, inv.id, { getDb }), { status: "not-found" }, "and does not read it as a video job");
  } finally {
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }

  finished = true;
  console.log("mv4-async-generation/lifecycle-postgres: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
