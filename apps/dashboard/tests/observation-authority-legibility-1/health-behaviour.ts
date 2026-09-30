/*
 * OBSERVATION-AUTHORITY-LEGIBILITY-1 · the projection, against the two production states it exists for.
 *
 * BROKEN (2026-09-25 → 2026-09-30): account + media rev 1 active, bound to 31fcbd7c (disconnected),
 * replacement 7289bc08 connected/healthy, latest observations 2026-09-24/25.
 * REPAIRED (2026-09-30 21:00Z): rev 2 bound to 7289bc08, observations recorded under rev 2.
 */
import assert from "node:assert/strict";
import type {
  CapabilityAvailabilityView,
  ConnectionListing,
  IntegrationView,
} from "../../src/features/integration-authority/contracts";
import type { StoredProviderObservation } from "../../src/features/provider-observation-history/contracts";
import type { ProviderObservationReadResult } from "../../src/features/provider-observation-history/read-provider-observations.server";
import type {
  StandingObservationAuthorizationRecord,
  StandingObservationHistoryResult,
} from "../../src/features/standing-observation-authority/contracts";
import {
  deriveObservationAuthorityHealth,
  lineageKey,
  type ObservationAuthorityInputs,
} from "../../src/features/observation-authority-legibility/derive-observation-authority-health";
import type { ObservationAuthorityEntry } from "../../src/features/observation-authority-legibility/contracts";
import { readObservationAuthorityHealth } from "../../src/features/observation-authority-legibility/read-observation-authority-health.server";

const ACCOUNT_CAP = "instagram.account.public.read";
const MEDIA_CAP = "instagram.media.public.read";
const SUBJECT = "instagram/account/28295264780115792";
const OLD = "31fcbd7c-8dd7-48eb-adf6-6548981a10ba";
const NEW = "7289bc08-caf9-4788-a7ac-692898ea3b20";

function auth(cap: string, rev: number, integrationId: string, id: string, state: "active" | "withdrawn" = "active", provider = "instagram", subjectRef = SUBJECT): StandingObservationAuthorizationRecord {
  return {
    authorizationId: id, authorizationRevision: rev, state, providerKey: provider, capabilityKey: cap, subjectKind: "instagram-account",
    subjectRef, integrationId, intervalMinutes: 1440, governanceDecisionId: "d", governanceSessionId: "s", authorizedByActorId: "a",
    authorizedAt: "2026-09-10T07:18:27.256Z", supersedesAuthorizationId: null,
  };
}
function conn(id: string, state: IntegrationView["connectionState"], health: IntegrationView["health"], provider = "instagram"): IntegrationView {
  return {
    integrationId: id, name: provider, providerKey: provider, connectionState: state, health, scopes: [], externalAccountId: "28295264780115792",
    externalAccountLabel: "turkishrughouse", lastVerifiedAt: null, lastSuccessAt: null, lastErrorAt: null, failureReason: null, revokedAt: null,
    createdAt: "2026-09-10T00:00:00.000Z",
  };
}
/* The capability-availability seam's answer: terminal rows are never sources; a usable row is readAvailable. */
function availability(usable: string[], provider = "instagram", caps = [ACCOUNT_CAP, MEDIA_CAP]): CapabilityAvailabilityView {
  return {
    readiness: "catalog-ready",
    capabilities: caps.map((capability) => ({
      capability, state: usable.length ? "available" : "not-connected", reason: null,
      sources: usable.map((integrationId) => ({ integrationId, providerKey: provider, accountLabel: "turkishrughouse", lastVerifiedAt: null, readAvailable: true, writeCapable: false })),
    })),
  } as CapabilityAvailabilityView;
}
function observed(cap: string, observedAt: string, standingAuthorizationId: string, integrationId: string, subjectRef = SUBJECT): ProviderObservationReadResult {
  return { status: "read", observations: [{
    observationId: "o", providerKey: "instagram", capabilityKey: cap, subjectKind: "instagram-account", subjectRef, integrationId,
    observedAt, recordedAt: observedAt, provenance: "standing-authorization", observedByActorType: null, standingAuthorizationId, invocationId: null, facts: {},
  } as StoredProviderObservation] };
}
const listing = (...connections: IntegrationView[]): ConnectionListing => ({ status: "read", connections });
const authorizations = (...revisions: StandingObservationAuthorizationRecord[]): StandingObservationHistoryResult => ({ status: "read", revisions });
const byCap = (entries: readonly ObservationAuthorityEntry[], cap: string) =>
  entries.find((e) => (e.status === "not-authorized" ? e.capabilityKey : e.authorization.capabilityKey) === cap)!;

