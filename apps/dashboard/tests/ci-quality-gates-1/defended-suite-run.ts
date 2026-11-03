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
 *
 * M2-R9P adds the Linux /proc view. Its logic (identity, parsing, classes, fallbacks) is proved on a
 * synthetic /proc tree on every platform; the kernel's real answers for a spinning, idle,
 * Atomics.wait-blocked and child-waiting process are proved only where /proc exists, and every other
 * platform prints an explicit SKIP for them instead of passing them.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  DEFENDED_SUITE_TIMEOUT_MS,
  classifyChild,
  classifyWchan,
  describeDiagnostic,
  readProcDiagnostic,
  readProcIdentity,
  runDefendedSuite,
  type DefendedSuiteRun,
} from "../helpers/defended-suite-run";

const ROOT = process.cwd();
const SENTINEL = "m2r9f-sentinel-7c41d0";
const SHORT = { timeoutMs: 1_500, reportWaitMs: 3_000, graceMs: 1_000 } as const;

const fixtures = mkdtempSync(path.join(os.tmpdir(), "defended-suite-selftest-"));
const LINUX = process.platform === "linux";
/* Grandchildren the fixtures start record their pid here, so the test can stop what it started. */
const GRANDCHILD = `require("node:fs").writeFileSync(process.env.GRANDCHILD_RECORD, String(process.pid)); setTimeout(() => {}, 60000);`;

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
  atomics: `${PRELUDE}\nconsole.log("child blocks in Atomics.wait");\nAtomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);\n`,
  syncwait: `${PRELUDE}\nimport { execFileSync } from "node:child_process";\nconsole.log("child waits on a child");\nexecFileSync(process.execPath, ["-e", ${JSON.stringify(GRANDCHILD)}]);\n`,
  abandon: `${PRELUDE}\nimport { spawn } from "node:child_process";\nspawn(process.execPath, ["-e", ${JSON.stringify(GRANDCHILD)}], { stdio: ["ignore", "inherit", "inherit"] }).unref();\nconsole.log("child leaves a descendant on its stdio");\n`,
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

