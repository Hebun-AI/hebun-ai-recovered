/*
 * IMAGE → VIDEO — the source boundary, static over the source. Every rule is checked against the real
 * files AND against a mutation that must be caught.
 *
 * THE CLAIM:
 *
 *   "The client can name a source only by asset ID; the action passes the session tenant. The source
 *    is read from the private store with no read grant minted. The transport's presigned PUT carries
 *    only the documented upload headers — never the credential — and happens before the generation
 *    POST. No provider URL is persisted, and none reaches a component. The image path has its own
 *    control key, which the connectivity ceremony cannot reach in production."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const strip = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const SOURCE = "src/features/media-assets/read-verified-source-image.server.ts";
const TRANSPORT = "src/features/media-generation-live/higgsfield-video-transport.server.ts";
const LIFECYCLE = "src/features/media-assets/async-generation-lifecycle.server.ts";
const DOOR = "src/components/operations-preparation/generate-video-with-hebun.tsx";
const PANEL = "src/components/operations-preparation/revision-media-videos.tsx";
const CEREMONY = "scripts/lib/provider-connectivity.ts";

type Files = Record<string, string>;
type Rule = { readonly name: string; readonly check: (f: Files) => void };

function between(src: string, start: string, end: string): string {
  const i = src.indexOf(start);
  assert.ok(i >= 0, `anchor ${start}`);
  const j = src.indexOf(end, i + start.length);
  return src.slice(i, j < 0 ? undefined : j);
}

const RULES: Rule[] = [
  {
    name: "the client names a source by id only, under the session tenant",
    check: (f) => {
      const body = between(strip(f[ACTIONS]!), "export async function requestVideoGenerationAction(", "\nexport async function ");
      assert.match(body, /sourceAssetId: typeof input\?\.sourceAssetId === "string" \? input\.sourceAssetId : null/, "the action passes an id through, typed");
      assert.ok(!/url|Url|URL|tenantId/.test(body), "the action takes no URL and no tenant");
      assert.match(body, /requestAsyncVideoGeneration\(tenant,/, "the session tenant");
    },
  },
  {
    name: "the source is read from the private store with no grant minted",
    check: (f) => {
      const c = strip(f[SOURCE]!);
      assert.ok(!/createReadAccess|reveal\(|https?:/.test(c), "no read grant, no URL");
      assert.match(c, /storage\.store\.get\(/, "a server-side store read");
      assert.match(c, /createHash\("sha256"\)/, "digested here");
      assert.match(c, /read\.bytes\.byteLength !== row\.byteSize \|\| digest !== row\.byteDigest/, "size AND SHA-256 compared to the row");
    },
  },
  {
    name: "the presigned PUT carries only the documented headers, never the credential",
    check: (f) => {
      const c = strip(f[TRANSPORT]!);
      const put = between(c, "put = await doUpload(", "});");
      assert.match(put, /headers: \{ \.\.\.grant\.headers \}/, "only the checked grant headers");
      assert.ok(!/authorization/i.test(put), "no Authorization on the PUT");
      assert.match(c, /const HIGGSFIELD_UPLOAD_HEADER_NAMES: readonly string\[\] = Object\.freeze\(\["content-type", "x-amz-tagging"\]\)/, "the documented header set");
      assert.match(c, /if \(!tags\.includes\("retention=temporary"\)\) return null;/, "temporary retention is required");
    },
  },
  {
    name: "the upload happens after registration and before the one generation POST",
    check: (f) => {
      const body = between(strip(f[LIFECYCLE]!), "export async function requestAsyncVideoGeneration(", "\n/* ── Poll");
      const reg = body.indexOf("registerAsyncMediaGeneration(");
      const up = body.indexOf("prepareSourceImage(");
      const disp = body.indexOf("dispatchAsyncMediaGeneration(");
      assert.ok(reg >= 0 && up > reg && disp > up, "register → upload → dispatch");
      const refusal = between(body, 'if (prepared.status !== "prepared") {', "source = prepared.source");
      assert.match(refusal, /return \{ status: "registered-not-sent", invocationId: registered\.invocationId, reason \};/, "an upload refusal returns before dispatch");
      assert.ok(!/\b(for|while)\s*\(/.test(body), "no loop, no retry");
    },
  },
  {
    name: "no provider URL is persisted or reaches a component",
    check: (f) => {
      const life = strip(f[LIFECYCLE]!);
      assert.ok(!/reveal\(/.test(life), "the lifecycle never reads the source URL");
      assert.ok(!/publicUrl|public_url|uploadUrl|upload_url/.test(life), "and never names one");
      for (const file of [DOOR, PANEL]) {
        const c = strip(f[file]!);
        assert.ok(!/reveal\(|public_url|publicUrl|upload_url|uploadUrl|image_url/.test(c), `${file}: no provider URL`);
        assert.ok(!/\.server["']/.test(c), `${file}: no server module import`);
      }
    },
  },
  {
    /*
     * Updated by the Director's production-acceptance decision (2026-09-27): the key is now ARMABLE
     * through the existing generic ceremony — named by value in both lists — and still a SEPARATE key.
     */
    name: "image-to-video has its own control, armable only through the existing ceremony",
    check: (f) => {
      const c = strip(f[CEREMONY]!);
      const lists = c.match(/export const (PROVIDER_KEYS|GENERIC_PRODUCTION_REACHABLE_KEYS): readonly string\[\] = Object\.freeze\(\[[\s\S]*?\]\)/g) ?? [];
      assert.equal(lists.length, 2, "both key lists found");
      for (const list of lists) {
        assert.match(list, /HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY,/, "named by value");
        assert.match(list, /HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY,/, "beside, not instead of, the text key");
      }
      assert.ok(!/HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY\s*=/.test(c), "the ceremony defines no key of its own");
    },
  },
];

