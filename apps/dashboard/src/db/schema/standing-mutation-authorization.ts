/*
 * schema/standing-mutation-authorization.ts — the bounded STANDING ENVELOPE inside which an agent's
 * own `record-work` proposals may become permits without a further human decision per act (RUNG 2).
 *
 * ── THE ONE SENTENCE THIS TABLE EXISTS TO MAKE TRUE ─────────────────────────
 *
 *     A human decided, in advance and in bounds, that a named agent's evidenced work records need
 *     not be decided one at a time.
 *
 * Everything below is a bound on that sentence. There is no field here that widens it.
 *
 * ── WHERE IT SITS IN THE CHAIN ──────────────────────────────────────────────
 *
 *     PROPOSED    the released Heby inlet — unchanged, and still the only way a request exists
 *     AUTHORIZED  THIS TABLE, under a human Governance decision, for a bounded envelope
 *     ISSUED      `issue-permit-under-standing-authorization` — one ORDINARY single-use permit
 *     DELIVERED   the released RUNG 1.5 scan, byte-unchanged
 *     EXECUTED    the released RUNG 1 executor and single spend, byte-unchanged
 *
 * The envelope authorizes ISSUANCE. It does not authorize execution, does not spend anything, and
 * is never consulted by the executor — which re-decides arming, enrolment, liveness and the frozen
 * action set from freshly re-read rows inside the spend's own transaction, exactly as before.
 *
 * ── WHY A NEW AUTHORITY AND NOT A WIDENING OF THREE EXISTING ONES ───────────
 *
 * `standing_observation_authorizations` authorizes repeated READS. The released machine-execution
 * principal already wrote down why it must never learn to mutate: *"the observation principal is
 * minted from a standing authorization that permits a scope REPEATEDLY, and quietly teaching it to
 * mutate would turn a read permission into a write one."* This table is that refusal made
 * structural — a separate row, a separate domain, a separate lifecycle.
 *
 * `tenant_machine_execution_authorizations` answers whether the ORGANIZATION accepts unattended
 * delivery of acts a human already authorized individually. It is per-tenant and per-capability and
 * carries no agent, no window and no quota, because it is not about any particular agent or act.
 *
 * `action_permits` is single-use by construction — one digest, one expiry, one spend. An envelope
 * is the opposite shape, and making permits reusable to express it would destroy the one invariant
 * every downstream proof depends on.
 *
 * ── WHAT IS DERIVED AND THEREFORE ABSENT ────────────────────────────────────
 *
 * No `acts_consumed`, no `remaining`, no `exhausted`, no `last_act_at`, no `is_current`. Every one
 * is computable from the permits this authorization issued, and a stored counter would need a
 * writer that races the issuer — producing a second opinion about a question the rows already
 * answer. This repository derives permit expiry the same way and never sweeps it.
 *
 * ── TENANT-SCOPED BY STRUCTURE ──────────────────────────────────────────────
 *
 * `tenantColumns` carries `tenant_id`, and the composite unique index below lets the permit table
 * bind `(tenant_id, standing_authorization_id)` — so "a permit issued under another tenant's
 * envelope" is a database error rather than an application `where` clause somebody can forget.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum, standingMutationStateEnum } from "./_enums";
import { decisionRecords, governanceSessions } from "./governance";
import { agents } from "./agent";

export const standingMutationAuthorizations = pgTable(
  "standing_mutation_authorizations",
  {
    ...tenantColumns,

    /**
     * LINEAGE, NOT MUTATION. Withdrawing or re-scoping writes a NEW revision; no row is ever
     * updated in place. The effective revision is `max(authorization_revision)` for the lineage,
     * derived on read — the same shape both siblings use.
     */
    authorizationRevision: integer("authorization_revision").notNull(),

    /** What THIS revision says. Never a summary of the lineage. */
    state: standingMutationStateEnum("state").notNull(),

    /* ── THE EXACT SCOPE. Every field is bound; none is a wildcard. ── */

    /**
     * THE ONE AGENT. Not a class, not a role, not "any agent in this tenant".
     *
     * An envelope naming no agent would authorize whatever agent happens to exist later, including
     * one registered after the human decided. RESTRICT because an authorization that outlived its
     * subject would be an envelope with no holder.
     */
    agentId: uuid("agent_id").notNull(),

    /**
     * THE ONE ACTION KIND, stored rather than assumed.
     *
     * It is `record-work` today and a CHECK below says so. The column exists anyway because the
     * alternative — an envelope whose kind is implied by the table's name — makes the row unable to
     * answer what it authorized when read on its own, and makes a second kind a schema migration
     * rather than a deliberate CHECK change reviewed as one.
     */
    actionKind: text("action_kind").notNull(),

    /* ── THE WINDOW. Both bounds mandatory: there is no standing authority without an end. ── */
    notBefore: timestamp("not_before", { withTimezone: true }).notNull(),
    notAfter: timestamp("not_after", { withTimezone: true }).notNull(),

    /**
     * THE CEILING ON ACTS. Mandatory and positive.
     *
     * Counted against the permits this authorization issued, never against a stored tally. A
     * window alone is not a bound: an unbounded count inside a bounded window is still unbounded
     * in the only dimension that writes rows.
     */
    maxActs: integer("max_acts").notNull(),

    /**
     * THE FLOOR ON FREQUENCY, in minutes. Mandatory and positive.
     *
     * Quota bounds the total; cadence bounds the rate. Without it an envelope of fifty acts may be
     * spent in one second by a scanner that finds fifty proposals, which is not what a human
     * granting "fifty over a week" decided.
     */
    minIntervalMinutes: integer("min_interval_minutes").notNull(),

    /* ── Governance provenance. Both NOT NULL: an envelope with no decision behind it is not one. ── */
    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    /**
     * THE ACCOUNTABLE HUMAN, constrained to `human` by CHECK below.
     *
     * This is the person every permit issued under this envelope will name as its authorizer — and
     * that naming is TRUE, not a convenience: they authorized these acts in advance, in bounds.
     * An agent may never appear here, and that is a database fact rather than a server-side hope.
     */
    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),

    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),

    /** LINEAGE. NULL exactly on revision 1, enforced both ways by CHECK. */
    supersedesAuthorizationId: uuid("supersedes_authorization_id").references(
      (): AnyPgColumn => standingMutationAuthorizations.id,
    ),
  },
  (t) => [
    /**
     * ONE LINEAGE PER (tenant, agent, action kind), ONE ROW PER REVISION.
     *
     * The lineage key is what an envelope IS: this organization, this agent, this kind. Two active
     * envelopes for the same triple would make "how many acts remain" unanswerable.
     */
    uniqueIndex("standing_mutation_authorizations_lineage_revision_uq").on(
      t.tenantId,
      t.agentId,
      t.authorizationRevision,
    ),

    /** One Governance decision authorizes at most one revision. */
    uniqueIndex("standing_mutation_authorizations_decision_uq").on(t.governanceDecisionId),

    /** A revision may be superseded at most once — otherwise two successors could both claim one. */
    uniqueIndex("standing_mutation_authorizations_supersedes_uq")
      .on(t.supersedesAuthorizationId)
      .where(sql`${t.supersedesAuthorizationId} is not null`),

    /** The anchor `action_permits` binds to, so a cross-tenant issuance is a database error. */
    uniqueIndex("standing_mutation_authorizations_id_tenant_uq").on(t.id, t.tenantId),

    index("standing_mutation_authorizations_tenant_state_idx").on(t.tenantId, t.state),

    /** Structural tenant binding to the agent. "Another tenant's agent" is a database error. */
    foreignKey({
      name: "standing_mutation_authorizations_tenant_agent_fk",
      columns: [t.tenantId, t.agentId],
      foreignColumns: [agents.tenantId, agents.id],
    }).onDelete("restrict"),

    /* HUMAN SUPREMACY. An agent may never authorize its own envelope. */
    check(
      "standing_mutation_authorizations_human_authorizer_chk",
      sql`${t.authorizedByActorType} = 'human'`,
    ),

    check("standing_mutation_authorizations_revision_chk", sql`${t.authorizationRevision} >= 1`),

    check(
      "standing_mutation_authorizations_lineage_chk",
      sql`(${t.authorizationRevision} = 1) = (${t.supersedesAuthorizationId} is null)`,
    ),

    check(
      "standing_mutation_authorizations_supersedes_not_self_chk",
      sql`${t.supersedesAuthorizationId} is null or ${t.supersedesAuthorizationId} <> ${t.id}`,
    ),

    /** Revision 1 must stand. "Withdrawn before it existed" is not a state. */
    check(
      "standing_mutation_authorizations_first_revision_active_chk",
      sql`${t.authorizationRevision} > 1 or ${t.state} = 'active'`,
    ),

    /* A window with no duration authorizes nothing and would only ever refuse. */
    check("standing_mutation_authorizations_window_chk", sql`${t.notAfter} > ${t.notBefore}`),

    /**
     * BOTH BOUNDS POSITIVE AND CEILINGED.
     *
     * The ceilings are deliberate and small. A standing envelope is the most powerful thing a human
     * can grant on this surface, and the first one should not be able to authorize a thousand acts
     * because nobody wrote a maximum down. Raising either is a reviewed schema change.
     */
    check(
      "standing_mutation_authorizations_max_acts_chk",
      sql`${t.maxActs} >= 1 and ${t.maxActs} <= 50`,
    ),
    check(
      "standing_mutation_authorizations_cadence_chk",
      sql`${t.minIntervalMinutes} >= 1 and ${t.minIntervalMinutes} <= 10080`,
    ),

    /**
     * THE FROZEN KIND, AS A DATABASE FACT.
     *
     * RUNG 2 authorizes `record-work` and nothing else. Spelling it here means a second standing-
     * authorizable kind cannot arrive through a config value, an env var, a row or a helper — it
     * costs a reviewed migration, which is the level of deliberation adding one deserves. The
     * issuing seam consults the released frozen set as well; this is the floor underneath it.
     */
    check("standing_mutation_authorizations_action_kind_chk", sql`${t.actionKind} = 'record-work'`),
  ],
);
