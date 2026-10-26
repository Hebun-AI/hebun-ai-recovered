/*
 * HEBY-WORKFLOW-1 — bite-proofs: each mutation removes ONE guard of the revision flow, and the released
 * Postgres suite must fail for that guard's own reason.
 *
 *   B1 the revision text joins the instruction channel                         (W1)
 *   B2 an internal draft's revision is briefed without its current text (D1)   (W1)
 *   B3 the revision seam stops handing the work item's scope to the seam       (W1)
 *   B4 the link check accepts a draft that is not this work's evidence         (W4)
 *   B5 the standing change request is not asked before the model               (W3)
 *   B6 the per-draft lock no longer refuses a second request in flight         (W8)
 *   B7 the requester's Governance right is not asked again under the writer lock (W11)
 *
 * Source-mutating, so this file runs its children SEQUENTIALLY, and only in a disposable copy of the tree.
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

const BRIEF = "src/features/work-artifacts/preparation-brief.ts";
const PREPARE = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const ASSIGN = "src/features/agent-work/assign-work-draft.server.ts";
const PG_SUITE = "tests/heby-workflow-1/revision-postgres.ts";
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
    label: "B1 the revision text joins the instruction channel",
    file: BRIEF,
    suite: PG_SUITE,
    edits: [{ find: 'revisionInstruction(input.currentRevision.revisionNo, "internal draft")]),', replace: 'revisionInstruction(input.currentRevision.revisionNo, "internal draft"), hebunInstruction(revisionBasis(input.currentRevision))]),' }],
    because: "W1: the revision text never enters the instruction channel",
  },
  {
    label: "B2 an internal revision is briefed without its current text",
    file: BRIEF,
    suite: PG_SUITE,
    edits: [{ find: "    if (!input.currentRevision) return { instruction: brief, material: [] };\n", replace: "    return { instruction: brief, material: [] };\n" }],
    because: "W1: the revision framing is instruction",
  },
  {
    label: "B3 the revision is prepared at organization scope",
    file: ASSIGN,
    suite: PG_SUITE,
    edits: [{ find: "{ ...deps.preparation, resolveTenant: deps.resolveTenant, workScope: scope },", replace: "{ ...deps.preparation, resolveTenant: deps.resolveTenant }," }],
    because: "work-outside-agent-responsibility",
  },
  {
    label: "B4 the link check accepts any draft",
    file: ASSIGN,
    suite: PG_SUITE,
    edits: [{
      find: "    const draft = linked.drafts.find((candidate) => candidate.artifactId === artifactId);\n",
      replace: "    const draft = linked.drafts.find((candidate) => candidate.artifactId === artifactId) ?? ({ ...linked.drafts[0], artifactId, retired: false, review: \"changes-requested\" } as WorkDraftView);\n",
    }],
    because: "W4 another work's draft",
  },
  {
    label: "B5 the standing change request is not asked before the model",
    file: ASSIGN,
    suite: PG_SUITE,
    edits: [{ find: 'if (draft.retired || draft.review !== "changes-requested") return', replace: 'if (false as boolean) return' }],
    because: "W3 no second revision from the spent request",
  },
  {
    label: "B6 the per-draft lock no longer refuses a request in flight",
    file: ASSIGN,
    suite: PG_SUITE,
    edits: [{ find: "const held = (lock.rows[0] as { locked?: unknown } | undefined)?.locked === true;", replace: "const held = lock !== null;" }],
    because: "W8: four refused revision-in-progress",
  },
  {
    label: "B7 the requester's Governance right is not asked under the writer lock",
    file: PREPARE,
    suite: PG_SUITE,
    edits: [{ find: "!(await mayReviseFromReview(tx, tenant)) ||", replace: "" }],
    because: "W11 revoked authority",
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
  console.log(`heby-workflow-1/bite-proofs: ${bitten} mutations bit, 0 void`);
}

main();
