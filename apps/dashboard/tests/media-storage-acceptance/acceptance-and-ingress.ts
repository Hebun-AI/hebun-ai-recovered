/*
 * MEDIA STORAGE ACCEPTANCE INGRESS — the runtime proof and its door.
 *
 * THE CLAIM UNDER TEST:
 *
 *   "The acceptance run exercises the released storage port end to end against the real store
 *    process — put, verify, signed read of exact bytes, short-lived grant, write-once, tenant
 *    isolation, tampered grant — writes exactly one synthetic object in the reserved acceptance tenant
 *    namespace, and reports only check names. It reports `not-connected` without touching anything
 *    when storage is unconfigured, and names the first failing check when the store misbehaves. The
 *    ingress refuses every request without its own bearer secret, before the resolver is evaluated,
 *    and its response carries no key, URL, grant or secret. The acceptance module holds no authority."
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createVpsMediaObjectStore } from "../../src/features/media-assets/vps-media-object-store.server";
import type { MediaStorageResolution } from "../../src/features/media-assets/media-object-store";
import {
  STORAGE_ACCEPTANCE_CHECKS,
  STORAGE_ACCEPTANCE_TENANT_PREFIX,
  runStorageAcceptance,
} from "../../src/features/media-storage-acceptance/run-storage-acceptance.server";
import { startLocalVpsStore } from "../helpers/media-vps-store-process";

let finished = false;
process.on("exit", (code) => {
  if (code === 0 && !finished) {
    console.error("media-storage-acceptance/acceptance-and-ingress: exited before completing");
    process.exitCode = 1;
  }
});

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const f = path.join(dir, n);
    return statSync(f).isDirectory() ? files(f) : [f];
  });
}

const stripComments = (c: string) => c.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

async function main(): Promise<void> {
  /* ── 1. Against the real store process, reached as if over https ────────── */
  const local = await startLocalVpsStore();
  try {
    const localOrigin = new URL(local.origin);
    let fetches = 0;
    const rewrite: typeof fetch = (input, init) => {
      fetches += 1;
      const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      assert.equal(url.protocol, "https:", "every request the run makes is https");
      url.protocol = "http:";
      url.host = localOrigin.host;
      return fetch(url, init);
    };
    const store = createVpsMediaObjectStore({
      origin: "https://store.acceptance.test",
      writeSecret: local.writeSecret,
      readSecret: local.readSecret,
      fetchImpl: rewrite,
    });
    const connected = (): MediaStorageResolution => ({ status: "available", store });

    const result = await runStorageAcceptance({ resolveStorage: connected, fetchImpl: rewrite });
    assert.deepEqual(result, { status: "accepted", backend: "hebun-vps", passed: [...STORAGE_ACCEPTANCE_CHECKS] });

    const stored = files(local.root);
    assert.equal(stored.length, 1, "exactly one fixture object is written");
    const rel = path.relative(local.root, stored[0]!);
    assert.match(rel, new RegExp(`^tenants/${STORAGE_ACCEPTANCE_TENANT_PREFIX}[0-9a-f]{12}/media/[0-9a-f-]{36}$`), "in the reserved namespace");
    assert.ok(readFileSync(stored[0]!).includes(Buffer.from("HEBUN-MEDIA-STORAGE-ACCEPTANCE")), "synthetic, labelled bytes");
    assert.ok(!JSON.stringify(result).match(/tenants\/|https?:|sig=|[0-9a-f]{64}/), "the result names no key, URL, grant or digest");

    /* A second run writes a second, separate fixture; nothing is overwritten. */
    assert.equal((await runStorageAcceptance({ resolveStorage: connected, fetchImpl: rewrite })).status, "accepted");
    assert.equal(files(local.root).length, 2);

    /* A store that answers with the wrong secret fails at the first network step, by name. */
    const wrong = createVpsMediaObjectStore({ origin: "https://store.acceptance.test", writeSecret: "x".repeat(64), readSecret: local.readSecret, fetchImpl: rewrite });
    assert.deepEqual(
      await runStorageAcceptance({ resolveStorage: () => ({ status: "available", store: wrong }), fetchImpl: rewrite }),
      { status: "failed", failedCheck: "absentBeforePut", passed: ["resolved"] },
    );

    /* A store whose read grants are forged fails at the signed read, after a real put. */
    const forged = createVpsMediaObjectStore({ origin: "https://store.acceptance.test", writeSecret: local.writeSecret, readSecret: "y".repeat(64), fetchImpl: rewrite });
    assert.deepEqual(
      await runStorageAcceptance({ resolveStorage: () => ({ status: "available", store: forged }), fetchImpl: rewrite }),
      { status: "failed", failedCheck: "signedReadExactBytes", passed: ["resolved", "absentBeforePut", "put", "verifiedDigestAndSize"] },
    );

    /* A store that silently accepts a second write of the same key is not write-once. */
    const overwriting = { ...store, put: async (input: Parameters<typeof store.put>[0]) => { await store.put(input).catch(() => undefined); } };
    assert.deepEqual(
      await runStorageAcceptance({ resolveStorage: () => ({ status: "available", store: overwriting }), fetchImpl: rewrite }),
      {
        status: "failed",
        failedCheck: "writeOnceRefused",
        passed: ["resolved", "absentBeforePut", "put", "verifiedDigestAndSize", "signedReadExactBytes", "grantShortLived"],
      },
      "overwrite accepted",
    );

    /* A store reached over plain http is never accepted, even when every byte is right. */
    const plain = createVpsMediaObjectStore({ origin: local.origin, writeSecret: local.writeSecret, readSecret: local.readSecret });
    assert.deepEqual(
      await runStorageAcceptance({ resolveStorage: () => ({ status: "available", store: plain }) }),
      { status: "failed", failedCheck: "signedReadExactBytes", passed: ["resolved", "absentBeforePut", "put", "verifiedDigestAndSize"] },
      "plain-http grant",
    );

    /* A non-VPS backend is not accepted as this storage. */
    const memoryLike = { ...store, backend: "test-memory" };
    assert.deepEqual(
      await runStorageAcceptance({ resolveStorage: () => ({ status: "available", store: memoryLike }), fetchImpl: rewrite }),
      { status: "failed", failedCheck: "resolved", passed: [] },
    );

    /* The store goes down: the run fails by name and never reports acceptance. */
    await local.stop();
    const down = await runStorageAcceptance({ resolveStorage: connected, fetchImpl: rewrite });
    assert.equal(down.status, "failed");
    assert.ok(fetches > 0);
  } finally {
    await local.dispose();
  }

  /* ── 2. Unconfigured storage: not-connected, and nothing is attempted ───── */
  {
    let called = 0;
    const counting: typeof fetch = async () => {
      called += 1;
      return new Response("", { status: 500 });
    };
    assert.deepEqual(
      await runStorageAcceptance({ resolveStorage: () => ({ status: "unavailable", reason: "storage-not-connected" }), fetchImpl: counting }),
      { status: "not-connected", reason: "storage-not-connected" },
    );
    assert.deepEqual(
      await runStorageAcceptance({ resolveStorage: () => ({ status: "unavailable", reason: "storage-misconfigured" }), fetchImpl: counting }),
      { status: "not-connected", reason: "storage-misconfigured" },
    );
    assert.equal(called, 0);
  }

  /* ── 3. The ingress ─────────────────────────────────────────────────────── */
  {
    const saved = { ...process.env };
    for (const k of Object.keys(process.env)) if (k.startsWith("HEBUN_MEDIA_STORE")) delete process.env[k];
    const { GET } = await import("../../src/app/api/media-storage/acceptance/route");
    const call = (authorization?: string) =>
      GET(new Request("https://example.test/api/media-storage/acceptance", { method: "GET", headers: authorization ? { authorization } : {} }));
    try {
      delete process.env.HEBUN_MEDIA_STORAGE_ACCEPTANCE_SECRET;
      assert.equal((await call("Bearer anything")).status, 401, "unset secret refuses every request");
      assert.equal((await call()).status, 401);
      process.env.HEBUN_MEDIA_STORAGE_ACCEPTANCE_SECRET = "s".repeat(48);
      assert.equal((await call()).status, 401, "no header");
      assert.equal((await call("Bearer " + "s".repeat(47))).status, 401, "wrong length");
      assert.equal((await call("Bearer " + "t".repeat(48))).status, 401, "wrong secret");
      assert.equal((await call("s".repeat(48))).status, 401, "not a bearer");
      const ok = await call("Bearer " + "s".repeat(48));
      assert.equal(ok.status, 503);
      assert.deepEqual(await ok.json(), { status: "not-connected", reason: "storage-not-connected" });
    } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  }

  /* ── 4. Structure: a closed door around a module with no authority ──────── */
  {
    const route = stripComments(readFileSync("src/app/api/media-storage/acceptance/route.ts", "utf8"));
    const routeImports = [...route.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(routeImports, ["@/features/media-storage-acceptance/run-storage-acceptance.server", "node:crypto"]);
    assert.ok(/export async function GET/.test(route) && !/export (async )?function (POST|PUT|DELETE|PATCH)/.test(route), "GET only");
    assert.ok(!/searchParams|request\.(json|text|formData|body)|params/.test(route), "reads nothing but the authorization header");
    assert.ok(!/HEBUN_MEDIA_STORE_/.test(route), "not the store's secrets");
    assert.ok(!/console\./.test(route));

    const mod = stripComments(readFileSync("src/features/media-storage-acceptance/run-storage-acceptance.server.ts", "utf8"));
    const modImports = [...mod.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
    assert.deepEqual(modImports, [
      "@/features/media-assets/contracts",
      "@/features/media-assets/media-object-store",
      "@/features/media-assets/media-storage.server",
      "node:crypto",
    ]);
    assert.ok(!/@\/db|drizzle|TenantContext|governance|permit|action-|request-media-generation|transport|console\.|process\.env/i.test(mod), "no row, no authority, no generation, no config of its own");
    assert.ok(!/\b(delete|remove|purge)\s*\(/.test(mod), "no delete verb");

    const middleware = readFileSync("src/middleware.ts", "utf8");
    const list = /const MACHINE_INGRESS_PATHS = \[([\s\S]*?)\];/.exec(middleware)?.[1] ?? "";
    assert.deepEqual([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]), [
      "/api/observation/scan",
      "/api/machine-delivery/scan",
      "/api/standing-issuance/scan",
      "/api/media-storage/acceptance",
    ]);

    const importers = files("src").filter((f) => /\.(ts|tsx)$/.test(f) && /media-storage-acceptance\//.test(stripComments(readFileSync(f, "utf8"))));
    assert.deepEqual(importers, ["src/app/api/media-storage/acceptance/route.ts"], "only the ingress reaches the acceptance run");
  }

  finished = true;
  console.log("media-storage-acceptance/acceptance-and-ingress: ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
