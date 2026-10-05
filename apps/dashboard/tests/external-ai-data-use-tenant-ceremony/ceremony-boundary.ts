/*
 * EXTERNAL-AI-DATA-USE tenant authorization ceremony — the static boundary.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *   "The ceremony writes nothing itself — its only SQL is a read — and reaches the authorization
 *    only through the released writer. No flag can name a scope, purpose, data class or
 *    attestation: the pairs are read off the recorded policy, which ALLOWS exactly the three B1D
 *    cells. It names no credential, calls no provider, and a piped stdin is refused before anything
 *    is read."
 *
 * Source text plus one refused child process. No database, no provider, no network.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { RECORDED_PLATFORM_DISCLOSURE_POLICY } from "../../src/features/external-ai-data-use/platform-disclosure-policy";

const ROOT = path.resolve(__dirname, "../..");
const CEREMONY = "scripts/eai-authorize-tenant-external-ai-data-use.ts";
const source = readFileSync(path.join(ROOT, CEREMONY), "utf8");
const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ── 1. No direct mutation: every SQL statement is a SELECT, and no ORM write exists. ─────────── */
const sql = [...code.matchAll(/`\s*(select|insert|update|delete|with|create|alter|drop|truncate)\b/gi)].map((m) => m[1]!.toLowerCase());
assert.ok(sql.length >= 3, "the ceremony's read-only lookups are found");
assert.deepEqual([...new Set(sql)], ["select"], "every SQL statement in the ceremony is a SELECT");
assert.ok(!/\b(insert|update|delete)\s*\(/i.test(code), "no ORM insert/update/delete");
assert.ok(!/\b(insert\s+into|update\s+\w+\s+set|delete\s+from)\b/i.test(code), "no write SQL anywhere");

/* ── 2. The released writer is the only way to the authorization. ─────────────────────────────── */
assert.match(code, /import\(\s*"\.\.\/src\/features\/external-ai-data-use\/authorize-tenant-external-ai-data-use\.server"\s*\)/);
assert.match(code, /await authorizeTenantExternalAiDataUse\(tenant, \{ attestationId: inForce\.id, scopes, justification, observedRevision \}\)/);
assert.match(code, /await withdrawTenantExternalAiDataUse\(tenant, /);
for (const seam of ["read-processor-attestations.server", "read-tenant-external-ai-data-use.server", "platform-disclosure-policy"]) {
  assert.ok(code.includes(`external-ai-data-use/${seam}`), `the ceremony uses the released ${seam}`);
}
for (const forbidden of ["@/db/schema", "src/db/schema", "drizzle-orm", "getControlPlaneDb", "governance-decision", "governance-audit", "scripts/lib/processor-attestation", "provider-connectivity", "heby-model", "heby-answer", "features/agent-origination"]) {
  /* APF-3: `agent-origination` is now also a purpose this ceremony names, so the ban is on the module path. */
  assert.ok(!code.includes(forbidden), `the ceremony does not reach ${forbidden}`);
}

/* ── 3. Nothing about WHAT is authorized is a CLI option. ─────────────────────────────────────── */
assert.match(code, /const KNOWN_FLAGS = \["tenant", "director", "justification", "confirm", "withdraw", "agent-origination"\];/);
assert.match(code, /if \(!a\.startsWith\("--"\) \|\| !KNOWN_FLAGS\.includes\(name\)\) fail\(/, "an unknown argument is refused");
assert.ok(!/arg\("(scope|purpose|data|class|attestation|service|account|policy)/i.test(code), "no flag names a scope, purpose, class or attestation");
assert.match(code, /const SERVICE_SCOPE = "anthropic\/messages";/);
/* APF-3 — one closed switch chooses between two purposes; neither is a typed value. */
assert.match(code, /const PURPOSE = has\("agent-origination"\) \? "agent-origination" : "assistance";/);
assert.match(code, /RECORDED_PLATFORM_DISCLOSURE_POLICY\.allowedCells\.filter\(/, "the pairs are read off the recorded policy");
/* What that read yields today: exactly the three B1D cells. */
assert.deepEqual(
  RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells
    .filter((c) => c.serviceScope === "anthropic/messages" && c.purpose === "assistance")
    .map((c) => c.dataClass),
  ["conversation", "knowledge", "work-artifact"],
);
assert.deepEqual(
  RECORDED_PLATFORM_DISCLOSURE_POLICY.allowedCells
    .filter((c) => c.serviceScope === "anthropic/messages" && c.purpose === "agent-origination")
    .map((c) => c.dataClass),
  ["conversation", "organization"],
);
/* APF-3 — the writer is handed the UNION of what is in force and what is added, never the addition alone. */
assert.match(code, /const scopes = nextRevisionScopes\(current\?\.state === "active" \? current\.scopes : \[\], adding\);/);

/* ── 4. Dry run by default; a write needs --confirm AND a typed phrase on a TTY. ───────────────── */
assert.match(code, /if \(!confirmed\) \{\s*console\.log\("  DRY RUN — nothing was written/);
assert.ok(code.indexOf("if (!confirmed)") < code.indexOf("promptVisible(`  Type"), "the dry run returns before any prompt");
assert.ok(code.indexOf("promptVisible(`  Type") < code.indexOf("await authorizeTenantExternalAiDataUse("), "the phrase is typed before the writer runs");
assert.match(code, /const CONFIRMATION = "AUTHORIZE EXTERNAL AI DATA USE";/);

/* ── 5. No credential, no provider, no HTTP. ──────────────────────────────────────────────────── */
assert.ok(!/ANTHROPIC|OPENAI|HIGGSFIELD|_API_KEY|HEBUN_MODEL_CREDENTIAL/.test(code), "names no credential");
assert.ok(!/https?:\/\/|\bfetch\s*\(|from\s+["']node:https?["']|undici|axios/.test(code), "makes no HTTP call");
assert.ok(!/process\.env\.(?!NODE_ENV|DATABASE_URL)\w+/.test(code), "reads no other environment value");

/* ── 6. The npm entry point. ──────────────────────────────────────────────────────────────────── */
assert.match(
  readFileSync(path.join(ROOT, "package.json"), "utf8"),
  /"platform:tenant-external-ai-data-use": "node --import tsx scripts\/eai-authorize-tenant-external-ai-data-use\.ts"/,
);

/* ── 7. A piped stdin is refused before anything is read — even with --confirm. ───────────────── */
{
  const child = spawnSync(process.execPath, ["--import", "tsx", CEREMONY, "--tenant=hebun", "--confirm"], {
    cwd: ROOT,
    input: "AUTHORIZE EXTERNAL AI DATA USE\n",
    encoding: "utf8",
    /* No DATABASE_URL: the refusal must come from the TTY check alone. */
    env: { PATH: process.env.PATH ?? "", HOME: process.env.HOME ?? "", NODE_ENV: "test" },
  });
  assert.equal(child.status, 1, `refused with exit 1 (stderr: ${child.stderr})`);
  assert.match(child.stderr, /requires an interactive terminal\. Nothing was read or changed\./);
  assert.doesNotMatch(child.stdout, /CEREMONY|DRY RUN|✔/, "nothing was shown or written");
}

console.log("PASS external-ai-data-use tenant-ceremony ceremony-boundary");
