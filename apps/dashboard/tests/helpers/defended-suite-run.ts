/*
 * DEFENDED SUITE RUN — the child-process half of a bite-proof (Package 3 M2-R9F).
 *
 * A bite-proof mutates shipped source and runs the suite that defends it. Until now that ran under
 * `spawnSync` with a 300-second timeout, and a hang told us only "TIMED OUT": the parent is blocked
 * for the whole run, so nothing could ask the child what was keeping it alive before it was killed.
 *
 * This runs the same child (`node --import tsx <suite>`, same cwd, env and output limit) under an
 * async `spawn`, so at the timeout it can:
 *
 *   1. send SIGUSR2 to the child it started — and only that child — which Node answers with a
 *      diagnostic report (`--report-on-signal`), written to a private 0700 temporary directory;
 *   2. read that report IN MEMORY and keep closed metadata only: libuv handle types from a fixed
 *      list (anything else is "other"), counts, and a status word. The raw report holds paths, the
 *      command line and native stacks; it is never printed, returned or left on disk;
 *   3. stop the child with SIGTERM, then SIGKILL if it is still there after a grace period;
 *   4. remove the temporary directory and confirm it is gone.
 *
 * Rules the callers rely on:
 *   - A timeout is never a pass. `timedOut` stays true even if the child exits 0 while the report is
 *     being written, and `ok` is false whenever `timedOut` is.
 *   - `ok` is also false until cleanup is complete: the child confirmed exited AND the temporary
 *     directory confirmed removed. A run whose cleanup failed cannot read as a pass.
 *   - Signals go through `ChildProcess.kill`, i.e. to this child's own pid. Never a negative pid,
 *     never a process group, never a pid read from anywhere else. A child that has already exited
 *     is not signalled (Node refuses once its handle is gone), so a recycled pid cannot be hit.
 *   - Grandchildren are not signalled. A suite that leaves its own children behind keeps that
 *     problem; this file reports, it does not hunt.
 *   - A report that cannot be produced (a child spinning in synchronous code never runs the
 *     handler) is reported as `absent`, and termination proceeds exactly the same way.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** The bite-proof contract: a defending suite gets five minutes. Not raised to make room for diagnostics. */
export const DEFENDED_SUITE_TIMEOUT_MS = 5 * 60 * 1000;

const OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
const REPORT_WAIT_MS = 10_000;
const GRACE_MS = 5_000;
const STDIO_DRAIN_MS = 2_000;
const POLL_MS = 50;
const REPORT_FILE = "diagnostic.json";
const TEMP_PREFIX = "defended-suite-";

/** libuv handle types a report may name. Any other string is counted as "other", never echoed. */
const HANDLE_TYPES = new Set([
  "async", "check", "fs_event", "fs_poll", "idle", "pipe", "poll", "prepare", "process", "signal", "tcp", "timer", "tty", "udp",
]);

/* Node's own notice when it writes a report. It names the file; it is not the suite's output. */
const REPORT_NOTICE = /^(Writing Node\.js report to file:.*|Node\.js report completed)\r?\n?/gm;

export type DiagnosticStatus = "not-requested" | "written" | "absent" | "unparseable" | "signal-refused";
export type Ended = "exit" | "sigterm" | "sigkill" | "unconfirmed" | "spawn-error";

export interface DiagnosticMetadata {
  readonly status: DiagnosticStatus;
  /** Active, referenced libuv handles by closed type — what keeps the event loop alive. */
  readonly handles: Readonly<Record<string, number>>;
  readonly jsFrames: number | null;
  readonly workers: number | null;
}

export interface DefendedSuiteRun {
  /** Exit 0, no timeout, output within the limit, cleanup complete. Nothing else is a pass. */
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
  readonly ended: Ended;
  readonly cleanupComplete: boolean;
  readonly diagnostic: DiagnosticMetadata;
}

export interface DefendedSuiteOptions {
  readonly cwd: string;
  readonly env?: NodeJS.ProcessEnv;
  /** Synthetic self-tests only. Bite-proofs use the default. */
  readonly timeoutMs?: number;
  readonly reportWaitMs?: number;
  readonly graceMs?: number;
}

const NO_DIAGNOSTIC: DiagnosticMetadata = { status: "not-requested", handles: {}, jsFrames: null, workers: null };

const sleep = (ms: number): Promise<"elapsed"> =>
  new Promise((resolve) => {
    setTimeout(() => resolve("elapsed"), ms);
  });

function hasExited(child: ChildProcess): boolean {
  return child.exitCode !== null || child.signalCode !== null;
}

async function waitForExit(exited: Promise<unknown>, ms: number): Promise<boolean> {
  let timer: NodeJS.Timeout | undefined;
  const elapsed = new Promise<false>((resolve) => {
    timer = setTimeout(() => resolve(false), ms);
  });
  const result = await Promise.race([exited.then(() => true as const), elapsed]);
  clearTimeout(timer);
  return result;
}

/** Reduces a report to closed values. The parsed object goes out of scope here. */
function summarize(raw: string): DiagnosticMetadata {
  const report = JSON.parse(raw) as {
    libuv?: Array<{ type?: unknown; is_active?: unknown; is_referenced?: unknown }>;
    javascriptStack?: { stack?: unknown };
    workers?: unknown;
  };
  const handles: Record<string, number> = {};
  for (const handle of report.libuv ?? []) {
    if (handle.is_active !== true || handle.is_referenced !== true) continue;
    const type = typeof handle.type === "string" && HANDLE_TYPES.has(handle.type) ? handle.type : "other";
    handles[type] = (handles[type] ?? 0) + 1;
  }
  const stack = report.javascriptStack?.stack;
  return {
    status: "written",
    handles,
    jsFrames: Array.isArray(stack) ? stack.length : 0,
    workers: Array.isArray(report.workers) ? report.workers.length : null,
  };
}

