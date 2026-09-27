/*
 * MV-7 download bite-proofs. Each mutation disables ONE guard of the provider-output stream seam in a
 * copy; the scenarios that pass against the released module must FAIL against every copy.
 */
import assert from "node:assert/strict";
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runDownloadScenarios } from "./download-scenarios";

const DIR = path.resolve(process.cwd(), "src/features/media-assets");
const SOURCE = readFileSync(path.join(DIR, "provider-output-download.server.ts"), "utf8");

const BITES: readonly { readonly name: string; readonly find: string; readonly replace: string }[] = [
  { name: "D1 suffix host trust", find: `  if (!allowed.has(host)) return { ok: false, reason: "download-host-not-allowed" };\n  return { ok: true, url };\n}\n\nfunction header`, replace: `  if (![...allowed].some((h) => host.endsWith(h.replace(/^\\*/, "")))) return { ok: false, reason: "download-host-not-allowed" };\n  return { ok: true, url };\n}\n\nfunction header` },
  { name: "D2 wildcard entries kept", find: `.filter((h) => h.length > 0 && !h.includes("*"))`, replace: `.map((h) => h.replace(/^\\*\\./, ""))` },
  { name: "D3 IP literal accepted", find: `  if (isIP(host.replace(/^\\[|\\]$/g, "")) !== 0) return { ok: false, reason: "download-host-not-allowed" };\n`, replace: `` },
  { name: "D4 redirect hop not re-checked", find: `        const checked = checkStreamHop(next, hop.url, allowed);`, replace: `        const checked = { ok: true as const, url: new URL(next, hop.url) } as StreamHop;` },
  { name: "D5 redirect count unbounded", find: `if (!next || redirects >= MEDIA_DOWNLOAD_LIMITS.maxRedirects) return { status: "refused", reason: "download-redirect-refused" };`, replace: `if (!next) return { status: "refused", reason: "download-redirect-refused" };` },
  { name: "D6 every address public", find: `export function isPublicAddress(address: string): boolean {\n`, replace: `export function isPublicAddress(address: string): boolean {\n  if (address.length > 0) return true;\n` },
  { name: "D7 lookup checks only the first answer", find: `if (addresses.length === 0 || !addresses.every((a) => isPublicAddress(a.address))) {`, replace: `if (addresses.length === 0 || !isPublicAddress(addresses[0]!.address)) {` },
  { name: "D8 default socket skips the lookup", find: `{ method: "GET", headers: { accept: init.accept }, lookup: lookup as never, signal: init.signal, agent: false }`, replace: `{ method: "GET", headers: { accept: init.accept }, signal: init.signal, agent: false }` },
  { name: "D9 no stream ceiling", find: `      if (count > max) {\n        overran = true;\n        controller.error(new Error("provider output ceiling exceeded"));\n        return;\n      }\n`, replace: `` },
  { name: "D10 declared length ignored", find: `      if (declaredLength !== null && declaredLength > maxBytes) {`, replace: `      if (declaredLength !== null && declaredLength > maxBytes && false) {` },
  { name: "D11 non-200 accepted", find: `      if (response.status !== 200) {\n        await response.body.cancel().catch(() => undefined);\n        return { status: "refused", reason: "download-status-refused" };`, replace: `      if (response.status >= 500) {\n        await response.body.cancel().catch(() => undefined);\n        return { status: "refused", reason: "download-status-refused" };` },
  { name: "D12 plain http accepted", find: `  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || url.port !== "") {\n    return { ok: false, reason: "download-url-invalid" };\n  }\n  const host`, replace: `  if (url.username !== "" || url.password !== "" || url.port !== "") {\n    return { ok: false, reason: "download-url-invalid" };\n  }\n  const host` },
];

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/download-bite-proofs: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  const control = path.join(DIR, ".mv7-dl-bite-control.server.ts");
  writeFileSync(control, SOURCE);
  try {
    await runDownloadScenarios(await import(pathToFileURL(control).href), "control");
  } finally {
    rmSync(control, { force: true });
  }
  for (const [i, bite] of BITES.entries()) {
    assert.equal(SOURCE.split(bite.find).length, 2, `${bite.name}: the mutation site is unique`);
    const file = path.join(DIR, `.mv7-dl-bite-${i}.server.ts`);
    writeFileSync(file, SOURCE.replace(bite.find, bite.replace));
    let survived = false;
    try {
      await runDownloadScenarios(await import(pathToFileURL(file).href), bite.name);
      survived = true;
    } catch (error) {
      console.log(`BITE ${bite.name}: ${(error as Error).message.split("\n")[0]!.slice(0, 110)}`);
    } finally {
      rmSync(file, { force: true });
    }
    assert.equal(survived, false, `${bite.name} SURVIVED — the suite does not guard it`);
  }
  finished = true;
  console.log("mv7-generated-video/download-bite-proofs: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
