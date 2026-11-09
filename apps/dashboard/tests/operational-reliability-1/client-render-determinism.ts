/*
 * MEDIA3-ADMITTED-AT-HYDRATION-1 — and the same defect class wherever a client component renders.
 *
 * `/operations` raised React #418 on every load: `AssetCard` printed `admittedAt` with the runtime's
 * locale and zone, once on the server (UTC) and once in the browser, so the hydrated text differed.
 * APPROVALS-EXPIRY-HYDRATION-1 fixed the same thing on `/approvals` with `utcInstant`; five more client
 * components still carried it (two dashboard snapshots, draft videos, Heby conversations) and the
 * Knowledge ingestion card printed counts with the runtime's locale ("1,000" on a UTC server,
 * "1.000" in a Turkish browser).
 *
 * Two checks:
 *   1. RENDER. The asset card is rendered under four process zones and the markup must be identical,
 *      showing the stored instant. A negative control first proves the harness sees the defect.
 *   2. CENSUS. No `"use client"` file under src/ calls `toLocaleString` / `toLocaleDateString` /
 *      `toLocaleTimeString` without an explicit locale, nor formats a Date with a locale method at all
 *      (a fixed locale still prints the runtime's zone). Instants go through `utcInstant`.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RevisionMediaAssets, type RevisionMediaAssetView } from "../../src/components/operations-preparation/revision-media-assets";
import { utcInstant } from "../../src/lib/format";

const ROOT = path.resolve(__dirname, "../..");
const ZONES = ["UTC", "Europe/Istanbul", "America/Los_Angeles", "Asia/Kolkata"];
const ADMITTED = "2026-10-17T19:21:11.000Z";

function inZone<T>(zone: string, run: () => T): T {
  const previous = process.env.TZ;
  process.env.TZ = zone;
  try {
    return run();
  } finally {
    process.env.TZ = previous;
  }
}

/* Negative control: the old expression really does differ across zones in this process. */
const old = ZONES.map((z) => inZone(z, () => new Date(ADMITTED).toLocaleString()));
assert.ok(new Set(old).size > 1, "harness cannot see a zone-dependent render; the check below would prove nothing");

/* 1. RENDER */
const asset: RevisionMediaAssetView = {
  assetId: "a1", mimeType: "image/png", byteSize: 2048, byteDigest: "d", width: 1024, height: 1024,
  admittedAt: ADMITTED, lifecycle: "admitted", sourceArtifactId: "art", sourceRevisionNo: 2,
  origin: "supplied", suppliedSource: "google-drive", suppliedSourceFileId: "f",
};
const render = () =>
  renderToStaticMarkup(createElement(RevisionMediaAssets, { assets: [asset], reviewStates: [{ assetId: "a1", state: { status: "unavailable" } }] }));
const markups = ZONES.map((z) => inZone(z, render));
assert.equal(new Set(markups).size, 1, "the asset card renders identically in every zone");
assert.ok(markups[0]!.includes(utcInstant(ADMITTED)), "the stored instant is shown, explicitly as UTC");
console.log(`ok render: asset card identical across ${ZONES.length} zones, shows ${utcInstant(ADMITTED)}`);

/* 2. CENSUS */
function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : /\.(tsx?|jsx?)$/.test(e.name) ? [p] : [];
  });
}
const LOCALE_CALL = /\.toLocale(String|DateString|TimeString)\(([^)]*)\)/g;
const offenders: string[] = [];
let clientFiles = 0;
for (const file of walk(path.join(ROOT, "src"))) {
  const code = readFileSync(file, "utf8");
  if (!/^\s*["']use client["']/m.test(code.slice(0, 200))) continue;
  clientFiles++;
  code.split("\n").forEach((line, i) => {
    for (const m of line.matchAll(LOCALE_CALL)) {
      const args = m[2]!.trim();
      const where = `${path.relative(ROOT, file)}:${i + 1}`;
      if (m[1] !== "String" || args === "" || args.startsWith("undefined")) offenders.push(`${where} ${m[0]}`);
      else if (/new Date\(|[Dd]ate\b/.test(line.slice(0, m.index))) offenders.push(`${where} formats a Date with a locale method`);
    }
  });
}
assert.deepEqual(offenders, [], `client components must render deterministically:\n${offenders.join("\n")}`);
console.log(`ok census: ${clientFiles} client files, no runtime-locale or runtime-zone formatting`);
console.log("PASS client render determinism");
