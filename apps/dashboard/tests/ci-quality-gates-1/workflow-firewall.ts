/*
 * CI-QUALITY-GATES-1 — the security boundary of every GitHub Actions workflow in this repository,
 * the exclusion manifest of the full suite, and the runner's --exclude-manifest behavior.
 *
 * Every file in .github/workflows is checked, so a workflow added later meets the same rules:
 *   pull_request is the only trigger (never pull_request_target); the token reads contents and
 *   nothing else; no secret, no environment, no expression a pull request can steer; every action
 *   pinned to a full commit SHA and every image to a digest; checkout keeps no credential; install
 *   scripts never run; the only database URL is the loopback service container.
 *
 * No check may be skipped or masked into a pass (Package 3 M2-R9H): continue-on-error is refused, a
 * job may not carry `if` (a skipped job reports success to a required check), a step's `if` may only
 * be always(), and an event filter may only be `types: [labeled]` — the full suite's request trigger.
 *
 * The checks are text rules, not a YAML parser: the repository has no YAML dependency and this test
 * adds none. Each rule is proven by a negative control below — a mutated copy of the real workflow
 * that the rule must reject — so a rule that rejects nothing fails here instead of passing silently.
 *
 * No database, no network, no provider. The runner checks use a disposable fixture directory.
 */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DASHBOARD = process.cwd();
const REPO = path.resolve(DASHBOARD, "../..");
const WORKFLOWS = path.join(REPO, ".github/workflows");
const MANIFEST = path.join(DASHBOARD, "scripts/ci/suite-exclusions.json");
const ROADMAP = path.join(REPO, "docs/MASTER-ROADMAP.md");
const RUNNER = path.join(DASHBOARD, "scripts/run-tests.mjs");

/** Expressions a workflow may use. Anything else — above all github.event.* — is refused. */
const ALLOWED_EXPRESSIONS = new Set(["github.ref"]);

