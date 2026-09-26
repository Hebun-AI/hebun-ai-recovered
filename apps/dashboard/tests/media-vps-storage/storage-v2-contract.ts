/*
 * MV-1 — the storage v2 client against the REAL store process.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "WRITE-V2 streams bytes whose digest the caller never computed, and the store answers the size and
 *    SHA-256 it measured. Expected-size mismatch, ceiling overrun and duplicate keys fail closed and
 *    leave nothing visible. HEAD and a single Range work under the unchanged READ-V1 grant; a bad
 *    range is 416. Video stays refused, the probe fails closed when it cannot run, the v1 image path
 *    is untouched, and the v2 client is not wired into the Media authority — a v2 write admits
 *    nothing."
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createVpsMediaObjectStore, hmacHex } from "../../src/features/media-assets/vps-media-object-store.server";
import {
  createVpsMediaStorageV2,
  writeV2Canonical,
  deriveCanonical,
} from "../../src/features/media-assets/vps-media-storage-v2.server";
import { MEDIA_ASSET_MIME_TYPES, mediaAssetStorageKey } from "../../src/features/media-assets/contracts";
import { pngBytes } from "../helpers/media-fakes";
import { startLocalVpsStore } from "../helpers/media-vps-store-process";

const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");

function streamOf(bytes: Uint8Array, pieces = 3): ReadableStream<Uint8Array> {
  const size = Math.ceil(bytes.byteLength / pieces);
  let offset = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (offset >= bytes.byteLength) return controller.close();
      controller.enqueue(bytes.slice(offset, offset + size));
      offset += size;
    },
  });
}

async function rejects(run: () => Promise<unknown>, pattern: RegExp, label: string, forbidden: string[] = []): Promise<void> {
  let error: unknown = null;
  try {
    await run();
  } catch (e) {
    error = e;
  }
  assert.ok(error instanceof Error, `${label}: must throw`);
  assert.match(error.message, pattern, label);
  for (const f of forbidden) assert.ok(!error.message.includes(f), `${label}: error leaks ${f.slice(0, 12)}…`);
}

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("media-vps-storage/storage-v2-contract: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  /* ── 1. Signing vectors shared with the Python store ────────────────────── */
  {
    const vectors = JSON.parse(readFileSync("../../infra/media-store-vps/signing-vectors.json", "utf8"));
    assert.ok(vectors.writeV2.length >= 2);
    for (const v of vectors.writeV2) {
      assert.equal(hmacHex(vectors.writeSecret, writeV2Canonical(v)), v.signature, `write v2 vector ${v.contentType}`);
    }
    /* MV-5: DERIVE-V1 — the TypeScript client signs exactly what the Python store verifies. */
    assert.ok(vectors.derive.length >= 1);
    for (const v of vectors.derive) {
      assert.equal(hmacHex(vectors.writeSecret, deriveCanonical(v)), v.signature, `derive vector ${v.derivation}`);
    }
  }

  /* ── 2. Not wired into Media: nothing in src imports the v2 client ──────── */
  {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.(ts|tsx)$/.test(name) && !p.endsWith("vps-media-storage-v2.server.ts")) {
          if (readFileSync(p, "utf8").includes("vps-media-storage-v2")) offenders.push(p);
        }
      }
    };
    walk("src");
    /* MV-3 connected it on purpose: the resolver builds it, the supplied-video admission uses it.
     * MV-5 adds the normalized-video derivation, which uses its DERIVE-V1 and one range read. */
    assert.deepEqual(
      offenders.sort(),
      [
        "src/features/media-assets/admit-supplied-drive-video.server.ts",
        "src/features/media-assets/derive-normalized-video.server.ts",
        "src/features/media-assets/media-storage.server.ts",
      ],
      "storage v2 is reached only through the resolver, by the supplied-video admission and the video derivation",
    );
    assert.deepEqual([...MEDIA_ASSET_MIME_TYPES].sort(), ["image/jpeg", "image/png", "image/webp"], "Media admission gains no video type in MV-1");
  }

  const vps = await startLocalVpsStore();
  try {
    const opts = { origin: vps.origin, writeSecret: vps.writeSecret, readSecret: vps.readSecret };
    const v2 = createVpsMediaStorageV2(opts);
    const v1 = createVpsMediaObjectStore(opts);
    const tenant = randomUUID();
    const bytes = pngBytes(8, 8, 3000);

    /* ── 3. Streamed write: server-measured size and digest ─────────────── */
    const key = mediaAssetStorageKey(tenant, randomUUID());
    const facts = await v2.putStream({ key, contentType: "image/png", body: streamOf(bytes), maxBytes: 64 * 1024 });
    assert.deepEqual(facts, { byteSize: bytes.byteLength, sha256Hex: sha(bytes), probe: null });
    assert.deepEqual(await v1.verify(key), { status: "present", byteSize: bytes.byteLength, sha256Hex: sha(bytes) });

    /* Declared length path. */
    const key2 = mediaAssetStorageKey(tenant, randomUUID());
    const facts2 = await v2.putStream({
      key: key2,
      contentType: "image/png",
      body: streamOf(bytes, 1),
      maxBytes: bytes.byteLength,
      expectedBytes: bytes.byteLength,
    });
    assert.equal(facts2.sha256Hex, sha(bytes));

    /* ── 4. Fail closed, nothing visible ────────────────────────────────── */
    const refused = mediaAssetStorageKey(tenant, randomUUID());
    await rejects(
      () => v2.putStream({ key: refused, contentType: "image/png", body: streamOf(bytes), maxBytes: 64 * 1024, expectedBytes: bytes.byteLength + 1 }),
      /v2 write refused \((400|413)\)|fetch failed/, // undici itself refuses a body that contradicts its declared length
      "expected-size mismatch (client or store refuses; store side is proven in Python)",
      [vps.writeSecret],
    );
    await rejects(
      () => v2.putStream({ key: refused, contentType: "image/png", body: streamOf(bytes), maxBytes: 1000 }),
      /\(413\)/,
      "ceiling overrun",
    );
    await rejects(
      () => v2.putStream({ key, contentType: "image/png", body: streamOf(bytes), maxBytes: 64 * 1024 }),
      /\(409\)/,
      "duplicate key",
    );
    await rejects(
      () => v2.putStream({ key: refused, contentType: "video/mp4", body: streamOf(bytes), maxBytes: 64 * 1024 }),
      /\(415\)/,
      "video is refused by the default store",
    );
    await rejects(
      () => v2.putStream({ key: refused, contentType: "image/png", body: streamOf(bytes), maxBytes: 64 * 1024, probe: "required" }),
      /\((422|503)\)/,
      "a required probe that cannot succeed stores nothing",
    );
    assert.deepEqual(await v1.verify(refused), { status: "absent" }, "no refused write became visible");
    assert.deepEqual(await v2.head({ key: refused, contentType: "image/png" }), { status: "absent" });
    await rejects(() => v2.putStream({ key: "tenants/../x", contentType: "image/png", body: streamOf(bytes), maxBytes: 10 }), /not canonical/, "key");

    /* ── 5. HEAD and Range under the unchanged READ-V1 grant ───────────── */
    assert.deepEqual(await v2.head({ key, contentType: "image/png" }), { status: "present", byteSize: bytes.byteLength });
    await rejects(() => v2.head({ key, contentType: "video/mp4" }), /head refused \(403\)/, "head type not served");
    const range = await v2.readRange({ key, contentType: "image/png", start: 10, end: 99 });
    assert.equal(range.status, "range");
    if (range.status === "range") {
      assert.deepEqual([...range.bytes], [...bytes.slice(10, 100)]);
      assert.equal(range.totalSize, bytes.byteLength);
    }
    assert.deepEqual(
      await v2.readRange({ key, contentType: "image/png", start: bytes.byteLength, end: bytes.byteLength + 5 }),
      { status: "unsatisfiable", totalSize: bytes.byteLength },
    );

    /* ── 6. READ-V1 and WRITE-V1 unchanged ─────────────────────────────── */
    const grant = await v1.createReadAccess({ key, contentType: "image/png", ttlSeconds: 60 });
    const full = await fetch(grant.url);
    assert.equal(full.status, 200);
    assert.equal(full.headers.get("accept-ranges"), "bytes");
    assert.deepEqual(new Uint8Array(await full.arrayBuffer()), bytes);
    const v1Key = mediaAssetStorageKey(tenant, randomUUID());
    const small = pngBytes(2, 2);
    await v1.put({ key: v1Key, bytes: small, contentType: "image/png", sha256Hex: sha(small) });
    const got = await v1.get({ key: v1Key, contentType: "image/png", maxBytes: 1024 });
    assert.equal(got.status, "read");
  } finally {
    await vps.dispose();
  }

  finished = true;
  console.log("media-vps-storage/storage-v2-contract: ok");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
