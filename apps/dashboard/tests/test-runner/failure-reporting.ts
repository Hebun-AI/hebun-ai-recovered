/*
 * The test runner must never report a failure it cannot name.
 *
 * ── THE INCIDENT THIS EXISTS FOR ─────────────────────────────────────────────
 *
 * A full-suite run ended with "384 passed, 1 failed" and no record of WHICH test failed. The count
 * was correct; the evidence was gone. That is the worst shape a defect can take — the number invites
 * you to trust the run, and the one thing needed to investigate it has already been discarded.
 *
 * The cause was `scripts/run-tests.mjs`, not the suite: `FAIL <label>` went to stderr while the PASS
 * lines and the authoritative summary went to stdout, and nothing restated the label at the end. Drop
 * stderr, or keep only the tail of 385 stdout lines, and a real failure reports itself as a bare count.
 *
 * ── WHAT THIS FILE PROVES, AND WHY IT ASSERTS ON STDOUT ALONE ────────────────
 *
 * Every identity assertion below reads the runner's STDOUT and ignores its stderr. That is deliberate
 * and it is the whole regression: it reproduces the exact condition under which the evidence was lost.
 * If someone moves the failing labels back to stderr, or drops the final restatement, this file fails —
 * which is what the original run could not do for itself.
 *
 * Four more properties are proved by MECHANISM rather than by scanning the runner's source for words:
 *
 *   - the failure COUNT stays correct while the identities are added (a fix that broke the count
 *     would be a different defect wearing the same clothes)
 *   - a child killed by a SIGNAL is named as such, not misfiled as an assertion failure
 *   - `result.error` — the spawn-level cause — is surfaced. Induced for real, by making one child
 *     exceed the runner's output limit, because the field this runner never read is exactly where
 *     an ENOBUFS lives
 *   - a PASSING child that prints more than the OLD 1MB limit is not turned into a false failure.
 *     At Node's default `maxBuffer` the runner killed such a child and reported it as failing even
 *     though it asserted nothing and would have exited 0
 *
 * The runner under test is the real one. This file builds a throwaway fixture suite in a temporary
 * directory, runs `scripts/run-tests.mjs` against it, and reads what it printed. No database, no
 * network, no canonical anything.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const RUNNER = path.resolve(process.cwd(), "scripts/run-tests.mjs");
const NODE_MODULES = path.resolve(process.cwd(), "node_modules");

/** The runner's own limit. A child must exceed THIS to reach the spawn-error branch. */
const RUNNER_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;
/** Node's default, and the threshold that used to manufacture false failures. */
const LEGACY_DEFAULT_LIMIT_BYTES = 1024 * 1024;

interface FixtureRun {
  readonly stdout: string;
  readonly stderr: string;
  readonly status: number | null;
}

/**
 * Build a disposable fixture suite and run the real runner over it.
 *
 * `node_modules` is symlinked rather than copied because the runner spawns each child as
 * `node --import tsx <file>` with the fixture directory as cwd, so `tsx` has to resolve from there.
 */
function runFixtureSuite(files: Record<string, string>): FixtureRun {
  const root = mkdtempSync(path.join(tmpdir(), "hebun-runner-reporting-"));
  try {
    mkdirSync(path.join(root, "tests"), { recursive: true });
    for (const [name, source] of Object.entries(files)) {
      writeFileSync(path.join(root, "tests", name), source);
    }
    symlinkSync(NODE_MODULES, path.join(root, "node_modules"), "dir");

    const result = spawnSync(process.execPath, [RUNNER], {
      cwd: root,
      encoding: "utf8",
      // Large enough that MEASURING the runner never becomes the thing that fails.
      maxBuffer: 256 * 1024 * 1024,
    });
    return {
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      status: result.status,
    };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function main(): void {
  const run = runFixtureSuite({
    "a-pass.ts": `console.log("fixture a ok");\n`,

    "b-assert-fail.ts":
      `import assert from "node:assert/strict";\n` +
      `assert.equal(1, 2, "deliberate fixture assertion failure");\n`,

    "c-signal.ts": `process.kill(process.pid, "SIGKILL");\n`,

    /*
     * Prints well past the legacy 1MB default and then exits 0. This child is CORRECT, and the
     * runner must say so.
     */
    "d-large-stdout.ts":
      `const chunk = "x".repeat(1024 * 1024);\n` +
      `for (let i = 0; i < 3; i++) console.log(chunk);\n`,

    /*
     * Exceeds the runner's own 64MB limit, which makes spawnSync abort the child and populate
     * `result.error` with ENOBUFS. The only way to observe that field is for the runner to read it.
     */
    "e-spawn-error.ts":
      `const chunk = "x".repeat(1024 * 1024);\n` +
      `for (let i = 0; i < 68; i++) console.log(chunk);\n`,
  });

  /* ── 1. THE IDENTITIES SURVIVE ON STDOUT ─────────────────────────────────── */
  for (const [label, cause] of [
    ["tests/b-assert-fail.ts", "exit 1"],
    ["tests/c-signal.ts", "signal SIGKILL"],
  ] as const) {
    assert.ok(
      run.stdout.includes(`FAILED ${label} (${cause})`),
      `stdout alone must name ${label} and how it ended — stderr may be discarded`,
    );
  }

  /* ── 2. THE SPAWN-LEVEL CAUSE IS SURFACED, NOT SWALLOWED ─────────────────── */
  const spawnErrorLine = run.stdout
    .split("\n")
    .find((line) => line.startsWith("FAILED tests/e-spawn-error.ts"));
  assert.ok(spawnErrorLine, "a child aborted at the spawn layer must still be named on stdout");
  assert.match(
    spawnErrorLine,
    /spawn error ENOBUFS/,
    "the spawn-level cause must be reported — this is the field the runner used to never read",
  );

  /* ── 3. THE COUNT IS STILL RIGHT ─────────────────────────────────────────── */
  assert.ok(
    run.stdout.includes("Test summary: 2 passed, 3 failed, 5 total."),
    "adding the identities must not disturb the count they belong to",
  );
  assert.equal(
    run.stdout.match(/^FAILED /gm)?.length,
    3,
    "every failure is restated exactly once — no duplicates, none missing",
  );
  assert.equal(run.status, 1, "a run with failures still exits non-zero");

  /* ── 4. A LOUD BUT PASSING CHILD IS NOT A FALSE FAILURE ──────────────────── */
  assert.ok(
    run.stdout.includes("PASS tests/d-large-stdout.ts"),
    `a child printing more than ${LEGACY_DEFAULT_LIMIT_BYTES} bytes and exiting 0 is passing; ` +
      "at Node's default maxBuffer the runner killed it and called it a failure",
  );
  assert.ok(
    !run.stdout.includes("FAILED tests/d-large-stdout.ts"),
    "…and it must not appear in the failure restatement either",
  );
  assert.ok(
    RUNNER_OUTPUT_LIMIT_BYTES > LEGACY_DEFAULT_LIMIT_BYTES,
    "the fixture above only means something while the runner's limit exceeds the legacy default",
  );

  /* ── 5. THE PASSING CHILDREN ARE REPORTED, AND ONLY THEM ─────────────────── */
  assert.ok(run.stdout.includes("PASS tests/a-pass.ts"), "an ordinary passing child is reported");
  assert.equal(
    run.stdout.match(/^PASS /gm)?.length,
    2,
    "exactly the two passing children are reported as passing",
  );

  console.log("test runner failure reporting: all assertions passed.");
}

main();
