/*
 * MV-7 locate bite-proofs: each mutation breaks ONE promise of `locateOutput` in a copy of the
 * Higgsfield transport; the scenarios must fail against every copy.
 */
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runLocateScenarios } from "./locate-scenarios";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const DIR = path.resolve(process.cwd(), "src/features/media-generation-live");
const SOURCE = readFileSync(path.join(DIR, "higgsfield-video-transport.server.ts"), "utf8");
const LOCATE = "    async locateOutput(input: { readonly providerJobId: string }): Promise<MediaAsyncOutputLocation> {\n";

const BITES: readonly { readonly name: string; readonly find: string; readonly replace: string }[] = [
  { name: "L1 re-observation dispatches a generation", find: LOCATE, replace: `${LOCATE}      await this.dispatch({ promptText: "x", inputDigest: "0".repeat(64), invocationId: input.providerJobId });\n` },
  { name: "L2 the shape carries the path", find: `    pathSegmentCount: segments.length,\n`, replace: `    pathSegmentCount: segments.length,\n    path: url.pathname,\n` },
  { name: "L3 the shape carries query values", find: `  const names = [...new Set(url.searchParams.keys())]`, replace: `  const names = [...new Set(url.searchParams.values())]` },
  { name: "L4 the URL is an enumerable property", find: `  return Object.freeze({ shape, allowedHosts: Object.freeze([...allowedHosts]), reveal: () => rawUrl });`, replace: `  return Object.freeze({ shape, url: rawUrl, allowedHosts: Object.freeze([...allowedHosts]), reveal: () => rawUrl });` },
  { name: "L5 an unapproved output host is trusted", find: `export const HIGGSFIELD_OUTPUT_HOSTS: readonly string[] = Object.freeze(["d3u0tzju9qaucj.cloudfront.net"]);`, replace: `export const HIGGSFIELD_OUTPUT_HOSTS: readonly string[] = Object.freeze(["d3u0tzju9qaucj.cloudfront.net", "cdn.provider.test"]);` },
  { name: "L8 the CloudFront parent is trusted", find: `export const HIGGSFIELD_OUTPUT_HOSTS: readonly string[] = Object.freeze(["d3u0tzju9qaucj.cloudfront.net"]);`, replace: `export const HIGGSFIELD_OUTPUT_HOSTS: readonly string[] = Object.freeze(["*.cloudfront.net"]);` },
  { name: "L6 an http output is located", find: `      if (!observation.hasVideoUrl || typeof raw !== "string") return { status: "not-located", reason: "no-output" };`, replace: `      if (typeof raw !== "string") return { status: "not-located", reason: "no-output" };` },
  { name: "L7 another job's answer is accepted", find: `  if (field(body, "request_id") !== requestId) return { kind: "unreadable" };\n`, replace: `` },
];

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/locate-bite-proofs: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const control = path.join(DIR, ".mv7-locate-bite-control.server.ts");
  writeFileSync(control, SOURCE);
  try {
    await runLocateScenarios(await import(pathToFileURL(control).href), "control");
  } finally {
    rmSync(control, { force: true });
  }
  for (const [i, bite] of BITES.entries()) {
    assert.equal(SOURCE.split(bite.find).length, 2, `${bite.name}: the mutation site is unique`);
    const file = path.join(DIR, `.mv7-locate-bite-${i}.server.ts`);
    writeFileSync(file, SOURCE.replace(bite.find, bite.replace));
    let survived = false;
    try {
      await runLocateScenarios(await import(pathToFileURL(file).href), bite.name);
      survived = true;
    } catch (error) {
      console.log(`BITE ${bite.name}: ${(error as Error).message.split("\n")[0]!.slice(0, 110)}`);
    } finally {
      rmSync(file, { force: true });
    }
    assert.equal(survived, false, `${bite.name} SURVIVED — the suite does not guard it`);
  }
  finished = true;
  console.log("mv7-generated-video/locate-bite-proofs: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
