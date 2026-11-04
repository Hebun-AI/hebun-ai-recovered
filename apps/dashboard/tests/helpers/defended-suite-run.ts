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
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
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

/*
 * LINUX /proc (M2-R9P). A child whose main thread is blocked never answers SIGUSR2, so the report is
 * `absent` and says nothing. Before that signal, on Linux, the kernel's view of the child is sampled
 * twice, PROC_WINDOW_MS apart, and reduced to closed values: run state, CPU used in the window,
 * thread count and states, what the main thread waits on (wchan, as a class), and its direct
 * children (by name, as a class). Read: stat, wchan, task/<tid>/stat, task/<tid>/children. Never
 * cmdline, environ, fd or maps; never a raw line, path or name.
 *
 * Identity: the child's start time and parent pid are read from stat right after spawn and must
 * still match when sampled, so a recycled pid is reported as `identity-mismatch`, never described.
 * A child that is gone is `exited`; anything unreadable is `unavailable`. Reading /proc sends no
 * signal and changes nothing about the child.
 *
 * M2-R9T: thread names as classes (Node names its main thread "MainThread" and its workers
 * "WorkerThread" on Linux), and each verified direct child sampled across the same window — its
 * pid from our child's children list, its parent pid our child's, its start time no earlier than our
 * child's and unchanged between the two samples.
 */
export type ProcStatus = "not-requested" | "read" | "unavailable" | "exited" | "identity-mismatch";
export type WchanClass = "running" | "futex" | "pipe" | "poll" | "wait" | "sleep" | "io" | "other" | "unknown";

export interface ChildProcSample {
  readonly type: string;
  readonly status: "read" | "exited" | "identity-mismatch" | "unavailable";
  readonly state: NonNullable<ProcMetadata["state"]> | null;
  readonly cpuMs: number | null;
  readonly threads: number | null;
  readonly wchan: WchanClass | null;
}

export interface ProcMetadata {
  readonly status: ProcStatus;
  readonly state: "R" | "S" | "D" | "Z" | "T" | "other" | null;
  /** CPU time the child used during the sampling window. */
  readonly cpuMs: number | null;
  readonly threads: number | null;
  readonly threadStates: Readonly<Record<string, number>>;
  /** Thread names as classes: MainThread, WorkerThread, other. */
  readonly threadNames: Readonly<Record<string, number>>;
  /** What the main thread waits on, as a class. */
  readonly wchan: WchanClass | null;
  /** Direct children whose parent pid is the child's. */
  readonly children: number | null;
  readonly childTypes: Readonly<Record<string, number>>;
  /** Each verified direct child, sampled across the same window. */
  readonly childProcs: readonly ChildProcSample[];
}

export interface ProcIdentity {
  readonly pid: number;
  readonly ppid: number;
  readonly startTime: string;
}

/** After exit: did stdio close, or did a surviving descendant keep it open past the drain bound? */
export type StdioState = "closed" | "abandoned";

