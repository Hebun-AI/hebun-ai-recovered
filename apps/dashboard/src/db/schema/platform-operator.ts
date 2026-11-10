/**
 * P4 — platform operator authority: the operator's second factor and the operator grant.
 *
 * Design gates: `docs/product-vision/runtime/hebun-p4-operator-principal-design-gate.md` (D1, D3, D7)
 * and `docs/product-vision/runtime/hebun-p4-mfa-design-gate.md`.
 *
 * TWO RECORDS, NEVER MERGED. An MFA credential answers "did this human prove a second factor"; a
 * grant answers "may this human administer the platform". Neither implies the other, and neither is
 * derived from a tenant membership, a role, an email address or an environment value. Platform Admin
 * needs an active grant AND a server-verified MFA on the session (`user_session_contexts`).
 *
 * NO PRODUCT WRITER. Rows here are created and revoked only by the `operator` ceremony
 * (`scripts/operator.ts`), each act audited in the same transaction. The application writes only the
 * verification counters of an MFA credential (replay step, failed attempts, lock).
 *
 * Both tables are global (no tenant column): an operator is a property of a human identity, not of
 * any organization.
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { rootColumns } from "./_base";
import { authIdentities } from "./auth-identity";
import { users } from "./user";

/**
 * One TOTP second factor for one auth identity.
 *
 * The secret is stored only sealed (AES-256-GCM, `secret-encryption`), under the MFA key set and an
 * AAD naming this row, so a sealed secret cannot be replayed into another row. `pending` rows exist
 * between enrollment and the first verified code; only `active` rows can satisfy a challenge.
 */
export const authMfaCredentials = pgTable(
  "auth_mfa_credentials",
  {
    ...rootColumns,
    authIdentityId: uuid("auth_identity_id")
      .notNull()
      .references(() => authIdentities.id, { onDelete: "restrict" }),
    method: varchar("method", { length: 16 }).notNull().default("totp"),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    sealAlgorithm: varchar("seal_algorithm", { length: 32 }).notNull(),
    sealKeyId: varchar("seal_key_id", { length: 32 }).notNull(),
    sealCiphertext: text("seal_ciphertext").notNull(),
    sealIv: text("seal_iv").notNull(),
    sealAuthTag: text("seal_auth_tag").notNull(),
    /** The highest TOTP time step ever accepted. A code is accepted only for a strictly later step. */
    lastAcceptedStep: integer("last_accepted_step").notNull().default(0),
    failedAttemptCount: integer("failed_attempt_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 128 }),
  },
  (t) => [
    uniqueIndex("auth_mfa_credentials_one_active_uq")
      .on(t.authIdentityId)
      .where(sql`${t.status} = 'active'`),
    index("auth_mfa_credentials_identity_idx").on(t.authIdentityId),
    check("auth_mfa_credentials_method_chk", sql`${t.method} in ('totp')`),
    check("auth_mfa_credentials_status_chk", sql`${t.status} in ('pending', 'active', 'revoked')`),
    check("auth_mfa_credentials_seal_algorithm_chk", sql`${t.sealAlgorithm} in ('aes-256-gcm')`),
    check("auth_mfa_credentials_step_chk", sql`${t.lastAcceptedStep} >= 0`),
    check("auth_mfa_credentials_failed_attempt_chk", sql`${t.failedAttemptCount} >= 0`),
    check(
      "auth_mfa_credentials_active_chk",
      sql`${t.status} <> 'active' or (${t.activatedAt} is not null and ${t.revokedAt} is null)`,
    ),
    check(
      "auth_mfa_credentials_revoked_chk",
      sql`(${t.status} = 'revoked') = (${t.revokedAt} is not null) and (${t.revokedAt} is null) = (${t.revocationReason} is null)`,
    ),
  ],
);

/**
 * The operator grant (P4 D1-A): bound to an auth identity, never to a membership or role.
 *
 * At most one active grant per identity. A revoked grant is kept as history and stops every admin
 * request on the next request, because the guard reads this row on every request.
 */
export const platformOperatorGrants = pgTable(
  "platform_operator_grants",
  {
    ...rootColumns,
    authIdentityId: uuid("auth_identity_id")
      .notNull()
      .references(() => authIdentities.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 16 }).notNull().default("active"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
    /** The verified human who performed the grant ceremony. */
    grantedByUserId: uuid("granted_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    grantReason: text("grant_reason").notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByUserId: uuid("revoked_by_user_id").references(() => users.id, { onDelete: "restrict" }),
    revocationReason: text("revocation_reason"),
  },
  (t) => [
    uniqueIndex("platform_operator_grants_one_active_uq")
      .on(t.authIdentityId)
      .where(sql`${t.status} = 'active'`),
    index("platform_operator_grants_identity_idx").on(t.authIdentityId),
    check("platform_operator_grants_status_chk", sql`${t.status} in ('active', 'revoked')`),
    check("platform_operator_grants_reason_chk", sql`length(trim(${t.grantReason})) > 0`),
    check(
      "platform_operator_grants_revoked_chk",
      sql`(${t.status} = 'revoked') = (${t.revokedAt} is not null) and (${t.revokedAt} is null) = (${t.revokedByUserId} is null) and (${t.revokedAt} is null) = (${t.revocationReason} is null)`,
    ),
  ],
);
