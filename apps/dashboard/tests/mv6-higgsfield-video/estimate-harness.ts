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

const CREDENTIAL = { keyId: "hf-test-key-id-not-real-0003", keySecret: "hf-test-secret-not-real-222222222222" };
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
      assert.equal(c.init.headers.authorization, `Key ${CREDENTIAL.keyId}:${CREDENTIAL.keySecret}`);
      assert.equal(JSON.parse(c.init.body!).prompt, MV6_SYNTHETIC_PROMPT, "synthetic prompt only");
    }
    assert.equal(calls[0]!.url, `https://api.higgsfield.ai/estimate/${HIGGSFIELD_VIDEO_MODEL_PATH}`);
    assert.deepEqual(JSON.parse(calls[0]!.init.body!), { prompt: MV6_SYNTHETIC_PROMPT, ...HIGGSFIELD_VIDEO_REQUEST_PARAMETERS }, "the pinned model is estimated with its exact pinned parameters");
    assert.deepEqual(results.map((r) => r.status), ["estimated", "refused", "estimated"]);
    assert.deepEqual(results[0], { label: MV6_ESTIMATE_CANDIDATES[0]!.label, pinned: true, status: "estimated", credits: "1.500", usd: "0.094" });
    assert.deepEqual(results[1], { label: MV6_ESTIMATE_CANDIDATES[1]!.label, pinned: false, status: "refused", httpStatus: 403 });
    assert.equal((results[2] as { usd: string }).usd, "0.125", "numeric answers are normalised to decimal strings");
    const text = JSON.stringify(results);
    assert.ok(!text.includes(CREDENTIAL.keySecret) && !text.includes(CREDENTIAL.keyId) && !/secret provider text/.test(text), "nothing secret or provider-authored is returned");
    assert.equal(MV6_ESTIMATE_CANDIDATES.filter((c) => c.pinned).length, 1, "exactly one candidate is the pinned model");
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
    assert.ok(!/console\.(log|error)\([^;]*(\$\{[^}]*(credential|keySecret|keyId|authorization|process\.env)|,\s*(credential|process\.env))/i.test(cli), "the CLI interpolates no credential into any output");
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
      writeFileSync(bad, "HEBUN_HIGGSFIELD_API_KEY_ID=short\nHEBUN_HIGGSFIELD_API_KEY_SECRET=x\n");
      const malformed = run(["estimate"], { MV6_HIGGSFIELD_ENV_FILE: bad });
      assert.notEqual(malformed.status, 0);
      assert.match(malformed.stderr, /REFUSED: .*values not shown/);
      assert.ok(!malformed.stderr.includes("short"), "a malformed value is not echoed");

      const combined = path.join(dir, "combined.env");
      writeFileSync(combined, `HEBUN_HIGGSFIELD_API_KEY_ID=${CREDENTIAL.keyId}\nHEBUN_HIGGSFIELD_API_KEY_SECRET=${CREDENTIAL.keyId}:${CREDENTIAL.keySecret}\n`);
      const combinedRun = run(["estimate"], { MV6_HIGGSFIELD_ENV_FILE: combined });
      assert.notEqual(combinedRun.status, 0, "the combined id:secret is refused before any call");
      assert.match(combinedRun.stderr, /REFUSED: .*values not shown/);
      assert.ok(!(combinedRun.stdout + combinedRun.stderr).includes(CREDENTIAL.keySecret) && !(combinedRun.stdout + combinedRun.stderr).includes(CREDENTIAL.keyId), "and nothing is echoed");

      const good = path.join(dir, "good.env");
      writeFileSync(good, `HEBUN_HIGGSFIELD_API_KEY_ID=${CREDENTIAL.keyId}\nHEBUN_HIGGSFIELD_API_KEY_SECRET=${CREDENTIAL.keySecret}\n`);
      const empty = path.join(dir, "empty.env");
      writeFileSync(empty, "# nothing here\n");
      const ambient = run(["preflight"], { MV6_HIGGSFIELD_ENV_FILE: empty, HEBUN_HIGGSFIELD_API_KEY_ID: CREDENTIAL.keyId, HEBUN_HIGGSFIELD_API_KEY_SECRET: CREDENTIAL.keySecret });
      assert.notEqual(ambient.status, 0, "the ambient environment is never the credential source");
      const pre = run(["preflight"], { MV6_HIGGSFIELD_ENV_FILE: good });
      assert.equal(pre.status, 0, pre.stderr);
      assert.ok(!(pre.stdout + pre.stderr).includes(CREDENTIAL.keySecret) && !(pre.stdout + pre.stderr).includes(CREDENTIAL.keyId), "preflight prints no value");

      for (const cmd of ["generate", "dispatch", "poll", ""]) {
        const r = run(cmd ? [cmd] : [], { MV6_HIGGSFIELD_ENV_FILE: good });
        assert.notEqual(r.status, 0, `${cmd || "(none)"}: refused`);
        assert.match(r.stderr, /no generation stage exists in this build/);
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