/* ═══ BROKEN PRODUCTION STATE → authorized-but-connection-unusable ═════════════ */
const brokenInput: ObservationAuthorityInputs = {
  providerKey: "instagram",
  authorizations: authorizations(auth(ACCOUNT_CAP, 1, OLD, "316085c2"), auth(MEDIA_CAP, 1, OLD, "a27cadfd")),
  connections: listing(conn(OLD, "disconnected", "unknown"), conn(NEW, "connected", "healthy")),
  availability: availability([NEW]),
  latestObservations: new Map([
    [lineageKey(ACCOUNT_CAP, SUBJECT), observed(ACCOUNT_CAP, "2026-09-24T20:00:20.940Z", "316085c2", OLD)],
    [lineageKey(MEDIA_CAP, SUBJECT), observed(MEDIA_CAP, "2026-09-25T01:00:20.403Z", "a27cadfd", OLD)],
  ]),
  now: "2026-09-30T20:00:00.000Z",
};
const broken = deriveObservationAuthorityHealth(brokenInput);
assert.ok(broken.status === "read");
for (const cap of [ACCOUNT_CAP, MEDIA_CAP]) {
  const e = byCap(broken.entries, cap);
  assert.equal(e.status, "authorized-but-connection-unusable", `broken ${cap}: active authorization on an unusable exact connection`);
  assert.ok("authorization" in e);
  assert.equal(e.authorization.state, "active", "it does not claim 'not authorized'");
  assert.equal(e.authorization.integrationId, OLD, "the authorization still names the connection Governance named");
  assert.equal(e.authorizedConnection?.integrationId, OLD, "the judged connection is the authorized one, not the replacement");
  assert.equal(e.authorizedConnection?.connectionState, "disconnected");
  assert.equal(e.authorizedConnection?.readAvailable, false);
  assert.deepEqual(e.otherUsableConnections.map((c) => c.integrationId), [NEW], "the replacement is context only");
  assert.ok(e.observation.status === "recorded" && e.observation.beyondCadenceMinutes > 4 * 1440, "age beyond cadence is reported as a number");
}

/* ═══ REPAIRED PRODUCTION STATE → authorized-and-executable ═══════════════════ */
const repaired = deriveObservationAuthorityHealth({
  ...brokenInput,
  authorizations: authorizations(auth(ACCOUNT_CAP, 2, NEW, "49f3e8d2"), auth(MEDIA_CAP, 2, NEW, "368058f1")),
  latestObservations: new Map([
    [lineageKey(ACCOUNT_CAP, SUBJECT), observed(ACCOUNT_CAP, "2026-09-30T21:00:24.187Z", "49f3e8d2", NEW)],
    [lineageKey(MEDIA_CAP, SUBJECT), observed(MEDIA_CAP, "2026-09-30T21:00:24.919Z", "368058f1", NEW)],
  ]),
  now: "2026-09-30T21:30:00.000Z",
});
assert.ok(repaired.status === "read");
for (const [cap, at] of [[ACCOUNT_CAP, "2026-09-30T21:00:24.187Z"], [MEDIA_CAP, "2026-09-30T21:00:24.919Z"]] as const) {
  const e = byCap(repaired.entries, cap);
  assert.equal(e.status, "authorized-and-executable", `repaired ${cap}: active + the exact connection is usable`);
  assert.ok("authorization" in e && e.authorization.revision === 2 && e.authorizedConnection?.integrationId === NEW);
  assert.ok(e.observation.status === "recorded" && e.observation.latestObservedAt === at && e.observation.underThisAuthorization);
  assert.equal(e.observation.status === "recorded" && e.observation.beyondCadenceMinutes, 0);
  assert.equal(e.otherUsableConnections.length, 0);
}

