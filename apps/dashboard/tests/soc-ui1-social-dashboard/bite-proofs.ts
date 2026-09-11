/*
 * SOC-UI1 bite-proofs — every critical guard is shown to FAIL on a broken product.
 *
 * A green suite proves nothing on its own. Each mutation below breaks one product meaning this
 * phase exists to protect, runs the suite that is supposed to notice, and requires both that it
 * fails AND that it fails for the stated reason. A guard that stays green under its own mutation is
 * decoration, and this file is how that is found out rather than assumed.
 *
 * Every mutation is reverted from the original bytes, and the file's SHA-256 is compared before and
 * after so a crashed run cannot leave a mutated module on disk pretending to be released code.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const ROOT = process.cwd();
const BEHAVIOUR = "tests/soc-ui1-social-dashboard/composition-behaviour.ts";
const FIREWALL = "tests/soc-ui1-social-dashboard/surface-firewall.ts";
const NAV_LOCK = "tests/intelligence-l2/navigation.ts";
const RENDERED = "tests/soc-ui1-social-dashboard/rendered-semantics.ts";

const MODEL = "src/features/social-intelligence/dashboard-model.ts";
const PRESENCE = "src/features/social-intelligence/platform-presence.ts";
const CHART = "src/components/social-intelligence/measurement-series-chart.tsx";
const NAV = "src/config/workspace-nav.ts";
const CARD = "src/components/social-intelligence/platform-summary-card.tsx";

const abs = (file: string): string => path.join(ROOT, file);
const readFile = (file: string): string => readFileSync(abs(file), "utf8");
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");

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
  readonly file: string;
  readonly suite: string;
  readonly find: string;
  readonly replace: string;
  /** A fragment of the failure the suite must produce. A bare non-zero exit is not enough. */
  readonly expect: string;
}

