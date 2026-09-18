/*
 * MEDIA-5 — one admitted image becomes the input to a new one.
 *
 * No database. Every claim here is about types, bytes, request shapes and file contents: the two
 * canonical forms, the widened transport, the new private byte seam, and the walls that keep a
 * reference edit from becoming an edit of the original.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  MEDIA_INPUT_CANONICAL_VERSION,
  MEDIA_INPUT_CANONICAL_VERSION_REFERENCE,
  canonicalMediaGenerationInput,
  digestMediaGenerationInput,
} from "../../src/features/media-assets/input-digest";
import { MEDIA_ASSET_LIMITS } from "../../src/features/media-assets/contracts";
import {
  OPENAI_IMAGE_EDITS_URL,
  OPENAI_IMAGE_GENERATIONS_URL,
  OPENAI_IMAGE_MODEL,
  createOpenAiImageTransport,
} from "../../src/features/media-generation-live/openai-image-transport.server";
import { createLiveSpendBudget } from "../../src/features/heby-model-live/live-spend-budget.server";
import { createMemoryMediaObjectStore, pngBytes } from "../helpers/media-fakes";

const read = (f: string): string => readFileSync(f, "utf8");
const strip = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const AUTHORITY = "src/features/media-assets/request-media-generation.server.ts";
const PORT = "src/features/media-assets/media-object-store.ts";
const VPS = "src/features/media-assets/vps-media-object-store.server.ts";
const TRANSPORT = "src/features/media-generation-live/openai-image-transport.server.ts";
const CARD = "src/components/operations-preparation/revision-media-assets.tsx";
const ACTIONS = "src/app/(dashboard)/operations/actions.ts";
const SCHEMA = "src/db/schema/media-asset.ts";

const BASE = {
  promptText: "Keep the loom, change the background to plain linen.",
  sourceArtifactId: "33333333-3333-4333-8333-333333333333",
  sourceRevisionNo: 2,
  sourceContentDigest: "c".repeat(64),
  transport: "live",
  provider: "openai",
  model: OPENAI_IMAGE_MODEL,
};
const ASSET_A = { assetId: "44444444-4444-4444-8444-444444444444", byteDigest: "a".repeat(64) };
const ASSET_B = { assetId: "55555555-5555-4555-8555-555555555555", byteDigest: "b".repeat(64) };
const KEY = "sk-media5-test-key";

async function main(): Promise<void> {
  /* ── 1. CANONICAL V1 IS UNCHANGED, AND V2 IS ONLY FOR A REFERENCE EDIT ──── */
  {
    const v1 = canonicalMediaGenerationInput(BASE);
    assert.equal(JSON.parse(v1).v, MEDIA_INPUT_CANONICAL_VERSION, "text-to-image stays v1");
    assert.ok(!v1.includes("sourceAsset"), "a v1 document carries no sourceAsset key at all");
    /* Absent, explicitly null, and explicitly undefined must all be the SAME v1 bytes. */
    assert.equal(canonicalMediaGenerationInput({ ...BASE, sourceAsset: null }), v1);
    assert.equal(canonicalMediaGenerationInput({ ...BASE, sourceAsset: undefined }), v1);

    const v2 = canonicalMediaGenerationInput({ ...BASE, sourceAsset: ASSET_A });
    assert.equal(JSON.parse(v2).v, MEDIA_INPUT_CANONICAL_VERSION_REFERENCE, "a reference edit is v2");
    assert.notEqual(v1, v2, "the two forms are different documents");

    /* Draft provenance and asset lineage COEXIST: v2 still carries the exact source revision. */
    const parsed = JSON.parse(v2) as { source: Record<string, unknown>; sourceAsset: Record<string, unknown> };
    assert.deepEqual(parsed.source, {
      artifactId: BASE.sourceArtifactId,
      revisionNo: BASE.sourceRevisionNo,
      contentDigest: BASE.sourceContentDigest,
    });
    assert.deepEqual(parsed.sourceAsset, ASSET_A);
  }

  /* ── 2. THE EVIDENCE DISTINGUISHES ASSET A FROM ASSET B ─────────────────── */
  {
    const a = digestMediaGenerationInput({ ...BASE, sourceAsset: ASSET_A });
    const b = digestMediaGenerationInput({ ...BASE, sourceAsset: ASSET_B });
    const none = digestMediaGenerationInput(BASE);
    assert.notEqual(a, b, "same prompt + same revision + a different asset digests differently");
    assert.notEqual(a, none, "a reference edit never digests as its text-to-image twin");
    /* Same id, different BYTES, is also a different request — the digest is why. */
    assert.notEqual(
      a,
      digestMediaGenerationInput({ ...BASE, sourceAsset: { ...ASSET_A, byteDigest: "d".repeat(64) } }),
      "the byte digest participates, not just the id",
    );
    assert.equal(a, digestMediaGenerationInput({ ...BASE, sourceAsset: { ...ASSET_A, assetId: ASSET_A.assetId.toUpperCase() } }), "ids are canonicalized");
  }

  /* ── 3. THE PORT GAINED BYTES, AND THE PREVIEW SEAM IS NOT THE INPUT SEAM ── */
  {
    const port = strip(read(PORT));
    assert.match(
      port,
      /get\(input: \{\s*readonly key: string;\s*readonly contentType: MediaAssetMimeType;\s*readonly maxBytes: number;\s*\}\)/,
      "the port exposes a bounded byte read that is TOLD the authoritative content type",
    );
    assert.ok(!/delete|purge|remove/i.test(port.replace(/deliberately no `delete`/g, "")), "still no delete verb");

    const store = createMemoryMediaObjectStore();
    const bytes = pngBytes(64, 64, 32);
    await store.put({ key: "tenants/x/media/y", bytes, contentType: "image/png", sha256Hex: createHash("sha256").update(bytes).digest("hex") });

    assert.deepEqual(await store.get({ key: "tenants/x/media/missing", contentType: "image/png", maxBytes: 10 }), { status: "absent" });
    assert.deepEqual((await store.get({ key: "tenants/x/media/y", contentType: "image/png", maxBytes: 4 })).status, "too-large");
    const got = await store.get({ key: "tenants/x/media/y", contentType: "image/png", maxBytes: MEDIA_ASSET_LIMITS.maxByteSize });
    assert.equal(got.status, "read");
    /* Reading bytes mints NO grant: the preview path and the input path are genuinely separate. */
    assert.deepEqual(store.readGrants, [], "a server-side byte read creates no read grant");
  }

  /* ── 4. THE VPS ADAPTER REUSES THE EXISTING SIGNED ROUTE, PRIVATELY ─────── */
  {
    const vps = strip(read(VPS));
    /* Bounded to the `get` body: `createReadAccess` follows it and legitimately returns a url. */
    const afterGet = vps.slice(vps.indexOf("async get(input)"));
    const fn = afterGet.slice(0, afterGet.indexOf("async createReadAccess"));
    assert.ok(fn.length > 0 && fn.length < afterGet.length, "the get body was isolated from createReadAccess");
    assert.match(fn, /\/v1\/read\//, "it consumes the route the store already serves");
    assert.ok(!/\/v1\/objects\/|\/v1\/verify\//.test(fn), "it invents no route and writes nothing");
    assert.match(fn, /redirect: "error"/, "redirects are refused");
    assert.match(fn, /AbortSignal\.timeout/, "the read is bounded in time");
    assert.match(fn, /content-length/, "an oversized object is refused before it is buffered");
    /* The grant is built and consumed here; it is never returned, so no caller can hold it. */
    assert.ok(!/return \{[^}]*url/.test(fn), "the get seam returns bytes, never a url");
    assert.match(vps, /VPS_SERVER_READ_TTL_SECONDS = 30/, "a server-consumed grant is short-lived");
  }

  /* ── 5. TEXT MODE IS UNCHANGED; REFERENCE MODE IS MULTIPART, ONE IMAGE ──── */
  {
    const calls: { url: string; init: { headers: Record<string, string>; body: string | FormData } }[] = [];
    const okBody = JSON.stringify({ created: 1, data: [{ b64_json: Buffer.from(pngBytes(8, 8)).toString("base64") }] });
    const fetchImpl = async (url: string, init: never) => {
      calls.push({ url, init: init as never });
      return new Response(okBody, { status: 200, headers: { "x-request-id": "req_media5" } });
    };
    const transport = createOpenAiImageTransport({ apiKey: KEY, spendBudget: createLiveSpendBudget(4), fetchImpl: fetchImpl as never });
    assert.deepEqual([...transport.modes].sort(), ["reference-edit", "text-to-image"]);

    await transport.generate({ promptText: "a kilim", inputDigest: "e".repeat(64), invocationId: "inv-1", request: { mode: "text-to-image" } });
    assert.equal(calls[0]!.url, OPENAI_IMAGE_GENERATIONS_URL, "text-to-image still posts to /images/generations");
    assert.equal(typeof calls[0]!.init.body, "string", "text-to-image still sends JSON");
    assert.equal(calls[0]!.init.headers["content-type"], "application/json");

    const refBytes = pngBytes(32, 32, 16);
    await transport.generate({
      promptText: "change the background",
      inputDigest: "f".repeat(64),
      invocationId: "inv-2",
      request: { mode: "reference-edit", referenceImage: { bytes: refBytes, contentType: "image/png", fileName: "a.png" } },
    });
    assert.equal(calls[1]!.url, OPENAI_IMAGE_EDITS_URL, "a reference edit posts to /images/edits");
    const form = calls[1]!.init.body;
    assert.ok(form instanceof FormData, "a reference edit sends multipart");
    /* fetch derives the multipart boundary; setting content-type by hand would break the body. */
    assert.equal(calls[1]!.init.headers["content-type"], undefined, "multipart content-type is not hand-set");
    assert.equal(form.getAll("image").length, 1, "EXACTLY one image part");
    assert.equal(form.get("model"), OPENAI_IMAGE_MODEL, "the same pinned model, unchanged");
    assert.equal(form.get("prompt"), "change the background");
    assert.equal(form.get("mask"), null, "MEDIA-5 sends no mask");
    assert.equal(form.get("input_fidelity"), null, "input_fidelity is deliberately not sent");
    assert.equal(form.get("response_format"), null, "response_format is DALL-E-2 only and is not sent");
    assert.equal(form.get("n"), "1", "exactly one output");
  }

  /* ── 6. NO AUTOMATIC PAID RETRY, IN EITHER MODE ─────────────────────────── */
  {
    const transportSrc = strip(read(TRANSPORT));
    assert.ok(!/retry|retries|backoff/i.test(transportSrc), "the transport contains no retry of any kind");
    let attempts = 0;
    const budget = createLiveSpendBudget(5);
    const failing = createOpenAiImageTransport({
      apiKey: KEY,
      spendBudget: budget,
      fetchImpl: (async () => {
        attempts += 1;
        return new Response(JSON.stringify({ error: { code: "rate_limit_exceeded" } }), { status: 429 });
      }) as never,
    });
    const outcome = await failing.generate({
      promptText: "x",
      inputDigest: "0".repeat(64),
      invocationId: "inv-3",
      request: { mode: "reference-edit", referenceImage: { bytes: pngBytes(8, 8), contentType: "image/png", fileName: "a.png" } },
    });
    assert.equal(outcome.status, "failed");
    assert.equal(attempts, 1, "one failed reference edit is one request, never two");
    assert.equal(budget.spent(), 1, "and it costs exactly one unit of the shared budget");
  }

  /* ── 7. THE AUTHORITY VERIFIES BYTES BEFORE THE PROVIDER, NOT AFTER ─────── */
  {
    const authority = strip(read(AUTHORITY));
    const preflight = authority.slice(0, authority.indexOf("The idempotent dispatch boundary") + 1 || authority.indexOf(".insert(mediaGenerationInvocations)"));
    assert.match(preflight, /storage\.store\.get\(/, "the source bytes are read in preflight");
    assert.match(preflight, /createHash\("sha256"\)/, "and digested here, not trusted from the store");
    assert.match(preflight, /source-asset-unavailable/, "a mismatch refuses");
    /* The read happens BEFORE the invocation row exists, so a refusal costs nothing. */
    assert.ok(
      authority.indexOf("storage.store.get(") < authority.indexOf(".insert(mediaGenerationInvocations)"),
      "bytes are verified before any row is written",
    );
    assert.ok(
      authority.indexOf("storage.store.get(") < authority.indexOf("transport.generate("),
      "bytes are verified before the provider is called",
    );
    /* Custody gates eligibility; Governance is not consulted at all. */
    assert.match(authority, /asset\.lifecycle !== "admitted"/, "only the custody lifecycle gates a source asset");
    assert.ok(
      !/decisionRecords|readMediaAssetReviewState|governanceSessions/.test(authority),
      "the generation authority reads no Governance state",
    );
    /* The key is derived, never accepted. */
    assert.match(authority, /mediaAssetStorageKey\(tenant\.tenantId, sourceAssetId\)/, "the storage key is derived from the session tenant");
    assert.ok(!/input\.storageKey|input\.key|input\.url|input\.bytes/.test(authority), "no caller-supplied key, url or bytes");
  }

  /* ── 8. LINEAGE IS RECORDED, AND OWNS NOTHING ───────────────────────────── */
  {
    const authority = strip(read(AUTHORITY));
    assert.match(authority, /sourceMediaAssetId: sourceAssetId/, "the invocation records which asset it used");
    /* The source asset is never written to. The only media write is the NEW asset. */
    assert.ok(!/\.update\(\s*mediaAssets\s*\)/.test(authority), "no update of any media asset");
    assert.ok(!/retireMediaAsset|assetLifecycleStatus:/.test(authority), "no lifecycle is moved");

    const schema = strip(read(SCHEMA));
    assert.match(schema, /sourceMediaAssetId: uuid\("source_media_asset_id"\)/, "the column exists");
    assert.ok(!/source_media_asset_id.*notNull|sourceMediaAssetId.*\.notNull\(\)/.test(schema), "and it is nullable: text-to-image rows stay valid");
    assert.match(schema, /media_generation_invocations_source_asset_fk/, "a named foreign key");
    assert.match(
      schema,
      /columns: \[t\.tenantId, t\.sourceMediaAssetId\]/,
      "composite on the tenant: another tenant's asset is unrepresentable",
    );
    /* No new truth was added to media_assets. */
    for (const word of ["selected", "attached", "attachment", "approved", "approval", "inherit"]) {
      assert.ok(!new RegExp(`${word}`, "i").test(schema.slice(schema.indexOf("export const mediaAssets"))), `media_assets holds no ${word} column`);
    }
  }

  /* ── 9. THE HUMAN BOUNDARY CARRIES AN ASSET ID AND NOTHING ELSE ─────────── */
  {
    const card = strip(read(CARD));
    assert.match(card, /sourceAssetId: asset\.assetId/, "the surface sends the asset id");
    assert.ok(!/storageKey|storage_key|\/v1\/read|signature|secret/i.test(card), "no key, url or credential on the surface");
    assert.match(card, /useMemo\(\(\) => crypto\.randomUUID\(\), \[\]\)/, "one request key per mounted form");
    assert.match(card, /disabled=\{generating/, "an in-flight request cannot be double-submitted");
    /* Retired removes the control; Governance state never does. */
    assert.match(card, /\{retired \? null : <UseAsReference/, "a retired asset offers no reference control");
    assert.ok(
      !/decision === "declined"[\s\S]{0,200}disabled/.test(card),
      "a declined decision does not disable anything",
    );
    /* The promise the human is shown. */
    assert.match(card, /This image is not changed/i, "the surface says the original is untouched");
    /*
     * SELECTION AND ATTACHMENT ARE BANNED OUTRIGHT — no such fact exists, so no copy may imply one.
     * PUBLICATION is banned only as an AFFIRMATIVE claim: "publishes nothing" is the honest sentence
     * and the same doctrine MEDIA-1's firewall already applies — ban identifiers and claims, let
     * prose say what the thing is not.
     */
    const referenceBody = card.slice(card.indexOf("function UseAsReference"));
    assert.ok(!/select|attach|schedul/i.test(referenceBody), "no selection, attachment or scheduling language");
    for (const match of referenceBody.match(/[^.]*publish[^.]*/gi) ?? []) {
      assert.match(match, /nothing|not\b|no\b/i, `publication is only ever denied, never claimed: "${match.trim()}"`);
    }

    const actions = strip(read(ACTIONS));
    assert.match(actions, /requestMediaGeneration\(tenant, input\)/, "the released pass-through, unchanged");
    assert.ok(!/requestMediaEdit|requestReferenceGeneration/.test(actions), "no second generation authority");
  }

  /* ── 10. FIREWALL: NO PUBLISH, PERMIT, EXECUTION, KNOWLEDGE OR CONTROL ──── */
  {
    for (const file of [AUTHORITY, TRANSPORT, CARD]) {
      const c = strip(read(file));
      assert.ok(
        !/recordActionRequest|action-authorization|action-execution|mintPermit|issuePermit|heby-action-inlet/.test(c),
        `${file}: a reference edit reaches no act authority`,
      );
      assert.ok(!/knowledge_nodes|knowledgeNodes|ratif/i.test(c), `${file}: nothing becomes Knowledge`);
      assert.ok(!/provider_connectivity_controls|providerConnectivityControls/.test(c), `${file}: no second connectivity control`);
      assert.ok(!/instagram|youtube/i.test(c), `${file}: no provider surface is touched`);
    }
    /* The one connectivity control stays the released one — MEDIA-5 adds no key. */
    const control = read("src/features/media-generation-live/openai-image-control.ts");
    assert.equal((control.match(/openai-image-generation/g) ?? []).length >= 1, true);
    assert.ok(!/openai-image-edit|openai-image-input/.test(control), "no MEDIA-5 connectivity control was invented");
  }

  console.log("media5-reference-edit/contract-and-firewall: all assertions passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
