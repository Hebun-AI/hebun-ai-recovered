/*
 * SOC-UI1 — what the Social Intelligence composition may and may not say.
 *
 * The composition is a PRESENTATION layer over released read models. Every assertion below is about
 * a sentence a human would read on the surface, not about a token a component happens to contain.
 * TRH-IG7 is the standing lesson: a test that asserts the presence of a variable proves nothing
 * about the meaning a reader received.
 */
import assert from "node:assert/strict";
import type { ConnectionListing, IntegrationView } from "../../src/features/integration-authority/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  SOCIAL_PLATFORMS,
  INSTAGRAM_PLATFORM,
  YOUTUBE_PLATFORM,
} from "../../src/features/social-intelligence/contracts";
import { resolveSocialPlatformPresence } from "../../src/features/social-intelligence/platform-presence";
import { composeSocialDashboard } from "../../src/features/social-intelligence/dashboard-model";

/* ── Fixtures ──────────────────────────────────────────────────────────────── */

function connection(over: Partial<IntegrationView>): IntegrationView {
  return {
    integrationId: "i1",
    name: "n",
    providerKey: "instagram",
    connectionState: "connected",
    health: "healthy",
    scopes: [],
    externalAccountId: null,
    externalAccountLabel: null,
    lastVerifiedAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    failureReason: null,
    revokedAt: null,
    createdAt: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

const read = (observations: readonly { observedAt: string; facts: Record<string, unknown> }[]) =>
  ({
    status: "read",
    observations: observations.map((o, i) => ({
      observationId: `o${i}`,
      providerKey: "x",
      capabilityKey: "y",
      subjectKind: "s",
      subjectRef: "r",
      integrationId: null,
      observedAt: o.observedAt,
      recordedAt: o.observedAt,
      observedByActorType: null,
      standingAuthorizationId: null,
      invocationId: null,
      facts: o.facts,
    })),
    /* The released seam returns newest-first; fixtures must reproduce that, not a convenient order. */
  }) as unknown as ProviderObservationReadResult;

const NEWEST_FIRST = <T>(rows: readonly T[]) => [...rows].reverse();

const YT_ZEROS = NEWEST_FIRST([
  { observedAt: "2026-09-07T14:40:20.113Z", facts: { subscriberCount: 0, videoCount: 0, viewCount: 0, hiddenSubscriberCount: false } },
  { observedAt: "2026-09-08T09:03:57.382Z", facts: { subscriberCount: 0, videoCount: 0, viewCount: 0, hiddenSubscriberCount: false } },
  { observedAt: "2026-09-09T10:00:20.919Z", facts: { subscriberCount: 0, videoCount: 0, viewCount: 0, hiddenSubscriberCount: false } },
  { observedAt: "2026-09-10T11:00:20.489Z", facts: { subscriberCount: 0, videoCount: 0, viewCount: 0, hiddenSubscriberCount: false } },
]);

const IG_ONE = [
  {
    observedAt: "2026-09-10T08:00:18.986Z",
    facts: { username: "turkishrughousecom", accountType: "BUSINESS", followersCount: 56, followsCount: 83, mediaCount: 8 },
  },
];

const IG_MEDIA = [
  {
    observedAt: "2026-09-10T14:00:19.320Z",
    facts: {
      recentMediaCount: 2,
      moreMediaExist: false,
      recentMedia: [
        { mediaType: "IMAGE", caption: "A rug", permalink: "https://www.instagram.com/p/abc/", publishedAt: "2026-09-01T10:00:00.000Z", likeCount: 3, commentCount: 0 },
        { mediaType: "VIDEO", caption: null, permalink: "http://evil.example/p/x", publishedAt: null, likeCount: null, commentCount: 1 },
      ],
    },
  },
];

const LIVE_BOTH: ConnectionListing = {
  status: "read",
  connections: [
    connection({ providerKey: "instagram", externalAccountLabel: "@turkishrughousecom", lastVerifiedAt: "2026-09-10T06:57:02.215Z" }),
    connection({ providerKey: "youtube", integrationId: "i2", externalAccountLabel: "YouTube Data API v3 — public read (no account)" }),
  ],
};

const compose = (listing: ConnectionListing) =>
  composeSocialDashboard({
    connections: listing,
    instagramAccount: read(IG_ONE),
    instagramMedia: read(IG_MEDIA),
    youtubeChannel: read(YT_ZEROS),
  });

/* ── 5/6/7 — only a real connection makes a live platform card ─────────────── */

function onlyConnectedPlatformsAreLive(): void {
  const model = compose(LIVE_BOTH);
  assert.deepEqual(
    model.platforms.map((p) => p.key),
    ["instagram", "youtube"],
    "both genuinely connected platforms appear",
  );
  for (const p of model.platforms) assert.equal(p.presence.status, "live", `${p.key} is live`);
}

function aDefinitionAloneCannotCreateALiveCard(): void {
  /*
   * THE REGISTRY LISTS BOTH PLATFORMS UNCONDITIONALLY. That is the point of the test: a platform
   * Hebun KNOWS ABOUT is not a platform this organization has CONNECTED, and only the connection
   * authority may promote one to the other.
   */
  assert.equal(SOCIAL_PLATFORMS.length, 2, "two supported platform definitions exist");
  const model = compose({ status: "read", connections: [] });
  assert.equal(model.platforms.length, 0, "zero connections produce zero platform cards");
  assert.equal(model.presenceKnown, true, "and that is a known answer, not an unknown one");
}

function anUnverifiedOrRevokedConnectionIsNotLive(): void {
  for (const state of ["draft", "unverified", "expired", "revoked", "disconnected"] as const) {
    const listing: ConnectionListing = { status: "read", connections: [connection({ connectionState: state })] };
    const presence = resolveSocialPlatformPresence(listing, INSTAGRAM_PLATFORM.providerKey);
    assert.notEqual(presence.status, "live", `${state} is not live`);
    assert.equal(presence.status, "not-live");
  }
}

function connectedButUnhealthyIsImpairedNotLive(): void {
  for (const health of ["degraded", "unreachable", "unknown"] as const) {
    const listing: ConnectionListing = { status: "read", connections: [connection({ health })] };
    const presence = resolveSocialPlatformPresence(listing, INSTAGRAM_PLATFORM.providerKey);
    assert.equal(presence.status, "impaired", `connected + ${health} is impaired`);
  }
}

function anUnreadableConnectionAuthorityIsUnknownNotAbsent(): void {
  const listing: ConnectionListing = { status: "unavailable", reason: "persistence-not-configured" };
  const presence = resolveSocialPlatformPresence(listing, INSTAGRAM_PLATFORM.providerKey);
  assert.equal(presence.status, "unknown", "a failed read is never reported as 'not connected'");
  const model = composeSocialDashboard({
    connections: listing,
    instagramAccount: read(IG_ONE),
    instagramMedia: read(IG_MEDIA),
    youtubeChannel: read(YT_ZEROS),
  });
  assert.equal(model.presenceKnown, false, "the surface must say it does not know");
}

function theNewestConnectionRowWins(): void {
  /* Production holds TWO rows per provider. A stale revoked row must not out-vote the live one. */
  const listing: ConnectionListing = {
    status: "read",
    connections: [
      connection({ integrationId: "old", connectionState: "revoked", createdAt: "2026-08-01T00:00:00.000Z" }),
      connection({ integrationId: "new", connectionState: "connected", createdAt: "2026-09-01T00:00:00.000Z" }),
    ],
  };
  assert.equal(resolveSocialPlatformPresence(listing, "instagram").status, "live");
}

/* ── 8/9 — a real zero is a zero; an absence is not ────────────────────────── */

function realYouTubeZerosRenderAsZero(): void {
  const yt = compose(LIVE_BOTH).platforms.find((p) => p.key === "youtube")!;
  assert.equal(yt.evidence, "observed");
  const byShort = Object.fromEntries(yt.metrics.map((m) => [m.shortLabel, m]));
  for (const name of ["Subscribers", "Videos", "Views"]) {
    const cell = byShort[name];
    assert.ok(cell, `${name} is present`);
    assert.equal(cell.value, 0, `${name} value is the number zero`);
    assert.equal(cell.display, "0", `${name} DISPLAYS as "0" — never "—", never "No data"`);
    assert.equal(cell.reported, true, `${name} is reported evidence, not an absence`);
    assert.equal(cell.absence, null, `${name} has nothing to excuse`);
  }
}

function anUnreportedMetricIsNotZero(): void {
  const model = composeSocialDashboard({
    connections: LIVE_BOTH,
    instagramAccount: read(IG_ONE),
    instagramMedia: read(IG_MEDIA),
    youtubeChannel: read(
      NEWEST_FIRST([
        { observedAt: "2026-09-10T11:00:20.489Z", facts: { videoCount: 0, viewCount: 0, hiddenSubscriberCount: true } },
      ]),
    ),
  });
  const subs = model.platforms.find((p) => p.key === "youtube")!.metrics.find((m) => m.shortLabel === "Subscribers")!;
  assert.equal(subs.value, null, "a withheld count is null");
  assert.notEqual(subs.display, "0", "and it must never DISPLAY as zero");
  assert.equal(subs.reported, false);
  assert.ok(subs.absence && /hid/i.test(subs.absence), `the reason survives presentation: ${subs.absence}`);
}

function hiddenAndNotReportedRemainDifferentSentences(): void {
  const withFlag = composeSocialDashboard({
    connections: LIVE_BOTH,
    instagramAccount: read(IG_ONE),
    instagramMedia: read(IG_MEDIA),
    youtubeChannel: read(NEWEST_FIRST([{ observedAt: "2026-09-10T11:00:20.489Z", facts: { videoCount: 0, hiddenSubscriberCount: true } }])),
  }).platforms.find((p) => p.key === "youtube")!.metrics.find((m) => m.shortLabel === "Subscribers")!;
  const withoutFlag = composeSocialDashboard({
    connections: LIVE_BOTH,
    instagramAccount: read(IG_ONE),
    instagramMedia: read(IG_MEDIA),
    youtubeChannel: read(NEWEST_FIRST([{ observedAt: "2026-09-10T11:00:20.489Z", facts: { videoCount: 0 } }])),
  }).platforms.find((p) => p.key === "youtube")!.metrics.find((m) => m.shortLabel === "Subscribers")!;
  assert.notEqual(withFlag.absence, withoutFlag.absence, "hidden-by-channel and not-reported read differently");
}

/* ── Metric identity — followers are not subscribers ───────────────────────── */

function metricIdentityIsExplicitAndNeverShared(): void {
  const model = compose(LIVE_BOTH);
  const ig = model.platforms.find((p) => p.key === "instagram")!;
  const yt = model.platforms.find((p) => p.key === "youtube")!;
  const igShort = ig.metrics.map((m) => m.shortLabel);
  const ytShort = yt.metrics.map((m) => m.shortLabel);
  assert.deepEqual(igShort, ["Followers", "Following", "Posts"]);
  assert.deepEqual(ytShort, ["Subscribers", "Videos", "Views"]);
  for (const name of igShort) assert.ok(!ytShort.includes(name), `${name} is Instagram's alone`);
  /* And the long label names the PROVIDER that said it, so no cell floats free of its source. */
  for (const m of ig.metrics) assert.ok(/Instagram/.test(m.label), `"${m.label}" names Instagram`);
  for (const m of yt.metrics) assert.ok(/YouTube/.test(m.label), `"${m.label}" names YouTube`);
  /* The subject nouns differ, because an account and a channel are not the same object. */
  assert.notEqual(INSTAGRAM_PLATFORM.subjectNoun, YOUTUBE_PLATFORM.subjectNoun);
}

/* ── 10/11 — one Instagram measurement is not a comparison ─────────────────── */

function oneInstagramMeasurementProducesNoComparison(): void {
  const model = compose(LIVE_BOTH);
  assert.equal(model.instagram.evolution.status, "single-measurement", "one point stays one point");
  assert.ok(
    !("change" in (model.instagram.evolution as Record<string, unknown>)),
    "there is no field on the Instagram evolution in which a change could be placed",
  );
  assert.ok(model.instagram.evolutionSentence, "an honest sentence explains why");
  assert.ok(
    /second observation|comparison/i.test(model.instagram.evolutionSentence!),
    `it says a second observation is needed: ${model.instagram.evolutionSentence}`,
  );
  assert.equal(model.instagram.points.length, 1, "exactly one point is plotted — no invented partner");
}

function instagramGainsItsChangeOnlyFromTheReleasedDerivation(): void {
  /*
   * SOC-UI1 pinned this to `null` and declared that IG-AN2 would be the phase to change it. It is,
   * and it did. What the pin actually defended is unchanged and is re-asserted here: the UI computes
   * nothing of its own. With ONE measurement there is still no comparison — the fixture carries a
   * single Instagram observation, so the honest answer remains "insufficient history".
   */
  const model = compose(LIVE_BOTH);
  assert.equal(model.instagram.changes, null, "one measurement still yields no comparison");
  assert.equal(model.instagram.comparison.status, "insufficient-history");
  assert.ok(
    model.instagram.changesSentence && /second/i.test(model.instagram.changesSentence),
    `and the released sentence says why: ${model.instagram.changesSentence}`,
  );
}

function twoInstagramMeasurementsProduceTheReleasedComparison(): void {
  /*
   * The real production evidence that unblocked IG-AN2: two observations, identical counts. The
   * change is 0/0/0 and every cell must be a CALCULATION, never an absence.
   */
  const model = composeSocialDashboard({
    connections: LIVE_BOTH,
    instagramAccount: read(
      NEWEST_FIRST([
        { observedAt: "2026-09-10T08:00:18.986Z", facts: { followersCount: 56, followsCount: 83, mediaCount: 8 } },
        { observedAt: "2026-09-11T10:00:20.258Z", facts: { followersCount: 56, followsCount: 83, mediaCount: 8 } },
      ]),
    ),
    instagramMedia: read(IG_MEDIA),
    youtubeChannel: read(YT_ZEROS),
  });
  assert.equal(model.instagram.comparison.status, "compared");
  assert.equal(model.instagram.changesSentence, null, "a comparison needs no excuse");
  const changes = model.instagram.changes;
  assert.ok(changes, "the comparison reaches the surface");
  assert.equal(changes!.previousObservedAt, "2026-09-10T08:00:18.986Z");
  assert.equal(changes!.latestObservedAt, "2026-09-11T10:00:20.258Z");
  const byShort = Object.fromEntries(changes!.cells.map((c) => [c.shortLabel, c]));
  for (const name of ["Followers", "Following", "Posts"]) {
    const cell = byShort[name];
    assert.ok(cell, `${name} is present`);
    assert.equal(cell.status, "comparable", `${name} was comparable`);
    assert.equal(cell.change, 0, `${name} change is the number zero`);
    assert.equal(cell.display, "0", `${name} displays as "0", never a dash`);
  }
  /* And Instagram's metric names never become YouTube's. */
  for (const forbidden of ["Subscribers", "Videos", "Views"]) {
    assert.ok(!(forbidden in byShort), `${forbidden} belongs to YouTube alone`);
  }
}

/* ── 14/15 — a real flat zero series remains a valid calculation ───────────── */

function flatZeroSeriesIsAValidSeries(): void {
  const model = compose(LIVE_BOTH);
  assert.equal(model.youtube.evolution.status, "series");
  assert.equal(model.youtube.points.length, 4, "four measurements are four points");
  for (const p of model.youtube.points) assert.equal(p.values.Subscribers, 0);
  assert.equal(model.youtube.evolutionSentence, null, "a real series needs no excuse");
}

function zeroChangeIsACalculationNotAnAbsence(): void {
  const changes = compose(LIVE_BOTH).youtube.changes;
  assert.ok(changes, "YT-SOC2 produced a comparison");
  assert.equal(changes!.status, "compared");
  const byShort = Object.fromEntries(changes!.cells.map((c) => [c.shortLabel, c]));
  for (const name of ["Subscribers", "Videos", "Views"]) {
    const cell = byShort[name];
    assert.equal(cell.status, "comparable", `${name} was comparable`);
    assert.equal(cell.change, 0, `${name} change is the number zero`);
    assert.equal(cell.display, "0", `${name} displays as "0"`);
  }
  assert.equal(changes!.previousObservedAt, "2026-09-09T10:00:20.919Z");
  assert.equal(changes!.latestObservedAt, "2026-09-10T11:00:20.489Z");
}

function noChangeCellCarriesAVerdict(): void {
  /*
   * IT MUST SCAN PROSE THAT ACTUALLY EXISTS, IN EVERY SHAPE THE SURFACE CAN REACH.
   *
   * The first version of this guard scanned only the all-comparable fixture — where every metric
   * compared cleanly, so every gap note was `null` and the collected prose was nearly empty. A
   * bite-proof then planted the sentence "Performance has been stable across this window" into a gap
   * note and the guard stayed GREEN, because that note was never rendered by the scenario it was
   * given. A word ban over text the fixture cannot produce bans nothing.
   *
   * So both shapes are collected: the comparable case, and a case where one metric is missing an
   * endpoint and its gap note IS rendered.
   */
  const comparable = compose(LIVE_BOTH).changesProse;
  const withAGap = composeSocialDashboard({
    connections: LIVE_BOTH,
    instagramAccount: read(IG_ONE),
    instagramMedia: read(IG_MEDIA),
    youtubeChannel: read(
      NEWEST_FIRST([
        /* The earlier observation withholds views; the later one reports it. */
        { observedAt: "2026-09-09T10:00:20.919Z", facts: { subscriberCount: 0, videoCount: 0 } },
        { observedAt: "2026-09-10T11:00:20.489Z", facts: { subscriberCount: 0, videoCount: 0, viewCount: 4 } },
      ]),
    ),
  });
  const gapNotes = withAGap.youtube.changes!.cells.map((c) => c.note).filter((n): n is string => n !== null);
  assert.ok(gapNotes.length > 0, "the gap fixture must actually produce a gap note, or this bans nothing");
  const changes = [...comparable, ...withAGap.changesProse, ...gapNotes];
  const BANNED = [
    "stable", "steady", "flat performance", "no growth", "poor", "healthy growth", "declining",
    "improving", "underperform", "engagement score", "good", "bad", "strong", "weak",
  ];
  for (const word of BANNED) {
    assert.ok(
      !new RegExp(`\\b${word}\\b`, "i").test(changesProseText(changes)),
      `no verdict word "${word}" appears near the calculation`,
    );
  }
}
const changesProseText = (v: readonly string[]) => v.join(" ");

/* ── 12/13 — recent content keeps Instagram's facts, and two instants ──────── */

function recentContentPreservesInstagramFacts(): void {
  const content = compose(LIVE_BOTH).instagram.content;
  assert.equal(content.status, "observed");
  const items = content.status === "observed" ? content.observation.items : [];
  assert.equal(items.length, 2);
  assert.equal(items[0].caption, "A rug");
  assert.equal(items[0].mediaType, "IMAGE");
  assert.equal(items[0].likeCount, 3);
  assert.equal(items[0].commentCount, 0, "a zero like/comment count survives as zero");
  assert.equal(items[0].publishedAt, "2026-09-01T10:00:00.000Z");
}

function publishedTimeStaysDistinctFromObservedTime(): void {
  const content = compose(LIVE_BOTH).instagram.content;
  const observation = content.status === "observed" ? content.observation : null;
  assert.ok(observation);
  assert.equal(observation!.observedAt, "2026-09-10T14:00:19.320Z", "HEBUN OBSERVED");
  assert.equal(observation!.items[0].publishedAt, "2026-09-01T10:00:00.000Z", "INSTAGRAM PUBLISHED");
  assert.notEqual(observation!.observedAt, observation!.items[0].publishedAt);
}

function anUnsafePermalinkIsRefusedNotRendered(): void {
  const content = compose(LIVE_BOTH).instagram.content;
  const items = content.status === "observed" ? content.observation.items : [];
  assert.equal(items[1].permalink, null, "a non-https, non-Instagram host is refused by the released policy");
}

/* ── Coverage — every number is measured, none invented ────────────────────── */

function coverageCountsOnlyWhatWasRead(): void {
  const coverage = compose(LIVE_BOTH).coverage;
  const byLabel = Object.fromEntries(coverage.map((c) => [c.label, c]));
  assert.equal(byLabel["YouTube channel"].observations, 4);
  assert.equal(byLabel["Instagram account"].observations, 1);
  assert.equal(byLabel["Instagram media"].observations, 1);
  assert.equal(byLabel["YouTube channel"].latestObservedAt, "2026-09-10T11:00:20.489Z");
}

/* ── 18 — nothing inferred, nothing recommended ────────────────────────────── */

function noInferredOrRecommendedProvenanceExists(): void {
  const model = compose(LIVE_BOTH);
  const kinds = new Set<string>();
  for (const p of model.platforms) kinds.add(p.provenance);
  kinds.add(model.youtube.seriesProvenance);
  if (model.youtube.changes) kinds.add(model.youtube.changeProvenance);
  for (const kind of kinds) {
    assert.ok(
      kind === "authoritative" || kind === "derived",
      `SOC-UI1 uses only reported and calculated provenance, never "${kind}"`,
    );
  }
}

/* ── The defect REAL-BROWSER acceptance found ──────────────────────────────── */

function anUnknownCountIsNeverReportedAsZero(): void {
  /*
   * THE BUG, EXACTLY AS IT RENDERED IN THE REAL RUNTIME.
   *
   * With no resolvable session every read comes back `unavailable`, and the panel derived its
   * heading from `points.length` — which is 0 both when Hebun stored nothing and when Hebun could
   * not look. The page therefore printed "0 measurements" immediately above its own sentence
   * "Whether any exist is unknown." Two claims, opposite, one inch apart.
   *
   * A failed read now yields NO count at all.
   */
  const blind = composeSocialDashboard({
    connections: { status: "unavailable", reason: "persistence-not-configured" },
    instagramAccount: { status: "unavailable", reason: "persistence-unavailable" } as ProviderObservationReadResult,
    instagramMedia: { status: "unavailable", reason: "persistence-unavailable" } as ProviderObservationReadResult,
    youtubeChannel: { status: "unavailable", reason: "persistence-unavailable" } as ProviderObservationReadResult,
  });
  assert.equal(blind.instagram.measurementCountLabel, null, "an unreadable Instagram history claims no count");
  assert.equal(blind.youtube.measurementCountLabel, null, "an unreadable YouTube history claims no count");
  for (const row of blind.coverage) {
    assert.equal(row.known, false, "no capability was read");
    assert.equal(row.observations, 0, "and its count carries a zero that the UI must not print");
  }
  /* The sentences still explain, so removing the number removes nothing a reader needed. */
  assert.ok(blind.instagram.evolutionSentence && /unknown/i.test(blind.instagram.evolutionSentence));
}

function agenuineZeroStillReportsZero(): void {
  /*
   * THE OTHER HALF, which the fix must not break: a SUCCESSFUL read that found nothing really is
   * zero measurements, and saying so is the honest answer rather than a shrug.
   */
  const empty = composeSocialDashboard({
    connections: LIVE_BOTH,
    instagramAccount: read([]),
    instagramMedia: read([]),
    youtubeChannel: read([]),
  });
  assert.equal(empty.instagram.measurementCountLabel, "0 measurements", "a read that found none says none");
  assert.equal(empty.youtube.measurementCountLabel, "0 measurements");
  for (const row of empty.coverage) assert.equal(row.known, true, "the read succeeded");
}

function aCountOfOneIsSingular(): void {
  assert.equal(compose(LIVE_BOTH).instagram.measurementCountLabel, "1 measurement");
  assert.equal(compose(LIVE_BOTH).youtube.measurementCountLabel, "4 measurements");
}

function main(): void {
  anUnknownCountIsNeverReportedAsZero();
  agenuineZeroStillReportsZero();
  aCountOfOneIsSingular();
  onlyConnectedPlatformsAreLive();
  aDefinitionAloneCannotCreateALiveCard();
  anUnverifiedOrRevokedConnectionIsNotLive();
  connectedButUnhealthyIsImpairedNotLive();
  anUnreadableConnectionAuthorityIsUnknownNotAbsent();
  theNewestConnectionRowWins();
  realYouTubeZerosRenderAsZero();
  anUnreportedMetricIsNotZero();
  hiddenAndNotReportedRemainDifferentSentences();
  metricIdentityIsExplicitAndNeverShared();
  oneInstagramMeasurementProducesNoComparison();
  instagramGainsItsChangeOnlyFromTheReleasedDerivation();
  twoInstagramMeasurementsProduceTheReleasedComparison();
  flatZeroSeriesIsAValidSeries();
  zeroChangeIsACalculationNotAnAbsence();
  noChangeCellCarriesAVerdict();
  recentContentPreservesInstagramFacts();
  publishedTimeStaysDistinctFromObservedTime();
  anUnsafePermalinkIsRefusedNotRendered();
  coverageCountsOnlyWhatWasRead();
  noInferredOrRecommendedProvenanceExists();
  console.log("SOC-UI1 social dashboard composition checks passed");
}

main();