const MUTATIONS: readonly Mutation[] = [
  {
    label: "M1 a real zero is rendered as an absence",
    file: MODEL,
    suite: BEHAVIOUR,
    find: "    display: value === null ? METRIC_UNREPORTED_DISPLAY : String(value),",
    replace: "    display: !value ? METRIC_UNREPORTED_DISPLAY : String(value),",
    expect: 'DISPLAYS as "0"',
  },
  {
    label: "M2 an unreported count is substituted with zero",
    file: MODEL,
    suite: BEHAVIOUR,
    find: "    value,\n    /* A ZERO IS A MEASUREMENT.",
    replace: "    value: value ?? 0,\n    /* A ZERO IS A MEASUREMENT.",
    expect: "a withheld count is null",
  },
  {
    label: "M3 the two YouTube subscriber absences are collapsed into one sentence",
    file: MODEL,
    suite: BEHAVIOUR,
    find: '    "hidden-by-channel": "This channel hides its subscriber count, so YouTube did not report one.",',
    replace: '    "hidden-by-channel": "YouTube did not report a subscriber count.",',
    /*
     * TWO guards catch this, and the one that fires FIRST is named here. Collapsing the sentence
     * destroys the reason before it ever reaches the comparison of the two, so `the reason survives
     * presentation` is the honest expectation — naming the later assertion would have made this
     * bite-proof pass on a failure it did not actually predict.
     */
    expect: "the reason survives presentation",
  },
  {
    label: "M4 health is ignored, so a silent provider looks live",
    file: PRESENCE,
    suite: BEHAVIOUR,
    find: "  if (!isHealthUsable(current.health)) {",
    replace: "  if (false as boolean) {",
    expect: "is impaired",
  },
  {
    label: "M5 any connection state is treated as connected",
    file: PRESENCE,
    suite: BEHAVIOUR,
    find: '  if (current.connectionState !== "connected") {',
    replace: "  if (false as boolean) {",
    expect: "is not live",
  },
  {
    label: "M6 an unreadable connection authority is reported as 'nothing connected'",
    file: PRESENCE,
    suite: BEHAVIOUR,
    find: '  if (listing.status === "unavailable") {\n    return Object.freeze({ status: "unknown" as const, reason: listing.reason });',
    replace: '  if (listing.status === "unavailable") {\n    return Object.freeze({ status: "not-live" as const, connectionState: null });',
    expect: "never reported as 'not connected'",
  },
  {
    label: "M7 a stale superseded connection row out-votes the current one",
    file: PRESENCE,
    suite: BEHAVIOUR,
    find: "    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];",
    replace: "    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];",
    expect: "AssertionError",
  },
  {
    /*
     * M8 ORIGINALLY pinned `changes: null` — "IG-AN2 is not released". IG-AN2 now IS released, so
     * the mutation that matters changed with it: the defect is no longer "a change appears at all",
     * it is "a change appears WITHOUT the evidence for one". Fabricating a comparison while the
     * series holds a single measurement is exactly that, and the guard must still bite.
     */
    label: "M8 Instagram is given a calculated change it has no evidence for",
    file: MODEL,
    suite: BEHAVIOUR,
    find: "  const instagramChanges = instagramChangeBlockOf(instagramComparison);",
    replace:
      "  const instagramChanges = instagramChangeBlockOf(instagramComparison) ?? Object.freeze({ status: \"compared\" as const, previousObservedAt: \"x\", latestObservedAt: \"y\", cells: Object.freeze([]) });",
    expect: "one measurement still yields no comparison",
  },
  {
    /*
     * IT MISLABELS WITHOUT CRASHING, ON PURPOSE. Swapping the whole definition list to
     * `YOUTUBE_PLATFORM.metrics` throws a TypeError — YouTube's fact keys are absent from
     * Instagram's map — and a crash proves the code breaks, not that the MEANING is defended. This
     * keeps every key valid and renames one label, so the only thing that can catch it is the
     * assertion that Instagram's cells never carry YouTube's names.
     */
    label: "M19 Instagram's comparison is mapped under YouTube's metric names",
    file: MODEL,
    suite: BEHAVIOUR,
    find: "  const cells = INSTAGRAM_PLATFORM.metrics.map((definition) => {",
    replace:
      "  const cells = INSTAGRAM_PLATFORM.metrics\n    .map((d) => ({ ...d, shortLabel: d.shortLabel === \"Followers\" ? \"Subscribers\" : d.shortLabel }))\n    .map((definition) => {",
    /*
     * TWO assertions catch this and the FIRST one fires: renaming Followers makes it absent from
     * the cells before the "belongs to YouTube alone" check is ever reached. Naming the later
     * assertion would let this bite-proof pass on a failure it did not predict.
     */
    expect: "Followers is present",
  },
  {
    label: "M20 a real zero change is rendered as an absence on the Instagram block",
    file: MODEL,
    suite: BEHAVIOUR,
    find: "        display: changeDisplay(metric.change),\n        note: null,\n      });\n    }\n    return Object.freeze({\n      shortLabel: definition.shortLabel,\n      label: definition.label,\n      status: \"not-comparable\" as const,\n      previous: metric.previous,\n      latest: metric.latest,\n      change: null,\n      display: METRIC_UNREPORTED_DISPLAY,\n      note: GAP_NOTES[metric.gap] ?? null,\n    });\n  });\n\n  return Object.freeze({\n    status: \"compared\" as const,\n    previousObservedAt: comparison.previousObservedAt,\n    latestObservedAt: comparison.latestObservedAt,\n    cells: Object.freeze(cells),\n  });\n}\n\n/** The released Instagram sentence",
    replace: "        display: metric.change === 0 ? METRIC_UNREPORTED_DISPLAY : changeDisplay(metric.change),\n        note: null,\n      });\n    }\n    return Object.freeze({\n      shortLabel: definition.shortLabel,\n      label: definition.label,\n      status: \"not-comparable\" as const,\n      previous: metric.previous,\n      latest: metric.latest,\n      change: null,\n      display: METRIC_UNREPORTED_DISPLAY,\n      note: GAP_NOTES[metric.gap] ?? null,\n    });\n  });\n\n  return Object.freeze({\n    status: \"compared\" as const,\n    previousObservedAt: comparison.previousObservedAt,\n    latestObservedAt: comparison.latestObservedAt,\n    cells: Object.freeze(cells),\n  });\n}\n\n/** The released Instagram sentence",
    expect: 'displays as "0", never a dash',
  },
  {
    label: "M9 a zero change is written as an absence rather than a result",
    file: MODEL,
    suite: BEHAVIOUR,
    find: '  if (change === 0) return "0";',
    replace: "  if (change === 0) return METRIC_UNREPORTED_DISPLAY;",
    expect: 'displays as "0"',
  },
  {
    label: "M10 a verdict word is attached to the calculation",
    file: MODEL,
    suite: BEHAVIOUR,
    find: '  "previous-not-reported": "The earlier observation did not carry this count, so no change can be shown.",',
    replace: '  "previous-not-reported": "Performance has been stable across this window.",',
    expect: "no verdict word",
  },
  {
    label: "M11 Instagram and YouTube are given one shared metric vocabulary",
    file: "src/features/social-intelligence/contracts.ts",
    suite: BEHAVIOUR,
    find: '    Object.freeze({ factKey: "subscriberCount", shortLabel: "Subscribers", label: "Subscribers YouTube reported" }),',
    replace: '    Object.freeze({ factKey: "subscriberCount", shortLabel: "Followers", label: "Followers YouTube reported" }),',
    expect: "AssertionError",
  },
  {
    label: "M12 the chart plots an unreported count on the baseline",
    file: CHART,
    suite: FIREWALL,
    find: "                  ? `${METRIC_UNREPORTED_DISPLAY} not reported`",
    replace: "                  ? String(values[index] || 0)",
    expect: "would erase a real zero",
  },
  {
    label: "M13 the chart's textual equivalent is removed",
    file: CHART,
    suite: FIREWALL,
    find: '      <table className="sr-only">',
    replace: '      <table className="hidden">',
    expect: "every point is a real table row",
  },
  {
    label: "M14 a provider is named in the tenant-shared navigation",
    file: NAV,
    suite: FIREWALL,
    /*
     * IT MUTATES THE `purpose`, NOT THE LABEL. Renaming the label to "Instagram & YouTube" also
     * fails the suite — but on the EARLIER assertion that a destination called "Social Intelligence"
     * exists, which is a different guard proving a different thing. Injecting the provider name into
     * a field the label lookup does not touch isolates the provider-naming guard and proves that one
     * specifically.
     */
    find: 'purpose: "What connected social platforms reported, and when Hebun observed it." }',
    replace: 'purpose: "Instagram and YouTube activity for this organization." }',
    expect: "names no provider",
  },
  {
    label: "M16 an unknown measurement count is reported as zero",
    file: MODEL,
    suite: BEHAVIOUR,
    find: '  if (status === "unavailable") return null;',
    replace: "  if (false as boolean) return null;",
    expect: "claims no count",
  },
  {
    label: "M15 Social Intelligence is promoted out of Intelligence L2",
    file: NAV,
    suite: NAV_LOCK,
    find: '      { label: "Social Intelligence", href: "/intelligence/social", icon: Radio, purpose: "What connected social platforms reported, and when Hebun observed it." },\n',
    replace: "",
    /* The label deepEqual fires before the length check, so that is the message named here. */
    expect: "locked seven-surface IA",
  },
  {
    /*
     * THE DEFECT VISUAL ACCEPTANCE FOUND, PUT BACK. A single measurement captioned "the line is
     * level because the value did not move" is a comparison invented out of one point.
     */
    label: "M17 one measurement is captioned as a value that held steady",
    file: CHART,
    suite: RENDERED,
    find: "  const scaleNote = single\n",
    replace: "  const scaleNote = false\n",
    expect: "must not claim a value held steady",
  },
  {
    /* The second acceptance defect: every metric announcing its own name twice. */
    label: "M18 a metric's name is announced twice to assistive technology",
    file: CARD,
    suite: RENDERED,
    find: '                  <span aria-hidden="true">{metric.shortLabel}</span>\n                  <span className="sr-only">{metric.label}</span>',
    replace: '                  {metric.shortLabel}\n                  <span className="sr-only"> — {metric.label}</span>',
    /*
     * Three assertions catch this; the one that fires FIRST is named. Re-exposing the short label
     * is the defect itself, so "hidden from AT" is the honest expectation — naming the later
     * doubled-name assertion would claim a prediction this bite-proof did not actually make.
     */
    expect: "the visible short label is hidden from AT",
  },
];

