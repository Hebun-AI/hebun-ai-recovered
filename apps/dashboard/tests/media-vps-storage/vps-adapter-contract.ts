/*
 * VPS MEDIA STORAGE — the adapter and the resolver, against the REAL store process.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "Production storage is selected only when origin, write secret and read secret are all present
 *    and valid; anything less is `unavailable`, and a half-configured deployment is never connected.
 *    The TypeScript adapter and the Python store sign identically. Through the adapter, the store is
 *    write-once, digest-checked, tenant-keyed and replay-resistant; a read grant is short-lived,
 *    bound to its key and type, and useless after expiry; and nothing the adapter throws carries a
 *    URL, header, signature or secret."
 */
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  MEDIA_STORE_ENV,
  resolveMediaObjectStore,
} from "../../src/features/media-assets/media-storage.server";
import {
  VPS_MEDIA_STORE_BACKEND,
  VPS_READ_MAX_TTL_SECONDS,
  createVpsMediaObjectStore,
  hmacHex,
  readCanonical,
  writeCanonical,
} from "../../src/features/media-assets/vps-media-object-store.server";
import { mediaAssetStorageKey } from "../../src/features/media-assets/contracts";
import { pngBytes } from "../helpers/media-fakes";
import { startLocalVpsStore } from "../helpers/media-vps-store-process";

const sha = (b: Uint8Array): string => createHash("sha256").update(b).digest("hex");
const W = "w".repeat(40);
const R = "r".repeat(40);

async function rejects(run: () => Promise<unknown>, pattern: RegExp, label: string, forbidden: string[] = []): Promise<void> {
  let error: unknown = null;
  try {
    await run();
  } catch (e) {
    error = e;
  }
  assert.ok(error instanceof Error, `${label}: must throw`);
  assert.match(error.message, pattern, label);
  for (const f of forbidden) assert.ok(!error.message.includes(f), `${label}: error message leaks ${f.slice(0, 12)}…`);
}

/* An awaited promise that can never settle empties the event loop and Node exits 0. Refuse that. */
let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("media-vps-storage/vps-adapter-contract: exited before completing");
    process.exitCode = 1;
  }
});

