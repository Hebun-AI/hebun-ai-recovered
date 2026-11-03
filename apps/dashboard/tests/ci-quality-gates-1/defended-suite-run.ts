/*
 * DEFENDED SUITE RUN — SELF-TEST (Package 3 M2-R9F).
 *
 * The watchdog in tests/helpers/defended-suite-run.ts decides whether a bite-proof's child passed,
 * failed or hung. It is proved here on synthetic children with short timeouts, never on a real
 * suite: pass, fail, hang (with and without a report), a child that ignores SIGTERM, what reaches
 * the output, that every child is gone and every temporary directory removed, and that the real
 * 300-second contract is the one the bite-proofs use.
 *
 * The children are written to a private temporary directory at run time and removed at the end.
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFENDED_SUITE_TIMEOUT_MS,
  describeDiagnostic,
  runDefendedSuite,
  type DefendedSuiteRun,
} from "../helpers/defended-suite-run";

const ROOT = process.cwd();
const SENTINEL = "m2r9f-sentinel-7c41d0";
const SHORT = { timeoutMs: 1_500, reportWaitMs: 3_000, graceMs: 1_000 } as const;

const fixtures = mkdtempSync(path.join(os.tmpdir(), "defended-suite-selftest-"));

/* Each child records its own pid and the mode of the report directory it was handed. */
const PRELUDE = `
import { statSync, writeFileSync } from "node:fs";
const dirArg = process.execArgv.find((a) => a.startsWith("--report-directory="));
const mode = dirArg ? (statSync(dirArg.slice("--report-directory=".length)).mode & 0o777).toString(8) : "none";
writeFileSync(process.env.FIXTURE_RECORD, JSON.stringify({ pid: process.pid, mode }));
`;

const CHILDREN: Record<string, string> = {
  pass: `${PRELUDE}\nconsole.log("child pass");\n`,
  fail: `${PRELUDE}\nconsole.error("child failed for the intended reason");\nprocess.exit(1);\n`,
  hang: `${PRELUDE}\nconsole.log("child hanging");\nsetInterval(() => {}, 1000);\n`,
  spin: `${PRELUDE}\nconsole.log("child spinning");\nfor (;;) {}\n`,
  graceful: `${PRELUDE}\nprocess.on("SIGTERM", () => process.exit(0));\nconsole.log("child exits 0 when asked");\nsetInterval(() => {}, 1000);\n`,
  stubborn: `${PRELUDE}\nprocess.on("SIGTERM", () => {});\nconsole.log("child ignores SIGTERM");\nsetInterval(() => {}, 1000);\n`,
};

