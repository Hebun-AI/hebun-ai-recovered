/*
 * auth_credentials — the CREDENTIAL authority (D1).
 *
 * Hebun already had an identity authority (users + auth_identities) and a session
 * authority (user_session_contexts). It had no way to represent the thing a human
 * PROVES. This table is that authority and nothing else:
 *
 *   identity   = who this human is           (auth_identities)
 *   credential = what they proved to sign in (HERE)
 *   session    = the proof's durable receipt (user_session_contexts)
 *
 * A credential grants NO authorization. It does not carry a tenant, a membership,
 * or a role, and it never will — those remain the authority of memberships/roles,
 * resolved separately after authentication succeeds. Verifying a credential
 * answers "which human?", never "what may they do?".
 *
 * SECRET MATERIAL. `salt` and `secret_hash` are server-only. Nothing outside the
 * credential repository may select them, and a structural test enforces that they
 * never reach a client component, a product read model, audit metadata, or a log.
 * The plaintext password is never stored, never logged, and never enters a session.
 *
 * ALGORITHM AGILITY. `algorithm` is a free varchar with a FORMAT check rather than
 * an enum, and `params` is jsonb carried per row. That is deliberate: moving to
 * Argon2id later must be a credential-rewrite on next successful sign-in, not a
 * migration and not a redesign. A row states how it was hashed, so rows hashed
 * under different algorithms coexist. The TYPE is an enum because adding a
 * credential class (passkey, TOTP) should be a deliberate schema decision.
 *
 * LOCKOUT. `failed_attempt_count` / `locked_until` live here because Postgres is
 * the only state shared across every server process — a process-local counter
 * would claim a protection that a second process would not honour. Lockout is
 * temporary and bounded: repeated failures must never destroy an account.
 *
 * Uses rootColumns (global, like auth_identities): a credential belongs to a human
 * identity, not to a tenant.
 */
import { sql } from "drizzle-orm";
import {
  char,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { rootColumns } from "./_base";
import {
  actorTypeEnum,
  authCredentialStatusEnum,
  authCredentialTypeEnum,
} from "./_enums";
import { authIdentities } from "./auth-identity";

export const authCredentials = pgTable(
  "auth_credentials",
  {
    ...rootColumns,
    /** The human identity this credential proves. RESTRICT: revoke, never delete. */
    authIdentityId: uuid("auth_identity_id")
      .notNull()
      .references(() => authIdentities.id, { onDelete: "restrict" }),
    credentialType: authCredentialTypeEnum("credential_type")
      .notNull()
      .default("password"),

    /** How this row was hashed. Free-form BY DESIGN so a future algorithm needs no migration. */
    algorithm: varchar("algorithm", { length: 32 }).notNull(),
    /** Cost/shape parameters for `algorithm`, per row, so they can be raised over time. */
    params: jsonb("params").notNull(),
    /** 32 random bytes, hex. Per credential — never shared, never derived from the email. */
    salt: char("salt", { length: 64 }).notNull(),
    /** 64-byte derived key, hex. NOT the password, and not reversible. */
    secretHash: char("secret_hash", { length: 128 }).notNull(),

    status: authCredentialStatusEnum("status").notNull().default("active"),
    passwordChangedAt: timestamp("password_changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),

    /* ── Durable lockout state (shared across processes because the DB is) ── */
    failedAttemptCount: integer("failed_attempt_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),

    /* ── Revocation, mirroring the auth_identities lifecycle convention ── */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByType: actorTypeEnum("revoked_by_type"),
    revokedById: uuid("revoked_by_id"),
    revocationReason: varchar("revocation_reason", { length: 128 }),
  },
  (t) => [
    /* Exactly one ACTIVE credential of a given type per identity. Scoped by type so
     * a future passkey credential can coexist with a password rather than race it. */
    uniqueIndex("auth_credentials_active_identity_type_uq")
      .on(t.authIdentityId, t.credentialType)
      .where(sql`${t.status} = 'active'`),
    index("auth_credentials_identity_idx").on(t.authIdentityId),
    index("auth_credentials_locked_until_idx").on(t.lockedUntil),

    check(
      "auth_credentials_algorithm_chk",
      sql`${t.algorithm} ~ '^[a-z0-9][a-z0-9._-]{0,31}$'`,
    ),
    check("auth_credentials_salt_chk", sql`${t.salt} ~ '^[0-9a-f]{64}$'`),
    check(
      "auth_credentials_secret_hash_chk",
      sql`${t.secretHash} ~ '^[0-9a-f]{128}$'`,
    ),
    check(
      "auth_credentials_failed_attempt_count_chk",
      sql`${t.failedAttemptCount} >= 0`,
    ),
    check(
      "auth_credentials_revocation_actor_chk",
      sql`(${t.revokedByType} is null) = (${t.revokedById} is null)`,
    ),
    /* A revoked credential must say when and why; it can never authenticate again. */
    check(
      "auth_credentials_revoked_chk",
      sql`${t.status} <> 'revoked' or (${t.revokedAt} is not null and ${t.revocationReason} is not null and char_length(btrim(${t.revocationReason})) > 0)`,
    ),
    /* An active credential must carry no revocation residue. */
    check(
      "auth_credentials_active_chk",
      sql`${t.status} <> 'active' or (${t.revokedAt} is null and ${t.revocationReason} is null)`,
    ),
  ],
);
