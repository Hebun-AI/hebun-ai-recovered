/*
 * MEDIA STORAGE ACCEPTANCE INGRESS — BITE PROOFS.
 *
 * One targeted change to real source, the suite must fail for the intended reason, and the file must
 * come back byte-identical. A killed child is VOID, never a bite. Children run sequentially.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SUITE = "tests/media-storage-acceptance/acceptance-and-ingress.ts";
const RUN = "src/features/media-storage-acceptance/run-storage-acceptance.server.ts";
const ROUTE = "src/app/api/media-storage/acceptance/route.ts";
const MIDDLEWARE = "src/middleware.ts";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");

const MUTATIONS = [
  {
    label: "A1 the run accepts plain-http read grants",
    file: RUN,
    find: '    if (new URL(grant.url).protocol !== "https:") return fail("signedReadExactBytes");',
    replace: "",
    because: "plain-http grant",
  },
  {
    label: "A2 the other-tenant key collapses onto the fixture tenant",
    file: RUN,
    find: "  const otherKey = mediaAssetStorageKey(tenantB, assetId);",
    replace: "  const otherKey = mediaAssetStorageKey(tenantA, assetId);",
    because: "otherTenantAbsent",
  },
  {
    label: "A3 an overwrite counts as write-once",
    file: RUN,
    find: '    return fail("writeOnceRefused");\n  } catch (error) {',
    replace: '    passed.push("writeOnceRefused");\n  } catch (error) {',
    because: "writeOnceRefused",
  },
  {
    label: "A4 any backend is accepted",
    file: RUN,
    find: '  if (store.backend !== EXPECTED_STORAGE_BACKEND) return fail("resolved");',
    replace: "",
    because: "test-memory",
  },
  {
    label: "A5 the ingress runs without its secret",
    file: ROUTE,
    find: "  if (!expected) return false;",
    replace: "  if (!expected) return true;",
    because: "unset secret refuses every request",
  },
  {
    label: "A6 the ingress is not listed in the middleware",
    file: MIDDLEWARE,
    find: '  "/api/media-storage/acceptance",\n',
    replace: "",
    because: "/api/media-storage/acceptance",
  },
];

let bitten = 0;
for (const m of MUTATIONS) {
  const original = readFileSync(m.file, "utf8");
  const before = sha(original);
  assert.equal(original.split(m.find).length - 1, 1, `${m.label}: anchor must be unique`);
  try {
    writeFileSync(m.file, original.replace(m.find, m.replace), "utf8");
    const r = spawnSync(process.execPath, ["--import", "tsx", SUITE], { encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: 300_000 });
    assert.ok(r.signal === null && r.status !== null, `${m.label}: VOID (child killed)`);
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    assert.notEqual(r.status, 0, `${m.label}: suite still passed`);
    assert.ok(out.includes(m.because), `${m.label}: failed, but not for "${m.because}"\n${out.slice(-2000)}`);
    bitten += 1;
    console.log(`BITE ${m.label}`);
  } finally {
    writeFileSync(m.file, original, "utf8");
    assert.equal(sha(readFileSync(m.file, "utf8")), before, `${m.label}: not restored`);
  }
}
assert.equal(bitten, MUTATIONS.length);
console.log(`media-storage-acceptance/bite-proofs: ok (${bitten} bites)`);
