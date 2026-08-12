/* Invitation-first onboarding foundation. Token material is represented only by
 * a versioned HMAC digest; no plaintext credential column exists. */
import { sql } from "drizzle-orm";
import {
  char,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum, invitationStatusEnum } from "./_enums";
import { companies } from "./company";
import { organizations } from "./organization";
import { roles } from "./role";
import { users } from "./user";

export const invitations = pgTable(
  "invitations",
  {
    ...tenantColumns,
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => companies.id, { onDelete: "restrict" }),
    normalizedEmail: varchar("normalized_email", { length: 320 }).notNull(),
    intendedRoleId: uuid("intended_role_id").notNull(),
    organizationId: uuid("organization_id"),
    inviterType: actorTypeEnum("inviter_type").notNull(),
    inviterId: uuid("inviter_id").notNull(),
    tokenHash: char("token_hash", { length: 64 }).notNull(),
    tokenVersion: integer("token_version").notNull().default(1),
    status: invitationStatusEnum("status").notNull().default("pending"),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByType: actorTypeEnum("revoked_by_type"),
    revokedById: uuid("revoked_by_id"),
    revocationReason: varchar("revocation_reason", { length: 128 }),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
    sendCount: integer("send_count").notNull().default(0),
  },
  (t) => [
    /*
     * I1.2 (B-5) — THE COMPANION UNIQUENESS. Carries no new product truth: `id` is already the
     * primary key, so this pair is unique by construction. It exists because Postgres requires an
     * explicit unique constraint on the exact referenced column list before another table may
     * declare a composite foreign key `(tenant_id, invitation_id) → invitations(tenant_id, id)`.
     *
     * That composite FK is what makes "a Tenant A enrollment citing a Tenant B invitation" a
     * database error rather than a server-side check somebody can forget. `memberships`, `roles`
     * and `organizations` already carry the identical companion for the identical reason.
     */
    unique("invitations_tenant_id_id_uq").on(t.tenantId, t.id),

    uniqueIndex("invitations_token_hash_uq").on(t.tokenHash),
    uniqueIndex("invitations_pending_email_uq")
      .on(t.tenantId, t.normalizedEmail)
      .where(sql`${t.status} = 'pending'`),
    index("invitations_tenant_status_expiry_idx").on(
      t.tenantId,
      t.status,
      t.expiresAt,
    ),
    index("invitations_accepted_user_idx").on(t.acceptedByUserId),
    index("invitations_role_idx").on(t.intendedRoleId),
    index("invitations_organization_idx").on(t.organizationId),
    foreignKey({
      name: "invitations_tenant_role_fk",
      columns: [t.tenantId, t.intendedRoleId],
      foreignColumns: [roles.tenantId, roles.id],
    }).onDelete("restrict"),
    foreignKey({
      name: "invitations_tenant_organization_fk",
      columns: [t.tenantId, t.organizationId],
      foreignColumns: [organizations.tenantId, organizations.id],
    }).onDelete("restrict"),
    check(
      "invitations_normalized_email_chk",
      sql`${t.normalizedEmail} = lower(btrim(${t.normalizedEmail})) and char_length(${t.normalizedEmail}) > 0`,
    ),
    check("invitations_token_hash_chk", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
    check("invitations_token_version_chk", sql`${t.tokenVersion} > 0`),
    check("invitations_send_count_chk", sql`${t.sendCount} >= 0`),
    check("invitations_expiry_chk", sql`${t.expiresAt} > ${t.issuedAt}`),
    check(
      "invitations_revocation_actor_chk",
      sql`(${t.revokedByType} is null) = (${t.revokedById} is null)`,
    ),
    check(
      "invitations_accepted_chk",
      sql`${t.status} <> 'accepted' or (${t.acceptedAt} is not null and ${t.acceptedByUserId} is not null)`,
    ),
    check(
      "invitations_revoked_chk",
      sql`${t.status} <> 'revoked' or (${t.revokedAt} is not null and ${t.revocationReason} is not null and char_length(btrim(${t.revocationReason})) > 0)`,
    ),
  ],
);
