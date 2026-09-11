/*
 * IG-AN3 — the boundaries of the Instagram per-post measurement evolution, proved from its own
 * source and from the surfaces that carry it.
 *
 * The behaviour suite proves what the derivation SAYS. This proves what it is incapable of saying,
 * by proving the imports and identifiers required to say it are absent — and that the read seam it
 * depends on stayed a read of a bounded number of rows rather than becoming a second authority.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MEDIA_EVOLUTION_OBSERVATION_LIMIT } from "../../src/features/instagram-connection-surface/media-measurement-evolution";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";

const ROOT = process.cwd();
const MODULE = "src/features/instagram-connection-surface/media-measurement-evolution.ts";
const MODEL = "src/features/social-intelligence/dashboard-model.ts";
const READ = "src/features/social-intelligence/dashboard-read.server.ts";
const COMPONENT = "src/components/social-intelligence/media-evolution.tsx";
const PAGE = "src/app/(dashboard)/intelligence/social/page.tsx";

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
    "readProviderObservations",
    "resolveTenantContext",
    "TenantContext",
    "fetch(",
    "XMLHttpRequest",
    "credential",
    "decrypt",
    "accessToken",
    "process.env",
    "Date.now",
    "new Date",
    "Math.random",
  ]) {
    assert.ok(!CODE.includes(forbidden), `IG-AN3 is a pure derivation — found "${forbidden}"`);
  }
}

function itImportsOnlyTypesAndOneReleasedPolicy(): void {
  /*
   * SCANNED ON THE COMMENT-STRIPPED CODE. The module header quotes phrases in double quotes, and a
   * raw-source import scan reads those as imports. A rule about imports must look at imports.
   *
   * ── WHY THIS IS NOT "EVERY IMPORT IS TYPE-ONLY" ───────────────────────────
   *
   * IG-AN1's firewall states exactly that, and it is right for IG-AN1: a value import is how a
   * derivation quietly becomes a reader. IG-AN3 has ONE value import and it is deliberate — the
   * RELEASED permalink policy, which decides which provider URLs may become links. Restating that
   * policy here would give this module a second, independently-drifting opinion about link safety,
   * which is a worse outcome than the exception.
   *
   * So the rule is tightened rather than relaxed: every import is type-only EXCEPT that one, and the
   * exception is named. A second value import fails this.
   */
  const statements = CODE.match(/^import[\s\S]*?from\s+"[^"]+";/gm) ?? [];
  assert.ok(statements.length > 0, "the module does import its contracts — the scan is not vacuous");

  const valueImports = statements.filter((statement) => !/^import\s+type\b/.test(statement));
  assert.equal(valueImports.length, 1, `exactly ONE value import is permitted:\n${valueImports.join("\n")}`);
  assert.ok(
    /\{\s*safeInstagramPermalink\s*\}\s*from\s+"\.\/latest-media-observation"/.test(valueImports[0]!),
    `the one value import is the released permalink policy, and nothing else:\n${valueImports[0]}`,
  );

  const modules = [...CODE.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(
    modules,
    [
      "@/features/provider-observation-history/contracts",
      "@/features/provider-observation-history/read-provider-observations.server",
      "./latest-media-observation",
    ],
    "two type modules and the released sibling — no second input, no shared analytics module",
  );
}

/* ── 2 · no shared type with IG-AN2 or YT-SOC2 ─────────────────────────────── */

function itSharesNoTypeWithTheAccountOrChannelComparisons(): void {
  /*
   * A shared comparison type would let a caller build one list holding a FOLLOWER delta and a LIKE
   * delta and ask "how did Instagram change?" — a question neither derivation answers and neither
   * has the evidence for.
   */
  for (const forbidden of [
    "account-measurement-comparison",
    "account-measurement-series",
    "youtube-channel-surface",
    "InstagramMetricComparison",
    "InstagramAccountComparison",
    "YouTubeChannelComparison",
    "SocialMetricComparison",
  ]) {
    assert.ok(!CODE.includes(forbidden), `IG-AN3 owns its own vocabulary — found "${forbidden}"`);
  }
}

/* ── 3 · identity is the mediaId, in the code and not only in the prose ────── */

function identityIsNeverACaptionPermalinkIndexOrTimestamp(): void {
  /*
   * The behaviour suite proves the OUTCOME; this proves the MECHANISM. A match is a Map lookup keyed
   * by the provider's id, and the code contains no comparison of any other field between the two
   * observations that could become an identity.
   */
  assert.ok(/items\.get\(mediaId\)/.test(CODE), "a match is a lookup by the provider's own id");
  for (const forbidden of [
    "caption ===",
    "permalink ===",
    "publishedAt ===",
    ".indexOf(",
    "[index]",
    "localeCompare",
  ]) {
    assert.ok(!CODE.includes(forbidden), `identity is the mediaId alone — found "${forbidden}"`);
  }
}

