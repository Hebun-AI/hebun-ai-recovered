/*
 * AOR-1b — bite-proofs: each mutation removes ONE guard of the internal-draft mode, and the suite named
 * must fail for that guard's own reason.
 *
 *   B1 the mode reaches content drafts                                   (P3)
 *   B2 the mode is honoured without a preparing intent                   (P4)
 *   B3 the seam never sets the mode                                      (P1)
 *   B4 the attribution exemption returns in an internal draft            (P2 attributed)
 *   B5 clauses are not split                                             (D3)
 *   B6 a completed auxiliary is judged as pending                        (D2)
 *   B7 a coordinator no longer ends a marker's reach                     (D3)
 *   B9 an attributive participle ignores the word before it              (D8, AOR-1b-ATTRIBUTIVE-1)
 *   B10 a completed chain is inherited across a coordinator as permitted (D8, AOR-1b-ATTRIBUTIVE-1)
 *   B8 self-attribution is not refused in an internal draft              (D2)
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

const VALIDATOR = "src/features/heby-runtime/response-validator.ts";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";
const PREPARE = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const PG_SUITE = "tests/aor-1b/draft-mode-postgres.ts";
const CONTRACT = "tests/aor-1b/draft-claims-contract.ts";
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
    label: "B1 the mode reaches content drafts",
    file: PREPARE,
    suite: PG_SUITE,
    edits: [{ find: '...(publicContent ? {} : { actionClaimMode: "internal-draft" as const }),', replace: '...({ actionClaimMode: "internal-draft" as const }),' }],
    because: "P3 content draft",
  },
  {
    label: "B2 the mode is honoured without a preparing intent",
    file: ANSWER,
    suite: PG_SUITE,
    edits: [{ find: "actionClaims: HEBY_INTENT_DESCRIPTORS[intent].prepares ? options.actionClaimMode : undefined,", replace: "actionClaims: options.actionClaimMode," }],
    because: "P4 mode without a preparing intent",
  },
  {
    label: "B3 the seam never sets the mode",
    file: PREPARE,
    suite: PG_SUITE,
    edits: [{ find: '...(publicContent ? {} : { actionClaimMode: "internal-draft" as const }),', replace: "...({})," }],
    because: "P1 planning language is filed",
  },
  {
    label: "B4 the attribution exemption returns in an internal draft",
    file: VALIDATOR,
    suite: PG_SUITE,
    edits: [{ find: "        if (negated) continue;\n        /* The auxiliary", replace: "        if (negated) continue;\n        if (namesAnotherActor(tokens, site.index, site.length)) continue;\n        /* The auxiliary" }],
    because: "P2 attributed",
  },
  {
    label: "B5 clauses are not split",
    file: VALIDATOR,
    suite: CONTRACT,
    edits: [{ find: "for (const clause of sentence.split(/[,;:()/]+|\\s[-–—]\\s/)) {", replace: "for (const clause of [sentence]) {" }],
    because: "Confirm approval, the release is approved.",
  },
  {
    label: "B6 a completed auxiliary is judged as pending",
    file: VALIDATOR,
    suite: CONTRACT,
    edits: [{ find: "        if (completed) {", replace: "        if (false as boolean) {" }],
    because: "Once the plan was approved the work started.",
  },
  {
    label: "B7 a coordinator no longer ends a marker's reach",
    file: VALIDATOR,
    suite: CONTRACT,
    edits: [{ find: "    if (COORDINATORS.has(token)) return false;\n", replace: "" }],
    because: "Ask if done and it was executed.",
  },
  {
    label: "B8 self-attribution is not refused in an internal draft",
    file: VALIDATOR,
    suite: CONTRACT,
    edits: [{ find: "        if (isSelfAttributed(tokens, site.index, site.length)) {\n          if (!negated) return true;", replace: "        if (false as boolean) {\n          if (!negated) return true;" }],
    because: "Once approved by me, proceed.",
  },
  {
    label: "B9 an attributive participle ignores the word before it",
    file: VALIDATOR,
    suite: CONTRACT,
    edits: [{ find: "  return ATTRIBUTIVE_DETERMINERS.has(before) || ATTRIBUTIVE_PREPOSITIONS.has(before);", replace: "  return true;" }],
    because: "The agent authorized access",
  },
  {
    label: "B10 a completed chain is inherited across a coordinator as permitted",
    file: VALIDATOR,
    suite: CONTRACT,
    edits: [{ find: "  if (chain.some((token) => COMPLETED_AUX.has(token))) return false;\n  if (chain.length === 0) return coordinatedWithPermittedFrame", replace: "  if (chain.length === 0) return coordinatedWithPermittedFrame" }],
    because: "Proceed only if the role was documented and approved.",
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
  console.log(`aor-1b/bite-proofs: ${bitten} mutations bit, 0 void`);
}

main();
