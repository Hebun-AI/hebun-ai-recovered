/*
 * integration-authority/contracts.ts — the typed vocabulary of "this tenant has a connection" (I1).
 *
 * THE QUESTION THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   Does this tenant have a connection record for this provider, what lifecycle state
 *              is it in, and can a capability therefore be answered from it?
 *   REFUSED    Is a credential stored? (I2 — no credential store exists.)
 *   REFUSED    Is the connection verified? (I2 — nothing here makes a provider call.)
 *   REFUSED    May a write happen? (Governance — a permit, and this module cannot mint one.)
 *   REFUSED    Does it then run? (action-execution — untouched by this phase.)
 *
 * ── THE FOUR LAYERS THIS FILE EXISTS TO KEEP APART ───────────────────────────
 *
 *   CONNECTED FOR READ  ≠  WRITE-CAPABLE  ≠  WRITE-AUTHORIZED  ≠  EXECUTED
 *
 * The first two are this subsystem's. The third is Governance's and the fourth is
 * action-execution's, and NO TYPE IN THIS FILE CAN EXPRESS EITHER. That is structural, not
 * conventional: there is no `writeAuthorized` field to set, so no caller can be handed one by
 * mistake and no future edit can add one without deleting a test that names its absence.
 *
 * Pure types and frozen values. No React, no I/O, no database, no clock, no authority.
 */

/* ── The frozen catalog's vocabulary ────────────────────────────────────────── */

/**
 * How a provider expects to be authenticated. It describes a definition, never a stored secret —
 * I1 stores none of either kind.
 *
 * ── `github_app` IS ADDED BY GITHUB-1, AND IT COSTS NOTHING TO ADD ───────────
 *
 * This union is TYPE-ONLY VOCABULARY. `authMethod` is a field on a frozen code literal; it is not
 * a column, it is never persisted, it is read by no runtime branch and no `switch` in `src/`, and
 * a test pins that. So widening it changes no stored value and no behaviour — it lets the catalog
 * say what is true instead of picking whichever released word was least wrong.
 *
 * And "least wrong" would have been genuinely wrong. A GitHub App installation is NOT `oauth2`:
 * there is no authorization-code exchange for the connection, no refresh token, no tenant-held
 * secret, and the grant is made by an ORGANIZATION to an APP rather than by a user to a client.
 * Labelling it `oauth2` would have told every future reader that `integration_credentials` holds a
 * refresh token for it. Nothing does, and nothing should.
 */
export type ProviderAuthMethod = "oauth2" | "api_key" | "github_app";

/** What the provider calls the thing a connection is bound to. Google says workspace, Slack team. */
export type ProviderAccountIdentity = "workspace" | "organization" | "account" | "team";

/**
 * WHETHER A DEFINITION CLAIMS HEBUN CAN ACTUALLY CONNECT TO IT.
 *
 * `connectable` requires a credential store and a verifier. NEITHER EXISTS IN I1, so the released
 * catalog contains ZERO connectable entries and a test asserts it. `fixture` entries exist only to
 * exercise the repository and the schema; they are excluded from the availability seam entirely,
 * so no surface can present one as a real provider.
 *
 * The union has both members on purpose. A single-member union would have to be widened by the
 * phase that adds the first real connector, and widening a type is exactly the kind of change that
 * passes review unnoticed. This way, adding a real provider is a one-word diff on a value that a
 * test already reads.
 */
export type ProviderConnectivity = "fixture" | "connectable";

/**
 * One connectable-provider definition. PURE DATA — it holds no adapter, no transport, no client,
 * no endpoint and no function. It cannot execute anything, which is why it may live in a catalog
 * at all.
 */
export interface ConnectionDefinition {
  readonly providerKey: string;
  readonly label: string;
  readonly authMethod: ProviderAuthMethod;
  readonly accountIdentity: ProviderAccountIdentity;
  readonly connectivity: ProviderConnectivity;
  /** Below this granted set, a connection can never be `connected`, however successful the call. */
  readonly minimumScopes: readonly string[];
  /** capability → the scopes a read needs and the scopes a write needs. */
  readonly capabilityScopes: Readonly<
    Record<string, { readonly read: readonly string[]; readonly write: readonly string[] }>
  >;
}