function main(): void {
  const touched = [...new Set(MUTATIONS.map((m) => m.file))];
  const originals = new Map(touched.map((file) => [file, readFile(file)]));
  const digests = new Map(touched.map((file) => [file, sha(originals.get(file)!)]));

  /* The suites must be green BEFORE anything is broken, or a failure below proves nothing. */
  for (const suite of [BEHAVIOUR, FIREWALL, NAV_LOCK, RENDERED]) {
    const baseline = runSuite(suite);
    assert.ok(baseline.ok, `${suite} must pass before mutation:\n${baseline.output}`);
  }

  let survived: string | null = null;
  try {
    for (const mutation of MUTATIONS) {
      const original = originals.get(mutation.file)!;
      assert.ok(
        original.includes(mutation.find),
        `${mutation.label}: the anchor is stale — the guard may have moved:\n${mutation.find}`,
      );
      writeFileSync(abs(mutation.file), original.replace(mutation.find, mutation.replace), "utf8");

      const run = runSuite(mutation.suite);
      writeFileSync(abs(mutation.file), original, "utf8");

      if (run.ok) {
        survived = `${mutation.label}: the mutation SURVIVED — the guard does not bite.`;
        break;
      }
      if (!run.output.includes(mutation.expect)) {
        survived =
          `${mutation.label}: it failed, but not for the stated reason. ` +
          `Expected output containing "${mutation.expect}".\n${run.output}`;
        break;
      }
      console.log(`BITES ${mutation.label}`);
    }
  } finally {
    /* Restore unconditionally, then PROVE the restoration by digest rather than trusting it. */
    for (const file of touched) writeFileSync(abs(file), originals.get(file)!, "utf8");
    for (const file of touched) {
      assert.equal(sha(readFile(file)), digests.get(file), `${file} was restored byte-for-byte`);
    }
  }

  assert.equal(survived, null, survived ?? "");
  console.log(`SOC-UI1 bite-proofs passed — ${MUTATIONS.length} guards all bite`);
}

main();
