/*
 * DH-1 — BITE-PROOFS.
 *
 * Every guarantee this phase introduces is mutated in the SHIPPED SOURCE, and the suite that
 * defends it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the mutation changed the file, it reached disk, and the defending
 * suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically. Every child run is bounded: a hanging bite-proof is not a verdict.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const TRUTH = "tests/dh1-decision-horizon/horizon-truth.ts";
const FIREWALL = "tests/dh1-decision-horizon/horizon-firewall.ts";
const MODEL = "src/features/decision-horizon/read-decision-horizon.server.ts";
const PROJECTION = "src/features/decision-horizon/heby-decision-horizon-source.server.ts";
const PANEL = "src/components/decision-workspace/decision-horizon-panel.tsx";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;
const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(suite: string): { ok: boolean; output: string; timedOut: boolean } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT, encoding: "utf8", env: process.env,
    maxBuffer: 64 * 1024 * 1024, timeout: CHILD_TIMEOUT_MS,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    timedOut: result.signal === "SIGTERM" && result.status === null,
  };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /* THE SENTENCE THE WHOLE FEATURE EXISTS TO PROTECT. */
    label: "M1 a partial horizon calls itself complete",
    file: MODEL,
    suite: TRUTH,
    find: `    completeness: unavailableSources.length === 0 ? "complete" : "partial",`,
    replace: `    completeness: "complete",`,
    expect: "being unreadable makes the horizon PARTIAL",
  },
  {
    /*
     * CAUGHT BY THE COMPLETENESS VERDICT, which is the stronger guarantee: dropping an unreadable
     * source does not merely hide it, it makes the horizon CLAIM to be complete about a source it
     * never reported. The coverage assertion would catch it too; the verdict catches it first.
     */
    label: "M2 an unreadable source is dropped, so the horizon claims completeness about it",
    file: MODEL,
    suite: TRUTH,
    find: `  ].filter((block) => asked.has(block.source));`,
    replace: `  ].filter((block) => asked.has(block.source) && block.status === "answered");`,
    expect: "being unreadable makes the horizon PARTIAL",
  },
  {
    label: "M3 the Knowledge subtraction stops failing closed when Governance cannot answer",
    file: MODEL,
    suite: TRUTH,
    find: `  if (decided.status !== "read") {
    return {
      source: "knowledge-review",
      status: "unavailable",
      reason: \`governance-decision:\${decided.reason}\`,
    };
  }`,
    replace: `  if (decided.status !== "read") {
    return { source: "knowledge-review", status: "answered", total: 0, truncated: false, items: [] };
  }`,
    /*
     * The completeness verdict fires before the block-level assertion, and it is the same defect
     * seen one level up: a subtraction that stops failing closed reports a source as answered when
     * half of it could not be read.
     */
    expect: "being unreadable makes the horizon PARTIAL",
  },
  {
    label: "M4 an upstream truncated read is absorbed into a complete-looking block",
    file: MODEL,
    suite: TRUTH,
    find: `    truncated: truncated || read.truncated,`,
    replace: `    truncated,`,
    expect: "a truncated upstream read must not be absorbed",
  },
  {
    label: "M5 the total becomes the page size instead of what the source holds",
    file: MODEL,
    suite: TRUTH,
    find: `    total: pending.length,`,
    replace: `    total: kept.length,`,
    expect: "the TOTAL is the source's, not the page's",
  },
  {
    label: "M6 a decided hypothesis is reported as still awaiting a decision",
    file: MODEL,
    suite: TRUTH,
    find: `  const undecided = read.hypotheses.filter((h) => h.decision.status === "undecided");`,
    replace: `  const undecided = read.hypotheses;`,
    expect: "a decided hypothesis is not awaiting a decision",
  },
  {
    /* THE MOST EXPENSIVE SENTENCE THIS CLASS CAN GET WRONG. */
    label: "M7 the empty sentence is said even when a source could not answer",
    file: PROJECTION,
    suite: TRUTH,
    find: `  if (unavailable.length > 0) {`,
    replace: `  if (false) {`,
    expect: "a partial horizon says so",
  },
  {
    label: "M8 the action half is re-derived instead of taken from the released projection",
    file: PROJECTION,
    suite: FIREWALL,
    find: `import { readDecisionQueueGroundingSource } from "@/features/action-authorization/heby-decision-queue-source.server";`,
    replace: `import { readPendingActionRequests } from "@/features/action-authorization/read-action-authorizations.server";\nconst readDecisionQueueGroundingSource = readPendingActionRequests as never;`,
    expect: "it never reaches past it to the raw seam",
  },
  {
    label: "M9 the class silently loses two of its three owners",
    file: ANSWER,
    suite: FIREWALL,
    find: `import { readDecisionHorizonGroundingSource } from "@/features/decision-horizon/heby-decision-horizon-source.server";`,
    replace: `import { readDecisionQueueGroundingSource as readDecisionHorizonGroundingSource } from "@/features/action-authorization/heby-decision-queue-source.server";`,
    expect: "one class, one resolution",
  },
  {
    label: "M10 the surface says nothing is waiting without checking completeness",
    file: PANEL,
    suite: FIREWALL,
    find: `  const nothingWaiting = complete && horizon.answeredTotal === 0;`,
    replace: `  const nothingWaiting = horizon.answeredTotal === 0;`,
    expect: "may say `nothing is waiting` only when the horizon is COMPLETE",
  },
];

function withMutation(mutation: Mutation, body: () => void): void {
  const original = readFile(mutation.file);
  const before = sha(original);
  assert.ok(
    original.includes(mutation.find),
    `${mutation.label}: the find-string is not present in ${mutation.file} — the mutation would prove nothing`,
  );
  const mutated = original.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, original, `${mutation.label}: the mutation changed nothing`);
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    assert.equal(sha(readFile(mutation.file)), sha(mutated), `${mutation.label}: the mutation did not reach disk`);
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(sha(readFile(mutation.file)), before, `${mutation.file} was not restored byte-identically`);
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(mutation.suite);
      assert.equal(run.timedOut, false, `${mutation.label}: the defending suite TIMED OUT. VOID, not a bite.`);
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${mutation.suite} still passed.\n--- actual ---\n${run.output.slice(-1500)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: failed, but not for the intended reason. Expected "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2000)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }
  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`dh1-decision-horizon/bite-proofs: ${bitten} mutations bit`);
}

main();
