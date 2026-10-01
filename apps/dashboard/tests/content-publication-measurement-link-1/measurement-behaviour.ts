/*
 * CONTENT-PUBLICATION-MEASUREMENT-LINK-1 · the join, against the production evidence.
 *
 * The fixture is the production fact of 2026-09-30, pinned verbatim: attempt be0dc7d6 returned
 * 18091512017663172 for account 28295264780115792, and the 21:00Z media observation listed it with
 * likeCount 3, commentCount 0, in a 9-item window with moreMediaExist false.
 */
import assert from "node:assert/strict";
import type {
  ContentPublicationState,
  PublicationHistoryEntry,
  PublicationStage,
} from "../../src/features/action-authorization/content-publication-state";
import type { StoredProviderObservation } from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import {
  derivePublicationMeasurement,
  derivePublicationMeasurements,
  measurablePublications,
} from "../../src/features/content-publication-measurement/derive-publication-measurement";
import {
  deriveYouTubePublicationMeasurement,
  measurableYouTubePublications,
  type YouTubeChannelMeasurementRead,
} from "../../src/features/content-publication-measurement/derive-publication-measurement";
import {
  YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM,
  describeYouTubePublicationMeasurement,
} from "../../src/features/content-publication-measurement/contracts";
import { MAX_OBSERVATIONS_PER_READ } from "../../src/features/provider-observation-history/read-provider-observations.server";
import { readPublicationMeasurements } from "../../src/features/content-publication-measurement/read-publication-measurement.server";
import { MEDIA_EVOLUTION_OBSERVATION_LIMIT } from "../../src/features/instagram-connection-surface/media-measurement-evolution";

const ACCOUNT = "28295264780115792";
const OTHER_ACCOUNT = "28755565750703044";
const MEDIA = "18091512017663172";
const SUBJECT = `instagram/account/${ACCOUNT}`;
const MEDIA_CAP = "instagram.media.public.read";
const COMPLETED = "2026-09-25T10:13:36.918Z";

function entry(over: Partial<PublicationHistoryEntry> & { stage?: PublicationStage } = {}): PublicationHistoryEntry {
  return {
    requestId: "req-1",
    actionKind: "publish-instagram-media",
    destination: "instagram",
    destinationAccountId: ACCOUNT,
    acknowledgesPriorAttemptId: null,
    payloadDigest: "d",
    requestStatus: "approved",
    proposedAt: "2026-09-25T10:00:00.000Z",
    approvedAt: "2026-09-25T10:05:00.000Z",
    rejectedAt: null,
    permit: null,
    attempt: {
      attemptId: "be0dc7d6-4c57-4670-bac1-90fd4e6a95a2",
      status: "accepted",
      providerResponseClass: "accepted",
      providerResultId: MEDIA,
      failureClass: null,
      startedAt: "2026-09-25T10:13:24.466Z",
      completedAt: COMPLETED,
    },
    stage: "execution-accepted",
    ...over,
  } as PublicationHistoryEntry;
}

const recorded = (...entries: PublicationHistoryEntry[]): ContentPublicationState =>
  ({ status: "recorded", artifactRef: "work-artifact/57b57106-2848-41f7-a5b3-d2475e0b7dba@3", entries, truncated: false }) as unknown as ContentPublicationState;

let seq = 0;
function obs(observedAt: string, media: Record<string, unknown>[], more: boolean | "unstated" = false, over: Partial<StoredProviderObservation> = {}): StoredProviderObservation {
  seq += 1;
  const facts: Record<string, unknown> = { accountId: ACCOUNT, recentMediaCount: media.length, recentMedia: media };
  if (more !== "unstated") facts.moreMediaExist = more;
  return {
    observationId: `00000000-0000-4000-8000-${String(seq).padStart(12, "0")}`,
    providerKey: "instagram",
    capabilityKey: MEDIA_CAP,
    subjectKind: "instagram-account",
    subjectRef: SUBJECT,
    integrationId: "7289bc08-caf9-4788-a7ac-692898ea3b20",
    observedAt,
    recordedAt: observedAt,
    provenance: "standing-authorization",
    observedByActorType: null,
    standingAuthorizationId: "368058f1-1bf4-417a-8297-d085c068892c",
    invocationId: null,
    facts,
    ...over,
  } as StoredProviderObservation;
}
const item = (mediaId: string, likeCount: number | null, commentCount: number | null) => ({
  mediaId, mediaType: "IMAGE", caption: "c", permalink: null, publishedAt: "2026-09-25T10:13:33+0000", likeCount, commentCount,
});
const OLD_WINDOW = Array.from({ length: 8 }, (_, i) => item(`1800000000000000${i}`, 1, 0));
const read = (...observations: StoredProviderObservation[]): ProviderObservationReadResult => ({ status: "read", observations });

