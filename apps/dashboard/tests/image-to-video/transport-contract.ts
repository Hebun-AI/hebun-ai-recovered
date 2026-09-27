/*
 * IMAGE → VIDEO — the Higgsfield image-to-video profile and its source upload, against a fake
 * network. No real provider is reached.
 *
 * THE CLAIM:
 *
 *   "An image profile uploads VERIFIED bytes through Higgsfield's documented two-step upload — one
 *    prepare POST to the API with the credential, one PUT to the presigned URL with ONLY the
 *    documented headers and never the credential — and requires `retention=temporary`. Any refusal or
 *    ambiguity in either step means no generation POST. The prepared source's URL is not enumerable.
 *    The generation POST is exactly one, carries exactly the documented fields with `image_url` set to
 *    the provider's public_url, and is refused locally without a source. A text profile is unchanged.
 *    The resolver arms an image request only by the SEPARATE image-to-video control."
 */
import assert from "node:assert/strict";
import {
  HIGGSFIELD_IMAGE_TO_VIDEO_MODEL,
  HIGGSFIELD_UPLOAD_PREPARE_URL,
  createHiggsfieldVideoTransport,
  readHiggsfieldUploadGrant,
  type HiggsfieldFetch,
  type HiggsfieldUploadFetch,
} from "../../src/features/media-generation-live/higgsfield-video-transport.server";
import { resolveLiveVideoGenerationTransport } from "../../src/features/media-generation-live/live-video-generation-resolver.server";
import {
  HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY,
  HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY,
} from "../../src/features/media-generation-live/higgsfield-video-control";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";

const KEY = "hf-test-opaque-key-not-real:0010-iiiiiiiiiiiiiiii";
const PUBLIC_URL = "https://uploads.i2v.test/public/SOURCE-PUBLIC-URL-SECRET.png";
const UPLOAD_URL = "https://storage.i2v.test/put?X-Amz-Signature=UPLOAD-URL-SECRET";
const REQUEST_ID = "5b2f7a0e-1c3d-4e5f-8a9b-0c1d2e3f4a5b";
const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

