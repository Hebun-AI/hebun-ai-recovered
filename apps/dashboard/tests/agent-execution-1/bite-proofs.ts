/*
 * AGENT-EXECUTION-1 — bite-proofs for the hardening: each mutation removes ONE guard, and the released
 * Postgres suite must fail for that guard's own reason.
 *
 *   B1 the preparation seam no longer refuses an unmandated author before the model   (E13)
 *   B2 the mandate is not asked again after the model answered                        (E14)
 *   B3 the assignment lock no longer refuses a second request in flight                (E15)
 *   B4 the preparation seam takes the work scope from the request body                 (E13)
 *   B5 the assignment seam stops handing the work item's scope to the preparation seam (E13)
 *
 * Source-mutating, so this file runs its children SEQUENTIALLY and never in parallel with them.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const abs = (f: string): string => path.join(ROOT, f);
const read = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

const PREPARE = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const ASSIGN = "src/features/agent-work/assign-work-draft.server.ts";
const PG_SUITE = "tests/agent-execution-1/assignment-postgres.ts";
const CHILD_TIMEOUT_MS = 300_000;

interface Run {
  readonly ok: boolean;
  readonly void: boolean;
  readonly output: string;
}

function runSuite(suite: string): Run {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  /* A kill leaves `signal` set and `status` null. Neither is an assertion result. */
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

interface Edit {
  readonly find: string;
  readonly replace: string;
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly edits: readonly Edit[];
  /** A PRODUCT REASON CODE or an EXPLICIT assertion message — never a bare English word. */
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "B1 an unmandated author is not refused before the model",
    file: PREPARE,
    suite: PG_SUITE,
    edits: [{ find: "  if (ceilingRefusal) return { status: \"refused\", reason: ceilingRefusal };\n", replace: "" }],
    because: "E13 no mandate",
  },
  {
    label: "B2 the mandate is not asked again before filing",
    file: PREPARE,
    suite: PG_SUITE,
    edits: [{ find: "  if (await askCeiling()) return", replace: "  if (false as boolean) return" }],
    because: "E14: a mandate withdrawn mid-call files nothing",
  },
  {
    label: "B3 a second assignment in flight is not refused",
    file: ASSIGN,
    suite: PG_SUITE,
    edits: [{ find: "?.locked !== true) {", replace: "?.locked === null) {" }],
    because: "E15: one assignment wins, the others are refused in progress",
  },
  {
    label: "B4 the work scope is read from the request body",
    file: PREPARE,
    suite: PG_SUITE,
    edits: [{ find: "const workScope = deps.workScope ?? ORGANIZATION_WORK;", replace: "const workScope = (input as { workScope?: WorkScope }).workScope ?? deps.workScope ?? ORGANIZATION_WORK;" }],
    because: "E13 a client-supplied workScope input widens nothing",
  },
  {
    label: "B5 the assignment seam does not hand over the work item's scope",
    file: ASSIGN,
    suite: PG_SUITE,
    edits: [{ find: ", workScope: target.target.workScope },", replace: " }," }],
    because: "E13: domain responsibility admits that domain's work",
  },
];

const voided: string[] = [];
let bitten = 0;

function withMutation(
  label: string,
  file: string,
  edits: readonly Edit[],
  body: () => void,
): void {
  const original = read(file);
  const before = sha(original);

  /* EVERY ANCHOR MUST BE UNIQUE. `replace` takes the first match; two matches is a different proof. */
  let mutated = original;
  for (const edit of edits) {
    const occurrences = mutated.split(edit.find).length - 1;
    assert.equal(
      occurrences,
      1,
      `${label}: the mutation anchor must appear exactly once in ${file}, found ${occurrences} — ` +
        `a non-unique anchor mutates a line the proof did not choose`,
    );
    mutated = mutated.replace(edit.find, edit.replace);
  }

  try {
    writeFileSync(abs(file), mutated, "utf8");
    assert.notEqual(
      sha(read(file)),
      before,
      `${label}: the mutation did not reach ${file} — the proof would be vacuous`,
    );
    /* EVERY edit landed, by exact content — a partial application is a different proof. */
    assert.equal(
      read(file),
      mutated,
      `${label}: ${file} on disk is not the text this proof composed — the mutation is partial`,
    );
    body();
  } finally {
    writeFileSync(abs(file), original, "utf8");
    assert.equal(sha(read(file)), before, `${label}: ${file} was not restored byte-identically`);
  }
}

function main(): void {
  for (const mutation of MUTATIONS) {
    withMutation(mutation.label, mutation.file, mutation.edits, () => {
      const run = runSuite(mutation.suite);
      if (run.void) {
        voided.push(mutation.label);
        return;
      }
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
      );
      assert.ok(
        run.output.includes(mutation.because),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.because}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    if (!voided.includes(mutation.label)) {
      bitten += 1;
      console.log(`BITE ${mutation.label}`);
    }
  }

  assert.deepEqual(voided, [], `these proofs were VOID (child killed), not passes: ${voided.join(", ")}`);
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`agent-execution-1/bite-proofs: ${bitten} mutations bit, 0 void`);
}

main();
