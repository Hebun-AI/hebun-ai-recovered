/*
 * standing_observation_authorizations — Governance's permission to observe ONE exact provider read
 * scope, repeatedly, until a later revision withdraws it (TRH-23).
 *
 * ── WHAT ONE ROW MEANS ───────────────────────────────────────────────────────
 *
 * Exactly one sentence, and nothing wider:
 *
 *   "The human holding tenant T's Governance authority approved, by Governance decision D,
 *    recurring observation of provider P's capability C against subject S, through connection I,
 *    no more often than every K minutes."
 *
 * ── WHAT IT IS NOT ───────────────────────────────────────────────────────────
 *
 * It is NOT a second Governance authority. Whether the actor held Governance authority is answered
 * ONLY by `resolveGovernanceAuthority` reading `decision_records`; this row is downstream evidence
 * of that answer, exactly as `membership_authorizations` is for admitting a human.
 *
 * It is NOT a permit. `action_permits` authorizes ONE act, freezes it to a payload digest, expires
 * on a server-bounded TTL and is CONSUMED. Nothing here is consumed, nothing is spent, and no act
 * becomes executable. A standing authorization that had been "used up" would be a contradiction:
 * recurrence is the whole point.
 *
 * It is NOT a mandate. `agent_mandates` bounds what an agent may PROPOSE. No agent appears in this
 * table at all, and no column here could name one.
 *
 * It is NOT a schedule, and it carries no scheduler state. `interval_minutes` is a CEILING on how
 * often observation is permitted — it does not cause anything to run, and there is no runtime in
 * this repository that could. A timer decides WHEN. It never decides WHETHER.
 *
 * It carries no credential, no key, no token, no provider response and no observation. What it
 * names is a CONNECTION, and naming a connection is not holding its secret.
 *
 * ── APPEND-ONLY, AND THAT IS THE SECURITY PROPERTY ───────────────────────────
 *
 * The lineage is `(tenant_id, provider_key, capability_key, subject_ref)`. The EFFECTIVE
 * authorization is the row with the highest `authorization_revision` for that lineage — derived by
 * arithmetic on read, never stored. There is no `revoked_at`, no `superseded_at` and no
 * `is_current`, because a historical record a later write can edit was never a record.
 *
 * The consequence is the one Director asked for by name: `UPDATE … SET capability_key = <broader>`
 * is not merely forbidden, it is UNREPRESENTABLE — the authority that owns this table exposes no
 * update writer at all, and a firewall test proves no `update(` against it exists anywhere in
 * `src/`. Widening requires a NEW revision, which requires a NEW Governance decision.
 *
 * Withdrawal is the same shape: revision N+1 with `state = 'withdrawn'`, naming revision N. The
 * predecessor stays byte-identical to the day it was written. Re-authorizing after a withdrawal is
 * another new active revision under another new decision — a withdrawn revision is never
 * reactivated, and there is no column through which it could be.
 *
 * ── WHAT IS DELIBERATELY ABSENT ──────────────────────────────────────────────
 *
 *   expires_at      a revision withdraws an authorization; a clock does not, and an expiry nothing
 *                   enforces would be a claim the system cannot keep.
 *   revoked_at      withdrawal is a revision, not a stamp. See above.
 *   last_run_at     belongs to a runtime that runs. No such runtime exists.
 *   observation_count, retry_policy, cron, timezone, backfill_window, scheduler_state
 *                   all belong to timing, which is a later phase and may not be pre-empted here.
 *   principal_id    the principal is EPHEMERAL and has no durable identity. A column for it would
 *                   be the durable machine identity TRH-22 rejected on evidence.
 *
 * Uses tenantColumns: an authorization is owned by exactly one tenant.
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
import { actorTypeEnum, standingObservationStateEnum } from "./_enums";
import { decisionRecords, governanceSessions } from "./governance";
import { integrations } from "./integration";

export const standingObservationAuthorizations = pgTable(
  "standing_observation_authorizations",
  {
    ...tenantColumns,

    /**
     * The ordinal of this revision within its lineage. Starts at 1 and advances by one.
     *
     * `(tenant_id, provider_key, capability_key, subject_ref, authorization_revision)` is UNIQUE,
     * so two simultaneous revisions both computing N+1 produce one commit and one
     * `unique_violation` — the index is the concurrency guarantee, not a lock somebody remembered.
     */
    authorizationRevision: integer("authorization_revision").notNull(),

    /** What THIS revision says. Never a summary of the lineage. */
    state: standingObservationStateEnum("state").notNull(),

    /* ── THE EXACT SCOPE. Every one of these is bound; none is a wildcard. ── */
    /** The released provider key, from the catalog. Never free text a caller invented. */
    providerKey: text("provider_key").notNull(),
    /**
     * The released capability key. Recorded separately from the provider because a second
     * capability on the SAME provider observes different facts about the same subject, and an
     * authorization for one must never silently authorize the other.
     */
    capabilityKey: text("capability_key").notNull(),
    /** How the subject is identified — the vocabulary `provider-observation-history` owns. */
    subjectKind: text("subject_kind").notNull(),
    /**
     * WHAT MAY BE OBSERVED, as the PROVIDER identifies it — never as a human typed it.
     *
     * A handle can be renamed and reassigned; authorizing one would mean the authorization silently
     * followed whoever holds the name next. This is the same canonical reference
     * `provider_observations.subject_ref` stores, so an authorization and an observation are
     * comparable without translation.
     */
    subjectRef: text("subject_ref").notNull(),

    /**
     * THROUGH WHICH CONNECTION. Composite foreign key to `integrations` below, so authorizing a
     * read through another tenant's connection is a database error rather than a check somebody has
     * to remember. A connection is not a credential and not a permission — it is the route.
     */
    integrationId: uuid("integration_id").notNull(),

    /**
     * THE CEILING ON FREQUENCY. "At most once every K minutes."
     *
     * It permits nothing to run and schedules nothing. The floor is enforced by CHECK rather than
     * by a server-side constant alone, so an authorization that would licence hammering a provider
     * cannot be written even by a future caller that forgot to look.
     */
    intervalMinutes: integer("interval_minutes").notNull(),

    /* ── Governance provenance. Both NOT NULL: an authorization with no decision behind it is not
     * a state this table can hold. ── */
    /** The decision that authorized THIS revision. RESTRICT: history is not deletable. */
    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    /** The session that decision was recorded in. */
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    /**
     * The accountable authorizing human, as the canonical polymorphic pair. Constrained to `human`
     * by CHECK below — an agent may never authorize standing collection, and that is a fact about
     * PostgreSQL rather than a server-side hope.
     */
    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),

    /** When this revision was authorized. Server-supplied; there is no parameter for it. */
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull(),

    /** LINEAGE. The revision this one replaces. NULL exactly on revision 1, enforced both ways. */
    supersedesAuthorizationId: uuid("supersedes_authorization_id").references(
      (): AnyPgColumn => standingObservationAuthorizations.id,
    ),
  },
  (t) => [
    /**
     * THE LINEAGE INDEX AND THE CONCURRENCY GUARANTEE IN ONE.
     *
     * The effective authorization is `max(authorization_revision)` over these leading columns, so
     * exactly one row holds it by arithmetic. Two establishments racing for the same ordinal
     * produce one commit and one refusal.
     */
    uniqueIndex("standing_observation_authorizations_lineage_revision_uq").on(
      t.tenantId,
      t.providerKey,
      t.capabilityKey,
      t.subjectRef,
      t.authorizationRevision,
    ),

    /** One Governance decision authorizes at most one revision. */
    uniqueIndex("standing_observation_authorizations_decision_uq").on(t.governanceDecisionId),

    /** A revision may be superseded at most once — otherwise two successors could both claim one. */
    uniqueIndex("standing_observation_authorizations_supersedes_uq")
      .on(t.supersedesAuthorizationId)
      .where(sql`${t.supersedesAuthorizationId} is not null`),

    index("standing_observation_authorizations_tenant_state_idx").on(t.tenantId, t.state),

    /**
     * STRUCTURAL TENANT BINDING FOR THE CONNECTION. Reuses `integrations_id_tenant_uq`, exactly as
     * `provider_observations_tenant_integration_fk` does — "authorized to read through another
     * tenant's connection" is a database error, not a predicate somebody can forget.
     */
    foreignKey({
      name: "standing_observation_authorizations_tenant_integration_fk",
      columns: [t.integrationId, t.tenantId],
      foreignColumns: [integrations.id, integrations.tenantId],
    }).onDelete("restrict"),

    /* HUMAN SUPREMACY, at the storage layer. An agent may never authorize its own collection. */
    check(
      "standing_observation_authorizations_human_authorizer_chk",
      sql`${t.authorizedByActorType} = 'human'`,
    ),

    check(
      "standing_observation_authorizations_revision_chk",
      sql`${t.authorizationRevision} >= 1`,
    ),

    /* Revision 1 has no predecessor; every later revision has exactly one. Both directions. */
    check(
      "standing_observation_authorizations_lineage_chk",
      sql`(${t.authorizationRevision} = 1) = (${t.supersedesAuthorizationId} is null)`,
    ),

    check(
      "standing_observation_authorizations_supersedes_not_self_chk",
      sql`${t.supersedesAuthorizationId} is null or ${t.supersedesAuthorizationId} <> ${t.id}`,
    ),

    /*
     * NOTHING CAN BE WITHDRAWN THAT WAS NEVER AUTHORIZED. A first revision that said `withdrawn`
     * would be a record of a permission being taken away that nobody ever granted.
     */
    check(
      "standing_observation_authorizations_first_revision_active_chk",
      sql`${t.authorizationRevision} > 1 or ${t.state} = 'active'`,
    ),

    /*
     * THE FREQUENCY FLOOR, IN THE DATABASE.
     *
     * 60 minutes. The application constant states the same number, and this exists so that the
     * number survives a caller — present or future — that never consulted it.
     */
    check(
      "standing_observation_authorizations_interval_chk",
      sql`${t.intervalMinutes} >= 60`,
    ),

    /* The bound scope must actually be bound. An empty subject is not a subject. */
    check(
      "standing_observation_authorizations_scope_chk",
      sql`char_length(btrim(${t.providerKey})) > 0
          and char_length(btrim(${t.capabilityKey})) > 0
          and char_length(btrim(${t.subjectKind})) > 0
          and char_length(btrim(${t.subjectRef})) > 0`,
    ),
  ],
);
