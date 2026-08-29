/*
 * L2 — HEBY CORE v1 — BITE-PROOFS.
 *
 * The composition this milestone introduced is mutated in the SHIPPED SOURCE, and the suite
 * defending it must fail — for the INTENDED reason, not merely for some reason.
 *
 * Three conditions per mutation: the find-string is present (so the mutation APPLIES — a mutation
 * that cannot be applied looks exactly like one that failed to bite), it reached disk, and the
 * defending suite failed naming the intended reason. Restoration runs in `finally` and is verified
 * byte-identically, so a failure never leaves mutated source behind.
 *
 * Each child is bounded. A hanging bite-proof is not a verdict, so a child that exceeds its timeout
 * is reported VOID rather than counted as bitten.
 *
 * The `/help` axis is defended in `tests/hebycap1-flow/bite-proofs.ts` (M2b), by the phase that owns
 * that projection. These are the two axes L2 itself owns: where the composition is MADE, and where
 * the Platform card RENDERS it.
 *
 * No database, no network, no provider, no key, no model.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const SUITE = "tests/l2-heby-core/model-dispatch-truth.ts";
const OPS_PROJECTION = "src/features/heby-provider-ops/provider-connectivity-projection.server.ts";
const CARD = "src/components/platform-providers/provider-connectivity-control-card.tsx";
const ANSWER = "src/features/heby-answer/model-answer.server.ts";

/** Generous, but finite. This suite opens nothing, so it is fast. */
const CHILD_TIMEOUT_MS = 5 * 60 * 1000;

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

interface SuiteRun {
  readonly ok: boolean;
  readonly output: string;
  readonly timedOut: boolean;
}

function runSuite(suite: string): SuiteRun {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: CHILD_TIMEOUT_MS,
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
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    /*
     * THE DEFECT ITSELF, PUT BACK. Drop the Director operand and the composition becomes the
     * configuration classification again — which is what the product shipped reading.
     */
    label: "L1 the Director operand is dropped from the composition",
    file: OPS_PROJECTION,
    find: `  const dispatch: ModelDispatchState = !directorEnabled\n    ? "blocked-by-director"`,
    replace: `  const dispatch: ModelDispatchState = false\n    ? "blocked-by-director"`,
    expect: "director=false availability=AVAILABLE: dispatch",
  },
  {
    /*
     * THE OTHER HALF. Keep the Director and drop the configuration, and a deployment with no
     * credential and no transport is told an attempt may be made.
     */
    label: "L2 the availability operand is dropped from the composition",
    file: OPS_PROJECTION,
    find: `    : availability === "AVAILABLE"\n      ? "permitted"\n      : "blocked-by-availability";`,
    replace: `    : "permitted";`,
    expect: "director=true availability=TRANSPORT_UNAVAILABLE: dispatch",
  },
  {
    /*
     * THE FIELD THAT MUST NOT MOVE. `availability` keeps its released meaning exactly; folding the
     * Director into it instead would make a pure evaluator's output depend on a durable row and
     * leave every reader unable to tell the two refusals apart.
     */
    label: "L3 the Director is folded into `availability` instead of composed beside it",
    file: OPS_PROJECTION,
    find: `    availability,\n    dispatch,`,
    replace: `    availability: directorEnabled ? availability : "DISABLED",\n    dispatch,`,
    expect: "availability is the configuration classification and nothing else",
  },
  {
    /*
     * THE CARD GOES BACK TO RENDERING A VERDICT THAT CANNOT SEE THE KILL SWITCH — a green pill in
     * the one state the kill switch exists to produce.
     */
    label: "L4 the Platform card renders `availability` as the dispatch verdict again",
    file: CARD,
    find: `<Pill tone={dispatchTone} label={DISPATCH_LABEL[view.dispatch]} />`,
    replace: `<Pill tone={availabilityTone} label={AVAILABILITY_LABEL[view.availability]} />`,
    expect: "the card renders the composed verdict",
  },
  {
    /*
     * THE ORDER IS PART OF THE CLAIM. A composition in the request path's order is only truthful
     * while that IS the order; moving transport selection ahead of the Director read would make
     * this milestone's sentence false even with every value unchanged.
     */
    label: "L5 the runtime selects a transport before reading the Director control",
    file: ANSWER,
    find: `    const selection = (deps.selectTransport ?? selectModelTransport)(env);`,
    replace: `    const selection = (deps.selectTransportEarly ?? selectModelTransport)(env);`,
    expect: "the Director control is read BEFORE a transport is selected",
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
    assert.equal(
      sha(readFile(mutation.file)),
      sha(mutated),
      `${mutation.label}: the mutation did not reach disk`,
    );
    body();
  } finally {
    writeFileSync(abs(mutation.file), original, "utf8");
  }
  assert.equal(
    sha(readFile(mutation.file)),
    before,
    `${mutation.file} was not restored byte-identically`,
  );
}

function main(): void {
  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation, () => {
      const run = runSuite(SUITE);
      assert.equal(
        run.timedOut,
        false,
        `${mutation.label}: the defending suite TIMED OUT after ${CHILD_TIMEOUT_MS}ms. That is a ` +
          "VOID result, not a bite.",
      );
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the mutation SURVIVED — ${SUITE} still passed.\n` +
          `--- actual ---\n${run.output.slice(-2000)}`,
      );
      assert.ok(
        run.output.includes(mutation.expect),
        `${mutation.label}: the suite failed, but not for the intended reason. Expected output ` +
          `containing "${mutation.expect}".\n--- actual ---\n${run.output.slice(-2500)}`,
      );
    });
    bitten += 1;
    console.log(`BITE ${mutation.label}`);
  }

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(`l2-heby-core/bite-proofs: ${bitten} mutations bit`);
}

main();