/** The catalog as a dependency, so a test can exercise the seam without a real provider existing. */
export type ProviderCatalog = readonly ConnectionDefinition[];

/* ── Connection state ───────────────────────────────────────────────────────── */

export type ConnectionState =
  | "draft"
  | "unverified"
  | "connected"
  | "expired"
  | "revoked"
  | "disconnected";

export type ConnectionHealth = "unknown" | "healthy" | "degraded" | "unreachable";

/**
 * THE HEALTH VALUES THAT MEAN "AN ATTEMPT WAS OBSERVED AND IT FAILED".
 *
 * A 429, a 5xx, a timeout, a DNS failure or a TLS failure lands here — and NOWHERE ELSE. None of
 * them touches `connection_state`, because none of them ended the tenant's grant: the provider is
 * simply not answering, and the grant is still there when it starts answering again.
 *
 * This list is NOT the usability test. It exists so a consumer can be told WHICH kind of health
 * gap it has — a failed observation reads differently from a missing one.
 */
export const IMPAIRED_CONNECTION_HEALTH: readonly ConnectionHealth[] = Object.freeze([
  "degraded",
  "unreachable",
]);

/** `true` when the last observed attempt failed. */
export function isImpairedHealth(health: ConnectionHealth): boolean {
  return IMPAIRED_CONNECTION_HEALTH.includes(health);
}

/**
 * THE USABILITY TEST: `healthy`, AND NOTHING ELSE.
 *
 * `unknown` IS NOT USABLE, and that is the whole point of this function existing separately from
 * `isImpairedHealth`. A successful verification persists `connection_state = 'connected'` AND
 * `health = 'healthy'` together, so a legitimately verified connection is never left at `unknown`.
 * Reaching `unknown` on a `connected` row therefore means one thing: Hebun does not currently hold
 * a health observation sufficient to claim the capability can be answered.
 *
 * Treating that as `available` would be an availability claim resting on no observation at all —
 * the same untruth as reporting an unreachable provider as available, with the evidence missing
 * rather than negative.
 */
export function isHealthUsable(health: ConnectionHealth): boolean {
  return health === "healthy";
}

/**
 * Terminal states. Neither ever transitions out — reconnecting creates a NEW row.
 *
 * Reusing a terminal row would make the audit trail unable to say when a grant actually existed,
 * because one row would have held two different grants with one creation timestamp.
 */
export const TERMINAL_CONNECTION_STATES: readonly ConnectionState[] = Object.freeze([
  "revoked",
  "disconnected",
]);

export function isTerminalConnectionState(state: ConnectionState): boolean {
  return TERMINAL_CONNECTION_STATES.includes(state);
}

/**
 * THE STATES THE INTEGRATION RUNTIME IS CAPABLE OF PRODUCING.
 *
 * INT-1 SHIPPED WITH TWO — `draft` and `disconnected` — because `unverified` needs a stored
 * credential and nothing could store one. INT-2 BUILT THE CREDENTIAL AUTHORITY, so `unverified` is
 * added here DELIBERATELY, as a released-pin change rather than a drift: storing or replacing a
 * secret moves a non-terminal connection to `unverified`, which is the honest statement that
 * something was supplied and nothing has confirmed it.
 *
 * INT-3 BUILT THE FIRST REAL VERIFIER, so `connected` and `expired` join them — but ONLY through
 * `recordVerifiedConnectionWithin` / `recordVerificationFailureWithin`, and only from a real
 * provider response. `createConnection` and `disconnectConnection` still cannot reach them, and a
 * test proves it by reading their bodies.
 *
 * `revoked` REMAINS UNREACHABLE, deliberately. It means the provider explicitly ended the grant,
 * and Google's `invalid_grant` cannot establish that: the same response covers a user revocation,
 * a refresh token that lapsed through disuse, and a testing-mode grant that aged out. So an
 * ambiguous refusal becomes `expired` — "the credential Hebun holds can no longer be used or
 * restored, and re-consent is required" — which is the strongest claim the evidence supports.
 * Writing `revoked` would put a fact in a permanent record that no provider ever stated.
 *
 * `disconnected` is reachable because ending a connection needs nothing external: it is the one
 * transition a tenant can always perform, even against a provider that is down.
 */
