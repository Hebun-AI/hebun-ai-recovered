/*
 * L-1a — structural guarantees, read from source. No database.
 *
 * F1 The rule module is pure: no write verb, no transaction, no database handle, two imports.
 * F2 Only an allowlisted set of files reads the three lifecycle columns, and every reader among them
 *    asks the shared rule — "in service" cannot be re-derived somewhere new.
 * F3 Nothing outside the retirement writer compares the lifecycle to 'retired' (the old denylist).
 * F4 The approval asks liveness inside its transaction, before any decision is written; rejection
 *    never asks.
 * F5 The in-transaction liveness read locks FOR SHARE and writes nothing.
 * F6 Placement reaches Agent Identity only through the rule module.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
/** Source with comments removed, so prose never satisfies or trips a code assertion. */
const code = (p: string): string =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const RULE = "src/features/agent-identity/in-service.ts";
const IDENTITY_READER = "src/features/agent-identity/read-durable-agent-identity.server.ts";
const RETIRE = "src/features/agent-identity/retire-durable-agent-identity.server.ts";
const MANDATE_WRITER = "src/features/agent-mandate/establish-agent-mandate.server.ts";
const PLACEMENT_READER = "src/features/organization-authority/read-agent-placement.server.ts";
const PLACEMENT_WRITER = "src/features/organization-authority/write-agent-placement.server.ts";
const HYPOTHESES = "src/features/agent-improvement-hypothesis/read-improvement-hypotheses.server.ts";
const APPROVAL = "src/features/action-authorization/decide-action-request.server.ts";

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}
const SRC = walk("src");

/* ── F1 ── */
{
  const rule = code(RULE);
  assert.ok(!/\.(insert|update|delete|transaction)\(/.test(rule), "the rule module writes nothing and opens no transaction");
  assert.ok(!/getControlPlaneDb|client\.server/.test(rule), "the rule module holds no database handle");
  const imports = [...rule.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["@/db/schema/agent", "drizzle-orm"], "the rule module imports only drizzle-orm and the agents table");
}

/* ── F2 ── */
{
  const LIFECYCLE_COLUMNS = /agents\.(retiredAt|suspendedAt|agentLifecycleStatus)\b/;
  const readers = [IDENTITY_READER, MANDATE_WRITER, PLACEMENT_READER, PLACEMENT_WRITER, HYPOTHESES];
  const allowed = new Set([RULE, RETIRE, ...readers]);
  const touching = SRC.filter((f) => LIFECYCLE_COLUMNS.test(code(f)));
  for (const file of touching) {
    assert.ok(allowed.has(file), `${file} reads an agent lifecycle column outside the allowlisted set`);
  }
  for (const file of readers) {
    assert.match(code(file), /isAgentInService\(/, `${file} asks the shared in-service rule`);
    assert.match(code(file), /agents\.suspendedAt/, `${file} reads suspended_at, which the rule requires`);
  }
}

/* ── F3 ── */
{
  for (const file of SRC.filter((f) => f !== RETIRE && f !== "src/features/agent-identity/retirement-contracts.ts")) {
    const c = code(file);
    assert.ok(
      !/(!==|===)\s*RETIRED_AGENT_LIFECYCLE_STATUS|RETIRED_AGENT_LIFECYCLE_STATUS\s*(!==|===)/.test(c),
      `${file} re-derives liveness from the 'retired' lifecycle value`,
    );
    assert.ok(!/const\s+RETIRED_AGENT\s*=/.test(c), `${file} spells its own retired-agent constant`);
  }
}

/* ── F4 ── */
{
  const approval = code(APPROVAL);
  assert.match(
    approval,
    /import \{ readDurableAgentLivenessForShareWithin \} from "@\/features\/agent-identity\/read-durable-agent-identity\.server";/,
    "approval imports exactly the in-transaction liveness read",
  );
  const approve = approval.slice(
    approval.indexOf("export async function approveActionRequest"),
    approval.indexOf("export async function rejectActionRequest"),
  );
  const reject = approval.slice(approval.indexOf("export async function rejectActionRequest"));
  const tx = approve.indexOf("db.transaction(");
  const ask = approve.indexOf("readDurableAgentLivenessForShareWithin(");
  const decide = approve.indexOf("writeGovernanceDecisionWithin(");
  assert.ok(tx > 0 && ask > tx, "approval asks liveness inside its transaction");
  assert.ok(decide > ask, "approval asks liveness before writing any decision");
  assert.match(approve, /proposedByActorType === "agent"/, "only an agent proposer is asked about");
  assert.ok(!/Liveness|isAgentInService/.test(reject), "rejection never asks about the proposer's service state");
}

/* ── F5 ── */
{
  const reader = code(IDENTITY_READER);
  const fn = reader.slice(reader.indexOf("export async function readDurableAgentLivenessForShareWithin"));
  assert.match(fn, /\.for\("share"\)/, "the in-transaction liveness read locks the agent row FOR SHARE");
  assert.ok(!/\.(insert|update|delete|transaction)\(/.test(reader), "the identity reader still writes nothing and opens no transaction");
}

/* ── F6 ── */
{
  for (const file of [PLACEMENT_READER, PLACEMENT_WRITER]) {
    const imports = [...read(file).matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
    for (const target of imports.filter((t) => t.startsWith("@/features/agent-identity"))) {
      assert.equal(target, "@/features/agent-identity/in-service", `${file} reaches Agent Identity only through the rule module`);
    }
  }
}

console.log("l1a firewall: ok");
