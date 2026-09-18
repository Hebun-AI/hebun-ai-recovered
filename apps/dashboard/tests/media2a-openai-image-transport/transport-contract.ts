/*
 * MEDIA-2A — the OpenAI GPT Image transport and its resolver, behind a FAKE HTTP boundary.
 *
 * No request leaves this process: every `fetch` is an injected function. No real credential is used.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "The transport sends exactly one fixed, text-to-image request to the official endpoint with the
 *    pinned model, spends one unit of the shared live-call budget first, and returns either the
 *    decoded bytes with the request id and token usage, or ONE closed failure code — authentication,
 *    request rejection, moderation, rate limit, quota, timeout, provider unavailability, malformed
 *    response, budget exhaustion. It never retries, never returns a URL, and never lets the key, the
 *    raw body or a provider message out. The resolver returns it only when selection, a
 *    credential-shaped key AND the Director connectivity control all hold; a credential alone never
 *    does."
 */
import assert from "node:assert/strict";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import {
  OPENAI_IMAGE_GENERATIONS_URL,
  OPENAI_IMAGE_MAX_RESPONSE_BYTES,
  OPENAI_IMAGE_MODEL,
  classifyOpenAiImageFailure,
  createOpenAiImageTransport,
  type OpenAiFetch,
} from "../../src/features/media-generation-live/openai-image-transport.server";
import { OPENAI_IMAGE_GENERATION_CONTROL_KEY } from "../../src/features/media-generation-live/openai-image-control";
import {
  MEDIA_GENERATION_ENV,
  resolveMediaGenerationTransport,
} from "../../src/features/media-assets/media-generation-transport.server";
import { MEDIA_PROVIDER_FAILURES } from "../../src/features/media-assets/contracts";
import { pngBytes } from "../helpers/media-fakes";

const KEY = "sk-test-not-a-real-key-000000000000000000";
const INPUT = { promptText: "A hand-knotted kilim on a loom, morning light.", inputDigest: "a".repeat(64), invocationId: "11111111-2222-4333-8444-555555555555", request: { mode: "text-to-image" } } as const;

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("media2a-openai-image-transport/transport-contract: exited before completing");
    process.exitCode = 1;
  }
});

interface Call {
  readonly url: string;
  readonly init: Parameters<OpenAiFetch>[1];
}

