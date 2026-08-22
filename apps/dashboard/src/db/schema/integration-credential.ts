/*
 * integration_credentials — A TENANT'S PROVIDER SECRET, AT REST (INT-2).
 *
 * ── WHAT ONE ROW MEANS ───────────────────────────────────────────────────────
 *
 * "This tenant supplied a secret of this kind for this connection, and Hebun holds it sealed."
 *
 * That is all. A row asserts NO verification, NO capability and NO authorization. It does not mean
 * the secret is correct, that the provider would accept it, or that anything may be done with it.
 * `integrations.connection_state` remains the only statement about the connection, and storing a
 * credential moves it to `unverified` — never to `connected`.
 *
 * ── WHY A SEPARATE TABLE AND NOT COLUMNS ON `integrations` ───────────────────
 *
 * Three reasons, and the first is decisive: a metadata read must never be able to touch a secret.
 * `SELECT * FROM integrations` is written all over a codebase's lifetime; if the ciphertext lived
 * there, every one of those reads would carry it. Here the only module that names these columns is
 * the credential repository, and a test enumerates the files allowed to mention them.
 *
 * Second, one connection legitimately holds MORE THAN ONE secret — an OAuth access token and the
 * refresh token that renews it — with different lifetimes. Columns cannot express that; rows can.
 *
 * Third, lifecycles differ. A credential is replaced many times over a connection's life, and each
 * replacement must leave a record of when the previous one stopped being live.
 *
 * ── WHAT IS STORED, AND WHAT IS NOT ──────────────────────────────────────────
 *
 * Stored: the algorithm, the key id, the ciphertext, the IV and the auth tag — everything needed
 * to decrypt GIVEN the key, and nothing that helps without it.
 *
 * NOT STORED, and this is a deliberate reversal of an earlier design: NO FINGERPRINT of the
 * plaintext. A digest of the secret sitting beside the ciphertext is an ORACLE — it lets anyone
 * holding a database dump confirm a guessed secret without ever having the key, which collapses
 * the exact threat case ("database stolen, key not stolen") that encrypting it is for. It bought
 * no invariant here: uniqueness comes from the partial index, rotation from `key_id`, and
 * verification is a provider's job. So it does not exist.
 *
 * Also absent: no `scopes` (the connection owns those), no provider payload, no refresh cursor, no
 * `last_used_at` (nothing uses a credential in INT-2, and a column no writer sets is a lie waiting).
 *
 * ── STRUCTURAL TENANT ISOLATION ──────────────────────────────────────────────
 *
 * The foreign key is COMPOSITE — `(tenant_id, integration_id)` against `integrations(tenant_id,
 * id)` — so a credential naming another tenant's connection is a DATABASE ERROR, not a bug
 * somebody has to notice in review. I1 created `integrations_id_tenant_uq` for exactly this, one
 * phase before it was needed.
 *
 * That is the second of three independent layers. The first is the application's tenant predicate;
 * the third is the AES-GCM additional authenticated data, which binds the ciphertext itself to
 * `(tenant, integration, kind)` so a row physically moved between tenants does not decrypt either.
 * Each layer has its own bite-proof, because a layer nobody proved is a layer nobody has.
 *
 * ── DESTRUCTION IS A FACT, NOT A FLAG ────────────────────────────────────────
 *
 * `destroyed_at` alone would be a claim. `integration_credentials_destroyed_empty_chk` makes it
 * true: a destroyed row's ciphertext, IV and tag are the empty string, so there is nothing left to
 * decrypt even for someone holding every key. Destruction also implies revocation, because a
 * destroyed-but-live credential is a state no reader could interpret.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum, integrationCredentialKindEnum } from "./_enums";
import { integrations } from "./integration";

export const integrationCredentials = pgTable(
  "integration_credentials",
  {
    ...tenantColumns,

    /** The connection this secret belongs to. Bound COMPOSITELY below, never by id alone. */
    integrationId: uuid("integration_id").notNull(),

    kind: integrationCredentialKindEnum("kind").notNull(),

    /**
     * How this row was sealed. FREE-FORM BY DESIGN, exactly as `auth_credentials.algorithm` is:
     * decryption dispatches on the STORED value, so a future algorithm needs a producer and not a
     * migration, and an old row keeps opening under the algorithm that actually sealed it.
     */
    algorithm: varchar("algorithm", { length: 32 }).notNull(),

    /** Which registered deployment key sealed it. The row remembers; the process never guesses. */
    keyId: varchar("key_id", { length: 32 }).notNull(),

    /** base64. Meaningless without the key named above. */
    ciphertext: text("ciphertext").notNull(),
    /** base64 of 12 random bytes — fresh for every encryption, never reused, never chosen. */
    iv: text("iv").notNull(),
    /** base64 of the 16-byte GCM tag. Tampering makes decryption FAIL rather than mislead. */
    authTag: text("auth_tag").notNull(),

    /**
     * When the PROVIDER says this secret stops working. Nullable because an API key usually has no
     * expiry, and inventing one would make Hebun refuse a working credential.
     */
    expiresAt: timestamp("expires_at", { withTimezone: true }),

    /* ── End of life, mirroring the auth_credentials revocation convention ── */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by"),
    revokedByType: actorTypeEnum("revoked_by_type"),
    destroyedAt: timestamp("destroyed_at", { withTimezone: true }),
  },
  (t) => [
    /**
     * STRUCTURAL TENANT BINDING. `restrict`: a connection with credentials is not deletable out
     * from under them, and nothing in this repository deletes an `integrations` row anyway.
     */
    foreignKey({
      name: "integration_credentials_tenant_integration_fk",
      columns: [t.tenantId, t.integrationId],
      foreignColumns: [integrations.tenantId, integrations.id],
    }).onDelete("restrict"),

    /**
     * ONE LIVE CREDENTIAL PER KIND, PER CONNECTION. Partial, so the whole history of replaced and
     * destroyed credentials stays queryable underneath the one that is current.
     *
     * This index is why replacement REVOKES BEFORE IT INSERTS: PostgreSQL checks a unique index
     * per statement, so an insert-then-revoke ordering would violate it inside the transaction.
     * The ordering is not a preference — the constraint decides it.
     */
    uniqueIndex("integration_credentials_live_kind_uq")
      .on(t.tenantId, t.integrationId, t.kind)
      .where(sql`revoked_at is null and destroyed_at is null`),

    index("integration_credentials_tenant_integration_idx").on(t.tenantId, t.integrationId),
    /** Rotation asks exactly this question: which rows are still on the old key? */
    index("integration_credentials_key_id_idx").on(t.keyId),

    /** Both-or-neither actor attribution — the invariant five other tables already carry. */
    check(
      "integration_credentials_revoked_actor_chk",
      sql`(${t.revokedByType} is null) = (${t.revokedBy} is null)`,
    ),
    /** A destroyed credential that was never revoked is a state no reader could interpret. */
    check(
      "integration_credentials_destroyed_revoked_chk",
      sql`${t.destroyedAt} is null or ${t.revokedAt} is not null`,
    ),
    /**
     * DESTRUCTION IS REAL. A destroyed row holds no ciphertext, no IV and no tag; a live row holds
     * all three. Stated as one biconditional so neither half can drift from the other.
     */
    check(
      "integration_credentials_destroyed_empty_chk",
      sql`(${t.destroyedAt} is not null) = (${t.ciphertext} = '' and ${t.iv} = '' and ${t.authTag} = '')`,
    ),
    check(
      "integration_credentials_key_id_chk",
      sql`${t.keyId} ~ '^[a-z0-9][a-z0-9._-]{0,31}$'`,
    ),
    check(
      "integration_credentials_algorithm_chk",
      sql`${t.algorithm} ~ '^[a-z0-9][a-z0-9._-]{0,31}$'`,
    ),
  ],
);