async function requestDiagnostic(
  child: ChildProcess,
  reportPath: string,
  exited: Promise<unknown>,
  waitMs: number,
): Promise<DiagnosticMetadata> {
  if (hasExited(child) || !child.kill("SIGUSR2")) return { ...NO_DIAGNOSTIC, status: "signal-refused" };
  const deadline = Date.now() + waitMs;
  let seen = false;
  let childGone = false;
  void exited.then(() => {
    childGone = true;
  });
  while (Date.now() < deadline) {
    if (existsSync(reportPath)) {
      seen = true;
      try {
        return summarize(readFileSync(reportPath, "utf8"));
      } catch {
        /* Still being written, or not JSON. Try again until the deadline. */
      }
    }
    if (childGone) break;
    await sleep(POLL_MS);
  }
  return { ...NO_DIAGNOSTIC, status: seen ? "unparseable" : "absent" };
}

async function terminate(child: ChildProcess, exited: Promise<unknown>, graceMs: number): Promise<Ended> {
  if (hasExited(child)) return "exit";
  child.kill("SIGTERM");
  if (await waitForExit(exited, graceMs)) return "sigterm";
  child.kill("SIGKILL");
  if (await waitForExit(exited, graceMs)) return "sigkill";
  /* Still there after SIGKILL. Let go of it, or its handle keeps this process alive and no verdict prints. */
  child.unref();
  return "unconfirmed";
}

export async function runDefendedSuite(suite: string, options: DefendedSuiteOptions): Promise<DefendedSuiteRun> {
  const timeoutMs = options.timeoutMs ?? DEFENDED_SUITE_TIMEOUT_MS;
  const dir = mkdtempSync(path.join(os.tmpdir(), TEMP_PREFIX));
  chmodSync(dir, 0o700);
  const reportPath = path.join(dir, REPORT_FILE);

  let timedOut = false;
  let overflow = false;
  let ended: Ended = "exit";
  let exitCode: number | null = null;
  let diagnostic = NO_DIAGNOSTIC;
  const chunks: Buffer[] = [];
  let bytes = 0;

  try {
    if ((statSync(dir).mode & 0o777) !== 0o700) throw new Error("defended-suite-run: temporary directory is not 0700");

    const child = spawn(
      process.execPath,
      [
        "--report-on-signal",
        "--report-signal=SIGUSR2",
        `--report-directory=${dir}`,
        `--report-filename=${REPORT_FILE}`,
        "--report-compact",
        "--report-exclude-env",
        "--report-exclude-network",
        "--import",
        "tsx",
        suite,
      ],
      { cwd: options.cwd, env: options.env ?? process.env, stdio: ["ignore", "pipe", "pipe"] },
    );

    const collect = (chunk: Buffer): void => {
      bytes += chunk.length;
      if (bytes > OUTPUT_LIMIT_BYTES) {
        if (!overflow) child.kill("SIGTERM");
        overflow = true;
        return;
      }
      chunks.push(chunk);
    };
    child.stdout?.on("data", collect);
    child.stderr?.on("data", collect);
    const stdioClosed = new Promise<void>((resolve) => child.once("close", () => resolve()));

    let spawnFailed = false;
    const exited = new Promise<void>((resolve) => {
      child.once("exit", (code) => {
        exitCode = code;
        resolve();
      });
      child.once("error", () => {
        spawnFailed = true;
        resolve();
      });
    });

    if (!(await waitForExit(exited, timeoutMs))) {
      timedOut = true;
      diagnostic = await requestDiagnostic(child, reportPath, exited, options.reportWaitMs ?? REPORT_WAIT_MS);
      ended = await terminate(child, exited, options.graceMs ?? GRACE_MS);
    } else if (spawnFailed) {
      ended = "spawn-error";
    }

    /* `close` waits for stdio, which a surviving grandchild can hold open; bound it, then let go. */
    await waitForExit(stdioClosed, STDIO_DRAIN_MS);
    child.stdout?.destroy();
    child.stderr?.destroy();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  const cleanupComplete = ended !== "unconfirmed" && ended !== "spawn-error" && !existsSync(dir);
  const output = Buffer.concat(chunks).toString("utf8").replace(REPORT_NOTICE, "");
  return {
    ok: !timedOut && !overflow && exitCode === 0 && ended === "exit" && cleanupComplete,
    output: overflow ? `${output}\n[defended-suite-run: output exceeded ${OUTPUT_LIMIT_BYTES} bytes; child stopped]` : output,
    timedOut,
    ended,
    cleanupComplete,
    diagnostic,
  };
}

/** One line of closed values for an assertion message. */
export function describeDiagnostic(run: DefendedSuiteRun): string {
  const handles = Object.entries(run.diagnostic.handles)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}:${count}`)
    .join(",");
  return [
    `diagnostic=${run.diagnostic.status}`,
    `handles=${handles || "none"}`,
    `jsFrames=${run.diagnostic.jsFrames ?? "none"}`,
    `workers=${run.diagnostic.workers ?? "none"}`,
    `ended=${run.ended}`,
    `cleanup=${run.cleanupComplete ? "complete" : "incomplete"}`,
  ].join(" ");
}
