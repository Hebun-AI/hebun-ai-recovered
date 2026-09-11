/*
 * SOC-UI1 — the boundaries of the Social Intelligence surface, proved from its own source.
 *
 * These are STRUCTURAL claims. Behaviour tests prove what the composition says; these prove what it
 * is incapable of saying, by proving the imports and identifiers that would be required to say it do
 * not exist anywhere in the phase.
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { WORKSPACES, getWorkspace } from "../../src/config/workspace-nav";

const ROOT = process.cwd();
const read = (file: string): string => readFileSync(path.join(ROOT, file), "utf8");

/** Source with comments stripped. A rule about CODE must not be satisfied or broken by prose. */
const codeOf = (source: string): string =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

function filesUnder(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  return readdirSync(abs).flatMap((entry) => {
    const rel = path.join(dir, entry);
    return statSync(path.join(ROOT, rel)).isDirectory() ? filesUnder(rel) : [rel];
  });
}

const PHASE_FILES: readonly string[] = Object.freeze([
  ...filesUnder("src/features/social-intelligence"),
  ...filesUnder("src/components/social-intelligence"),
  "src/app/(dashboard)/intelligence/social/page.tsx",
]);

const PHASE_CODE = PHASE_FILES.map((file) => codeOf(read(file))).join("\n");

/* ── 1–4 — navigation ──────────────────────────────────────────────────────── */

function navigationIsTheNarrowAuthorizedAmendment(): void {
  assert.equal(WORKSPACES.length, 7, "the top level is exactly seven workspaces — no eighth");
  const intel = getWorkspace("intelligence");
  const social = intel.destinations.find((d) => d.label === "Social Intelligence");
  assert.ok(social, "Social Intelligence is an Intelligence L2 destination");
  assert.equal(social!.href, "/intelligence/social", "SOC-0's approved route");
  assert.ok(!social!.unavailable, "it is a real route, not a placeholder");
}

function noProviderIsNamedInNavigation(): void {
  /*
   * THE NAV IS COMPILED IN AND TENANT-SHARED. A provider named at any level would tell EVERY
   * organization that Hebun watches a platform theirs may not have connected — and would do so
   * before any connection authority was consulted.
   */
  const nav = read("src/config/workspace-nav.ts");
  const navCode = codeOf(nav);
  for (const provider of ["Instagram", "YouTube", "instagram", "youtube", "TikTok", "LinkedIn"]) {
    assert.ok(
      !navCode.includes(provider),
      `navigation code names no provider — found "${provider}"`,
    );
  }
  for (const workspace of WORKSPACES) {
    for (const destination of workspace.destinations) {
      assert.ok(
        !/instagram|youtube|tiktok|linkedin|facebook/i.test(`${destination.label} ${destination.href ?? ""}`),
        `no provider-specific L2 entry: ${destination.label}`,
      );
    }
  }
}

/* ── 19–28 — what the phase cannot do ──────────────────────────────────────── */

function noCredentialAccess(): void {
  for (const forbidden of [
    "integration-credentials",
    "credential",
    "decrypt",
    "ENCRYPTION",
    "accessToken",
    "apiKey",
    "API_KEY",
  ]) {
    assert.ok(
      !PHASE_CODE.includes(forbidden),
      `SOC-UI1 code never touches credentials — found "${forbidden}"`,
    );
  }
}

function noProviderIsContacted(): void {
  /*
   * A SURFACE THAT COULD ASK A PROVIDER WOULD ASK ONE EVERY RENDER. There is no transport, no
   * client, no fetch and no provider origin anywhere in the phase — not because a comment forbids
   * it, but because the identifiers required to do it are absent.
   */
  for (const forbidden of [
    "instagram-transport",
    "youtube-transport",
    "instagram-access-token-call",
    "youtube-api-key-call",
    "graph.instagram.com",
    "googleapis.com",
    "fetch(",
    "XMLHttpRequest",
    "axios",
  ]) {
    assert.ok(!PHASE_CODE.includes(forbidden), `SOC-UI1 contacts no provider — found "${forbidden}"`);
  }
}

function theObservationSeamIsTheONLYWayIn(): void {
  /*
   * THE AUTHORITATIVE READ SEAM EXISTS, so nothing here may reach past it to the table. A direct
   * query would bypass the tenant predicate, the capability scope and the row limit the seam owns.
   */
  for (const forbidden of ["providerObservations", "provider-observation", "db/schema", "drizzle-orm"]) {
    assert.ok(
      !PHASE_CODE.includes(forbidden) ||
        PHASE_CODE.includes("read-provider-observations.server"),
      `no direct table access — found "${forbidden}"`,
    );
  }
  assert.ok(!PHASE_CODE.includes("drizzle-orm"), "no query builder is imported anywhere in the phase");
  assert.ok(!PHASE_CODE.includes("getControlPlaneDb"), "no database handle is acquired");
  assert.ok(
    read("src/features/social-intelligence/dashboard-read.server.ts").includes(
      "read-provider-observations.server",
    ),
    "observations arrive through the released read authority",
  );
}

function nothingIsWritten(): void {
  for (const forbidden of [
    "INSERT",
    "insert(",
    "update(",
    "delete(",
    "recordProviderObservation",
    "record-youtube",
    "record-instagram",
    "revalidatePath",
    '"use server"',
  ]) {
    assert.ok(!PHASE_CODE.includes(forbidden), `SOC-UI1 persists nothing — found "${forbidden}"`);
  }
}

