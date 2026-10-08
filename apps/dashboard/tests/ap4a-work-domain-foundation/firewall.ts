/*
 * AP-4A — FIREWALL (structural).
 *
 *   1. ONE WRITER PER TABLE. `work_domains` is inserted/updated only by the Work Domain writer;
 *      `agent_mandate_responsibilities` only by the mandate core; nothing deletes either; only the Work
 *      Authority writes `work_items.work_scope_kind` / `work_domain_id` (AP-4B, once, at recording).
 *   2. ONE MANDATE AUTHORITY. `agent_mandates` is inserted in exactly one place, the private core;
 *      AP-4B deleted the five-value entry, so every revision states its responsibility.
 *   3. RELEASE B'S EXACT REACH (AP-4B, replacing Release A's inertness pins). The Work Domain writer
 *      is still reached by the operator ceremony only; its reader by the record-work inlet, the
 *      origination availability projection and four pages; the responsibility-aware entry by the
 *      mandate barrel and the /agents action; the AP-4A responsibility reader stays operator-only.
 *   4. A WORK DOMAIN IS NOT A DEPARTMENT. The authority reads no department, placement, agent or
 *      mandate module, and the schema holds no department reference.
 *   5. The slug shape in code equals the database CHECK.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { WORK_DOMAIN_AUTHORITY_MODEL, WORK_DOMAIN_SLUG_RE } from "../../src/features/work-domain/contracts";

const ROOT = process.cwd();
const WRITER = "src/features/work-domain/write-work-domain.server.ts";
const READER = "src/features/work-domain/read-work-domains.server.ts";
const CONTRACTS = "src/features/work-domain/contracts.ts";
const AUDIT = "src/features/governance-audit/work-domain-audit.server.ts";
const MANDATE = "src/features/agent-mandate/establish-agent-mandate.server.ts";
const RESPONSIBILITY_READER = "src/features/agent-mandate/read-agent-mandate-responsibility.server.ts";
const RESPONSIBILITY_CONTRACTS = "src/features/agent-mandate/responsibility-contracts.ts";
const LIVE_MANDATE_READER = "src/features/agent-mandate/read-agent-mandate.server.ts";
const SCHEMA_DOMAIN = "src/db/schema/work-domain.ts";
const SCHEMA_RESPONSIBILITY = "src/db/schema/agent-mandate-responsibility.ts";
const SCHEMA_WORK = "src/db/schema/work-item.ts";

const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const code = (f: string): string => read(f).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}
const SRC = walk("src").filter((f) => !f.startsWith("src/db/migrations/"));
const SCRIPTS = walk("scripts");
const importers = (spec: string, files: readonly string[]) => files.filter((f) => code(f).includes(spec));

/* ── 1. ONE WRITER PER TABLE ──────────────────────────────────────────────── */
assert.deepEqual(SRC.filter((f) => /\.(insert|update)\(\s*workDomains\s*\)/.test(code(f))), [WRITER], "only the Work Domain writer writes work_domains");
assert.deepEqual(
  SRC.filter((f) => /\.(insert|update)\(\s*agentMandateResponsibilities\s*\)/.test(code(f))),
  [MANDATE],
  "only the mandate core writes responsibility",
);
assert.ok(!/\.update\(\s*agentMandateResponsibilities\s*\)/.test(code(MANDATE)), "responsibility is never updated");
for (const f of SRC) {
  assert.ok(!/\.delete\(\s*(workDomains|agentMandateResponsibilities)\s*\)/.test(code(f)), `${f} deletes no work domain or responsibility`);
}
assert.deepEqual(
  SRC.filter((f) => f !== SCHEMA_WORK && /workScopeKind\s*:/.test(code(f))),
  ["src/features/organizational-work/write-work.server.ts"],
  "AP-4B: only the Work Authority writes a work scope",
);
assert.deepEqual([...WORK_DOMAIN_AUTHORITY_MODEL.writesTables], ["work_domains"]);

