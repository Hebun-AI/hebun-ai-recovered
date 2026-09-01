/*
 * Department placements — WHICH DEPARTMENT A HUMAN WORKS IN.
 *
 * ── THE GAP THIS CLOSES, AS THE REPOSITORY ITSELF STATED IT ──────────────────
 *
 * Five released modules recorded this absence as a MEASUREMENT rather than an omission:
 *
 *   `live-map/contracts.ts`      "membership carries no departmental placement"
 *                                "human -> department  … `roles` carries no `organization_id`"
 *   `live-map/read-live-map…`    the same, twice, as the reason no human node is drawn
 *   `heby-work-source.server`    "DEPARTMENT REF != THE HUMAN BELONGS TO THAT DEPARTMENT"
 *
 * That last sentence exists ONLY because this table did not. WORK-1 gave a work item a department
 * and an accountable human, and the grounding then had to say out loud that the two facts are not
 * one fact. They are still not — and now the missing one can be recorded instead of disclaimed.
 *
 * ── WHY A TABLE AND NOT A COLUMN ON `memberships` ────────────────────────────
 *
 * A `memberships.department_id` column was the obvious shape, and it is REFUSED on security
 * grounds. `write-structure.server.ts` states, and a firewall asserts over its real import graph,
 * that the Organization Structure Authority "never writes … `memberships`" — the row a session
 * reads to build a `TenantContext`. Putting placement on that row would force the structural
 * authority to hold a handle on the session's own record. The firewall is not an obstacle here; it
 * is naming the boundary correctly, so the fact moves to its own table and the session row stays
 * unreachable from structural writes.
 *
 *     A SEPARATE FACT WITH A SEPARATE BLAST RADIUS.
 *
 * ── TENANT SAFETY IS STRUCTURAL, NOT CHECKED ─────────────────────────────────
 *
 * `(tenant_id, department_id)` references `departments (tenant_id, id)`, which is exactly why
 * `departments_tenant_id_uq` was created — its own header says so. The pattern is already used by
 * `agents`, `work_items`, `action_permits` and `work_artifacts`. A placement naming another
 * organization's department is not refused by this repository; PostgreSQL cannot represent it.
 *
 * The human side is a plain `users` reference, matching `memberships.user_id`. It deliberately does
 * NOT reference `memberships`: a placement records where somebody works, and a membership can be
 * revoked while the record that they worked there must survive — the same reason
 * `departments.owner_actor_id` keeps naming a departed owner. Standing is DERIVED on read, never
 * destroyed on write.
 *
 * ── ONE ACTIVE PLACEMENT PER HUMAN, AND NO MORE THAN THAT ────────────────────
 *
 * The partial unique index is on `lifecycle_status = 'active'`, the shape
 * `departments_tenant_slug_active_uq` and the credential authority already use for the same reason:
 * a withdrawn placement must not permanently reserve the person. It is also the CONCURRENCY
 * guarantee — two simultaneous placements of one human produce one commit and one
 * `unique_violation`, so the writer needs no table lock.
 *
 * Multi-department placement, nesting, teams, reporting lines and managers are ABSENT rather than
 * guarded, which is the stronger claim: no caller can reach a concept that was never written.
 *
 * ── WHAT A PLACEMENT IS NOT ──────────────────────────────────────────────────
 *
 *     PLACEMENT != ROLE            PLACEMENT != AUTHORITY        PLACEMENT != PERMISSION
 *     PLACEMENT != REPORTING LINE  PLACEMENT != MANAGER          PLACEMENT != TEAM
 *     PLACEMENT != WORK ASSIGNMENT PLACED    != ACTIVE MEMBER    PLACED    != OBSERVED
 *
 * Nothing in this repository reads this table to decide anything. It publishes a recorded fact, and
 * a recorded fact is not an authorization.
 */
import { sql } from "drizzle-orm";
import { foreignKey, pgTable, uniqueIndex, uuid, index } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { departments } from "./department";
import { users } from "./user";

export const departmentPlacements = pgTable(
  "department_placements",
  {
    ...tenantColumns,

    /**
     * THE HUMAN. A plain `users` reference, and never an actor pair.
     *
     * `departments.owner_actor_id` is polymorphic because an owner is an ATTRIBUTION and the schema
     * left room for a non-human one before a CHECK closed it. Placement has no such ambiguity: an
     * agent does not work in a department, it is assigned to one through `agents.department_id`,
     * which Agent Identity owns. A single-typed column makes the agent case unrepresentable rather
     * than merely refused.
     */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),

    /** The department they are recorded as working in. NOT NULL: an unplaced human has no row. */
    departmentId: uuid("department_id").notNull(),
  },
  (t) => [
    /* The composite anchor, so a later table can reference a placement tenant-safely. */
    uniqueIndex("department_placements_tenant_id_uq").on(t.tenantId, t.id),

    /**
     * THE TENANT-SAFE DEPARTMENT REFERENCE. See the header: this is why
     * `departments_tenant_id_uq` exists, and `restrict` matches every sibling department reference.
     */
    foreignKey({
      name: "department_placements_tenant_department_fk",
      columns: [t.tenantId, t.departmentId],
      foreignColumns: [departments.tenantId, departments.id],
    }).onDelete("restrict"),

    /** ONE ACTIVE PLACEMENT PER HUMAN PER TENANT. Partial, for the reason in the header. */
    uniqueIndex("department_placements_tenant_user_active_uq")
      .on(t.tenantId, t.userId)
      .where(sql`${t.lifecycleStatus} = 'active'`),

    /** The read is "who works in this department", so it is indexed the way it is asked. */
    index("department_placements_tenant_department_idx").on(t.tenantId, t.departmentId),
  ],
);