const publication = measurablePublications(recorded(entry()))[0]!;
const BEFORE = obs("2026-09-25T01:00:20.403Z", OLD_WINDOW);
const AFTER = obs("2026-09-30T21:00:24.919Z", [item(MEDIA, 3, 0), ...OLD_WINDOW]);

/* ═══ 1. THE PRODUCTION EVIDENCE → observed, 3 / 0 ═══════════════════════════ */
const observed = derivePublicationMeasurement(publication, read(BEFORE, AFTER));
assert.equal(observed.status, "observed", "prod evidence: the id is listed → observed");
assert.ok(observed.status === "observed");
assert.equal(observed.latestLikeCount, 3, "likeCount as Instagram reported it");
assert.equal(observed.latestCommentCount, 0, "commentCount 0 is a reported zero");
assert.equal(observed.latestObservedAt, "2026-09-30T21:00:24.919Z");
assert.equal(observed.earliestObservedAt, "2026-09-30T21:00:24.919Z", "earliest is the first observation that LISTS this provider id");
assert.equal(observed.evolution, null, "one sighting → no delta; a first sighting is not a change from zero");
assert.equal(observed.publication.attemptId, "be0dc7d6-4c57-4670-bac1-90fd4e6a95a2");

/* ═══ 2. SAME ATTEMPT, ONLY PRE-21:00Z HISTORY → no-observation-since-publication ═══ */
const before = derivePublicationMeasurement(publication, read(BEFORE));
assert.equal(before.status, "no-observation-since-publication", "history ending before publication claims nothing");
assert.ok(before.status === "no-observation-since-publication" && before.latestObservedAt === BEFORE.observedAt);
const empty = derivePublicationMeasurement(publication, read());
assert.ok(empty.status === "no-observation-since-publication" && empty.latestObservedAt === null);

/* ═══ 3. THE ACCEPTED-STAGE BOUNDARY ════════════════════════════════════════ */
for (const stage of ["execution-unknown", "execution-failed", "execution-refused", "execution-pending"] as const) {
  assert.equal(measurablePublications(recorded(entry({ stage }))).length, 0, `${stage} is never joined`);
}
assert.equal(measurablePublications(recorded(entry({ destination: "youtube", actionKind: "publish-youtube-video" } as Partial<PublicationHistoryEntry>))).length, 0,
  "YouTube produces no measurement");
assert.equal(measurablePublications(recorded(entry({ attempt: { ...entry().attempt!, providerResultId: null } }))).length, 0,
  "no provider id → nothing to join on");
assert.equal(measurablePublications(recorded(entry({ destinationAccountId: null }))).length, 0,
  "no bound destination account → no subject to join against");

/* ═══ 4. IDENTITY IS THE PROVIDER ID, INSIDE THE BOUND SUBJECT ═══════════════ */
const otherMedia = derivePublicationMeasurement(publication, read(obs("2026-09-30T21:00:24.919Z", [item("18099999999999999", 3, 0), ...OLD_WINDOW])));
assert.equal(otherMedia.status, "absent-from-complete-window", "another mediaId is not this publication");
const otherAccount = derivePublicationMeasurement(publication, read(
  obs("2026-09-30T21:00:24.919Z", [item(MEDIA, 3, 0)], false, { subjectRef: `instagram/account/${OTHER_ACCOUNT}` }),
));
assert.equal(otherAccount.status, "no-observation-since-publication", "another account's observation is never joined");
const accountCapability = derivePublicationMeasurement(publication, read(
  obs("2026-09-30T21:00:24.919Z", [item(MEDIA, 3, 0)], false, { capabilityKey: "instagram.account.public.read" }),
));
assert.equal(accountCapability.status, "no-observation-since-publication", "only the media capability's facts are read");

