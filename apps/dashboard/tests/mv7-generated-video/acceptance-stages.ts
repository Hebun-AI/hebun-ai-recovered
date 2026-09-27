/*
 * MV-7 — the real-provider acceptance tooling, behind a FAKE Higgsfield and a fake output host, on a
 * DISPOSABLE Postgres and the real local store, through the RELEASED writers.
 *
 * THE CLAIM: "The CLI refuses anything but the MV-6 request id with the stage's own confirmation,
 * before reading a credential; a valid stage stops at the credential file when there is none. The
 * guarded fetch sends no POST and no GET beyond its budget. `reobserve` reports the provider answer and
 * the URL's SHAPE only. `admit` moves the fixture through the real MV-4 poll and the real admission,
 * then verifies stored bytes, the row, the read model and a signed Range — and when the host is not
 * approved it stops with nothing recorded and no asset. Only the CLI reaches the environment helper."
 */
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import {
  createHiggsfieldVideoTransport,
  higgsfieldStatusUrl,
  type HiggsfieldFetch,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import type { MediaAsyncGenerationTransport } from "../../src/features/media-assets/async-generation-transport";
import {
  MV7_ACCEPTANCE_REQUEST_ID,
  describeReobservation,
  guardedHiggsfieldFetch,
  runAdmissionAcceptance,
  runReobservation,
} from "../../scripts/lib/mv7-generated-video-acceptance";
import { createMv7AcceptanceEnvironment } from "../helpers/mv7-acceptance-environment";

const API_KEY = "hf-test-opaque-key-not-real:0007-gggggggggggggggg";
const SECRET = "SIG-VALUE-MV7-ACCEPTANCE";
const OUTPUT = `https://cdn.example.com/hidden-segment-mv7/out.mp4?Signature=${SECRET}&Expires=9`;
const ID = MV7_ACCEPTANCE_REQUEST_ID;
const STATUS = higgsfieldStatusUrl(ID);

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv7-generated-video/acceptance-stages: exited before completing");
    process.exitCode = 1;
  }
});

function higgsfield(): { fetchImpl: HiggsfieldFetch; seen: { method: string; url: string }[] } {
  const seen: { method: string; url: string }[] = [];
  return {
    seen,
    fetchImpl: async (url, init) => {
      seen.push({ method: init.method, url });
      return new Response(JSON.stringify({ status: "completed", request_id: ID, video: { url: OUTPUT } }), { status: 200 });
    },
  };
}

