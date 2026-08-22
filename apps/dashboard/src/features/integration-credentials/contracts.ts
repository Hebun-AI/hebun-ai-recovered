/*
 * integration-credentials/contracts.ts — the typed vocabulary of "this tenant supplied a secret".
 *
 * THE QUESTIONS THIS PHASE ANSWERS, AND THE ONES IT REFUSES:
 *
 *   ANSWERED   Does this tenant hold a credential of this kind for this connection, sealed under
 *              which key, and may a server operation briefly open it?
 *   REFUSED    Is the secret CORRECT? (A provider would have to say so, and none is reachable.)
 *   REFUSED    Is the connection verified? (`no-provider-verifier` — no verifier exists.)
 *   REFUSED    May a write happen? (Governance mints permits; nothing here can.)
 *   REFUSED    Does it then run? (action-execution — untouched by this phase.)
 *
 * ── THE CHAIN THIS FILE EXISTS TO KEEP SEPARATE ──────────────────────────────
 *
 *   CREDENTIAL EXISTS ≠ DECRYPTABLE ≠ VERIFIED ≠ CONNECTED ≠ WRITE-CAPABLE ≠ AUTHORIZED ≠ EXECUTED
 *
 * Seven links. INT-2 owns the first two and can express NOTHING beyond them: there is no
 * `verified`, no `connected`, no `writeAuthorized` and no permit field anywhere in this file, so a
 * caller cannot be handed one by mistake and a later edit cannot add one without deleting a test
 * that names its absence.
 *
 * ── THE PUBLIC METADATA CARRIES NO SECRET MATERIAL AT ALL ────────────────────
 *
 * `CredentialMetadata` has no plaintext, no ciphertext, no IV, no auth tag and no key. Not
 * "redacted" — ABSENT. There is no field to forget to strip, which is the only version of this
 * guarantee that survives a refactor. `algorithm` and `keyId` ARE present: they are operational
 * facts a rotation ceremony must be able to see, and neither helps anyone open anything.
 *
 * Pure types and frozen values. No React, no I/O, no database, no clock, no key, no authority.
 */
import type { ConnectionState } from "@/features/integration-authority/contracts";

/** What kind of secret a row holds. Mirrors `integration_credential_kind`. */
export type IntegrationCredentialKind = "oauth_access" | "oauth_refresh" | "api_key";

export const INTEGRATION_CREDENTIAL_KINDS: readonly IntegrationCredentialKind[] = Object.freeze([
  "oauth_access",
  "oauth_refresh",
  "api_key",
]);

export function isCredentialKind(value: string): value is IntegrationCredentialKind {
  return (INTEGRATION_CREDENTIAL_KINDS as readonly string[]).includes(value);
}

/* ── The additional authenticated data ──────────────────────────────────────── */

/**
 * THE THIRD ISOLATION LAYER, and the one that travels with the ciphertext.
 *
 * The AAD binds a sealed secret to the identity of the row that holds it. A ciphertext physically
 * copied into another tenant's row — by a database compromise, a bad backup restore, or a bug —
 * fails to decrypt even with the correct key, because the AAD no longer matches.
 *
 * JSON ARRAY ENCODING, NOT CONCATENATION. `tenant + integration + kind` glued together is
 * ambiguous: two different triples can produce identical bytes, and an attacker who controls any
 * part could shift the boundaries. A JSON array has unambiguous delimiters and escaping, and the
 * leading `"v1"` means a future binding can be introduced without silently reinterpreting rows
 * sealed under this one.
 */
export const CREDENTIAL_AAD_VERSION = "v1" as const;

export function credentialAad(
  tenantId: string,
  integrationId: string,
  kind: IntegrationCredentialKind,
): Buffer {
  return Buffer.from(
    JSON.stringify([CREDENTIAL_AAD_VERSION, tenantId, integrationId, kind]),
    "utf8",
  );
}

/* ── What a caller may read ─────────────────────────────────────────────────── */

/**
 * A credential as any caller sees it.
 *
 * Every field here is safe in a log, a UI and an audit row. The secret is not among them.
 */
export interface CredentialMetadata {
  readonly credentialId: string;
  readonly integrationId: string;
  readonly kind: IntegrationCredentialKind;
  readonly algorithm: string;
  readonly keyId: string;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly destroyedAt: string | null;
  readonly createdAt: string;
  /** `true` when the row is neither revoked nor destroyed. Derived, never stored. */
  readonly live: boolean;
}

/* ── Writing ────────────────────────────────────────────────────────────────── */

/**
 * What a caller may say when supplying a secret.
 *
 * NO tenant, NO actor, NO algorithm, NO key id, NO IV: those are unrepresentable rather than
 * discouraged. Tenant and actor come from an already-resolved server-side `TenantContext`; the
 * algorithm and key are the deployment's, not the caller's; and the IV is generated inside the
 * cipher so nonce reuse cannot be requested.
 */
