/*
 * P5 BYOK slice 1 — boundaries proven from source. Behaviour is proven in byok-key-postgres.ts.
 *
 *   - the action takes the tenant from the session and reads exactly one form field;
 *   - nothing new seals, opens or inserts a credential: the released repository does;
 *   - the key is never logged, echoed, redirected or rendered;
 *   - this slice does not touch the model transport (selection is a later, gated slice);
 *   - the P4 admin readers still read no credential.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

let failures = 0;
function test(name: string, fn: () => void): void {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}\n  ${(e as Error).message}`); }
}

const ACTION = "src/app/(dashboard)/integrations/anthropic/actions.ts";
const PAGE = "src/app/(dashboard)/integrations/anthropic/page.tsx";
const MODULE = "src/features/provider-anthropic/byok-key.server.ts";
const FILES = [ACTION, PAGE, MODULE, "src/features/provider-anthropic/contracts.ts"];

test("the action reads one field and takes the tenant from the session", () => {
  const code = codeOf(read(ACTION));
  assert.deepEqual([...code.matchAll(/formData\.get\("([^"]+)"\)/g)].map((m) => m[1]), ["apiKey"]);
  assert.match(code, /await resolveTenantContext\(\)/);
  assert.ok(!/tenantId|searchParams|headers\(|cookies\(/.test(code), "no client-supplied tenant");
  assert.ok(!/\$\{value|\$\{.*apiKey/.test(code), "the key never reaches a redirect URL");
});

test("no new credential writer, cipher or decryption", () => {
  for (const f of FILES) {
    const code = codeOf(read(f));
    assert.ok(!/insert\(\s*integrationCredentials|update\(\s*integrationCredentials/.test(code), `${f} writes credentials directly`);
    assert.ok(!/withDecryptedSecret|withConnectionScopedSecret|sealSecret|openSecret|createCipheriv/.test(code), `${f} opens or seals a secret`);
  }
});

test("the key is never logged or rendered", () => {
  for (const f of FILES) assert.ok(!/console\.\w+\(/.test(codeOf(read(f))), `${f} logs`);
  const page = codeOf(read(PAGE));
  assert.ok(!/defaultValue|value=\{/.test(page), "the input is never pre-filled");
  assert.match(page, /type="password"/);
  assert.match(page, /autoComplete="off"/);
});

test("this slice does not touch model selection", () => {
  for (const f of FILES) {
    assert.ok(!/heby-model|claude-http-transport|ANTHROPIC_API_KEY/.test(codeOf(read(f))), `${f} reaches the transport`);
  }
  const transport = codeOf(read("src/features/heby-model-live/claude-http-transport.server.ts"));
  assert.ok(!/provider-anthropic|integration-credentials/.test(transport), "transport still uses only the platform key");
});

test("P4 admin readers still read no credential", () => {
  const readers = codeOf(read("src/features/admin-views/platform-readers.server.ts"));
  assert.ok(!/integration_credentials|integrationCredentials|provider-anthropic/.test(readers));
  assert.ok(walk("src/features/admin-views").every((f) => !/provider-anthropic/.test(read(f))));
});

test("the B5 verifier makes one status-only call", () => {
  const code = codeOf(read("src/features/provider-anthropic/verify-anthropic-key.server.ts"));
  assert.deepEqual([...code.matchAll(/https:\/\/[^"`\s]+/g)].map((m) => m[0]), ["https://api.anthropic.com/v1/models?limit=1"]);
  assert.ok(!/\.(json|text|arrayBuffer|blob|formData)\(/.test(code), "the response body is never read");
  assert.ok(!/console\.\w+\(/.test(code), "the verifier never logs");
  assert.match(code, /method: "GET"/);
});

if (failures > 0) { console.error(`\nP5 BYOK boundaries: ${failures} failure(s)`); process.exit(1); }
console.log("\nP5 BYOK boundaries: all checks passed");
