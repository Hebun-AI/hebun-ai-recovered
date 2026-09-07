/*
 * TRH-20 — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite.
 *
 * ── THE ONES THAT MATTER MOST ────────────────────────────────────────────────
 *
 * M2 and M3 are the two edits a reviewer would wave through. M2 puts the observation in front of
 * the candidates, which reads like "show the model the context first" and instead lets provider
 * text sit where the choice space is stated. M3 stops overwriting a caller-supplied supplement,
 * which reads like "respect what the caller passed" and instead opens a channel through which any
 * caller — one day, a boundary — could write unfenced text straight into the model's grounding.
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

const BRIEF = "src/features/content-observation/growth-origination-brief.ts";
const COMPOSITION = "src/features/content-observation/originate-with-observation.server.ts";
const ORIGINATION = "src/features/agent-origination/originate-action.server.ts";

const TRUTH_SUITE = "tests/trh20-governed-growth-proposal/truth-and-firewall.ts";
const PG_SUITE = "tests/trh20-governed-growth-proposal/growth-origination-postgres.ts";

const CHILD_TIMEOUT_MS = 600_000;

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
  const killed = result.signal !== null || result.status === null;
  return { ok: result.status === 0, void: killed, output };
}

interface Mutation {
  readonly label: string;
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  /** A PRODUCT REASON CODE or an EXPLICIT assertion message — never a bare English word. */
  readonly because: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── A PROPOSAL MUST SAY WHAT IT IS BEFORE THE MODEL MAKES ONE ───────────── */
  {
    label: "M1 the fence stops saying that a proposal is not a claim",
    file: BRIEF,
    suite: TRUTH_SUITE,
    find:
      '  "A proposal is a request for a human to read and decide on. It is not a claim, not a finding, not a measurement and not a decision, and nothing you propose happens because you proposed it.",\n',
    replace: '  "A proposal is a request.",\n',
    because: "the fence must say what a proposal IS before the model makes one",
  },
  /* ── GROUNDING IS NEVER A CANDIDATE ──────────────────────────────────────── */
  {
    label: "M2 the observation is placed in front of the candidate lines",
    file: ORIGINATION,
    suite: PG_SUITE,
    find: "  const evidence = supplement ? [...candidateLines(candidates), supplement] : candidateLines(candidates);",
    replace: "  const evidence = supplement ? [supplement, ...candidateLines(candidates)] : candidateLines(candidates);",
    because: "the candidates come first and the observation after",
  },
  /* ── NOBODY BUT THIS MODULE MAY WRITE THE GROUNDING ──────────────────────── */
  {
    label: "M3 a caller-supplied supplement is honoured instead of overwritten",
    file: COMPOSITION,
    suite: TRUTH_SUITE,
    find:
      "      origination: await originate({ goal: input.goal }, { ...deps, observationSupplement: undefined }),",
    replace: "      origination: await originate({ goal: input.goal }, { ...deps }),",
    because: "every origination call overwrites any caller-supplied supplement with the composed one",
  },
  /* ── AN UNAVAILABLE METRIC IS DENIED BY NAME, NOT BY CATEGORY ────────────── */
  {
    label: "M4 the fence denies unavailable metrics generically instead of by name",
    file: BRIEF,
    suite: TRUTH_SUITE,
    find:
      "  `This observation contains ONLY the figures printed below. ${UNAVAILABLE_GROWTH_METRICS.join(\", \")} are NOT available to you here, and you must not state, estimate, approximate or infer any of them.`,\n",
    replace:
      '  "This observation contains ONLY the figures printed below. Other metrics are NOT available to you here.",\n',
    because: 'the fence must deny "watch time" by name',
  },
];

interface Verdict {
  readonly label: string;
  readonly bit: boolean;
  readonly void: boolean;
  readonly detail: string;
}

function proveOne(mutation: Mutation): Verdict {
  const before = read(mutation.file);
  const digest = sha(before);

  const occurrences = before.split(mutation.find).length - 1;
  if (occurrences !== 1) {
    return {
      label: mutation.label,
      bit: false,
      void: true,
      detail: `anchor is not unique in ${mutation.file} (found ${occurrences})`,
    };
  }

  const mutated = before.replace(mutation.find, mutation.replace);
  assert.notEqual(mutated, before, `${mutation.label}: the mutation must change the file`);

  let run: Run;
  try {
    writeFileSync(abs(mutation.file), mutated, "utf8");
    run = runSuite(mutation.suite);
  } finally {
    writeFileSync(abs(mutation.file), before, "utf8");
  }

  const restored = sha(read(mutation.file));
  assert.equal(restored, digest, `${mutation.label}: ${mutation.file} must be restored byte-identically`);

  if (run.void) {
    return { label: mutation.label, bit: false, void: true, detail: "child run was killed — VOID" };
  }
  if (run.ok) {
    return { label: mutation.label, bit: false, void: false, detail: "the suite PASSED against mutated source" };
  }
  if (!run.output.includes(mutation.because)) {
    return {
      label: mutation.label,
      bit: false,
      void: false,
      detail: `the suite failed, but not for the intended reason (${mutation.because})`,
    };
  }
  return { label: mutation.label, bit: true, void: false, detail: `bit on: ${mutation.because}` };
}

function main(): void {
  const verdicts = MUTATIONS.map(proveOne);
  for (const verdict of verdicts) {
    console.log(`${verdict.bit ? "BIT " : verdict.void ? "VOID" : "MISS"}  ${verdict.label} — ${verdict.detail}`);
  }
  const missed = verdicts.filter((v) => !v.bit);
  assert.equal(
    missed.length,
    0,
    `every guard must bite; ${missed.length} did not: ${missed.map((v) => v.label).join(", ")}`,
  );
  console.log(`PASS trh20-governed-growth-proposal bite proofs (${verdicts.length}/${verdicts.length} bit)`);
}

main();
