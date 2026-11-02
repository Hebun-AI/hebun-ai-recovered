/*
 * SCAN-FAILURE-LEGIBILITY-1 — bite proofs. Each guard is removed in turn; the suite that owns it must
 * fail for the intended reason. A survivor is a guard that protects nothing.
 *
 * SOURCE-MUTATING: run only in a disposable detached worktree or scratch copy, never in a tree with
 * work in it. Every file is restored byte-identically.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const UNIT = "tests/scan-failure-legibility-1/classifier-and-contracts.ts";
const PG = "tests/scan-failure-legibility-1/routes-postgres.ts";
const REPORT = "tests/scan-failure-legibility-1/tick-report.ts";
const CLASSIFIER = "src/features/cron-scan-warning/classify-persistence-failure.ts";
const HELPER = "src/features/cron-scan-warning/warn-unsuccessful-scan.ts";
const DELIVERY_READER = "src/features/action-authorization/read-machine-deliverable-permits.server.ts";
const ISSUANCE_ROUTE = "src/app/api/standing-issuance/scan/route.ts";
const SCRIPT = "scripts/ops/scan-tick-report.mts";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;

const once = (find: string, replace: string) => (text: string) => {
  assert.equal(text.split(find).length - 1, 1, `find-string must occur exactly once: ${find.slice(0, 90)}`);
  return text.replace(find, replace);
};

const MUTATIONS: readonly { label: string; file: string; suite: string; apply: (t: string) => string; expect: RegExp }[] = [
  {
    label: "S1 the classifier stops following the cause chain",
    file: CLASSIFIER,
    suite: UNIT,
    apply: once(`    current = (current as { readonly cause?: unknown }).cause;`, `    break;`),
    expect: /drizzle wrapping a refused login/,
  },
  {
    label: "S2 the warning line writes the cause it was handed",
    file: HELPER,
    suite: UNIT,
    apply: once(`    const cause = loggableCause(report.cause);`, `    const cause = report.cause;`),
    expect: /a cause outside the closed set is written as unknown/,
  },
  {
    label: "S3 a reader drops the classification",
    file: DELIVERY_READER,
    suite: UNIT,
    apply: once(`cause: classifyPersistenceFailure(error) };`, `cause: "unknown" };`),
    expect: /machine-delivery: connection/,
  },
  {
    label: "S4 a route puts the cause in the response body",
    file: ISSUANCE_ROUTE,
    suite: PG,
    apply: once(
      `return Response.json({ status: result.status, reason: result.reason }, { status: 503 });`,
      `return Response.json({ status: result.status, reason: result.reason, cause: result.cause }, { status: 503 });`,
    ),
    expect: /standing-issuance: body byte-identical/,
  },
  {
    label: "S5 the report treats a missing tick as healthy",
    file: SCRIPT,
    suite: REPORT,
    apply: once(`  if (hit.length === 0) return { state: "missing" };`, `  if (hit.length === 0) return { state: "ok" };`),
    expect: /a missing tick is named/,
  },
  {
    label: "S6 the report judges hours the input does not cover",
    file: SCRIPT,
    suite: REPORT,
    apply: once(
      `    const covered = seen.every((t) => t.state !== "missing") || (oldest <= tick && newest >= tick + TICK_WINDOW_MS);`,
      `    const covered = true;`,
    ),
    expect: /empty input is UNAVAILABLE, never healthy/,
  },
  {
    label: "S7 the report counts an SSL notice on a failed tick as noise",
    file: SCRIPT,
    suite: REPORT,
    apply: once(`if (message.includes(SSL_NOTICE) && row.responseStatusCode === 200) sslNotices += 1;`, `if (message.includes(SSL_NOTICE)) sslNotices += 1;`),
    expect: /an SSL notice on a 503 is not counted as noise/,
  },
];

function run(suite: string) {
  const r = spawnSync(process.execPath, ["--import", "tsx", suite], { cwd: ROOT, encoding: "utf8", env: process.env, maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS });
  return { ok: r.status === 0, output: `${r.stdout ?? ""}${r.stderr ?? ""}`, timedOut: r.signal === "SIGTERM" && r.status === null };
}

function main(): void {
  for (const s of [UNIT, PG, REPORT]) {
    const base = run(s);
    assert.equal(base.ok, true, `baseline ${s} must pass before any mutation:\n${base.output.slice(-2000)}`);
  }
  for (const m of MUTATIONS) {
    const file = path.join(ROOT, m.file);
    const original = readFileSync(file);
    const text = original.toString("utf8");
    try {
      writeFileSync(file, m.apply(text));
      assert.notEqual(readFileSync(file, "utf8"), text, `${m.label}: mutation reached disk`);
      const r = run(m.suite);
      assert.equal(r.timedOut, false, `${m.label}: TIMED OUT — a VOID result, not a bite`);
      assert.equal(r.ok, false, `${m.label}: the mutation SURVIVED`);
      assert.match(r.output, m.expect, `${m.label}: failed, but not for the intended reason:\n${r.output.slice(-1500)}`);
      console.log(`BITE ${m.label}`);
    } finally {
      writeFileSync(file, original);
      assert.ok(readFileSync(file).equals(original), `${m.label}: restoration is byte-identical`);
    }
  }
  console.log(`scan-failure-legibility-1/bite-proofs: ${MUTATIONS.length} mutations bit`);
}

main();