/* ═══ 5. WINDOW SEMANTICS ════════════════════════════════════════════════════ */
const complete = derivePublicationMeasurement(publication, read(obs("2026-09-30T21:00:24.919Z", OLD_WINDOW, false)));
assert.ok(complete.status === "absent-from-complete-window" && complete.windowMediaCount === 8, "complete window without the id");
const clipped = derivePublicationMeasurement(publication, read(obs("2026-09-30T21:00:24.919Z", OLD_WINDOW, true)));
assert.equal(clipped.status, "outside-clipped-window", "clipped window without the id");
const unstated = derivePublicationMeasurement(publication, read(obs("2026-09-30T21:00:24.919Z", OLD_WINDOW, "unstated")));
assert.equal(unstated.status, "outside-clipped-window", "a window that does not say it is complete is not treated as complete");
const unreadable = derivePublicationMeasurement(publication, { status: "unavailable", reason: "persistence-unavailable" });
assert.equal(unreadable.status, "history-unreadable");
assert.equal(derivePublicationMeasurement(publication, undefined).status, "history-unreadable", "no read made → unreadable, never 'absent'");

/* ═══ 6. NULL STAYS NULL ═════════════════════════════════════════════════════ */
const hidden = derivePublicationMeasurement(publication, read(obs("2026-09-30T21:00:24.919Z", [item(MEDIA, null, null)])));
assert.ok(hidden.status === "observed");
assert.equal(hidden.latestLikeCount, null, "a withheld like count stays null, never 0");
assert.equal(hidden.latestCommentCount, null, "a withheld comment count stays null, never 0");

/* ═══ 7. DELTA COMES FROM IG-AN3 ONLY ════════════════════════════════════════ */
const later = derivePublicationMeasurement(publication, read(AFTER, obs("2026-10-01T21:00:24.000Z", [item(MEDIA, 5, 1), ...OLD_WINDOW])));
assert.ok(later.status === "observed" && later.evolution !== null);
assert.equal(later.earliestObservedAt, AFTER.observedAt);
assert.equal(later.latestLikeCount, 5);
assert.deepEqual(later.evolution!.item.likeCount, { status: "comparable", previous: 3, latest: 5, change: 2 });
assert.deepEqual(later.evolution!.item.commentCount, { status: "comparable", previous: 0, latest: 1, change: 1 });

/* ═══ 8. THE REVISION PROJECTION ═════════════════════════════════════════════ */
assert.deepEqual(derivePublicationMeasurements({ status: "unknown", artifactRef: null, reason: "read-failed" } as ContentPublicationState, new Map()), { status: "unknown" });
const both = derivePublicationMeasurements(
  recorded(entry(), entry({ requestId: "req-yt", destination: "youtube", actionKind: "publish-youtube-video" } as Partial<PublicationHistoryEntry>)),
  new Map([[ACCOUNT, read(AFTER)]]),
);
assert.ok(both.status === "read" && both.instagram.length === 1 && both.youtubeAcceptedCount === 1);
assert.equal(both.status === "read" && both.instagram[0]!.status, "observed");

/* ═══ 10. YOUTUBE-MEASUREMENT-OPERATIONS-PROJECTION-1 · the production evidence of 2026-10-01 ═══ */
const CHANNEL = "UC5Yf5U_YOKR0K38tWF82kjA";
const YT_SUBJECT = `youtube/channel/${CHANNEL}`;
const YT_CAP = "google.youtube.video.metrics.read";
const ytEntry = (videoId: string, attemptId: string, over: Partial<PublicationHistoryEntry> = {}): PublicationHistoryEntry =>
  entry({
    requestId: `req-${videoId}`, actionKind: "publish-youtube-video", destination: "youtube", destinationAccountId: CHANNEL,
    attempt: { attemptId, status: "accepted", providerResponseClass: "accepted", providerResultId: videoId, failureClass: null, startedAt: "2026-09-28T15:38:00.000Z", completedAt: "2026-09-28T15:38:21.919Z" },
    ...over,
  } as Partial<PublicationHistoryEntry>);
const ytObs = (observedAt: string, videos: Record<string, unknown>[], over: Partial<StoredProviderObservation> = {}): StoredProviderObservation => {
  seq += 1;
  return {
    observationId: `00000000-0000-4000-9000-${String(seq).padStart(12, "0")}`,
    providerKey: "google-youtube", capabilityKey: YT_CAP, subjectKind: "youtube-channel", subjectRef: YT_SUBJECT,
    integrationId: "c5e8637d-a1ee-45eb-8480-8d9f18805669", observedAt, recordedAt: observedAt, provenance: "human",
    observedByActorType: "human", standingAuthorizationId: null, invocationId: null,
    facts: { channelId: CHANNEL, videos },
    ...over,
  } as StoredProviderObservation;
};
const video = (videoId: string, viewCount: unknown, likeCount: unknown, commentCount: unknown, publishedAt: string | null = "2026-09-28T15:38:19Z") =>
  ({ videoId, publishedAt, viewCount, likeCount, commentCount });
