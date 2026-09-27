/*
 * VIDEO CONTENT CHAIN — the application door adds NO authority. Static, over the source.
 *
 * THE CLAIM:
 *
 *   "The four video actions are pass-throughs: each resolves the tenant from the trusted session and
 *    calls exactly one released function — the MV-4 register-then-dispatch, the MV-4 poll, the MV-7
 *    admission, or a read. No action takes a tenant. The register-then-dispatch helper dispatches only
 *    the row it registered, once, with no loop. No new file writes a media table. The two video
 *    surfaces read no configuration, reach no provider module, name no provider output reference,
 *    and schedule nothing: completion is observed only when a human clicks."
 *
 * Every rule is checked against the real source AND against a mutated copy that must be caught, so a
 * rule that cannot fail is reported rather than trusted.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'])\/\/.*$/gm, "$1");

const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const LIFECYCLE = "src/features/media-assets/async-generation-lifecycle.server.ts";
const DOOR = "src/components/operations-preparation/generate-video-with-hebun.tsx";
const PANEL = "src/components/operations-preparation/revision-media-videos.tsx";
const REVIEW = "src/features/media-asset-review/review-media-asset.server.ts";
const SELECT = "src/features/content-composition/select-media.server.ts";

function fnBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  /* The body opens at the first `{` that ends a line right after `)` or a return type's `>`. */
  const m = /[)>]\s*\{\n/.exec(src.slice(start));
  assert.ok(m, `${name} has a body`);
  const open = start + m.index + m[0].indexOf("{");
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}" && --depth === 0) return src.slice(open, i + 1);
  }
  throw new Error(`unterminated ${name}`);
}

type Rule = { readonly name: string; readonly check: (files: Record<string, string>) => void };

