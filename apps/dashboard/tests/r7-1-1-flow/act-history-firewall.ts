/*
 * R7.1.1 — THE DRILL-THROUGH FIREWALL.
 *
 * Walks the REAL import graph from the `/audit` read root, in comment-stripped code, and pins both
 * directions: what it MUST reach (so a later edit cannot stop consulting the ledger and start
 * inventing) and what it must NEVER reach.
 *
 * It also proves the SELECT LIST is the security boundary — that the withheld columns are withheld
 * by absence from the statement, not by a downstream filter someone could delete.
 *
 * Structural. Nothing here opens a database, contacts anything, or runs a command.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { WITHHELD_AUDIT_COLUMNS } from "../../src/features/governance-activity/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const PAGE_READ = "src/features/governance-activity/act-history-read.server.ts";
const OBSERVE = "src/features/governance-activity/observe.server.ts";
const AGGREGATE = "src/features/governance-activity/read.server.ts";
const READ_COMMANDS = "src/features/heby-commands/read-commands.server.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";

function resolveImport(spec: string, from: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = path.join("src", spec.slice(2));
  else if (spec.startsWith(".")) base = path.normalize(path.join(path.dirname(from), spec));
  else return null;
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")]) {
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return null;
}

function closure(entry: string): Set<string> {
  const seen = new Set<string>([entry]);
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    let source: string;
    try {
      source = codeOf(read(file));
    } catch {
      continue;
    }
    for (const match of source.matchAll(/(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g)) {
      const resolved = resolveImport(match[1]!, file);
      if (resolved && !seen.has(resolved)) {
        seen.add(resolved);
        queue.push(resolved);
      }
    }
  }
  return seen;
}

function main(): void {
  const graph = closure(OBSERVE);

  /* ── 1 · IT REACHES THE LEDGER AND THE TENANT, AND THAT IS THE POINT ─────── */
  {
    assert.ok(graph.has(PAGE_READ), "the observation reaches the bounded read");
    assert.ok(graph.has("src/db/schema/audit-log.ts"), "which reaches the authoritative ledger");
  }

  /* ── 2 · IT REACHES NO WRITER OF ANY KIND ────────────────────────────────
   * `governance-audit/*` MIXES reads and writes: a file importing one holds a reference into a
   * module that can append to the ledger, and no reviewer should have to check which symbol was
   * taken. G6C settled exactly this for Governance; the drill-through consumes the projection side.
   */
  {
    const bannedRoots = [
      "src/features/governance-audit/",
      "src/features/governance-decision/",
      "src/features/knowledge/",
      "src/features/knowledge-ratification/",
      "src/features/action-authorization/",
      "src/features/action-execution/",
      "src/features/integration-credentials/",
      "src/features/provider-github/",
      "src/features/provider-google/",
      "src/features/heby-model/",
      "src/features/heby-model-live/",
    ];
    for (const file of graph) {
      for (const root of bannedRoots) {
        assert.ok(!file.startsWith(root), `the drill-through must not reach ${file}`);
      }
    }
  }

  /* ── 2b · NO SECOND ACT SINK — PROVED BY MECHANISM, NOT BY REACHABILITY ──
   * `event_log` IS in this graph, and a firewall asserting otherwise would be a lie. The reason is
   * structural and has nothing to do with this phase: `db/client.server.ts` does
   * `import * as schema from "./schema"`, and the barrel re-exports every table — so EVERY module
   * in the repository that can open a database reaches `event-log.ts`, R7.1's own aggregate and all
   * nine audit writers included.
   *
   * The honest guarantee is therefore not "the table is unreachable" but "NO STATEMENT IN THIS
   * PHASE TOUCHES IT", and that is what is asserted: the phase's own files never name the binding.
   * `audit_log` stays the single sink for recorded acts, and this phase adds no second one.
   */
  {
    for (const file of [PAGE_READ, OBSERVE, READ_COMMANDS]) {
      const code = codeOf(read(file));
      for (const forbidden of ["eventLog", "event_log", "event-log"]) {
        assert.ok(!code.includes(forbidden), `${file} must not name "${forbidden}"`);
      }
    }
  }

  /* ── 3 · NO DURABLE WRITE EXISTS ANYWHERE IN THE GRAPH ───────────────────── */
  {
    for (const file of graph) {
      const code = codeOf(read(file));
      for (const forbidden of [/\.insert\(/, /\.update\(/, /\.delete\(/, /\.transaction\(/]) {
        assert.ok(!forbidden.test(code), `${file} must not match ${forbidden} — R7.1.1 is a reader`);
      }
      for (const raw of [/insert\s+into/i, /update\s+[a-z_"]+\s+set/i, /delete\s+from/i, /truncate\s+table/i]) {
        assert.ok(!raw.test(code), `${file} must not carry raw SQL matching ${raw}`);
      }
    }
  }

  /* ── 4 · THE SELECT LIST IS THE SECURITY BOUNDARY ────────────────────────
   * Withheld by ABSENCE from the statement — not by a downstream filter a later edit could drop.
   */
  {
    const code = codeOf(read(PAGE_READ));
    for (const column of WITHHELD_AUDIT_COLUMNS) {
      assert.ok(
        !new RegExp(`auditLog\\.${column}\\b`).test(code),
        `the bounded read must never select auditLog.${column}`,
      );
    }
    /* No whole-row form: `select()` with no argument would return every column including the jsonb. */
    assert.ok(!/\.select\(\s*\)/.test(code), "no argument-less select — that returns the whole row");
    assert.ok(!/\.\.\.auditLog/.test(code), "and no spread of the table");
    assert.equal(
      (code.match(/\.select\(/g) ?? []).length,
      2,
      "exactly two statements: the unbounded total and the bounded page",
    );
  }

  /* ── 5 · THE BOUND IS REAL, AND THE TOTAL IS NOT BOUNDED ─────────────────
   * `.limit(` appears exactly once. A second one would mean the total acquired a bound, which is
   * precisely the R6B defect: a count derived from a truncated listing under-reports silently.
   */
  {
    const code = codeOf(read(PAGE_READ));
    assert.equal((code.match(/\.limit\(/g) ?? []).length, 1, "exactly one bound, on the page only");
    assert.ok(/\.orderBy\(/.test(code), "the page is ordered");
    assert.ok(
      /desc\(auditLog\.occurredAt\)\s*,\s*desc\(auditLog\.id\)/.test(code),
      "ordering carries a stable tie-breaker — occurred_at alone is not deterministic",
    );
    /* The aggregate's own no-bound guarantee stays absolute, in its own file. */
    assert.ok(!/\.limit\(/.test(codeOf(read(AGGREGATE))), "the R7.1 aggregate still carries no bound");
  }

  /* ── 6 · THE TENANT PREDICATE IS ONE EXPRESSION, ON BOTH STATEMENTS ──────── */
  {
    const code = codeOf(read(PAGE_READ));
    assert.equal(
      (code.match(/const tenantScope = /g) ?? []).length,
      1,
      "one tenant expression, not one per statement",
    );
    assert.equal((code.match(/\.where\(tenantScope\)/g) ?? []).length, 2, "and both statements take it");
    assert.ok(
      /if \(!UUID_RE\.test\(tenantId\)\) return null;/.test(code),
      "a malformed tenant id is refused before any statement runs",
    );
  }

  /* ── 7 · NO CLIENT-SUPPLIED TENANT, AND NO WHOLE-LEDGER FORM ────────────── */
  {
    const code = codeOf(read(OBSERVE));
    assert.ok(
      /export async function observeRecordedActHistory\(\s*tenant: Pick<TenantContext, "tenantId"> \| null,/.test(code),
      "the entry point takes the authorized tenant context, never a caller-supplied id",
    );
    for (const forbidden of ["allTenants", "crossTenant", "everyTenant", "tenantId?:"]) {
      assert.ok(!code.includes(forbidden), `no cross-tenant form: "${forbidden}"`);
    }
    /* The command surface passes the resolved tenant and offers no argument of its own. */
    const registry = codeOf(read(REGISTRY));
    const auditEntry = registry.slice(registry.indexOf('id: "audit"'), registry.indexOf('id: "incidents"'));
    assert.ok(auditEntry.includes('availability: "available"'), "/audit is available");
    assert.ok(!auditEntry.includes("unavailableReason"), "and carries no stale refusal reason");
    assert.ok(auditEntry.includes('...base("read")'), "and is a read command");
  }

  /* ── 8 · NO MODEL TOUCHES THE ANSWER ─────────────────────────────────────
   * `/audit` renders deterministically. A model in this path could summarize, classify or soften a
   * recorded act into something the ledger never said.
   */
  {
    for (const file of graph) {
      const code = codeOf(read(file));
      for (const forbidden of ["anthropic", "claude", "selectModelTransport", "buildAdvisoryPrompt"]) {
        assert.ok(
          !code.toLowerCase().includes(forbidden.toLowerCase()),
          `${file} must not reach the model via "${forbidden}"`,
        );
      }
      assert.ok(!/\bfetch\s*\(/.test(code), `${file} must make no network call`);
    }
  }

  /* ── 9 · G1's WRITE FIREWALL STILL HOLDS OVER THE HEBY SURFACE ───────────
   * Re-asserted here rather than assumed: G1 §17 bans the audit WRITER from anything Heby reaches,
   * and this phase is the first to give a Heby command a reason to look at the ledger at all.
   */
  {
    const commands = read(READ_COMMANDS);
    for (const banned of ["governance-audit", "recordKnowledgeMutation", "auditActorFrom", "insert(auditLog)"]) {
      assert.ok(!commands.includes(banned), `read-commands must not reach "${banned}"`);
    }
  }

  console.log("r7-1-1-flow/act-history-firewall: OK");
}

main();