function synthH264(): Uint8Array {
  const ffmpeg = execFileSync("sh", ["-c", "command -v ffmpeg"], { encoding: "utf8" }).trim();
  const dir = mkdtempSync(path.join(tmpdir(), "mv7-acc-"));
  const out = path.join(dir, "x.mp4");
  execFileSync(ffmpeg, ["-nostdin", "-loglevel", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=1366x768:rate=24:duration=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-brand", "mp42", out]);
  const bytes = new Uint8Array(readFileSync(out));
  rmSync(dir, { recursive: true, force: true });
  return bytes;
}

async function main(): Promise<void> {
  /* ── 1. the CLI refuses before any credential is read ── */
  const cli = (args: string[]) =>
    spawnSync(process.execPath, ["--import", "tsx", "scripts/mv7-generated-video-acceptance.ts", ...args], {
      encoding: "utf8",
      env: { ...process.env, MV6_HIGGSFIELD_ENV_FILE: "/nonexistent/mv7-no-credential" },
    });
  for (const args of [
    [],
    ["reobserve", ID],
    ["reobserve", "00000000-0000-4000-8000-000000000000", "--confirm-one-status-read"],
    ["reobserve", ID, "--confirm-one-output-fetch"],
    ["admit", ID, "--confirm-one-status-read"],
    ["reobserve", ID, "--confirm-one-status-read", "extra"],
    ["generate", ID, "--confirm-one-status-read"],
  ]) {
    const r = cli(args);
    assert.equal(r.status, 1, `refused: ${args.join(" ")}`);
    assert.match(r.stderr, /^REFUSED: usage/m, `usage refusal, not a credential read: ${args.join(" ")}`);
  }
  const admitNow = cli(["admit", ID, "--confirm-one-output-fetch"]);
  assert.equal(admitNow.status, 1);
  assert.match(admitNow.stderr, /MV6_HIGGSFIELD_ENV_FILE/, "with the host approved, a valid admit reaches the credential file, and stops there without one");
  const reobserveNoKey = cli(["reobserve", ID, "--confirm-one-status-read"]);
  assert.match(reobserveNoKey.stderr, /MV6_HIGGSFIELD_ENV_FILE/, "a valid reobserve reaches the credential file, and stops there without one");

  /* ── 2. the guarded fetch: no POST ever leaves; no GET beyond budget or off the status URL ── */
  {
    const h = higgsfield();
    const g = guardedHiggsfieldFetch(h.fetchImpl, { maxGets: 1, allowedUrls: [STATUS] });
    const init = { headers: {}, redirect: "error" as const, cache: "no-store" as const, signal: AbortSignal.timeout(1000) };
    await assert.rejects(g.fetchImpl(STATUS, { ...init, method: "POST", body: "{}" }));
    await assert.rejects(g.fetchImpl("https://api.higgsfield.ai/other", { ...init, method: "GET" }));
    await g.fetchImpl(STATUS, { ...init, method: "GET" });
    await assert.rejects(g.fetchImpl(STATUS, { ...init, method: "GET" }));
    assert.deepEqual(h.seen, [{ method: "GET", url: STATUS }], "exactly one request left: the status GET");
    assert.deepEqual(g.counts, { gets: 1, posts: 1, refused: 3 });
  }

  /* ── 3. reobserve: one GET, located, shape only ── */
  {
    const h = higgsfield();
    const g = guardedHiggsfieldFetch(h.fetchImpl, { maxGets: 1, allowedUrls: [STATUS] });
    const budget = createLiveSpendBudget(0);
    const t = createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, profile: "hailuo-2.3-standard", spendBudget: budget, fetchImpl: g.fetchImpl });
    assert.equal((await t.dispatch({ promptText: "x", inputDigest: "0".repeat(64), invocationId: ID })).status, "rejected", "a zero budget refuses dispatch locally");
    const report = await runReobservation({ transport: t, requestId: ID, counts: g.counts });
    assert.equal(report.reobserved, true);
    assert.equal(report.urlPresent, true);
    assert.equal(report.shape?.hostname, "cdn.example.com");
    assert.deepEqual(report.shape?.queryParameterNames, ["Expires", "Signature"]);
    assert.deepEqual([report.gets, report.posts], [1, 0]);
    assert.deepEqual(h.seen.map((s) => s.method), ["GET"]);
    const text = describeReobservation(report).join("\n") + JSON.stringify(report);
    assert.ok(!text.includes(SECRET) && !text.includes("hidden-segment-mv7") && !text.includes(OUTPUT), "no URL, path or query value in the report");
    assert.match(text, /provider output REOBSERVED — no byte retrieved/);
  }

  /* ── 4. admit, end to end on the disposable environment ── */
  const bytes = synthH264();
  const env = await createMv7AcceptanceEnvironment("hebun_mv7_acceptance_test");
  try {
    const make = () => {
      const h = higgsfield();
      const g = guardedHiggsfieldFetch(h.fetchImpl, { maxGets: 2, allowedUrls: [STATUS] });
      return { h, g, t: createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, profile: "hailuo-2.3-standard", spendBudget: createLiveSpendBudget(0), fetchImpl: g.fetchImpl }) };
    };
    const served: string[] = [];
    const download = {
      get: async (url: URL) => {
        served.push(url.hostname);
        return { status: 200, headers: {}, body: new Blob([bytes as Uint8Array<ArrayBuffer>]).stream() };
      },
    };

    /* 4a. an output on a host that is NOT the approved one: stop, nothing recorded, no asset. */
    {
      const { h, g, t } = make();
      const r = await runAdmissionAcceptance({ env, transport: t, requestId: ID, download });
      assert.equal(r.stop, "not-admitted");
      assert.equal(r.pollOutcome, "provider-succeeded", "the REAL MV-4 poll made provider-succeeded");
      assert.deepEqual(r.admission, { status: "refused", reason: "download-host-not-allowed" });
      assert.equal(r.invocationAdmissionOutcome, "not-attempted");
      assert.deepEqual([r.mediaAssetsBefore, r.mediaAssetsAfter], [0, 0]);
      assert.equal(served.length, 0, "no output byte fetched");
      assert.deepEqual([g.counts.gets, g.counts.posts], [2, 0]);
      assert.ok(h.seen.every((s) => s.method === "GET" && s.url === STATUS));
    }

    /* 4b. with a host approved for the test only: admitted and verified. */
    {
      const { g, t } = make();
      const approved: MediaAsyncGenerationTransport = {
        ...t,
        locateOutput: async (input) => {
          const r = await t.locateOutput!(input);
          return r.status === "located" ? { status: "located", location: { ...r.location, allowedHosts: ["cdn.example.com"] } } : r;
        },
      };
      const r = await runAdmissionAcceptance({ env, transport: approved, requestId: ID, download });
      assert.equal(r.stop, "admitted", JSON.stringify(r));
      assert.equal(r.invocationAdmissionOutcome, "admitted");
      assert.deepEqual([r.mediaAssetsBefore, r.mediaAssetsAfter], [0, 1]);
      assert.equal(r.storedVerified, true);
      assert.equal(r.readModelOrigin, "generated");
      assert.deepEqual([r.rangeStatus, r.rangeBytes], [206, 1024]);
      assert.deepEqual(served, ["cdn.example.com"], "exactly one output fetch");
      assert.deepEqual([g.counts.gets, g.counts.posts], [2, 0]);
      assert.ok(!JSON.stringify(r).includes(SECRET), "no URL in the report");
    }
  } finally {
    await env.dispose();
  }

  /* ── 5. only the CLI (dynamically) and this test reach the environment helper ── */
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const f = path.join(dir, n);
      return statSync(f).isDirectory() ? walk(f) : /\.(ts|tsx)$/.test(n) ? [f] : [];
    });
  const reachers = [...walk("src"), ...walk("scripts"), ...walk("tests")].filter(
    (f) => !f.endsWith("mv7-acceptance-environment.ts") && /(from |import\()"[^"]*mv7-acceptance-environment"/.test(readFileSync(f, "utf8")),
  );
  assert.deepEqual(reachers.sort(), ["scripts/mv7-generated-video-acceptance.ts", "tests/mv7-generated-video/acceptance-stages.ts"]);
  const cliText = readFileSync("scripts/mv7-generated-video-acceptance.ts", "utf8");
  assert.match(cliText, /await import\("\.\.\/tests\/helpers\/mv7-acceptance-environment"\)/, "the CLI reaches it by dynamic import only");
  assert.ok(!/console\.[a-z]+\([^)]*reveal\(/.test(cliText) && !/reveal\(/.test(cliText), "the CLI never reveals a URL");

  finished = true;
  console.log("mv7-generated-video/acceptance-stages: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