/** The violations of one workflow text; empty means it meets every rule. */
export function workflowViolations(text: string): string[] {
  const v: string[] = [];
  const lines = text.split("\n").map((l) => l.replace(/\s+#.*$/, "").replace(/^\s*#.*$/, ""));
  const body = lines.join("\n");
  const topLevel = (key: string) => {
    const start = lines.findIndex((l) => l === `${key}:` || l.startsWith(`${key}: `));
    if (start < 0) return null;
    const block = [lines[start]!.slice(key.length + 1).trim()];
    for (const l of lines.slice(start + 1)) {
      if (/^\S/.test(l)) break;
      if (l.trim()) block.push(l);
    }
    return block.filter(Boolean);
  };

  const on = topLevel("on");
  const triggers = (on ?? []).filter((l) => /^ {2}[a-z_]+:/.test(l)).map((l) => l.trim().replace(/:.*$/, ""));
  if (on === null || triggers.length !== 1 || triggers[0] !== "pull_request") v.push(`trigger must be pull_request only, found ${JSON.stringify(triggers)}`);
  if (/pull_request_target|workflow_run|repository_dispatch/.test(body)) v.push("forbidden trigger");

  const permissions = topLevel("permissions");
  if (JSON.stringify(permissions) !== JSON.stringify(["  contents: read"])) v.push(`top-level permissions must be exactly contents: read, found ${JSON.stringify(permissions)}`);
  if (lines.filter((l) => /^\s+permissions:/.test(l)).length > 0) v.push("job-level permissions are not allowed");
  if (/\bwrite\b|write-all|read-all/.test((permissions ?? []).join("\n"))) v.push("write permission");

  if (/continue-on-error/.test(body)) v.push("continue-on-error masks a failing job");
  for (const l of lines.filter((x) => /^\s+if:/.test(x))) {
    if (/^ {4}if:/.test(l)) v.push("job-level if: a skipped job reports success");
    else if (l.trim() !== "if: always()") v.push(`step if may only be always(), found ${l.trim()}`);
  }
  for (const l of lines.filter((x) => /^\s+types:/.test(x))) {
    if (l.trim() !== "types: [labeled]") v.push(`event types may only be [labeled], found ${l.trim()}`);
  }

  if (/\bsecrets\b/.test(body)) v.push("secrets are not allowed");
  if (/^\s+environment:/m.test(body)) v.push("environments are not allowed");
  for (const m of body.matchAll(/\$\{\{\s*([^}]*?)\s*\}\}/g)) {
    if (!ALLOWED_EXPRESSIONS.has(m[1]!)) v.push(`expression not allowed: ${m[1]}`);
  }

  const uses = [...body.matchAll(/^\s*(?:-\s+)?uses:\s*(\S+)/gm)].map((m) => m[1]!);
  for (const u of uses) if (!/^[a-z0-9-]+\/[a-z0-9._-]+@[0-9a-f]{40}$/.test(u)) v.push(`action not pinned to a commit SHA: ${u}`);
  const checkouts = uses.filter((u) => u.startsWith("actions/checkout@")).length;
  const noCredentials = (body.match(/^\s+persist-credentials:\s*false\s*$/gm) ?? []).length;
  if (checkouts !== noCredentials) v.push("every checkout must set persist-credentials: false");
  for (const m of body.matchAll(/^\s+image:\s*(\S+)/gm)) if (!/@sha256:[0-9a-f]{64}$/.test(m[1]!)) v.push(`image not pinned to a digest: ${m[1]}`);

  for (const m of body.matchAll(/npm (ci|install)\b[^\n]*/g)) if (!m[0].includes("--ignore-scripts")) v.push(`npm without --ignore-scripts: ${m[0]}`);
  for (const m of body.matchAll(/[a-z]+:\/\/[^\s"']+/g)) {
    const url = m[0];
    if (/^postgres(ql)?:\/\//.test(url) && !/^postgresql:\/\/postgres@127\.0\.0\.1:55432\//.test(url)) v.push(`database URL is not the loopback service: ${url}`);
  }
  if (/hebuntech|vercel|DATABASE_URL(?!:)/.test(body.replace(/HEBUN_TEST_ADMIN_DATABASE_URL/g, ""))) v.push("production reference");
  for (const m of body.matchAll(/^\s+ports:\n((?:\s+- .*\n)+)/gm)) {
    for (const p of m[1]!.trim().split("\n")) if (!/^\s*- 127\.0\.0\.1:\d+:\d+$/.test(p)) v.push(`port not bound to loopback: ${p.trim()}`);
  }
  return v;
}

function workflowChecks(): void {
  assert.ok(existsSync(WORKFLOWS), ".github/workflows exists");
  const files = readdirSync(WORKFLOWS).filter((f) => /\.ya?ml$/.test(f));
  assert.ok(files.length >= 1, "at least one workflow");
  for (const f of files) {
    const violations = workflowViolations(readFileSync(path.join(WORKFLOWS, f), "utf8"));
    assert.deepEqual(violations, [], `${f} breaks the CI security boundary`);
  }

  assert.deepEqual(files.sort(), ["ci.yml", "full-suite.yml"], "the two workflows this test knows");
  const read = (f: string) => readFileSync(path.join(WORKFLOWS, f), "utf8");
  const jobsOf = (text: string) => [...text.matchAll(/^ {2}([a-z][a-z0-9-]*):\n {4}name: /gm)].map((m) => m[1]!);
  const job = (text: string, file: string, name: string) => {
    const m = new RegExp(`^ {2}${name}:\\n([\\s\\S]*?)(?=^ {2}\\S|^\\S|(?![\\s\\S]))`, "m").exec(text);
    assert.ok(m, `${file} has a ${name} job`);
    return m[1]!;
  };
  const treeCheck = /if: always\(\)\n\s+run: \|\n\s+git status --porcelain\n\s+test -z "\$\(git status --porcelain\)"/;

  /* ci.yml: every pull request update. No event filter, so it runs on each push to the pull request. */
  const ci = read("ci.yml");
  assert.ok(!/^\s+types:/m.test(ci), "ci.yml runs on every pull request update");
  assert.deepEqual(jobsOf(ci), ["quick", "targeted"], "ci.yml has exactly quick and targeted; the full suite is not here");
  assert.ok(!ci.includes("run-tests.mjs"), "ci.yml never starts the full suite");
  const quick = job(ci, "ci.yml", "quick");
  assert.match(quick, /^ {4}name: quick \(typecheck, lint, build, continuity\)$/m, "quick keeps its check name");
  for (const step of ["npx tsc --noEmit", "npx eslint .", "npx next build", "tests/development-continuity/closure-contract.ts", "tests/ci-quality-gates-1/workflow-firewall.ts", "tests/ci-quality-gates-1/defended-suite-run.ts"]) {
    assert.ok(quick.includes(`run: ${step}`) || quick.includes(`run: node --import tsx ${step}`), `quick runs ${step}`);
  }
  const targeted = job(ci, "ci.yml", "targeted");
  assert.match(targeted, /^ {4}name: targeted \(scope-composition, live-map, TB1\)$/m, "targeted keeps its check name");
  for (const test of ["tests/google-capability-scope-repair-1/scope-composition.ts", "tests/live-map-experience/bite-proofs.ts", "tests/tb1-trust-boundary/bite-proofs.ts"]) {
    assert.ok(targeted.includes(`run: node --import tsx ${test}`), `targeted runs ${test}`);
  }
  assert.match(targeted, /fetch-depth: 0/, "scope-composition needs the commit range it measures");
  assert.match(targeted, /--locale=C/, "C collation, the measured locale of the baseline runs");
  assert.match(targeted, treeCheck, "a bite-proof that leaves mutated source behind fails the job");

  /* full-suite.yml: only when a label is added, on that head commit, never masked. */
  const full = read("full-suite.yml");
  assert.match(full, /^on:\n {2}pull_request:\n {4}branches: \[main\]\n {4}types: \[labeled\]\n/m, "the full suite starts only on a label");
  assert.deepEqual(jobsOf(full), ["full-suite"], "full-suite.yml has one job");
  assert.match(full, /^ {2}group: full-suite-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: false$/m, "its own concurrency group; a push never cancels it");
  const suite = job(full, "full-suite.yml", "full-suite");
  assert.match(suite, /^ {4}name: full-suite \(disposable PostgreSQL\)$/m, "full-suite keeps its check name");
  assert.ok(suite.includes("run: node scripts/run-tests.mjs --exclude-manifest scripts/ci/suite-exclusions.json"), "the suite names the exclusions it skips");
  assert.match(suite, /--locale=C/, "C collation, the measured locale of the baseline runs");
  assert.match(suite, /fetch-depth: 0/, "several tests read earlier commits");
  assert.match(suite, /test "\$\(git rev-parse HEAD\)" = "\$GITHUB_SHA"/, "the tested tree is the commit the event names");
  assert.match(suite, /jq -r \.pull_request\.head\.sha "\$GITHUB_EVENT_PATH"/, "the head commit is recorded from the event file, not an expression");
  assert.match(suite, treeCheck, "a result from a changed tree is refused");
  console.log(`PASS workflows: ${files.length} file(s) meet the boundary`);
}

function negativeControls(): void {
  const real = readFileSync(path.join(WORKFLOWS, "ci.yml"), "utf8");
  const full = readFileSync(path.join(WORKFLOWS, "full-suite.yml"), "utf8");
  /* Each mutant must be rejected by the rule it targets, not by some other rule it happens to trip. */
  const mutants: Record<string, readonly [string, RegExp]> = {
    "pull_request_target": [real.replace("  pull_request:\n", "  pull_request_target:\n"), /trigger/],
    "second trigger": [real.replace("  pull_request:\n", "  push:\n  pull_request:\n"), /pull_request only/],
    "write permission": [real.replace("  contents: read", "  contents: write"), /permissions must be exactly/],
    "extra permission": [real.replace("  contents: read", "  contents: read\n  id-token: write"), /permissions must be exactly/],
    "job permission": [real.replace("    runs-on: ubuntu-24.04\n    timeout-minutes: 30", "    runs-on: ubuntu-24.04\n    permissions: write-all\n    timeout-minutes: 30"), /job-level permissions/],
    "secret": [real.replace("NEXT_TELEMETRY_DISABLED: \"1\"", "NEXT_TELEMETRY_DISABLED: \"1\"\n  KEY: ${{ secrets.ANTHROPIC_API_KEY }}"), /secrets are not allowed/],
    "event expression": [real.replace("run: npx tsc --noEmit", "run: echo \"${{ github.event.pull_request.title }}\""), /expression not allowed: github\.event/],
    "environment": [real.replace("    timeout-minutes: 30", "    timeout-minutes: 30\n    environment: production"), /environments are not allowed/],
    "tag pin": [real.replace(/actions\/checkout@[0-9a-f]{40}/, "actions/checkout@v7"), /not pinned to a commit SHA/],
    "image tag": [real.replace(/postgres:18\.6@sha256:[0-9a-f]{64}/, "postgres:18"), /image not pinned/],
    "credentials kept": [real.replace("persist-credentials: false", "persist-credentials: true"), /persist-credentials/],
    "install scripts": [real.replace("npm ci --ignore-scripts", "npm ci"), /--ignore-scripts/],
    "remote database": [real.replace("postgresql://postgres@127.0.0.1:55432/postgres", "postgresql://user@db.example.com:5432/hebun"), /not the loopback service/],
    "open port": [real.replace("- 127.0.0.1:55432:5432", "- 55432:5432"), /port not bound to loopback/],
    "masked job": [real.replace("    timeout-minutes: 20\n", "    timeout-minutes: 20\n    continue-on-error: true\n"), /continue-on-error/],
    "skippable job": [real.replace("    timeout-minutes: 20\n", "    timeout-minutes: 20\n    if: github.ref == 'refs/heads/main'\n"), /job-level if/],
    "skipped step": [real.replace("      - name: TB1 bite-proofs\n        if: always()", "      - name: TB1 bite-proofs\n        if: false"), /step if may only be always\(\)/],
    "full suite on every update": [full.replace("    types: [labeled]\n", "    types: [labeled, synchronize]\n"), /event types may only be \[labeled\]/],
    "full suite masked": [full.replace("    timeout-minutes: 120\n", "    timeout-minutes: 120\n    continue-on-error: true\n"), /continue-on-error/],
  };
  for (const [label, [text, expected]] of Object.entries(mutants)) {
    assert.ok(text !== real && text !== full, `${label}: the mutation applies`);
    const violations = workflowViolations(text);
    assert.ok(violations.some((x) => expected.test(x)), `${label}: rejected by its own rule, got ${JSON.stringify(violations)}`);
  }
  console.log(`PASS negative controls: ${Object.keys(mutants).length} mutated workflows rejected`);
}

interface Exclusion { readonly file: string; readonly class: string; readonly risk: string; readonly reason: string; readonly reassess: string }

function manifestChecks(): void {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { version: number; exclusions: Exclusion[] };
  assert.equal(manifest.version, 1);
  const roadmap = readFileSync(ROADMAP, "utf8");
  const seen = new Set<string>();
  for (const e of manifest.exclusions) {
    assert.ok(!seen.has(e.file), `${e.file} named once`);
    seen.add(e.file);
    assert.ok(existsSync(path.join(DASHBOARD, e.file)), `${e.file} exists`);
    assert.ok(/^tests\/(?!helpers\/).+\.ts$/.test(e.file), `${e.file} is a file the runner discovers`);
    assert.ok(["BLOCKED", "PRE-EXISTING"].includes(e.class), `${e.file}: closed class`);
    assert.ok(e.reason.length >= 40 && e.reassess.length >= 40, `${e.file}: a reason and a reassessment condition`);
    assert.ok(roadmap.includes(`| ${e.risk} |`), `${e.file}: risk ${e.risk} is a roadmap §22 row`);
  }
  console.log(`PASS manifest: ${manifest.exclusions.length} exclusion(s), each with class, risk, reason and reassessment`);
}

function runFixture(files: Record<string, string>, manifest: unknown | null) {
  const root = mkdtempSync(path.join(tmpdir(), "hebun-ci-exclusions-"));
  try {
    mkdirSync(path.join(root, "tests"), { recursive: true });
    for (const [name, source] of Object.entries(files)) writeFileSync(path.join(root, "tests", name), source);
    symlinkSync(path.join(DASHBOARD, "node_modules"), path.join(root, "node_modules"), "dir");
    const args = [RUNNER];
    if (manifest !== null) {
      writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest));
      args.push("--exclude-manifest", "manifest.json");
    }
    const r = spawnSync(process.execPath, args, { cwd: root, encoding: "utf8" });
    return { stdout: r.stdout ?? "", status: r.status };
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function runnerChecks(): void {
  const files = {
    "a-pass.ts": "export {};\n",
    "b-excluded.ts": `console.log("B-RAN");\nprocess.exit(1);\n`,
    "c-fail.ts": "process.exit(1);\n",
    "d-blocked.ts": `throw new Error("FIXTURE BLOCKED — dependency unreachable; this is NOT a pass");\n`,
  };
  const entry = (file: string) => ({ file, class: "BLOCKED", risk: "FIXTURE-1", reason: "fixture reason", reassess: "fixture reassessment" });

  const plain = runFixture(files, null);
  assert.equal(plain.status, 1);
  assert.match(plain.stdout, /^Test summary: 1 passed, 3 failed, 4 total\.$/m, "without the flag the summary is unchanged");
  assert.ok(!plain.stdout.includes("EXCLUDED"), "without the flag nothing is excluded");

  const run = runFixture(files, { version: 1, exclusions: [entry("tests/b-excluded.ts")] });
  assert.equal(run.status, 1, "a real failure still fails the run");
  assert.match(run.stdout, /^Test summary: 1 passed, 2 failed, 1 excluded, 0 not run, 4 total\.$/m, "every file is accounted for; an excluded file is counted on its own, never as a pass");
  assert.match(run.stdout, /^FAILED tests\/d-blocked\.ts \(exit 1\)$/m, "a blocked test is never a pass: it fails and is named");
  assert.ok(!/^PASS tests\/d-blocked\.ts$/m.test(run.stdout), "a blocked test is not a pass");
  assert.match(run.stdout, /^BLOCKED is not a separate count: /m, "the summary says BLOCKED is not distinguished, instead of reporting zero blocked");
  assert.ok(!run.stdout.includes("B-RAN") && !run.stdout.includes("PASS tests/b-excluded.ts"), "an excluded file does not run and is not a pass");
  assert.equal(run.stdout.match(/^EXCLUDED tests\/b-excluded\.ts \(BLOCKED\)$/gm)?.length, 2, "named when skipped and again next to the summary");
  assert.match(run.stdout, /^FAILED tests\/c-fail\.ts/m, "a failure outside the manifest is not hidden");

  const refusals: Record<string, unknown> = {
    "stale file": { version: 1, exclusions: [entry("tests/gone.ts")] },
    "duplicate": { version: 1, exclusions: [entry("tests/b-excluded.ts"), entry("tests/b-excluded.ts")] },
    "no reason": { version: 1, exclusions: [{ ...entry("tests/b-excluded.ts"), reason: " " }] },
    "no reassessment": { version: 1, exclusions: [{ ...entry("tests/b-excluded.ts"), reassess: "" }] },
    "open class": { version: 1, exclusions: [{ ...entry("tests/b-excluded.ts"), class: "FLAKY" }] },
    "wrong shape": { exclusions: [] },
  };
  for (const [label, manifest] of Object.entries(refusals)) {
    const r = runFixture(files, manifest);
    assert.equal(r.status, 2, `${label}: refused`);
    assert.ok(!/^PASS /m.test(r.stdout), `${label}: refused before any test runs`);
  }
  console.log(`PASS runner: exclusions counted apart, ${Object.keys(refusals).length} bad manifests refused before any test`);
}

workflowChecks();
negativeControls();
manifestChecks();
runnerChecks();
console.log("ci-quality-gates-1/workflow-firewall: ok");