/* ── 2. ONE MANDATE AUTHORITY ─────────────────────────────────────────────── */
assert.deepEqual(SRC.filter((f) => /\.insert\(\s*agentMandates\s*\)/.test(code(f))), [MANDATE], "agent_mandates has one writer module");
assert.equal([...code(MANDATE).matchAll(/\.insert\(\s*agentMandates\s*\)/g)].length, 1, "and one insert: the private core");
assert.match(code(MANDATE), /async function writeMandateRevision\(/, "the core is private (not exported)");
assert.ok(!/export\s+async\s+function\s+writeMandateRevision/.test(code(MANDATE)));
assert.ok(!/export\s+async\s+function\s+establishAgentMandate\(/.test(code(MANDATE)), "AP-4B: the five-value entry is deleted");
assert.ok(!/writeMandateRevision\(tenant, input, null, deps\)/.test(code(MANDATE)), "AP-4B: no revision is written without stated responsibility");
assert.match(code(MANDATE), /return writeMandateRevision\(tenant, input, responsibility, deps\)/);
assert.match(
  read("src/features/agent-mandate/contracts.ts"),
  /export type AgentMandateRefusal =[\s\S]*?"concurrent-mandate-change";/,
  "the released refusal union is still closed where it was",
);
assert.ok(!/responsibility/.test(code("src/features/agent-mandate/contracts.ts")), "the released contracts file names no responsibility");

/* ── 3. RELEASE B'S EXACT REACH (AP-4B) ──────────────────────────────────── */
assert.deepEqual(importers("work-domain/write-work-domain.server", SRC).filter((f) => f !== WRITER), [], "the Work Domain writer has no src caller");
assert.deepEqual(
  importers("work-domain/read-work-domains.server", SRC).filter((f) => f !== READER).sort(),
  [
    "src/app/(dashboard)/agents/page.tsx",
    "src/app/(dashboard)/approvals/page.tsx",
    "src/app/(dashboard)/director/work/page.tsx",
    "src/app/(dashboard)/intelligence/social/page.tsx",
    "src/features/heby-action-inlet/record-work-proposal.server.ts",
    "src/features/origination-availability/read-origination-availability.server.ts",
  ],
  "the Work Domain reader is reached by the inlet, the availability projection and four pages — nothing else",
);
assert.deepEqual(importers("agent-mandate/read-agent-mandate-responsibility.server", SRC).filter((f) => f !== RESPONSIBILITY_READER), [], "the AP-4A responsibility reader stays operator-only");
assert.deepEqual(
  SRC.filter((f) => /establishAgentMandateWithResponsibility/.test(code(f))).sort(),
  ["src/app/(dashboard)/agents/actions.ts", "src/features/agent-mandate/index.ts", MANDATE].sort(),
  "the one mandate entry is reached by the /agents action (and re-exported by the barrel)",
);
assert.deepEqual(
  SCRIPTS.filter((f) => /establishAgentMandateWithResponsibility/.test(code(f))),
  ["scripts/agent-mandate-responsibility-ceremony.ts"],
  "and by the operator ceremony",
);
/* Who imports a table module — a property named `workDomains` on a read result is not a table. */
const TOUCH_NEW_TABLES = SRC.filter((f) => /from "@\/db\/schema\/(work-domain|agent-mandate-responsibility)"/.test(code(f)));
assert.deepEqual(
  TOUCH_NEW_TABLES.sort(),
  [
    MANDATE,
    RESPONSIBILITY_READER,
    LIVE_MANDATE_READER,
    "src/features/organizational-work/write-work.server.ts",
    READER,
    WRITER,
  ].sort(),
  "AP-4B: the live mandate reader joins responsibility; the Work Authority verifies the domain; nothing else touches the tables",
);
assert.ok(!/\.(insert|update|delete)\(/.test(code(LIVE_MANDATE_READER)), "the live effective-mandate reader still writes nothing");

/* ── 4. A WORK DOMAIN IS NOT A DEPARTMENT ─────────────────────────────────── */
for (const f of [WRITER, READER, CONTRACTS, AUDIT]) {
  const c = code(f);
  for (const forbidden of ["schema/department", "department-placement", "organization-authority", "schema/agent\"", "agent-mandate", "agent-identity"]) {
    assert.ok(!c.includes(forbidden), `${f} must not reach ${forbidden}`);
  }
}
assert.ok(!/department/i.test(code(SCHEMA_DOMAIN)), "work_domains holds no department reference");
assert.ok(!/department/i.test(code(SCHEMA_RESPONSIBILITY)), "responsibility holds no department reference");
assert.ok(!/department|placement/i.test(code(RESPONSIBILITY_CONTRACTS)), "responsibility is not stated in departments");
assert.equal(WORK_DOMAIN_AUTHORITY_MODEL.readsDepartments, false);
assert.equal(WORK_DOMAIN_AUTHORITY_MODEL.writesGovernanceDecision, false);
assert.ok(!/writeGovernanceDecisionWithin|decisionRecords/.test(code(WRITER)), "the Work Domain writer writes no Governance decision");

/* ── 5. SLUG SHAPE ────────────────────────────────────────────────────────── */
const check = /work_domains_slug_chk", sql`\$\{t\.slug\} ~ '([^']+)'/.exec(read(SCHEMA_DOMAIN));
assert.ok(check, "the slug CHECK is present");
assert.equal(check[1], WORK_DOMAIN_SLUG_RE.source, "the code slug shape equals the database CHECK");
assert.ok(/uniqueIndex\("work_domains_tenant_slug_uq"\)\.on\(t\.tenantId, t\.slug\),/.test(code(SCHEMA_DOMAIN)), "slug uniqueness is LIFETIME (no partial predicate)");

console.log("ap4a-work-domain-foundation/firewall: ok");
