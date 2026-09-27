/*
 * MV-6 — the Higgsfield video transport and its resolver, behind a FAKE HTTP boundary.
 *
 * No request leaves this process: every `fetch` is an injected function, and the global `fetch` throws.
 * No real credential is used.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "Dispatch spends one unit of the shared live-call budget, then sends EXACTLY ONE fixed POST to the
 *    pinned Higgsfield model endpoint and never retries. It returns `accepted` only for a readable
 *    body naming a uuid request id; a refusal only for a status Higgsfield documents as a synchronous
 *    pre-acceptance error (400, 401, 403, 404, 422, 423) carrying its FastAPI envelope; and `unknown`
 *    — never a failure, never an invented id — for everything else: timeout, reset, redirect, any 5xx,
 *    any undocumented 4xx (408, 409, 429, …), a documented 4xx without the envelope, or a success body
 *    with no usable id. A
 *    poll maps queued/in_progress → pending, completed → succeeded with the request id as the opaque
 *    reference (never the URL), nsfw → moderation-blocked, failed → generation-failed and canceled →
 *    provider-canceled without reading the provider's free text, and THROWS for 404 rather than
 *    recording a failure nobody observed. Nothing unreadable becomes a
 *    transition. The key id, secret and provider text never leave. The resolver returns the transport
 *    only when selection, a credential-shaped key pair AND the Director control all hold; it never
 *    falls back to a simulated provider, and the control is refused in production by the generic
 *    ceremony."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import {
  HIGGSFIELD_MAX_RESPONSE_BYTES,
  HIGGSFIELD_PROVIDER,
  HIGGSFIELD_VIDEO_MODEL,
  HIGGSFIELD_VIDEO_REQUEST_PARAMETERS,
  HIGGSFIELD_VIDEO_SUBMIT_URL,
  HIGGSFIELD_VIDEO_PROFILES,
  HiggsfieldObservationNotRecorded,
  classifyHiggsfieldDispatchStatus,
  createHiggsfieldVideoTransport,
  higgsfieldStatusUrl,
  isHiggsfieldCredentialShaped,
  type HiggsfieldFetch,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY } from "../../src/features/media-generation-live/higgsfield-video-control";
import { VIDEO_GENERATION_ENV } from "../../src/features/media-generation-live/live-video-generation-resolver.server";
import { resolveMediaAsyncGenerationTransport } from "../../src/features/media-assets/async-generation-transport.server";
import { PROVIDER_OUTPUT_REF_RE } from "../../src/features/media-assets/async-generation-lifecycle.server";
import {
  GENERIC_PRODUCTION_REACHABLE_KEYS,
  PROVIDER_KEYS,
  resolveGenericProductionReach,
} from "../../scripts/lib/provider-connectivity";

globalThis.fetch = (() => {
  throw new Error("REAL NETWORK REACHED");
}) as typeof fetch;

/* One opaque key. It contains a colon on purpose: the transport must neither split nor require it. */
const API_KEY = "hf-test-opaque-key-not-real:0001-aaaaaaaaaaaaaaaa";
const CREDENTIAL = { apiKey: API_KEY };
const JOB = "d7e6c0f3-6699-4f6c-bb45-2ad7fd9158ff";
const INPUT = { promptText: "A slow pan across a hand-knotted kilim.", inputDigest: "a".repeat(64), invocationId: "11111111-2222-4333-8444-555555555555" };
const SRC = path.resolve(process.cwd(), "src");

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("mv6-higgsfield-video/transport-contract: exited before completing");
    process.exitCode = 1;
  }
});

interface Call {
  readonly url: string;
  readonly init: Parameters<HiggsfieldFetch>[1];
}