export const I1_PRODUCIBLE_STATES: readonly ConnectionState[] = Object.freeze([
  "draft",
  "unverified",
  "connected",
  "expired",
  "disconnected",
]);

/**
 * The full transition table. It is stated once, here, so the guard and its test read the same
 * data — a guard whose test restates the rules in its own words tests the restatement.
 *
 * Terminal states map to an empty list, which is what makes "terminal" mechanical rather than a
 * comment. The credential and verification transitions are declared even though I1 cannot perform
 * them: the map describes the lifecycle, and the phase boundary is enforced by
 * `I1_PRODUCIBLE_STATES` and by the absence of any code that reaches them.
 */
export const CONNECTION_TRANSITIONS: Readonly<Record<ConnectionState, readonly ConnectionState[]>> =
  Object.freeze({
    draft: Object.freeze(["unverified", "disconnected"] as const),
    unverified: Object.freeze(["connected", "revoked", "disconnected"] as const),
    connected: Object.freeze(["expired", "revoked", "disconnected", "unverified"] as const),
    expired: Object.freeze(["unverified", "connected", "revoked", "disconnected"] as const),
    revoked: Object.freeze([] as const),
    disconnected: Object.freeze([] as const),
  }) as Readonly<Record<ConnectionState, readonly ConnectionState[]>>;

export function canTransition(from: ConnectionState, to: ConnectionState): boolean {
  return CONNECTION_TRANSITIONS[from].includes(to);
}

/* ── What a caller may read ─────────────────────────────────────────────────── */

/**
 * A connection as any caller sees it.
 *
 * It carries NO credential field, NO token, NO ciphertext, NO permit and NO authorization — none
 * of those is a column, and none is derivable here. `scopes` is the granted set as last observed;
 * in I1 it is always empty, because nothing has ever observed one.
 */
export interface IntegrationView {
  readonly integrationId: string;
  readonly name: string;
  readonly providerKey: string | null;
  readonly connectionState: ConnectionState;
  readonly health: ConnectionHealth;
  readonly scopes: readonly string[];
  readonly externalAccountId: string | null;
  readonly externalAccountLabel: string | null;
  readonly lastVerifiedAt: string | null;
  readonly lastSuccessAt: string | null;
  readonly lastErrorAt: string | null;
  readonly failureReason: string | null;
  readonly revokedAt: string | null;
  readonly createdAt: string;
}

/* ── Writing ────────────────────────────────────────────────────────────────── */

/**
 * What a caller may say when recording a connection.
 *
 * It carries NO tenant, NO actor, NO state, NO health, NO scopes and NO external account: those
 * are unrepresentable rather than merely discouraged, exactly as `CreateRecipientInput` and
 * `CreateWorkArtifactInput` are. Tenant and actor come from an already-resolved server-side
 * `TenantContext`; the state is always `draft`; everything else is verification's to write, and
 * verification does not exist yet.
 */
export interface CreateConnectionInput {
  readonly providerKey: string;
  readonly name: string;
}

/** Every way a connection write or read can honestly say no. */
export type ConnectionRefusal =
  /** The name or the provider key is malformed. */
  | "invalid-input"
  /** The provider key names no entry in the frozen catalog. A row cannot invent a provider. */
  | "unknown-provider"
  /**
   * The catalog entry exists but is not `connectable`. Distinct from `unknown-provider` on
   * purpose: the definition is real, and Hebun genuinely cannot connect to it yet.
   */
  | "provider-not-connectable"
  /** This tenant already holds a live connection to that provider account. */
  | "duplicate-live-connection"
  /** No tenant context, or no database. */
  | "no-authorized-tenant-context"
  | "persistence-not-configured"
  /** The transition is not in `CONNECTION_TRANSITIONS`, or the row is terminal. */
  | "illegal-transition"
  /** Read as nothing. Never distinguished from another tenant's row — see the repository. */
  | "not-found";

