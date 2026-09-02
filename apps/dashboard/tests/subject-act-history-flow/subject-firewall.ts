/*
 * SUBJECT-ACT-HISTORY-1 — THE SUBJECT-READ FIREWALL.
 *
 * Walks the REAL import graph from the subject observer, in comment-stripped code, and pins both
 * directions: what it MUST reach (so a later edit cannot stop consulting the ledger and start
 * inventing) and what it must NEVER reach.
 *
 * The centrepiece is §4. `entity_id` is the one withheld column this phase had a REASON to want,
 * and the guarantee is narrow and exact:
 *
 *     `auditLog.entityId` MAY appear inside the WHERE clause.
 *     `auditLog.entityId` MAY NOT appear inside the SELECT list.
 *
 * A filter is not a disclosure. Asserting "the column is absent" would have been the easy pin and
 * the wrong one — it would forbid the predicate the whole phase is — so this asserts the position
 * instead, which is the property that actually matters.
 *
 * Structural. Nothing here opens a database, contacts anything, or runs a command.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import {
  ACT_SUBJECT_REFERENCE_KINDS,
  WITHHELD_AUDIT_COLUMNS,
} from "../../src/features/governance-activity/contracts";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SUBJECT_READ = "src/features/governance-activity/subject-act-history-read.server.ts";
const OBSERVE = "src/features/governance-activity/observe.server.ts";
const READ_COMMANDS = "src/features/heby-commands/read-commands.server.ts";
const REGISTRY = "src/features/heby-commands/registry.ts";
const WORK_ACTIONS = "src/app/(dashboard)/director/work/actions.ts";

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
  const graph = closure(SUBJECT_READ);

  /* ── 1 · IT REACHES THE LEDGER, AND THE OBSERVER REACHES IT ──────────────── */
  {
    assert.ok(graph.has("src/db/schema/audit-log.ts"), "the subject read reaches the ledger");
    assert.ok(
      closure(OBSERVE).has(SUBJECT_READ),
      "and the observation reaches the subject read",
    );
  }

  /* ── 2 · IT REACHES NO WRITER OF ANY KIND ────────────────────────────────
   * The same banned roots R7.1.1 pins, for the same reason: `governance-audit/*` MIXES reads and
   * writes, so a file importing one holds a reference into a module that can APPEND to the ledger.
   * A reader over the record must not be able to become an author of it.
   */
  {
    const bannedRoots = [
      "src/features/governance-audit/",
      "src/features/governance-decision/",
      "src/features/knowledge/",
      "src/features/knowledge-ratification/",
      "src/features/organizational-work/",
      "src/features/action-authorization/",
      "src/features/action-execution/",
      "src/features/integration-credentials/",
      "src/features/provider-github/",
      "src/features/provider-google/",
      "src/features/heby-model/",
      "src/features/heby-model-live/",
      "src/features/agent-origination/",
    ];
    for (const file of graph) {
      for (const root of bannedRoots) {
        assert.ok(!file.startsWith(root), `the subject read must not reach ${file}`);
      }
    }
  }

  /* ── 2b · NO SECOND ACT SINK ─────────────────────────────────────────────
   * `event_log` is reachable through the schema barrel from EVERY module that can open a database,
   * so "unreachable" would be a lie. The honest guarantee is that no statement in this phase names
   * it, and that is what is asserted.
   */
  {
    for (const file of [SUBJECT_READ, OBSERVE]) {
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
        assert.ok(
          !forbidden.test(code),
          `${file} must not match ${forbidden} — the subject history is a reader`,
        );
      }
      for (const raw of [
        /insert\s+into/i,
        /update\s+[a-z_"]+\s+set/i,
        /delete\s+from/i,
        /truncate\s+table/i,
      ]) {
        assert.ok(!raw.test(code), `${file} must not carry raw SQL matching ${raw}`);
      }
    }
  }

  /* ── 4 · THE SELECT LIST IS THE SECURITY BOUNDARY, AND entity_id IS ONLY A FILTER ── */
  {
    const code = codeOf(read(SUBJECT_READ));

    /* The select list, isolated: everything between `.select({` and its closing `})`. */
    const selects = [...code.matchAll(/\.select\(\{([\s\S]*?)\}\)/g)].map((match) => match[1]!);
    assert.ok(selects.length >= 2, "the reader issues a total and a page, each with a select list");

    for (const list of selects) {
      for (const column of WITHHELD_AUDIT_COLUMNS) {
        assert.ok(
          !new RegExp(`auditLog\\.${column}\\b`).test(list),
          `no select list may name auditLog.${column}`,
        );
      }
    }

    /*
     * AND THE PREDICATE MUST STILL HAVE IT. Without this the phase could pass §4 by deleting the
     * subject filter entirely and answering every question with the tenant's whole ledger.
     */
    const where = /const subjectScope = and\(([\s\S]*?)\);/.exec(code)?.[1] ?? "";
    assert.ok(where.includes("auditLog.tenantId"), "the scope pins the tenant");
    assert.ok(where.includes("auditLog.entityType"), "and the entity type");
    assert.ok(where.includes("auditLog.entityId"), "and the entity id");
    assert.equal(
      (code.match(/subjectScope/g) ?? []).length,
      3,
      "ONE scope expression, used by both statements — deleting it breaks the page and the total together",
    );
  }

  /* ── 5 · NO MODEL, ANYWHERE IN THE GRAPH ─────────────────────────────────
   * Nothing here is summarized, classified, or explained by a model. An act is reported verbatim
   * or not at all.
   */
  {
    for (const file of graph) {
      const code = codeOf(read(file));
      for (const forbidden of ["generateHebyModelAnswer", "anthropic", "selectModelTransport"]) {
        assert.ok(!code.includes(forbidden), `${file} must not name "${forbidden}"`);
      }
    }
  }

  /* ── 6 · THE THREE VOCABULARIES AGREE ────────────────────────────────────
   * The registry pattern, the contract map and the Work surface must name the SAME kinds. Two
   * spellings of one subject is how a surface comes to read a population its own filter excluded.
   */
  {
    const registry = codeOf(read(REGISTRY));
    const kinds = Object.keys(ACT_SUBJECT_REFERENCE_KINDS);
    const pattern = /\/\^\((work-item[^)]*)\)\\\//.exec(registry)?.[1] ?? "";
    assert.ok(pattern.length > 0, "the /audit subject pattern is present in the registry");
    assert.deepEqual(
      pattern.split("|").sort(),
      [...kinds].sort(),
      "the registry pattern admits exactly the reference kinds the contract maps",
    );

    const workActions = codeOf(read(WORK_ACTIONS));
    assert.ok(
      workActions.includes(`ACT_SUBJECT_REFERENCE_KINDS["work-item"]`),
      "the Work surface takes its entity type from the contract map, never from a literal",
    );
    assert.ok(
      !/entityType:\s*"work_item"/.test(workActions),
      "and does not spell the entity type a second time",
    );
  }

  /* ── 7 · THE SUBJECT BRANCH REFUSES; IT NEVER WIDENS ─────────────────────
   * A subject that fails to resolve must not fall through to the tenant-wide history. Answering a
   * question about one thing with a page about everything is the failure mode this pins.
   */
  {
    const code = codeOf(read(READ_COMMANDS));
    const auditSubject = /async function auditSubject\(([\s\S]*?)\n\}/.exec(code)?.[1] ?? "";
    assert.ok(auditSubject.length > 0, "the subject handler is present");
    assert.ok(
      !auditSubject.includes("observeRecordedActHistory") &&
        !auditSubject.includes("readActHistory"),
      "the subject handler never reaches the tenant-wide history",
    );
    assert.ok(
      auditSubject.includes("NOTHING WAS READ"),
      "an unaddressable subject says nothing was read",
    );
  }

  console.log("subject-act-history-flow/subject-firewall: OK");
}

main();
