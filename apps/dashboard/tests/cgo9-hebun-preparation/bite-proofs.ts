/*
 * CGO-9 — BITE PROOFS.
 *
 * Each proof makes ONE targeted change to real source, runs the suite that is supposed to object, and
 * requires that the anchor was unique, the mutation applied, the suite failed FOR THE INTENDED
 * REASON, and the file came back byte-identical by sha256. A killed child is VOID, never a bite.
 *
 * ── THE ONE THAT MATTERS MOST ────────────────────────────────────────────────
 *
 * P1 restores the order CGO-9 removed: the model is invoked first and the durable-agent refusal is
 * checked afterwards. It typechecks, it lints, and every successful preparation still looks normal.
 * Only a tenant with no agent reveals it — by spending a model call and persisting messages for work
 * that could never be filed. P1b runs the same mutation against the amended AGENT-RUNTIME-0 suite, so
 * the deliberately amended assertion is proved to bite rather than merely to have been rewritten.
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

const SEAM = "src/features/work-artifacts/prepare-work-artifact.server.ts";
const SECTION = "src/components/operations-preparation/prepared-work-section.tsx";

const PG_SUITE = "tests/cgo9-hebun-preparation/preflight-and-provenance-postgres.ts";
const SURFACE_SUITE = "tests/cgo9-hebun-preparation/surface-and-firewall.ts";
const AR0_PG_SUITE = "tests/agent-runtime-0/attribution-postgres.ts";

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
    label: "P1 the model is invoked BEFORE the durable-agent refusal (the pre-CGO-9 order)",
    file: SEAM,
    suite: PG_SUITE,
    edits: [
      {
        find: "  if (authorship.status === \"refused\") {\n    return { status: \"refused\", reason: authorship.reason };\n  }\n",
        replace: "",
      },
      {
        find: "  const content = answer.outcome.response.body.join(\"\\n\");",
        replace: "  if (authorship.status === \"refused\") {\n    return { status: \"refused\", reason: authorship.reason, answer };\n  }\n  const content = answer.outcome.response.body.join(\"\\n\");",
      },
    ],
    because: "PREFLIGHT REFUSAL CARRIES NO ANSWER \u2014 no durable agent",
  },
  {
    label: "P1b the same reversed order, against the amended AGENT-RUNTIME-0 assertion",
    file: SEAM,
    suite: AR0_PG_SUITE,
    edits: [
      {
        find: "  if (authorship.status === \"refused\") {\n    return { status: \"refused\", reason: authorship.reason };\n  }\n",
        replace: "",
      },
      {
        find: "  const content = answer.outcome.response.body.join(\"\\n\");",
        replace: "  if (authorship.status === \"refused\") {\n    return { status: \"refused\", reason: authorship.reason, answer };\n  }\n  const content = answer.outcome.response.body.join(\"\\n\");",
      },
    ],
    because: "NO DURABLE AGENT, NO MODEL INVOCATION",
  },
  {
    label: "P2 the Claude provider control is not checked in preflight",
    file: SEAM,
    suite: PG_SUITE,
    edits: [
      {
        find: "  if (!directorEnabled) return { status: \"refused\", reason: \"model-connectivity-disabled\" };",
        replace: "  void directorEnabled;",
      },
    ],
    because: "Claude provider control off: model-connectivity-disabled",
  },
  {
    label: "P3 a new draft's classification is not validated before the model",
    file: SEAM,
    suite: PG_SUITE,
    edits: [
      {
        find: "    if (problems.length > 0) return { status: \"refused\", reason: \"invalid-input\", problems };",
        replace: "    void problems;",
      },
    ],
    because: "content draft with no declared destination: invalid-input",
  },
  {
    label: "P4 a retired target is not refused before the model",
    file: SEAM,
    suite: PG_SUITE,
    edits: [
      {
        find: "    if (target.lifecycleStatus === \"retired\") return { status: \"refused\", reason: \"artifact-retired\" };",
        replace: "",
      },
    ],
    because: "revision of a retired draft: artifact-retired",
  },
  {
    label: "P5 the model is not shown the revision it is revising",
    file: SEAM,
    suite: PG_SUITE,
    edits: [
      {
        find: "      currentRevision: { revisionNo: current.revisionNo, content: current.content },\n",
        replace: "",
      },
    ],
    because: "THE MODEL IS SHOWN THE REVISION IT IS REVISING",
  },
  {
    label: "P6 a Hebun revision is offered on every non-retired row, whatever its type",
    file: SECTION,
    suite: SURFACE_SUITE,
    edits: [
      {
        find: "      {!retired && artifact.artifactType === CONTENT_DRAFT_TYPE ? (",
        replace: "      {!retired ? (",
      },
    ],
    because: "a Hebun revision is offered only on a non-retired content draft",
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
  console.log(`cgo9-hebun-preparation/bite-proofs: ${bitten} mutations bit, 0 void`);
}

main();