const channelRead = (observations: StoredProviderObservation[], windowSize: number = MAX_OBSERVATIONS_PER_READ): YouTubeChannelMeasurementRead =>
  ({ subjectRef: YT_SUBJECT, read: { status: "read", observations }, windowSize });

const RLP = measurableYouTubePublications(recorded(ytEntry("Rlp-bPNHXkw", "3f53e7d5-ee2a-4af8-b1c1-7f16774cb2e9")))[0]!;
const DQR = measurableYouTubePublications(recorded(ytEntry("DQr18fVuevM", "dfeef4d4-0535-47a4-9cf7-09f05d082308")))[0]!;
assert.deepEqual([RLP.providerResultId, RLP.destinationAccountId], ["Rlp-bPNHXkw", CHANNEL], "identity is the ledger's video id and bound channel");
/* The two stored production rows, verbatim. */
const ROW_RLP = ytObs("2026-10-01T12:31:15.273Z", [video("Rlp-bPNHXkw", 1, 0, 0)]);
const ROW_DQR = ytObs("2026-10-01T12:31:30.481Z", [video("DQr18fVuevM", 0, 0, 0, "2026-09-28T20:40:10Z")]);
const PROD = channelRead([ROW_DQR, ROW_RLP]);

const rlp = deriveYouTubePublicationMeasurement(RLP, PROD);
assert.deepEqual(rlp, {
  status: "measured", publication: RLP, viewCount: 1, likeCount: 0, commentCount: 0, providerPublishedAt: "2026-09-28T15:38:19Z",
  latestObservedAt: "2026-10-01T12:31:15.273Z", firstObservedAt: "2026-10-01T12:31:15.273Z", storedCount: 1, windowFull: false,
}, "Rlp-bPNHXkw projects 1 / 0 / 0");
assert.equal(describeYouTubePublicationMeasurement(rlp),
  "YouTube id Rlp-bPNHXkw — views 1 · likes 0 · comments 0 · as of 2026-10-01 12:31 UTC · one stored measurement.");
const dqr = deriveYouTubePublicationMeasurement(DQR, PROD);
assert.ok(dqr.status === "measured");
assert.deepEqual([dqr.viewCount, dqr.likeCount, dqr.commentCount, dqr.storedCount], [0, 0, 0, 1], "DQr18fVuevM projects 0 / 0 / 0 — reported zeros, not null");
assert.equal(describeYouTubePublicationMeasurement(dqr),
  "YouTube id DQr18fVuevM — views 0 · likes 0 · comments 0 · as of 2026-10-01 12:31 UTC · one stored measurement.");

/* A count YouTube did not report is null in the projection and "not reported" on the surface — never 0. */
for (const absent of [null, undefined, "7", Number.NaN]) {
  const m = deriveYouTubePublicationMeasurement(RLP, channelRead([ytObs("2026-10-01T12:31:15.273Z", [video("Rlp-bPNHXkw", absent, 0, absent)])]));
  assert.ok(m.status === "measured");
  assert.deepEqual([m.viewCount, m.likeCount, m.commentCount], [null, 0, null], "a missing YouTube count stays null, never 0");
  assert.equal(describeYouTubePublicationMeasurement(m),
    "YouTube id Rlp-bPNHXkw — views not reported · likes 0 · comments not reported · as of 2026-10-01 12:31 UTC · one stored measurement.");
}

/* IDENTITY: the video id, inside the bound channel's subject, under the recorded-measurement capability of google-youtube. */
const none = { status: "no-stored-measurement", publication: RLP };
assert.deepEqual(deriveYouTubePublicationMeasurement(RLP, channelRead([ROW_DQR])), none, "another video's measurement is never joined");
assert.deepEqual(
  deriveYouTubePublicationMeasurement(RLP, channelRead([ytObs("2026-10-01T12:31:15.273Z", [video("Rlp-bPNHXkw", 1, 0, 0)], { subjectRef: "youtube/channel/UCsomeOtherChannel0000000" })])),
  none, "a measurement filed under another channel is never joined");