/* ── 4 · no interpretation, no ranking, no rate ────────────────────────────── */

function itCannotScoreRankOrNormalise(): void {
  for (const forbidden of [
    "engagementRate",
    "percentage",
    "percent",
    "velocity",
    "momentum",
    "score",
    "rank",
    "forecast",
    "predict",
    "benchmark",
    "average",
    "reduce(",
    "/ 86400",
    "getTime()",
  ]) {
    assert.ok(!CODE.includes(forbidden), `IG-AN3 calculates a difference and nothing else — found "${forbidden}"`);
  }
}

function theOnlyArithmeticIsOneSubtraction(): void {
  /*
   * Every arithmetic operator in the code, counted. One subtraction (the change) and two increments
   * (the unmatched counters) are the whole of it. A third kind of operator appearing here would mean
   * a rate, a ratio or a total was added without anyone deciding to.
   */
  const subtractions = [...CODE.matchAll(/latest\s*-\s*previous/g)].length;
  assert.equal(subtractions, 1, "there is exactly ONE subtraction, and it is `latest - previous`");
  /*
   * SCANNED WITH IMPORT LINES AND STRING LITERALS REMOVED. The first version of this check was not,
   * and it failed on the slashes inside `@/features/...` — a rule about arithmetic that fires on a
   * module path is a rule nobody can keep, and would have been "fixed" by weakening it.
   */
  const expressions = CODE.replace(/^import[\s\S]*?from\s+"[^"]+";/gm, "").replace(/"[^"]*"/g, '""');
  for (const forbidden of [/\*/, /\//, /%/]) {
    assert.ok(
      !forbidden.test(expressions),
      `no multiplication, division or modulo — matched ${forbidden}`,
    );
  }
}

function itCannotSortTheOutput(): void {
  /*
   * ONE sort, and it orders OBSERVATIONS BY TIME — never items by value. Sorting items by change
   * would rank the posts, and a ranking is a claim about which post matters.
   */
  const sorts = [...CODE.matchAll(/\.sort\(/g)].length;
  assert.equal(sorts, 1, "there is exactly one sort");
  assert.ok(
    /snapshots\.sort\(\(a, b\) => \(a\.observedAt/.test(CODE),
    "the only sort orders observations by their instant, oldest first",
  );
  assert.ok(!/items\.sort\(/.test(CODE), "items are never re-ordered by this module");
  assert.ok(!/\.change\b[^;]*sort/.test(CODE), "nothing is ordered by a calculated change");
}

/* ── 5 · no provider mutation, anywhere on the path ────────────────────────── */

function nothingOnTheIgAn3PathCanWriteToAProvider(): void {
  for (const file of [MODULE, MODEL, COMPONENT]) {
    const code = codeOf(read(file));
    /*
     * PATTERNS, NOT SUBSTRINGS. A bare "publish" substring matched `publishedAt` — the provider's
     * own publication timestamp, which is a FACT this surface must carry. A guard that fires on the
     * evidence is a guard that gets weakened; `\bpublish\b` names the capability instead.
     */
    for (const forbidden of [
      /\bfetch\s*\(/,
      /method:\s*"(POST|PUT|PATCH|DELETE)"/,
      /instagram-transport/,
      /\bpublish\b|\bpublishing\b|publishMedia/i,
      /graph\.instagram\.com|graph\.facebook\.com/,
    ]) {
      assert.ok(!forbidden.test(code), `${file} must not reach a provider — matched ${forbidden}`);
    }
  }
}

/* ── 6 · no persistence, no schema, no Knowledge ───────────────────────────── */

function nothingIsStoredAndNoNewAuthorityIsIntroduced(): void {
  for (const file of [MODULE, MODEL, COMPONENT]) {
    const code = codeOf(read(file));
    for (const forbidden of [
      "insert(",
      "update(",
      "delete(",
      "migrations",
      "pgTable",
      "knowledge",
      "recordWork",
      "mandate",
      "permit",
      "agent",
    ]) {
      assert.ok(
        !code.toLowerCase().includes(forbidden.toLowerCase()),
        `IG-AN3 stores nothing and mints no authority — ${file} contains "${forbidden}"`,
      );
    }
  }
}

/* ── 7 · the read stayed a bounded read of ONE released seam ───────────────── */

function theMediaReadIsBoundedAndGoesThroughTheReleasedSeam(): void {
  const code = codeOf(read(READ));
  assert.ok(
    code.includes("limit: MEDIA_EVOLUTION_OBSERVATION_LIMIT"),
    "the media read carries IG-AN3's own recommended bound, imported rather than restated",
  );
  assert.ok(!/limit:\s*\d+/.test(code), "no read carries an inline numeric limit");
  assert.ok(
    code.includes("capabilityKey: INSTAGRAM_MEDIA_PUBLIC_READ_CAPABILITY"),
    "the media read is still scoped to its capability by name",
  );
  /* ONE observation-history read authority for the whole surface. No second store appeared. */
  assert.equal(
    [...code.matchAll(/readProviderObservations\(/g)].length,
    3,
    "three capability-scoped reads through the one released authority — no fourth, no second store",
  );
  assert.ok(
    MEDIA_EVOLUTION_OBSERVATION_LIMIT <= MAX_OBSERVATIONS_PER_READ,
    "the recommended bound never exceeds the seam's own maximum",
  );
}

/* ── 8 · the surface separates the provider's number from Hebun's ──────────── */

function theSurfaceNamesBothProvenancesAndInterpretsNeither(): void {
  const component = read(COMPONENT);
  assert.ok(
    /ProvenanceChip kind="authoritative" detail="Instagram reported"/.test(component),
    "the provider's counts are attributed to the provider",
  );
  assert.ok(
    /ProvenanceChip kind="derived" detail="Hebun calculated"/.test(component),
    "the arithmetic is attributed to Hebun",
  );
  assert.ok(
    component.includes("latestDisplay") && component.includes("changeDisplay"),
    "the count and the change are rendered as two separate claims",
  );

  /*
   * THE SURFACE FIREWALL RELEASED WITH SOC-UI1 REQUIRES EXACTLY ONE OUTBOUND LINK RENDERER on this
   * page, and it is the released media-cards component. IG-AN3 draws a subset of the posts that
   * component already links one panel above, so it adds no second `href` and no second place for the
   * `rel` policy to drift. Asserted here so a later edit has to come past this line.
   */
  assert.ok(
    !/href=\{/.test(component),
    "IG-AN3's card renders no outbound URL — the released media-cards component is the one that does",
  );

  /*
   * THE WORDS THE SURFACE MAY NOT USE, checked on the RENDERED text rather than the whole file —
   * the header prose names these words in order to forbid them, and a raw scan would read the
   * prohibition as the violation.
   */
  const rendered = codeOf(component) + codeOf(read(PAGE));
  for (const forbidden of [
    /engagement growth/i,
    /\bperformance\b/i,
    /successful content/i,
    /\btrending\b/i,
    /\bviral\b/i,
    /best post/i,
    /\bimproving\b/i,
    /\bdeclining\b/i,
  ]) {
    assert.ok(!forbidden.test(rendered), `IG-AN3 owns no interpretation — matched ${forbidden}`);
  }
}

function theChangeIsAlwaysAccompaniedByWhatItIsADifferenceBetween(): void {
  const component = read(COMPONENT);
  assert.ok(
    /const SINCE = "since the previous Hebun observation"/.test(component),
    "a signed figure is introduced by words naming the act that created the baseline",
  );
  for (const forbidden of [/since yesterday/i, /\bdaily\b/i, /\bper day\b/i]) {
    assert.ok(
      !forbidden.test(codeOf(component)),
      `the cadence is another authority's contract — matched ${forbidden}`,
    );
  }
  assert.ok(
    /previousObservedAt/.test(component) && /latestObservedAt/.test(component),
    "the window is stated as two instants, always",
  );
}

/* ── 9 · IG-AN1 and IG-AN2 are untouched ───────────────────────────────────── */

function theReleasedAccountDerivationsAreNotReachedIntoByIgAn3(): void {
  const model = codeOf(read(MODEL));
  /* The account comparison mapper and the media one are separate functions over separate types. */
  assert.ok(model.includes("instagramChangeBlockOf"), "IG-AN2's mapper still exists");
  assert.ok(model.includes("mediaEvolutionBlockOf"), "IG-AN3 has its OWN mapper");
  assert.ok(
    !/mediaEvolutionBlockOf\([^)]*Comparison\)/.test(model),
    "the media mapper is never handed an account comparison",
  );
  /* The account series' own bound was not repointed at IG-AN3's. */
  assert.ok(
    codeOf(read(READ)).includes("limit: ACCOUNT_SERIES_OBSERVATION_LIMIT"),
    "the account read keeps its own bound",
  );
}

function main(): void {
  itReachesNoAuthorityOfItsOwn();
  itImportsOnlyTypesAndOneReleasedPolicy();
  itSharesNoTypeWithTheAccountOrChannelComparisons();
  identityIsNeverACaptionPermalinkIndexOrTimestamp();
  itCannotScoreRankOrNormalise();
  theOnlyArithmeticIsOneSubtraction();
  itCannotSortTheOutput();
  nothingOnTheIgAn3PathCanWriteToAProvider();
  nothingIsStoredAndNoNewAuthorityIsIntroduced();
  theMediaReadIsBoundedAndGoesThroughTheReleasedSeam();
  theSurfaceNamesBothProvenancesAndInterpretsNeither();
  theChangeIsAlwaysAccompaniedByWhatItIsADifferenceBetween();
  theReleasedAccountDerivationsAreNotReachedIntoByIgAn3();
  console.log("IG-AN3 media evolution firewall checks passed");
}

main();
