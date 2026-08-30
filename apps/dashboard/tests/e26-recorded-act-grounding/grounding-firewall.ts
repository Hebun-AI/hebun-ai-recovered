/*
 * E2-6 — RECORDED ACT GROUNDING FIREWALL.
 *
 * Claims the semantics test cannot make, because each is about what the module's whole import
 * closure can REACH rather than what one call returned:
 *
 *   E2-6 WRITES NOTHING. `audit_log` has writers all over this repository — every subsystem that
 *   records an act. Heby reaching one would make an ANSWER able to append to the durable record of
 *   what the organization did, which is the single worst thing this class could become.
 *
 *   HEBY -/-> LIVE MAP, still. E2-1's released rule, re-asserted for a third grounding class.
 *
 *   THE WITHHELD COLUMNS STAY WITHHELD. `WITHHELD_AUDIT_COLUMNS` names ten fields the released
 *   reader must never select. This module must not name them either — it cannot re-widen a
 *   projection by reading a column its own authority refused.
 *
 * The bans read code with comments and string literals STRIPPED. R2F.1 and G2 recorded the trap: a
 * guard that scans raw source is tripped by a comment mentioning the thing it forbids, and this
 * file's header names several symbols it bans.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { performsDurableWrite } from "../helpers/durable-write-detector";
import { WITHHELD_AUDIT_COLUMNS } from "../../src/features/governance-activity/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");

const AUTHORITY_DIR = "src/features/governance-activity";
const PROJECTION = `${AUTHORITY_DIR}/heby-recorded-act-source.server.ts`;
const HEBY_ANSWER = "src/features/heby-answer/model-answer.server.ts";

/** Source with comments and string literals removed. */
function codeOf(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
}

/** VALUE edges only, and RE-EXPORTS COUNT. Both traps are already paid for here. */
function valueEdges(file: string): string[] {
  const source = read(file);
  const specifiers: string[] = [];
  const re = /\b(import|export)\s+(type\s+)?([\s\S]*?)\s*from\s*["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source)) !== null) {
    if (m[2]) continue;
    const clause = m[3] ?? "";
    const named = clause.match(/\{([\s\S]*)\}/);
    if (named && !/(^|,)\s*(?!type\s)[A-Za-z_$]/.test(named[1]!) && !/^[^{]*[A-Za-z_$]/.test(clause)) {
      continue;
    }
    specifiers.push(m[4]!);
  }
  return specifiers;
}

function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = path.join("src", specifier.slice(2));
  else if (specifier.startsWith(".")) base = path.normalize(path.join(path.dirname(from), specifier));
  else return null;

  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
    const absolute = path.join(ROOT, candidate);
    if (existsSync(absolute) && statSync(absolute).isFile()) return candidate;
  }
  return null;
}

function transitiveGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const queue = [...entries];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const specifier of valueEdges(file)) {
      const resolved = resolveSpecifier(file, specifier);
      if (resolved && !seen.has(resolved)) queue.push(resolved);
    }
  }
  return seen;
}

function walk(dir: string): string[] {
  if (!existsSync(path.join(ROOT, dir))) return [];
  return readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(p);
    return entry.isFile() && (p.endsWith(".ts") || p.endsWith(".tsx")) ? [p] : [];
  });
}