const PASS_THROUGH: Record<string, RegExp> = {
  requestVideoGenerationAction: /requestAsyncVideoGeneration\(tenant,/,
  observeVideoGenerationAction: /pollAsyncMediaGeneration\(await resolveTenantContext\(\),/,
  admitGeneratedVideoAction: /admitGeneratedVideo\(await resolveTenantContext\(\),/,
  listArtifactVideoGenerationsAction: /listArtifactVideoGenerations\(await resolveTenantContext\(\),/,
  listArtifactMediaVideosAction: /listArtifactMediaVideos\(await resolveTenantContext\(\),/,
};

const RULES: Rule[] = [
  {
    name: "each video action calls one released function with the session tenant",
    check: (f) => {
      const src = stripComments(f[ACTIONS]!);
      for (const [action, call] of Object.entries(PASS_THROUGH)) {
        const body = fnBody(src, action);
        assert.match(body, call, `${action} passes the session tenant to its one authority`);
        assert.ok(!/tenantId/.test(body), `${action} takes no tenant`);
        assert.ok(!/\b(for|while)\s*\(|setTimeout|setInterval|retry/i.test(body), `${action} does not loop or retry`);
        assert.ok(!/dispatchAsyncMediaGeneration|registerAsyncMediaGeneration/.test(body), `${action} does not assemble the lifecycle itself`);
      }
    },
  },
  {
    name: "register-then-dispatch dispatches only the row it registered, once",
    check: (f) => {
      const body = fnBody(stripComments(f[LIFECYCLE]!), "requestAsyncVideoGeneration");
      assert.equal((body.match(/registerAsyncMediaGeneration\(/g) ?? []).length, 1, "one registration");
      assert.equal((body.match(/dispatchAsyncMediaGeneration\(/g) ?? []).length, 1, "one dispatch");
      assert.match(body, /dispatchAsyncMediaGeneration\(tenant, registered\.invocationId,/, "the dispatched row is the registered one");
      assert.match(body, /if \(registered\.status !== "registered"\) return registered;/, "a refused or duplicate registration dispatches nothing");
      assert.ok(!/\b(for|while)\s*\(|setTimeout|setInterval|pollAsyncMediaGeneration/.test(body), "no loop, no wait, no poll");
    },
  },
  {
    name: "the video surfaces read no configuration, reach no provider and schedule nothing",
    check: (f) => {
      for (const file of [DOOR, PANEL]) {
        const c = stripComments(f[file]!);
        assert.ok(!/process\.env/.test(c), `${file}: reads no configuration`);
        assert.ok(!/media-generation-live|higgsfield|HEBUN_/i.test(c), `${file}: reaches no provider module or credential`);
        assert.ok(!/providerOutputRef|provider_output_ref|reveal\(/.test(c), `${file}: names no provider output`);
        assert.ok(!/setInterval|setTimeout|requestAnimationFrame/.test(c), `${file}: schedules no observation`);
        assert.ok(!/\.server["']/.test(c), `${file}: imports no server module, not even a type`);
        assert.ok(!/tenantId/.test(c), `${file}: sends no tenant`);
      }
    },
  },
  {
    name: "review and selection gate video on the invocation's own output kind",
    check: (f) => {
      for (const file of [REVIEW, SELECT]) {
        const c = stripComments(f[file]!);
        assert.match(c, /outputMediaKind/, `${file}: reads the invocation's output kind`);
        assert.match(c, /asset-kind-incoherent/, `${file}: refuses a kind that contradicts its provenance`);
        assert.ok(!/asset-not-image/.test(c), `${file}: the MV-2 blanket refusal is gone`);
      }
      /* Named comparisons, so deleting the coherence check itself is caught — not just its words. */
      assert.match(stripComments(f[SELECT]!), /parents\.assetKind !== parents\.invocationOutputKind/, "selection compares kind to provenance");
      assert.match(stripComments(f[REVIEW]!), /asset\.mediaKind !== asset\.invocationOutputKind/, "review compares kind to provenance");
      assert.match(stripComments(f[SELECT]!), /eq\(mediaGenerationInvocations\.sourceArtifactId, input\.artifactId\)/, "MEDIA-SELECT-INTEGRITY still binds the draft");
    },
  },
];

const files: Record<string, string> = Object.fromEntries([ACTIONS, LIFECYCLE, DOOR, PANEL, REVIEW, SELECT].map((f) => [f, read(f)]));
for (const rule of RULES) rule.check(files);

/* ── Bites: each mutation must be caught by the rule that claims it ── */
const BITES: { readonly rule: string; readonly file: string; readonly from: string | RegExp; readonly to: string }[] = [
  { rule: RULES[0]!.name, file: ACTIONS, from: "requestAsyncVideoGeneration(tenant, {", to: "requestAsyncVideoGeneration({ tenantId: input.artifactId } as never, {" },
  { rule: RULES[1]!.name, file: LIFECYCLE, from: "if (registered.status !== \"registered\") return registered;", to: "" },
  { rule: RULES[1]!.name, file: LIFECYCLE, from: "const dispatched = await dispatchAsyncMediaGeneration(tenant, registered.invocationId, deps);", to: "let dispatched = await dispatchAsyncMediaGeneration(tenant, registered.invocationId, deps); while (dispatched.status === \"refused\") dispatched = await dispatchAsyncMediaGeneration(tenant, registered.invocationId, deps);" },
  { rule: RULES[2]!.name, file: PANEL, from: "const [pending, start] = useTransition();", to: "const [pending, start] = useTransition(); setInterval(() => undefined, 5000);" },
  { rule: RULES[3]!.name, file: SELECT, from: /parents\.assetKind !== parents\.invocationOutputKind/, to: "false" },
  { rule: RULES[3]!.name, file: REVIEW, from: /asset\.mediaKind !== asset\.invocationOutputKind/, to: "false" },
];
for (const bite of BITES) {
  const original = files[bite.file]!;
  const mutated = typeof bite.from === "string" ? original.replace(bite.from, bite.to) : original.replace(bite.from, bite.to);
  assert.notEqual(mutated, original, `bite anchor present in ${bite.file}`);
  const rule = RULES.find((r) => r.name === bite.rule)!;
  assert.throws(() => rule.check({ ...files, [bite.file]: mutated }), `BITE caught by "${bite.rule}"`);
}

console.log(`video-content-chain/chain-firewall: ok (${RULES.length} rules, ${BITES.length} bites)`);
