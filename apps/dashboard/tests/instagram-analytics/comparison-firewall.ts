/*
 * IG-AN2 — the boundaries of the Instagram account comparison, proved from its own source.
 *
 * The behaviour suite proves what the derivation SAYS. This proves what it is incapable of saying,
 * by proving the imports and identifiers required to say it are absent.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  compareInstagramAccountMeasurements,
  INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES,
} from "../../src/features/instagram-connection-surface/account-measurement-comparison";
import { deriveInstagramAccountMeasurementSeries } from "../../src/features/instagram-connection-surface/account-measurement-series";

const ROOT = process.cwd();
const MODULE = "src/features/instagram-connection-surface/account-measurement-comparison.ts";
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");
/** Source with comments stripped. A rule about CODE must not be broken by prose that denies it. */
const codeOf = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const SOURCE = read(MODULE);
const CODE = codeOf(SOURCE);

/* ── 1 · it is a DERIVATION, not an authority ──────────────────────────────── */

function itReachesNoAuthorityOfItsOwn(): void {
  for (const forbidden of [
    "drizzle-orm",
    "getControlPlaneDb",
    "db/schema",
    "providerObservations",
    "read-provider-observations",
    "fetch(",
    "XMLHttpRequest",
    "credential",
    "decrypt",
    "accessToken",
    "process.env",
    "Date.now",
    "new Date",
  ]) {
    assert.ok(!CODE.includes(forbidden), `IG-AN2 is a pure derivation — found "${forbidden}"`);
  }
}

function itImportsOnlyTheReleasedSeriesItConsumes(): void {
  /*
   * SCANNED ON THE COMMENT-STRIPPED CODE, and the first version was not. The module header explains
   * why YouTube's absence reasons differ, and the sentence contains the phrase
   * `from "the provider went quiet"` — which a raw-source import scan read as a second import. A
   * rule about imports must look at imports.
   */
  const imports = [...CODE.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(
    imports,
    ["./account-measurement-series"],
    "the ONLY import is the released IG-AN1 series — no second input, no shared analytics module",
  );
}

/* ── 2 · no cross-provider coupling ────────────────────────────────────────── */

function itSharesNoTypeWithYouTube(): void {
  /*
   * The two comparisons look alike and are not the same: YouTube carries a subscriber-specific arm
   * because a channel can HIDE its count, and Instagram's released fact vocabulary has no analogue.
   * Importing YouTube's types would make a future divergence in either provider a breaking change
   * in the other.
   */
  for (const forbidden of [
    "youtube",
    "YouTube",
    "channel-measurement",
    "subscriberCount",
    "hiddenSubscriberCount",
  ]) {
    assert.ok(!CODE.includes(forbidden), `no YouTube coupling — found "${forbidden}"`);
  }
  /* And no universal type was minted in either direction. */
  for (const forbidden of ["SocialMetricComparison", "SocialMeasurement", "universalMetric", "crossPlatform"]) {
    assert.ok(!CODE.includes(forbidden), `no universal analytics type — found "${forbidden}"`);
  }
}

/* ── 3 · calculation only ──────────────────────────────────────────────────── */

function itComputesNoRateTrendOrVerdict(): void {
  for (const forbidden of [
    "percent",
    "Percent",
    "rate",
    "Rate",
    "growth",
    "Growth",
    "trend",
    "Trend",
    "average",
    "mean",
    "median",
    "score",
    "Score",
    "rank",
    "engagement",
    "momentum",
    "recommend",
    "infer",
    "predict",
    "forecast",
  ]) {
    assert.ok(!CODE.includes(forbidden), `IG-AN2 calculates only — found "${forbidden}"`);
  }
  /* The only arithmetic operator on counts is subtraction. */
  const arithmetic = [...CODE.matchAll(/latest\s*([-+*/])\s*previous/g)].map((m) => m[1]);
  assert.deepEqual(arithmetic, ["-"], "the only operation performed on two counts is subtraction");
  assert.ok(!/\/\s*previous/.test(CODE), "nothing is divided by a baseline");
}

function theComparedStateHasNoSentence(): void {
  assert.ok(
    !("compared" in INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES),
    "a comparison speaks in numbers; a sentence about one would be an interpretation",
  );
  assert.equal(
    Object.keys(INSTAGRAM_ACCOUNT_COMPARISON_SENTENCES).length,
    5,
    "exactly the five non-comparable states have words",
  );
}

/* ── 4 · nothing is written ────────────────────────────────────────────────── */

function itPersistsNothing(): void {
  for (const forbidden of ["insert(", "update(", "delete(", "INSERT", "UPDATE", "DELETE", '"use server"', "revalidate"]) {
    assert.ok(!CODE.includes(forbidden), `IG-AN2 persists nothing — found "${forbidden}"`);
  }
}

/* ── 5 · pure under a hostile environment ──────────────────────────────────── */

function itIsPureUnderAHostileEnvironment(): void {
  const globals = globalThis as unknown as Record<string, unknown>;
  const realFetch = globals.fetch;
  const realNow = Date.now;
  let touched: string | null = null;
  globals.fetch = () => {
    touched = "fetch";
    throw new Error("IG-AN2 must not fetch");
  };
  Date.now = () => {
    touched = "Date.now";
    return 0;
  };
  try {
    const series = deriveInstagramAccountMeasurementSeries({
      status: "read",
      observations: [
        {
          observedAt: "2026-09-11T10:00:20.258Z",
          facts: { followersCount: 56, followsCount: 83, mediaCount: 8 },
        },
        {
          observedAt: "2026-09-10T08:00:18.986Z",
          facts: { followersCount: 56, followsCount: 83, mediaCount: 8 },
        },
      ],
    } as never);
    const result = compareInstagramAccountMeasurements(series);
    assert.equal(result.status, "compared");
    assert.equal(touched, null, `the derivation reached for ${touched}`);
  } finally {
    globals.fetch = realFetch;
    Date.now = realNow;
  }
}

function main(): void {
  itReachesNoAuthorityOfItsOwn();
  itImportsOnlyTheReleasedSeriesItConsumes();
  itSharesNoTypeWithYouTube();
  itComputesNoRateTrendOrVerdict();
  theComparedStateHasNoSentence();
  itPersistsNothing();
  itIsPureUnderAHostileEnvironment();
  console.log("IG-AN2 comparison firewall checks passed");
}

main();