const files: Files = Object.fromEntries([ACTIONS, SOURCE, TRANSPORT, LIFECYCLE, DOOR, PANEL, CEREMONY].map((f) => [f, read(f)]));
for (const rule of RULES) rule.check(files);

const BITES: { readonly rule: number; readonly file: string; readonly from: string; readonly to: string }[] = [
  { rule: 0, file: ACTIONS, from: "sourceAssetId: typeof input?.sourceAssetId === \"string\" ? input.sourceAssetId : null", to: "sourceAssetId: (input as { sourceUrl?: string }).sourceUrl ?? null" },
  { rule: 1, file: SOURCE, from: "if (read.bytes.byteLength !== row.byteSize || digest !== row.byteDigest) {", to: "if (false) {" },
  { rule: 2, file: TRANSPORT, from: "headers: { ...grant.headers },", to: "headers: { ...grant.headers, authorization: authorization() }," },
  { rule: 2, file: TRANSPORT, from: "if (!tags.includes(\"retention=temporary\")) return null;", to: "" },
  { rule: 3, file: LIFECYCLE, from: "return { status: \"registered-not-sent\", invocationId: registered.invocationId, reason };", to: "void reason;" },
  { rule: 4, file: DOOR, from: "sourceAssetId: sourceAssetId || null,", to: "sourceAssetId: sourceAssetId || null, image_url: promptText," },
  { rule: 5, file: CEREMONY, from: "  HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY,\n]);", to: "]);" },
];
for (const bite of BITES) {
  const original = files[bite.file]!;
  const mutated = original.replace(bite.from, bite.to);
  assert.notEqual(mutated, original, `bite anchor present in ${bite.file}: ${bite.from.slice(0, 40)}`);
  assert.throws(() => RULES[bite.rule]!.check({ ...files, [bite.file]: mutated }), `BITE caught by "${RULES[bite.rule]!.name}"`);
}

console.log(`image-to-video/source-firewall: ok (${RULES.length} rules, ${BITES.length} bites)`);
