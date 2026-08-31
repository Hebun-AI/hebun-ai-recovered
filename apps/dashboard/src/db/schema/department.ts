/*
 * departments — the ONE place Hebun records that a part of an organization exists, what it is
 * called, and which human is accountable for it (OSA-1).
 *
 * ── WHAT A ROW MEANS, IN ONE SENTENCE ────────────────────────────────────────
 *
 * "This organization has declared that this part of itself exists, under this name, and this human
 *  is accountable for it."
 *
 * It is STRUCTURE, and structure alone. A department grants nothing and decides nothing:
 *
 *   DEPARTMENT OWNER != GOVERNANCE AUTHORITY
 *   DEPARTMENT OWNER != APPROVER
 *   DEPARTMENT       != ROLE
 *   DEPARTMENT       != TEAM
 *   DEPARTMENT       != TENANT MEMBERSHIP
 *   STRUCTURE        != PERMISSION
 *   UNAVAILABLE      != EMPTY
 *
 * ── WHY THIS TABLE, AND NOT A NEW ONE ────────────────────────────────────────
 *
 * Measured at the OSA-0 architecture gate, not preferred. This table shipped in the very first
 * migration (`20260711173046_foundation_baseline`) and was never written, never read and never
 * populated by any migration — but `agents.department_id` already points at it. Authoring a second
 * structural table would have left this one alive beside it and orphaned that FK, producing exactly
 * the two-sources-of-truth outcome the gate existed to prevent.
 *
 * So the gate chose ACTIVATION WITH ADDITIVE HARDENING, and everything below the column list is
 * that hardening. Nothing here is destructive: no column was dropped, no type changed, and the
 * table was empty when the constraints were added.
 *
 * ── THE FOUR THINGS THE ORIGINAL SHAPE GOT WRONG ─────────────────────────────
 *
 * 1. NO TENANT ANCHOR. Six tables in this repository carry a `(tenant_id, id)` unique index —
 *    `agents`, `heby_action_requests`, `action_permits`, `action_execution_attempts`,
 *    `work_artifacts`, `external_recipients` — precisely so a sibling can carry
 *    `(tenant_id, <fk>)` and have PostgreSQL enforce same-tenant. This table carried NONE, and
 *    `agents.department_id` was therefore a SINGLE-COLUMN FK: the day departments exist, an agent
 *    could be pointed at another tenant's department and the database would not notice. That is
 *    the defect R3B repaired on `action_permits`, and it is repaired here the same way.
 *
 * 2. NO UNIQUENESS AT ALL. The original `pgTable` call had no second argument, so two active
 *    departments could carry the same slug in the same tenant. A slug that does not identify is
 *    not a slug.
 *
 * 3. A SECOND PARENT HIERARCHY. `organization_id` points at `organizations`, a table the OSA-0
 *    forensics classified SEMANTICALLY WRONG: L3 established that the organization IS the tenant
 *    (`companies`), and Heby's `organization` source class is documented as "THE ORGANIZATION THIS
 *    TENANT IS". A second organization concept between `companies` and `departments` would make
 *    "which organization is this department in?" answerable two ways.
 *
 *    The column is NOT dropped — this milestone performs no destructive DDL on a table it is
 *    activating. It is made UNREPRESENTABLE by CHECK instead, which is the stronger claim: a
 *    future writer that tried to populate it would be refused by PostgreSQL rather than merely
 *    frowned upon. `organizations` itself is untouched, unpopulated and still dead.
 *
 * 4. AN UNCONSTRAINED OWNER TYPE. `owner_actor_type` is the canonical polymorphic pair and could
 *    hold `agent`, `system` or `service`. An agent cannot be accountable for a department to a
 *    human organization, so the CHECK below makes that unrepresentable — the `agent_mandates`
 *    shape, for the `agent_mandates` reason.
 *
 * ── WHAT IS DELIBERATELY LEFT ALONE ──────────────────────────────────────────
 *
 * `manager_actor_type` / `manager_actor_id` stay exactly as they were found: unconstrained,
 * unwritten and unexposed. An owner and a manager are two different facts, and only one of them
 * answers a measured question ("who owns Finance?"). OSA-1 writes neither a value nor a constraint
 * there, so a later milestone that needs a manager inherits a clean column rather than one this
 * phase shaped for a purpose it never had.
 *
 * Server-side vocabulary, bounds and refusal codes live in
 * `src/features/organization-authority/structure-contracts.ts`.
 */
import { sql } from "drizzle-orm";
import { check, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum } from "./_enums";
import { organizations } from "./organization";

