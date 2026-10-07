/*
 * AP-2 — AGENT PLACEMENT FIREWALL (structural).
 *
 *   1. The writer is COLUMN-SCOPED: its one `.set({...})` names exactly the writable columns.
 *   2. It writes `agents` (update only) and the audit sink — nothing else, and never inserts an agent.
 *   3. It reaches no Agent Identity, mandate, capability, authorization, execution or EAI module.
 *   4. `.update(agents)` exists in exactly two modules: retirement (Agent Identity) and this writer.
 *   5. The legacy generic adapter stays quarantined: no product path constructs it for `agents`.
 *   6. PLACEMENT GRANTS NOTHING: the placement modules are reachable only from the `/agents`
 *      surface, and `agents.departmentId` is read by no module but the placement reader and writer.
 *   7. Agent Identity still writes no `department_id` (genesis firewall unchanged; retirement here).
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { AGENT_PLACEMENT_WRITABLE_COLUMNS } from "../../src/features/organization-authority/agent-placement-contracts";

const ROOT = process.cwd();
const WRITER = "src/features/organization-authority/write-agent-placement.server.ts";
const READER = "src/features/organization-authority/read-agent-placement.server.ts";
const CONTRACTS = "src/features/organization-authority/agent-placement-contracts.ts";
const AUDIT = "src/features/governance-audit/agent-placement-audit.server.ts";
const RETIRE = "src/features/agent-identity/retire-durable-agent-identity.server.ts";

const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
const code = (file: string): string => read(file).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`;
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}
const SOURCE = walk("src").filter((f) => !f.startsWith("src/db/migrations/"));
const camel = (snake: string) => snake.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

/* ── 1. COLUMN SCOPE ──────────────────────────────────────────────────────── */
{
  const writer = code(WRITER);
  const sets = [...writer.matchAll(/\.set\(\{([\s\S]*?)\}\)/g)];
  assert.equal(sets.length, 1, "the writer has exactly one `.set({...})`");
  const keys = [...sets[0]![1]!.matchAll(/^\s*([A-Za-z]+)\s*:/gm)].map((m) => m[1]).sort();
  assert.deepEqual(
    keys,
    AGENT_PLACEMENT_WRITABLE_COLUMNS.map(camel).sort(),
    "the writer's `.set` names exactly the writable columns — no identity, lifecycle, mandate or capability field",
  );
}

/* ── 2. WHAT IT WRITES ────────────────────────────────────────────────────── */
{
  const writer = code(WRITER);
  const verbs = [...writer.matchAll(/\.(insert|update|delete)\(\s*([A-Za-z]+)\s*\)/g)].map((m) => `${m[1]}(${m[2]})`);
  assert.deepEqual(verbs, ["update(agents)"], "the writer only ever UPDATEs `agents` — it never inserts or deletes");
  assert.ok(!/from\(\s*departmentPlacements\s*\)|memberships|decisionRecords|writeGovernanceDecision/.test(writer),
    "no human placement, membership or Governance decision is touched");
  assert.match(writer, /\.for\("update"\)/, "the agent row is locked");
  assert.match(writer, /\.for\("share"\)/, "the target department is locked against concurrent retirement");
}

/* ── 3. NO REACH INTO AUTHORITY ───────────────────────────────────────────── */
{
  const forbidden = [
    "@/features/agent-identity",
    "@/features/agent-mandate",
    "@/features/action-authorization",
    "@/features/action-execution",
    "@/features/agent-origination",
    "@/features/origination-availability",
    "@/features/external-ai-data-use",
    "@/features/standing-",
    "@/features/governed-machine-execution",
    "@/features/governed-internal-action",
    "@/features/work-artifacts",
  ];
  for (const file of [WRITER, READER, CONTRACTS, AUDIT]) {
    const imports = [...read(file).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const target of imports) {
      assert.ok(!forbidden.some((f) => target.startsWith(f)), `${file} must not import ${target}`);
    }
  }
}

/* ── 4. WHO UPDATES `agents` ──────────────────────────────────────────────── */
{
  const updaters = SOURCE.filter((f) => /\.update\(\s*agents\s*\)/.test(code(f))).sort();
  assert.deepEqual(updaters, [RETIRE, WRITER].sort(), "exactly two modules UPDATE `agents`: retirement and placement");
  const rawWriters = SOURCE.filter((f) => /(update\s+agents\b|insert\s+into\s+agents\b)/i.test(code(f))).sort();
  assert.deepEqual(rawWriters, ["src/features/persistence/supabase-postgres-adapter.ts"],
    "raw-SQL agent writes exist only in the quarantined legacy adapter");
}

/* ── 5. THE LEGACY ADAPTER IS NOT A SECOND PLACEMENT WRITER ───────────────── */
{
  const constructsForAgents = SOURCE.filter((f) => /collection:\s*"agents"/.test(code(f))).sort();
  assert.deepEqual(
    constructsForAgents,
    ["src/features/persistence/agent-postgres-codec.ts", "src/features/persistence/provider-registry.ts"].sort(),
    "only the codec and the health probe name the `agents` collection",
  );
  const registry = code("src/features/persistence/provider-registry.ts");
  assert.ok(!/agentAdapter\.(create|update|upsert|save|write)/.test(registry),
    "the provider registry constructs the agents adapter for health only — never to write");
}

/* ── 6. PLACEMENT GRANTS NOTHING ──────────────────────────────────────────── */
{
  const PLACEMENT_MODULES = /from\s+"[^"]*(organization-authority\/(write-agent-placement|read-agent-placement|agent-placement-contracts)|governance-audit\/agent-placement-audit)[^"]*"/;
  const importers = SOURCE.filter((f) => ![WRITER, READER, CONTRACTS, AUDIT].includes(f))
    .filter((f) => PLACEMENT_MODULES.test(read(f)))
    .sort();
  assert.deepEqual(
    importers,
    [
      "src/app/(dashboard)/agents/actions.ts",
      "src/app/(dashboard)/agents/page.tsx",
      "src/components/agents/agent-placement-card.tsx",
    ],
    "only the /agents surface reaches agent placement — no mandate, capability, WF-4, standing, EAI, proposer or origination module does",
  );
  const columnReaders = SOURCE.filter((f) => /\bagents\.departmentId\b/.test(code(f))).sort();
  assert.deepEqual(columnReaders, [READER, WRITER].sort(),
    "`agents.departmentId` is read by the placement reader and writer and nothing else");
}

/* ── 7. AGENT IDENTITY STILL WRITES NO PLACEMENT ──────────────────────────── */
{
  const retire = code(RETIRE);
  const set = retire.slice(retire.indexOf(".update(agents)"), retire.indexOf(".where(", retire.indexOf(".update(agents)")));
  assert.ok(!/departmentId/.test(set), "retirement does not write `department_id` — it preserves it");
  assert.ok(!/departmentId/.test(code("src/features/agent-identity/create-durable-agent-identity.server.ts")),
    "registration does not write `department_id`");
}

console.log("ap2-agent-placement/firewall: column-scoped, agents-only, unreachable from authority, legacy quarantined");
