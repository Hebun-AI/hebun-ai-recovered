/*
 * L-2a — structural guarantees, read from source. No database.
 *
 * F1 The status module is pure: type-only imports, no write verb, no database handle.
 * F2 The identity seam derives `serviceStatus` with that module and nowhere invents its own.
 * F3 No agent surface renders "retired" from `inService` — every one renders the status.
 * F4 No lifecycle writer was added: agent identity still owns exactly register and retire.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const code = (p: string): string =>
  read(p)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const STATUS = "src/features/agent-identity/service-status.ts";
const READER = "src/features/agent-identity/read-durable-agent-identity.server.ts";
const SURFACES = [
  "src/components/agents/durable-agent-identity-card.tsx",
  "src/components/agents/agent-mandate-card.tsx",
  "src/components/agents/agent-outcome-observation.tsx",
  "src/components/agents/agent-evaluation.tsx",
  "src/features/live-map/read-live-map.server.ts",
  "src/features/agent-mandate/heby-mandate-source.server.ts",
  "src/features/agent-outcome-observation/heby-agent-source.server.ts",
];

function walk(dir: string): string[] {
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(rel);
    return /\.(ts|tsx)$/.test(entry.name) ? [rel] : [];
  });
}

/* ── F1 ── */
{
  const s = code(STATUS);
  const imports = [...s.matchAll(/^import\s+(type\s+)?[^;]*from\s+"([^"]+)"/gm)];
  assert.ok(imports.every((m) => m[1]), "the status module has type-only imports");
  assert.ok(!/\.(insert|update|delete|transaction|select)\(|getControlPlaneDb/.test(s), "the status module touches no database");
}

/* ── F2 ── */
{
  const r = code(READER);
  assert.match(r, /serviceStatus: agentServiceStatus\(row\)/, "the identity seam derives the status with the shared rule");
  for (const file of walk("src")) {
    if (file === STATUS) continue;
    assert.ok(!/function agentServiceStatus|=>\s*\(?\s*\{?\s*retiredAt[^)]*suspendedAt[^)]*lifecycle[^)]*\)?\s*=>/.test(code(file)), `${file} does not re-derive service status`);
  }
}

/* ── F3 ── */
for (const file of SURFACES) {
  const c = code(file);
  assert.ok(
    /* Agent objects only: departments and work items genuinely retire and keep their own wording. */
    !/(identity|agent)\.inService\s*\?[^:;]*:\s*[`"'(]\s*[Rr]etired/.test(c) && !/agentInService\s*\?[^:;]*:\s*[`"']retired/.test(c),
    `${file} renders "retired" from inService`,
  );
  assert.match(c, /serviceStatus/, `${file} renders the identity seam's status`);
}

/* ── F4 ── */
{
  const feature = walk("src/features/agent-identity").map(code).join("\n");
  const updates = [...feature.matchAll(/\.update\(agents\)/g)].length;
  /* L-2b — the suspension writer is the second, and the only one besides retirement. */
  assert.equal(updates, 2, "agent identity has exactly two UPDATEs of agents — retirement and the L-2b service transition");
  const sus = code("src/features/agent-identity/suspend-durable-agent-identity.server.ts");
  assert.equal([...sus.matchAll(/\.update\(agents\)/g)].length, 1, "the second UPDATE is the suspension writer's");
  assert.ok(!feature.includes("suspendedAt: new Date"), "suspended_at is stamped from the injected transaction clock only");
}

console.log("l2a firewall: ok");
