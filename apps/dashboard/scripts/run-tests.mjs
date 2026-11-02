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
 *
 * ── --exclude-manifest <path> (CI-QUALITY-GATES-1) ───────────────────────────
 *
 * Without the flag nothing changes: every file runs and the summary line is the one above. With it,
 * the files a manifest names are not run, and each is printed as EXCLUDED with its class, next to the
 * summary, which then counts them on their own. An excluded file is never a pass. A manifest that
 * names a file the suite does not have, names one twice, or omits a reason or a reassessment
 * condition is refused before any test runs: a stale exclusion would hide nothing today and anything
 * tomorrow.
 */
import { readdirSync, readFileSync } from "node:fs";
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

const EXCLUSION_CLASSES = new Set(["BLOCKED", "PRE-EXISTING"]);

function readExclusions(manifestPath, discovered) {
  const refuse = (why) => {
    console.error(`run-tests: exclusion manifest refused: ${why}`);
    process.exit(2);
  };
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    refuse(`${manifestPath} is not readable JSON (${error.message})`);
  }
  if (manifest?.version !== 1 || !Array.isArray(manifest.exclusions)) refuse("expected { version: 1, exclusions: [...] }");
  const known = new Set(discovered.map((test) => relative(process.cwd(), test)));
  const excluded = new Map();
  for (const entry of manifest.exclusions) {
    const text = (key) => typeof entry?.[key] === "string" && entry[key].trim() !== "";
    if (!text("file") || !text("reason") || !text("reassess") || !text("risk")) refuse(`entry ${JSON.stringify(entry?.file)} needs file, reason, reassess and risk`);
    if (!EXCLUSION_CLASSES.has(entry.class)) refuse(`${entry.file}: class must be one of ${[...EXCLUSION_CLASSES].join(", ")}`);
    if (!known.has(entry.file)) refuse(`${entry.file} is not a test file of this suite`);
    if (excluded.has(entry.file)) refuse(`${entry.file} is named twice`);
    excluded.set(entry.file, entry.class);
  }
  return excluded;
}

const manifestFlag = process.argv.indexOf("--exclude-manifest");
if (manifestFlag >= 0 && !process.argv[manifestFlag + 1]) {
  console.error("run-tests: --exclude-manifest needs a path");
  process.exit(2);
}
const tests = collectTests("tests").sort();
const exclusions = manifestFlag >= 0 ? readExclusions(process.argv[manifestFlag + 1], tests) : null;
const failures = [];

for (const test of tests) {
  const excludedClass = exclusions?.get(relative(process.cwd(), test));
  if (excludedClass) {
    console.log(`EXCLUDED ${relative(process.cwd(), test)} (${excludedClass})`);
    continue;
  }
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

if (exclusions) {
  const ran = tests.length - exclusions.size;
  console.log(`\nTest summary: ${ran - failures.length} passed, ${failures.length} failed, ${exclusions.size} excluded, ${tests.length} total.`);
} else {
  console.log(`\nTest summary: ${tests.length - failures.length} passed, ${failures.length} failed, ${tests.length} total.`);
}
/* The identity travels with the count — see the header. */
for (const failure of failures) console.log(`FAILED ${failure.label} (${failure.cause})`);
for (const [label, excludedClass] of exclusions ?? []) console.log(`EXCLUDED ${label} (${excludedClass})`);
if (failures.length > 0) process.exitCode = 1;
