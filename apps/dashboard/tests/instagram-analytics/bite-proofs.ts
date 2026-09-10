/*
 * IG-AN1 BITE-PROOFS — ten mutations of the REAL derivation, plus one correct change.
 *
 * Both IG-AN1 suites passed on their first run. That is the moment to distrust them, not to be
 * reassured: TRH-IG7 was a test that asserted a token existed and stayed green while the property
 * it named was false in production. A guard nobody has watched fail is a guess.
 *
 * Four conditions per proof: the mutation APPLIED, the run FAILED, it failed for the INTENDED
 * REASON, and the file came back byte-identical by sha256. Restoration runs in `finally`.
 *
 * The eleventh case runs the other way: a behaviour-preserving rewrite must be ACCEPTED, so the
 * suites are shown to test the rule rather than the spelling.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const BEHAVIOUR = "tests/instagram-analytics/account-series-behaviour.ts";
const FIREWALL = "tests/instagram-analytics/derivation-firewall.ts";
const MODULE = "src/features/instagram-connection-surface/account-measurement-series.ts";

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
  /* ── ORDER IS CHOSEN, NOT INHERITED ─────────────────────────────────────── */
  {
    label: "M1 the seam's newest-first order is inherited instead of normalised",
    suite: BEHAVIOUR,
    find: "  points.sort((a, b) => (a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0));",
    replace: "  /* no ordering */",
    expect: "OLDEST FIRST",
  },
  {
    label: "M2 the series is ordered newest first, so a future delta would change sign",
    suite: BEHAVIOUR,
    find: "(a.observedAt < b.observedAt ? -1 : a.observedAt > b.observedAt ? 1 : 0)",
    replace: "(a.observedAt < b.observedAt ? 1 : a.observedAt > b.observedAt ? -1 : 0)",
    expect: "OLDEST FIRST",
  },

  /* ── ONE MEASUREMENT IS NOT A SERIES ────────────────────────────────────── */
  {
    label: "M3 a lone measurement is returned as a one-element series",
    suite: BEHAVIOUR,
    find: "  if (points.length === 1) {",
    replace: "  if (false) {",
    expect: "one usable measurement gets its own status",
  },

  /* ── ABSENCE IS NOT ZERO ────────────────────────────────────────────────── */
  {
    label: "M4 a withheld count is reported as zero",
    suite: BEHAVIOUR,
    find: "  return Object.freeze({ observedAt: observation.observedAt, followersCount, followsCount, mediaCount });",
    replace:
      "  return Object.freeze({ observedAt: observation.observedAt, followersCount: followersCount ?? 0, followsCount, mediaCount });",
    expect: "a withheld count stays null",
  },
  {
    /*
     * DELIBERATELY NARROW. The obvious mutation — coercing every value with `Number(value)` —
     * also turns `null` into `0`, so it bites on the ABSENCE guard first and proves nothing about
     * string repair. This one leaves `null` alone and repairs only strings, so the assertion it
     * reaches is the one actually under test.
     */
    label: "M5 a numeric string is repaired into a measurement",
    suite: BEHAVIOUR,
    find: "  return typeof value === \"number\" && Number.isFinite(value) ? value : null;",
    replace:
      "  if (typeof value === \"string\" && Number.isFinite(Number(value))) return Number(value);\n" +
      "  return typeof value === \"number\" && Number.isFinite(value) ? value : null;",
    expect: "none of them counts",
  },

  /* ── AN OBSERVATION OF NOTHING IS NOT A MEASUREMENT, AND NOT AN ABSENCE ── */
  {
    label: "M6 an observation reporting no counts at all enters the series",
    suite: BEHAVIOUR,
    find: "  if (followersCount === null && followsCount === null && mediaCount === null) return null;",
    replace: "  /* every observation is usable */",
    expect: "an observation with no counts measures nothing",
  },
  {
    label: "M7 holding no observation is reported as holding unusable ones",
    suite: BEHAVIOUR,
    find: "  if (observationsConsidered === 0) return Object.freeze({ status: \"no-observations\" as const });",
    replace:
      "  if (observationsConsidered === 0) return Object.freeze({ status: \"no-usable-measurements\" as const, observationsConsidered });",
    expect: "zero observations is its own answer",
  },
  {
    label: "M8 an observation with no instant is admitted as a measurement",
    suite: BEHAVIOUR,
    find: "  if (typeof observation.observedAt !== \"string\" || observation.observedAt.length === 0) return null;",
    replace: "  /* any instant will do */",
    expect: "a measurement with no instant is not a measurement",
  },

  /* ── THE BOUNDARY ITSELF ────────────────────────────────────────────────── */
  {
    label: "M9 a derived quantity is added to the measurement contract",
    suite: FIREWALL,
    find: "  readonly mediaCount: number | null;\n}",
    replace: "  readonly mediaCount: number | null;\n  readonly followersDelta: number | null;\n}",
    expect: "no derived-quantity vocabulary",
  },
  {
    label: "M10 the derivation consults the clock",
    suite: FIREWALL,
    find: "  const observationsConsidered = result.observations.length;",
    replace: "  const observationsConsidered = Date.now() > 0 ? result.observations.length : 0;",
    expect: "no clock or randomness",
  },
];

/**
 * A REWRITE THAT CHANGES NOTHING MUST BE ACCEPTED.
 *
 * The comparator is spelled differently and orders identically. If a suite rejects this it is
 * asserting on the source text rather than on the behaviour, which is the failure mode every
 * mutation above is meant to rule out — in the opposite direction.
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
  /* The suites must be green BEFORE anything is mutated, or every proof below is unreadable. */
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
    `instagram-analytics/bite-proofs: ${bitten} mutations bit, 1 behaviour-preserving change accepted`,
  );
}

main();
