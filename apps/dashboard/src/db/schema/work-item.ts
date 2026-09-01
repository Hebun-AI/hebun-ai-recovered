/*
 * work_items — the ONE place Hebun records that a unit of an organization's WORK exists, what it is
 * called, which part of the organization it belongs to, which human is accountable for it, and what
 * state that human has DECLARED it to be in (WORK-1).
 *
 * ── WHAT A ROW MEANS, IN ONE SENTENCE ────────────────────────────────────────
 *
 * "This organization has declared that this piece of work exists, under this title, belonging to
 *  this part of itself, with this human accountable for it, in the state this human declared."
 *
 * ── THE PIN THAT MATTERS MOST, BECAUSE THE NAMES ARE CLOSE ───────────────────
 *
 *     WORK ITEM != WORK ARTIFACT
 *
 * `work_artifacts` (R3W) holds prepared CONTENT — an operational plan or a message draft — with
 * immutable revisions, so an approval can bind to bytes nobody can change afterwards. A work item
 * is the opposite kind of thing: a COMMITMENT with MUTABLE declared state. They share a word and
 * nothing else, and the WORK-0 gate kept the name rather than renaming, on the released precedent
 * that `decision-records` and `governance` share the word "decision" and are held apart by a loud
 * pin instead of by a euphemism.
 *
 * The rest of the boundary, stated the way OSA-1 states its own:
 *
 *   WORK EXISTS         != WORK DESCRIPTION      (a title is identity; content is work_artifacts)
 *   WORK STATE          != BUSINESS OUTCOME      (declared by a human; never measured)
 *   ACCOUNTABILITY      != PERMISSION            (naming somebody grants them nothing)
 *   DEPARTMENT RELATION != DEPARTMENT OWNERSHIP  (work names a part; it does not own it)
 *   WORK RECORD         != TASK EXECUTION        (no run, no attempt, no retry, no dispatch)
 *   WORK               != KNOWLEDGE              (declared, mutable, unratifiable)
 *   DECLARED COMPLETE   != VERIFIED != SUCCESSFUL != OUTCOME ACHIEVED
 *   UNAVAILABLE         != EMPTY                 (a failed read is not "you have no work")
 *
 * ── WHY A NEW TABLE, AND WHY THAT IS NOT A SECOND SOURCE OF TRUTH ────────────
 *
 * Measured at the WORK-0 architecture gate, not preferred. Eight tables in this schema look like
 * they could host this fact — `tasks`, `goals`, `plans`, `missions`, `workflows`, `commands`,
 * `executions`, `reasoning` — and every one of them has ZERO writers, ZERO readers and ZERO
 * authoritative seams anywhere in the repository. `tasks` in particular has zero indexes, zero
 * CHECK constraints, zero unique constraints and no tenant anchor, so there is no truth there to be
 * second to.
 *
 * The OSA-0 gate activated `departments` rather than authoring a rival, and its DECIDING argument
 * was that `agents.department_id` was a LIVE foreign key a second table would have orphaned. That
 * argument is ABSENT here and points the other way: every inbound reference to the dead work island
 * comes only from other dead tables, so authoring this one orphans nothing.
 *
 * Activating `tasks` would also have imported an execution engine — `task_status` is
 * `pending·running·blocked·completed·failed`, `task_execution_type` includes `scheduled` and
 * `event-driven`, and it carries `retry_policy`, `timeout_policy` and `execution_constraints` —
 * and, through `executions.task_id`, would have made a SECOND execution ledger addressable beside
 * `action_execution_attempts`. That is the outcome the gate existed to prevent.
 *
 * ── THE DEAD STAYS DEAD, BY MECHANISM ────────────────────────────────────────
 *
 * This table declares NO foreign key to any of those eight tables, and a released firewall test
 * asserts that no Organizational Work module imports their schema surfaces. That is the same
 * mechanism `departments_no_second_parent_chk` uses to keep `organizations` dead: not a convention
 * and not a comment, but something a later commit cannot quietly undo.
 *
 * ── WHAT IS DELIBERATELY NOT A COLUMN ────────────────────────────────────────
 *
 * No slug: a department is ADDRESSED by identifier and must be unique, while two work items may
 * legitimately share a title ("Q3 audit", twice, two years apart). So there is no uniqueness
 * constraint on the title and therefore no uniqueness race to defend against.
 *
 * No description, notes or body — that is `work_artifacts`. No priority, urgency, risk, health,
 * percentage progress, due date, dependency, estimate or effort — every one of those is a judgement
 * or a measurement this authority has no mandate to hold, and `goals.goal_health` and
 * `tasks.task_health` are dead for precisely that reason. No `agent_id`. No provider field. No
 * Knowledge field. No outcome field.
 */
