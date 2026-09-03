/*
 * PBGA-1 — THE PURPOSE FIREWALL.
 *
 * Structural. Walks real source and the real import graph, and pins the three boundaries this
 * capability must never cross:
 *
 *   1. AN AGENT CANNOT DECLARE ORGANIZATIONAL PURPOSE — at the public writer's SHAPE, and again at
 *      the storage constraint. Two independent mechanisms, because one of them is a call signature
 *      a refactor could widen and the other is a database CHECK it cannot.
 *   2. PURPOSE IS NOT EVIDENCE — the declaration path never touches the evidence collection, and
 *      the preparer's sufficiency and freshness logic never reads a purpose column.
 *   3. THE DECLARATION IS NOT A DECISION — the writer reaches no decision writer, no permit writer,
 *      no executor, no provider and no Work writer.
 *
 * Nothing here opens a database, contacts anything, or runs a command.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const read = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const DECLARE = "src/features/action-authorization/declare-action-purpose.server.ts";
const RECORD = "src/features/action-authorization/record-action-request.server.ts";
const INVERSE = "src/features/action-authorization/read-work-purpose-requests.server.ts";
const SCHEMA = "src/db/schema/action-authorization.ts";
const PREPARER = "src/features/heby-actions/action-preparer.ts";
const MIGRATION = "src/db/migrations/20260902212106_pbga1_action_request_work_purpose.sql";
const APPROVAL_READ = "src/features/action-authorization/read-action-authorizations.server.ts";

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
  /* ── 1a · THE AGENT FIREWALL AT THE PUBLIC WRITER SHAPE ──────────────────
   * The human entry point takes a purpose; the agent one has no parameter for it at all. A caller
   * cannot pass what a signature does not accept.
   */
  {
    const code = codeOf(read(RECORD));
    const human = /export function recordActionRequest\(([\s\S]*?)\): Promise/.exec(code)?.[1] ?? "";
    const agent =
      /export async function recordAgentOriginatedActionRequest\(([\s\S]*?)\): Promise/.exec(
        code,
      )?.[1] ?? "";
    assert.ok(human.length > 0 && agent.length > 0, "both public entry points are present");
    assert.ok(
      human.includes("purposeWorkItemId"),
      "the HUMAN entry point may declare a purpose",
    );
    assert.ok(
      !agent.includes("purposeWorkItemId"),
      "the AGENT entry point has no purpose parameter — the firewall is the call shape",
    );

    /* And the agent path's call into the shared insert must not smuggle one positionally. */
    const agentBody =
      /export async function recordAgentOriginatedActionRequest\([\s\S]*?\n\}/.exec(code)?.[0] ?? "";
    assert.ok(
      /return insertActionRequest\(tenant, prepared, pair, deps, originationInvocationId\);/.test(
        agentBody,
      ),
      "the agent path passes exactly five arguments — no sixth, and no purpose",
    );
  }

  /* ── 1b · AND AGAIN AT THE STORAGE CONSTRAINT ───────────────────────────
   * A signature is a convention a refactor can widen. The CHECK is a mechanism it cannot.
   */
  {
    const schema = read(SCHEMA);
    assert.ok(
      schema.includes("heby_action_requests_human_purpose_declarer_chk"),
      "the human-declarer CHECK exists in the schema",
    );
    const migration = read(MIGRATION);
    assert.ok(
      /heby_action_requests_human_purpose_declarer_chk[\s\S]*?= 'human'/.test(migration),
      "and it is in the migration that ships it",
    );
    assert.ok(
      /heby_action_requests_purpose_chk/.test(migration),
      "as is the all-or-nothing declaration CHECK",
    );
    assert.ok(
      /ON DELETE restrict/.test(migration),
      "and the Work foreign key restricts — a deletion may not rewrite authorization history",
    );
    assert.ok(
      !/\bDROP\b|\bTRUNCATE\b|\bDELETE FROM\b/i.test(migration),
      "the migration is additive: no DROP, no TRUNCATE, no DELETE",
    );
  }

  /* ── 2 · PURPOSE IS NOT EVIDENCE ────────────────────────────────────────
   * The declaration writer never names the evidence column, and the preparer — which owns evidence
   * sufficiency and freshness — never names a purpose column. Two directions, both pinned.
   */
  {
    const declare = codeOf(read(DECLARE));
    for (const forbidden of ["evidence", "evidenceSufficient", "freshness"]) {
      assert.ok(
        !declare.includes(forbidden),
        `the declaration writer must not name "${forbidden}" — purpose is not evidence`,
      );
    }
    const preparer = codeOf(read(PREPARER));
    for (const forbidden of ["purposeWorkItemId", "purpose_work_item_id", "purposeDeclared"]) {
      assert.ok(
        !preparer.includes(forbidden),
        `the preparer must not name "${forbidden}" — a purpose may not affect sufficiency`,
      );
    }
  }

  /* ── 3 · A DECLARATION IS NOT A DECISION ────────────────────────────────
   * The writer's real import graph reaches no decision writer, no permit writer, no executor, no
   * provider and no Work writer. It writes exactly two things: the request row and its audit row.
   */
  {
    const graph = closure(DECLARE);
    const banned = [
      "src/features/action-execution/",
      "src/features/action-execution-live/",
      "src/features/provider-github/",
      "src/features/provider-google/",
      "src/features/heby-model/",
      "src/features/heby-model-live/",
      "src/features/agent-origination/",
      "src/features/organizational-work/write-work.server.ts",
    ];
    for (const file of graph) {
      for (const root of banned) {
        assert.ok(!file.startsWith(root), `the declaration writer must not reach ${file}`);
      }
    }

    const declare = codeOf(read(DECLARE));
    /* It updates the request and inserts through the released audit seam. Nothing else. */
    assert.equal(
      (declare.match(/\.update\(/g) ?? []).length,
      1,
      "exactly one update — the request row",
    );
    assert.equal((declare.match(/\.insert\(/g) ?? []).length, 0, "and no insert of its own");
    assert.ok(
      declare.includes("recordActionAuthorizationEventWithin"),
      "the audit row goes through the RELEASED Action Authorization audit seam",
    );
    assert.equal((declare.match(/\.delete\(/g) ?? []).length, 0, "and it deletes nothing");

    /* The pre-decision predicate is the released `pending`, in the UPDATE's own WHERE clause. */
    assert.ok(
      /eq\(hebyActionRequests\.status, "pending"\)/.test(declare),
      "the pre-decision predicate is in the statement, not in a prior read",
    );
    assert.ok(
      /isNull\(hebyActionRequests\.purposeWorkItemId\)/.test(declare),
      "and so is the unbound predicate that makes rebinding impossible to race",
    );
  }

  /* ── 4 · THE INVERSE READ PROJECTS NOTHING PRIVATE ──────────────────────── */
  {
    const inverse = codeOf(read(INVERSE));
    for (const forbidden of ["canonicalPayload", "evidence", "payloadDigest", "proposedByActorId"]) {
      assert.ok(
        !inverse.includes(forbidden),
        `the inverse read must never select ${forbidden}`,
      );
    }
    assert.ok(/\.limit\(/.test(inverse), "and it is bounded");
    for (const forbidden of [/\.insert\(/, /\.update\(/, /\.delete\(/]) {
      assert.ok(!forbidden.test(inverse), `the inverse read must not match ${forbidden}`);
    }
  }

  /* ── 4b · THE APPROVAL READ REACHES ONE DATABASE, NOT TWO ────────────────
   * It shipped resolving the work title through `readWorkRegister(tenant)` while its own query
   * honoured `deps.getDb`. A caller that injected a database therefore got its requests from the
   * injected handle and its titles from whatever the default resolver found — and a purpose that
   * was declared and resolvable came back as `purposeUnresolved: true`. An UNKNOWN manufactured by
   * the seam is exactly the class of untruth this capability exists to avoid.
   */
  {
    const approvalRead = codeOf(read(APPROVAL_READ));
    assert.ok(
      /readWorkRegister\(tenant, \{ getDb: deps\.getDb \}\)/.test(approvalRead),
      "the register read forwards the injected database, so one call reaches one database",
    );
    assert.ok(
      !/readWorkRegister\(tenant\)/.test(approvalRead),
      "and never calls it with the tenant alone",
    );
  }

  /* ── 5 · THE TWO WORK SECTIONS STAY SEPARATE ────────────────────────────
   * Recorded activity and governed actions are read by DIFFERENT actions reaching DIFFERENT
   * authorities. A single feed would invent one timeline neither authority can support.
   */
  {
    const surface = codeOf(read("src/components/organizational-work/work-register.tsx"));
    assert.ok(surface.includes("RecordedActivitySection"), "recorded activity is its own section");
    assert.ok(surface.includes("GovernedActionsSection"), "governed actions is its own section");
    assert.ok(
      surface.includes("readWorkItemActHistoryAction") &&
        surface.includes("readWorkItemGovernedActionsAction"),
      "and each reads through its own action",
    );
    const actions = codeOf(read("src/app/(dashboard)/director/work/actions.ts"));
    assert.ok(
      actions.includes("observeSubjectActHistory") &&
        actions.includes("readGovernedActionsForWork"),
      "which reach two different authorities",
    );
  }

  console.log("pbga1-purpose-bound-act/purpose-firewall: OK");
}

main();