interface Call {
  readonly url: string;
  readonly method: string;
  readonly headers: Record<string, string>;
  readonly body: unknown;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const GOOD_GRANT = {
  public_url: PUBLIC_URL,
  upload_url: UPLOAD_URL,
  content_type: "image/png",
  upload_headers: { "Content-Type": "image/png", "x-amz-tagging": "retention=temporary" },
};

function network(options: {
  prepare?: () => Response | Promise<Response>;
  put?: () => Response | Promise<Response>;
  generate?: () => Response | Promise<Response>;
} = {}) {
  const api: Call[] = [];
  const uploads: Call[] = [];
  const fetchImpl: HiggsfieldFetch = async (url, init) => {
    api.push({ url, method: init.method, headers: init.headers, body: init.body });
    if (url === HIGGSFIELD_UPLOAD_PREPARE_URL) return (options.prepare ?? (() => json(200, GOOD_GRANT)))();
    return (options.generate ?? (() => json(200, { status: "queued", request_id: REQUEST_ID })))();
  };
  const uploadFetchImpl: HiggsfieldUploadFetch = async (url, init) => {
    uploads.push({ url, method: init.method, headers: init.headers, body: init.body });
    return (options.put ?? (() => new Response(null, { status: 200 })))();
  };
  const generationPosts = () => api.filter((c) => c.method === "POST" && c.url !== HIGGSFIELD_UPLOAD_PREPARE_URL);
  const preparePosts = () => api.filter((c) => c.url === HIGGSFIELD_UPLOAD_PREPARE_URL);
  return { api, uploads, fetchImpl, uploadFetchImpl, generationPosts, preparePosts };
}

function imageTransport(n: ReturnType<typeof network>, budget = createLiveSpendBudget(5)) {
  return createHiggsfieldVideoTransport({
    credential: { apiKey: KEY },
    profile: "pixverse-v6-image-to-video",
    spendBudget: budget,
    fetchImpl: n.fetchImpl,
    uploadFetchImpl: n.uploadFetchImpl,
  });
}

async function main(): Promise<void> {
  /* ── 1. identity ── */
  {
    const t = imageTransport(network());
    assert.equal(t.inputMode, "image");
    assert.equal(t.model, HIGGSFIELD_IMAGE_TO_VIDEO_MODEL);
    assert.equal(t.model, "pixverse/v6/image-to-video@5s-720p-silent");
    assert.equal(typeof t.prepareSourceImage, "function");
    const text = createHiggsfieldVideoTransport({ credential: { apiKey: KEY }, spendBudget: createLiveSpendBudget(1), fetchImpl: network().fetchImpl });
    assert.equal(text.inputMode, "text", "the pinned text profile is unchanged");
    assert.equal(text.prepareSourceImage, undefined, "a text profile uploads nothing");
  }

  /* ── 2. the happy path: prepare POST → PUT → ONE generation POST ── */
  {
    const n = network();
    const budget = createLiveSpendBudget(1);
    const t = imageTransport(n, budget);
    const prepared = await t.prepareSourceImage!({ bytes: BYTES, contentType: "image/png" });
    assert.equal(prepared.status, "prepared");
    assert.equal(n.preparePosts().length, 1, "one prepare POST");
    assert.deepEqual(JSON.parse(n.preparePosts()[0]!.body as string), { content_type: "image/png" });
    assert.equal(n.preparePosts()[0]!.headers.authorization, `Key ${KEY}`, "the prepare call is authenticated");
    assert.equal(n.uploads.length, 1, "one PUT");
    const put = n.uploads[0]!;
    assert.equal(put.url, UPLOAD_URL);
    assert.equal(put.method, "PUT");
    assert.deepEqual(put.headers, { "content-type": "image/png", "x-amz-tagging": "retention=temporary" }, "ONLY the documented headers");
    assert.ok(!JSON.stringify(put.headers).includes(KEY), "the credential never goes to storage");
    assert.deepEqual([...(put.body as Uint8Array)], [...BYTES], "exactly the verified bytes");
    assert.equal(n.generationPosts().length, 0, "preparing is not generating");
    if (prepared.status !== "prepared") throw new Error("unreachable");
    assert.ok(!JSON.stringify(prepared).includes("SOURCE-PUBLIC-URL-SECRET"), "the public URL is not enumerable");
    assert.ok(!JSON.stringify(prepared).includes("UPLOAD-URL-SECRET"));

    const outcome = await t.dispatch({ promptText: "A slow push-in.", inputDigest: "0".repeat(64), invocationId: "inv", source: prepared.source });
    assert.deepEqual(outcome, { status: "accepted", providerJobId: REQUEST_ID });
    assert.equal(n.generationPosts().length, 1, "exactly one generation POST");
    const gen = n.generationPosts()[0]!;
    assert.equal(gen.url, "https://api.higgsfield.ai/pixverse/v6/image-to-video");
    assert.deepEqual(JSON.parse(gen.body as string), {
      prompt: "A slow push-in.",
      image_url: PUBLIC_URL,
      duration: 5,
      resolution: "720p",
      generate_audio: false,
    }, "exactly the documented fields; image_url is the provider public_url");
    /* A budget of ONE survived the prepare and was spent by the generation POST alone. */
    assert.equal(budget.attempt(), false, "the budget was spent by the generation POST only");
  }

  /* ── 3. every upload refusal → NO generation POST, and nothing retried ── */
  const refusals: [string, Parameters<typeof network>[0], "upload-refused" | "upload-unknown"][] = [
    ["prepare throws", { prepare: () => { throw new Error("socket"); } }, "upload-unknown"],
    ["prepare 500", { prepare: () => json(500, { detail: "x" }) }, "upload-refused"],
    ["prepare 401", { prepare: () => json(401, { detail: "x" }) }, "upload-refused"],
    ["no temporary retention tag", { prepare: () => json(200, { ...GOOD_GRANT, upload_headers: { "Content-Type": "image/png" } }) }, "upload-unknown"],
    ["an undocumented header", { prepare: () => json(200, { ...GOOD_GRANT, upload_headers: { ...GOOD_GRANT.upload_headers, Authorization: "x" } }) }, "upload-unknown"],
    ["a different content type", { prepare: () => json(200, { ...GOOD_GRANT, content_type: "image/jpeg" }) }, "upload-unknown"],
    ["a plain-http public url", { prepare: () => json(200, { ...GOOD_GRANT, public_url: "http://uploads.i2v.test/x.png" }) }, "upload-unknown"],
    ["PUT throws", { put: () => { throw new Error("reset"); } }, "upload-unknown"],
    ["PUT 403", { put: () => new Response(null, { status: 403 }) }, "upload-refused"],
  ];
  for (const [label, opts, reason] of refusals) {
    const n = network(opts);
    const t = imageTransport(n);
    const r = await t.prepareSourceImage!({ bytes: BYTES, contentType: "image/png" });
    assert.deepEqual(r, { status: "refused", reason }, label);
    assert.ok(n.preparePosts().length <= 1 && n.uploads.length <= 1, `${label}: nothing retried`);
    assert.equal(n.generationPosts().length, 0, `${label}: generation POST = 0`);
  }
  {
    const n = network();
    const r = await imageTransport(n).prepareSourceImage!({ bytes: BYTES, contentType: "image/gif" });
    assert.deepEqual(r, { status: "refused", reason: "unsupported-type" }, "a type Media does not admit is not uploaded");
    assert.equal(n.api.length + n.uploads.length, 0, "no call at all");
  }
  assert.equal(readHiggsfieldUploadGrant({ ...GOOD_GRANT, upload_url: "https://user:pw@storage.i2v.test/x" }, "image/png"), null, "credentials in a URL are refused");

  /* ── 4. dispatch refuses locally without a source, and a text profile refuses one ── */
  {
    const n = network();
    const budget = createLiveSpendBudget(1);
    const t = imageTransport(n, budget);
    assert.deepEqual(await t.dispatch({ promptText: "x", inputDigest: "0".repeat(64), invocationId: "i" }), { status: "rejected", failure: "request-rejected" });
    assert.equal(n.api.length, 0, "no request without a source");
    assert.equal(budget.attempt(), true, "and no budget spent");
    const text = createHiggsfieldVideoTransport({ credential: { apiKey: KEY }, spendBudget: createLiveSpendBudget(1), fetchImpl: n.fetchImpl });
    const fake = Object.freeze({ contentType: "image/png", byteSize: 1, reveal: () => PUBLIC_URL });
    assert.deepEqual(await text.dispatch({ promptText: "x", inputDigest: "0".repeat(64), invocationId: "i", source: fake }), { status: "rejected", failure: "request-rejected" });
    assert.equal(n.api.length, 0, "a text profile never sends an image");
  }

  /* ── 5. the ambiguous generation POST stays unknown and is not retried ── */
  {
    const n = network({ generate: () => { throw new Error("timeout after write"); } });
    const t = imageTransport(n);
    const prepared = await t.prepareSourceImage!({ bytes: BYTES, contentType: "image/png" });
    if (prepared.status !== "prepared") throw new Error("unreachable");
    assert.deepEqual(await t.dispatch({ promptText: "x", inputDigest: "0".repeat(64), invocationId: "i", source: prepared.source }), { status: "unknown" });
    assert.equal(n.generationPosts().length, 1, "one POST, never repeated");
  }

  /* ── 6. the resolver: an image request needs the SEPARATE image-to-video control ── */
  {
    const env = { HEBUN_VIDEO_GENERATION_TRANSPORT: "live", HEBUN_HIGGSFIELD_API_KEY: KEY };
    const asked: string[] = [];
    const controls = (on: readonly string[]) => async (key: string) => {
      asked.push(key);
      return on.includes(key);
    };
    const textOnly = await resolveLiveVideoGenerationTransport({ env, resolveDirectorEnabled: controls([HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY]) }, { inputMode: "image" });
    assert.deepEqual(textOnly, { status: "unavailable", reason: "video-generation-disabled" }, "arming text-to-video does not arm image-to-video");
    assert.equal(asked.at(-1), HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY);
    const image = await resolveLiveVideoGenerationTransport({ env, resolveDirectorEnabled: controls([HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY]) }, { inputMode: "image" });
    assert.equal(image.status, "available");
    if (image.status === "available") {
      assert.equal(image.transport.inputMode, "image");
      assert.equal(image.transport.model, HIGGSFIELD_IMAGE_TO_VIDEO_MODEL);
    }
    const text = await resolveLiveVideoGenerationTransport({ env, resolveDirectorEnabled: controls([HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY]) });
    assert.deepEqual(text, { status: "unavailable", reason: "video-generation-disabled" }, "arming image-to-video does not arm text-to-video");
    assert.equal(asked.at(-1), HIGGSFIELD_VIDEO_GENERATION_CONTROL_KEY, "a request without a mode is a text request");
    assert.deepEqual(
      await resolveLiveVideoGenerationTransport({ env: { HEBUN_VIDEO_GENERATION_TRANSPORT: "live" }, resolveDirectorEnabled: controls([HIGGSFIELD_IMAGE_TO_VIDEO_CONTROL_KEY]) }, { inputMode: "image" }),
      { status: "unavailable", reason: "video-generation-misconfigured" },
      "no credential, no image transport",
    );
  }

  console.log("image-to-video/transport-contract: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