assert.deepEqual(
  deriveYouTubePublicationMeasurement(RLP, channelRead([ytObs("2026-10-01T12:31:15.273Z", [video("Rlp-bPNHXkw", 1, 0, 0)], { capabilityKey: "google.youtube.channel.identity.read" })])),
  none, "another capability's observation is never joined");
assert.deepEqual(
  deriveYouTubePublicationMeasurement(RLP, channelRead([ytObs("2026-10-01T12:31:15.273Z", [video("Rlp-bPNHXkw", 1, 0, 0)], { providerKey: "youtube", capabilityKey: "youtube.channel.public.read" })])),
  none, "a public `youtube` observation is never joined");
assert.deepEqual(
  deriveYouTubePublicationMeasurement(RLP, channelRead([ytObs("2026-10-01T12:31:15.273Z", [video("Rlp-bPNHXkw", 1, 0, 0)], { providerKey: "youtube" })])),
  none, "the provider key is checked, not only the capability");
/* The public channel observation's own shape (`recentVideos`) carries the same id and still does not join. */
assert.deepEqual(
  deriveYouTubePublicationMeasurement(RLP, channelRead([ytObs("2026-10-01T12:31:15.273Z", [], { facts: { channelId: CHANNEL, recentVideos: [video("Rlp-bPNHXkw", 9, 9, 9)] } } as Partial<StoredProviderObservation>)])),
  none, "only `videos[].videoId` is the join key");
assert.equal(describeYouTubePublicationMeasurement(none as never),
  "YouTube id Rlp-bPNHXkw — no stored measurement. Hebun measures a YouTube video only when a person records one in Approvals.");
/* Only accepted YouTube attempts that name a video and a channel are measurable. */
assert.equal(measurableYouTubePublications(recorded(ytEntry("Rlp-bPNHXkw", "a", { stage: "execution-unknown" }))).length, 0, "a YouTube execution-unknown is never joined");
assert.equal(measurableYouTubePublications(recorded(ytEntry("Rlp-bPNHXkw", "a", { destinationAccountId: null }))).length, 0);
assert.equal(measurableYouTubePublications(recorded(entry())).length, 0, "an Instagram publication is not a YouTube one");
assert.equal(measurablePublications(recorded(ytEntry("Rlp-bPNHXkw", "a"))).length, 0, "and a YouTube publication is not an Instagram one");

/* LATEST WINS, FIRST AND COUNT COME FROM THE PAGE — whatever order the reader returned it in. */
const three = [
  ytObs("2026-10-03T09:00:00.000Z", [video("Rlp-bPNHXkw", 7, 2, 1)]),
  ytObs("2026-10-01T12:31:15.273Z", [video("Rlp-bPNHXkw", 1, 0, 0)]),
  ytObs("2026-10-02T08:00:00.000Z", [video("Rlp-bPNHXkw", 4, 1, 0)]),
  ROW_DQR,
];
const multi = deriveYouTubePublicationMeasurement(RLP, channelRead(three));
assert.ok(multi.status === "measured");
assert.deepEqual([multi.viewCount, multi.likeCount, multi.commentCount], [7, 2, 1], "the latest stored measurement wins");
assert.deepEqual([multi.latestObservedAt, multi.firstObservedAt, multi.storedCount, multi.windowFull],
  ["2026-10-03T09:00:00.000Z", "2026-10-01T12:31:15.273Z", 3, false], "first recorded and count are derived from the page");
assert.equal(describeYouTubePublicationMeasurement(multi),
  "YouTube id Rlp-bPNHXkw — views 7 · likes 2 · comments 1 · as of 2026-10-03 09:00 UTC · first recorded 2026-10-01 12:31 UTC · 3 stored measurements.");
/* Identical counts recorded twice are two measurements, and nothing is said about the difference. */
const twice = deriveYouTubePublicationMeasurement(RLP, channelRead([ROW_RLP, ytObs("2026-10-02T08:00:00.000Z", [video("Rlp-bPNHXkw", 1, 0, 0)])]));
assert.ok(twice.status === "measured" && twice.storedCount === 2);

/* A FULL PAGE IS NOT THE WHOLE HISTORY. */
const fullWithout = deriveYouTubePublicationMeasurement(RLP, channelRead([ROW_DQR, ROW_DQR, ROW_DQR], 3));
assert.deepEqual(fullWithout, { status: "not-in-latest-window", publication: RLP, windowSize: 3 }, "a full page without the video is not 'never measured'");
assert.equal(describeYouTubePublicationMeasurement(fullWithout),
  "YouTube id Rlp-bPNHXkw — not listed in the latest 3 stored measurements of this channel.");
