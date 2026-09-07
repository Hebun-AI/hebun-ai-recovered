/*
 * TRH-20-FIX — BITE PROOFS.
 *
 * A guard nobody has watched fail is a guard nobody has evidence for. Each proof makes ONE targeted
 * change to real source, runs the suite that is supposed to object, and requires four things: the
 * anchor was UNIQUE, the mutation APPLIED, the suite FAILED FOR THE INTENDED REASON, and the file
 * came back byte-identical by sha256.
 *
 * A proof whose child run is killed is VOID and reported as such — never counted as a bite.
 *
 * ── THE ONE THAT MATTERS MOST ────────────────────────────────────────────────
 *
 * M1 removes the `videoCount === 0` condition. It reads like tidying a redundant clause — the
 * playlist already said not-found, so why check the count? — and it converts every unreadable
 * uploads playlist into a confident "this channel has nothing". That is a FABRICATED FACT reaching
 * a model and a human, which is strictly worse than the outage it replaced. Nothing crashes and no
 * type changes; only this proof shows it.
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

const OBSERVATION = "src/features/provider-youtube/read-channel-observation.server.ts";
const TRANSPORT = "src/features/provider-youtube/youtube-transport.server.ts";

const SUITE = "tests/trh20-empty-channel-observation/empty-channel-truth.ts";

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
  /* ── ONLY A REPORTED ZERO MAY CONVERT A FAILURE INTO A FACT ──────────────── */
  {
    label: "M1 the videoCount === 0 condition is dropped from the conversion",
    file: OBSERVATION,
    suite: SUITE,
    find: "      if (!(uploads.failure === \"not-found\" && channelReportsNoVideos)) return uploads;",
    replace: "      if (!(uploads.failure === \"not-found\")) return uploads;",
    because: "videoCount > 0 + playlist not-found must still fail",
  },
  /* ── AND ONLY THE not-found CLASS MAY CONVERT AT ALL ─────────────────────── */
  {
    label: "M2 any playlist failure converts, not only not-found",
    file: OBSERVATION,
    suite: SUITE,
    find: "      const channelReportsNoVideos = channel.value.channel.videoCount === 0;",
    replace: "      const channelReportsNoVideos = true;",
    because: "videoCount > 0 + playlist not-found must still fail",
  },
  /* ── THE QUOTA REPORTS WHAT WENT OUT, NOT WHAT THE SHAPE IMPLIES ─────────── */
  {
    label: "M3 the quota is derived from the result shape again instead of counted",
    file: OBSERVATION,
    suite: SUITE,
    find: "      quotaUnitsSpent: Math.min(operations, OBSERVATION_QUOTA_UNITS),",
    replace: "      quotaUnitsSpent: OBSERVATION_QUOTA_UNITS,",
    because: "two operations happened, so two are reported",
  },
  /* ── THE PROVIDER'S OWN WORD SURVIVES A 404 ──────────────────────────────── */
  {
    label: "M4 the 404 diagnostic collapses back to a bare string",
    file: TRANSPORT,
    suite: SUITE,
    find: '  if (status === 404) return fail("not-found", `youtube-http-404:${r || "no-reason"}`);',
    replace: '  if (status === 404) return fail("not-found", "youtube-http-404");',
    because: "the provider's own word is preserved",
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
  console.log(`PASS trh20-empty-channel-observation bite proofs (${verdicts.length}/${verdicts.length} bit)`);
}

main();