export const CONNECTION_LIMITS = {
  /** A connection name is one line a human reads in a list, not a description. */
  nameMaxLength: 200,
  /** Bounded so a listing can never become a data export. */
  listLimit: 200,
} as const;

export type CreateConnectionResult =
  | { readonly status: "created"; readonly connection: IntegrationView }
  | { readonly status: "refused"; readonly reason: ConnectionRefusal };

export type TransitionConnectionResult =
  | { readonly status: "transitioned"; readonly connection: IntegrationView }
  | { readonly status: "refused"; readonly reason: ConnectionRefusal };

export type ConnectionListing =
  | { readonly status: "read"; readonly connections: readonly IntegrationView[] }
  | { readonly status: "unavailable"; readonly reason: ConnectionRefusal };

/* ── Verification ───────────────────────────────────────────────────────────── */

/**
 * THE ONLY TRUTHFUL VERIFICATION OUTCOME IN I1.
 *
 * Verification requires decrypting a stored credential. There is no credential store, no
 * encryption boundary and no key registry in this phase, so every call refuses with this reason.
 *
 * It is a REFUSAL, not a stub and not a failure: nothing was attempted, nothing failed, and the
 * connection's state is untouched. A stub returning `{ ok: true }` — or a `not-implemented` error
 * a caller might retry — would both be claims about a provider that was never contacted.
 */
export const NO_CREDENTIAL_AUTHORITY = "no-credential-authority" as const;

/**
 * THE SECOND TRUTHFUL REFUSAL, ADDED BY INT-2.
 *
 * Before INT-2, `no-credential-authority` was the whole story: there was no credential store, so
 * nothing could be verified and that one sentence covered it.
 *
 * INT-2 BUILT THE STORE, WHICH MADE THAT SENTENCE FALSE for a connection that now has a secret.
 * A credential can exist, be readable and be perfectly valid, and verification must STILL refuse —
 * because nothing in this deployment knows how to ask this provider anything.
 *
 * Two different facts, two different refusals. Reusing the old one would have told a tenant their
 * credential was missing while it sat encrypted in a row three feet away.
 */
export const NO_PROVIDER_VERIFIER = "no-provider-verifier" as const;

export type VerificationRefusalReason =
  | typeof NO_CREDENTIAL_AUTHORITY
  | typeof NO_PROVIDER_VERIFIER
  | "not-found"
  | "no-authorized-tenant-context"
  | "persistence-not-configured";

/**
 * The verification result shape.
 *
 * The `ok: true` arm is DECLARED and STILL UNREACHABLE after INT-2 — no code path constructs it,
 * and a test asserts that. Declaring it early means the provider phase adds a producer rather than
 * widening a type, and that the consumer's exhaustive handling is written and reviewed before a
 * real provider response can ever arrive.
 */
export type VerificationOutcome =
  | {
      readonly ok: true;
      readonly externalAccountId: string;
      readonly externalAccountLabel: string;
      readonly grantedScopes: readonly string[];
    }
  | { readonly ok: false; readonly reason: VerificationRefusalReason };

/* ── The capability-availability read seam ──────────────────────────────────── */

/**
 * Why a capability can or cannot be answered right now.
 *
 * `unauthorized` IS DELIBERATELY NOT A MEMBER. Authorization is Governance's and is not knowable
 * from a connection: including it here would be the exact leak the read/write firewall exists to
 * prevent, and its absence is asserted by a test rather than promised by this comment.
 */
export type CapabilityState =
  | "available"
  | "not-connected"
  | "unverified"
  | "degraded"
  | "revoked";