assert.equal(deriveYouTubePublicationMeasurement(RLP, channelRead([ROW_DQR, ROW_DQR], 3)).status, "no-stored-measurement", "a page that is NOT full supports the definite statement");
const fullWith = deriveYouTubePublicationMeasurement(RLP, channelRead(three.slice(0, 3), 3));
assert.ok(fullWith.status === "measured" && fullWith.windowFull && fullWith.storedCount === 3);
assert.equal(describeYouTubePublicationMeasurement(fullWith),
  "YouTube id Rlp-bPNHXkw — views 7 · likes 2 · comments 1 · as of 2026-10-03 09:00 UTC · first recorded 2026-10-01 12:31 UTC · at least 3 stored measurements.");
const fullOne = deriveYouTubePublicationMeasurement(RLP, channelRead([ROW_RLP, ROW_DQR], 2));
assert.equal(describeYouTubePublicationMeasurement(fullOne),
  "YouTube id Rlp-bPNHXkw — views 1 · likes 0 · comments 0 · as of 2026-10-01 12:31 UTC · at least one stored measurement.");
assert.equal(deriveYouTubePublicationMeasurement(RLP, channelRead(Array.from({ length: MAX_OBSERVATIONS_PER_READ }, () => ROW_DQR))).status, "not-in-latest-window",
  "the reader's own page size is the window");

/* UNREADABLE IS NEVER 'NO MEASUREMENT'. */
assert.equal(deriveYouTubePublicationMeasurement(RLP, undefined).status, "history-unreadable", "no read made → unreadable");
const ytUnreadable = deriveYouTubePublicationMeasurement(RLP, { subjectRef: YT_SUBJECT, read: { status: "unavailable", reason: "persistence-unavailable" }, windowSize: MAX_OBSERVATIONS_PER_READ });
assert.equal(ytUnreadable.status, "history-unreadable");
assert.equal(describeYouTubePublicationMeasurement(ytUnreadable), "YouTube id Rlp-bPNHXkw — Hebun's observation history could not be read just now.");

/* WORDING: nothing that claims a schedule, currency or a judgement — across every sentence the surface can print. */
const sentences = [rlp, dqr, multi, fullWith, fullOne, fullWithout, none as never, ytUnreadable].map(describeYouTubePublicationMeasurement);
for (const text of [...sentences, YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM]) {
  for (const word of ["live", "monitored", "up to date", "trend", "rank", "performed", "stale", "current", "latest"]) {
    assert.ok(!text.toLowerCase().includes(word) || (word === "latest" && text.includes("not listed in the latest")), `"${text}" must not say "${word}"`);
  }
}
for (const text of sentences) assert.ok(!text.toLowerCase().includes("score"), "no sentence about a video says `score`");
assert.equal(YOUTUBE_PUBLICATION_MEASUREMENT_NON_CLAIM,
  "Counts are what YouTube reported to a read a person requested, at the time shown. Hebun does not measure YouTube on a schedule. Not a rate, a score or a judgement.");

/* THE REVISION PROJECTION: YouTube is added; the Instagram half is byte-identical with or without it. */
const mixed = recorded(entry(), ytEntry("Rlp-bPNHXkw", "3f53e7d5-ee2a-4af8-b1c1-7f16774cb2e9"), ytEntry("DQr18fVuevM", "dfeef4d4-0535-47a4-9cf7-09f05d082308"));
const igOnly = derivePublicationMeasurements(recorded(entry()), new Map([[ACCOUNT, read(AFTER)]]));
const withYouTube = derivePublicationMeasurements(mixed, new Map([[ACCOUNT, read(AFTER)]]), new Map([[CHANNEL, PROD]]));
assert.ok(igOnly.status === "read" && withYouTube.status === "read");
assert.equal(JSON.stringify(withYouTube.instagram), JSON.stringify(igOnly.instagram), "the Instagram projection is byte-identical");
assert.deepEqual(igOnly.youtube, [], "no YouTube publication → an empty list");
assert.equal(withYouTube.youtubeAcceptedCount, 2);
assert.deepEqual(withYouTube.youtube.map((m) => [m.publication.providerResultId, m.status]), [["Rlp-bPNHXkw", "measured"], ["DQr18fVuevM", "measured"]]);
const noYouTubeRead = derivePublicationMeasurements(mixed, new Map([[ACCOUNT, read(AFTER)]]));
assert.ok(noYouTubeRead.status === "read" && noYouTubeRead.youtube.every((m) => m.status === "history-unreadable"), "no channel read handed in → unreadable, never 'no measurement'");

