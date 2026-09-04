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
      sql`${t.provisioningSource} is null or ${t.provisioningSource} = 'local-operator-ceremony' or ${t.provisioningSource} = 'production-operator-ceremony'`,
    ),
  ]
);

/**
 * A local operator ceremony — possession of the LOCAL deployment. NOT a verified platform admin,
 * NOT a certified operator, NOT a Governance authority. It shares its wording with
 * `GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR` because it names the same root and carries the same
 * limitation.
 */
export const COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony";

/**
 * A production operator ceremony — possession of the PRODUCTION deployment.
 *
 * G1 widened the vocabulary because the CHECK above admitted only the local root, so a
 * production-born tenant could not be recorded truthfully: it would have had to claim it was
 * produced by a local ceremony, or violate the constraint. `provisioning_source` is the ONLY
 * evidence a ceremony leaves — tenant birth writes no `audit_log` row and cannot, because
 * `actor_id` and `actor_type` are both NOT NULL there — so a wrong value is a permanent lie in the
 * one place the truth is kept.
 *
 * It carries EXACTLY the limitation its local sibling carries, and changes one morpheme for one
 * reason: it names a different deployment, never a different KIND of authority. Still possession,
 * still a SOURCE and not an ACTOR, still no verified human. NOT a platform admin, NOT a platform
 * operator, NOT an operator identity, NOT a Governance authority. No such principal exists.
 *
 * **G1 ADDED VOCABULARY ONLY. G4 BUILT THE CEREMONY G1 SAID A LATER GATE WOULD BUILD.**
 *
 * When this constant landed there was no writer for it, and this paragraph said so. That is now
 * history rather than current truth, and it is restated here because a schema comment that
 * describes a value as unreachable is exactly the comment an operator reads before pointing a
 * ceremony at production.
 *
 * What G4 added is a POSTURE, resolved by `scripts/lib/production-possession.ts` and applied by
 * `scripts/lib/ceremony-preflight.ts`. A ceremony records this root only when all of the following
 * hold, and every one of them fails closed:
 *
 *   - `HEBUN_PRODUCTION_CEREMONY` is EXACTLY `production-operator-ceremony` — no trim, no case
 *     folding; anything else is REFUSED and is never downgraded to the local root;
 *   - the target is pinned by `HEBUN_PRODUCTION_TARGET_SYSTEM_IDENTIFIER` and
 *     `HEBUN_PRODUCTION_TARGET_DATABASE`, and the connected database must match both;
 *   - the database is NON-LOCAL. In production posture a loopback URL is refused — the opposite of
 *     the local posture's guard, not the same one;
 *   - the target's own `companies_provisioning_source_chk` is probed and must already admit this
 *     value, so a ceremony can never record a root the database cannot express.
 *
 * WHAT DID NOT CHANGE, AND IS STILL ASSERTED BY TESTS. Nothing under `src/` writes `companies`, and
 * nothing under `src/` may even name this literal except a schema module that declares it. The
 * writer lives under `scripts/`, which `tsconfig.json` cannot resolve from a server action, a route
 * or a component. Possession is still a SOURCE and never an ACTOR: `created_by` stays NULL, no
 * `audit_log` row is written, and this column remains the only evidence the ceremony leaves.
 */
export const COMPANY_PROVISIONING_SOURCE_PRODUCTION_OPERATOR = "production-operator-ceremony";

/* Ownership relations that are already certain. */
export const companiesRelations = relations(companies, ({ many }) => ({
  organizations: many(organizations),
  departments: many(departments),
  agents: many(agents),
  registries: many(registries),
}));