async function main(): Promise<void> {
  /* ── 1. Signing vectors shared with the Python store ────────────────────── */
  {
    const vectors = JSON.parse(readFileSync("../../infra/media-store-vps/signing-vectors.json", "utf8"));
    for (const v of vectors.write) {
      assert.equal(hmacHex(vectors.writeSecret, writeCanonical(v)), v.signature, `write vector ${v.method}`);
    }
    for (const v of vectors.read) {
      assert.equal(hmacHex(vectors.readSecret, readCanonical(v)), v.signature, "read vector");
    }
  }

  /* ── 1b. No invented content type anywhere in the adapter ───────────────── */
  {
    /*
     * A source-level guard, deliberately. The released defect was a literal in this file, and a
     * behavioural test can only catch the paths it happens to walk. This catches the literal itself,
     * so the mistake cannot reappear in a branch no test reaches.
     */
    const adapter = readFileSync("src/features/media-assets/vps-media-object-store.server.ts", "utf8");
    const code = adapter.replace(/\/\*[\s\S]*?\*\//g, "");
    assert.ok(
      !code.includes("application/octet-stream"),
      "the VPS adapter must never invent a content type; it is given the authoritative one",
    );
  }

  /* ── 2. The resolver: all-or-nothing, https only, fails closed ──────────── */
  {
    const env = (o: Record<string, string | undefined>) => o;
    const full = env({
      [MEDIA_STORE_ENV.origin]: "https://store.example.test",
      [MEDIA_STORE_ENV.writeSecret]: W,
      [MEDIA_STORE_ENV.readSecret]: R,
    });
    assert.deepEqual(resolveMediaObjectStore({}), { status: "unavailable", reason: "storage-not-connected" });
    assert.deepEqual(
      resolveMediaObjectStore({ AWS_REGION: "eu-central-1", HEBUN_MEDIA_BUCKET: "x", BLOB_READ_WRITE_TOKEN: "x" }),
      { status: "unavailable", reason: "storage-not-connected" },
      "another vendor's configuration connects nothing",
    );
    const misconfigured: [string, Record<string, string | undefined>][] = [
      ["origin only", { [MEDIA_STORE_ENV.origin]: "https://store.example.test" }],
      ["no read secret", { ...full, [MEDIA_STORE_ENV.readSecret]: undefined }],
      ["no write secret", { ...full, [MEDIA_STORE_ENV.writeSecret]: "" }],
      ["no origin", { ...full, [MEDIA_STORE_ENV.origin]: "" }],
      ["plain http", { ...full, [MEDIA_STORE_ENV.origin]: "http://store.example.test" }],
      ["path", { ...full, [MEDIA_STORE_ENV.origin]: "https://store.example.test/media" }],
      ["query", { ...full, [MEDIA_STORE_ENV.origin]: "https://store.example.test/?a=1" }],
      ["credentials", { ...full, [MEDIA_STORE_ENV.origin]: "https://u:p@store.example.test" }],
      ["not a url", { ...full, [MEDIA_STORE_ENV.origin]: "store.example.test" }],
      ["short write secret", { ...full, [MEDIA_STORE_ENV.writeSecret]: "short" }],
      ["short read secret", { ...full, [MEDIA_STORE_ENV.readSecret]: "r".repeat(31) }],
      ["equal secrets", { ...full, [MEDIA_STORE_ENV.readSecret]: W }],
    ];
    for (const [label, e] of misconfigured) {
      assert.deepEqual(resolveMediaObjectStore(e), { status: "unavailable", reason: "storage-misconfigured" }, label);
    }
    const ok = resolveMediaObjectStore({ ...full, [MEDIA_STORE_ENV.origin]: "https://store.example.test/" });
    assert.equal(ok.status, "available");
    if (ok.status === "available") assert.equal(ok.store.backend, VPS_MEDIA_STORE_BACKEND);
    assert.match(VPS_MEDIA_STORE_BACKEND, /^[a-z0-9-]{1,32}$/, "fits media_assets_storage_backend_chk");

    const source = readFileSync("src/features/media-assets/media-storage.server.ts", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const names = [...source.matchAll(/"(HEBUN_[A-Z_]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(names, Object.values(MEDIA_STORE_ENV).sort(), "the resolver names exactly three configuration keys");
    assert.ok(!/memory|fake|localhost|127\.0\.0\.1|http:\/\//i.test(source), "no fallback store, no loopback, no plain http");
  }

  /* ── 3. Adapter refusals that never open a socket ───────────────────────── */
  {
    let calls = 0;
    const store = createVpsMediaObjectStore({
      origin: "https://store.example.test",
      writeSecret: W,
      readSecret: R,
      fetchImpl: (async () => {
        calls += 1;
        return new Response("{}", { status: 500 });
      }) as typeof fetch,
    });
    const tenant = randomUUID();
    const key = mediaAssetStorageKey(tenant, randomUUID());
    const bytes = pngBytes(4, 4);
    await rejects(() => store.put({ key, bytes, contentType: "image/png", sha256Hex: "0".repeat(64) }), /digest mismatch/, "mislabelled digest");
    await rejects(() => store.put({ key: `tenants/${tenant}/media/../x`, bytes, contentType: "image/png", sha256Hex: sha(bytes) }), /not canonical/, "traversal key");
    await rejects(() => store.verify(`tenants/${tenant}/media/..`), /not canonical/, "traversal verify");
    await rejects(() => store.createReadAccess({ key: "../etc/passwd", contentType: "image/png", ttlSeconds: 60 }), /not canonical/, "traversal grant");
    assert.equal(calls, 0, "no request left the adapter");
    await rejects(() => store.put({ key, bytes, contentType: "image/png", sha256Hex: sha(bytes) }), /put refused \(500\)/, "server error", [W, R, "store.example.test"]);
    await rejects(() => store.verify(key), /verify refused \(500\)/, "verify error", [W, R, "store.example.test"]);
  }

  /* ── 4. Against the real store process ──────────────────────────────────── */
  const local = await startLocalVpsStore();
  try {
    const store = createVpsMediaObjectStore({ origin: local.origin, writeSecret: local.writeSecret, readSecret: local.readSecret });
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const asset = randomUUID();
    const key = mediaAssetStorageKey(tenantA, asset);
    const bytes = pngBytes(32, 32, 128);

    assert.deepEqual(await store.verify(key), { status: "absent" });
    await store.put({ key, bytes, contentType: "image/png", sha256Hex: sha(bytes) });
    assert.deepEqual(await store.verify(key), { status: "present", byteSize: bytes.length, sha256Hex: sha(bytes) });

    // write-once: a second put, even of identical bytes, is refused and the original is kept
    await rejects(() => store.put({ key, bytes, contentType: "image/png", sha256Hex: sha(bytes) }), /put refused \(409\)/, "duplicate key");
    const other = pngBytes(33, 33);
    await rejects(() => store.put({ key, bytes: other, contentType: "image/png", sha256Hex: sha(other) }), /\(409\)/, "overwrite");
    assert.deepEqual(await store.verify(key), { status: "present", byteSize: bytes.length, sha256Hex: sha(bytes) });

    // tenant isolation: the same asset id under another tenant is a different, absent object
    assert.deepEqual(await store.verify(mediaAssetStorageKey(tenantB, asset)), { status: "absent" });

    // wrong credentials
    const wrongWrite = createVpsMediaObjectStore({ origin: local.origin, writeSecret: "x".repeat(64), readSecret: local.readSecret });
    await rejects(() => wrongWrite.verify(key), /\(401\)/, "wrong write secret");
    const readAsWrite = createVpsMediaObjectStore({ origin: local.origin, writeSecret: local.readSecret, readSecret: local.readSecret });
    const fresh = pngBytes(8, 8);
    await rejects(() => readAsWrite.put({ key: mediaAssetStorageKey(tenantA, randomUUID()), bytes: fresh, contentType: "image/png", sha256Hex: sha(fresh) }), /\(401\)/, "read secret cannot write");

    // replay: a fixed nonce is accepted once
    const fixedNonce = "ab".repeat(16);
    const replaying = createVpsMediaObjectStore({ ...local, origin: local.origin, nonce: () => fixedNonce });
    assert.deepEqual(await replaying.verify(key), { status: "present", byteSize: bytes.length, sha256Hex: sha(bytes) });
    await rejects(() => replaying.verify(key), /\(401\)/, "replayed nonce");

    // stale and future timestamps
    const stale = createVpsMediaObjectStore({ ...local, origin: local.origin, now: () => Date.now() - 120_000 });
    await rejects(() => stale.verify(key), /\(401\)/, "stale timestamp");
    const future = createVpsMediaObjectStore({ ...local, origin: local.origin, now: () => Date.now() + 120_000 });
    await rejects(() => future.verify(key), /\(401\)/, "future timestamp");

    // read access: short-lived, bound, never a permanent URL
    const grant = await store.createReadAccess({ key, contentType: "image/png", ttlSeconds: 60 });
    const expiresIn = Date.parse(grant.expiresAt) - Date.now();
    assert.ok(expiresIn > 0 && expiresIn <= 61_000, "grant expires within its ttl");
    assert.ok(!grant.url.includes(local.writeSecret) && !grant.url.includes(local.readSecret), "no secret in the URL");
    const served = await fetch(grant.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/png");
    assert.equal(served.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(new Uint8Array(await served.arrayBuffer()), bytes);

    const clamped = await store.createReadAccess({ key, contentType: "image/png", ttlSeconds: 86_400 });
    assert.ok(Date.parse(clamped.expiresAt) - Date.now() <= VPS_READ_MAX_TTL_SECONDS * 1000 + 1000, "ttl is clamped");
    assert.equal((await fetch(clamped.url)).status, 200);

    const u = new URL(grant.url);
    const swapType = new URL(grant.url);
    swapType.searchParams.set("ct", "image/jpeg");
    assert.equal((await fetch(swapType)).status, 403, "grant is bound to its content type");
    const swapKey = new URL(grant.url.replace(tenantA, tenantB));
    assert.equal((await fetch(swapKey)).status, 403, "grant is bound to its key");
    const noSig = new URL(u.origin + u.pathname);
    assert.equal((await fetch(noSig)).status, 403, "no permanent object URL exists");
    const expired = createVpsMediaObjectStore({ ...local, origin: local.origin, now: () => Date.now() - 120_000 });
    const expiredGrant = await expired.createReadAccess({ key, contentType: "image/png", ttlSeconds: 60 });
    assert.equal((await fetch(expiredGrant.url)).status, 403, "an expired grant is refused");
    const forged = createVpsMediaObjectStore({ ...local, origin: local.origin, readSecret: local.writeSecret });
    assert.equal((await fetch((await forged.createReadAccess({ key, contentType: "image/png", ttlSeconds: 60 })).url)).status, 403, "the write secret cannot mint a read grant");

    /*
     * ── 5. MEDIA-5: get() against the REAL read route ────────────────────────
     *
     * THE REGRESSION THIS EXISTS FOR. `get()` was released signing a hardcoded
     * `application/octet-stream`, which the store's read route refuses with 403 BEFORE it checks the
     * signature. Every MEDIA-5 test passed because they all ran against the in-memory fake, and this
     * suite — the only one that speaks to the real store — never called `get()`. The hole is closed
     * by exercising the actual signing and content-type semantics for every type Hebun can store.
     */
    {
      /* Every media type the authority can hold must be readable server-side, not just PNG. */
      const cases = [
        { contentType: "image/png" as const, bytes: pngBytes(16, 16, 200) },
        /* MV-3: the store serves a type only when the stored bytes ARE that type, so each case carries
         * its own format's leading signature — PNG bytes labelled jpeg/webp are now refused (403). */
        { contentType: "image/jpeg" as const, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...pngBytes(17, 17, 90)]) },
        { contentType: "image/webp" as const, bytes: new Uint8Array([...Buffer.from("RIFF\0\0\0\0WEBPVP8 "), ...pngBytes(18, 18, 30)]) },
      ];

      for (const c of cases) {
        const sentUrls: string[] = [];
        const watching = createVpsMediaObjectStore({
          origin: local.origin,
          writeSecret: local.writeSecret,
          readSecret: local.readSecret,
          fetchImpl: (input, init) => {
            sentUrls.push(typeof input === "string" ? input : String(input));
            return fetch(input as string, init);
          },
        });
        const k = mediaAssetStorageKey(tenantA, randomUUID());
        await watching.put({ key: k, bytes: c.bytes, contentType: c.contentType, sha256Hex: sha(c.bytes) });

        sentUrls.length = 0;
        const read = await watching.get({ key: k, contentType: c.contentType, maxBytes: 1_000_000 });

        assert.equal(read.status, "read", `${c.contentType}: the store served the object`);
        assert.ok(read.status === "read" && read.bytes.byteLength === c.bytes.byteLength, `${c.contentType}: length`);
        assert.equal(read.status === "read" ? sha(read.bytes) : "", sha(c.bytes), `${c.contentType}: bytes round-trip exactly`);

        /* The literal request the adapter made: the authoritative type, and never the invented one. */
        const url = new URL(sentUrls.at(-1)!);
        assert.equal(url.pathname, `/v1/read/${k}`, `${c.contentType}: path`);
        assert.equal(url.searchParams.get("ct"), c.contentType, `${c.contentType}: ct is the authoritative type`);
        assert.ok(!sentUrls.at(-1)!.includes("octet-stream"), `${c.contentType}: no invented octet-stream`);
        assert.deepEqual([...url.searchParams.keys()].sort(), ["ct", "exp", "sig"], `${c.contentType}: query shape`);

        /* And the signature covers that exact type — recomputed here from the canonical string. */
        const exp = url.searchParams.get("exp")!;
        assert.equal(
          url.searchParams.get("sig"),
          hmacHex(local.readSecret, readCanonical({ key: k, contentType: c.contentType, expires: exp })),
          `${c.contentType}: signature is over the canonical string carrying this exact type`,
        );
        /* A signature over any OTHER type is a different signature — the binding is real, not decorative. */
        assert.notEqual(
          url.searchParams.get("sig"),
          hmacHex(local.readSecret, readCanonical({ key: k, contentType: "application/octet-stream", expires: exp })),
          `${c.contentType}: the octet-stream signature is not this signature`,
        );
      }

      /* Absent object: `absent`, never a throw and never an empty "read". */
      assert.deepEqual(
        await store.get({ key: mediaAssetStorageKey(tenantA, randomUUID()), contentType: "image/png", maxBytes: 1_000_000 }),
        { status: "absent" },
        "a missing object reads as absent",
      );

      /* The ceiling still bounds the read, so an oversized object yields no bytes. */
      assert.deepEqual(
        await store.get({ key, contentType: "image/png", maxBytes: bytes.length - 1 }),
        { status: "too-large" },
        "maxBytes is enforced",
      );

      /* Non-200 still fails closed and still leaks nothing: a forged grant is refused by the store. */
      const forgedRead = createVpsMediaObjectStore({
        origin: local.origin,
        writeSecret: local.writeSecret,
        readSecret: local.writeSecret,
      });
      await rejects(
        () => forgedRead.get({ key, contentType: "image/png", maxBytes: 1_000_000 }),
        /read refused \(403\)/,
        "a forged read signature is refused, closed",
        [local.writeSecret, local.readSecret],
      );
    }

    // restart persistence (process level): bytes and identity survive
    await local.restart();
    assert.deepEqual(await store.verify(key), { status: "present", byteSize: bytes.length, sha256Hex: sha(bytes) });

    // store down: the adapter throws, never guesses
    await local.stop();
    await rejects(() => store.verify(key), /fetch failed|ECONNREFUSED|refused/i, "store unreachable", [local.writeSecret, local.readSecret]);
  } finally {
    await local.dispose();
  }

  finished = true;
  console.log("media-vps-storage/vps-adapter-contract: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
