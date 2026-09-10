/*
 * YT-SOC1 BITE-PROOFS — eleven mutations of the REAL derivation, plus one correct change.
 *
 * Both YT-SOC1 suites passed on their first run. That is the moment to distrust them: TRH-IG7 was a
 * test that asserted a token existed and stayed green while the property it named was false in
 * production. A guard nobody has watched fail is a guess.
 *
 * Four conditions per proof: the mutation APPLIED, the run FAILED, it failed for the INTENDED
 * REASON, and the file came back byte-identical by sha256. Restoration runs in `finally`.
 *
 * The twelfth case runs the other way: a behaviour-preserving rewrite must be ACCEPTED, so the
 * suites are shown to test the rule rather than the spelling.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const BEHAVIOUR = "tests/youtube-social-intelligence/channel-series-behaviour.ts";
const FIREWALL = "tests/youtube-social-intelligence/derivation-firewall.ts";
const MODULE = "src/features/youtube-channel-surface/channel-measurement-series.ts";

const abs = (f: string): string => path.join(ROOT, f);
const readFile = (f: string): string => readFileSync(abs(f), "utf8");
const sha = (s: string): string => createHash("sha256").update(s).digest("hex");

function runSuite(suite: string): { ok: boolean; output: string } {
  const result = spawnSync(process.execPath, ["--import", "tsx", suite], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 300_000,
  });
  assert.ok(!result.error, `the child run of ${suite} failed to execute: ${result.error?.message}`);
  return { ok: result.status === 0, output: `${result.stdout ?? ""}${result.stderr ?? ""}` };
}

interface Mutation {
  readonly label: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  /* ── THE ZERO SEMANTICS — THIS TENANT'S ENTIRE REALITY ──────────────────── */
  {
    /*
     * DELIBERATELY NARROW. Discarding EVERY zero — the obvious mutation — makes all three counts
     * null, so this tenant's observations stop being usable at all and the failure lands on the
     * usability guard instead. That is a louder result and a worse proof: it says nothing about
     * whether a zero SURVIVES. Zeroing only the subscriber count keeps the row measurable, so the
     * assertion it reaches is the one actually under test.
     */
    label: "M1 a reported zero is treated as an absence",
    suite: BEHAVIOUR,
    find: "    subscriberCount,\n    subscriberCountAbsence,",
    replace: "    subscriberCount: subscriberCount === 0 ? null : subscriberCount,\n    subscriberCountAbsence,",
    expect: "0 subscribers is a measurement, not an absence",
  },
  {
    label: "M2 a withheld count is reported as zero",
    suite: BEHAVIOUR,
    find: "    subscriberCount,\n    subscriberCountAbsence,",
    replace: "    subscriberCount: subscriberCount ?? 0,\n    subscriberCountAbsence,",
    expect: "a hidden count is null, never zero",
  },

  /* ── HIDDEN IS NOT NOT-REPORTED ─────────────────────────────────────────── */
  {
    label: "M3 the two absence reasons are collapsed into one",
    suite: BEHAVIOUR,
    find: "    subscriberCount !== null ? null : hidden ? \"hidden-by-channel\" : \"not-reported\";",
    replace: "    subscriberCount !== null ? null : \"not-reported\";",
    expect: "the channel hides it",
  },
  {
    label: "M4 a non-boolean hidden flag is accepted as proof of hiding",
    suite: BEHAVIOUR,
    find: "  const hidden = (observation.facts as Record<string, unknown>)[HIDDEN_SUBSCRIBER_COUNT] === true;",
    replace: "  const hidden = Boolean((observation.facts as Record<string, unknown>)[HIDDEN_SUBSCRIBER_COUNT]);",
    expect: "is not the boolean the contract specifies",
  },
  {
    label: "M5 a contradictory hidden flag discards a real reported count",
    suite: BEHAVIOUR,
    find: "    subscriberCount !== null ? null : hidden ? \"hidden-by-channel\" : \"not-reported\";",
    replace: "    hidden ? \"hidden-by-channel\" : subscriberCount !== null ? null : \"not-reported\";",
    expect: "no absence is invented for it",
  },

  /* ── ORDER IS CHOSEN, NOT INHERITED ─────────────────────────────────────── */
  {
    label: "M6 the seam's newest-first order is inherited instead of normalised",
    suite: BEHAVIOUR,
    find: "  points.sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0));",
    replace: "  /* no ordering */",
    expect: "OLDEST FIRST",
  },

  /* ── ONE MEASUREMENT IS NOT A SERIES ────────────────────────────────────── */
  {
    label: "M7 a lone measurement is returned as a one-element series",
    suite: BEHAVIOUR,
    find: "  if (points.length === 1) {",
    replace: "  if (false) {",
    expect: "one usable measurement gets its own status",
  },

  /* ── AN OBSERVATION OF NOTHING IS NOT A MEASUREMENT, AND NOT AN ABSENCE ── */
  {
    label: "M8 an observation reporting no counts at all enters the series",
    suite: BEHAVIOUR,
    find: "  if (subscriberCount === null && videoCount === null && viewCount === null) return null;",
    replace: "  /* every observation is usable */",
    expect: "an observation with no counts measures nothing",
  },
  {
    label: "M9 holding no observation is reported as holding unusable ones",
    suite: BEHAVIOUR,
    find: "  if (observationsConsidered === 0) return Object.freeze({ status: \"no-observations\" as const });",
    replace:
      "  if (observationsConsidered === 0) return Object.freeze({ status: \"no-usable-measurements\" as const, observationsConsidered });",
    expect: "zero observations is its own answer",
  },

  /* ── A PAGE COUNT IS NOT A CHANNEL TOTAL ────────────────────────────────── */
  {
    label: "M10 the bounded recent-uploads page is measured as the channel's video total",
    suite: FIREWALL,
    find: "const VIDEO_COUNT = \"videoCount\";",
    replace: "const VIDEO_COUNT = \"recentVideoCount\";",
    expect: "never `recentVideoCount`, one page",
  },

  /* ── THE BOUNDARY ITSELF ────────────────────────────────────────────────── */
  {
    label: "M11 a derived quantity is added to the measurement contract",
    suite: FIREWALL,
    find: "  readonly viewCount: number | null;\n}",
    replace: "  readonly viewCount: number | null;\n  readonly subscriberGrowth: number | null;\n}",
    expect: "no derived-quantity vocabulary",
  },
];

