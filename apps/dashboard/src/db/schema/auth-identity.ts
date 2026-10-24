/* Provider-neutral authentication identities. Authentication remains disabled;
 * these rows only establish the future canonical identity mapping contract. */
import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { rootColumns } from "./_base";
import { actorTypeEnum, authIdentityStatusEnum } from "./_enums";
import { authEmailChallenges } from "./auth-email-challenge";
import { users } from "./user";

export const authIdentities = pgTable(
  "auth_identities",
  {
    ...rootColumns,
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    provider: varchar("provider", { length: 64 }).notNull(),
    issuer: varchar("issuer", { length: 2048 }).notNull(),
    subject: varchar("subject", { length: 512 }).notNull(),
    status: authIdentityStatusEnum("status").notNull().default("pending"),
    isPrimary: boolean("is_primary").notNull().default(false),
    firstAuthenticatedAt: timestamp("first_authenticated_at", { withTimezone: true }),
    lastAuthenticatedAt: timestamp("last_authenticated_at", { withTimezone: true }),
    linkedAt: timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByType: actorTypeEnum("revoked_by_type"),
    revokedById: uuid("revoked_by_id"),
    revocationReason: varchar("revocation_reason", { length: 128 }),
    /*
     * AUTH-EMAIL-OWNERSHIP-1. PROVEN mailbox ownership, kept apart from `verified_at` on purpose.
     *
     * `verified_at` is required by `auth_identities_active_chk` for every active identity and has
     * always been written at admission — signup, invitation enrollment and the bootstrap ceremony —
     * without anyone reading a message at the address. It therefore means "admitted" and is never
     * read as proof. These two columns are the proof: set together, only by consuming a challenge the
     * identity's own session presented, and NULL for every identity that has not done that.
     */
    emailOwnershipVerifiedAt: timestamp("email_ownership_verified_at", { withTimezone: true }),
    emailOwnershipChallengeId: uuid("email_ownership_challenge_id").references(
      (): AnyPgColumn => authEmailChallenges.id,
      { onDelete: "restrict" },
    ),
  },
  (t) => [
    uniqueIndex("auth_identities_provider_issuer_subject_uq").on(
      t.provider,
      t.issuer,
      t.subject,
    ),
    uniqueIndex("auth_identities_primary_user_uq")
      .on(t.userId)
      .where(sql`${t.isPrimary} = true`),
    index("auth_identities_user_idx").on(t.userId),
    index("auth_identities_status_idx").on(t.status),
    check(
      "auth_identities_provider_chk",
      sql`${t.provider} ~ '^[a-z0-9][a-z0-9._-]{0,63}$'`,
    ),
    check(
      "auth_identities_issuer_subject_chk",
      sql`char_length(${t.issuer}) > 0 and ${t.issuer} = btrim(${t.issuer}) and char_length(${t.subject}) > 0 and ${t.subject} = btrim(${t.subject})`,
    ),
    check(
      "auth_identities_revocation_actor_chk",
      sql`(${t.revokedByType} is null) = (${t.revokedById} is null)`,
    ),
    check(
      "auth_identities_active_chk",
      sql`${t.status} <> 'active' or (${t.verifiedAt} is not null and ${t.revokedAt} is null and ${t.lifecycleStatus} = 'active')`,
    ),
    check(
      "auth_identities_revoked_chk",
      sql`${t.status} <> 'revoked' or (${t.revokedAt} is not null and ${t.revocationReason} is not null and char_length(btrim(${t.revocationReason})) > 0 and ${t.isPrimary} = false)`,
    ),
    check(
      "auth_identities_non_revoked_chk",
      sql`${t.status} = 'revoked' or (${t.revokedAt} is null and ${t.revocationReason} is null)`,
    ),
    check(
      "auth_identities_primary_active_chk",
      sql`${t.isPrimary} = false or ${t.status} = 'active'`,
    ),
    check(
      "auth_identities_auth_time_chk",
      sql`${t.firstAuthenticatedAt} is null or ${t.lastAuthenticatedAt} is null or ${t.firstAuthenticatedAt} <= ${t.lastAuthenticatedAt}`,
    ),
    check(
      "auth_identities_revoked_time_chk",
      sql`${t.revokedAt} is null or ${t.revokedAt} >= ${t.linkedAt}`,
    ),
    check(
      "auth_identities_email_ownership_pair_chk",
      sql`(${t.emailOwnershipVerifiedAt} is null) = (${t.emailOwnershipChallengeId} is null)`,
    ),
  ],
);
