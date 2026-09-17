/*
 * MEDIA-1 — the pure admission contract: what counts as an admissible image, the canonical input
 * digest, the storage identity, the bounded provider download, and the fail-closed runtime resolvers.
 *
 * No database. Every claim here is about bytes, strings and resolver answers.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  MEDIA_ASSET_LIMITS,
  MEDIA_ASSET_MIME_TYPES,
  MEDIA_GENERATION_TRANSPORT,
  mediaAssetStorageKey,
} from "../../src/features/media-assets/contracts";
import { readImageSignature } from "../../src/features/media-assets/image-signature";
import { verifyAdmissibleImage } from "../../src/features/media-assets/admission-verification";
import {
  canonicalMediaGenerationInput,
  digestMediaGenerationInput,
} from "../../src/features/media-assets/input-digest";
import { resolveMediaObjectStore } from "../../src/features/media-assets/media-storage.server";
import { resolveMediaGenerationTransport } from "../../src/features/media-assets/media-generation-transport.server";
import { downloadProviderOutput } from "../../src/features/media-assets/provider-output-download.server";
import {
  FAKE_MEDIA_HOST,
  createFakeMediaGenerationTransport,
  gifBytes,
  jpegBytes,
  pngBytes,
  svgBytes,
  webpBytes,
} from "../helpers/media-fakes";

const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

async function main(): Promise<void> {
  /* ── 1. Recognized image types, dimensions read from headers ─────────────── */
  {
    const png = readImageSignature(pngBytes(640, 480));
    assert.deepEqual(png, { status: "recognized", mimeType: "image/png", width: 640, height: 480 });
    const jpeg = readImageSignature(jpegBytes(1080, 1350));
    assert.deepEqual(jpeg, { status: "recognized", mimeType: "image/jpeg", width: 1080, height: 1350 });
    const webp = readImageSignature(webpBytes(1920, 1080));
    assert.deepEqual(webp, { status: "recognized", mimeType: "image/webp", width: 1920, height: 1080 });
    assert.deepEqual([...MEDIA_ASSET_MIME_TYPES], ["image/png", "image/jpeg", "image/webp"]);
  }

  /* ── 2. Unsupported and malformed bytes are refused ─────────────────────── */
  {
    assert.equal(verifyAdmissibleImage(gifBytes(), null).status, "refused");
    const svg = verifyAdmissibleImage(svgBytes(), "image/svg+xml");
    assert.deepEqual(svg, { status: "refused", reason: "unsupported-image-signature" }, "SVG is never admissible");
    assert.deepEqual(verifyAdmissibleImage(new Uint8Array(0), null), { status: "refused", reason: "empty-bytes" });

    const truncatedPng = pngBytes(10, 10).subarray(0, 40);
    assert.deepEqual(verifyAdmissibleImage(truncatedPng, null), { status: "refused", reason: "malformed-image" });
    const jpegNoEoi = jpegBytes(10, 10).subarray(0, jpegBytes(10, 10).length - 2);
    assert.deepEqual(verifyAdmissibleImage(jpegNoEoi, null), { status: "refused", reason: "malformed-image" });
    const webpBadRiff = new Uint8Array([...webpBytes(10, 10), 0]);
    assert.deepEqual(verifyAdmissibleImage(webpBadRiff, null), { status: "refused", reason: "malformed-image" });
    assert.deepEqual(verifyAdmissibleImage(pngBytes(0, 10), null), { status: "refused", reason: "malformed-image" });
  }

  /* ── 3. The declared type is used only to refuse a disagreement ─────────── */
  {
    assert.deepEqual(verifyAdmissibleImage(jpegBytes(10, 10), "image/png"), {
      status: "refused",
      reason: "declared-type-mismatch",
    });
    assert.equal(verifyAdmissibleImage(pngBytes(10, 10), "IMAGE/PNG; charset=binary").status, "verified");
    assert.equal(verifyAdmissibleImage(pngBytes(10, 10), null).status, "verified");
  }

  /* ── 4. Bounds: bytes and dimensions, at and past the limit ─────────────── */
  {
    assert.equal(MEDIA_ASSET_LIMITS.maxByteSize, 20 * 1024 * 1024);
    assert.equal(MEDIA_ASSET_LIMITS.maxDimension, 8192);
    assert.equal(MEDIA_ASSET_LIMITS.maxPromptCodePoints, 4000);
    assert.equal(verifyAdmissibleImage(pngBytes(8192, 8192), null).status, "verified");
    assert.deepEqual(verifyAdmissibleImage(pngBytes(8193, 10), null), { status: "refused", reason: "dimensions-exceeded" });
    assert.deepEqual(verifyAdmissibleImage(webpBytes(10, 8193), null), { status: "refused", reason: "dimensions-exceeded" });

    const atLimit = pngBytes(10, 10, MEDIA_ASSET_LIMITS.maxByteSize - pngBytes(10, 10, 0).length);
    assert.equal(atLimit.length, MEDIA_ASSET_LIMITS.maxByteSize);
    assert.equal(verifyAdmissibleImage(atLimit, null).status, "verified");
    const overLimit = pngBytes(10, 10, MEDIA_ASSET_LIMITS.maxByteSize - pngBytes(10, 10, 0).length + 1);
    assert.deepEqual(verifyAdmissibleImage(overLimit, null), { status: "refused", reason: "byte-size-exceeded" });
  }

  /* ── 5. The digest is SHA-256 over the exact bytes ──────────────────────── */
  {
    const bytes = jpegBytes(300, 200);
    const verified = verifyAdmissibleImage(bytes, "image/jpeg");
    assert.equal(verified.status, "verified");
    if (verified.status === "verified") {
      assert.equal(verified.image.byteDigest, sha(bytes));
      assert.equal(verified.image.byteSize, bytes.length);
    }
  }

  /* ── 6. Canonical input digest: deterministic, sensitive to every field ─── */
  {
    const base = {
      promptText: "A kilim on a loom, morning light.",
      sourceArtifactId: "11111111-1111-4111-8111-111111111111",
      sourceRevisionNo: 2,
      sourceContentDigest: "a".repeat(64),
      transport: "fake",
      provider: "p",
      model: "m",
    };
    const d = digestMediaGenerationInput(base);
    assert.match(d, /^[0-9a-f]{64}$/);
    assert.equal(digestMediaGenerationInput({ ...base }), d);
    assert.equal(
      digestMediaGenerationInput({ ...base, sourceArtifactId: base.sourceArtifactId.toUpperCase() }),
      d,
      "uuid case does not change identity",
    );
    for (const change of [
      { promptText: base.promptText + " " },
      { sourceRevisionNo: 3 },
      { sourceContentDigest: "b".repeat(64) },
      { provider: "q" },
      { model: "n" },
    ]) {
      assert.notEqual(digestMediaGenerationInput({ ...base, ...change }), d, JSON.stringify(change));
    }
    assert.equal(
      canonicalMediaGenerationInput(base),
      '{"v":1,"promptText":"A kilim on a loom, morning light.","source":{"artifactId":"11111111-1111-4111-8111-111111111111","revisionNo":2,"contentDigest":"' +
        "a".repeat(64) +
        '"},"transport":"fake","provider":"p","model":"m"}',
    );
  }

  /* ── 7. Storage identity names the tenant and the asset, nothing else ───── */
  {
    assert.equal(
      mediaAssetStorageKey("AAAAAAAA-0000-4000-8000-000000000000", "BBBBBBBB-0000-4000-8000-000000000000"),
      "tenants/aaaaaaaa-0000-4000-8000-000000000000/media/bbbbbbbb-0000-4000-8000-000000000000",
    );
  }

  /* ── 8. Runtime resolvers fail closed: storage NOT connected, NO provider ── */
  {
    const saved = { ...process.env };
    (process.env as Record<string, string>).NODE_ENV = "production";
    process.env.AWS_REGION = "eu-central-1";
    process.env.HEBUN_MEDIA_BUCKET = "looks-configured";
    process.env.BLOB_READ_WRITE_TOKEN = "looks-configured";
    try {
      assert.deepEqual(resolveMediaObjectStore(), { status: "unavailable", reason: "storage-not-connected" });
      assert.deepEqual(resolveMediaGenerationTransport(), { status: "unavailable", reason: "no-generation-provider" });
    } finally {
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    }
    const storageSource = readFileSync("src/features/media-assets/media-storage.server.ts", "utf8");
    assert.ok(!/process\.env/.test(storageSource), "the storage resolver reads no configuration contract");
  }

  /* ── 9. The fake transport is unmistakably fake ─────────────────────────── */
  {
    const fake = createFakeMediaGenerationTransport({ kind: "bytes", bytes: pngBytes(1, 1) });
    assert.equal(fake.transport, "fake");
    assert.equal(MEDIA_GENERATION_TRANSPORT, "fake");
    assert.match(fake.provider, /fake/);
    assert.match(fake.model, /fake/);
    assert.ok(fake.allowedDownloadHosts.every((h) => h.endsWith(".invalid")), "fake hosts are unresolvable by RFC 2606");
  }

  /* ── 10. Provider download: allowlist, redirects, status, size, timeout ─── */
  {
    const png = pngBytes(20, 20);
    const requested: string[] = [];
    const respond =
      (routes: Record<string, () => Response>): typeof fetch =>
      async (input) => {
        const url = String(input);
        requested.push(url);
        const route = routes[url];
        if (!route) throw new Error("unexpected fetch");
        return route();
      };
    const ok = (body: Uint8Array, headers: Record<string, string> = {}) => () =>
      new Response(body as BodyInit, { status: 200, headers: { "content-type": "image/png", ...headers } });
    const redirect = (to: string) => () => new Response(null, { status: 302, headers: { location: to } });
    const hosts = [FAKE_MEDIA_HOST];
    const u = (p: string) => `https://${FAKE_MEDIA_HOST}${p}`;

    const good = await downloadProviderOutput(u("/a.png"), hosts, { fetchImpl: respond({ [u("/a.png")]: ok(png) }) });
    assert.equal(good.status, "downloaded");
    if (good.status === "downloaded") assert.equal(sha(good.bytes), sha(png));
    assert.ok(!("url" in good), "the result never carries the URL");

    const fetchNever: typeof fetch = async () => {
      throw new Error("must not fetch");
    };
    for (const [url, reason] of [
      ["http://" + FAKE_MEDIA_HOST + "/a.png", "download-url-invalid"],
      ["https://user:pw@" + FAKE_MEDIA_HOST + "/a.png", "download-url-invalid"],
      ["https://" + FAKE_MEDIA_HOST + ":8443/a.png", "download-url-invalid"],
      ["https://evil.example/a.png", "download-host-not-allowed"],
      ["https://sub." + FAKE_MEDIA_HOST + "/a.png", "download-host-not-allowed"],
      ["https://169.254.169.254/latest/meta-data", "download-host-not-allowed"],
      ["not a url", "download-url-invalid"],
    ] as const) {
      assert.deepEqual(await downloadProviderOutput(url, hosts, { fetchImpl: fetchNever }), { status: "refused", reason }, url);
    }
    assert.deepEqual(
      await downloadProviderOutput(u("/a.png"), [], { fetchImpl: fetchNever }),
      { status: "refused", reason: "download-host-not-allowed" },
      "an empty allowlist refuses every URL",
    );

    /* Redirect inside the allowlist is followed; outside it is refused on that hop. */
    const followed = await downloadProviderOutput(u("/r1"), hosts, {
      fetchImpl: respond({ [u("/r1")]: redirect("/r2"), [u("/r2")]: ok(png) }),
    });
    assert.equal(followed.status, "downloaded");
    requested.length = 0;
    const escaped = await downloadProviderOutput(u("/r1"), hosts, {
      fetchImpl: respond({ [u("/r1")]: redirect("http://127.0.0.1/admin") }),
    });
    assert.equal(escaped.status, "refused");
    assert.deepEqual(requested, [u("/r1")], "the disallowed hop is never requested");
    const offHost = await downloadProviderOutput(u("/r1"), hosts, {
      fetchImpl: respond({ [u("/r1")]: redirect("https://evil.example/x") }),
    });
    assert.deepEqual(offHost, { status: "refused", reason: "download-host-not-allowed" });
    const tooMany = await downloadProviderOutput(u("/r1"), hosts, {
      fetchImpl: respond({ [u("/r1")]: redirect("/r2"), [u("/r2")]: redirect("/r3"), [u("/r3")]: redirect("/r4") }),
    });
    assert.deepEqual(tooMany, { status: "refused", reason: "download-redirect-refused" });

    const notFound = await downloadProviderOutput(u("/a"), hosts, {
      fetchImpl: respond({ [u("/a")]: () => new Response("no", { status: 404 }) }),
    });
    assert.deepEqual(notFound, { status: "refused", reason: "download-status-refused" });

    const declaredHuge = await downloadProviderOutput(u("/a"), hosts, {
      fetchImpl: respond({
        [u("/a")]: () =>
          new Response(png as BodyInit, { status: 200, headers: { "content-length": String(MEDIA_ASSET_LIMITS.maxByteSize + 1) } }),
      }),
    });
    assert.deepEqual(declaredHuge, { status: "refused", reason: "byte-size-exceeded" });

    /* A body that lies about its length is cut off while streaming. */
    const chunk = new Uint8Array(1024 * 1024);
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += chunk.length;
        controller.enqueue(chunk);
      },
    });
    const streamed = await downloadProviderOutput(u("/a"), hosts, {
      fetchImpl: respond({ [u("/a")]: () => new Response(endless, { status: 200 }) }),
    });
    assert.deepEqual(streamed, { status: "refused", reason: "byte-size-exceeded" });
    assert.ok(sent <= MEDIA_ASSET_LIMITS.maxByteSize + 2 * chunk.length, "reading stopped near the limit");

    const hanging: typeof fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal!.reason));
      });
    /* AbortSignal.timeout's timer is unref'd: keep the loop alive, or Node exits 0 mid-test. */
    const keepAlive = setInterval(() => undefined, 1000);
    const timedOut = await downloadProviderOutput(u("/a"), hosts, { fetchImpl: hanging, timeoutMs: 50 });
    clearInterval(keepAlive);
    assert.deepEqual(timedOut, { status: "refused", reason: "download-timeout" });

    const broken = await downloadProviderOutput(u("/a"), hosts, {
      fetchImpl: async () => {
        throw new TypeError("socket hang up https://" + FAKE_MEDIA_HOST + "/secret-signed-url");
      },
    });
    assert.deepEqual(broken, { status: "refused", reason: "download-failed" }, "no error text leaks the URL");
  }

  completed = true;
  console.log("media1-asset-authority/admission-contract: ok");
}

/* A drained event loop exits 0 without finishing main(); that must never read as a pass. */
let completed = false;
process.on("exit", (code) => {
  if (code === 0 && !completed) {
    console.error("media1-asset-authority/admission-contract: exited before completing");
    process.exit(1);
  }
});

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