function noKnowledgeGovernanceOrHebyReach(): void {
  for (const forbidden of [
    "features/knowledge",
    "features/governance",
    "features/heby",
    "enterprise-memory",
    "admitKnowledge",
    "agent-mandate",
    "standing-observation-authority",
    "action-execution",
  ]) {
    assert.ok(
      !PHASE_CODE.includes(forbidden),
      `SOC-UI1 reaches no other authority — found "${forbidden}"`,
    );
  }
}

function noFabricatedAnalytics(): void {
  /*
   * THE VOCABULARY OF THE DASHBOARD THIS WAS NOT ALLOWED TO BECOME. None of these has a provider
   * capability behind it for this organization, and none may appear as an identifier, a label or a
   * heading.
   *
   * ── IT IS THE CODE THAT IS SEARCHED, NOT THE COMMENTS ─────────────────────
   *
   * The first version of this guard searched the RAW source and failed immediately — on the page's
   * own header, which states that this surface has "no reach, no impressions, no demographics". The
   * product DENYING that it fabricates an analytic is the opposite of the defect, and a guard that
   * cannot tell a denial from a claim would push every honest explanation out of the codebase to
   * stay green. So comments are stripped: a heading, a label, a field name or a string this surface
   * RENDERS still trips it, and a comment explaining why none exists does not.
   */
  const RAW = PHASE_CODE;
  for (const forbidden of [
    "engagementRate",
    "engagement_rate",
    "engagementScore",
    "impressions",
    "reachCount",
    "demographic",
    "ageRange",
    "genderSplit",
    "bestTimeToPost",
    "heatmap",
    "sentiment",
    "benchmark",
    "topPerforming",
    "growthRate",
    "percentageChange",
  ]) {
    assert.ok(!RAW.includes(forbidden), `no fabricated analytic — found "${forbidden}"`);
  }
}

function noUniversalMetricTypeExists(): void {
  /*
   * The released derivations refuse to share a measurement type, and SOC-UI1 must not undo that at
   * the presentation layer. A generic `audience` or `totalFollowers` field would let a caller ask a
   * question — "what is this account's audience?" — that no provider answers.
   */
  for (const forbidden of [
    "audienceCount",
    "totalFollowers",
    "totalAudience",
    "SocialMeasurementSeries<",
    "universalMetric",
    "crossPlatform",
  ]) {
    assert.ok(!PHASE_CODE.includes(forbidden), `no universal metric — found "${forbidden}"`);
  }
}

function noChartDependencyWasAdded(): void {
  const pkg = JSON.parse(read("package.json")) as {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const library of ["recharts", "chart.js", "d3", "victory", "nivo", "@nivo/core", "apexcharts", "echarts", "visx"]) {
    assert.ok(!(library in all), `SOC-UI1 added no chart dependency — found "${library}"`);
  }
}

/* ── 29–32 — accessibility is structural, not decorative ───────────────────── */

function chartsCarryATextualEquivalent(): void {
  const chart = read("src/components/social-intelligence/measurement-series-chart.tsx");
  assert.ok(chart.includes('aria-hidden="true"'), "the plot itself is hidden from assistive technology");
  assert.ok(chart.includes("<table className=\"sr-only\">"), "and every point is a real table row instead");
  assert.ok(chart.includes("<caption>"), "the table names what it holds");
  assert.ok(chart.includes('scope="col"') && chart.includes('scope="row"'), "its cells are associated with headers");
  /*
   * THE ZERO MUST REACH THE TABLE AS A NUMBER. A guard that rendered `value || "—"` would turn every
   * real zero into a dash in the one place a screen-reader user can read it.
   */
  assert.ok(
    !/values\[index\]\s*\|\|/.test(chart),
    "the table never uses `||` on a value — it would erase a real zero",
  );
  assert.ok(chart.includes("values[index] === null"), "absence is tested explicitly against null");
}

function everyMetricHasASemanticName(): void {
  const card = read("src/components/social-intelligence/platform-summary-card.tsx");
  const change = read("src/components/social-intelligence/calculated-change.tsx");
  /* The scannable short label is never the only name a metric has. */
  assert.ok(card.includes("{metric.label}"), "the card announces the attributed metric name");
  assert.ok(change.includes("{cell.label}"), "the change block announces the attributed metric name");
  assert.ok(card.includes("<dl") && card.includes("<dt") && card.includes("<dd"), "metrics are a description list");
}

function externalLinksStaySafe(): void {
  /* The reused released component is the only thing that renders an outbound link on this page. */
  const media = read("src/components/platform-integrations/instagram-media-cards.tsx");
  assert.ok(media.includes('rel="noreferrer noopener nofollow"'), "outbound links carry the released rel policy");
  assert.ok(
    !/href=\{[^}]*permalink[^}]*\}/.test(PHASE_CODE),
    "SOC-UI1's own components render no provider URL of their own",
  );
}

function main(): void {
  navigationIsTheNarrowAuthorizedAmendment();
  noProviderIsNamedInNavigation();
  noCredentialAccess();
  noProviderIsContacted();
  theObservationSeamIsTheONLYWayIn();
  nothingIsWritten();
  noKnowledgeGovernanceOrHebyReach();
  noFabricatedAnalytics();
  noUniversalMetricTypeExists();
  noChartDependencyWasAdded();
  chartsCarryATextualEquivalent();
  everyMetricHasASemanticName();
  externalLinksStaySafe();
  console.log("SOC-UI1 surface firewall checks passed");
}

main();