/* ═══ C. ACTIVE + USABLE + OLD OBSERVATION: facts, no invented "stale" category ═══ */
const old = deriveObservationAuthorityHealth({ ...brokenInput, authorizations: authorizations(auth(MEDIA_CAP, 2, NEW, "368058f1")), now: "2026-09-30T20:00:00.000Z" });
const oldEntry = old.status === "read" ? byCap(old.entries, MEDIA_CAP) : null;
assert.equal(oldEntry?.status, "authorized-and-executable", "an old observation does not change what the authority says");
assert.ok(oldEntry && "authorization" in oldEntry && oldEntry.observation.status === "recorded" && !oldEntry.observation.underThisAuthorization,
  "the latest observation was taken under another authorization — stated, not hidden");

/* ═══ D. WITHDRAWN ═════════════════════════════════════════════════════════════ */
const withdrawn = deriveObservationAuthorityHealth({ ...brokenInput, authorizations: authorizations(auth(MEDIA_CAP, 3, NEW, "w", "withdrawn")) });
assert.equal(withdrawn.status === "read" && byCap(withdrawn.entries, MEDIA_CAP).status, "withdrawn");

/* ═══ E. NO AUTHORIZATION → not-authorized for each declared scope ═════════════ */
const none = deriveObservationAuthorityHealth({ ...brokenInput, authorizations: authorizations() });
assert.ok(none.status === "read");
assert.deepEqual(none.entries.map((e) => e.status), ["not-authorized", "not-authorized"], "both declared Instagram scopes, neither authorized");

/* ═══ UNAVAILABLE AUTHORITY → unavailable, never "not authorized" ═══════════════ */
assert.equal(deriveObservationAuthorityHealth({ ...brokenInput, authorizations: { status: "unavailable", reason: "persistence-unavailable" } }).status, "unavailable",
  "an unreadable authority is unknown, not 'not authorized'");

/* ═══ F. AUTHORIZATION REFERENCES A CONNECTION THE AUTHORITY DOES NOT LIST ══════ */
const missing = deriveObservationAuthorityHealth({ ...brokenInput, connections: listing(conn(NEW, "connected", "healthy")) });
const missingEntry = missing.status === "read" ? byCap(missing.entries, MEDIA_CAP) : null;
assert.equal(missingEntry?.status, "authorized-connection-unknown", "an unlisted connection is unknown, never 'disconnected'");
assert.ok(missingEntry && "authorization" in missingEntry && missingEntry.authorizedConnection?.listed === false && missingEntry.authorizedConnection.connectionState === null);
const connUnavailable = deriveObservationAuthorityHealth({ ...brokenInput, connections: { status: "unavailable", reason: "persistence-not-configured" } as ConnectionListing });
assert.equal(connUnavailable.status === "read" && byCap(connUnavailable.entries, MEDIA_CAP).status, "authorized-connection-unknown");