import { check, foreignKey, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantColumns } from "./_base";
import { actorTypeEnum, workDeclaredStateEnum } from "./_enums";
import { departments } from "./department";

export const workItems = pgTable(
  "work_items",
  {
    ...tenantColumns,

    /**
     * The work's readable identity — the role `departments.name` plays, and nothing more.
     *
     * UNTRUSTED HUMAN TEXT. It is data on every surface that renders it: never markup, never an
     * instruction, never something to execute. Its length bound lives in the writer's contracts;
     * the database enforces only that it is not blank.
     */
    title: text("title").notNull(),

    /**
     * THE DECLARED STATE — a declaration, never a measurement.
     *
     * NOT NULL with a default, because "work whose state nobody has declared" is not a state this
     * organization can be in: recording work is itself the act of saying it is at least planned.
     */
    declaredState: workDeclaredStateEnum("declared_state").notNull().default("planned"),

    /**
     * THE PART OF THE ORGANIZATION THIS WORK BELONGS TO — optional, and a REFERENCE.
     *
     * Organization Structure Authority owns the department. This column owns only the fact that
     * this work names it. Nullable because an organization can legitimately record work before
     * deciding which part of itself carries it, exactly as a department may exist before anyone is
     * made accountable for it.
     *
     * Same-tenant enforcement is the composite FK below, not this column.
     */
    departmentId: uuid("department_id"),

    /**
     * THE HUMAN ACCOUNTABLE FOR THIS WORK — optional, and a REFERENCE.
     *
     * Identity owns the human; this authority owns only the ASSIGNMENT. The polymorphic actor pair
     * is used rather than a `users` FK for the reason `_base.ts` records, and the CHECKs below make
     * an agent unrepresentable here.
     *
     * ACCOUNTABILITY GRANTS NOTHING. Naming somebody confers no permission, no Governance
     * authority, no approval right and no mandate.
     */
    accountableActorType: actorTypeEnum("accountable_actor_type"),
    accountableActorId: uuid("accountable_actor_id"),
  },
  (t) => [
    /**
     * THE COMPOSITE-FK ANCHOR. `id` is already the primary key, so this adds no uniqueness the
     * table did not have; it exists so a later table can carry `(tenant_id, work_item_id)` and have
     * PostgreSQL enforce same-tenant, the pattern `departments_tenant_id_uq`,
     * `agents_tenant_id_uq`, `action_permits_tenant_id_uq` and `work_artifacts_tenant_id_uq`
     * already establish.
     */
    uniqueIndex("work_items_tenant_id_uq").on(t.tenantId, t.id),

    /**
     * A WORK ITEM MAY ONLY NAME A DEPARTMENT OF ITS OWN TENANT — enforced by PostgreSQL.
     *
     * Byte-for-byte the shape OSA-1 released as `agents_tenant_department_fk`: composite, against
     * `departments_tenant_id_uq`, `on delete restrict`, and MATCH SIMPLE (PostgreSQL's default) so
     * a row with `department_id` NULL satisfies it without naming anything. A cross-tenant
     * department is not refused by application code here — it is UNREPRESENTABLE.
     */
    foreignKey({
      name: "work_items_tenant_department_fk",
      columns: [t.tenantId, t.departmentId],
      foreignColumns: [departments.tenantId, departments.id],
    }).onDelete("restrict"),

    /** The register is read one tenant at a time, newest first. */
    index("work_items_tenant_created_idx").on(t.tenantId, t.createdAt),
    /** Reading a department's work, and the join a later milestone will make. */
    index("work_items_tenant_department_idx").on(t.tenantId, t.departmentId),

    /**
     * WORK IS ACCOUNTABLE TO A HUMAN, OR TO NOBODY YET.
     *
     * A row naming an agent, a system or a service is REJECTED BY POSTGRES, independently of every
     * line of application code. This is where "WORK-1 gives agents zero authority" stops being a
     * sentence and becomes a fact — and it is the same CHECK `departments_human_owner_chk` makes
     * about department ownership, for the same reason.
     */
    check(
      "work_items_human_accountable_chk",
      sql`${t.accountableActorType} is null or ${t.accountableActorType} = 'human'`,
    ),

    /**
     * THE PAIR MOVES TOGETHER. "A type with no id" and "an id with no type" are not states this
     * table can hold, in either direction.
     */
    check(
      "work_items_accountable_pair_chk",
      sql`(${t.accountableActorType} is null) = (${t.accountableActorId} is null)`,
    ),

    /** Work whose title says nothing is not work. Length bounds live in the writer. */
    check("work_items_title_chk", sql`char_length(btrim(${t.title})) > 0`),
  ],
);