function scripted(respond: (call: Call) => Promise<Response> | Response): { fetch: HiggsfieldFetch; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    fetch: async (url, init) => {
      const call = { url, init };
      calls.push(call);
      return respond(call);
    },
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const queued = (id = JOB) =>
  json(200, {
    status: "queued",
    request_id: id,
    status_url: `https://api.higgsfield.ai/requests/${id}/status`,
    cancel_url: `https://api.higgsfield.ai/requests/${id}/cancel`,
  });

const statusBody = (status: string, extra: Record<string, unknown> = {}) => json(200, { status, request_id: JOB, ...extra });
const VIDEO = { video: { url: "https://cdn.example.com/secret-signed-output.mp4?sig=provider-secret-detail" } };

const transportWith = (http: { fetch: HiggsfieldFetch }, budget = createLiveSpendBudget(5)) =>
  createHiggsfieldVideoTransport({ credential: CREDENTIAL, spendBudget: budget, fetchImpl: http.fetch, dispatchTimeoutMs: 50, pollTimeoutMs: 50 });

const noLeak = (value: unknown, label: string) => {
  const text = JSON.stringify(value ?? null) + String((value as Error | undefined)?.message ?? "");
  assert.ok(!text.includes(API_KEY) && !text.includes(API_KEY.split(":")[1]!), `${label}: the credential never leaves the transport`);
  assert.ok(!/cdn\.example|provider-secret-detail|Generation failed|secret provider text/.test(text), `${label}: no output URL or provider text leaves`);
};

const timeoutError = () => Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });

async function thrown(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (error) {
    return error;
  }
  assert.fail("expected the poll to throw");
}