function tempDirsNow(): string[] {
  return readdirSync(os.tmpdir()).filter((name) => name.startsWith("defended-suite-") && !name.startsWith("defended-suite-selftest-"));
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

async function run(name: string, short = true): Promise<{ run: DefendedSuiteRun; pid: number; mode: string }> {
  const file = path.join(fixtures, `${name}.mjs`);
  const record = path.join(fixtures, `${name}.record.json`);
  writeFileSync(file, CHILDREN[name], "utf8");
  const before = tempDirsNow();
  const result = await runDefendedSuite(file, {
    cwd: ROOT,
    env: { ...process.env, FIXTURE_RECORD: record, SECRET_FOR_TEST: SENTINEL },
    ...(short ? SHORT : {}),
  });
  const leftover = tempDirsNow().filter((d) => !before.includes(d));
  assert.deepEqual(leftover, [], `${name}: the temporary report directory must be removed`);
  const { pid, mode } = JSON.parse(readFileSync(record, "utf8")) as { pid: number; mode: string };
  assert.equal(alive(pid), false, `${name}: the child must not outlive the run`);
  assert.equal(mode, "700", `${name}: the report directory must be 0700`);
  return { run: result, pid, mode };
}

/* Nothing in the returned values may carry a path, the sentinel, or Node's report notice. */
function assertClosed(name: string, result: DefendedSuiteRun): void {
  const metadata = JSON.stringify(result.diagnostic) + describeDiagnostic(result);
  assert.ok(!metadata.includes("/"), `${name}: diagnostic metadata must not contain a path`);
  assert.ok(!metadata.includes(SENTINEL), `${name}: diagnostic metadata must not contain environment values`);
  assert.ok(!metadata.includes(fixtures), `${name}: diagnostic metadata must not name the fixture`);
  assert.ok(!result.output.includes("Node.js report"), `${name}: Node's report notice must not reach the output`);
  assert.ok(!result.output.includes(os.tmpdir()), `${name}: no temporary path in the output`);
  assert.deepEqual(Object.keys(result.diagnostic).sort(), ["handles", "jsFrames", "status", "workers"]);
}

async function main(): Promise<void> {
  /* 10. The real contract. */
  assert.equal(DEFENDED_SUITE_TIMEOUT_MS, 300_000, "the defending suite timeout stays at 300 seconds");
  for (const file of ["tests/live-map-experience/bite-proofs.ts", "tests/tb1-trust-boundary/bite-proofs.ts"]) {
    const source = readFileSync(path.join(ROOT, file), "utf8");
    assert.ok(source.includes("runDefendedSuite("), `${file} runs its suites through the watchdog`);
    assert.ok(!/timeoutMs|reportWaitMs|graceMs/.test(source), `${file} must not override the watchdog timings`);
    assert.ok(!source.includes("spawnSync"), `${file} must not keep a second, unguarded runner`);
  }
  console.log("ok 10 the 300-second contract is the one the bite-proofs use");

  /* 1. Normal child passes. */
  const pass = await run("pass");
  assert.equal(pass.run.ok, true, describeDiagnostic(pass.run));
  assert.equal(pass.run.timedOut, false);
  assert.equal(pass.run.ended, "exit");
  assert.equal(pass.run.cleanupComplete, true);
  assert.equal(pass.run.diagnostic.status, "not-requested");
  assert.ok(pass.run.output.includes("child pass"));
  assertClosed("pass", pass.run);
  console.log("ok 1 a passing child is a pass");

  /* 2. Normal child fails, and its output is kept for the intended-reason check. */
  const fail = await run("fail");
  assert.equal(fail.run.ok, false);
  assert.equal(fail.run.timedOut, false);
  assert.equal(fail.run.ended, "exit");
  assert.ok(fail.run.output.includes("child failed for the intended reason"));
  assertClosed("fail", fail.run);
  console.log("ok 2 a failing child is a failure with its output");

  /* 3, 4, 5, 6, 7, 8. A hanging child: timed out, never a pass, report reduced to metadata, child gone. */
  const hang = await run("hang");
  assert.equal(hang.run.timedOut, true);
  assert.equal(hang.run.ok, false, "a timeout is never a pass");
  assert.equal(hang.run.diagnostic.status, "written", describeDiagnostic(hang.run));
  assert.ok((hang.run.diagnostic.handles.timer ?? 0) >= 1, `the interval keeping it alive is named: ${describeDiagnostic(hang.run)}`);
  assert.equal(typeof hang.run.diagnostic.jsFrames, "number");
  assert.equal(hang.run.ended, "sigterm");
  assert.equal(hang.run.cleanupComplete, true);
  assert.ok(hang.run.output.includes("child hanging"), "the child's own output is kept");
  assertClosed("hang", hang.run);
  console.log(`ok 3-8 a hanging child times out as a failure: ${describeDiagnostic(hang.run)}`);

  /* 9. No report can be produced: a child spinning in synchronous code never runs the handler. */
  const spin = await run("spin");
  assert.equal(spin.run.timedOut, true);
  assert.equal(spin.run.ok, false);
  assert.equal(spin.run.diagnostic.status, "absent", describeDiagnostic(spin.run));
  assert.deepEqual(spin.run.diagnostic.handles, {});
  assert.equal(spin.run.ended, "sigterm");
  assert.equal(spin.run.cleanupComplete, true);
  assertClosed("spin", spin.run);
  console.log(`ok 9 no report is reported as absent and the child is still stopped: ${describeDiagnostic(spin.run)}`);

  /* 4. A child that times out and then exits 0 on SIGTERM is still a failure. */
  const graceful = await run("graceful");
  assert.equal(graceful.run.timedOut, true);
  assert.equal(graceful.run.ok, false, "exit 0 after a timeout is never a pass");
  assert.equal(graceful.run.ended, "sigterm");
  assertClosed("graceful", graceful.run);
  console.log(`ok 4 exit 0 after a timeout is a failure: ${describeDiagnostic(graceful.run)}`);

  /* 7. Escalation: a child that ignores SIGTERM is stopped by SIGKILL. */
  const stubborn = await run("stubborn");
  assert.equal(stubborn.run.timedOut, true);
  assert.equal(stubborn.run.ok, false);
  assert.equal(stubborn.run.ended, "sigkill");
  assert.equal(stubborn.run.cleanupComplete, true);
  assertClosed("stubborn", stubborn.run);
  console.log(`ok 7 a child ignoring SIGTERM is killed: ${describeDiagnostic(stubborn.run)}`);

  console.log("ci-quality-gates-1/defended-suite-run: ok");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    rmSync(fixtures, { recursive: true, force: true });
  });
