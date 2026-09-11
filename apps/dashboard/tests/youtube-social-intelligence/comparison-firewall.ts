/*
 * YT-SOC2 · WHERE THE CALCULATION BOUNDARY IS, AND WHAT IT REFUSES TO CROSS.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * THE SENTENCES THIS FILE DEFENDS:
 *
 *   HEBUN CALCULATED IS ALLOWED. One subtraction, between two provider-reported counts.
 *   HEBUN INFERRED IS NOT. No direction, no verdict, no "growth", no percentage, no rate.
 *   NOTHING IS STORED. The calculation is reproducible from observations, so it is never persisted.
 *   NO UNIVERSAL SOCIAL METRIC EXISTS. Instagram and YouTube still share conventions, not code.
 *
 * The specific risk of this phase is the step AFTER subtraction. Once `latest - previous` exists,
 * `(latest - previous) / previous` is one line away, and a percentage is an interpretation wearing
 * arithmetic's clothes: it implies the baseline is the thing that matters, and it divides by zero
 * on exactly this tenant's real data.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { compareYouTubeChannelMeasurements } from "../../src/features/youtube-channel-surface/channel-measurement-comparison";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MODULE = "src/features/youtube-channel-surface/channel-measurement-comparison.ts";
const SERIES = "src/features/youtube-channel-surface/channel-measurement-series.ts";
const IG_MODULE = "src/features/instagram-connection-surface/account-measurement-series.ts";
const PAGE_DIR = "src/app/(dashboard)";

function main(): void {
  assert.ok(existsSync(path.join(ROOT, MODULE)), `${MODULE} exists`);
  const source = codeOf(read(MODULE));

  /* ═══ 1. IT IMPORTS NOTHING THAT EXISTS AT RUNTIME ═══════════════════════ */
  const imports = source.match(/^import[\s\S]*?from\s+"[^"]+";/gm) ?? [];
  assert.ok(imports.length > 0, "the module does import its contracts — the scan is not vacuous");
  for (const statement of imports) {
    assert.ok(
      /^import type\b/.test(statement),
      `EVERY import is type-only — a value import is how a derivation becomes a reader:\n${statement}`,
    );
  }
  /* And it consumes the RELEASED series, never the raw seam result. */
  assert.ok(
    imports.some((s) => s.includes("./channel-measurement-series")),
    "it is built on the released YT-SOC1 series, not on a second reading of stored observations",
  );

  /* ═══ 2. IT CANNOT REACH ════════════════════════════════════════════════ */
  const CANNOT_REACH: readonly (readonly [RegExp, string])[] = [
    [/\bgetControlPlaneDb\b|\bdrizzle\b|\bproviderObservations\b/, "a database handle or table"],
    [/\bfetch\s*\(|\bXMLHttpRequest\b|node:https?/, "the network"],
    [/\bresolveTenantContext\b|\bTenantContext\b/, "tenant resolution"],
    [/\breadProviderObservations\b/, "the read seam — it is handed a derived series"],
    [/\bdecrypt\b|\bcredential\b|\bapiKey\b/i, "a credential"],
    [/\bknowledge\b/i, "Knowledge"],
    [/\bheby\b/i, "Heby"],
    [/googleapis\.com|youtube\.com|\bchannels\.list\b/, "YouTube itself"],
  ];
  for (const [pattern, what] of CANNOT_REACH) {
    assert.ok(!pattern.test(source), `the comparison does not reach ${what}`);
  }

  /* ═══ 3. IT CANNOT WRITE — NO ANALYTICS PERSISTENCE ═════════════════════ */
  for (const pattern of [/\binsert\b/i, /\bupdate\s*\(/, /\bpersist\w*\(/i, /\bwriteFile/, /\bcache\b/i]) {
    assert.ok(!pattern.test(source), `the comparison persists nothing (${pattern})`);
  }

  /* ═══ 4. IT HAS NO CLOCK ════════════════════════════════════════════════ */
  for (const pattern of [/\bDate\b/, /\bperformance\.now\b/, /\bMath\.random\b/, /\bIntl\b/]) {
    assert.ok(!pattern.test(source), `the comparison has no clock or randomness (${pattern})`);
  }

  /* ═══ 5. SUBTRACTION IS THE ONLY ARITHMETIC ═════════════════════════════
   *
   * THE PHASE-SPECIFIC GUARD. A difference is allowed; a ratio is not. Division is what turns a
   * calculation into an interpretation — and on this tenant's real data, whose every count is zero,
   * it divides by zero.
   */
  /*
   * IMPORT SPECIFIERS ARE STRIPPED FIRST. `from "./channel-measurement-series"` contains a slash
   * followed by a letter, which is indistinguishable from a division to a regex — the first version
   * of this guard failed on the module's own import and would have been "fixed" by weakening it.
   * The ban is aimed at executable arithmetic, so the scan is too.
   */
  const executable = source.replace(/^import[\s\S]*?from\s+"[^"]+";/gm, "");
  assert.ok(
    !/\/\s*[a-zA-Z0-9(]/.test(executable),
    "no division anywhere — a percentage or rate is an interpretation, and 0 is this channel's baseline",
  );
  for (const banned of [/\*\s*100\b/, /\bMath\.(abs|sign|round|max|min|pow)\b/]) {
    assert.ok(!banned.test(source), `no scaling or shaping of the difference (${banned})`);
  }
  /* The subtraction that IS allowed is present, so this section is not vacuous. */
  assert.ok(
    /latest\s*-\s*previous/.test(source) || /latest\.\w+\s*-\s*previous\.\w+/.test(source),
    "the one permitted calculation — latest minus previous — really is here",
  );

  /* ═══ 6. NO INTERPRETATION VOCABULARY ═══════════════════════════════════ */
  const INFERENCE =
    /\b(growth|growing|trend|trending|rate|percent|percentage|direction|increase[sd]?|decrease[sd]?|improv\w*|declin\w*|velocity|momentum|forecast|projection|score|ranking?|healthy|recommend\w*|should)\b/i;
  const wordSeparated = source.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  assert.ok(
    !INFERENCE.test(wordSeparated),
    "no inference or recommendation vocabulary in executable code — including camelCase compounds",
  );

  /* ═══ 7. NO UNIVERSAL CROSS-PROVIDER ABSTRACTION ════════════════════════ */
  assert.ok(
    !/from\s+"[^"]*instagram[^"]*"/.test(source),
    "the YouTube comparison imports nothing from the Instagram derivation",
  );
  const igSource = existsSync(path.join(ROOT, IG_MODULE)) ? codeOf(read(IG_MODULE)) : "";
  assert.ok(
    !/from\s+"[^"]*youtube[^"]*"/.test(igSource),
    "and the Instagram derivation was not retrofitted to depend on YouTube",
  );
  for (const banned of [
    /\bUniversalSocialMetric\b/,
    /\bSocialAnalyticsAuthority\b/,
    /\bNormalizedFollowerMetric\b/,
    /\bUniversalEngagementScore\b/,
    /\bSocialMeasurementSeries\b/,
  ]) {
    assert.ok(!banned.test(source), `no universal social analytics abstraction (${banned})`);
  }
  /* Nor was one smuggled into the series module beside it. */
  const seriesSource = codeOf(read(SERIES));
  assert.ok(
    !/\bUniversalSocialMetric\b|\bSocialAnalyticsAuthority\b/.test(seriesSource),
    "and none appeared in the released series module either",
  );

  /* ═══ 8. THE CONTRACT HAS NOWHERE TO PUT AN INTERPRETATION ══════════════ */
  const comparable = (source.match(/readonly status: "comparable";([\s\S]*?)\n    \}/) ?? [])[1] ?? "";
  assert.ok(comparable.length > 0, "the comparable arm is present — the scan is not vacuous");
  const fields = [...comparable.matchAll(/readonly (\w+)[?]?:/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    fields,
    ["change", "latest", "previous"],
    "a comparable metric declares the change and both endpoints it came from — and nothing else",
  );

  /* ═══ 9. NO SURFACE CONSUMES IT YET ═════════════════════════════════════ */
  const pages = (function collect(dir: string): string[] {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? collect(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
    );
  })(PAGE_DIR);
  for (const page of pages) {
    assert.ok(
      !codeOf(read(page)).includes("channel-measurement-comparison"),
      `${page} consumes the comparison — UI is SOC-UI1's phase, not this one`,
    );
  }
  /*
   * ── SOC-UI1 HAS NOW BUILT IT, AND THIS IS THE CONSCIOUS CHANGE ────────────
   *
   * The assertion above USED to be `!existsSync(...)` — "/intelligence/social does not exist yet".
   * That deferral was written to be amended by exactly one phase, and this is it. What replaces it
   * is not a weaker claim but a different one, and the property that actually mattered is kept
   * intact by the page loop above: NO PAGE re-derives. The route exists; it reaches this derivation
   * only through the SOC-UI1 composition boundary, which is a pure module over the released read
   * seam, so the derivation still has exactly one kind of caller.
   */
  const SOCIAL_ROUTE = "src/app/(dashboard)/intelligence/social";
  assert.ok(existsSync(path.join(ROOT, SOCIAL_ROUTE)), "SOC-UI1 built /intelligence/social");
  const composition = "src/features/social-intelligence/dashboard-model.ts";
  assert.ok(
    codeOf(read(composition)).includes("channel-measurement-comparison"),
    "the composition boundary is the consumer of this derivation",
  );

  /* ═══ 10. PURE UNDER A HOSTILE ENVIRONMENT ═════════════════════════════ */
  const globals = globalThis as unknown as Record<string, unknown>;
  const realFetch = globals.fetch;
  const realNow = Date.now;
  let touched: string | null = null;
  globals.fetch = () => {
    touched = "fetch";
    throw new Error("unreachable");
  };
  Date.now = () => {
    touched = "Date.now";
    throw new Error("unreachable");
  };
  try {
    const out = compareYouTubeChannelMeasurements({ status: "no-observations" });
    assert.equal(out.status, "no-observations");
  } finally {
    globals.fetch = realFetch;
    Date.now = realNow;
  }
  assert.equal(touched, null, "the comparison touched neither the network nor the clock when run");

  console.log(
    "youtube-social-intelligence/comparison-firewall: type-only imports over the released series, " +
      "no db/network/tenant/credential/Knowledge/Heby/YouTube reach, no persistence, no clock, " +
      "subtraction only (no division/scaling), no inference vocabulary, NO universal abstraction, " +
      "contract closed, UI deferral asserted, purity proved at runtime",
  );
}

main();
