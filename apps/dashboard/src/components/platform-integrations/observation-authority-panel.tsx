/*
 * observation-authority-panel.tsx — OBSERVATION-AUTHORITY-LEGIBILITY-1.
 *
 * "Is Hebun still observing this account?" answered as three separate facts: what Governance
 * authorized, whether the ONE connection it authorized is usable, and when an observation was last
 * recorded. Presentational and read-only: no control, no action, no reauthorize button — the only
 * way to change an authorization is the Governance ceremony.
 */
import {
  OBSERVATION_AUTHORITY_NON_CLAIM,
  OBSERVATION_AUTHORITY_WORDING,
  OTHER_CONNECTION_NOTE,
  type ObservationAuthorityEntry,
  type ObservationAuthorityHealth,
  type ObservationFreshnessFacts,
} from "@/features/observation-authority-legibility/contracts";

const CAPABILITY_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "instagram.account.public.read": "Instagram account observation",
  "instagram.media.public.read": "Instagram media observation",
  "youtube.channel.public.read": "YouTube channel observation",
});

const utc = (iso: string): string => `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
const shortId = (id: string): string => id.slice(0, 8);

function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h ${minutes % 60} min` : `${Math.floor(hours / 24)} d ${hours % 24} h`;
}

function Freshness({ facts, intervalMinutes }: { readonly facts: ObservationFreshnessFacts; readonly intervalMinutes: number }) {
  switch (facts.status) {
    case "unavailable":
      return <dd>Observation history could not be read right now. That is unknown, not “never observed”.</dd>;
    case "none-recorded":
      return <dd>No observation of this subject is recorded.</dd>;
    case "recorded":
      return (
        <dd className="space-y-0.5">
          <span className="block">
            {utc(facts.latestObservedAt)} · {duration(facts.ageMinutes)} ago
            {facts.beyondCadenceMinutes > 0
              ? ` · ${duration(facts.beyondCadenceMinutes)} beyond the authorized ${duration(intervalMinutes)} cadence`
              : " · within the authorized cadence"}
          </span>
          {facts.underThisAuthorization ? null : (
            <span className="block text-fg-muted">
              Recorded under a different authorization{facts.standingAuthorizationId ? ` (${shortId(facts.standingAuthorizationId)})` : ""}, through connection {shortId(facts.integrationId)}.
            </span>
          )}
        </dd>
      );
  }
}

function Entry({ entry }: { readonly entry: ObservationAuthorityEntry }) {
  const capability = entry.status === "not-authorized" ? entry.capabilityKey : entry.authorization.capabilityKey;
  return (
    <li className="space-y-1 rounded-md border border-border-subtle p-3">
      <h4 className="font-medium text-fg-secondary">{CAPABILITY_LABELS[capability] ?? capability}</h4>
      <p className="text-fg-muted">{OBSERVATION_AUTHORITY_WORDING[entry.status]}</p>
      {entry.status === "not-authorized" ? null : (
        <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-0.5 text-[12px]">
          <dt className="text-fg-muted">Governance authorization</dt>
          <dd>
            {entry.authorization.state === "active" ? "Active" : "Withdrawn"} · revision {entry.authorization.revision}
          </dd>
          {entry.authorizedConnection ? (
            <>
              <dt className="text-fg-muted">Authorized connection</dt>
              <dd>
                {entry.authorizedConnection.accountLabel ?? "no account label"} · {shortId(entry.authorizedConnection.integrationId)} ·{" "}
                {entry.authorizedConnection.listed
                  ? `${entry.authorizedConnection.connectionState} / ${entry.authorizedConnection.health} · ${entry.authorizedConnection.readAvailable ? "usable for this read" : "not usable for this read"}`
                  : "not listed by the connection authority"}
              </dd>
            </>
          ) : null}
          <dt className="text-fg-muted">Observation cadence</dt>
          <dd>At most every {duration(entry.authorization.intervalMinutes)}</dd>
          <dt className="text-fg-muted">Last recorded observation</dt>
          <Freshness facts={entry.observation} intervalMinutes={entry.authorization.intervalMinutes} />
        </dl>
      )}
      {entry.status !== "not-authorized" && entry.status !== "withdrawn" && entry.status !== "authorized-and-executable" && entry.otherUsableConnections.length > 0 ? (
        <p className="text-fg-muted">
          {OTHER_CONNECTION_NOTE} ({entry.otherUsableConnections.map((c) => c.accountLabel ?? shortId(c.integrationId)).join(", ")})
        </p>
      ) : null}
    </li>
  );
}

export function ObservationAuthorityPanel({ health }: { readonly health: ObservationAuthorityHealth }) {
  return (
    <div className="space-y-2">
      <h3 className="font-medium">Standing observation</h3>
      {health.status === "unavailable" ? (
        <p className="text-fg-muted">Standing observation authorizations could not be read right now. That is unknown, not “not authorized”.</p>
      ) : (
        <ul className="space-y-2">
          {health.entries.map((e) => (
            <Entry key={e.status === "not-authorized" ? e.capabilityKey : e.authorization.authorizationId} entry={e} />
          ))}
        </ul>
      )}
      <p className="text-[11px] text-fg-muted">{OBSERVATION_AUTHORITY_NON_CLAIM}</p>
    </div>
  );
}