export interface DefendedSuiteRun {
  /** Exit 0, no timeout, output within the limit, cleanup complete. Nothing else is a pass. */
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
  readonly ended: Ended;
  readonly cleanupComplete: boolean;
  readonly diagnostic: DiagnosticMetadata;
  readonly proc: ProcMetadata;
  readonly stdio: StdioState;
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

const PROC_ROOT = "/proc";
const PROC_WINDOW_MS = 1_000;
/* /proc reports CPU time in USER_HZ, which is 100 on every Linux ABI Node supports. */
const USER_HZ_MS = 10;
const STATES = new Set(["R", "S", "D", "Z", "T"]);

const NO_PROC: ProcMetadata = {
  status: "not-requested", state: null, cpuMs: null, threads: null, threadStates: {}, threadNames: {}, wchan: null, children: null, childTypes: {}, childProcs: [],
};

interface StatFields {
  readonly state: string;
  readonly ppid: number;
  readonly ticks: number;
  readonly threads: number;
  readonly startTime: string;
  readonly comm: string;
}

type ProcRead = { readonly text: string } | { readonly missing: true } | { readonly failed: true };

function readProc(root: string, relative: string): ProcRead {
  try {
    return { text: readFileSync(path.join(root, relative), "utf8") };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOENT" || code === "ESRCH" ? { missing: true } : { failed: true };
  }
}

/** `pid (comm) state ppid ...`; comm may hold spaces and parentheses, so it ends at the last ")". */
function parseStat(raw: string): StatFields | null {
  const open = raw.indexOf("(");
  const close = raw.lastIndexOf(")");
  if (open < 0 || close < open) return null;
  const f = raw.slice(close + 1).trim().split(/\s+/);
  /* f[0] is field 3 (state): field n of proc(5) is f[n - 3]. */
  if (f.length < 20 || !/^\d+$/.test(f[19]!)) return null;
  const ppid = Number(f[1]);
  const ticks = Number(f[11]) + Number(f[12]);
  const threads = Number(f[17]);
  if (![ppid, ticks, threads].every(Number.isSafeInteger)) return null;
  return { state: f[0]!, ppid, ticks, threads, startTime: f[19]!, comm: raw.slice(open + 1, close) };
}

function stateClass(state: string): NonNullable<ProcMetadata["state"]> {
  return (STATES.has(state) ? state : "other") as NonNullable<ProcMetadata["state"]>;
}

/** A kernel symbol is reduced to a class; the symbol itself is never returned. */
export function classifyWchan(symbol: string | null, state: string | null): WchanClass {
  if (symbol === null) return "unknown";
  const s = symbol.trim();
  if (s === "" || s === "0") return state === "R" ? "running" : "unknown";
  if (/futex/.test(s)) return "futex";
  if (/pipe/.test(s)) return "pipe";
  if (/poll|select|epoll|ep_/.test(s)) return "poll";
  if (/do_wait|kernel_wait|wait4|waitid/.test(s)) return "wait";
  if (/nanosleep|hrtimer|schedule_timeout|msleep/.test(s)) return "sleep";
  if (/io_schedule|blk|ext4|xfs|jbd2|folio|bit_wait|nfs|fuse/.test(s)) return "io";
  return "other";
}

/** A process name is reduced to a class; the name itself is never returned. */
export function classifyChild(comm: string): string {
  /* Node 24 renames its main thread "MainThread" on Linux, and stat's comm is the main thread's name. */
  if (comm === "node" || comm === "MainThread") return "node";
  if (comm.startsWith("esbuild")) return "esbuild";
  if (/^python/.test(comm)) return "python";
  if (/^(postgres|postmaster)/.test(comm)) return "postgres";
  if (/^(sh|bash|dash|zsh)$/.test(comm)) return "shell";
  return "other";
}

/** A thread name is reduced to a class; the name itself is never returned. */
export function classifyThread(comm: string): "MainThread" | "WorkerThread" | "other" {
  return comm === "MainThread" || comm === "WorkerThread" ? comm : "other";
}

/** Taken right after spawn. Null when /proc cannot vouch for this pid being our own child. */
export function readProcIdentity(pid: number, root = PROC_ROOT, parentPid = process.pid): ProcIdentity | null {
  const read = readProc(root, `${pid}/stat`);
  const stat = "text" in read ? parseStat(read.text) : null;
  if (!stat || stat.ppid !== parentPid) return null;
  return { pid, ppid: parentPid, startTime: stat.startTime };
}

function checkedStat(root: string, identity: ProcIdentity): StatFields | ProcStatus {
  const read = readProc(root, `${identity.pid}/stat`);
  if ("missing" in read) return "exited";
  if (!("text" in read)) return "unavailable";
  const stat = parseStat(read.text);
  if (!stat) return "unavailable";
  if (stat.startTime !== identity.startTime || stat.ppid !== identity.ppid) return "identity-mismatch";
  if (stat.state === "Z") return "exited";
  return stat;
}

export async function readProcDiagnostic(
  identity: ProcIdentity | null,
  options: { readonly root?: string; readonly windowMs?: number } = {},
): Promise<ProcMetadata> {
  if (!identity) return { ...NO_PROC, status: "unavailable" };
  const root = options.root ?? PROC_ROOT;
  const first = checkedStat(root, identity);
  if (typeof first === "string") return { ...NO_PROC, status: first };
  const childStart = verifiedChildren(root, identity);
  await sleep(options.windowMs ?? PROC_WINDOW_MS);
  const second = checkedStat(root, identity);
  if (typeof second === "string") return { ...NO_PROC, status: second };
  const childProcs = (childStart ?? []).map((c) => sampleChild(root, c));

  const wchanRead = readProc(root, `${identity.pid}/wchan`);
  const wchan = classifyWchan("text" in wchanRead ? wchanRead.text : null, second.state);

  const threadStates: Record<string, number> = {};
  const threadNames: Record<string, number> = {};
  let tids: string[] = [];
  try {
    tids = readdirSync(path.join(root, `${identity.pid}/task`)).filter((t) => /^\d+$/.test(t));
  } catch {
    tids = [];
  }
  for (const tid of tids) {
    const t = readProc(root, `${identity.pid}/task/${tid}/stat`);
    const ts = "text" in t ? parseStat(t.text) : null;
    if (ts) {
      const k = stateClass(ts.state);
      threadStates[k] = (threadStates[k] ?? 0) + 1;
      const n = classifyThread(ts.comm);
      threadNames[n] = (threadNames[n] ?? 0) + 1;
    }
  }
  /* Count and types come from the same verified list the samples use: one notion of "our child's child". */
  const childTypes: Record<string, number> = {};
  for (const c of childStart ?? []) childTypes[c.type] = (childTypes[c.type] ?? 0) + 1;

  return {
    status: "read",
    state: stateClass(second.state),
    cpuMs: Math.max(0, second.ticks - first.ticks) * USER_HZ_MS,
    threads: second.threads,
    threadStates,
    threadNames,
    wchan,
    children: childStart === null ? null : childStart.length,
    childTypes,
    childProcs,
  };
}

interface ChildStart {
  readonly pid: number;
  readonly type: string;
  readonly startTime: string;
  readonly ticks: number;
}

/** Null when no task's children list can be read: the count is then unknown, not zero. */
function childPidsOf(root: string, pid: number): number[] | null {
  const out = new Set<number>();
  let readable = false;
  let tids: string[] = [];
  try {
    tids = readdirSync(path.join(root, `${pid}/task`)).filter((t) => /^\d+$/.test(t));
  } catch {
    return null;
  }
  for (const tid of tids) {
    const c = readProc(root, `${pid}/task/${tid}/children`);
    if (!("text" in c)) continue;
    readable = true;
    for (const p of c.text.trim().split(/\s+/)) if (/^\d+$/.test(p)) out.add(Number(p));
  }
  return readable ? [...out] : null;
}

/** Direct children of our child: listed by it, parented by it, and started no earlier than it. */
function verifiedChildren(root: string, identity: ProcIdentity): ChildStart[] | null {
  const pids = childPidsOf(root, identity.pid);
  if (pids === null) return null;
  const out: ChildStart[] = [];
  for (const cpid of pids) {
    const r = readProc(root, `${cpid}/stat`);
    const cs = "text" in r ? parseStat(r.text) : null;
    if (!cs || cs.ppid !== identity.pid || Number(cs.startTime) < Number(identity.startTime)) continue;
    out.push({ pid: cpid, type: classifyChild(cs.comm), startTime: cs.startTime, ticks: cs.ticks });
  }
  return out;
}

/** The same child at the end of the window, or why it cannot be described. */
function sampleChild(root: string, start: ChildStart): ChildProcSample {
  const none = { state: null, cpuMs: null, threads: null, wchan: null };
  const r = readProc(root, `${start.pid}/stat`);
  if ("missing" in r) return { type: start.type, status: "exited", ...none };
  const cs = "text" in r ? parseStat(r.text) : null;
  if (!cs) return { type: start.type, status: "unavailable", ...none };
  if (cs.startTime !== start.startTime) return { type: start.type, status: "identity-mismatch", ...none };
  if (cs.state === "Z") return { type: start.type, status: "exited", ...none };
  const w = readProc(root, `${start.pid}/wchan`);
  return {
    type: start.type,
    status: "read",
    state: stateClass(cs.state),
    cpuMs: Math.max(0, cs.ticks - start.ticks) * USER_HZ_MS,
    threads: cs.threads,
    wchan: classifyWchan("text" in w ? w.text : null, cs.state),
  };
}

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
  let proc = NO_PROC;
  let stdio: StdioState = "closed";
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
      /*
       * tsx compiles every .ts import through esbuild's transformSync. By default that posts to a worker
       * thread and blocks this child's main thread in an untimed Atomics.wait; if the worker dies first,
       * the child sleeps in futex until the timeout (CI: cpuMs=0, wchan=futex, esbuild:exited, no
       * WorkerThread). "0" makes each call a self-terminating execFileSync instead. Child-only: the
       * caller's env object and this process's env are not touched.
       */
      { cwd: options.cwd, env: { ...(options.env ?? process.env), ESBUILD_WORKER_THREADS: "0" }, stdio: ["ignore", "pipe", "pipe"] },
    );
    /* Pinned now, while the pid is certainly ours; checked again before any sample is described. */
    const identity = process.platform === "linux" && child.pid !== undefined ? readProcIdentity(child.pid) : null;

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
      /* Before SIGUSR2: the kernel's view of a child that may never answer it. Bounded by PROC_WINDOW_MS. */
      proc = hasExited(child) ? { ...NO_PROC, status: "exited" } : await readProcDiagnostic(identity);
      diagnostic = await requestDiagnostic(child, reportPath, exited, options.reportWaitMs ?? REPORT_WAIT_MS);
      ended = await terminate(child, exited, options.graceMs ?? GRACE_MS);
    } else if (spawnFailed) {
      ended = "spawn-error";
    }

    /* `close` waits for stdio, which a surviving grandchild can hold open; bound it, then let go. */
    if (!(await waitForExit(stdioClosed, STDIO_DRAIN_MS))) stdio = "abandoned";
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
    proc,
    stdio,
  };
}

const counts = (record: Readonly<Record<string, number>>): string =>
  Object.entries(record)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => `${k}:${n}`)
    .join(",") || "none";

const describeChildren = (children: readonly ChildProcSample[]): string =>
  children
    /* ":" separates fields and "," separates children: no "/" anywhere, so the no-path check stays absolute. */
    .map((c) => (c.status === "read" ? `${c.type}:${c.state}:${c.cpuMs}ms:${c.wchan}:${c.threads}t` : `${c.type}:${c.status}`))
    .sort()
    .join(",") || "none";

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
    `stdio=${run.stdio}`,
    `proc=${run.proc.status}`,
    ...(run.proc.status === "read"
      ? [
          `state=${run.proc.state}`,
          `cpuMs=${run.proc.cpuMs}`,
          `threads=${run.proc.threads}`,
          `threadStates=${counts(run.proc.threadStates)}`,
          `threadNames=${counts(run.proc.threadNames)}`,
          `wchan=${run.proc.wchan}`,
          `children=${run.proc.children ?? "unknown"}`,
          `childTypes=${counts(run.proc.childTypes)}`,
          `childProc=${describeChildren(run.proc.childProcs)}`,
        ]
      : []),
  ].join(" ");
}
