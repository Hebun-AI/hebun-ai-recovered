/*
 * observation-authority-legibility/contracts.ts — OBSERVATION-AUTHORITY-LEGIBILITY-1.
 *
 * ── THREE DIFFERENT FACTS, KEPT APART ───────────────────────────────────────
 *
 *   AUTHORIZATION     what Governance permitted: the effective revision of a standing observation
 *                     lineage, its state, its cadence ceiling and the ONE connection it names.
 *   CONNECTION        whether THAT connection is currently usable for THAT capability, as the
 *                     integration authority's own capability-availability seam answers it.
 *   OBSERVATION       when Hebun last recorded an observation of that subject, and under which
 *                     authorization and connection.
 *
 * `active` is not `executable`, and neither is `fresh`. Production held an active authorization
 * bound to a revoked connection for five days while a healthy replacement sat beside it; nothing
 * said so. This projection says so — and nothing more.
 *
 * ── WHAT IT MUST NEVER SAY ──────────────────────────────────────────────────
 *
 * It never claims why an observation is missing. Runtime refusals are not persisted anywhere, so
 * "the provider failed", "the scheduler stopped" or "it failed N times" is unrepresentable here.
 * It never implies that an authorization applies to a connection it does not name. It never turns
 * an unreadable input into "not authorized", "disconnected" or "never observed".
 *
 * ── NO STALENESS POLICY ─────────────────────────────────────────────────────
 *
 * The repository defines no freshness tolerance, so this projection invents none: it reports the
 * latest observation, its age and how far that age exceeds the authorized cadence, as numbers.
 * Turning those numbers into a categorical "stale" needs a tolerance, and a tolerance is a policy
 * decision that has not been made.
 *
 * Derived on every read; stored nowhere.
 */

/** What the effective authorization + the exact connection it names jointly support. */
export const OBSERVATION_AUTHORITY_STATUSES = [
  /** Active, and the named connection is a usable read source for this capability right now. */
  "authorized-and-executable",
  /** Active, but the named connection is not a usable read source for this capability. */
  "authorized-but-connection-unusable",
  /** Active, but the connection authority could not be read, or does not list the named connection. */
  "authorized-connection-unknown",
  /** The effective revision withdrew the scope. */
  "withdrawn",
  /** This tenant has never authorized this observable scope. */
  "not-authorized",
] as const;
export type ObservationAuthorityStatus = (typeof OBSERVATION_AUTHORITY_STATUSES)[number];

export interface AuthorizationFacts {
  readonly authorizationId: string;
  readonly revision: number;
  readonly state: "active" | "withdrawn";
  readonly providerKey: string;
  readonly capabilityKey: string;
  readonly subjectRef: string;
  readonly integrationId: string;
  readonly intervalMinutes: number;
  readonly authorizedAt: string;
}

/** The connection the authorization NAMES — never a substitute. `null` fields = not listed. */
export interface AuthorizedConnectionFacts {
  readonly integrationId: string;
  /** Whether the connection authority listed this connection for the tenant at all. */
  readonly listed: boolean;
  readonly connectionState: string | null;
  readonly health: string | null;
  readonly accountLabel: string | null;
  /** The capability-availability seam's own answer for THIS connection and THIS capability. */
  readonly readAvailable: boolean;
}

/** Another connection that IS a usable source for the capability. Context only — never inherited. */
export interface OtherUsableConnection {
  readonly integrationId: string;
  readonly accountLabel: string | null;
}

export type ObservationFreshnessFacts =
  | { readonly status: "unavailable" }
  | { readonly status: "none-recorded" }
  | {
      readonly status: "recorded";
      readonly latestObservedAt: string;
      /** Which authorization and connection the latest recorded observation was taken under. */
      readonly standingAuthorizationId: string | null;
      readonly integrationId: string;
      readonly underThisAuthorization: boolean;
      readonly ageMinutes: number;
      /** `ageMinutes - intervalMinutes` when positive, else 0. A number, not a verdict. */
      readonly beyondCadenceMinutes: number;
    };

export type ObservationAuthorityEntry =
  | {
      readonly status: "not-authorized";
      readonly providerKey: string;
      readonly capabilityKey: string;
    }
  | {
      readonly status: Exclude<ObservationAuthorityStatus, "not-authorized">;
      readonly authorization: AuthorizationFacts;
      /** `null` only for `withdrawn`, which names no connection that matters. */
      readonly authorizedConnection: AuthorizedConnectionFacts | null;
      readonly otherUsableConnections: readonly OtherUsableConnection[];
      readonly observation: ObservationFreshnessFacts;
    };

export type ObservationAuthorityHealth =
  | { readonly status: "unavailable" }
  | { readonly status: "read"; readonly entries: readonly ObservationAuthorityEntry[] };

export const OBSERVATION_AUTHORITY_WORDING: Readonly<Record<ObservationAuthorityStatus, string>> = Object.freeze({
  "authorized-and-executable":
    "Governance authorization is active and the connection it authorizes is currently usable for this read.",
  "authorized-but-connection-unusable":
    "Authorization is active, but the connection it authorizes is not currently usable.",
  "authorized-connection-unknown":
    "Authorization is active, but the state of the connection it authorizes could not be read.",
  withdrawn: "Governance withdrew this authorization.",
  "not-authorized": "Governance has not authorized this observation.",
});

export const OTHER_CONNECTION_NOTE =
  "A different connection is available for this read, but this authorization does not apply to it.";

export const OBSERVATION_AUTHORITY_NON_CLAIM =
  "Usable now does not guarantee the next scheduled observation succeeds. Hebun does not record why an observation did not happen, so none is claimed.";