/**
 * A REWRITE THAT CHANGES NOTHING MUST BE ACCEPTED.
 *
 * The comparator is spelled differently and orders identically. A suite that rejects this is
 * asserting on source text rather than behaviour — the same failure mode as above, in reverse.
 */
const ACCEPTED = {
  label: "A1 the ordering comparator is rewritten in an equivalent form",
  find: "  points.sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0));",
  replace: "  points.sort((a, b) => (a.observedAt === b.observedAt ? 0 : a.observedAt > b.observedAt ? 1 : -1));",
} as const;

function withMutation(find: string, replace: string, body: () => void): void {
  const original = readFile(MODULE);
  const before = sha(original);
  assert.ok(
    original.includes(find),
    `the mutation target is not present in ${MODULE} — the proof would be vacuous:\n${find}`,
  );
  const mutated = original.replace(find, replace);
  assert.notEqual(mutated, original, `the mutation changed nothing in ${MODULE}`);
  try {
    writeFileSync(abs(MODULE), mutated, "utf8");
    assert.equal(sha(readFile(MODULE)), sha(mutated), `the mutation did not reach ${MODULE}`);
    body();
  } finally {
    writeFileSync(abs(MODULE), original, "utf8");
  }
  assert.equal(sha(readFile(MODULE)), before, `${MODULE} was not restored byte-identically`);
}

function main(): void {
  for (const suite of [BEHAVIOUR, FIREWALL]) {
    assert.ok(runSuite(suite).ok, `${suite} must pass on the unmutated source before any proof runs`);
  }

  let bitten = 0;
  for (const mutation of MUTATIONS) {
    withMutation(mutation.find, mutation.replace, () => {
      const run = runSuite(mutation.suite);
      assert.equal(
        run.ok,
        false,
        `${mutation.label}: the suite still PASSED — the guard it targets does not bite`,
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

  withMutation(ACCEPTED.find, ACCEPTED.replace, () => {
    for (const suite of [BEHAVIOUR, FIREWALL]) {
      const run = runSuite(suite);
      assert.ok(
        run.ok,
        `${ACCEPTED.label}: a behaviour-preserving change was REJECTED by ${suite} — the suite ` +
          `tests the spelling rather than the rule.\n--- actual ---\n${run.output.slice(-2000)}`,
      );
    }
  });
  console.log(`ACCEPT ${ACCEPTED.label}`);

  assert.equal(bitten, MUTATIONS.length, "every mutation must have been proved to bite");
  console.log(
    `youtube-social-intelligence/bite-proofs: ${bitten} mutations bit, 1 behaviour-preserving change accepted`,
  );
}

main();
