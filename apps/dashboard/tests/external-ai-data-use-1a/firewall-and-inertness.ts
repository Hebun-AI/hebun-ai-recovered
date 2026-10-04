/*
 * EXTERNAL-AI-DATA-USE-1A — the static boundary of Release A.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "Release A grants no external-AI capability and changes no runtime behaviour. No code path can
 *    write a processor attestation; nothing edits or deletes a revision; no Heby, origination, model,
 *    media or R2E module reaches the new authority, and the authority reaches none of them; the only
 *    client-crossable writer runs with the recorded policy; no disclosure column was added to any
 *    message, invocation or evidence table; the migration is purely additive; and persisted evidence
 *    no longer claims it was sent to a model."
 *
 * Source and migration text only. No database, no provider.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import * as contracts from "../../src/features/external-ai-data-use/contracts";
import * as schema from "../../src/db/schema/external-ai-data-use";

const ROOT = path.resolve(__dirname, "../..");
const FEATURE = "src/features/external-ai-data-use";

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs).flatMap((name) => {
    const rel = path.join(dir, name);
    if (name === "node_modules") return [];
    return statSync(path.join(ROOT, rel)).isDirectory() ? walk(rel) : /\.(ts|tsx|mjs)$/.test(name) ? [rel] : [];
  });
}
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");
const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const SRC = walk("src");
const SCRIPTS = walk("scripts");

/* ── 1. The schema's CHECK vocabularies are exactly the contracts' vocabularies. ───────────────── */
assert.deepEqual([...schema.EXTERNAL_AI_SERVICE_SCOPES_SQL], [...contracts.SERVICE_SCOPES]);
assert.deepEqual([...schema.EXTERNAL_AI_PURPOSES_SQL], [...contracts.PURPOSES]);
assert.deepEqual([...schema.EXTERNAL_AI_DATA_CLASSES_SQL], [...contracts.DATA_CLASSES]);
assert.deepEqual([...schema.EXTERNAL_AI_CONTRACT_SURFACES_SQL], [...contracts.CONTRACT_SURFACES]);
assert.deepEqual([...schema.EXTERNAL_AI_TRAINING_SQL], [...contracts.TRAINING_TREATMENTS]);
assert.deepEqual([...schema.EXTERNAL_AI_RETENTION_SQL], [...contracts.RETENTION_CLASSES]);
assert.deepEqual([...schema.EXTERNAL_AI_ZDR_SQL], [...contracts.ZDR_STATES]);
assert.deepEqual([...schema.EXTERNAL_AI_IDENTITY_SQL], [...contracts.IDENTITY_STATUSES]);
assert.deepEqual([...schema.EXTERNAL_AI_CONTROL_SOURCES_SQL], [...contracts.ATTESTATION_CONTROL_SOURCES]);

/*
 * ── 2. NO ATTESTATION WRITER EXISTS — except the B1A admission ceremony. ─────────────────────────
 *
 * Release A shipped with no writer at all. EXTERNAL-AI-DATA-USE-B1A (Director-approved) adds
 * exactly ONE: the root possession ceremony's library, which INSERTs revisions and nothing else.
 * The exception is one named file; src/ stays writer-free, and no file may update or delete.
 */
