/*
 * MV-5 — normalized video derivation inside the existing Media authority.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "Migration 66 touches only two CHECKs on `media_assets` and rewrites no row. An admitted ORIGINAL
 *    video of a tenant becomes a NEW `mp4-normalize-v1` Media asset — H.264/AAC-or-silent MP4, ≤1920,
 *    even, never upscaled, duration within 250 ms — with explicit lineage, through the store's DERIVE-V1
 *    and application-side re-verification. The source row and bytes are unchanged; a repeat reuses the
 *    one derivative without running ffmpeg; every failure after the store creates no row; tenants are
 *    isolated; images, derivatives and retired videos are refused; the video stays out of image-only
 *    paths; the DB itself refuses a mis-profiled normalize row."
 */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { MIGRATIONS_DIR } from "../../scripts/lib/canonical-migrations";
import * as writer from "../../src/features/media-assets/derive-normalized-video.server";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { FFMPEG, FFPROBE, runScenarios } from "./scenarios";

const MV5_TAG = readdirSync(MIGRATIONS_DIR).find((f) => f.endsWith("_mv5_video_derivation.sql"))!.replace(/\.sql$/, "");
const SRC = path.resolve(process.cwd(), "src");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv5-video-derivation/derivation-postgres: exited before completing");
    process.exitCode = 1;
  }
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function migrationProof(): void {
  const journal = JSON.parse(readFileSync(path.join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as { entries: { tag: string }[] };
  assert.equal(journal.entries.length, 66, "MV-5 authors exactly one migration: 65 -> 66");
  assert.equal(journal.entries[65]!.tag, MV5_TAG, "and it is the newest");
  const sql = readFileSync(path.join(MIGRATIONS_DIR, `${MV5_TAG}.sql`), "utf8");
  assert.ok(!/\b(update|delete|insert|drop\s+table|drop\s+column|add\s+column|truncate|create\s+table|create\s+index|trigger)\b/i.test(sql), "constraints only");
  assert.deepEqual([...new Set([...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]))], ["media_assets"]);
  assert.deepEqual([...sql.matchAll(/DROP CONSTRAINT "([^"]+)"/g)].map((m) => m[1]), ["media_assets_derivation_chk"], "only the closed derivation set is re-added wider");
  assert.deepEqual([...sql.matchAll(/ADD CONSTRAINT "([^"]+)"/g)].map((m) => m[1]).sort(), ["media_assets_derivation_chk", "media_assets_derivation_mp4_chk"]);
}

function firewallProof(): void {
  const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f));
  const owner = path.join(SRC, "features/media-assets/derive-normalized-video.server.ts");
  const text = readFileSync(owner, "utf8");
  assert.ok(!/\.update\(\s*mediaAssets\s*\)/.test(text), "the writer never updates a Media row — the source is never written");
  assert.ok(!/\.delete\(/.test(text), "and deletes nothing");
  assert.ok(!/higgsfield|youtube|instagram/i.test(text), "provider-neutral, publish-free");
  const mentions = files.filter((f) => f !== owner && readFileSync(f, "utf8").includes("MP4_NORMALIZE_DERIVATION"));
  assert.deepEqual(mentions.map((f) => path.relative(SRC, f)), ["features/media-assets/contracts.ts"], "no other module writes a normalize row");
}

async function checkProof(client: Client): Promise<void> {
  const donor = (await client.query<{ id: string; tenant_id: string }>(`select m.id, m.tenant_id from media_assets m where m.media_kind='video' and m.derived_from_asset_id is null and not exists (select 1 from media_assets d where d.derived_from_asset_id = m.id) limit 1`)).rows[0]!;
  const insert = (over: string) =>
    client.query(
      `insert into media_assets (id, tenant_id, derived_from_asset_id, derivation, media_kind, mime_type, byte_size, byte_digest,
         width, height, video_container, video_duration_ms, video_codec, audio_codec, video_frame_rate, storage_backend, storage_key, admitted_at)
       select $1::uuid, $2::uuid, $3::uuid, 'mp4-normalize-v1', ${over}, 10, repeat('a',64), 2, 2, 'mov,mp4', 1000, 'h264', null, '25/1', 'test', 'tenants/'||$2::text||'/media/'||$1::text, now()`,
      [randomUUID(), donor.tenant_id, donor.id],
    );
  await assert.rejects(insert("'image', 'image/jpeg'"), (e: { code?: string; constraint?: string }) => e.code === "23514", "an image normalize row");
  await client.query("begin");
  try {
    await insert("'video', 'video/mp4'");
    await client.query("rollback");
  } catch (e) {
    await client.query("rollback");
    throw new Error(`a well-profiled normalize row must be representable: ${(e as Error).message}`);
  }
  const bad = async (set: string, why: string) => {
    await client.query("begin");
    try {
      await client.query(`update media_assets set ${set} where derivation='mp4-normalize-v1' and id = (select id from media_assets where derivation='mp4-normalize-v1' limit 1)`);
      assert.fail(`${why} accepted`);
    } catch (e) {
      assert.equal((e as { code?: string }).code, "23514", `${why} refused by CHECK (${(e as Error).message})`);
    } finally {
      await client.query("rollback");
    }
  };
  await bad(`video_codec='hevc'`, "a non-H.264 normalize row");
  await bad(`audio_codec='opus'`, "a non-AAC normalize row");
  await bad(`derivation='mp4-normalize-v2'`, "an unknown derivation");
}

async function main(): Promise<void> {
  assert.ok(FFMPEG && FFPROBE, "MV-5 acceptance needs a real ffmpeg and ffprobe (HEBUN_TEST_FFMPEG / HEBUN_TEST_FFPROBE)");
  migrationProof();
  firewallProof();

  const harness = createDisposablePostgresHarness("hebun_mv5_derive");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const handle = createControlPlaneDb(harness.dbUrl);
  let vps: LocalVpsStore | undefined;
  let vpsNoVideo: LocalVpsStore | undefined;
  try {
    harness.migrateDatabase();
    await client.connect();
    vps = await startLocalVpsStore({ HEBUN_MEDIA_STORE_ENABLE_VIDEO: "1", HEBUN_MEDIA_STORE_FFPROBE: FFPROBE, HEBUN_MEDIA_STORE_FFMPEG: FFMPEG });
    vpsNoVideo = await startLocalVpsStore({ HEBUN_MEDIA_STORE_FFPROBE: FFPROBE, HEBUN_MEDIA_STORE_FFMPEG: FFMPEG });
    await runScenarios(writer, { client, getDb: () => handle.db, vps, vpsNoVideo }, "released");
    await checkProof(client);
    assert.equal(writer.checkNormalizedProfile({ width: 1280, height: 720, durationMs: 2000, audioCodec: "aac" }, { width: 1280, height: 720, durationMs: 2021, videoCodec: "h264", audioCodec: "aac", byteSize: 10 }), null);
    assert.equal(writer.checkNormalizedProfile({ width: 640, height: 360, durationMs: 2000, audioCodec: null }, { width: 1280, height: 720, durationMs: 2000, videoCodec: "h264", audioCodec: null, byteSize: 10 }), "upscaled");
    assert.equal(writer.checkNormalizedProfile({ width: 3840, height: 2160, durationMs: 2000, audioCodec: null }, { width: 2560, height: 1440, durationMs: 2000, videoCodec: "h264", audioCodec: null, byteSize: 10 }), "dimension-over-1920");
    assert.equal(writer.checkNormalizedProfile({ width: 1280, height: 720, durationMs: 2000, audioCodec: null }, { width: 720, height: 720, durationMs: 2000, videoCodec: "h264", audioCodec: null, byteSize: 10 }), "aspect-changed");
  } finally {
    await vps?.dispose().catch(() => undefined);
    await vpsNoVideo?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log("mv5-video-derivation/derivation-postgres: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