/* Stops a grandchild a fixture started, by the pid it recorded itself. Returns whether it was alive. */
async function stopGrandchild(name: string): Promise<boolean> {
  const record = path.join(fixtures, `${name}.grandchild`);
  for (let i = 0; i < 40 && !existsSync(record); i++) await new Promise((r) => setTimeout(r, 50));
  if (!existsSync(record)) return false;
  const pid = Number(readFileSync(record, "utf8"));
  const wasAlive = alive(pid);
  if (wasAlive) process.kill(pid, "SIGKILL");
  for (let i = 0; i < 40 && alive(pid); i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(alive(pid), false, `${name}: the fixture's grandchild is stopped`);
  return wasAlive;
}

async function run(name: string, short = true): Promise<{ run: DefendedSuiteRun; pid: number; mode: string }> {
  const file = path.join(fixtures, `${name}.mjs`);
  const record = path.join(fixtures, `${name}.record.json`);
  writeFileSync(file, CHILDREN[name], "utf8");
  const before = tempDirsNow();
  const result = await runDefendedSuite(file, {
    cwd: ROOT,
    env: { ...process.env, FIXTURE_RECORD: record, SECRET_FOR_TEST: SENTINEL, GRANDCHILD_RECORD: path.join(fixtures, `${name}.grandchild`) },
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
  const metadata = JSON.stringify(result.diagnostic) + JSON.stringify(result.proc) + describeDiagnostic(result);
  assert.ok(!metadata.includes("/"), `${name}: diagnostic metadata must not contain a path`);
  assert.ok(!metadata.includes(SENTINEL), `${name}: diagnostic metadata must not contain environment values`);
  assert.ok(!metadata.includes(fixtures), `${name}: diagnostic metadata must not name the fixture`);
  assert.ok(!result.output.includes("Node.js report"), `${name}: Node's report notice must not reach the output`);
  assert.ok(!result.output.includes(os.tmpdir()), `${name}: no temporary path in the output`);
  assert.deepEqual(Object.keys(result.diagnostic).sort(), ["handles", "jsFrames", "status", "workers"]);
  assert.deepEqual(Object.keys(result.proc).sort(), ["childTypes", "children", "cpuMs", "state", "status", "threadStates", "threads", "wchan"]);
  if (result.proc.status === "read") {
    for (const k of Object.keys(result.proc.childTypes)) assert.ok(["node", "esbuild", "python", "postgres", "shell", "other"].includes(k), `${name}: child class ${k}`);
    for (const k of Object.keys(result.proc.threadStates)) assert.ok(["R", "S", "D", "Z", "T", "other"].includes(k), `${name}: thread state ${k}`);
  }
}

/* ── A synthetic /proc tree: the logic, on every platform. ── */
function statLine(pid: number, comm: string, state: string, ppid: number, ticks: number, threads: number, start: string): string {
  /* Fields 3..22 of proc(5): state ppid pgrp session tty tpgid flags minflt cminflt majflt cmajflt
     utime stime cutime cstime priority nice num_threads itrealvalue starttime, then more. */
  return `${pid} (${comm}) ${state} ${ppid} 1 1 0 -1 0 0 0 0 0 ${ticks} 0 0 0 20 0 ${threads} 0 ${start} 0 0\n`;
}

async function syntheticProc(): Promise<void> {
  const root = mkdtempSync(path.join(fixtures, "proc-"));
  const pid = 4242;
  const write = (rel: string, text: string) => {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  };
  const seed = () => {
    rmSync(path.join(root, String(pid)), { recursive: true, force: true });
    /* A name with spaces and parentheses: comm ends at the LAST ")". */
    write(`${pid}/stat`, statLine(pid, "node (x) y", "S", process.pid, 100, 3, "777"));
    write(`${pid}/wchan`, "futex_wait_queue");
    write(`${pid}/task/${pid}/stat`, statLine(pid, "node", "R", process.pid, 0, 3, "777"));
    write(`${pid}/task/4243/stat`, statLine(4243, "V8 Worker", "S", process.pid, 0, 3, "777"));
    write(`${pid}/task/4244/stat`, statLine(4244, "libuv-worker", "S", process.pid, 0, 3, "777"));
    write(`${pid}/task/${pid}/children`, "5001 5002 ");
    write(`5001/stat`, statLine(5001, "esbuild", "S", pid, 0, 1, "800"));
    /* Listed, but its parent is not our child: never counted. */
    write(`5002/stat`, statLine(5002, "python3", "S", 1, 0, 1, "801"));
  };
  seed();

  const identity = readProcIdentity(pid, root);
  assert.deepEqual(identity, { pid, ppid: process.pid, startTime: "777" }, "identity is start time and parent");
  /* CPU used during the window: 30 ticks of USER_HZ is 300 ms. */
  setTimeout(() => write(`${pid}/stat`, statLine(pid, "node (x) y", "S", process.pid, 130, 3, "777")), 50);
  const read = await readProcDiagnostic(identity, { root, windowMs: 200 });
  assert.deepEqual(read, {
    status: "read", state: "S", cpuMs: 300, threads: 3, threadStates: { R: 1, S: 2 }, wchan: "futex", children: 1, childTypes: { esbuild: 1 },
  });
  assert.ok(!JSON.stringify(read).includes("node (x)") && !JSON.stringify(read).includes("futex_wait"), "no raw name or symbol");

  /* Identity mismatch: a recycled pid with another start time, or another parent. */
  write(`${pid}/stat`, statLine(pid, "node", "S", process.pid, 130, 3, "999"));
  assert.equal((await readProcDiagnostic(identity, { root, windowMs: 1 })).status, "identity-mismatch");
  write(`${pid}/stat`, statLine(pid, "node", "S", 1, 130, 3, "777"));
  assert.equal((await readProcDiagnostic(identity, { root, windowMs: 1 })).status, "identity-mismatch");
  assert.equal(readProcIdentity(pid, root), null, "a process that is not our child has no identity");
  assert.equal((await readProcDiagnostic(null)).status, "unavailable", "no identity is unavailable, never a guess");

  /* Exited: gone, or a zombie. */
  write(`${pid}/stat`, statLine(pid, "node", "Z", process.pid, 130, 1, "777"));
  assert.equal((await readProcDiagnostic(identity, { root, windowMs: 1 })).status, "exited");
  rmSync(path.join(root, String(pid)), { recursive: true });
  assert.equal((await readProcDiagnostic(identity, { root, windowMs: 1 })).status, "exited");

  /* Unreadable: malformed stat, or no /proc at all. */
  write(`${pid}/stat`, "garbage");
  assert.equal((await readProcDiagnostic(identity, { root, windowMs: 1 })).status, "unavailable");
  assert.equal(readProcIdentity(pid, path.join(root, "absent")), null);

  /* No children file: the count is unknown, not zero. No wchan file: unknown. */
  seed();
  rmSync(path.join(root, `${pid}/task/${pid}/children`));
  rmSync(path.join(root, `${pid}/wchan`));
  const partial = await readProcDiagnostic(identity, { root, windowMs: 1 });
  assert.equal(partial.children, null);
  assert.equal(partial.wchan, "unknown");

  for (const [symbol, state, expected] of [
    ["futex_wait_queue", "S", "futex"], ["pipe_read", "S", "pipe"], ["do_epoll_wait", "S", "poll"], ["ep_poll", "S", "poll"],
    ["do_wait", "S", "wait"], ["hrtimer_nanosleep", "S", "sleep"], ["io_schedule", "D", "io"], ["0", "R", "running"],
    ["0", "S", "unknown"], ["", "S", "unknown"], ["something_new", "S", "other"],
  ] as const) assert.equal(classifyWchan(symbol, state), expected, `wchan ${symbol}/${state}`);
  assert.equal(classifyWchan(null, "R"), "unknown");
  for (const [comm, expected] of [["node", "node"], ["esbuild", "esbuild"], ["python3", "python"], ["postgres", "postgres"], ["bash", "shell"], ["ffprobe", "other"]] as const) {
    assert.equal(classifyChild(comm), expected, `child ${comm}`);
  }
  console.log("ok P1-P6 synthetic /proc: identity, CPU window, threads, wchan and child classes, mismatch, exited, unavailable");
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

  /* ── M2-R9P ── */
  /* Code, not comments: the header may name what is never read. */
  const helper = readFileSync(path.join(ROOT, "tests/helpers/defended-suite-run.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  for (const forbidden of ["cmdline", "environ", "/fd", "maps"]) {
    assert.ok(!helper.includes(forbidden), `the watchdog never reads ${forbidden}`);
  }
  await syntheticProc();

  /* Stdio abandonment: the child exits 0, a descendant keeps its stdout. Reported, not judged. */
  const abandon = await run("abandon");
  assert.equal(abandon.run.timedOut, false);
  assert.equal(abandon.run.ended, "exit");
  assert.equal(abandon.run.stdio, "abandoned", describeDiagnostic(abandon.run));
  assert.equal(abandon.run.cleanupComplete, true);
  assert.equal(abandon.run.proc.status, "not-requested", "no timeout, no sample");
  assertClosed("abandon", abandon.run);
  assert.equal(await stopGrandchild("abandon"), true, "the descendant really outlived the child");
  assert.equal(pass.run.stdio, "closed", "a child without descendants closes its stdio");
  console.log(`ok S1 a descendant holding stdio is reported: ${describeDiagnostic(abandon.run)}`);

  if (!LINUX) {
    assert.equal(hang.run.proc.status, "unavailable", "without /proc the sample says so");
    assert.equal(spin.run.proc.status, "unavailable");
    console.log(`SKIP L1-L5 real /proc scenarios need Linux (platform ${process.platform}); proved in CI`);
  } else {
    /* L1 idle: sleeping in the event loop, nearly no CPU, and the report still answers afterwards. */
    assert.equal(hang.run.proc.status, "read", describeDiagnostic(hang.run));
    assert.equal(hang.run.proc.state, "S", describeDiagnostic(hang.run));
    assert.ok((hang.run.proc.cpuMs ?? 1e9) < 200, describeDiagnostic(hang.run));
    assert.ok(["poll", "unknown"].includes(hang.run.proc.wchan!), describeDiagnostic(hang.run));
    assert.equal(hang.run.diagnostic.status, "written", "sampling /proc did not disturb the child");

    /* L2 spin: running, and the window is spent on CPU. */
    assert.equal(spin.run.proc.state, "R", describeDiagnostic(spin.run));
    assert.ok((spin.run.proc.cpuMs ?? 0) >= 300, describeDiagnostic(spin.run));
    assert.ok(["running", "unknown"].includes(spin.run.proc.wchan!), describeDiagnostic(spin.run));

    /* L3 Atomics.wait: blocked on a futex, no CPU, and no report — the H-A signature. */
    const atomics = await run("atomics");
    assert.equal(atomics.run.timedOut, true);
    assert.equal(atomics.run.diagnostic.status, "absent", describeDiagnostic(atomics.run));
    assert.equal(atomics.run.proc.state, "S", describeDiagnostic(atomics.run));
    assert.ok((atomics.run.proc.cpuMs ?? 1e9) < 200, describeDiagnostic(atomics.run));
    assert.ok(["futex", "unknown"].includes(atomics.run.proc.wchan!), describeDiagnostic(atomics.run));
    assert.equal(atomics.run.ended, "sigterm");
    assertClosed("atomics", atomics.run);

    /* L4 a synchronous child wait: blocked, one node child, no report. */
    const syncwait = await run("syncwait");
    assert.equal(syncwait.run.timedOut, true);
    assert.equal(syncwait.run.diagnostic.status, "absent", describeDiagnostic(syncwait.run));
    assert.equal(syncwait.run.proc.children, 1, describeDiagnostic(syncwait.run));
    assert.deepEqual(syncwait.run.proc.childTypes, { node: 1 }, describeDiagnostic(syncwait.run));
    assertClosed("syncwait", syncwait.run);
    await stopGrandchild("syncwait");

    /* L5 the child is gone before the sample: exited, never a stranger's process. */
    const short = spawn(process.execPath, ["-e", ""], { stdio: "ignore" });
    const identity = short.pid === undefined ? null : readProcIdentity(short.pid);
    assert.ok(identity, "a fresh child has an identity");
    await new Promise((r) => short.once("exit", r));
    assert.equal((await readProcDiagnostic(identity, { windowMs: 1 })).status, "exited");
    console.log(`ok L1-L5 real /proc: idle, spin, Atomics.wait, child wait, exited — ${describeDiagnostic(atomics.run)}`);
  }

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