/* ═══ 9. THE COMPOSITION: session tenant only, scoped query, IG-AN3's bound ═══ */
void (async () => {
  const tenant = { tenantId: "9947c78e-2080-4331-81c6-456cb4be7a96" } as never;
  const queries: unknown[] = [];
  const tenants: unknown[] = [];
  const result = await readPublicationMeasurements(tenant, [{ artifactId: "57b57106-2848-41f7-a5b3-d2475e0b7dba", revisionNo: 3 }], {
    readPublicationStates: async (t) => {
      tenants.push(t);
      return new Map([["work-artifact/57b57106-2848-41f7-a5b3-d2475e0b7dba@3", recorded(entry())]]);
    },
    readObservations: async (t, q) => {
      tenants.push(t);
      queries.push(q);
      return read(AFTER);
    },
  });
  assert.ok(tenants.every((t) => t === tenant), "both released readers receive the session tenant and nothing else");
  assert.deepEqual(queries, [{ providerKey: "instagram", capabilityKey: MEDIA_CAP, subjectRef: SUBJECT, limit: MEDIA_EVOLUTION_OBSERVATION_LIMIT }],
    "one observation read, scoped to the media capability and the bound account, bounded by IG-AN3's own limit");
  const m = result.get("work-artifact/57b57106-2848-41f7-a5b3-d2475e0b7dba@3");
  assert.ok(m?.status === "read" && m.instagram[0]!.status === "observed");

  /* YouTube: ONE read per distinct channel, through the same reader, scoped, and naming NO limit. */
  const ytQueries: unknown[] = [];
  const ytTenants: unknown[] = [];
  const ytResult = await readPublicationMeasurements(tenant, [{ artifactId: "57b57106-2848-41f7-a5b3-d2475e0b7dba", revisionNo: 3 }], {
    readPublicationStates: async () => new Map([["work-artifact/57b57106-2848-41f7-a5b3-d2475e0b7dba@3", mixed]]),
    readObservations: async (t, q) => {
      ytTenants.push(t);
      ytQueries.push(q);
      return (q as { providerKey: string }).providerKey === "instagram" ? read(AFTER) : { status: "read", observations: [ROW_DQR, ROW_RLP] };
    },
  });
  assert.ok(ytTenants.every((t) => t === tenant), "the YouTube read receives the session tenant and nothing else");
  assert.deepEqual(ytQueries, [
    { providerKey: "instagram", capabilityKey: MEDIA_CAP, subjectRef: SUBJECT, limit: MEDIA_EVOLUTION_OBSERVATION_LIMIT },
    { providerKey: "google-youtube", capabilityKey: YT_CAP, subjectRef: YT_SUBJECT },
  ], "two accepted uploads on one channel → ONE YouTube read, scoped to the channel subject, with the reader's own page");
  const ym = ytResult.get("work-artifact/57b57106-2848-41f7-a5b3-d2475e0b7dba@3");
  assert.ok(ym?.status === "read");
  assert.deepEqual(ym.youtube.map(describeYouTubePublicationMeasurement), [
    "YouTube id Rlp-bPNHXkw — views 1 · likes 0 · comments 0 · as of 2026-10-01 12:31 UTC · one stored measurement.",
    "YouTube id DQr18fVuevM — views 0 · likes 0 · comments 0 · as of 2026-10-01 12:31 UTC · one stored measurement.",
  ]);
  assert.equal(JSON.stringify(ym.instagram), JSON.stringify(m.instagram), "Instagram is unchanged by the YouTube read");

  console.log(
    "content-publication-measurement-link-1/measurement-behaviour: prod evidence → observed 3/0, pre-publication " +
      "history → no-observation-since-publication, only accepted Instagram attempts join, identity = provider id " +
      "inside the bound subject, window states from stored facts only, null stays null, delta only from IG-AN3; " +
      "YouTube: prod rows → 1/0/0 and 0/0/0, identity = video id inside the bound channel under the recorded-measurement " +
      "capability, latest wins, count and first-recorded from the page, a full page is never 'no measurement'",
  );
})();
