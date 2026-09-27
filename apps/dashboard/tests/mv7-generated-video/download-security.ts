/*
 * MV-7 — the provider-output STREAM seam: exact host trust, public-only addresses, re-checked
 * redirects, the 20 MiB ceiling, time. Against the released module.
 */
import * as Download from "../../src/features/media-assets/provider-output-download.server";
import { runDownloadScenarios } from "./download-scenarios";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/download-security: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  await runDownloadScenarios(Download, "released");
  finished = true;
  console.log("mv7-generated-video/download-security: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
