/*
 * INSTAGRAM-MEDIA-COMPATIBILITY-1 — the pure contract and the two structural facts the "an ordinary
 * incompatible image never reaches post-commit execution" argument rests on:
 *
 *   1. Meta's documented feed range and byte ceiling, at their exact integer boundaries.
 *   2. The rule has ONE owner: the Instagram verifier. The Content Package never learns it.
 *   3. After admission, nothing in src/ writes an asset's width or height. The only `media_assets`
 *      update is retirement, and it sets no dimension — so a pre-flight pass holds after the spend.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  INSTAGRAM_MAX_PUBLISH_IMAGE_BYTES,
  isInstagramFeedAspect,
  isInstagramPublishImageSize,
} from "../../src/features/instagram-publishing/verify-instagram-package.server";

/* 1 · aspect, inclusive both ends, integer-exact */
for (const [w, h] of [[800, 1000], [1122, 1402], [1080, 1080], [191, 100], [1910, 1000], [4, 5]] as const)
  assert.equal(isInstagramFeedAspect(w, h), true, `${w}x${h} is inside 4:5..1.91:1`);
for (const [w, h] of [[799, 1000], [1400, 1931], [2000, 2601], [192, 100], [1911, 1000], [0, 10], [10, 0], [1.5, 2]] as const)
  assert.equal(isInstagramFeedAspect(w, h), false, `${w}x${h} is outside 4:5..1.91:1`);

/* 1 · bytes */
assert.equal(INSTAGRAM_MAX_PUBLISH_IMAGE_BYTES, 8_000_000);
assert.equal(isInstagramPublishImageSize(8_000_000), true, "8,000,000 is allowed");
assert.equal(isInstagramPublishImageSize(8_000_001), false, "8,000,001 is not");
assert.equal(isInstagramPublishImageSize(0), false, "an empty image is not");

/* 2 · one owner */
const SRC = path.join(process.cwd(), "src");
const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : []));
const all = files(SRC).map((f) => ({ f: path.relative(process.cwd(), f), text: readFileSync(f, "utf8") }));
const owners = all.filter((x) => /191 \* height|INSTAGRAM_MAX_PUBLISH_IMAGE_BYTES =/.test(x.text)).map((x) => x.f);
assert.deepEqual(owners, ["src/features/instagram-publishing/verify-instagram-package.server.ts"], "the contract is defined once, in the verifier");
for (const x of all.filter((x) => x.f.startsWith("src/features/content-composition/")))
  assert.ok(!/isInstagramFeedAspect|INSTAGRAM_MAX_PUBLISH_IMAGE_BYTES|image-aspect-unsupported/.test(x.text), `${x.f}: the Content Package stays destination-neutral`);

/* 3 · no dimension writer after admission */
const updaters = all.filter((x) => /\.update\(mediaAssets\)/.test(x.text)).map((x) => x.f);
assert.deepEqual(updaters, ["src/features/media-assets/retire-media-asset.server.ts"], "retirement is the only media_assets update");
const retire = all.find((x) => x.f === updaters[0])!.text;
const setBlock = retire.slice(retire.indexOf(".update(mediaAssets)"), retire.indexOf(".where(", retire.indexOf(".update(mediaAssets)")));
assert.ok(!/\b(width|height)\b/.test(setBlock), "retirement sets no dimension");
for (const x of all) assert.ok(!/update\s+media_assets\s+set[^;]*\b(width|height)\b/i.test(x.text), `${x.f}: no raw SQL dimension writer`);

console.log("PASS instagram-media-compatibility-1 contract (boundaries, one owner, no dimension writer)");
