/*
 * tenant_machine_execution_authorizations — TENANT PARTICIPATION IN MACHINE EXECUTION.
 *
 * ── THE ONE QUESTION THIS TABLE ANSWERS ──────────────────────────────────────
 *
 *     "Has this tenant's Governance authority explicitly allowed this organization to participate
 *      in machine execution, for this declared machine capability?"
 *
 * That is the whole of it. It does NOT mean a particular act is authorized, that a permit exists,
 * that a machine may choose work, that the deployment's root control is enabled, or that anything
 * has executed. Each of those is owned elsewhere and keeps being owned elsewhere:
 *
 *     REACHABLE   this table AND `provider_connectivity_controls`
 *     ELIGIBLE    `action_permits` + the frozen machine action set
 *     AUTHORIZED  `action_permits` + its Governance decision
 *     EXECUTED    `consume-action-permit` and the work authority
 *
 * ── WHY A SIBLING, AND NOT A COLUMN ON THE ROOT CONTROL ─────────────────────
 *
 * `provider_connectivity_controls` is deliberately ROOT-scoped: one deployment holds one provider
 * account, one credential and one runtime, so there is exactly one thing to turn off, and its
 * unique index is on `provider_key` ALONE. Adding a tenant dimension there would break that
 * identity for `claude`, `external-send` and `provider-observation-read` — three keys for which
 * per-tenant containment would model a boundary that does not physically exist — in order to serve
 * one key for which it does. So the root control is left exactly as it is, and this table answers
 * the different question beside it.
 *
 * TWO AUTHORITIES, TWO QUESTIONS, ONE CONJUNCTION:
 *
 *     effective reachability = tenant authorization active AND root control enabled
 *
 * Neither can grant the other's half. A deployment operator holding possession may stop everything
 * and may not enrol anybody; a tenant's Governance may enrol itself and may not lift the stop.
 *
 * ── WHY GOVERNANCE, AND NOT POSSESSION ──────────────────────────────────────
 *
 * The root ceremony writes `updated_by = NULL` because deployment possession is a SOURCE and not
 * an ACTOR — Hebun cannot identify the human at that terminal. That is acceptable for an emergency
 * stop, whose failure direction is safe. It is NOT acceptable for enrolling an organization into
 * unattended mutation: somebody must own that decision, by name, forever. So this row is written
 * only under a tenant Governance decision, by an authenticated human, and
 * `tenant_machine_execution_authorizations_human_authorizer_chk` makes "an agent cannot enrol its
 * own organization" a fact about PostgreSQL rather than a fact about a TypeScript file.
 *
 * ── REVISIONS, NOT EDITS ────────────────────────────────────────────────────
 *
 * Nothing here is ever updated in place. Withdrawal is a NEW revision saying `withdrawn`, under its
 * own `revoke` decision, leaving the revision it replaces byte-identical — so "was this ever taken
 * away, and when, by whom, and why" stays answerable forever. Re-enrolling is another new active
 * revision under another new decision; a withdrawn revision never becomes active again.
 *
 * `superseded` is DERIVED from a later revision existing in the same lineage. It is deliberately
 * not a column: a stored `is_current` beside a derivable one is two facts that can disagree.
 *
 * ── THE LINEAGE IS (tenant, capability) ─────────────────────────────────────
 *
 * Narrower than the observation sibling's, because machine execution has no subject to read and no
 * cadence of its own: WHEN is decided by a permit existing, never by a schedule this row carries.
 * `interval_minutes`, `subject_kind`, `subject_ref` and `integration_id` are therefore absent
 * rather than nulled — copying them would describe a capability this authority does not have.
 */
import { pgTable, check, index, integer, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantColumns } from "./_base";
import { actorTypeEnum, tenantMachineExecutionStateEnum } from "./_enums";
import { decisionRecords, governanceSessions } from "./governance";

export const tenantMachineExecutionAuthorizations = pgTable(
  "tenant_machine_execution_authorizations",
  {
    /** Uses tenantColumns: an authorization is owned by exactly one tenant, NOT NULL, FK'd. */
    ...tenantColumns,

    authorizationRevision: integer("authorization_revision").notNull(),

    state: tenantMachineExecutionStateEnum("state").notNull(),

    /**
     * WHICH MACHINE CAPABILITY. Today exactly `record-work`, validated by the writer against the
     * released frozen set rather than by a CHECK here — a database constraint naming one action
     * kind would have to be migrated every time that frozen set is deliberately widened, and the
     * frozen set is the authority on that question.
     */
    capabilityKey: text("capability_key").notNull(),

    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    /** The accountable human. The CHECK below refuses anything else, independently of any code. */
    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),

    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),

    supersedesAuthorizationId: uuid("supersedes_authorization_id").references(
      (): AnyPgColumn => tenantMachineExecutionAuthorizations.id,
    ),
  },
  (t) => [
    /** One revision number per (tenant, capability) lineage — two concurrent writers cannot tie. */
    uniqueIndex("tenant_machine_execution_authorizations_lineage_revision_uq").on(
      t.tenantId,
      t.capabilityKey,
      t.authorizationRevision,
    ),

    /** One decision authorizes exactly one revision. A reused decision is a false provenance. */
    uniqueIndex("tenant_machine_execution_authorizations_decision_uq").on(t.governanceDecisionId),

    /** A revision may be superseded by at most one successor — no forked lineage. */
    uniqueIndex("tenant_machine_execution_authorizations_supersedes_uq")
      .on(t.supersedesAuthorizationId)
      .where(sql`${t.supersedesAuthorizationId} is not null`),

    /** The runtime's read shape: "what does this tenant currently hold?" */
    index("tenant_machine_execution_authorizations_tenant_state_idx").on(t.tenantId, t.state),

    /** Lets a dependent row carry (id, tenant_id) as a composite FK and never cross tenants. */
    uniqueIndex("tenant_machine_execution_authorizations_id_tenant_uq").on(t.id, t.tenantId),

    /** AN AGENT MAY NEVER ENROL ITS OWN ORGANIZATION. Enforced by PostgreSQL. */
    check(
      "tenant_machine_execution_authorizations_human_authorizer_chk",
      sql`${t.authorizedByActorType} = 'human'`,
    ),

    check(
      "tenant_machine_execution_authorizations_revision_chk",
      sql`${t.authorizationRevision} >= 1`,
    ),

    /** Revision 1 begins a lineage and supersedes nothing; every later revision supersedes one. */
    check(
      "tenant_machine_execution_authorizations_lineage_chk",
      sql`(${t.authorizationRevision} = 1) = (${t.supersedesAuthorizationId} is null)`,
    ),

    check(
      "tenant_machine_execution_authorizations_supersedes_not_self_chk",
      sql`${t.supersedesAuthorizationId} is null or ${t.supersedesAuthorizationId} <> ${t.id}`,
    ),

    /**
     * A lineage cannot OPEN with a withdrawal. Taking away a permission nobody ever granted is not
     * a fact, and recording it would make the ledger describe an event that did not happen.
     */
    check(
      "tenant_machine_execution_authorizations_first_revision_active_chk",
      sql`${t.authorizationRevision} > 1 or ${t.state} = 'active'`,
    ),

    check(
      "tenant_machine_execution_authorizations_capability_chk",
      sql`char_length(btrim(${t.capabilityKey})) > 0`,
    ),
  ],
);
