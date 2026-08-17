/*
 * Sequential test runner: one child process per test file.
 *
 * ── WHY THE FAILING NAMES ARE REPRINTED AT THE END ───────────────────────────
 *
 * A full-suite run once ended with an accurate count — "384 passed, 1 failed" — and no record of
 * WHICH test failed, so the failure could never be investigated. The cause was this file, not the
 * suite: the identity was emitted once, on stderr, at the moment of failure, while the reassuring
 * PASS lines and the authoritative count went to stdout. Any capture that dropped stderr, or that
 * kept only the tail of a 385-line stdout, reported a real failure with the evidence removed.
 *
 * So the count and the identity are now inseparable: every failing label is reprinted on stdout,
 * next to the summary. You cannot read "1 failed" without also reading which one. Truncating from
 * the end now removes the count too, instead of silently keeping the count and losing the name.
 *
 * `result.error` is reported for the same reason. A spawn-level failure — ENOBUFS from an output
 * limit, ENOENT, EAGAIN — sets `error` and leaves `status` non-zero, so it USED to render as a bare
 * FAIL whose only diagnostic was the child's own truncated output. The cause was in the field this
 * file never read.
 *
 * `maxBuffer` is raised for the same class of honesty: at Node's 1MB default, a test that printed
 * more than that was KILLED and reported as failing even when it asserted nothing and would have
 * exited 0. That is a false failure manufactured by the runner. The measured worst case in this
 * suite is ~3KB, so this changes no present result — it removes a trap that grows with the suite.
 */
import { readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { spawnSync } from "node:child_process";

/** Generous on purpose: see the header. Large enough that output volume is never the verdict. */
const CHILD_OUTPUT_LIMIT_BYTES = 64 * 1024 * 1024;

function collectTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTests(path);
    if (!entry.isFile() || !entry.name.endsWith(".ts")) return [];
    if (path.includes(`${join("tests", "helpers")}${process.platform === "win32" ? "\\" : "/"}`)) return [];
    return [path];
  });
}

const tests = collectTests("tests").sort();
const failures = [];

for (const test of tests) {
  const result = spawnSync(process.execPath, ["--import", "tsx", test], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: CHILD_OUTPUT_LIMIT_BYTES,
  });
  const label = relative(process.cwd(), test);

  if (result.status === 0) {
    console.log(`PASS ${label}`);
    continue;
  }

  /* How the child ended, so a signal kill or a spawn failure is not mistaken for an assertion. */
  const cause = [
    result.status === null ? null : `exit ${result.status}`,
    result.signal ? `signal ${result.signal}` : null,
    result.error ? `spawn error ${result.error.code ?? ""}`.trim() : null,
  ]
    .filter(Boolean)
    .join(", ");

  failures.push({ label, cause });
  console.error(`FAIL ${label} (${cause})`);
  if (result.error) console.error(String(result.error.message ?? result.error));
  if (result.stdout) console.error(result.stdout.trim());
  if (result.stderr) console.error(result.stderr.trim());
}

console.log(`\nTest summary: ${tests.length - failures.length} passed, ${failures.length} failed, ${tests.length} total.`);
/* The identity travels with the count — see the header. */
for (const failure of failures) console.log(`FAILED ${failure.label} (${failure.cause})`);
if (failures.length > 0) process.exitCode = 1;
