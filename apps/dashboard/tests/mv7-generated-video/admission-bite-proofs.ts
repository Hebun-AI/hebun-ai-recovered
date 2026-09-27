/*
 * MV-7 admission bite-proofs. Each mutation disables ONE guard of the generated-video admission writer
 * in a copy; the scenarios that pass against the released writer must FAIL against every copy.
 */
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { startLocalVpsStore, type LocalVpsStore } from "../helpers/media-vps-store-process";
import { FFMPEG, FFPROBE, runScenarios } from "./admission-scenarios";

const DIR = path.resolve(process.cwd(), "src/features/media-assets");
const SOURCE = readFileSync(path.join(DIR, "admit-generated-video.server.ts"), "utf8");
const TX_OPEN = "    await db.transaction(async (tx) => {\n";
const TX_CLOSE = "      if (marked.length !== 1) throw new AdmissionRaced();\n    });\n";

const BITES: readonly { readonly name: string; readonly find: string; readonly replace: string }[] = [
  { name: "W1 admission without provider-succeeded", find: `  if (row.state !== "provider-succeeded" || !row.outputRef) return refused("provider-not-succeeded");\n`, replace: `  if (!row.outputRef && row.state === "registered") return refused("provider-not-succeeded");\n` },
  { name: "W2 duplicate admission (decided row re-admitted)", find: `  if (row.admissionOutcome === "admitted") {`, replace: `  if (row.admissionOutcome === "admitted" && false) {` },
  { name: "W3 asset insert without the admission transition", find: `.set({ admissionOutcome: "admitted", admissionFailure: null })`, replace: `.set({ admissionFailure: null })` },
  { name: "W4 asset and transition not one transaction", find: TX_OPEN, replace: `    await (async (tx: ControlPlaneDatabase) => {\n` },
  { name: "W5 relay and store measurement not compared", find: `  if (stored.byteSize !== verdict.relayBytes || stored.sha256Hex !== verdict.relayDigest) {`, replace: `  if (stored.byteSize !== verdict.relayBytes) {` },
  { name: "W6 video policy skipped", find: `  if (policy.status !== "admissible") return notAdmitted(db, thisInvocation, "refused", "video-not-admissible", policy.detail, true);\n  const v = policy.facts;`, replace: `  const v = policy.status === "admissible" ? policy.facts : { container: "mp4", durationMs: 1, width: 1, height: 1, videoCodec: "mpeg4", audioCodec: null, frameRate: "24/1" };` },
  { name: "W7 invocation loaded without its tenant", find: `        .from(mediaGenerationInvocations)\n        .where(thisInvocation)\n        .limit(1)`, replace: `        .from(mediaGenerationInvocations)\n        .where(eq(mediaGenerationInvocations.id, invocationId))\n        .limit(1)` },
  { name: "W8 the URL leaks into a refusal", find: `    return refused(opened.reason);\n`, replace: `    return refused(opened.reason, located.location.reveal());\n` },
  { name: "W9 admission dispatches a generation", find: `  let located;\n  try {\n`, replace: `  let located;\n  await transport.dispatch({ promptText: "x", inputDigest: "0".repeat(64), invocationId });\n  try {\n` },
  { name: "W10 a no-verdict refusal is recorded", find: `    return refused("output-not-located", located.status === "not-located" ? located.reason : located.status);`, replace: `    return notAdmitted(db, thisInvocation, "refused", "probe-failed", located.status, false);` },
  { name: "W11 transport identity not checked", find: `  if (transport.transport !== row.transport || transport.provider !== row.provider || transport.model !== row.model) {`, replace: `  if (transport.transport !== row.transport) {` },
  { name: "W12 transition CAS ignores a decided outcome", find: `      const marked = await tx\n        .update(mediaGenerationInvocations)\n        .set({ admissionOutcome: "admitted", admissionFailure: null })\n        .where(\n          and(\n            thisInvocation,\n            eq(mediaGenerationInvocations.state, "provider-succeeded"),\n            eq(mediaGenerationInvocations.admissionOutcome, "not-attempted"),`, replace: `      const marked = await tx\n        .update(mediaGenerationInvocations)\n        .set({ admissionOutcome: "admitted", admissionFailure: null })\n        .where(\n          and(\n            thisInvocation,\n            eq(mediaGenerationInvocations.state, "provider-succeeded"),` },
];

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/admission-bite-proofs: exited before completing");
    process.exitCode = 1;
  }
});

function mutate(source: string, bite: (typeof BITES)[number]): string {
  let out = source.replace(bite.find, bite.replace);
  if (bite.find === TX_OPEN) out = out.replace(TX_CLOSE, "      if (marked.length !== 1) throw new AdmissionRaced();\n    })(db);\n");
  return out;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_mv7_bites");
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

    const control = path.join(DIR, ".mv7-bite-control.server.ts");
    writeFileSync(control, SOURCE);
    try {
      await runScenarios(await import(pathToFileURL(control).href), env, "control");
    } finally {
      rmSync(control, { force: true });
    }
    for (const [i, bite] of BITES.entries()) {
      assert.equal(SOURCE.split(bite.find).length, 2, `${bite.name}: the mutation site is unique`);
      const file = path.join(DIR, `.mv7-bite-${i}.server.ts`);
      writeFileSync(file, mutate(SOURCE, bite));
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
  console.log("mv7-generated-video/admission-bite-proofs: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
