/*
 * P5 BYOK slice 2 — boundaries proven from source. Behaviour is proven in byok-routing-postgres.ts and
 * answer-wiring.ts.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const codeOf = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
const walk = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });

let failures = 0;
function test(name: string, fn: () => void): void {
  try { fn(); console.log(`PASS ${name}`); } catch (e) { failures++; console.error(`FAIL ${name}\n  ${(e as Error).message}`); }
}

const SELECTOR = "src/features/provider-anthropic/model-credential.server.ts";
const ATTEST = "src/features/external-ai-data-use/attest-tenant-anthropic-account.server.ts";
const TRANSPORT = "src/features/heby-model-live/claude-http-transport.server.ts";
const NEW = [SELECTOR, ATTEST, "src/features/governance-audit/tenant-processor-attestation-audit.server.ts"];

test("the selector never reads the platform key and never logs", () => {
  const code = codeOf(read(SELECTOR));
  assert.ok(!/ANTHROPIC_API_KEY|apiKey:\s*env/.test(code), "the tenant path cannot name the platform key");
  for (const f of NEW) assert.ok(!/console\.\w+\(/.test(codeOf(read(f))), `${f} logs`);
});

test("a tenant transport dispatches only with the tenant key", () => {
  const code = codeOf(read(TRANSPORT));
  assert.match(code, /tenantCredential \? await tenantCredential\.withApiKey\(dispatch\) : await dispatch\(apiKey!\)/);
  assert.match(code, /const apiKey = tenantCredential \? "" : config\.apiKey\?\.trim\(\);/, "a tenant transport holds no platform key");
  assert.ok(!/provider-anthropic|integration-credentials/.test(code), "the transport reads no credential store");
});

test("the Heby conversation path selects per tenant and records the credential", () => {
  const code = codeOf(read("src/features/heby-answer/model-answer.server.ts"));
  assert.match(code, /await \(deps\.selectTenantTransport \?\? selectTenantModelTransport\)\(tenant, env\)/);
  assert.match(code, /if \(selection\.byokRefusal\)/);
  assert.match(code, /credentialSource: args\.credential\.source/);
});

test("the data-use gate checks the account of the transport that sends", () => {
  const code = codeOf(read("src/features/heby-model/heby-model-generation.server.ts"));
  assert.match(code, /const credential = anthropicCredentialOf\(deps\.transport\);/);
  assert.match(code, /externalAiDisclosureEvidence\(declaration, decision, modelId, request\.correlationId, accountRef\)/);
});

test("one writer of tenant attestations; the Governance writer refuses another tenant's", () => {
  const writers = walk("src").filter((f) => /insert\(\s*processorAttestations/.test(codeOf(read(f))));
  assert.deepEqual(writers, [ATTEST]);
  assert.match(codeOf(read(ATTEST)), /ownerTenantId: tenant\.tenantId/);
  assert.match(
    codeOf(read("src/features/external-ai-data-use/authorize-tenant-external-ai-data-use.server.ts")),
    /chosenRow\.ownerTenantId !== null && chosenRow\.ownerTenantId !== tenant\.tenantId/,
  );
});

test("the migration is additive and runs no data change", () => {
  const sql = read("src/db/migrations/20261111140821_p5_byok_attribution_and_attestation.sql");
  assert.ok(!/DROP TABLE|DROP COLUMN|^\s*UPDATE\b|^\s*DELETE\b/im.test(sql));
  const drops = sql.match(/DROP CONSTRAINT "[^"]+"/g) ?? [];
  assert.deepEqual(drops, ['DROP CONSTRAINT "processor_attestations_control_source_chk"'], "only the widened CHECK is replaced");
  assert.match(sql, /ADD CONSTRAINT "processor_attestations_control_source_chk" CHECK/);
});

if (failures > 0) { console.error(`\nP5 BYOK routing boundaries: ${failures} failure(s)`); process.exit(1); }
console.log("\nP5 BYOK routing boundaries: all checks passed");
