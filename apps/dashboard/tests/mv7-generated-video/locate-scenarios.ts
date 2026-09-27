/*
 * MV-7 `locateOutput` scenarios for the Higgsfield transport, parameterised by the transport module so
 * the SAME claims run against the released file (locate-contract.ts) and broken copies
 * (locate-bite-proofs.ts). Behind a FAKE HTTP boundary; no request leaves the process.
 *
 * THE CLAIM: "locateOutput is exactly ONE GET of the documented status URL for a job Hebun already
 * holds. It sends no POST, spends no budget and needs no budget. A completed job with an https video
 * URL is `located`; the location's enumerable facts are the URL's SHAPE only (scheme, hostname,
 * query parameter NAMES, path structure) — the URL, its path and its query values are reachable only
 * through `reveal()` and never appear in JSON or `util.inspect`. Every other answer is a closed
 * non-location. The output host allowlist is EMPTY until the Director approves a host."
 */
import assert from "node:assert/strict";
import { inspect } from "node:util";
import type * as Transport from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";

type TransportModule = typeof Transport;

const API_KEY = "hf-test-opaque-key-not-real:0001-aaaaaaaaaaaaaaaa";
export const JOB = "f23c6488-d651-4acc-8cef-206ceb96cec7";
const SECRET_VALUE = "q-SIGNED-VALUE-MV7";
const SECRET_PATH = "secret-path-segment-mv7";
const OUTPUT = `https://cdn.provider.test/${SECRET_PATH}/abc/output.mp4?Expires=1&Signature=${SECRET_VALUE}&Key-Pair-Id=K1`;

type Call = { url: string; method: string; body?: string; authorization?: string };

function fakeFetch(answer: (url: string) => { status: number; body?: unknown }) {
  const calls: Call[] = [];
  const fetchImpl: Transport.HiggsfieldFetch = async (url, init) => {
    calls.push({ url, method: init.method, body: init.body, authorization: init.headers.authorization });
    const a = answer(url);
    return new Response(a.body === undefined ? "" : JSON.stringify(a.body), { status: a.status, headers: { "content-type": "application/json" } });
  };
  return { calls, fetchImpl };
}

export async function runLocateScenarios(mod: TransportModule, label: string): Promise<void> {
  const statusUrl = mod.higgsfieldStatusUrl(JOB);
  assert.deepEqual([...mod.HIGGSFIELD_OUTPUT_HOSTS], [], `${label}: no output host is trusted until the Director approves one`);

  /* ── 1. completed + https URL → located; one GET; no POST; no budget spent, none needed ── */
  for (const limit of [0, 1]) {
    const budget = createLiveSpendBudget(limit);
    const f = fakeFetch(() => ({ status: 200, body: { status: "completed", request_id: JOB, video: { url: OUTPUT } } }));
    const t = mod.createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, profile: "hailuo-2.3-standard", spendBudget: budget, fetchImpl: f.fetchImpl });
    const r = await t.locateOutput!({ providerJobId: JOB });
    assert.equal(r.status, "located", `${label}: located with budget ${limit}`);
    assert.equal(f.calls.length, 1, `${label}: exactly one request`);
    assert.deepEqual([f.calls[0]!.method, f.calls[0]!.url, f.calls[0]!.body], ["GET", statusUrl, undefined], `${label}: the one request is the status GET`);
    assert.equal(f.calls[0]!.authorization, `Key ${API_KEY}`);
    assert.equal(budget.spent(), 0, `${label}: re-observation spends nothing`);
    if (r.status === "located") {
      const loc = r.location;
      assert.equal(loc.reveal(), OUTPUT, `${label}: the download seam can read it`);
      assert.deepEqual(loc.shape, {
        scheme: "https", hostname: "cdn.provider.test", hasPort: false, hasCredentials: false,
        queryParameterNames: ["Expires", "Key-Pair-Id", "Signature"], pathSegmentCount: 3, pathExtension: ".mp4",
      }, `${label}: shape only`);
      assert.deepEqual([...loc.allowedHosts], [], `${label}: nothing is downloadable yet`);
      for (const view of [JSON.stringify(r), inspect(r, { depth: 10, showHidden: true })]) {
        assert.ok(!view.includes(SECRET_VALUE) && !view.includes(SECRET_PATH) && !view.includes(OUTPUT), `${label}: no URL, path or query value in a printed location`);
      }
    }
  }

  /* ── 2. every other answer is a closed non-location, and still only a GET ── */
  const cases: [string, { status: number; body?: unknown }, unknown][] = [
    ["queued", { status: 200, body: { status: "queued", request_id: JOB } }, { status: "not-located", reason: "pending" }],
    ["in_progress", { status: 200, body: { status: "in_progress", request_id: JOB } }, { status: "not-located", reason: "pending" }],
    ["failed", { status: 200, body: { status: "failed", request_id: JOB, error: "boom" } }, { status: "not-located", reason: "failed" }],
    ["nsfw", { status: 200, body: { status: "nsfw", request_id: JOB } }, { status: "not-located", reason: "failed" }],
    ["canceled", { status: 200, body: { status: "canceled", request_id: JOB } }, { status: "not-located", reason: "failed" }],
    ["completed, no url", { status: 200, body: { status: "completed", request_id: JOB } }, { status: "not-located", reason: "no-output" }],
    ["completed, http url", { status: 200, body: { status: "completed", request_id: JOB, video: { url: "http://cdn.provider.test/x.mp4" } } }, { status: "not-located", reason: "no-output" }],
    ["other job", { status: 200, body: { status: "completed", request_id: "00000000-0000-4000-8000-000000000000", video: { url: OUTPUT } } }, { status: "unreadable" }],
    ["404", { status: 404, body: { detail: "not found" } }, { status: "not-found" }],
    ["500", { status: 500 }, { status: "unreadable" }],
    ["garbage", { status: 200, body: "nope" }, { status: "unreadable" }],
  ];
  for (const [why, answer, expected] of cases) {
    const budget = createLiveSpendBudget(1);
    const f = fakeFetch(() => answer);
    const t = mod.createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, spendBudget: budget, fetchImpl: f.fetchImpl });
    const r = await t.locateOutput!({ providerJobId: JOB });
    assert.deepEqual(r, expected, `${label}: ${why}`);
    assert.deepEqual(f.calls.map((c) => c.method), ["GET"], `${label}: ${why} — one GET, no POST`);
    assert.equal(budget.spent(), 0, `${label}: ${why} — nothing spent`);
  }

  /* ── 3. a thrown network error, and a job id that is not one — no request ── */
  {
    const t = mod.createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, spendBudget: createLiveSpendBudget(1), fetchImpl: async () => { throw new Error("reset"); } });
    assert.deepEqual(await t.locateOutput!({ providerJobId: JOB }), { status: "unreadable" }, `${label}: network error`);
    const f = fakeFetch(() => ({ status: 200 }));
    const t2 = mod.createHiggsfieldVideoTransport({ credential: { apiKey: API_KEY }, spendBudget: createLiveSpendBudget(1), fetchImpl: f.fetchImpl });
    assert.deepEqual(await t2.locateOutput!({ providerJobId: "../../x" }), { status: "unreadable" }, `${label}: not a request id`);
    assert.equal(f.calls.length, 0, `${label}: nothing sent for a non-id`);
  }
}