export interface StoreCredentialInput {
  readonly integrationId: string;
  readonly kind: IntegrationCredentialKind;
  /** The tenant's actual secret. Encrypted before any database state changes, and never stored raw. */
  readonly plaintext: string;
  readonly expiresAt?: Date | null;
}

/** Every way a credential operation can honestly say no. */
export type CredentialRefusal =
  /** Malformed id, unknown kind, empty or over-long secret. */
  | "invalid-input"
  /** No tenant context, no database, or no usable key configuration. */
  | "no-authorized-tenant-context"
  | "persistence-not-configured"
  /** The deployment's key registry is absent or malformed. FAIL CLOSED — never a fallback. */
  | "encryption-not-configured"
  /** Read as nothing. NEVER distinguished from another tenant's row. */
  | "not-found"
  /** The connection is `revoked` or `disconnected`; a terminal record takes no new secrets. */
  | "connection-terminal"
  /** A live credential of this kind already exists. `replace` is the operation for that. */
  | "duplicate-live-credential"
  /** `replace` was asked to replace nothing. */
  | "no-live-credential"
  /** The row is revoked or destroyed, so it may not be opened. */
  | "credential-not-live"
  /**
   * The key the ROW names is not registered, or the ciphertext did not authenticate. One reason
   * for a wrong key, a tampered ciphertext, a tampered tag and an AAD mismatch, because GCM cannot
   * tell them apart and a guess would be invented information.
   */
  | "decryption-failed";

export const CREDENTIAL_LIMITS = {
  /**
   * 8 KiB. Comfortably above any real OAuth token or API key, and far below a size at which a
   * "credential" field becomes a place to put a file.
   */
  plaintextMaxLength: 8192,
  /** Bounded so a metadata listing can never become an export. */
  listLimit: 100,
} as const;

export type StoreCredentialResult =
  | {
      readonly status: "stored";
      readonly credential: CredentialMetadata;
      /** What the connection's lifecycle did as a result. `null` when it did not move. */
      readonly connectionState: ConnectionState;
    }
  | { readonly status: "refused"; readonly reason: CredentialRefusal };

export type ReplaceCredentialResult =
  | {
      readonly status: "replaced";
      readonly credential: CredentialMetadata;
      readonly revokedCredentialId: string;
      readonly connectionState: ConnectionState;
    }
  | { readonly status: "refused"; readonly reason: CredentialRefusal };

export type CredentialTransitionResult =
  | { readonly status: "revoked" | "destroyed"; readonly credential: CredentialMetadata }
  | { readonly status: "refused"; readonly reason: CredentialRefusal };

export type CredentialListing =
  | { readonly status: "read"; readonly credentials: readonly CredentialMetadata[] }
  | { readonly status: "unavailable"; readonly reason: CredentialRefusal };

/**
 * The result of a SCOPED use of a decrypted secret.
 *
 * `used` carries WHAT THE CALLBACK RETURNED — never the secret. That is the whole design: the
 * plaintext exists only as an argument to a function the caller passed in, and there is no arm of
 * this type that could carry it back out.
 */
export type ScopedSecretResult<T> =
  | { readonly status: "used"; readonly value: T }
  | { readonly status: "refused"; readonly reason: CredentialRefusal };

/* ── Audit vocabulary ───────────────────────────────────────────────────────── */

/**
 * The `audit_log.action` values INT-2 owns. FOUR — every one of them an act a real human performed
 * through a resolved session, which is what makes an actor available to record.
 *
 * DELIBERATELY ABSENT: an encryption-key-rotation event. `audit_log.actor_id` and `actor_type` are
 * NOT NULL, a terminal ceremony has no human to name, and inventing a `system` actor would
 * attribute a person's act to a principal that does not exist. `provider-connectivity.ts` already
 * refused that trade for the same reason. The rotation's evidence is the `key_id` movement on the
 * rows themselves, which is durable and countable; a real platform principal is a later phase.
 *
 * ALSO ABSENT: a decryption event. A scoped read is not an authority-bearing act, and auditing
 * every one of them would build a precise timeline of when each tenant's secret was in memory.
 */
export const CREDENTIAL_AUDIT_STORED = "integration.credential.stored" as const;
export const CREDENTIAL_AUDIT_REPLACED = "integration.credential.replaced" as const;
export const CREDENTIAL_AUDIT_REVOKED = "integration.credential.revoked" as const;
export const CREDENTIAL_AUDIT_DESTROYED = "integration.credential.destroyed" as const;

/**
 * The `audit_log.entity_type` for credential events.
 *
 * DISTINCT from I1's `integration` on purpose: I1's released contract says exactly two actions
 * exist on that entity type, and a test asserts it. A credential event is about a different row
 * with a different lifecycle, so it gets its own entity type and I1's claim stays true.
 */
export const INTEGRATION_CREDENTIAL_ENTITY_TYPE = "integration_credential" as const;

/** The `audit_log.source` for this domain. */
export const CREDENTIAL_AUDIT_SOURCE = "integration-credentials" as const;
