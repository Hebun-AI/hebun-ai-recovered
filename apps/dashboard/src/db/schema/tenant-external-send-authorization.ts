/*
 * tenant_external_send_authorizations — WHICH ORGANIZATION MAY REACH THE OUTSIDE WORLD.
 *
 * ── THE ONE QUESTION THIS TABLE ANSWERS ──────────────────────────────────────
 *
 *     "Has this tenant's Governance authority explicitly armed this organization for outbound
 *      external sending?"
 *
 * That is the whole of it. It does NOT mean a particular send is authorized, that a permit exists,
 * that the deployment's root control is enabled, that the deployment is configured to send, or
 * that anything has been sent. Each of those is owned elsewhere and keeps being owned elsewhere:
 *
 *     ARMED        this table AND `provider_connectivity_controls` ('external-send')
 *     CONFIGURED   deployment environment, derived at request time, never persisted
 *     AUTHORIZED   `action_permits` + its Governance decision
 *     EXECUTED     `consume-action-permit` and one atomic spend
 *     ACCEPTED     the provider's own answer
 *
 * ── THE CONTAINMENT THIS TABLE EXISTS FOR ────────────────────────────────────
 *
 * Before it, external-send arming was ONE ROW for the whole deployment. R3B recorded that honestly
 * and called it a generation-one limitation: *"one switch, one sender, all tenants. That is
 * coherent for generation one and wrong for a customer product — pausing one tenant pauses
 * everyone."* The inverse was the security problem: ARMING one tenant armed every tenant, because
 * there was no tenant dimension anywhere in the arming question.
 *
 * This table supplies the missing dimension. It does not remove the root switch and does not weaken
 * it. Arming is now a CONJUNCTION, and neither half can grant the other's:
 *
 *     effective external-send arming = tenant arming active AND root control enabled
 *
 * A deployment operator holding possession may stop everything and may arm nobody; a tenant's
 * Governance may arm itself and may not lift the stop.
 *
 * ── WHY A SIBLING, AND NOT A COLUMN ON THE ROOT CONTROL ─────────────────────
 *
 * The obvious change — add `tenant_id` to `provider_connectivity_controls` — is refused here for
 * the reason that table and `tenant_machine_execution_authorizations` BOTH already wrote down:
 * the root control is deliberately root-scoped, its unique index is on `provider_key` ALONE, and
 * one deployment holds one provider account, one credential and one runtime. Adding a tenant
 * dimension there would break that identity for `claude` and `provider-observation-read` — keys
 * for which per-tenant containment would model a boundary that does not physically exist — in
 * order to serve one key for which it does.
 *
 * So the root control is left EXACTLY as it is, byte-unchanged, and this table answers the
 * different question beside it. That is not a second source of truth: the two rows answer two
 * different questions, and exactly one module composes them.
 *
 * ── WHY GOVERNANCE, AND NOT POSSESSION ──────────────────────────────────────
 *
 * The root ceremony writes `updated_by = NULL` because deployment possession is a SOURCE and not
 * an ACTOR — Hebun cannot identify the human at that terminal. That is acceptable for an emergency
 * stop, whose failure direction is safe. It is NOT acceptable for arming an organization to reach
 * real people outside it: somebody must own that decision, by name, forever. So this row is written
 * only under a tenant Governance decision, by an authenticated human, and
 * `tenant_external_send_authorizations_human_authorizer_chk` makes "an agent cannot arm its own
 * organization" a fact about PostgreSQL rather than a fact about a TypeScript file.
 *
 * ── REVISIONS, NOT EDITS ────────────────────────────────────────────────────
 *
 * Nothing here is ever updated in place. Disarming is a NEW revision saying `withdrawn`, under its
 * own `revoke` decision, leaving the revision it replaces byte-identical — so "was this ever taken
 * away, and when, by whom, and why" stays answerable forever. Re-arming is another new active
 * revision under another new decision; a withdrawn revision never becomes active again.
 *
 * ── THE LINEAGE IS (tenant) ALONE ───────────────────────────────────────────
 *
 * Narrower than the machine sibling's `(tenant, capability)`. There is exactly one consequential
 * external-send capability in this generation and the executor refuses every other action kind
 * before it ever reaches arming, so a `capability_key` column could hold exactly one value. A
 * column that can only hold one value does not record a fact; it invites a future widening that
 * nobody decided. When a second outbound capability genuinely exists, adding the dimension then
 * is an additive migration and an honest one.
 */
