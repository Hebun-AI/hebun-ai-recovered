/*
 * MV-6 — the real-provider generation acceptance stage, behind a FAKE Higgsfield, on a DISPOSABLE
 * Postgres, through the RELEASED MV-4 lifecycle. The global `fetch` throws.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "The acceptance stage registers one invocation, calls dispatch exactly once, and stops without a
 *    second dispatch on every path that is not provider-pending (dispatch-unknown included). It polls
 *    with bounded, documented backoff until the lifecycle records a terminal state, a deadline, or an
 *    unreadable streak. It claims 'VERIFIED' only for provider-succeeded with the request id as the
 *    output reference and no new media_assets row, and claims nothing stronger. The CLI refuses anything
 *    but `generate hailuo --confirm-one-billable-higgsfield-job` before reading a credential. Test
 *    seeding stays acceptance-only: nothing under src/ imports tests/, and only the generation CLI reaches
 *    the acceptance environment, by a dynamic import."
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { createHiggsfieldVideoTransport, type HiggsfieldFetch } from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { describeGenerationAcceptance, runGenerationAcceptance } from "../../scripts/lib/mv6-generation-acceptance";
import { MV6_SYNTHETIC_PROMPT } from "../../scripts/lib/higgsfield-estimate";
import { createMv6AcceptanceEnvironment } from "../helpers/mv6-acceptance-environment";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

const API_KEY = "hf-test-opaque-key-not-real:0004-dddddddddddddddd";
const CDN = "https://cdn.example.com/output.mp4?sig=provider-secret";
const ROOT = process.cwd();
let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv6-higgsfield-video/generation-acceptance: exited before completing");
    process.exitCode = 1;
  }
});

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function fakeHiggsfield(statusAnswers: ((job: string) => Response)[], dispatch: (job: string) => Response = (job) => json(200, { status: "queued", request_id: job })) {
  const calls: { url: string; method: string; body: string | undefined }[] = [];
  const job = crypto.randomUUID();
  const fetchImpl: HiggsfieldFetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body });
    if (init.method === "POST") return dispatch(job);
    const next = statusAnswers.length > 1 ? statusAnswers.shift()! : statusAnswers[0]!;
    return next(job);
  };
  const transport = createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, profile: "hailuo-2.3-standard", spendBudget: createLiveSpendBudget(1), fetchImpl, dispatchTimeoutMs: 50, pollTimeoutMs: 50 });
  return { calls, job, transport };
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

async function main(): Promise<void> {
  const env = await createMv6AcceptanceEnvironment("hebun_mv6_generation_test");
  try {
    const sleeps: number[] = [];
    let clock = 0;
    const base = {
      tenant: env.tenant,
      artifactId: env.artifactId,
      revisionNo: env.revisionNo,
      promptText: MV6_SYNTHETIC_PROMPT,
      getDb: env.getDb,
      countMediaAssets: env.countMediaAssets,
      sleep: async (ms: number) => {
        sleeps.push(ms);
        clock += ms;
      },
      now: () => clock,
      random: () => 0,
    };

    /* ── The happy path: one dispatch, bounded polling, provider-succeeded, no Media ── */
    {
      const hf = fakeHiggsfield([
        (job) => json(200, { status: "queued", request_id: job }),
        (job) => json(200, { status: "in_progress", request_id: job }),
        (job) => json(200, { status: "completed", request_id: job, video: { url: CDN } }),
      ]);
      sleeps.length = 0;
      const e = await runGenerationAcceptance({ ...base, requestKey: crypto.randomUUID(), transport: hf.transport });
      assert.equal(e.stop, "terminal");
      assert.equal(e.finalState, "provider-succeeded");
      assert.equal(e.dispatchCalls, 1);
      assert.equal(hf.calls.filter((c) => c.method === "POST").length, 1, "exactly one generation POST");
      assert.equal(hf.calls[0]!.url, "https://api.higgsfield.ai/minimax/hailuo-2.3/standard/text-to-video");
      assert.deepEqual(JSON.parse(hf.calls[0]!.body!), { prompt: MV6_SYNTHETIC_PROMPT, duration: 6, prompt_optimizer: false });
      assert.equal(e.providerJobId, hf.job);
      assert.equal(e.outputRefIsJobId, true, "the stored reference is the request id, never the URL");
      assert.equal(e.admissionOutcome, "not-attempted", "provider completion is not Media admission");
      assert.equal(e.mediaAssetsAfter, e.mediaAssetsBefore, "no media_assets row");
      assert.equal(e.polls, 3);
      assert.deepEqual(sleeps, [2000, 3000, 4500], "documented backoff: 2 s, ×1.5");
      assert.match(describeGenerationAcceptance(e), /^Higgsfield real-provider lifecycle VERIFIED in the disposable acceptance environment/);
      assert.match(describeGenerationAcceptance(e), /no Media admission, no byte verification/);
      assert.ok(!JSON.stringify(e).includes("cdn.example.com") && !JSON.stringify(e).includes(API_KEY), "no URL or key in the evidence");
    }

    /* ── Ambiguous dispatch: dispatch-unknown, one POST, NEVER a second dispatch, no poll ── */
    for (const [label, dispatch] of [
      ["timeout", () => { throw Object.assign(new Error("aborted"), { name: "TimeoutError" }); }],
      ["502", () => json(502, { detail: "x" })],
      ["429 undocumented", () => json(429, { detail: "x" })],
    ] as const) {
      const hf = fakeHiggsfield([(job) => json(200, { status: "completed", request_id: job, video: { url: CDN } })], dispatch as (job: string) => Response);
      const e = await runGenerationAcceptance({ ...base, requestKey: crypto.randomUUID(), transport: hf.transport });
      assert.equal(e.stop, "dispatch-not-pending", label);
      assert.equal(e.finalState, "dispatch-unknown", label);
      assert.equal(e.dispatchCalls, 1, `${label}: one dispatch`);
      assert.equal(hf.calls.length, 1, `${label}: one POST and no status read`);
      assert.equal(e.providerJobId, null, `${label}: no invented id`);
      assert.match(describeGenerationAcceptance(e), /^NOT VERIFIED/);
    }

    /* ── A documented refusal stops too ───────────────────────────────────────── */
    {
      const hf = fakeHiggsfield([], () => json(403, { detail: "Insufficient credits" }));
      const e = await runGenerationAcceptance({ ...base, requestKey: crypto.randomUUID(), transport: hf.transport });
      assert.equal(e.finalState, "provider-failed");
      assert.equal(e.providerFailure, "quota-exhausted");
      assert.equal(hf.calls.length, 1);
      assert.match(describeGenerationAcceptance(e), /^NOT VERIFIED/);
    }

    /* ── A terminal failure is terminal, and never VERIFIED ───────────────────── */
    for (const [status, failure] of [["failed", "generation-failed"], ["nsfw", "moderation-blocked"], ["canceled", "provider-canceled"]] as const) {
      const hf = fakeHiggsfield([(job) => json(200, { status, request_id: job, error: "Generation failed" })]);
      const e = await runGenerationAcceptance({ ...base, requestKey: crypto.randomUUID(), transport: hf.transport });
      assert.equal(e.stop, "terminal");
      assert.equal(e.finalState, "provider-failed");
      assert.equal(e.providerFailure, failure);
      assert.match(describeGenerationAcceptance(e), /^NOT VERIFIED/);
    }

    /* ── Unreadable streak and deadline stop without inventing a terminal state ── */
    {
      const hf = fakeHiggsfield([() => json(404, { detail: "Not found" })]);
      const e = await runGenerationAcceptance({ ...base, requestKey: crypto.randomUUID(), transport: hf.transport, poll: { maxConsecutiveUnreadable: 3 } });
      assert.equal(e.stop, "unreadable-streak");
      assert.equal(e.finalState, "provider-pending", "the last provider fact is kept");
      assert.equal(e.polls, 3);
      assert.equal(e.unreadableObservations, 3);
      assert.equal(hf.calls.filter((c) => c.method === "POST").length, 1);
    }
    {
      const hf = fakeHiggsfield([(job) => json(200, { status: "in_progress", request_id: job })]);
      const e = await runGenerationAcceptance({ ...base, requestKey: crypto.randomUUID(), transport: hf.transport, poll: { deadlineMs: 20_000 } });
      assert.equal(e.stop, "deadline");
      assert.equal(e.finalState, "provider-pending");
      assert.ok(e.polls > 0 && e.polls < 10, "bounded");
      assert.equal(hf.calls.filter((c) => c.method === "POST").length, 1);
      assert.match(describeGenerationAcceptance(e), /^NOT VERIFIED: stopped at deadline/);
    }
  } finally {
    await env.dispose();
  }

  /* ── The orchestrator writes nothing itself and reaches no authority ─────────── */
  {
    const lib = readFileSync(path.join(ROOT, "scripts/lib/mv6-generation-acceptance.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/\.(insert|update|delete)\(/.test(lib), "no row is written by the orchestrator");
    assert.ok(!/(?<![A-Za-z])mediaAssets\b/.test(lib), "never names the media_assets table (it only calls the injected counter)");
    assert.ok(!/provider-output-download|media-storage|governance|permit|provider-connectivity|tests\//i.test(lib), "no Media, storage, Governance, control or test import");
    assert.equal((lib.match(/dispatchAsyncMediaGeneration\(/g) ?? []).length, 1, "one dispatch call site");
    assert.ok(!/\bwhile\s*\(|retry/i.test(lib), "no retry");
  }

  /* ── Acceptance-only boundary for the test seed ────────────────────────────── */
  {
    const srcFiles = walk(path.join(ROOT, "src")).filter((f) => /\.(ts|tsx)$/.test(f));
    assert.deepEqual(srcFiles.filter((f) => /from ["'][^"']*tests\//.test(readFileSync(f, "utf8"))), [], "nothing under src/ imports tests/");
    const scriptFiles = walk(path.join(ROOT, "scripts")).filter((f) => /\.(ts|mts|mjs)$/.test(f));
    const reaching = scriptFiles.filter((f) => /tests\/helpers\/mv6-acceptance-environment/.test(readFileSync(f, "utf8"))).map((f) => path.relative(ROOT, f));
    assert.deepEqual(reaching, ["scripts/mv6-generate-acceptance.ts"], "only the generation CLI reaches the acceptance environment");
    const cli = readFileSync(path.join(ROOT, "scripts/mv6-generate-acceptance.ts"), "utf8");
    assert.match(cli, /await import\("\.\.\/tests\/helpers\/mv6-acceptance-environment"\)/, "and only by a dynamic import, after the confirmation");
    assert.ok(!/^import .*tests\//m.test(cli), "never a static import");
    assert.ok(!/tests\//.test(readFileSync(path.join(ROOT, "scripts/mv6-acceptance.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "")), "the estimate harness reaches no test seed");
    assert.ok(/createLiveSpendBudget\(1\)/.test(cli) && /profile: "hailuo-2.3-standard"/.test(cli), "one-unit budget, Hailuo profile");
    assert.ok(!/console\.(log|error)\([^;]*\$\{[^}]*(credential|apiKey|authorization)/i.test(cli), "the CLI interpolates no credential into output");
  }

  /* ── The CLI refuses everything but the one exact invocation, before any credential read ── */
  {
    const dir = mkdtempSync(path.join(tmpdir(), "mv6-generate-"));
    try {
      const good = path.join(dir, "good.env");
      writeFileSync(good, `HEBUN_HIGGSFIELD_API_KEY=${API_KEY}\n`);
      for (const args of [[], ["generate"], ["generate", "hailuo"], ["generate", "pixverse", "--confirm-one-billable-higgsfield-job"], ["generate", "hailuo", "--yes"], ["generate", "hailuo", "--confirm-one-billable-higgsfield-job", "2"], ["estimate"]]) {
        const r = spawnSync(process.execPath, ["--import", "tsx", "scripts/mv6-generate-acceptance.ts", ...args], {
          cwd: ROOT,
          encoding: "utf8",
          env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", MV6_HIGGSFIELD_ENV_FILE: good, NODE_OPTIONS: "" } as unknown as NodeJS.ProcessEnv,
        });
        assert.notEqual(r.status, 0, `${args.join(" ") || "(none)"}: refused`);
        assert.match(r.stderr, /REFUSED: usage: .*exactly one billable job/);
        assert.ok(!r.stdout.includes("PASS  credential"), `${args.join(" ") || "(none)"}: refused before the credential is read`);
        assert.ok(!(r.stdout + r.stderr).includes(API_KEY));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  finished = true;
  console.log("mv6-higgsfield-video/generation-acceptance: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
