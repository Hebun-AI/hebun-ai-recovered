/*
 * YT-SOC2 BITE-PROOFS — twelve mutations of the REAL comparison, plus one correct change.
 *
 * Both YT-SOC2 suites passed once the division guard was repaired. That is not evidence they work:
 * TRH-IG7 was a test that asserted a token existed and stayed green while the property it named was
 * false in production. A guard nobody has watched fail is a guess.
 *
 * M12 exists specifically because the division ban was WRONG on its first run — it matched the
 * module's own import path — and a guard that has been edited to stop failing must be shown to
 * still fail for the right reason.
 *
 * Four conditions per proof: the mutation APPLIED, the run FAILED, it failed for the INTENDED
 * REASON, and the file came back byte-identical by sha256. Restoration runs in `finally`.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();

const BEHAVIOUR = "tests/youtube-social-intelligence/channel-comparison-behaviour.ts";
const FIREWALL = "tests/youtube-social-intelligence/comparison-firewall.ts";
const MODULE = "src/features/youtube-channel-surface/channel-measurement-comparison.ts";

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
  /* ── AN ABSENT ENDPOINT IS NEVER A BASELINE ─────────────────────────────── */
  {
    label: "M1 a missing previous value is given a baseline of zero",
    suite: BEHAVIOUR,
    find: "  if (previous === null || latest === null) {\n    return Object.freeze({ status: \"not-comparable\" as const, gap: gapOf(previous, latest), previous, latest });\n  }",
    replace:
      "  if (latest === null) {\n    return Object.freeze({ status: \"not-comparable\" as const, gap: gapOf(previous, latest), previous, latest });\n  }\n  if (previous === null) {\n    return Object.freeze({ status: \"comparable\" as const, previous: 0, latest, change: latest });\n  }",
    /*
     * This mutation ORIGINALLY DID NOT BITE, and that was the most useful result in the file: the
     * generic metric path had no invented-baseline test at all, because the only such case tested
     * subscribers, which travel through their own function. The behaviour suite gained the missing
     * case; this is what it now catches.
     */
    expect: "no previous video count, no comparison",
  },
  {
    /*
     * THIS ONE ALSO DID NOT BITE AT FIRST, for a different and worse reason than M1: the assertion
     * that would have caught it sat only inside a narrowing guard — `if (x.status !== "..." ) return;`
     * — which exits main() silently and lets the process end 0. The suite reported PASS with most of
     * its assertions never executed. The guard is now asserted before it narrows, and the file ends
     * with a completion sentinel so no early return can look like success again.
     */
    label: "M2 a missing subscriber baseline is invented as zero",
    suite: BEHAVIOUR,
    find: "  if (previous.subscriberCount === null || latest.subscriberCount === null) {",
    replace: "  if (latest.subscriberCount === null) {",
    expect: "no previous subscriber count, no comparison",
  },

  /* ── ZERO IS A RESULT ───────────────────────────────────────────────────── */
  {
    label: "M3 a computed change of zero is suppressed as 'nothing to report'",
    suite: BEHAVIOUR,
    find: "  return Object.freeze({ status: \"comparable\" as const, previous, latest, change: latest - previous });",
    replace:
      "  if (latest - previous === 0) return Object.freeze({ status: \"not-comparable\" as const, gap: gapOf(null, null), previous, latest });\n  return Object.freeze({ status: \"comparable\" as const, previous, latest, change: latest - previous });",
    expect: "0 → 0 videos is comparable, not empty",
  },

  /* ── HIDDEN IS NOT NOT-REPORTED, ALL THE WAY THROUGH ────────────────────── */
  {
    label: "M4 the subscriber absence reasons are dropped from the comparison",
    suite: BEHAVIOUR,
    find: "      previousAbsence: previous.subscriberCountAbsence,\n      latestAbsence: latest.subscriberCountAbsence,",
    replace: "      previousAbsence: null,\n      latestAbsence: null,",
    expect: "the channel HIDES it",
  },

  /* ── WHICH SIDE IS MISSING IS THE FACT ──────────────────────────────────── */
  {
    label: "M5 every gap is reported as 'neither reported'",
    suite: BEHAVIOUR,
    find: "  if (previous === null && latest === null) return \"neither-reported\";\n  return previous === null ? \"previous-not-reported\" : \"latest-not-reported\";",
    replace: "  return \"neither-reported\";",
    expect: "latest-not-reported",
  },

  /* ── METRICS ARE INDEPENDENT ────────────────────────────────────────────── */
  {
    /*
     * The mutation must produce a WRONG ANSWER, not a crash. An earlier version threw, and the
     * suite duly failed — on the exception, proving only that an exception propagates. A bite-proof
     * that kills the process tests the runtime, not the guard.
     */
    label: "M6 an uncomparable subscriber count voids the metrics beside it",
    suite: BEHAVIOUR,
    find: "    videoCount: compareMetric(previous.videoCount, latest.videoCount),",
    replace:
      "    videoCount: previous.subscriberCount === null || latest.subscriberCount === null\n" +
      "      ? Object.freeze({ status: \"not-comparable\" as const, gap: \"neither-reported\" as const, previous: previous.videoCount, latest: latest.videoCount })\n" +
      "      : compareMetric(previous.videoCount, latest.videoCount),",
    expect: "the video comparison beside it is unaffected",
  },

  /* ── THE WINDOW IS THE LAST TWO, AND CHRONOLOGY IS DETERMINISTIC ────────── */
  {
    label: "M7 the comparison spans the whole history instead of the last two measurements",
    suite: BEHAVIOUR,
    find: "  const previous = series.points[series.points.length - 2]!;",
    replace: "  const previous = series.points[0]!;",
    /* The distinct WRONG value each mutation produces — the oldest instant, reached by widening. */
    expect: "2026-09-07T14:40:20.113Z",
  },
  {
    label: "M8 previous and latest are swapped, flipping every sign",
    suite: BEHAVIOUR,
    find: "  const latest = series.points[series.points.length - 1]!;\n  const previous = series.points[series.points.length - 2]!;",
    replace: "  const latest = series.points[series.points.length - 2]!;\n  const previous = series.points[series.points.length - 1]!;",
    /* Swapping makes `previous` the LATEST instant — a distinct wrong value from M7's. */
    expect: "2026-09-10T11:00:20.489Z",
  },

  /* ── ONE MEASUREMENT IS NOT A COMPARISON ────────────────────────────────── */
  {
    /* Again a WRONG ANSWER rather than a crash: the lone point compared against itself, which is
     * the plausible mistake — it yields a tidy change of 0 that means nothing at all. */
    label: "M9 a single measurement is compared against itself",
    suite: BEHAVIOUR,
    find:
      "    return Object.freeze({\n      status: \"insufficient-history\" as const,\n      measurementsAvailable: 1,\n      observationsConsidered: series.observationsConsidered,\n    });",
    replace:
      "    return Object.freeze({\n      status: \"compared\" as const,\n      previousObservedAt: series.point.observedAt,\n      latestObservedAt: series.point.observedAt,\n      observationsConsidered: series.observationsConsidered,\n      subscriberCount: compareSubscribers(series.point, series.point),\n      videoCount: compareMetric(series.point.videoCount, series.point.videoCount),\n      viewCount: compareMetric(series.point.viewCount, series.point.viewCount),\n    });",
    expect: "one usable measurement cannot be compared",
  },

  /* ── MALFORMED VALUES ARE NOT REPAIRED ──────────────────────────────────── */
  {
    label: "M10 an unavailable read is reported as an absence of observations",
    suite: BEHAVIOUR,
    find: "    return Object.freeze({ status: \"unavailable\" as const, reason: series.reason });",
    replace: "    return Object.freeze({ status: \"no-observations\" as const });",
    expect: "an unavailable read stays unavailable",
  },

  /* ── THE BOUNDARY: CALCULATION MAY NOT BECOME INTERPRETATION ────────────── */
  {
    label: "M11 a direction label is added to the comparison contract",
    suite: FIREWALL,
    find: "      readonly change: number;\n    }\n  | {\n      readonly status: \"not-comparable\";\n      readonly gap: MetricComparabilityGap;\n      readonly previous: number | null;\n      readonly latest: number | null;\n    };",
    replace:
      "      readonly change: number;\n      readonly direction: string;\n    }\n  | {\n      readonly status: \"not-comparable\";\n      readonly gap: MetricComparabilityGap;\n      readonly previous: number | null;\n      readonly latest: number | null;\n    };",
    expect: "no inference or recommendation vocabulary",
  },
  {
    /*
     * THE GUARD THAT WAS REPAIRED MUST STILL BITE. The division ban failed on its first run by
     * matching the module's own import path; it was re-aimed at executable code. A guard edited to
     * stop failing is exactly the guard most likely to have been edited into uselessness.
     */
    label: "M12 a percentage is computed from the change",
    suite: FIREWALL,
    find: "  return Object.freeze({ status: \"comparable\" as const, previous, latest, change: latest - previous });",
    replace:
      "  const pct = previous === 0 ? 0 : ((latest - previous) / previous) * 100;\n  void pct;\n  return Object.freeze({ status: \"comparable\" as const, previous, latest, change: latest - previous });",
    expect: "no division anywhere",
  },
];

/**
 * A REWRITE THAT CHANGES NOTHING MUST BE ACCEPTED — but it has to actually change nothing.
 *
 * The first attempt here was `-(previous - latest)`, which looks like ordinary algebra and is NOT
 * equivalent in JavaScript: for two equal values it produces `-0`, and `assert.strictEqual` compares
 * with `Object.is`, where `Object.is(-0, 0)` is false. The suite rejected it and was right to — on
 * this tenant's data, whose every count is zero, that "equivalent" rewrite would have changed every
 * single result. Extracting the expression to a named constant is a real refactor and genuinely
 * behaviour-preserving.
 */
const ACCEPTED = {
  label: "A1 the subtraction is extracted to a named constant",
  find: "  return Object.freeze({ status: \"comparable\" as const, previous, latest, change: latest - previous });",
  replace:
    "  const change = latest - previous;\n  return Object.freeze({ status: \"comparable\" as const, previous, latest, change });",
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
    `youtube-social-intelligence/comparison-bite-proofs: ${bitten} mutations bit, 1 behaviour-preserving change accepted`,
  );
}

main();
