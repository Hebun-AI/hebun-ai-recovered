/*
 * MV-6 — the real-provider acceptance harness, stage 1 (cost evidence), behind a FAKE HTTP boundary.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "The harness calls ONLY `POST https://api.higgsfield.ai/estimate/<model>`, once per candidate, with
 *    no retry, a synthetic prompt and the pinned model's exact parameters; it can never reach a
 *    generation, status or cancel URL; it reports credits/usd, an HTTP status, or a closed word, and
 *    never the credential or a provider message. The CLI reads the credential from a named file only,
 *    refuses before any call when it is absent or malformed, and has no generation stage."
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  MV6_ESTIMATE_CANDIDATES,
  MV6_ESTIMATE_SETS,
  MV6_SEEDANCE_ESTIMATE_CANDIDATES,
  MV6_SYNTHETIC_PROMPT,
  estimateCandidates,
  higgsfieldEstimateUrl,
} from "../../scripts/lib/higgsfield-estimate";
import {
  HIGGSFIELD_VIDEO_MODEL_PATH,
  HIGGSFIELD_VIDEO_REQUEST_PARAMETERS,
  type HiggsfieldFetch,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const API_KEY = "hf-test-opaque-key-not-real:0003-cccccccccccccccc";
const CREDENTIAL = { apiKey: API_KEY };
const leaks = (text: string) => text.includes(API_KEY) || text.includes(API_KEY.split(":")[1]!);
let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv6-higgsfield-video/estimate-harness: exited before completing");
    process.exitCode = 1;
  }
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function main(): Promise<void> {
  /* ── Only estimate URLs, one call each, the pinned body for the pinned model ─ */
  {
    const calls: { url: string; init: Parameters<HiggsfieldFetch>[1] }[] = [];
    const answers = [json(200, { credits: "1.500", usd: "0.094" }), json(403, { detail: "Insufficient credits — secret provider text" }), json(200, { credits: 2, usd: 0.125 })];
    const results = await estimateCandidates(CREDENTIAL, async (url, init) => {
      calls.push({ url, init });
      return answers.shift()!;
    });
    assert.equal(calls.length, MV6_ESTIMATE_CANDIDATES.length, "one call per candidate, no retry after the 403");
    for (const c of calls) {
      assert.match(c.url, /^https:\/\/api\.higgsfield\.ai\/estimate\/[a-z0-9./-]+$/, "only the estimate endpoint");
      assert.equal(c.init.method, "POST");
      assert.equal(c.init.redirect, "error");
      assert.equal(c.init.headers.authorization, `Key ${API_KEY}`, "the opaque key verbatim");
      assert.equal(JSON.parse(c.init.body!).prompt, MV6_SYNTHETIC_PROMPT, "synthetic prompt only");
    }
    assert.equal(calls[0]!.url, `https://api.higgsfield.ai/estimate/${HIGGSFIELD_VIDEO_MODEL_PATH}`);
    assert.deepEqual(JSON.parse(calls[0]!.init.body!), { prompt: MV6_SYNTHETIC_PROMPT, ...HIGGSFIELD_VIDEO_REQUEST_PARAMETERS }, "the pinned model is estimated with its exact pinned parameters");
    assert.deepEqual(results.map((r) => r.status), ["estimated", "refused", "estimated"]);
    assert.deepEqual(results[0], { label: MV6_ESTIMATE_CANDIDATES[0]!.label, pinned: true, status: "estimated", credits: "1.500", usd: "0.094" });
    assert.deepEqual(results[1], { label: MV6_ESTIMATE_CANDIDATES[1]!.label, pinned: false, status: "refused", httpStatus: 403 });
    assert.equal((results[2] as { usd: string }).usd, "0.125", "numeric answers are normalised to decimal strings");
    const text = JSON.stringify(results);
    assert.ok(!leaks(text) && !/secret provider text/.test(text), "nothing secret or provider-authored is returned");
    assert.equal(MV6_ESTIMATE_CANDIDATES.filter((c) => c.pinned).length, 1, "exactly one candidate is the pinned model");
  }

  /* ── The Seedance comparison set: measurement only, exact bodies, never the pin ─ */
  {
    assert.deepEqual(Object.keys(MV6_ESTIMATE_SETS).sort(), ["baseline", "seedance"]);
    assert.equal(MV6_ESTIMATE_SETS.baseline, MV6_ESTIMATE_CANDIDATES, "the released baseline set is unchanged");
    assert.equal(MV6_SEEDANCE_ESTIMATE_CANDIDATES.length, 4);
    assert.ok(MV6_SEEDANCE_ESTIMATE_CANDIDATES.every((c) => !c.pinned), "no Seedance candidate is the pinned model");
    assert.equal(HIGGSFIELD_VIDEO_MODEL_PATH, "pixverse/v6/text-to-video", "the production pin stays PixVerse V6");
    const calls: { url: string; body: Record<string, unknown> }[] = [];
    const results = await estimateCandidates(CREDENTIAL, async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body!) });
      return json(200, { credits: "1.000", usd: "0.050" });
    }, MV6_SEEDANCE_ESTIMATE_CANDIDATES);
    assert.equal(calls.length, 4, "one call per Seedance candidate");
    const base = { prompt: MV6_SYNTHETIC_PROMPT, duration: 4, aspect_ratio: "16:9", generate_audio: false };
    assert.deepEqual(calls, [
      { url: "https://api.higgsfield.ai/estimate/bytedance/seedance-2.0/text-to-video", body: { ...base, resolution: "480p" } },
      { url: "https://api.higgsfield.ai/estimate/bytedance/seedance-2.0/text-to-video", body: { ...base, resolution: "720p" } },
      { url: "https://api.higgsfield.ai/estimate/bytedance/seedance-2.5/text-to-video", body: { ...base, resolution: "480p", bitrate_mode: "standard", output_format: "mp4" } },
      { url: "https://api.higgsfield.ai/estimate/bytedance/seedance-2.5/text-to-video", body: { ...base, resolution: "720p", bitrate_mode: "standard", output_format: "mp4" } },
    ], "exact routes and bodies: 4 s, 480p/720p, 16:9, silent; Seedance 2.5 mp4 + standard bitrate");
    assert.ok(results.every((r) => r.status === "estimated" && !r.pinned));
    assert.equal(new Set(MV6_SEEDANCE_ESTIMATE_CANDIDATES.map((c) => c.label)).size, 4, "four distinct labels");
  }

  /* ── Unreachable and unreadable are words, not guesses ─────────────────────── */
  {
    const one = [MV6_ESTIMATE_CANDIDATES[0]!];
    assert.equal((await estimateCandidates(CREDENTIAL, async () => { throw new TypeError("fetch failed"); }, one))[0]!.status, "unreachable");
    for (const body of [{ credits: "-1", usd: "0.1" }, { credits: "1" }, "not json", { credits: "1e9", usd: "x" }]) {
      const r = await estimateCandidates(CREDENTIAL, async () => (typeof body === "string" ? new Response(body, { status: 200 }) : json(200, body)), one);
      assert.equal(r[0]!.status, "unreadable", JSON.stringify(body));
    }
    assert.throws(() => higgsfieldEstimateUrl("../requests/x/cancel"), "no path escape");
  }

  /* ── The harness can reach nothing but the estimate endpoint ───────────────── */
  {
    const root = process.cwd();
    const strip = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    const lib = strip(readFileSync(path.join(root, "scripts/lib/higgsfield-estimate.ts"), "utf8"));
    const cli = strip(readFileSync(path.join(root, "scripts/mv6-acceptance.ts"), "utf8"));
    for (const [name, src] of [["lib", lib], ["cli", cli]] as const) {
      assert.ok(!/HIGGSFIELD_VIDEO_SUBMIT_URL|higgsfieldStatusUrl|createHiggsfieldVideoTransport|\/requests\/|\/cancel|hf_webhook/.test(src), `${name}: no generation, status, cancel or webhook reach`);
      assert.ok(!/dispatchAsyncMediaGeneration|registerAsyncMediaGeneration|pollAsyncMediaGeneration|DATABASE_URL|@\/db|drizzle|provider-connectivity/.test(src), `${name}: no lifecycle, database or control`);
      assert.ok(!/\bwhile\s*\(|retry|backoff/i.test(src), `${name}: no retry`);
    }
    assert.ok(!/console\.(log|error)\([^;]*(\$\{[^}]*(credential|apiKey|authorization|process\.env)|,\s*(credential|process\.env))/i.test(cli), "the CLI interpolates no credential into any output");
  }

  /* ── The CLI refuses before any call, and has no generation stage ──────────── */
  {
    const dir = mkdtempSync(path.join(tmpdir(), "mv6-harness-"));
    const run = (args: string[], env: Record<string, string>) =>
      spawnSync(process.execPath, ["--import", "tsx", "scripts/mv6-acceptance.ts", ...args], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", ...env, NODE_OPTIONS: "" } as unknown as NodeJS.ProcessEnv,
      });
    try {
      const missing = run(["estimate"], { MV6_HIGGSFIELD_ENV_FILE: path.join(dir, "absent") });
      assert.notEqual(missing.status, 0);
      assert.match(missing.stderr, /REFUSED: .*does not exist/);

      const bad = path.join(dir, "bad.env");
      writeFileSync(bad, "HEBUN_HIGGSFIELD_API_KEY=short\n");
      const malformed = run(["estimate"], { MV6_HIGGSFIELD_ENV_FILE: bad });
      assert.notEqual(malformed.status, 0);
      assert.match(malformed.stderr, /REFUSED: .*values not shown/);
      assert.ok(!malformed.stderr.includes("short"), "a malformed value is not echoed");

      /* The retired pair alone is not a credential: refused before any call, nothing echoed. */
      const retired = path.join(dir, "retired.env");
      writeFileSync(retired, `HEBUN_HIGGSFIELD_API_KEY_ID=hf-retired-id-0001\nHEBUN_HIGGSFIELD_API_KEY_SECRET=${API_KEY}\n`);
      const retiredRun = run(["estimate"], { MV6_HIGGSFIELD_ENV_FILE: retired });
      assert.notEqual(retiredRun.status, 0, "the retired id/secret contract is not read");
      assert.match(retiredRun.stderr, /REFUSED: .*values not shown/);
      assert.ok(!leaks(retiredRun.stdout + retiredRun.stderr) && !(retiredRun.stdout + retiredRun.stderr).includes("hf-retired-id-0001"), "and nothing is echoed");

      /* A bare uuid is the console's record id ("Copy ID"), not the key: refused before any call. */
      const recordId = "0f8b6c1e-3a2d-4b7e-9c1a-5d4e3f2a1b0c";
      for (const value of [recordId, recordId.toUpperCase()]) {
        const idFile = path.join(dir, "record-id.env");
        writeFileSync(idFile, `HEBUN_HIGGSFIELD_API_KEY=${value}\n`);
        for (const cmd of ["preflight", "estimate"]) {
          const r = run([cmd], { MV6_HIGGSFIELD_ENV_FILE: idFile });
          assert.notEqual(r.status, 0, `${cmd}: a bare uuid is refused`);
          assert.match(r.stderr, /REFUSED: .*record id \(Copy ID\).*values not shown/);
          assert.ok(!(r.stdout + r.stderr).toLowerCase().includes(recordId), `${cmd}: the uuid is not echoed`);
          assert.ok(!/\b36\b|length/i.test(r.stdout + r.stderr), `${cmd}: no length is printed`);
        }
      }
      /* A uuid INSIDE a longer key is not a record id. */
      const embedded = path.join(dir, "embedded.env");
      writeFileSync(embedded, `HEBUN_HIGGSFIELD_API_KEY=${recordId}:not-only-a-uuid\n`);
      assert.equal(run(["preflight"], { MV6_HIGGSFIELD_ENV_FILE: embedded }).status, 0, "a key that merely contains a uuid passes");

      const good = path.join(dir, "good.env");
      writeFileSync(good, `HEBUN_HIGGSFIELD_API_KEY=${API_KEY}\n`);
      const empty = path.join(dir, "empty.env");
      writeFileSync(empty, "# nothing here\n");
      const ambient = run(["preflight"], { MV6_HIGGSFIELD_ENV_FILE: empty, HEBUN_HIGGSFIELD_API_KEY: API_KEY });
      assert.notEqual(ambient.status, 0, "the ambient environment is never the credential source");
      const pre = run(["preflight"], { MV6_HIGGSFIELD_ENV_FILE: good });
      assert.equal(pre.status, 0, pre.stderr);
      assert.ok(!leaks(pre.stdout + pre.stderr), "preflight prints no value");

      for (const args of [["estimate", "all"], ["estimate", "seedance", "extra"], ["estimate", "generate"]]) {
        const r = run(args, { MV6_HIGGSFIELD_ENV_FILE: good });
        assert.notEqual(r.status, 0, `${args.join(" ")}: refused`);
        assert.match(r.stderr, /usage: .*no generation stage here/);
      }
      /* The Seedance set is refused exactly like the baseline when the credential is missing. */
      const seedanceMissing = run(["estimate", "seedance"], { MV6_HIGGSFIELD_ENV_FILE: path.join(dir, "absent") });
      assert.notEqual(seedanceMissing.status, 0);
      assert.match(seedanceMissing.stderr, /REFUSED: .*does not exist/);

      for (const cmd of ["generate", "dispatch", "poll", ""]) {
        const r = run(cmd ? [cmd] : [], { MV6_HIGGSFIELD_ENV_FILE: good });
        assert.notEqual(r.status, 0, `${cmd || "(none)"}: refused`);
        assert.match(r.stderr, /no generation stage here/);
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  finished = true;
  console.log("mv6-higgsfield-video/estimate-harness: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