import { pgTable, check, index, integer, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { tenantColumns } from "./_base";
import { actorTypeEnum, tenantExternalSendStateEnum } from "./_enums";
import { decisionRecords, governanceSessions } from "./governance";

export const tenantExternalSendAuthorizations = pgTable(
  "tenant_external_send_authorizations",
  {
    /** Uses tenantColumns: an arming is owned by exactly one tenant, NOT NULL, FK'd. */
    ...tenantColumns,

    authorizationRevision: integer("authorization_revision").notNull(),

    state: tenantExternalSendStateEnum("state").notNull(),

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
      (): AnyPgColumn => tenantExternalSendAuthorizations.id,
    ),
  },
  (t) => [
    /**
     * One revision number per TENANT lineage — two concurrent writers cannot tie.
     *
     * THIS INDEX IS THE CONTAINMENT, stated as a database fact: the uniqueness that governs arming
     * is now keyed by `tenant_id`, so one tenant's row cannot be another tenant's row. The root
     * control's `provider_key`-only uniqueness is untouched and still means what it always meant.
     */
    uniqueIndex("tenant_external_send_authorizations_lineage_revision_uq").on(
      t.tenantId,
      t.authorizationRevision,
    ),

    /** One decision authorizes exactly one revision. A reused decision is a false provenance. */
    uniqueIndex("tenant_external_send_authorizations_decision_uq").on(t.governanceDecisionId),

    /** A revision may be superseded by at most one successor — no forked lineage. */
    uniqueIndex("tenant_external_send_authorizations_supersedes_uq")
      .on(t.supersedesAuthorizationId)
      .where(sql`${t.supersedesAuthorizationId} is not null`),

    /** The runtime's read shape: "what does this tenant currently hold?" */
    index("tenant_external_send_authorizations_tenant_state_idx").on(t.tenantId, t.state),

    /** Lets a dependent row carry (id, tenant_id) as a composite FK and never cross tenants. */
    uniqueIndex("tenant_external_send_authorizations_id_tenant_uq").on(t.id, t.tenantId),

    /** AN AGENT MAY NEVER ARM ITS OWN ORGANIZATION. Enforced by PostgreSQL. */
    check(
      "tenant_external_send_authorizations_human_authorizer_chk",
      sql`${t.authorizedByActorType} = 'human'`,
    ),

    check(
      "tenant_external_send_authorizations_revision_chk",
      sql`${t.authorizationRevision} >= 1`,
    ),

    /** Revision 1 begins a lineage and supersedes nothing; every later revision supersedes one. */
    check(
      "tenant_external_send_authorizations_lineage_chk",
      sql`(${t.authorizationRevision} = 1) = (${t.supersedesAuthorizationId} is null)`,
    ),

    check(
      "tenant_external_send_authorizations_supersedes_not_self_chk",
      sql`${t.supersedesAuthorizationId} is null or ${t.supersedesAuthorizationId} <> ${t.id}`,
    ),

    /**
     * A lineage cannot OPEN with a disarming. Taking away a permission nobody ever granted is not
     * a fact, and recording it would make the ledger describe an event that did not happen.
     */
    check(
      "tenant_external_send_authorizations_first_revision_active_chk",
      sql`${t.authorizationRevision} > 1 or ${t.state} = 'active'`,
    ),
  ],
);
