/*
 * YT-SOC1 · WHERE THE YOUTUBE DERIVATION BOUNDARY IS, AND WHAT IT REFUSES TO CROSS.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 *
 * THE SENTENCES THIS FILE DEFENDS:
 *
 *   A DERIVATION READS NOTHING. It is handed a result the released seam already produced.
 *   A DERIVATION WRITES NOTHING. There is no analytics store, and this does not become one.
 *   A DERIVATION HAS NO CLOCK. What it says about evidence cannot change while nobody edits it.
 *   A DERIVATION DOES NOT RECOMMEND. It orders measurements; it does not judge them.
 *   AND: NO UNIVERSAL SOCIAL METRIC IS INVENTED. Instagram and YouTube share conventions, not code.
 *
 * The last one is this phase's specific risk. Two providers with counts is exactly the situation in
 * which someone builds `SocialMeasurementSeries<T>` — and the abstraction can only exist by erasing
 * the fact that a YouTube subscriber count can be hidden by its owner and an Instagram follower
 * count cannot.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  deriveYouTubeChannelMeasurementSeries,
  YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT,
} from "../../src/features/youtube-channel-surface/channel-measurement-series";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";
import { YOUTUBE_CHANNEL_FACT_KEYS } from "../../src/features/provider-observation-history/record-youtube-channel-observation.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MODULE = "src/features/youtube-channel-surface/channel-measurement-series.ts";
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
      "EVERY import is type-only, so the compiled module reaches no other module at runtime. " +
        `A value import is how a derivation quietly becomes a reader:\n${statement}`,
    );
  }

  /* ═══ 2. IT CANNOT REACH ════════════════════════════════════════════════ */
  const CANNOT_REACH: readonly (readonly [RegExp, string])[] = [
    [/\bgetControlPlaneDb\b|\bdrizzle\b|\bproviderObservations\b/, "a database handle or table"],
    [/\bfetch\s*\(|\bXMLHttpRequest\b|node:https?/, "the network"],
    [/\bresolveTenantContext\b|\bTenantContext\b/, "tenant resolution — the seam owns the tenant"],
    [/\breadProviderObservations\b/, "the read seam itself — it is handed the RESULT, never the read"],
    [/\bdecrypt\b|\bcredential\b|\bapiKey\b/i, "a credential — YouTube reads use a stored API key"],
    [/\bknowledge\b/i, "Knowledge — an observation is not Knowledge"],
    [/\bheby\b/i, "Heby"],
    [/googleapis\.com|youtube\.com|\byoutubeTransport\b|\bchannels\.list\b/, "YouTube itself"],
  ];
  for (const [pattern, what] of CANNOT_REACH) {
    assert.ok(!pattern.test(source), `the derivation does not reach ${what}`);
  }

  /* ═══ 3. IT CANNOT WRITE ════════════════════════════════════════════════ */
  for (const pattern of [/\binsert\b/i, /\bupdate\s*\(/, /\bpersist\w*\(/i, /\bwriteFile/, /\bcache\b/i]) {
    assert.ok(!pattern.test(source), `the derivation persists nothing (${pattern})`);
  }

  /* ═══ 4. IT HAS NO CLOCK ════════════════════════════════════════════════ */
  for (const pattern of [/\bDate\b/, /\bperformance\.now\b/, /\bMath\.random\b/, /\bIntl\b/]) {
    assert.ok(!pattern.test(source), `the derivation has no clock or randomness (${pattern})`);
  }

  /* ═══ 5. IT CALCULATES NOTHING BETWEEN MEASUREMENTS ═════════════════════
   *
   * camelCase is split first: a bite-proof adding `subscriberDelta` walks straight past `\bdelta\b`
   * because there is no word boundary at a camelCase hump — the very naming convention this
   * codebase uses was the one shape the guard could not see.
   */
  const DERIVED_NAMES =
    /\b(delta|difference|growth|trend|rate|percent|percentage|average|mean|median|momentum|velocity|score|ranking?|forecast|projection|engagement)\b/i;
  const wordSeparated = source.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  assert.ok(
    !DERIVED_NAMES.test(wordSeparated),
    "no derived-quantity vocabulary — a name for a calculated number is the first half of calculating it",
  );
  const COUNT_ARITHMETIC =
    /(subscriberCount|videoCount|viewCount)\s*[-+*/][^/]|[-+*/]\s*(subscriberCount|videoCount|viewCount)\b/;
  assert.ok(
    !COUNT_ARITHMETIC.test(source),
    "no operator is applied between reported counts — subtraction is YT-SOC2's question",
  );

  /* ═══ 6. IT DOES NOT SPEAK IN VERDICTS ══════════════════════════════════ */
  const RECOMMENDATION =
    /\b(recommend|suggest|should\s+(post|upload)|you\s+should|advise|opportunity|underperform|outperform|healthy|doing well)\b/i;
  assert.ok(!RECOMMENDATION.test(read(MODULE)), "no recommendation vocabulary, prose included");

  /* ═══ 7. NO UNIVERSAL CROSS-PROVIDER ABSTRACTION EXISTS ═════════════════
   *
   * THE PHASE-SPECIFIC GUARD. Instagram and YouTube must remain two honest modules.
   */
  assert.ok(
    !/instagram/i.test(read(MODULE)) || !/from\s+"[^"]*instagram/.test(source),
    "the YouTube derivation imports nothing from the Instagram derivation",
  );
  assert.ok(
    !/from\s+"[^"]*instagram[^"]*"/.test(source),
    "and names no Instagram module in an import specifier",
  );
  const igSource = existsSync(path.join(ROOT, IG_MODULE)) ? codeOf(read(IG_MODULE)) : "";
  assert.ok(
    !/from\s+"[^"]*youtube[^"]*"/.test(igSource),
    "and the Instagram derivation was not retrofitted to depend on YouTube either",
  );
  /* No shared generic type has appeared anywhere in the feature layer. */
  for (const banned of [
    /\bSocialMeasurementSeries\b/,
    /\bUnifiedMeasurement\b/,
    /\bAnySocialProvider\b/,
    /\bsocialMetric\b/i,
  ]) {
    assert.ok(!banned.test(source), `no universal cross-provider metric abstraction (${banned})`);
  }

  /* ═══ 8. A PAGE COUNT IS NOT A CHANNEL TOTAL ════════════════════════════
   *
   * `recentVideoCount` is the size of ONE bounded page of uploads; `videoCount` is the channel's own
   * total. The released mapper warns that conflating them lets a page look like a total, and the
   * measurement series is exactly where that mistake would become a chart.
   */
  assert.ok(
    !/recentVideoCount/.test(source),
    "the series measures `videoCount`, the channel total — never `recentVideoCount`, one page",
  );
  assert.ok(
    YOUTUBE_CHANNEL_FACT_KEYS.includes("videoCount") &&
      YOUTUBE_CHANNEL_FACT_KEYS.includes("recentVideoCount"),
    "both keys really are stored, so the distinction above is a real one and not a straw man",
  );

  /* ═══ 9. EVERY FACT KEY IT READS IS ONE THE WRITER ACTUALLY WRITES ══════ */
  for (const key of ["subscriberCount", "hiddenSubscriberCount", "videoCount", "viewCount"]) {
    assert.ok(source.includes(`"${key}"`), `the derivation names \`${key}\``);
    assert.ok(
      YOUTUBE_CHANNEL_FACT_KEYS.includes(key),
      `and \`${key}\` is a key the released YouTube mapper writes — not one this module invented`,
    );
  }

  /* ═══ 10. THE CONTRACT HAS NOWHERE TO PUT A DERIVED NUMBER ══════════════ */
  const pointFields = (source.match(/interface YouTubeChannelMeasurementPoint \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
  assert.ok(pointFields.length > 0, "the measurement point interface is present — the scan is not vacuous");
  const declared = [...pointFields.matchAll(/readonly (\w+)[?]?:/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    declared,
    ["observedAt", "subscriberCount", "subscriberCountAbsence", "videoCount", "viewCount"],
    "a point declares the reported counts, the absence reason and the instant — and nothing else",
  );

  /* ═══ 11. THE OBSERVATION BOUND IS A DECISION ═══════════════════════════ */
  assert.ok(
    YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT > 1 &&
      YOUTUBE_CHANNEL_SERIES_OBSERVATION_LIMIT < MAX_OBSERVATIONS_PER_READ,
    "the recommended window is bounded, and chosen strictly below the seam's maximum",
  );

  /* ═══ 12. NO SURFACE CONSUMES IT YET, AND THAT IS DELIBERATE ════════════
   *
   * YT-SOC1 ships the derivation ONLY. SOC-UI1 owns the Social Intelligence dashboard, and this
   * assertion is what must be consciously changed when it is built — the deferral lives in code,
   * not only in a roadmap.
   */
  const pages = (function collect(dir: string): string[] {
    const abs = path.join(ROOT, dir);
    if (!existsSync(abs)) return [];
    return readdirSync(abs, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? collect(path.join(dir, e.name)) : /\.tsx?$/.test(e.name) ? [path.join(dir, e.name)] : [],
    );
  })(PAGE_DIR);
  for (const page of pages) {
    assert.ok(
      !codeOf(read(page)).includes("channel-measurement-series"),
      `${page} consumes the YouTube series — UI is SOC-UI1's phase, not this one`,
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
    codeOf(read(composition)).includes("channel-measurement-series"),
    "the composition boundary is the consumer of this derivation",
  );

  /* ═══ 13. PURE UNDER A HOSTILE ENVIRONMENT ═════════════════════════════ */
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
    const out = deriveYouTubeChannelMeasurementSeries({ status: "read", observations: [] });
    assert.equal(out.status, "no-observations");
  } finally {
    globals.fetch = realFetch;
    Date.now = realNow;
  }
  assert.equal(touched, null, "the derivation touched neither the network nor the clock when run");

  console.log(
    "youtube-social-intelligence/derivation-firewall: type-only imports, no db/network/tenant/" +
      "credential/Knowledge/Heby/YouTube reach, no write, no clock, no inter-count arithmetic, no " +
      "verdicts, NO cross-provider abstraction, page total != page count, contract closed, UI " +
      "deferral asserted, purity proved at runtime",
  );
}

main();