function scripted(respond: (call: Call) => Promise<Response> | Response): { fetch: OpenAiFetch; calls: Call[] } {
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

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

const ok = (bytes: Uint8Array, extra: Record<string, unknown> = {}) =>
  json(200, { created: 1, data: [{ b64_json: Buffer.from(bytes).toString("base64") }], usage: { input_tokens: 17, output_tokens: 1056, total_tokens: 1073 }, ...extra }, { "x-request-id": "req_abc123" });

const noLeak = (value: unknown) => {
  const text = JSON.stringify(value, (_k, v) => (v instanceof Uint8Array ? `<${v.length} bytes>` : v));
  assert.ok(!text.includes(KEY), "the key never leaves the transport");
  assert.ok(!/b64_json|provider says|secret detail/i.test(text), "no raw body or provider message leaves the transport");
};

async function main(): Promise<void> {
  /* ── 1. Success: one fixed request, bytes back, usage and request id recorded ─ */
  {
    const image = pngBytes(1024, 1024, 64);
    const budget = createLiveSpendBudget(3);
    const http = scripted(() => ok(image));
    const transport = createOpenAiImageTransport({ apiKey: KEY, spendBudget: budget, fetchImpl: http.fetch });
    assert.deepEqual([transport.transport, transport.provider, transport.model], ["live", "openai", "gpt-image-2.5-flare-2026-09-08"]);
    assert.deepEqual([...transport.allowedDownloadHosts], [], "no URL can ever be followed");

    const outcome = await transport.generate(INPUT);
    assert.equal(outcome.status, "succeeded");
    if (outcome.status !== "succeeded") throw new Error("unreachable");
    assert.equal(outcome.output.kind, "bytes");
    if (outcome.output.kind !== "bytes") throw new Error("unreachable");
    assert.deepEqual(outcome.output.bytes, image);
    assert.equal(outcome.output.declaredContentType, "image/png");
    assert.equal(outcome.providerJobId, "req_abc123");
    assert.deepEqual(outcome.usage, { inputTokens: 17, outputTokens: 1056 });
    noLeak(outcome);

    assert.equal(http.calls.length, 1);
    const [call] = http.calls;
    assert.equal(call!.url, OPENAI_IMAGE_GENERATIONS_URL);
    assert.equal(call!.url, "https://api.openai.com/v1/images/generations");
    assert.equal(call!.init.method, "POST");
    assert.equal(call!.init.redirect, "error");
    assert.deepEqual(Object.keys(call!.init.headers).sort(), ["authorization", "content-type", "x-client-request-id"]);
    assert.equal(call!.init.headers.authorization, `Bearer ${KEY}`);
    assert.equal(call!.init.headers["x-client-request-id"], INPUT.invocationId);
    /* MEDIA-5 kept this a JSON STRING. If text-to-image ever became multipart, this fails first. */
    assert.equal(typeof call!.init.body, "string", "text-to-image sends a JSON body, never multipart");
    const rawBody = call!.init.body as string;
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    assert.deepEqual(body, {
      model: OPENAI_IMAGE_MODEL,
      prompt: INPUT.promptText,
      n: 1,
      size: "1024x1024",
      quality: "medium",
      output_format: "png",
      moderation: "auto",
    }, "text-to-image only: no image, mask, stream or response_format");
    assert.ok(!rawBody.includes(INPUT.inputDigest), "only the prompt is organizational content sent");
    assert.equal(budget.spent(), 1, "one unit of the shared budget per call");
  }

  /* ── 2. Every closed failure, exactly one request, never a retry ────────── */
  {
    const cases: [string, () => Response | Promise<Response>, string, string | null][] = [
      ["401", () => json(401, { error: { code: "invalid_api_key", message: "provider says secret detail" } }, { "x-request-id": "req_1" }), "authentication-failed", "req_1"],
      ["403", () => json(403, { error: { code: "unsupported_country_region_territory" } }), "authentication-failed", null],
      ["moderation", () => json(400, { error: { code: "moderation_blocked", message: "provider says secret detail", moderation_details: { moderation_stage: "input" } } }), "moderation-blocked", null],
      ["rate", () => json(429, { error: { code: "rate_limit_exceeded" } }), "rate-limited", null],
      ["quota", () => json(429, { error: { code: "credit_balance_exhausted" } }), "quota-exhausted", null],
      ["legacy quota", () => json(429, { error: { code: "insufficient_quota" } }), "quota-exhausted", null],
      ["400", () => json(400, { error: { code: "invalid_value" } }), "request-rejected", null],
      ["500", () => json(500, { error: { code: "server_error" } }), "provider-unavailable", null],
      ["503", () => json(503, { error: { code: "server_is_overloaded" } }), "provider-unavailable", null],
      ["non-json 502", () => new Response("<html>bad gateway</html>", { status: 502 }), "provider-unavailable", null],
      ["network", () => Promise.reject(new TypeError("fetch failed")), "provider-unavailable", null],
      ["timeout", () => Promise.reject(Object.assign(new Error("t"), { name: "TimeoutError" })), "timeout", null],
      ["200 non-json", () => new Response("not json", { status: 200 }), "malformed-response", null],
      ["200 no data", () => json(200, { created: 1 }), "malformed-response", null],
      ["200 empty data", () => json(200, { data: [] }), "malformed-response", null],
      ["200 two images", () => json(200, { data: [{ b64_json: "iVBORw0KGgo=" }, { b64_json: "iVBORw0KGgo=" }] }), "malformed-response", null],
      ["200 url instead of bytes", () => json(200, { data: [{ url: "https://evil.example/x.png" }] }), "malformed-response", null],
      ["200 url beside bytes", () => json(200, { data: [{ b64_json: "iVBORw0KGgo=", url: "https://evil.example/x.png" }] }), "malformed-response", null],
      ["200 bad base64", () => json(200, { data: [{ b64_json: "not*base64!" }] }), "malformed-response", null],
      ["200 empty base64", () => json(200, { data: [{ b64_json: "" }] }), "malformed-response", null],
    ];
    for (const [label, respond, failure, requestId] of cases) {
      const budget = createLiveSpendBudget(5);
      const http = scripted(respond);
      const outcome = await createOpenAiImageTransport({ apiKey: KEY, spendBudget: budget, fetchImpl: http.fetch }).generate(INPUT);
      assert.equal(outcome.status, "failed", label);
      if (outcome.status !== "failed") throw new Error("unreachable");
      assert.equal(outcome.failure, failure, label);
      assert.equal(outcome.providerJobId, requestId, label);
      assert.ok((MEDIA_PROVIDER_FAILURES as readonly string[]).includes(outcome.failure), label);
      assert.equal(http.calls.length, 1, `${label}: exactly one request, no retry`);
      assert.equal(budget.spent(), 1, label);
      noLeak(outcome);
    }
    assert.equal(classifyOpenAiImageFailure(408, null), "timeout");
    assert.equal(classifyOpenAiImageFailure(200, null), "malformed-response", "an unexpected non-error status is never success");
  }

  /* ── 3. A real deadline: a hung provider is a timeout, not a hang ───────── */
  {
    const http = scripted(
      (call) =>
        new Promise<Response>((_resolve, reject) => {
          call.init.signal.addEventListener("abort", () => reject(call.init.signal.reason));
        }),
    );
    const started = Date.now();
    /* AbortSignal.timeout's timer is unref'd: with only a hung fake fetch pending, Node would empty the
       loop and exit. A real in-flight request holds a socket; this interval stands in for it. */
    const keepAlive = setInterval(() => undefined, 1_000);
    const outcome = await createOpenAiImageTransport({ apiKey: KEY, spendBudget: createLiveSpendBudget(1), fetchImpl: http.fetch, timeoutMs: 50 }).generate(INPUT);
    clearInterval(keepAlive);
    assert.deepEqual(outcome, { status: "failed", providerJobId: null, failure: "timeout", usage: null });
    assert.ok(Date.now() - started < 5_000);
    assert.equal(http.calls.length, 1);
  }

  /* ── 4. Response size: over the cap is malformed; under it, bytes go to admission ─ */
  {
    /* VALID JSON with VALID base64 over the cap: only the cap itself can refuse this. */
    const overCap = new Uint8Array(25 * 1024 * 1024);
    overCap.set(pngBytes(1024, 1024));
    const overCapBody = JSON.stringify({ data: [{ b64_json: Buffer.from(overCap).toString("base64") }] });
    assert.ok(Buffer.byteLength(overCapBody) > OPENAI_IMAGE_MAX_RESPONSE_BYTES);
    const outcome = await createOpenAiImageTransport({ apiKey: KEY, spendBudget: createLiveSpendBudget(1), fetchImpl: async () => new Response(overCapBody, { status: 200 }) }).generate(INPUT);
    assert.equal(outcome.status === "failed" && outcome.failure, "malformed-response", "response over the cap");

    /* 21 MiB decoded: the transport hands it on; the AUTHORITY refuses it (tests/media1 postgres §16). */
    const oversized = new Uint8Array(21 * 1024 * 1024);
    oversized.set(pngBytes(1024, 1024));
    const passed = await createOpenAiImageTransport({ apiKey: KEY, spendBudget: createLiveSpendBudget(1), fetchImpl: async () => ok(oversized) }).generate(INPUT);
    assert.equal(passed.status, "succeeded", "size is admission's decision, not the transport's");
  }

  /* ── 5. Budget: exhausted means nothing is sent ─────────────────────────── */
  {
    const budget = createLiveSpendBudget(1);
    const http = scripted(() => ok(pngBytes(8, 8)));
    const transport = createOpenAiImageTransport({ apiKey: KEY, spendBudget: budget, fetchImpl: http.fetch });
    assert.equal((await transport.generate(INPUT)).status, "succeeded");
    assert.deepEqual(await transport.generate(INPUT), { status: "failed", providerJobId: null, failure: "budget-exhausted", usage: null });
    assert.equal(http.calls.length, 1, "the second call never left the process");
    const zero = scripted(() => ok(pngBytes(8, 8)));
    assert.equal((await createOpenAiImageTransport({ apiKey: KEY, spendBudget: createLiveSpendBudget(0), fetchImpl: zero.fetch }).generate(INPUT)).status, "failed");
    assert.equal(zero.calls.length, 0);
  }

  /* ── 6. Request id and usage are validated, never trusted ───────────────── */
  {
    const image = pngBytes(8, 8);
    const weird = await createOpenAiImageTransport({
      apiKey: KEY,
      spendBudget: createLiveSpendBudget(1),
      fetchImpl: async () =>
        json(200, { data: [{ b64_json: Buffer.from(image).toString("base64") }], usage: { input_tokens: -1, output_tokens: "9" } }, { "x-request-id": "req <script>alert(1)</script>" }),
    }).generate(INPUT);
    assert.equal(weird.status, "succeeded");
    assert.equal(weird.providerJobId, null, "a request id outside [A-Za-z0-9_-]{1,128} is dropped");
    assert.equal(weird.usage, null, "usage that is not two non-negative integers is dropped");
  }

  /* ── 7. The resolver: a credential is not a capability ──────────────────── */
  {
    const T = MEDIA_GENERATION_ENV.transport;
    const K = MEDIA_GENERATION_ENV.openAiApiKey;
    let reads = 0;
    const on = async (key: string) => {
      reads += 1;
      assert.equal(key, OPENAI_IMAGE_GENERATION_CONTROL_KEY);
      return true;
    };
    const off = async () => false;
    const broken = async (): Promise<boolean> => {
      throw new Error("db down");
    };

    const unavailable = (reason: string) => ({ status: "unavailable", reason });
    assert.deepEqual(await resolveMediaGenerationTransport({ env: {}, resolveDirectorEnabled: on }), unavailable("no-generation-provider"));
    assert.deepEqual(
      await resolveMediaGenerationTransport({ env: { [K]: KEY, OPENAI_API_KEY: KEY }, resolveDirectorEnabled: on }),
      unavailable("no-generation-provider"),
      "a credential without selection selects nothing",
    );
    assert.equal(reads, 0, "no control read without a selection");
    for (const env of [
      { [T]: "fake", [K]: KEY },
      { [T]: "LIVE", [K]: KEY },
      { [T]: "live" },
      { [T]: "live", [K]: "" },
      { [T]: "live", [K]: "short" },
      { [T]: "live", [K]: `${KEY} with space` },
      { [T]: "live", OPENAI_API_KEY: KEY },
    ]) {
      assert.deepEqual(await resolveMediaGenerationTransport({ env, resolveDirectorEnabled: on }), unavailable("generation-misconfigured"), JSON.stringify(Object.keys(env)));
    }
    assert.equal(reads, 0, "no control read while misconfigured");
    const full = { [T]: "live", [K]: KEY };
    assert.deepEqual(await resolveMediaGenerationTransport({ env: full, resolveDirectorEnabled: off }), unavailable("generation-disabled"), "connectivity OFF");
    assert.deepEqual(await resolveMediaGenerationTransport({ env: full, resolveDirectorEnabled: broken }), unavailable("generation-disabled"), "control read error fails closed");
    assert.deepEqual(await resolveMediaGenerationTransport({ env: full }), unavailable("generation-disabled"), "the released control with no database is OFF");
    const available = await resolveMediaGenerationTransport({ env: full, resolveDirectorEnabled: on });
    assert.equal(available.status, "available");
    if (available.status === "available") {
      assert.deepEqual([available.transport.transport, available.transport.provider, available.transport.model], ["live", "openai", OPENAI_IMAGE_MODEL]);
      noLeak({ ...available.transport, generate: undefined });
    }
  }

  finished = true;
  console.log("media2a-openai-image-transport/transport-contract: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
