/* Memberships — many-to-many join of users to companies with a role.
 *
 * S5 adds ADDITIVE authority/lifecycle fields (all nullable). Existing userId/
 * roleId relationships and the (tenantId,userId) unique index are UNCHANGED.
 * `delegatedBy*` is the canonical actor pair (S2) — the actor who granted this
 * membership/authority; no cross-table FK. Membership version comes from
 * tenantColumns.version. */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum, membershipStatusEnum } from "./_enums";
import { invitations } from "./invitation";
import { users } from "./user";
import { roles } from "./role";

export const memberships = pgTable(
  "memberships",
  {
    ...tenantColumns,
    userId: uuid("user_id").notNull().references(() => users.id),
    roleId: uuid("role_id").references(() => roles.id),

    /* ── S5 additive authority/lifecycle ── */
    effectiveFrom: timestamp("effective_from", { withTimezone: true }),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    /** Actor who granted/delegated this membership (canonical pair; no FK). */
    delegatedByType: actorTypeEnum("delegated_by_type"),
    delegatedById: uuid("delegated_by_id"),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    /** Optional narrowing of authority within the tenant (e.g. a scope key). */
    authorityScope: text("authority_scope"),
    status: membershipStatusEnum("status"),
    statusChangedAt: timestamp("status_changed_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedByType: actorTypeEnum("revoked_by_type"),
    revokedById: uuid("revoked_by_id"),
    revocationReason: varchar("revocation_reason", { length: 128 }),
    acceptedInvitationId: uuid("accepted_invitation_id").references(
      () => invitations.id,
      { onDelete: "restrict" },
    ),
  },
  (t) => [
    uniqueIndex("memberships_tenant_user_uq").on(t.tenantId, t.userId),
    unique("memberships_tenant_id_id_uq").on(t.tenantId, t.id),
    unique("memberships_accepted_invitation_uq").on(t.acceptedInvitationId),

    /*
     * ── THE MEMBERSHIP–ROLE TENANT INVARIANT ──────────────────────────────────
     *
     * A membership's role must belong to the SAME tenant as the membership. Enforced by pairing the
     * tenant with the role in one relational fact, rather than by two independent single-column
     * foreign keys that each happen to point somewhere valid.
     *
     * WHY THE DATABASE AND NOT THE SERVER. This schema had already answered the question three times
     * for the same parent columns — `invitations_tenant_role_fk`, `membership_authorizations_tenant_role_fk`
     * and `role_permissions_tenant_role_fk` all reference `roles (tenant_id, id)`. Every table that
     * INTENDS a role was structurally unable to name another tenant's; only `memberships` — the row a
     * session actually reads to build a `TenantContext` — was not. A `findRoleForTenant` helper exists
     * in the auth repository and is called by nothing, which is the repository's own recorded answer
     * about which layer this belongs in.
     *
     * ADDITIVE, NOT A REPLACEMENT. `memberships_role_id_roles_id_fk` stays: it constrains a strictly
     * weaker fact, and dropping it would weaken nothing but would remove a constraint this phase was
     * not authorized to remove. The parent side needed no change at all — `roles_tenant_id_id_uq`
     * has existed since the auth identity schema foundation.
     *
     * NULL ROLES ARE STILL LEGAL. The default MATCH SIMPLE semantics exempt a row where any key
     * column is NULL, so a membership with no role behaves exactly as before — which matters,
     * because the session resolver treats `role_id IS NULL` as a refusal, not as an impossibility.
     *
     * ON DELETE restrict matches the three sibling role foreign keys. No CASCADE is introduced.
     */
    foreignKey({
      name: "memberships_tenant_role_fk",
      columns: [t.tenantId, t.roleId],
      foreignColumns: [roles.tenantId, roles.id],
    }).onDelete("restrict"),
    check(
      "memberships_revocation_actor_chk",
      sql`(${t.revokedByType} is null) = (${t.revokedById} is null)`,
    ),
  ],
);
