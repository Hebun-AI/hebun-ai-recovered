/*
 * observation-authority-legibility/derive-observation-authority-health.ts — the pure projection
 * (OBSERVATION-AUTHORITY-LEGIBILITY-1).
 *
 * No database, no provider, no tenant, no clock of its own. It is handed what the released read
 * seams already answered — the effective standing authorizations, the tenant's connections, the
 * capability-availability view and the latest observation per lineage — plus `now`, and says what
 * those jointly support.
 *
 * ── "USABLE" IS THE INTEGRATION AUTHORITY'S WORD, NOT OURS ─────────────────
 *
 * The capability-availability seam is where the rules for "this connection can answer this
 * capability" live (connected + usable health + scopes cover the read; terminal rows are never
 * sources). This file does not re-interpret `connection_state` or `health`; it asks whether the
 * seam lists THE AUTHORIZED CONNECTION as a `readAvailable` source for THE AUTHORIZED CAPABILITY.
 * The same question the revalidator asks, from the same seam.
 *
 * ── THE AUTHORIZED CONNECTION, NEVER THE LATEST ONE ─────────────────────────
 *
 * The connection judged is `authorization.integrationId`. Another usable connection is reported
 * beside it as context and never substitutes for it: an authorization for connection C is not
 * satisfied by connection D being healthy.
 */
import type { CapabilityAvailabilityView, ConnectionListing } from "@/features/integration-authority/contracts";
import type { ProviderObservationReadResult } from "@/features/provider-observation-history/read-provider-observations.server";
import {
  OBSERVABLE_CAPABILITIES,
  type StandingObservationAuthorizationRecord,
  type StandingObservationHistoryResult,
} from "@/features/standing-observation-authority/contracts";
import type {
  AuthorizationFacts,
  AuthorizedConnectionFacts,
  ObservationAuthorityEntry,
  ObservationAuthorityHealth,
  ObservationFreshnessFacts,
  OtherUsableConnection,
} from "./contracts";

/** The key the observation reads are filed under: one per lineage the tenant holds. */
export function lineageKey(capabilityKey: string, subjectRef: string): string {
  return `${capabilityKey} ${subjectRef}`;
}

export interface ObservationAuthorityInputs {
  readonly providerKey: string;
  readonly authorizations: StandingObservationHistoryResult;
  readonly connections: ConnectionListing;
  readonly availability: CapabilityAvailabilityView;
  /** Latest-observation read per `lineageKey`. A missing key is unreadable, never "none". */
  readonly latestObservations: ReadonlyMap<string, ProviderObservationReadResult>;
  /** ISO instant supplied by the caller. */
  readonly now: string;
}

function authorizationFacts(r: StandingObservationAuthorizationRecord): AuthorizationFacts {
  return Object.freeze({
    authorizationId: r.authorizationId,
    revision: r.authorizationRevision,
    state: r.state,
    providerKey: r.providerKey,
    capabilityKey: r.capabilityKey,
    subjectRef: r.subjectRef,
    integrationId: r.integrationId,
    intervalMinutes: r.intervalMinutes,
    authorizedAt: r.authorizedAt,
  });
}

function sourcesFor(availability: CapabilityAvailabilityView, capabilityKey: string, providerKey: string) {
  const entry = availability.capabilities.find((c) => c.capability === capabilityKey);
  return (entry?.sources ?? []).filter((s) => s.providerKey === providerKey);
}

function freshnessOf(
  record: StandingObservationAuthorizationRecord,
  read: ProviderObservationReadResult | undefined,
  now: string,
): ObservationFreshnessFacts {
  if (!read || read.status !== "read") return Object.freeze({ status: "unavailable" as const });
  const latest = read.observations
    .filter((o) => o.capabilityKey === record.capabilityKey && o.subjectRef === record.subjectRef)
    .reduce<(typeof read.observations)[number] | null>((a, o) => (a === null || o.observedAt > a.observedAt ? o : a), null);
  if (!latest) return Object.freeze({ status: "none-recorded" as const });
  const ageMinutes = Math.max(0, Math.floor((Date.parse(now) - Date.parse(latest.observedAt)) / 60_000));
  return Object.freeze({
    status: "recorded" as const,
    latestObservedAt: latest.observedAt,
    standingAuthorizationId: latest.standingAuthorizationId,
    integrationId: latest.integrationId,
    underThisAuthorization: latest.standingAuthorizationId === record.authorizationId,
    ageMinutes,
    beyondCadenceMinutes: Math.max(0, ageMinutes - record.intervalMinutes),
  });
}

function entryFor(record: StandingObservationAuthorizationRecord, input: ObservationAuthorityInputs): ObservationAuthorityEntry {
  const authorization = authorizationFacts(record);
  const observation = freshnessOf(record, input.latestObservations.get(lineageKey(record.capabilityKey, record.subjectRef)), input.now);

  if (record.state !== "active") {
    return Object.freeze({ status: "withdrawn" as const, authorization, authorizedConnection: null, otherUsableConnections: [], observation });
  }

  const sources = sourcesFor(input.availability, record.capabilityKey, record.providerKey);
  const otherUsableConnections: OtherUsableConnection[] = sources
    .filter((s) => s.readAvailable && s.integrationId !== record.integrationId)
    .map((s) => Object.freeze({ integrationId: s.integrationId, accountLabel: s.accountLabel }));

  if (input.connections.status !== "read") {
    return Object.freeze({
      status: "authorized-connection-unknown" as const,
      authorization,
      authorizedConnection: null,
      otherUsableConnections,
      observation,
    });
  }
  const view = input.connections.connections.find((c) => c.integrationId === record.integrationId);
  if (!view) {
    /* Not listed is not "disconnected": the authority did not say anything about it. */
    return Object.freeze({
      status: "authorized-connection-unknown" as const,
      authorization,
      authorizedConnection: Object.freeze({
        integrationId: record.integrationId,
        listed: false,
        connectionState: null,
        health: null,
        accountLabel: null,
        readAvailable: false,
      }),
      otherUsableConnections,
      observation,
    });
  }

  const source = sources.find((s) => s.integrationId === record.integrationId);
  const readAvailable = source?.readAvailable === true;
  const authorizedConnection: AuthorizedConnectionFacts = Object.freeze({
    integrationId: record.integrationId,
    listed: true,
    connectionState: view.connectionState,
    health: view.health,
    accountLabel: view.externalAccountLabel ?? view.externalAccountId,
    readAvailable,
  });
  return Object.freeze({
    status: readAvailable ? ("authorized-and-executable" as const) : ("authorized-but-connection-unusable" as const),
    authorization,
    authorizedConnection,
    otherUsableConnections,
    observation,
  });
}

/** The projection for one provider's observable scopes, for the tenant whose reads were handed in. */
export function deriveObservationAuthorityHealth(input: ObservationAuthorityInputs): ObservationAuthorityHealth {
  if (input.authorizations.status !== "read") return Object.freeze({ status: "unavailable" as const });
  const records = input.authorizations.revisions.filter((r) => r.providerKey === input.providerKey);
  const entries: ObservationAuthorityEntry[] = records.map((r) => entryFor(r, input));

  /* Every observable scope this provider declares that the tenant has never authorized. */
  for (const scope of OBSERVABLE_CAPABILITIES.filter((c) => c.providerKey === input.providerKey)) {
    if (!records.some((r) => r.capabilityKey === scope.capabilityKey)) {
      entries.push(Object.freeze({ status: "not-authorized" as const, providerKey: scope.providerKey, capabilityKey: scope.capabilityKey }));
    }
  }
  return Object.freeze({ status: "read" as const, entries: Object.freeze(entries) });
}