/* ═══ G. OBSERVATION HISTORY UNAVAILABLE → unavailable, never "none recorded" ════ */
const noHistory = deriveObservationAuthorityHealth({ ...brokenInput, latestObservations: new Map([[lineageKey(MEDIA_CAP, SUBJECT), { status: "unavailable", reason: "persistence-unavailable" }]]) });
const nh = noHistory.status === "read" ? byCap(noHistory.entries, MEDIA_CAP) : null;
assert.ok(nh && nh.status !== "not-authorized");
assert.equal(nh.observation.status, "unavailable", "an unreadable history is unavailable, never 'no observations'");
const nhAccount = noHistory.status === "read" ? byCap(noHistory.entries, ACCOUNT_CAP) : null;
assert.equal(nhAccount && nhAccount.status !== "not-authorized" && nhAccount.observation.status, "unavailable", "a read that was never made is unavailable too");
const emptyHistory = deriveObservationAuthorityHealth({ ...brokenInput, latestObservations: new Map([[lineageKey(MEDIA_CAP, SUBJECT), { status: "read", observations: [] }]]) });
const eh = emptyHistory.status === "read" ? byCap(emptyHistory.entries, MEDIA_CAP) : null;
assert.equal(eh && eh.status !== "not-authorized" && eh.observation.status, "none-recorded", "only a successful empty read says none");

/* ═══ H. A HEALTHY REPLACEMENT IS NOT INHERITED ═════════════════════════════════ */
const h = byCap((broken as { entries: readonly ObservationAuthorityEntry[] }).entries, MEDIA_CAP);
assert.notEqual(h.status, "authorized-and-executable", "a healthy replacement does not make the authorization executable");

/* ═══ YOUTUBE: the same authority, provider-neutral ═════════════════════════════ */
const YT = "youtube.channel.public.read";
const yt = deriveObservationAuthorityHealth({
  providerKey: "youtube",
  authorizations: authorizations(auth(YT, 1, "yt-conn", "yt-auth", "active", "youtube", "youtube/channel/UC1"), auth(MEDIA_CAP, 2, NEW, "368058f1")),
  connections: listing(conn("yt-conn", "connected", "healthy", "youtube")),
  availability: availability(["yt-conn"], "youtube", [YT]),
  latestObservations: new Map([[lineageKey(YT, "youtube/channel/UC1"), observed(YT, "2026-09-30T00:00:19.808Z", "yt-auth", "yt-conn", "youtube/channel/UC1")]]),
  now: "2026-09-30T01:00:00.000Z",
});
assert.ok(yt.status === "read" && yt.entries.length === 1, "only the requested provider's lineages");
assert.equal(yt.entries[0]!.status, "authorized-and-executable");

/* ═══ THE COMPOSITION: every read receives the session tenant ═══════════════════ */
void (async () => {
  const tenant = { tenantId: "9947c78e-2080-4331-81c6-456cb4be7a96" } as never;
  const seen: unknown[] = [];
  const obsQueries: unknown[] = [];
  const health = await readObservationAuthorityHealth(tenant, "instagram", {
    listAuthorizations: async (t) => { seen.push(t); return brokenInput.authorizations; },
    listConnections: async (t) => { seen.push(t); return brokenInput.connections; },
    getAvailability: async (t) => { seen.push(t); return brokenInput.availability; },
    readObservations: async (t, q) => { seen.push(t); obsQueries.push(q); return observed(MEDIA_CAP, "2026-09-25T01:00:20.403Z", "a27cadfd", OLD); },
    now: () => new Date("2026-09-30T20:00:00.000Z"),
  });
  assert.equal(seen.length, 5);
  assert.ok(seen.every((t) => t === tenant), "every read receives the session tenant and nothing else");
  assert.deepEqual(obsQueries, [
    { providerKey: "instagram", capabilityKey: ACCOUNT_CAP, subjectRef: SUBJECT, limit: 1 },
    { providerKey: "instagram", capabilityKey: MEDIA_CAP, subjectRef: SUBJECT, limit: 1 },
  ], "one newest-observation read per lineage, scoped to its capability and subject");
  assert.equal(health.status === "read" && byCap(health.entries, MEDIA_CAP).status, "authorized-but-connection-unusable");

  console.log(
    "observation-authority-legibility-1/health-behaviour: broken prod state → authorized-but-connection-unusable (replacement " +
      "context only), repaired → authorized-and-executable, withdrawn / not-authorized / unknown kept apart, unreadable " +
      "never becomes absent, no invented staleness, YouTube provider-neutral, session tenant only",
  );
})();