async function main(): Promise<void> {
  /* ── A. Submit success: one fixed POST, the request id, a typed answer ─────── */
  {
    const budget = createLiveSpendBudget(3);
    const http = scripted(() => queued());
    const t = transportWith(http, budget);
    assert.equal(t.transport, "live");
    assert.equal(t.provider, HIGGSFIELD_PROVIDER);
    assert.equal(t.model, HIGGSFIELD_VIDEO_MODEL);
    assert.equal(t.outputMediaKind, "video");
    const out = await t.dispatch(INPUT);
    assert.deepEqual(out, { status: "accepted", providerJobId: JOB });
    assert.equal(http.calls.length, 1, "exactly one POST");
    const [call] = http.calls;
    assert.equal(call!.url, HIGGSFIELD_VIDEO_SUBMIT_URL);
    assert.equal(call!.url, "https://api.higgsfield.ai/pixverse/v6/text-to-video");
    assert.ok(!call!.url.includes("?"), "no query string: no hf_webhook, nothing else");
    assert.equal(call!.init.method, "POST");
    assert.equal(call!.init.redirect, "error");
    assert.equal(call!.init.cache, "no-store");
    assert.ok(call!.init.signal instanceof AbortSignal, "bounded by a timeout");
    assert.equal(call!.init.headers.authorization, `Key ${API_KEY}`, "the documented Key scheme with the opaque key verbatim, never Bearer, never split");
    assert.deepEqual(Object.keys(call!.init.headers).sort(), ["accept", "authorization", "content-type"], "no correlation or webhook header is invented");
    assert.deepEqual(JSON.parse(call!.init.body!), { prompt: INPUT.promptText, ...HIGGSFIELD_VIDEO_REQUEST_PARAMETERS }, "the pinned request, the prompt and nothing else");
    assert.ok(!call!.init.body!.includes(INPUT.invocationId), "the invocation id is not sent as if it were an idempotency key");
    assert.equal(budget.spent(), 1, "one unit of the shared live budget");
    noLeak(out, "A");
  }

  /* ── Budget exhausted: nothing leaves Hebun, so the refusal is certain ────── */
  {
    const http = scripted(() => queued());
    const out = await transportWith(http, createLiveSpendBudget(0)).dispatch(INPUT);
    assert.deepEqual(out, { status: "rejected", failure: "budget-exhausted" });
    assert.equal(http.calls.length, 0, "no request when the budget refuses");
  }

  /* ── B / C. Timeout and connection reset: one POST, ambiguity, no id ──────── */
  for (const [label, failure] of [
    ["B timeout", timeoutError()],
    ["C connection reset", Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } })],
    ["redirect refused", new TypeError("fetch failed: unexpected redirect")],
  ] as const) {
    const budget = createLiveSpendBudget(5);
    const http = scripted(() => {
      throw failure;
    });
    const out = await transportWith(http, budget).dispatch(INPUT);
    assert.deepEqual(out, { status: "unknown" }, `${label}: unknown, not failed`);
    assert.equal(http.calls.length, 1, `${label}: exactly one POST, no retry`);
    assert.equal(budget.spent(), 1, `${label}: one spend`);
  }

  /* A hung server is cut by the transport's own deadline, and still counts as unknown. */
  {
    const http = scripted((call) => new Promise<Response>((_resolve, reject) => {
      call.init.signal.addEventListener("abort", () => reject(call.init.signal.reason));
    }));
    const started = Date.now();
    /* AbortSignal.timeout's timer is unref'd: hold the event loop open so the test, not Node, decides. */
    const keepAlive = setTimeout(() => undefined, 10_000);
    assert.deepEqual(await transportWith(http).dispatch(INPUT), { status: "unknown" });
    clearTimeout(keepAlive);
    assert.ok(Date.now() - started < 5_000, "the dispatch timeout is real");
    assert.equal(http.calls.length, 1);
  }

  /* ── D. 5xx (and 408/409, and 3xx): the job may exist — unknown, one POST ─── */
  for (const status of [500, 502, 503, 504, 408, 409, 302]) {
    const http = scripted(() => json(status, { detail: "secret provider text" }));
    const out = await transportWith(http).dispatch(INPUT);
    assert.deepEqual(out, { status: "unknown" }, `${status}: never "job not created"`);
    assert.equal(http.calls.length, 1, `${status}: no retry`);
    noLeak(out, String(status));
  }

  /* ── Documented synchronous refusals WITH the FastAPI envelope: a closed code ── */
  for (const [status, failure] of [
    [400, "request-rejected"],
    [401, "authentication-failed"],
    [403, "quota-exhausted"],
    [404, "request-rejected"],
    [422, "request-rejected"],
    [423, "provider-unavailable"],
  ] as const) {
    for (const detail of ["Maximum number of concurrent requests (4) has been reached — secret provider text", [{ loc: ["body", "prompt"], msg: "secret provider text" }]]) {
      const http = scripted(() => json(status, { detail }));
      const out = await transportWith(http).dispatch(INPUT);
      assert.deepEqual(out, { status: "rejected", failure }, `${status} → ${failure}`);
      assert.equal(http.calls.length, 1, `${status}: one POST`);
      noLeak(out, String(status));
    }
  }
  /* The envelope's text is never read: a message that sounds like another cause changes nothing. */
  assert.deepEqual(await transportWith(scripted(() => json(400, { detail: "Invalid credentials; insufficient credits; timeout" }))).dispatch(INPUT), { status: "rejected", failure: "request-rejected" });

  /* ── A documented status WITHOUT the envelope may be an intermediary: ambiguous ─ */
  for (const status of [400, 401, 403, 404, 422, 423]) {
    for (const [label, response] of [
      ["html", () => new Response("<html>Forbidden</html>", { status })],
      ["empty", () => new Response(null, { status })],
      ["no detail", () => json(status, { error: "x" })],
      ["empty detail", () => json(status, { detail: "" })],
      ["non-string detail", () => json(status, { detail: 42 })],
    ] as const) {
      const http = scripted(response);
      assert.deepEqual(await transportWith(http).dispatch(INPUT), { status: "unknown" }, `${status} ${label}: not proven to be Higgsfield's refusal`);
      assert.equal(http.calls.length, 1, `${status} ${label}: no retry`);
    }
  }

  /* ── Undocumented 4xx, even with an envelope: unknown, never a guessed refusal ── */
  for (const status of [402, 405, 406, 408, 409, 410, 411, 412, 413, 415, 418, 425, 428, 429, 431, 451, 499]) {
    const http = scripted(() => json(status, { detail: "secret provider text" }));
    const out = await transportWith(http).dispatch(INPUT);
    assert.deepEqual(out, { status: "unknown" }, `${status}: undocumented for Higgsfield`);
    assert.equal(http.calls.length, 1, `${status}: exactly one POST`);
  }
  assert.equal(classifyHiggsfieldDispatchStatus(200, { detail: "x" }), "unknown", "a status alone never means accepted");
  assert.equal(classifyHiggsfieldDispatchStatus(500, { detail: "x" }), "unknown", "5xx is never a refusal, even though the table lists 500");
  assert.equal(classifyHiggsfieldDispatchStatus(503, { detail: "x" }), "unknown", "nor 503");

  /* ── E. Malformed success: no invented job id ─────────────────────────────── */
  for (const [label, response] of [
    ["no request_id", json(200, { status: "queued" })],
    ["non-uuid id", json(200, { status: "queued", request_id: "../../requests/other" })],
    ["numeric id", json(200, { status: "queued", request_id: 42 })],
    ["not json", new Response("<html>ok</html>", { status: 200 })],
    ["oversized", new Response("x".repeat(HIGGSFIELD_MAX_RESPONSE_BYTES + 1), { status: 200 })],
    ["202 empty", new Response(null, { status: 202 })],
  ] as const) {
    const http = scripted(() => response);
    assert.deepEqual(await transportWith(http).dispatch(INPUT), { status: "unknown" }, `${label}: ambiguous, never an invented id`);
    assert.equal(http.calls.length, 1);
  }
  /* Any 2xx that DOES name a job is accepted — losing a known id would manufacture ambiguity. */
  {
    const http = scripted(() => json(201, { status: "queued", request_id: JOB }));
    assert.deepEqual(await transportWith(http).dispatch(INPUT), { status: "accepted", providerJobId: JOB });
  }

  /* ── F–K. Polling: every documented state ─────────────────────────────────── */
  const poll = async (response: () => Response) => {
    const http = scripted(() => response());
    const budget = createLiveSpendBudget(5);
    const t = transportWith(http, budget);
    const result = await t.poll({ providerJobId: JOB }).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    assert.equal(http.calls.length, 1, "one status read");
    const [call] = http.calls;
    assert.equal(call!.url, higgsfieldStatusUrl(JOB));
    assert.equal(call!.url, `https://api.higgsfield.ai/requests/${JOB}/status`);
    assert.equal(call!.init.method, "GET");
    assert.equal(call!.init.body, undefined);
    assert.equal(call!.init.redirect, "error");
    assert.equal(budget.spent(), 0, "a status read spends nothing");
    return result;
  };

  assert.deepEqual(await poll(() => statusBody("queued")), { value: { status: "pending" } }, "F queued → pending");
  assert.deepEqual(await poll(() => statusBody("in_progress")), { value: { status: "pending" } }, "G in_progress → pending");
  {
    const r = await poll(() => statusBody("completed", VIDEO));
    assert.deepEqual(r, { value: { status: "succeeded", outputRef: JOB } }, "H completed → succeeded, the id as the reference");
    assert.ok(PROVIDER_OUTPUT_REF_RE.test(JOB), "the reference satisfies the MV-4 output-ref CHECK");
    noLeak(r, "H");
  }
  {
    const r = await poll(() => statusBody("nsfw"));
    assert.deepEqual(r, { value: { status: "failed", failure: "moderation-blocked" } }, "J nsfw → moderation-blocked");
  }
  for (const [label, response, failure] of [
    ["I failed", () => statusBody("failed", { error: "Generation failed — secret provider text" }), "generation-failed"],
    ["I failed, a cause-sounding message", () => statusBody("failed", { error: "moderation timeout quota" }), "generation-failed"],
    ["K canceled", () => statusBody("canceled"), "provider-canceled"],
  ] as const) {
    const r = await poll(response);
    assert.deepEqual(r, { value: { status: "failed", failure } }, `${label} → ${failure}; the free text is never read as a cause`);
    noLeak(r, label);
  }
  for (const [label, response, observed] of [
    ["M 404", () => json(404, { detail: "secret provider text" }), "not-found"],
  ] as const) {
    const r = await poll(response);
    const error = (r as { error?: unknown }).error;
    assert.ok(error instanceof HiggsfieldObservationNotRecorded, `${label}: observed, and deliberately not recorded`);
    assert.equal(error.observed, observed);
    noLeak(error, label);
  }

  /* ── L and everything unreadable: thrown, never a transition ──────────────── */
  for (const [label, response] of [
    ["L network failure", () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNRESET" } }); }],
    ["L timeout", () => { throw timeoutError(); }],
    ["401", () => json(401, { detail: "Invalid credentials" })],
    ["500", () => json(500, { detail: "x" })],
    ["unknown state", () => statusBody("exploded")],
    ["another job's answer", () => json(200, { status: "completed", request_id: "00000000-0000-4000-8000-000000000000", ...VIDEO })],
    ["completed with no video", () => statusBody("completed")],
    ["completed with a non-https url", () => statusBody("completed", { video: { url: "http://cdn.example.com/x.mp4" } })],
    ["not json", () => new Response("nope", { status: 200 })],
  ] as const) {
    const r = await poll(response as () => Response);
    const error = (r as { error?: unknown }).error;
    assert.ok(error instanceof Error, `${label}: thrown`);
    assert.ok(!(error instanceof HiggsfieldObservationNotRecorded), `${label}: unreadable, not a provider state`);
    noLeak(error, label);
  }

  /* A malformed stored id is never interpolated into a URL. */
  {
    const http = scripted(() => statusBody("queued"));
    const e = await thrown(transportWith(http).poll({ providerJobId: "../../admin" }));
    assert.ok(e instanceof Error);
    assert.equal(http.calls.length, 0, "no request for a non-uuid id");
  }

  /* ── N. Credential secrecy and construction ───────────────────────────────── */
  {
    for (const bad of ["", "short", `Key ${API_KEY}`, `Bearer ${API_KEY}`, ` ${API_KEY}`, `${API_KEY}\n`, "é".repeat(20)]) {
      assert.throws(() => createHiggsfieldVideoTransport({ credential: { apiKey: bad }, spendBudget: createLiveSpendBudget(1) }), JSON.stringify(bad.slice(0, 8)));
    }
    assert.ok(isHiggsfieldCredentialShaped({ apiKey: "hf0123456789abcdefNOCOLON" }), "no colon is required");
    assert.ok(isHiggsfieldCredentialShaped({ apiKey: "a:b:c:0123456789abcdef" }), "any colon is allowed: the value is opaque");
    /* Whatever the key contains, it reaches the header byte for byte. */
    for (const key of ["hf0123456789abcdefNOCOLON", "a:b:c:0123456789abcdef"]) {
      const http = scripted(() => queued());
      await createHiggsfieldVideoTransport({ credential: { apiKey: key }, spendBudget: createLiveSpendBudget(1), fetchImpl: http.fetch }).dispatch(INPUT);
      assert.equal(http.calls[0]!.init.headers.authorization, `Key ${key}`);
    }
    /* A thrown construction error names no value. */
    try {
      createHiggsfieldVideoTransport({ credential: { apiKey: `Key ${API_KEY}` }, spendBudget: createLiveSpendBudget(1) });
    } catch (error) {
      assert.ok(!String((error as Error).message).includes(API_KEY), "the construction error echoes no key");
    }
    const t = transportWith(scripted(() => queued()));
    assert.ok(!JSON.stringify(t).includes(API_KEY), "the transport object does not expose the credential");
    const transportSource = readFileSync(path.join(SRC, "features/media-generation-live/higgsfield-video-transport.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/\.split\(|keyId|keySecret/.test(transportSource), "the key is never split, and the retired id/secret pair is gone");
    const source = readFileSync(path.join(SRC, "features/media-generation-live/higgsfield-video-transport.server.ts"), "utf8");
    assert.ok(!/console\.|logger|process\.env/.test(source), "the transport logs nothing and reads no environment");
    assert.ok(!/hf_webhook|X-Webhook|cancel_url\b.*fetch/.test(source.replace(/^\s*\*.*$/gm, "")), "no webhook is registered and nothing is canceled");
    assert.ok(!/higgsfield-client|@higgsfield\/client/.test(source), "no SDK: generation POST retry is zero by construction");
    assert.ok(!/\bfor\s*\(|\bwhile\s*\(/.test(source.slice(source.indexOf("export function createHiggsfieldVideoTransport"))), "no loop in dispatch or poll");
    assert.ok(!/media_assets|mediaAssets|mediaGenerationInvocations|drizzle/.test(source), "the transport writes no row and names no Media table");
  }

  /* ── Model profiles: a closed set, PixVerse by default, Hailuo only when named ── */
  {
    assert.deepEqual(Object.keys(HIGGSFIELD_VIDEO_PROFILES).sort(), ["hailuo-2.3-standard", "pixverse-v6"], "exactly two profiles");
    const pix = scripted(() => queued());
    const tPix = createHiggsfieldVideoTransport({ credential: CREDENTIAL, spendBudget: createLiveSpendBudget(1), fetchImpl: pix.fetch });
    assert.equal(tPix.model, HIGGSFIELD_VIDEO_MODEL, "no profile → the pinned PixVerse model");
    await tPix.dispatch(INPUT);
    assert.equal(pix.calls[0]!.url, "https://api.higgsfield.ai/pixverse/v6/text-to-video");
    const hl = scripted(() => queued());
    const tHl = createHiggsfieldVideoTransport({ credential: CREDENTIAL, profile: "hailuo-2.3-standard", spendBudget: createLiveSpendBudget(1), fetchImpl: hl.fetch });
    assert.equal(tHl.model, "minimax/hailuo-2.3/standard/text-to-video@6s-768p-no-optimizer");
    assert.deepEqual(await tHl.dispatch(INPUT), { status: "accepted", providerJobId: JOB });
    assert.equal(hl.calls.length, 1, "one POST");
    assert.equal(hl.calls[0]!.url, "https://api.higgsfield.ai/minimax/hailuo-2.3/standard/text-to-video");
    assert.deepEqual(JSON.parse(hl.calls[0]!.init.body!), { prompt: INPUT.promptText, duration: 6, prompt_optimizer: false }, "exactly the documented fields: no audio, no resolution, nothing invented");
    assert.equal(hl.calls[0]!.init.headers.authorization, `Key ${API_KEY}`);
    /* A one-unit budget makes a second POST impossible below any caller. */
    assert.deepEqual(await tHl.dispatch(INPUT), { status: "rejected", failure: "budget-exhausted" });
    assert.equal(hl.calls.length, 1, "no second POST");
    assert.throws(() => createHiggsfieldVideoTransport({ credential: CREDENTIAL, profile: "seedance-2.5" as never, spendBudget: createLiveSpendBudget(1) }), "an unknown profile is refused");
    assert.throws(() => createHiggsfieldVideoTransport({ credential: CREDENTIAL, profile: "__proto__" as never, spendBudget: createLiveSpendBudget(1) }));
    /* The production resolver can only ever build the default. */
    const resolverSource = readFileSync(path.join(SRC, "features/media-generation-live/live-video-generation-resolver.server.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(!/hailuo|profile/i.test(resolverSource), "the resolver names no profile and never Hailuo");
  }

  /* ── Q. The resolver: fail-closed, no fallback ────────────────────────────── */
  {
    const good = {
      [VIDEO_GENERATION_ENV.transport]: "live",
      [VIDEO_GENERATION_ENV.higgsfieldApiKey]: API_KEY,
    };
    const asked: string[] = [];
    const on = async (key: string) => {
      asked.push(key);
      return true;
    };
    const off = async () => false;
    const broken = async (): Promise<boolean> => {
      throw new Error("db down");
    };
    assert.deepEqual(await resolveMediaAsyncGenerationTransport({ env: {}, resolveDirectorEnabled: on }), { status: "unavailable", reason: "no-video-generation-provider" });
    for (const selection of ["fake", "simulated", "LIVE", "higgsfield"]) {
      assert.deepEqual(
        await resolveMediaAsyncGenerationTransport({ env: { ...good, [VIDEO_GENERATION_ENV.transport]: selection }, resolveDirectorEnabled: on }),
        { status: "unavailable", reason: "video-generation-misconfigured" },
        `${selection}: no fallback to any other transport`,
      );
    }
    /* The retired pair is not read: supplying ONLY it is misconfiguration, never a credential. */
    assert.deepEqual(
      await resolveMediaAsyncGenerationTransport({
        env: { [VIDEO_GENERATION_ENV.transport]: "live", HEBUN_HIGGSFIELD_API_KEY_ID: "hf-test-key-id-not-real-0001", HEBUN_HIGGSFIELD_API_KEY_SECRET: "hf-test-secret-not-real-000000000000" },
        resolveDirectorEnabled: on,
      }),
      { status: "unavailable", reason: "video-generation-misconfigured" },
      "the retired HEBUN_HIGGSFIELD_API_KEY_ID + _SECRET contract is not read",
    );
    assert.deepEqual(Object.keys(VIDEO_GENERATION_ENV).sort(), ["higgsfieldApiKey", "transport"], "one selection variable and one key, nothing else");
    for (const file of ["features/media-generation-live/live-video-generation-resolver.server.ts", "features/media-generation-live/higgsfield-video-transport.server.ts"]) {
      assert.ok(!/HEBUN_HIGGSFIELD_API_KEY_(ID|SECRET)/.test(readFileSync(path.join(SRC, file), "utf8")), `${file} names no retired variable`);
    }
    assert.deepEqual(
      await resolveMediaAsyncGenerationTransport({ env: { ...good, [VIDEO_GENERATION_ENV.higgsfieldApiKey]: "" }, resolveDirectorEnabled: on }),
      { status: "unavailable", reason: "video-generation-misconfigured" },
      "HEBUN_HIGGSFIELD_API_KEY absent: a credential is required",
    );
    assert.deepEqual(await resolveMediaAsyncGenerationTransport({ env: good, resolveDirectorEnabled: off }), { status: "unavailable", reason: "video-generation-disabled" }, "a credential is not a capability");
    assert.deepEqual(await resolveMediaAsyncGenerationTransport({ env: good, resolveDirectorEnabled: broken }), { status: "unavailable", reason: "video-generation-disabled" }, "a control read error is OFF");
    const available = await resolveMediaAsyncGenerationTransport({ env: good, resolveDirectorEnabled: on });
    assert.equal(available.status, "available");
    assert.deepEqual(asked, [HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY], "the one Higgsfield control is what is asked");
    if (available.status === "available") {
      assert.equal(available.transport.provider, HIGGSFIELD_PROVIDER);
      assert.equal(available.transport.transport, "live");
    }
    noLeak(available.status === "available" ? { ...available, transport: { provider: available.transport.provider, model: available.transport.model } } : available, "Q");
    /* With nothing configured, the released default is still NOT CONNECTED. */
    assert.deepEqual(await resolveMediaAsyncGenerationTransport({ env: {} }), { status: "unavailable", reason: "no-video-generation-provider" });

    for (const file of ["features/media-assets/async-generation-transport.server.ts", "features/media-generation-live/live-video-generation-resolver.server.ts"]) {
      const resolver = readFileSync(path.join(SRC, file), "utf8");
      assert.ok(!/fake-async-video-transport|SIMULATED/.test(resolver) && !/from "[^"]*tests\//.test(resolver), `P: the simulated transport is not reachable from ${file}`);
    }
    const neutral = readFileSync(path.join(SRC, "features/media-assets/async-generation-transport.server.ts"), "utf8");
    assert.ok(!/higgsfield|process\.env/i.test(neutral), "the media-assets resolver names no provider and reads no configuration");
  }

  /* ── The control: expressible for local arming, refused in production ─────── */
  {
    assert.ok(PROVIDER_KEYS.includes(HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY), "a local ceremony can arm and disarm it");
    assert.ok(!GENERIC_PRODUCTION_REACHABLE_KEYS.includes(HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY), "not production-reachable by the generic ceremony");
    assert.deepEqual(resolveGenericProductionReach(HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY), { status: "refused", dedicatedCommand: null }, "no production gate exists yet");
  }

  finished = true;
  console.log("mv6-higgsfield-video/transport-contract: PASS");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