function main(): void {
  /* ── 0 · THE WALKER IS NON-VACUOUS ───────────────────────────────────────── */
  {
    const graph = transitiveGraph([PROJECTION]);
    assert.ok(graph.size > 4, "the walker resolved the projection's imports");
    assert.ok(
      graph.has(`${AUTHORITY_DIR}/observe.server.ts`) &&
        graph.has(`${AUTHORITY_DIR}/act-history-read.server.ts`),
      "the walk reaches the released act-history reader, so it is a real graph",
    );
    /* It follows `export … from`, the edge kind that has defeated a firewall here before. */
    const barrel = transitiveGraph(["src/features/agent-identity/index.ts"]);
    assert.ok(barrel.has("src/features/agent-identity/create-durable-agent-identity.server.ts"));
  }

  /* ── 1 · THE WHOLE GROUNDING CLOSURE WRITES NOTHING ──────────────────────── */
  {
    const graph = transitiveGraph([PROJECTION]);
    for (const file of graph) {
      assert.ok(
        !performsDurableWrite(read(file)),
        `E2-6's grounding closure must contain no durable write, but ${file} performs one`,
      );
    }
    /* And the ban is not vacuous: real audit writers exist and are importable. */
    const writers = walk("src/features").filter((file) => {
      const code = codeOf(read(file));
      return /insert\s*\(\s*auditLog\s*\)/.test(code) || /recordAudit|writeAuditLog/.test(code);
    });
    assert.ok(writers.length > 0, "audit writers exist, so the closure ban is a real constraint");
    for (const writer of writers) {
      assert.ok(!graph.has(writer), `the grounding closure must not reach the audit writer ${writer}`);
    }
  }

  /* ── 2 · THE PROJECTION DOES NOT REACH LIVE MAP ──────────────────────────── */
  {
    const graph = transitiveGraph([PROJECTION]);
    for (const file of graph) {
      assert.ok(
        !file.startsWith("src/features/live-map/"),
        `E2-6's projection must not reach Live Map, but it reaches ${file}`,
      );
    }
  }

  /* ── 3 · THE WITHHELD COLUMNS ARE NEVER NAMED ────────────────────────────── */
  {
    const code = codeOf(read(PROJECTION));
    for (const column of WITHHELD_AUDIT_COLUMNS) {
      assert.ok(
        !code.includes(column),
        `${column} is withheld by the authority; the projection must not name it`,
      );
    }
    /* Non-vacuous: the list is real and non-empty. */
    assert.ok(WITHHELD_AUDIT_COLUMNS.length >= 10, "the withheld-column list is populated");
  }

  /* ── 4 · THE PROJECTION HOLDS NO HANDLE, NO TABLE, NO STATEMENT ──────────── */
  {
    const code = codeOf(read(PROJECTION));
    for (const symbol of ["getControlPlaneDb", "ControlPlaneDatabase", "drizzle", "db.select", "sql`"]) {
      assert.ok(!code.includes(symbol), `the projection must not hold ${symbol}`);
    }
    assert.ok(
      !/from\s*["']@\/db\//.test(code),
      "the projection must not import anything from the db layer",
    );
    assert.deepEqual(
      valueEdges(PROJECTION).sort(),
      ["./contracts", "./observe.server"].sort(),
      "its only value imports are its own authority's contracts and observer",
    );
  }

  /* ── 5 · THE ANSWER FLOW IMPORTS THE PROJECTION, NOT THE AUTHORITY ───────── */
  {
    const code = codeOf(read(HEBY_ANSWER));
    assert.ok(code.includes("readRecordedActGroundingSource"), "the answer flow imports the projection");
    for (const symbol of ["readRecordedActPage", "observeRecordedActHistory", "auditLog"]) {
      assert.ok(
        !code.includes(symbol),
        `Heby must hold the projection only, never ${symbol} — the authority keeps its readers`,
      );
    }
  }

  /* ── 6 · ONLY ONE MODULE PRODUCES THE CLASS ──────────────────────────────── */
  {
    const producers = walk("src").filter((file) => /sourceClass:\s*"recorded-acts"/.test(read(file)));
    assert.deepEqual(
      producers.sort(),
      [PROJECTION].sort(),
      "exactly one module may construct a `recorded-acts` resolution",
    );
    assert.match(
      read("src/features/heby-runtime/source-resolver.ts"),
      /case "recorded-acts":/,
      "the pure resolver still answers for the class through its shared helper",
    );
  }

  console.log("e26-recorded-act-grounding/grounding-firewall: OK");
}

main();