/**
 * THE NORMALIZED MAPPING, STATED ONCE.
 *
 *   connected + healthy + covering scopes   ->  available
 *   connected + scopes below the capability ->  degraded   (scope gap — outranks any health gap)
 *   connected + degraded health             ->  degraded   (observed failure)
 *   connected + unreachable health          ->  degraded   (observed failure)
 *   connected + unknown health              ->  degraded   (NO observation — health not established)
 *   unverified / draft                      ->  unverified
 *   revoked / expired                       ->  revoked
 *   no connection at all                    ->  not-connected
 *
 * `available` therefore has EXACTLY ONE spelling: connected, healthy, covering. Everything else
 * about a live connection is `degraded`, and the `reason` is what separates three different facts —
 * a scope gap persists until the tenant re-grants, an observed outage clears itself, and a missing
 * observation means nothing has been established either way. A consumer that could not tell them
 * apart would ask a tenant to reconnect because a provider returned a 503.
 *
 * THE SCOPE GAP IS REPORTED FIRST, because it is the only one of the three that will still be
 * there tomorrow.
 *
 * LIFECYCLE IS NEVER MOVED BY HEALTH. `degraded` here is a statement about what can be answered
 * right now; the `connection_state` column still reads `connected` throughout, and a test measures
 * that column directly rather than trusting this paragraph.
 */

/**
 * One connection offering a capability.
 *
 * BOTH BOOLEANS ARE PRESENT USABILITY, NOT STORED FACTS. Each requires three things at once: the
 * lifecycle is `connected`, the last observed health is not impaired, and the granted scopes cover
 * the capability. A source that reports `readAvailable: true` inside a view whose state is not
 * `available` would be the two-interpreters bug this module exists to delete, one layer down.
 *
 * `writeCapable` is CAPABILITY, NEVER PERMISSION: it says a write is presently possible, and says
 * nothing about whether one may happen. There is no `writeAuthorized` field, no permit, no token
 * and no handle — a consumer holding this object cannot mutate anything with it.
 */
export interface CapabilitySource {
  readonly integrationId: string;
  readonly providerKey: string;
  readonly accountLabel: string | null;
  readonly lastVerifiedAt: string | null;
  readonly readAvailable: boolean;
  readonly writeCapable: boolean;
}

export interface CapabilityAvailabilityEntry {
  readonly capability: string;
  readonly state: CapabilityState;
  /** Present unless `available`. Never null when the capability cannot be answered. */
  readonly reason: string | null;
  readonly sources: readonly CapabilitySource[];
}

/**
 * Why the whole view might be empty.
 *
 * An empty `capabilities` list with no explanation reads as "everything is fine". This field makes
 * that impossible: a consumer must handle `no-connectable-provider`, which is the truthful state of
 * this deployment for the whole of I1.
 */
export type CapabilityAvailabilityReadiness = "no-connectable-provider" | "catalog-ready";

export interface CapabilityAvailabilityView {
  readonly readiness: CapabilityAvailabilityReadiness;
  readonly capabilities: readonly CapabilityAvailabilityEntry[];
}

/* ── Audit vocabulary ───────────────────────────────────────────────────────── */

/**
 * The `audit_log.action` values this phase owns. TWO, because two are all I1 can honestly produce.
 *
 * DELIBERATELY ABSENT and belonging to I2: `integration.credential.stored`,
 * `integration.verification.succeeded`, `integration.verification.failed`,
 * `integration.credential.refresh_failed`, `integration.scopes.changed`,
 * `integration.connection.revoked`. Emitting any of them here would be a recorded act that never
 * happened.
 *
 * Also absent, and not deferred but CANCELLED: a write-capability-changed event. Write capability
 * is derived from the granted scope set, so auditing it would be a second record of a fact
 * `scopes.changed` already carries — and the two would eventually disagree.
 */
export const INTEGRATION_AUDIT_CONNECTION_CREATED = "integration.connection.created" as const;
export const INTEGRATION_AUDIT_CONNECTION_DISCONNECTED =
  "integration.connection.disconnected" as const;

/** The `audit_log.entity_type` for connection events. */
export const INTEGRATION_ENTITY_TYPE = "integration" as const;

/** The `audit_log.source` for this domain. */
export const INTEGRATION_AUDIT_SOURCE = "integration-authority" as const;