const ATTESTATION_CEREMONY_WRITER = "scripts/lib/processor-attestation.ts";
for (const file of [...SRC, ...SCRIPTS]) {
  const code = stripComments(read(file));
  if (file !== ATTESTATION_CEREMONY_WRITER) {
    assert.ok(!/insert\(\s*processorAttestations\b/.test(code), `${file} must not insert a processor attestation`);
    assert.ok(!/into\s+"?(public"?\.)?"?processor_attestations/i.test(code), `${file} must not insert a processor attestation by SQL`);
  }
  for (const table of ["processorAttestations", "tenantExternalAiDataUseAuthorizations", "tenantExternalAiDataUseAuthorizationScopes"]) {
    assert.ok(!new RegExp(`update\\(\\s*${table}\\b`).test(code), `${file}: ${table} is never updated in place`);
    assert.ok(!new RegExp(`delete\\(\\s*${table}\\b`).test(code), `${file}: ${table} is never deleted from`);
  }
}

/* ── 3. RUNTIME ISOLATION: exactly two modules outside the feature reach it. ──────────────────── */
const importers = SRC.filter(
  (f) => !f.startsWith(FEATURE) && /from\s+["']@\/features\/external-ai-data-use\//.test(read(f)),
).sort();
assert.deepEqual(
  importers,
  [
    "src/app/(dashboard)/governance/authority/actions.ts",
    "src/features/governance-decision/decision-authority.server.ts",
  ],
  "only the Governance action (writer) and the decision authority (vocabulary) reach the new authority",
);
assert.ok(
  !/from\s+["']@\/features\/external-ai-data-use\/(?!contracts["'])/.test(read("src/features/governance-decision/decision-authority.server.ts")),
  "the decision authority imports the vocabulary only",
);
for (const forbidden of ["heby-answer", "agent-origination", "heby-model", "heby-model-live", "media-assets", "media-generation-live", "heby-provider-ops", "relevance-judge"]) {
  for (const file of SRC.filter((f) => f.startsWith(`src/features/${forbidden}/`))) {
    assert.ok(!read(file).includes("external-ai-data-use"), `${file} does not consult the data-use authority in Release A`);
  }
}

/* ── 4. …and the authority reaches no runtime, transport, R2E or action module. ───────────────── */
for (const file of SRC.filter((f) => f.startsWith(FEATURE))) {
  const code = stripComments(read(file));
  for (const forbidden of [
    "@/features/heby-model",
    "@/features/heby-answer",
    "@/features/agent-origination",
    "@/features/action-authorization",
    "@/features/action-execution",
    "@/features/heby-provider-ops",
    "@/features/media-",
    "provider-connectivity",
    "provider_connectivity",
  ]) {
    assert.ok(!code.includes(forbidden), `${file} must not import ${forbidden}`);
  }
}

/* ── 5. The client-crossable writer runs with the RECORDED policy, always. ─────────────────────── */
const action = read("src/app/(dashboard)/governance/authority/actions.ts");
assert.ok(!action.includes("platform-disclosure-policy"), "the action cannot even name a policy");
const actionCalls = stripComments(action).match(/(authorize|withdraw)TenantExternalAiDataUse\(tenant, \{[\s\S]*?\n {2}\}\);/g) ?? [];
assert.equal(actionCalls.length, 2, "two writer calls, each with exactly (tenant, input)");
for (const call of actionCalls) assert.ok(!/policy|getDb/.test(call), "no deps argument crosses from the action");
assert.match(
  read(`${FEATURE}/authorize-tenant-external-ai-data-use.server.ts`),
  /deps\.policy \?\? RECORDED_PLATFORM_DISCLOSURE_POLICY/,
  "the writer's default is the recorded policy",
);
assert.ok(!/tenantId\s*[:?]/.test(stripComments(action).split("EXTERNAL-AI-DATA-USE-1A")[1] ?? ""), "no tenant parameter");

/* ── 6. AMENDMENT 1: no disclosure provenance was added anywhere in Release A. ─────────────────── */
for (const file of [
  "src/db/schema/conversation.ts",
  "src/db/schema/heby-origination-invocation.ts",
  "src/db/schema/heby-answer-evidence.ts",
  "src/db/schema/heby-answer-source-evidence.ts",
  "src/db/schema/media-asset.ts",
]) {
  const code = stripComments(read(file));
  assert.ok(!/data_use|disclosed|attestation/i.test(code), `${file} carries no disclosure column in Release A`);
}

/* ── 7. The persisted evidence no longer claims it reached a model. ───────────────────────────── */
const answer = read("src/features/heby-answer/model-answer.server.ts");
assert.ok(!answer.includes("admitted to the model's grounding context"), "the misleading claim is gone");
assert.match(answer, /does NOT claim the evidence was sent to an external model/);

/* ── 8. THE MIGRATION IS PURELY ADDITIVE. ──────────────────────────────────────────────────────── */
const migrations = readdirSync(path.join(ROOT, "src/db/migrations")).filter((f) => f.endsWith(".sql")).sort();
const mine = migrations.at(-1)!;
assert.match(mine, /_external_ai_data_use_authority\.sql$/);
const sql = read(`src/db/migrations/${mine}`);
/* Every statement is one of five additive shapes — no DROP, RENAME, backfill or data change. */
for (const statement of sql.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean)) {
  assert.match(
    statement,
    /^(CREATE TYPE "public"\.|ALTER TYPE "public"\."governance_domain" ADD VALUE |CREATE TABLE "|ALTER TABLE "[a-z_]+" ADD CONSTRAINT "|CREATE (UNIQUE )?INDEX ")/,
    `additive statement only: ${statement.slice(0, 80)}`,
  );
}
const alteredTables = [...sql.matchAll(/ALTER TABLE "([a-z_]+)"/g)].map((m) => m[1]);
assert.ok(alteredTables.length > 0);
for (const table of alteredTables) {
  assert.ok(
    ["processor_attestations", "tenant_ai_data_use_authorizations", "tenant_ai_data_use_scopes"].includes(table!),
    `the migration alters only its own new tables (saw ${table})`,
  );
}
assert.deepEqual(
  [...sql.matchAll(/ALTER TYPE "public"\."([a-z_]+)" ADD VALUE '([a-z-]+)'/g)].map((m) => `${m[1]}:${m[2]}`),
  ["governance_domain:external-ai-data-use"],
  "one enum value is added, and it is the Governance domain",
);
assert.ok(!/NOT VALID/i.test(sql), "no NOT VALID constraint (EXTERNAL-AI-DATA-USE-1-DESIGN §15)");

console.log("PASS external-ai-data-use-1a firewall-and-inertness");
