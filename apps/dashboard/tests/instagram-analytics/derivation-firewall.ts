/*
 * IG-AN1 · WHERE THE DERIVATION BOUNDARY IS, AND WHAT IT REFUSES TO CROSS.
 *
 * Source is read with comments STRIPPED, so no rule here can be satisfied — or tripped — by prose.
 * Every ban below is aimed at a capability, never at a spelling.
 *
 * THE SENTENCES THIS FILE DEFENDS:
 *
 *   A DERIVATION READS NOTHING. It is handed a result the released seam already produced.
 *   A DERIVATION WRITES NOTHING. There is no analytics store, and this does not become one.
 *   A DERIVATION HAS NO CLOCK. What it says about evidence cannot change while nobody edits it.
 *   A DERIVATION DOES NOT RECOMMEND. It orders measurements; it does not judge them.
 *
 * The last is the one worth stating twice. Subtracting two follower counts is easy, and that is
 * exactly why the boundary has to be held in a file rather than in an intention.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  ACCOUNT_SERIES_OBSERVATION_LIMIT,
  deriveInstagramAccountMeasurementSeries,
} from "../../src/features/instagram-connection-surface/account-measurement-series";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";

const ROOT = process.cwd();
const read = (f: string): string => readFileSync(path.join(ROOT, f), "utf8");
const codeOf = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const MODULE = "src/features/instagram-connection-surface/account-measurement-series.ts";
const PAGE = "src/app/(dashboard)/integrations/instagram/page.tsx";

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

  /* ═══ 2. IT CANNOT READ ═════════════════════════════════════════════════ */
  const CANNOT_REACH: readonly (readonly [RegExp, string])[] = [
    [/\bgetControlPlaneDb\b|\bdrizzle\b|\bproviderObservations\b/, "a database handle or table"],
    [/\bfetch\s*\(|\bXMLHttpRequest\b|node:https?/, "the network"],
    [/\bresolveTenantContext\b|\bTenantContext\b/, "tenant resolution — the seam owns the tenant"],
    [/\breadProviderObservations\b/, "the read seam itself — it is handed the RESULT, never the read"],
    [/\bdecrypt\b|\bcredential\b/i, "a credential"],
    [/\bknowledge\b/i, "Knowledge — an observation is not Knowledge"],
    [/\bheby\b/i, "Heby"],
    [/\bgraphApi\b|\binstagramRequest\b|graph\.instagram\.com|graph\.facebook\.com/, "Meta"],
  ];
  for (const [pattern, what] of CANNOT_REACH) {
    assert.ok(!pattern.test(source), `the derivation does not reach ${what}`);
  }

  /* ═══ 3. IT CANNOT WRITE ════════════════════════════════════════════════ */
  for (const pattern of [/\binsert\b/i, /\bupdate\s*\(/, /\bpersist\w*\(/i, /\bwriteFile/, /\bcache\b/i]) {
    assert.ok(!pattern.test(source), `the derivation persists nothing (${pattern})`);
  }

  /* ═══ 4. IT HAS NO CLOCK ════════════════════════════════════════════════ */
  /*
   * A DERIVATION WITH A CLOCK IS NOT A DERIVATION. If "how much history exists" could depend on
   * the current time, the same stored evidence would produce different answers on different days
   * with nobody having decided that. There is also no formatting here — the instants are carried
   * exactly as stored — so `Date` has no legitimate use in this file at all.
   */
  for (const pattern of [/\bDate\b/, /\bDate\.now\b/, /\bperformance\.now\b/, /\bMath\.random\b/, /\bIntl\b/]) {
    assert.ok(!pattern.test(source), `the derivation has no clock or randomness (${pattern})`);
  }

  /* ═══ 5. IT CALCULATES NOTHING BETWEEN MEASUREMENTS ═════════════════════ */
  /*
   * Aimed at CAPABILITY, not vocabulary. `points.length` is arithmetic-free counting and stays
   * legal; what must not appear is any operator applied BETWEEN two reported counts, and any name
   * for the number such an operation would produce.
   */
  const DERIVED_NAMES =
    /\b(delta|difference|growth|trend|rate|percent|percentage|average|mean|median|momentum|velocity|score|ranking?|forecast|projection)\b/i;
  /*
   * CAMELCASE IS SPLIT FIRST. A bite-proof adding `followersDelta` walked straight past this ban:
   * `\bdelta\b` has no word boundary at a camelCase hump, so the very naming convention the codebase
   * uses was the one shape the guard could not see. Splitting `followersDelta` into `followers Delta`
   * makes the boundary real, and leaves innocent words (`generate`, `meaning`) untouched.
   */
  const wordSeparated = source.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
  assert.ok(
    !DERIVED_NAMES.test(wordSeparated),
    "no derived-quantity vocabulary — a name for a calculated number is the first half of calculating it",
  );
  const COUNT_ARITHMETIC = /(followersCount|followsCount|mediaCount)\s*[-+*/]|[-+*/]\s*(followersCount|followsCount|mediaCount)\b/;
  assert.ok(
    !COUNT_ARITHMETIC.test(source),
    "no operator is applied between reported counts — subtraction is IG-AN2's question, not this module's",
  );

  /* ═══ 6. IT DOES NOT SPEAK IN VERDICTS ══════════════════════════════════ */
  const RECOMMENDATION =
    /\b(recommend|suggest|should\s+post|you\s+should|advise|opportunity|underperform|outperform|healthy|poor performance|doing well)\b/i;
  assert.ok(!RECOMMENDATION.test(read(MODULE)), "no recommendation vocabulary, prose included");

  /* ═══ 7. THE CONTRACT HAS NOWHERE TO PUT A DERIVED NUMBER ═══════════════ */
  /*
   * The strongest guard is structural: the exported types declare exactly these fields, so an
   * edit that wanted to smuggle a calculation in would have to widen the contract in public.
   */
  const pointFields = (source.match(/interface InstagramAccountMeasurementPoint \{([\s\S]*?)\n\}/) ?? [])[1] ?? "";
  assert.ok(pointFields.length > 0, "the measurement point interface is present — the scan is not vacuous");
  const declared = [...pointFields.matchAll(/readonly (\w+)[?]?:/g)].map((m) => m[1]).sort();
  assert.deepEqual(
    declared,
    ["followersCount", "followsCount", "mediaCount", "observedAt"],
    "a measurement point declares the reported counts and the observed instant — and nothing else",
  );

  /* ═══ 8. THE OBSERVATION BOUND IS A DECISION ════════════════════════════ */
  assert.ok(
    ACCOUNT_SERIES_OBSERVATION_LIMIT > 1 && ACCOUNT_SERIES_OBSERVATION_LIMIT < MAX_OBSERVATIONS_PER_READ,
    "the recommended window is bounded, and chosen strictly below the seam's maximum",
  );

  /* ═══ 9. NO SURFACE CONSUMES IT YET, AND THAT IS DELIBERATE ═════════════ */
  /*
   * IG-AN1 ships the derivation ONLY. Production holds exactly one account observation, so a UI
   * built on this could say nothing except "not enough history" — a surface whose entire content is
   * an apology. When a consumer is added this assertion is the thing that must be consciously
   * changed, which is the point: the deferral is recorded in code, not only in a document.
   */
  if (existsSync(path.join(ROOT, PAGE))) {
    assert.ok(
      !codeOf(read(PAGE)).includes("account-measurement-series"),
      "the Instagram page does NOT yet render a measurement series — UI is deferred until the " +
        "evidence supports one. Adding a consumer means updating this assertion on purpose.",
    );
  }

  /* ═══ 10. THE EXPORTED FUNCTION IS PURE UNDER A HOSTILE ENVIRONMENT ═════ */
  /*
   * Structure proves what the module CAN reach; this proves what it DOES. Both `fetch` and
   * `Date.now` are replaced with detonators for the duration of one call.
   */
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
    const out = deriveInstagramAccountMeasurementSeries({ status: "read", observations: [] });
    assert.equal(out.status, "no-observations");
  } finally {
    globals.fetch = realFetch;
    Date.now = realNow;
  }
  assert.equal(touched, null, "the derivation touched neither the network nor the clock when run");

  console.log(
    "instagram-analytics/derivation-firewall: type-only imports, no db/network/tenant/credential/" +
      "Knowledge/Heby/Meta reach, no write, no clock, no inter-count arithmetic, no verdicts, " +
      "contract closed to derived fields, UI deferral asserted, purity proved at runtime",
  );
}

main();