export const departments = pgTable(
  "departments",
  {
    ...tenantColumns,

    /**
     * LEGACY, AND PERMANENTLY NULL. See §3 of the header and
     * `departments_no_second_parent_chk` below. The reference is kept so the column's meaning stays
     * legible; the CHECK is what makes it inert.
     */
    organizationId: uuid("organization_id").references(() => organizations.id),

    name: text("name").notNull(),
    slug: text("slug").notNull(),

    /**
     * THE ACCOUNTABLE HUMAN, as the canonical polymorphic pair.
     *
     * NULLABLE ON PURPOSE: a department can be recorded before anyone has been made accountable for
     * it, and "no owner has been recorded" is a real organizational state that must stay
     * distinguishable from "the owner is unknown to us". Both halves move together — see
     * `departments_owner_pair_chk` — so a half-written owner is unrepresentable.
     *
     * Ownership is ATTRIBUTION. It grants no permission, no Governance authority, no approval
     * right and no permit, and nothing in this repository reads it to decide anything.
     */
    ownerActorType: actorTypeEnum("owner_actor_type"),
    ownerActorId: uuid("owner_actor_id"),

    /** Untouched by OSA-1. Never written, never exposed, never constrained. See the header. */
    managerActorType: actorTypeEnum("manager_actor_type"),
    managerActorId: uuid("manager_actor_id"),
  },
  (t) => [
    /**
     * THE COMPOSITE-FK ANCHOR, and the repair it exists for.
     *
     * `id` is already the primary key, so this adds no uniqueness the table did not have. It exists
     * so `agents` can carry `(tenant_id, department_id)` and have PostgreSQL enforce that the
     * department named belongs to the SAME tenant as the agent naming it — the pattern
     * `agents_tenant_id_uq`, `action_permits_tenant_id_uq` and `work_artifacts_tenant_id_uq`
     * already establish.
     */
    uniqueIndex("departments_tenant_id_uq").on(t.tenantId, t.id),

    /**
     * ONE ACTIVE DEPARTMENT PER SLUG, PER TENANT — and no more than that.
     *
     * PARTIAL, on `lifecycle_status = 'active'`, which is the shape the credential authority
     * already uses for the same reason: a retired department must not permanently reserve its own
     * name. Retiring "finance" and later recording "finance" again is a legitimate organizational
     * act, and a total unique index would have made it impossible while adding no safety.
     *
     * This index is also the CONCURRENCY guarantee. Two simultaneous creations of the same slug
     * produce one commit and one `unique_violation`; the writer needs no table lock.
     */
    uniqueIndex("departments_tenant_slug_active_uq")
      .on(t.tenantId, t.slug)
      .where(sql`${t.lifecycleStatus} = 'active'`),

    /**
     * THE SECOND PARENT, MADE UNREPRESENTABLE.
     *
     * Not a convention, not a comment, not a firewall test a later commit could edit: an INSERT or
     * UPDATE that populates `organization_id` FAILS. `organizations` stays dead because the
     * database will not let it become alive through this table.
     */
    check("departments_no_second_parent_chk", sql`${t.organizationId} is null`),

    /**
     * A DEPARTMENT IS OWNED BY A HUMAN, OR BY NOBODY YET.
     *
     * A row naming an agent, a system or a service as the accountable party is REJECTED BY
     * POSTGRES, independently of every line of application code. This is where "an agent cannot be
     * accountable for part of a human organization" stops being a sentence and becomes a fact.
     */
    check(
      "departments_human_owner_chk",
      sql`${t.ownerActorType} is null or ${t.ownerActorType} = 'human'`,
    ),

    /**
     * THE PAIR MOVES TOGETHER. "A type with no id" and "an id with no type" are not states this
     * table can hold, in either direction.
     */
    check(
      "departments_owner_pair_chk",
      sql`(${t.ownerActorType} is null) = (${t.ownerActorId} is null)`,
    ),

    /** A department whose name says nothing is not a department. Length bounds live in the writer. */
    check("departments_name_chk", sql`char_length(btrim(${t.name})) > 0`),

    /**
     * THE SLUG IS AN IDENTIFIER, NOT A LABEL. Lowercase alphanumeric words joined by single
     * hyphens, with no leading, trailing or doubled hyphen. Enforced here as well as in the writer
     * because the uniqueness index above is only meaningful if the values it compares are
     * canonical: `Finance`, `finance ` and `finance` must not be three different departments.
     */
    check("departments_slug_chk", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);
