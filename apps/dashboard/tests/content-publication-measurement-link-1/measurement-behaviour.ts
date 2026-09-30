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

  console.log(
    "content-publication-measurement-link-1/measurement-behaviour: prod evidence → observed 3/0, pre-publication " +
      "history → no-observation-since-publication, only accepted Instagram attempts join, identity = provider id " +
      "inside the bound subject, window states from stored facts only, null stays null, delta only from IG-AN3",
  );
})();
