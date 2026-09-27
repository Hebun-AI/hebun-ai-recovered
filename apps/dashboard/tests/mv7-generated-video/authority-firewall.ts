/*
 * MV-7 — authority firewall. Source-level pins that the generated-video admission stays exactly as
 * narrow as its header says.
 *
 *   - the admission writer writes ONLY `admission_outcome` / `admission_failure` on an invocation,
 *     never `state` or any lifecycle column; the MV-4 lifecycle still never writes `admission_outcome`
 *   - the admission writer calls `locateOutput` once and never `dispatch` or `poll`
 *   - `reveal()` is called only by the provider-output download seam
 *   - only the download seam opens an outbound socket (`node:https`) or resolves names (`node:dns`)
 *   - no new file logs, reads configuration, or names a provider
 *   - the video LISTING stays supplied-only; generated videos open by id
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const strip = (c: string): string => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const code = (f: string): string => strip(readFileSync(f, "utf8"));
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? walk(f) : /\.(ts|tsx)$/.test(n) ? [f] : [];
  });
}
const SRC = walk("src");
const WRITER = "src/features/media-assets/admit-generated-video.server.ts";
const LIFECYCLE = "src/features/media-assets/async-generation-lifecycle.server.ts";
const DOWNLOAD = "src/features/media-assets/provider-output-download.server.ts";
const TRANSPORT = "src/features/media-generation-live/higgsfield-video-transport.server.ts";

/* ── the column split between the two invocation writers ── */
{
  const w = code(WRITER);
  const sets = [...w.matchAll(/\.set\(\{([^}]*)\}\)/g)].map((m) => m[1]!);
  assert.equal(sets.length, 2, "two invocation writes: admitted, and a recorded verdict");
  for (const block of sets) {
    const keys = block.split(",").map((p) => p.split(":")[0]!.trim()).filter(Boolean).sort();
    assert.deepEqual(keys, ["admissionFailure", "admissionOutcome"], "the admission writer sets only the admission columns");
  }
  assert.ok(!/\bstate\s*:\s*["'`]/.test(w), "the admission writer never assigns a state value");
  assert.ok(!/\.update\(\s*mediaAssets\s*\)/.test(w), "it never updates an asset");
  assert.ok(!/\.delete\(/.test(w), "it deletes nothing");
  const l = code(LIFECYCLE);
  for (const block of [...l.matchAll(/\.set\(([^)]*)\)/g)].map((m) => m[1]!)) {
    assert.ok(!/admissionOutcome|admissionFailure/.test(block), "the MV-4 lifecycle never writes the admission columns");
  }
  assert.ok(!/patch\s*=\s*\{[^}]*admission/.test(l), "nor through a patch object");
}

/* ── the admission path only re-observes ── */
{
  const w = code(WRITER);
  assert.equal((w.match(/\.locateOutput\(/g) ?? []).length, 1, "one re-observation call site");
  assert.ok(!/\.dispatch\(|\.poll\(|\.generate\(/.test(w), "the admission writer never dispatches, polls or generates");
  assert.ok(!/\breveal\(/.test(w), "the writer never reads the URL itself");
  assert.equal((w.match(/openProviderOutputStream\(/g) ?? []).length, 1, "one output stream call site");
}

/* ── the URL is read in exactly one place; the socket opens in exactly one place ── */
{
  const revealers = SRC.filter((f) => /\.reveal\(\)/.test(code(f)));
  /*
   * IMAGE → VIDEO adds ONE other `reveal()`: the Higgsfield transport reading its OWN prepared SOURCE
   * image URL (the provider's public_url) into the generation body. That is an INPUT URL the transport
   * itself obtained, not a provider OUTPUT URL — so the transport's only reveal must be on
   * `input.source`, and the download seam stays the only reader of an output URL.
   */
  const TRANSPORT = "src/features/media-generation-live/higgsfield-video-transport.server.ts";
  assert.deepEqual(revealers, [DOWNLOAD, TRANSPORT].sort(), "only the download seam reads an output URL; the transport reads only its own source URL");
  const transportReveals = code(TRANSPORT).match(/[\w.]+\.reveal\(\)/g) ?? [];
  assert.deepEqual(transportReveals, ["input.source.reveal()"], "the transport's one reveal is its prepared source, never an output location");
  const sockets = SRC.filter((f) => /from "node:(https|http2|dns|net|tls)"/.test(code(f)) && /features\/media/.test(f));
  assert.deepEqual(sockets, [DOWNLOAD], "only the download seam opens a socket or resolves a name in the media features");
  assert.ok(/lookup: lookup as never/.test(code(DOWNLOAD)), "the default socket connects only through the public-address lookup");
}

/* ── no logging, no configuration, no provider name in the authority's new file ── */
for (const f of [WRITER, DOWNLOAD]) {
  const c = code(f);
  assert.ok(!/console\.|process\.env/.test(c), `${f}: logs nothing, reads no configuration`);
  assert.ok(!/higgsfield|hailuo|minimax/i.test(c), `${f}: provider-neutral`);
}
{
  const t = code(TRANSPORT);
  assert.ok(
    /export const HIGGSFIELD_OUTPUT_HOSTS: readonly string\[\] = Object\.freeze\(\["d3u0tzju9qaucj\.cloudfront\.net"\]\);/.test(t),
    "exactly the one Director-approved output host is in source",
  );
  assert.ok(!/["'`][*.]*cloudfront\.net["'`]/.test(t), "never the CloudFront parent or a wildcard");
}

/* ── the listing stays supplied-only ── */
{
  const r = code("src/features/media-assets/read-media-videos.server.ts");
  const list = r.slice(r.indexOf("export async function listRevisionMediaVideos"), r.indexOf("export type ReadMediaVideoResult"));
  assert.match(list, /eq\(mediaAssets\.suppliedArtifactId, input\.artifactId\)/, "the revision listing still selects supplied videos");
}

console.log("mv7-generated-video/authority-firewall: ok");
