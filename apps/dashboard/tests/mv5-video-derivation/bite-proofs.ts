/*
 * MV-5 bite-proofs. Each mutation disables ONE guard of the derivation writer in a copy; the scenarios
 * that pass against the released writer must FAIL against every copy.
 */
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { FFMPEG, FFPROBE, runScenarios } from "./scenarios";

const DIR = path.resolve(process.cwd(), "src/features/media-assets");
const SOURCE = readFileSync(path.join(DIR, "derive-normalized-video.server.ts"), "utf8");

const BITES: readonly { readonly name: string; readonly find: string; readonly replace: string }[] = [
  { name: "B1 an image is accepted as a source", find: `if (source.mediaKind !== "video" || source.mimeType !== "video/mp4" || source.durationMs === null) return refused("source-not-video");`, replace: `if (source.durationMs === null && source.mediaKind === "video") return refused("source-not-video");` },
  { name: "B2 a derivative is accepted as a source", find: `if (source.derivedFromAssetId !== null) return refused("source-not-original");\n  if (source.invocationId === null && source.suppliedSource === null) return refused("source-not-original");`, replace: `` },
  { name: "B3 an existing derivative is not reused", find: `  if (existing) {`, replace: `  if (existing && false) {` },
  { name: "B4 the stored result is not re-verified", find: `if (stored?.status !== "present" || stored.byteSize !== facts.byteSize || stored.sha256Hex !== facts.sha256Hex) {`, replace: `if (stored?.status !== "present") {` },
  { name: "B5 the profile is not checked", find: `  if (profileProblem) return failed("output-rejected", profileProblem, true);`, replace: `` },
  { name: "B6 the source is loaded without its tenant", find: `.where(and(eq(mediaAssets.tenantId, tenantId), eq(mediaAssets.id, sourceAssetId)))`, replace: `.where(eq(mediaAssets.id, sourceAssetId))` },
  { name: "B7 the source bytes are not verified", find: `if (sourceStored?.status !== "present" || sourceStored.byteSize !== source.byteSize || sourceStored.sha256Hex !== source.byteDigest) {`, replace: `if (sourceStored?.status !== "present") {` },
  { name: "B8 a retired source is accepted", find: `  if (source.lifecycle !== "admitted") return refused("source-retired");`, replace: `` },
];

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv5-video-derivation/bite-proofs: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_mv5_bites");
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
    const env = { client, getDb: () => handle.db, vps, vpsNoVideo };

    const control = path.join(DIR, ".mv5-bite-control.server.ts");
    writeFileSync(control, SOURCE);
    try {
      await runScenarios(await import(pathToFileURL(control).href), env, "control");
    } finally {
      rmSync(control, { force: true });
    }
    for (const [i, bite] of BITES.entries()) {
      assert.equal(SOURCE.split(bite.find).length, 2, `${bite.name}: the mutation site is unique`);
      const file = path.join(DIR, `.mv5-bite-${i}.server.ts`);
      writeFileSync(file, SOURCE.replace(bite.find, bite.replace));
      let survived = false;
      try {
        await runScenarios(await import(pathToFileURL(file).href), env, bite.name);
        survived = true;
      } catch (error) {
        console.log(`BITE ${bite.name}: ${(error as Error).message.split("\n")[0]!.slice(0, 110)}`);
      } finally {
        rmSync(file, { force: true });
      }
      assert.equal(survived, false, `${bite.name} SURVIVED — the suite does not guard it`);
    }
  } finally {
    await vps?.dispose().catch(() => undefined);
    await vpsNoVideo?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log(`mv5-video-derivation/bite-proofs: ok (${BITES.length} bites)`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
