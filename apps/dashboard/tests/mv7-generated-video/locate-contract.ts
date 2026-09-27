/*
 * MV-7 — Higgsfield `locateOutput` against the released transport. See locate-scenarios.ts.
 */
import * as Transport from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { runLocateScenarios } from "./locate-scenarios";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/locate-contract: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  await runLocateScenarios(Transport, "released");
  finished = true;
  console.log("mv7-generated-video/locate-contract: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
