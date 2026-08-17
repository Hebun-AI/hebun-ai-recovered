/*
 * Company = tenant root. Every other tenant-owned row references companies.id
 * via tenantColumns. Uses rootColumns (a company is not owned by another tenant).
 *
 * ── R4A: WHICH ROOT PRODUCED THIS TENANT ─────────────────────────────────────
 *
 * `provisioning_source` records the CEREMONY that created the row, and nothing else.
 *
 * It exists because tenant birth writes no `audit_log` entry and cannot: `actor_type` and
 * `actor_id` are both NOT NULL there, and a local operator ceremony has no actor to name —
 * possession of the deployment is not an identity. `created_by` therefore stays NULL, which is the
 * truthful value and also the value fixture-seeded rows carry, so without this column a
 * ceremony-born tenant would be indistinguishable from a seeded one. The row is the only evidence
 * the ceremony leaves, so the row has to carry it.
 *
 * READ IT AS A LIMITATION, NOT A CREDENTIAL — the same reading `genesis_nominations.nomination_source`
 * asks for, and deliberately the same vocabulary. It says WHICH root acted, never WHO operated it.
 *
 * NULL is meaningful, not merely permitted: it means no ceremony created this row. The two rows
 * seeded by `scripts/r1-seed.mjs` are exactly that, so the column is nullable and no backfill
 * invents a history they do not have.
 */

import { check, pgTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { rootColumns } from "./_base";
import { organizations } from "./organization";
import { departments } from "./department";
import { agents } from "./agent";
import { registries } from "./registry";
import { tenantStatusEnum } from "./_enums";

export const companies = pgTable(
  "companies",
  {
    ...rootColumns,
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    plan: text("plan").notNull().default("free"),
    tenantStatus: tenantStatusEnum("tenant_status"),
    tenantStatusChangedAt: timestamp("tenant_status_changed_at", { withTimezone: true }),
    suspendedAt: timestamp("suspended_at", { withTimezone: true }),
    suspensionReason: varchar("suspension_reason", { length: 256 }),
    authenticationDisabledAt: timestamp("authentication_disabled_at", {
      withTimezone: true,
    }),
    deletingAt: timestamp("deleting_at", { withTimezone: true }),

    /** Which ceremony created this tenant. See the header, and the constant below. */
    provisioningSource: varchar("provisioning_source", { length: 64 }),
  },
  (t) => [
    uniqueIndex("companies_slug_uq").on(t.slug),

    /*
     * Only roots that exist may be named. Widening this is a deliberate schema decision, exactly as
     * `genesis_nominations_source_chk` records for its own vocabulary.
     *
     * The literal is written inline rather than interpolated from the constant below: drizzle-kit
     * renders an interpolated value as a bind parameter, which is not valid inside a CHECK in a
     * migration file. A test asserts the two stay in agreement.
     */
    check(
      "companies_provisioning_source_chk",
      sql`${t.provisioningSource} is null or ${t.provisioningSource} = 'local-operator-ceremony'`,
    ),
  ]
);

/**
 * The only value `provisioning_source` may hold today.
 *
 * A local operator ceremony — possession of the local deployment. NOT a verified platform admin,
 * NOT a certified operator, NOT a Governance authority. It shares its wording with
 * `GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR` because it names the same root and carries the same
 * limitation; introducing a real operator identity later means adding a value here.
 */
export const COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony";

/* Ownership relations that are already certain. */
export const companiesRelations = relations(companies, ({ many }) => ({
  organizations: many(organizations),
  departments: many(departments),
  agents: many(agents),
  registries: many(registries),
}));
