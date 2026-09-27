/*
 * MV-7 — generated-video admission against the released writer, on real Postgres and the real VPS
 * store process. See admission-scenarios.ts for the claim.
 */
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import * as Writer from "../../src/features/media-assets/admit-generated-video.server";
import { FFMPEG, FFPROBE, runScenarios } from "./admission-scenarios";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/admission-postgres: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_mv7_admission");
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
    await runScenarios(Writer, { client, getDb: () => handle.db, vps, vpsNoVideo }, "released");
  } finally {
    await vps?.dispose().catch(() => undefined);
    await vpsNoVideo?.dispose().catch(() => undefined);
    await client.end().catch(() => undefined);
    await handle.dispose().catch(() => undefined);
    await harness.dropDatabase();
  }
  finished = true;
  console.log("mv7-generated-video/admission-postgres: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
