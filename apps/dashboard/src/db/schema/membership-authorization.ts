/*
 * membership_authorizations — Governance's permission to admit ONE future human (I1).
 *
 * ── WHAT THIS TABLE IS ───────────────────────────────────────────────────────
 *
 * Exactly one fact, and nothing wider:
 *
 *   "The human holding tenant T's Governance authority approved, by Governance
 *    decision D, the future onboarding of the human reachable at email E into
 *    tenant T with intended role R."
 *
 * P2 published an authority chain — credential → identity → session → membership
 * → genesis → bootstrap → delegation → ratification — whose bottom two edges have
 * readers and no writer. Every human in a Hebun tenant is planted by a seed
 * script. This table is the first link of the narrowest honest repair: it does not
 * create the human, it records that Governance permitted one to be created.
 *
 * ── WHAT THIS TABLE IS NOT ───────────────────────────────────────────────────
 *
 * It is NOT a second membership authority, and it is NOT Governance authority.
 * Whether the actor held Governance authority is answered ONLY by
 * `resolveGovernanceAuthority` reading `decision_records`; this row is downstream
 * evidence of that answer, never a substitute for asking it again.
 *
 * It is NOT an invitation. `invitations` requires token material and an expiry,
 * and minting a token to satisfy a schema would be performing I2's onboarding
 * ceremony inside an authority phase. I1 issues no token, sends nothing, and
 * creates no user, identity, credential, membership or role.
 *
 * It carries no credential, no token, no session bearer, no password and no role
 * assignment of its own — `intended_role_id` names an EXISTING role the authority
 * chose, and naming is not granting.
 *
 * ── THE STAGES, WHICH MAY NEVER COLLAPSE ─────────────────────────────────────
 *
 *   Governance authority        who may decide                    (G2 / G3)
 *          ↓
 *   approve decision            the constitutional act            (decision_records)
 *          ↓
 *   membership authorization    the consumable permission         (HERE)
 *          ↓
 *   invitation                  token, expiry, delivery           (I2)
 *          ↓
 *   membership                  the human is finally in           (I2)
 *
 * ── normalized_email IS A TARGET, NOT AN IDENTITY ────────────────────────────
 *
 * At I1 time the intended human has no `users` row and no `auth_identities` row,
 * so there is no id to reference and a foreign key is impossible. The email
 * identifies WHO IS INTENDED. It is not an authenticated user, not a verified
 * human, not a member and not an identity, and no code may treat it as one. I2
 * must bind the invitation it creates to a real D1 identity; until then this
 * column is an intention.
 *
 * ── ONE-TIME CONSUMPTION, ENFORCED BY POSTGRES ───────────────────────────────
 *
 * A Governance approval permits ONE onboarding. Two application reads of
 * "not consumed yet" can both succeed and both spend it, so the invariant is a
 * partial unique index over `consumed_by_invitation_id` plus the CHECK pair
 * below — not a policy I2 is trusted to remember.
 *
 * Uses tenantColumns: an authorization is owned by exactly one tenant.
 */
import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { tenantColumns } from "./_base";
import { actorTypeEnum, membershipAuthorizationStatusEnum } from "./_enums";
import { decisionRecords, governanceSessions } from "./governance";
import { invitations } from "./invitation";
import { roles } from "./role";

export const membershipAuthorizations = pgTable(
  "membership_authorizations",
  {
    ...tenantColumns,

    /**
     * The intended onboarding target. See the header: this is an intention, not an
     * identity. Stored normalized (lower + trimmed) so "one active authorization per
     * intended human" is a real uniqueness claim rather than a case-sensitive one.
     */
    normalizedEmail: varchar("normalized_email", { length: 320 }).notNull(),

    /**
     * The EXISTING role the Governance authority chose. No default is invented here:
     * the authority names a role that already belongs to the tenant, and the composite
     * foreign key below makes naming another tenant's role a database error. Which
     * role TYPES are eligible is a server-side rule (I1 permits `member` only), because
     * a foreign key cannot express a band.
     */
    intendedRoleId: uuid("intended_role_id").notNull(),

    /* ── Governance provenance. Both NOT NULL: an authorization with no decision
     * behind it is not a state this table can hold. ── */
    /** The `approve` decision that authorized this onboarding. RESTRICT: history is not deletable. */
    governanceDecisionId: uuid("governance_decision_id")
      .notNull()
      .references(() => decisionRecords.id, { onDelete: "restrict" }),
    /** The session that decision was recorded in. */
    governanceSessionId: uuid("governance_session_id")
      .notNull()
      .references(() => governanceSessions.id, { onDelete: "restrict" }),

    /**
     * The accountable actor, as the canonical polymorphic pair. Constrained to
     * `human` by CHECK below — an agent may never authorize the admission of a
     * human, and that is a database fact here rather than a server-side hope.
     */
    authorizedByActorType: actorTypeEnum("authorized_by_actor_type").notNull(),
    authorizedByActorId: uuid("authorized_by_actor_id").notNull(),

    status: membershipAuthorizationStatusEnum("status").notNull().default("authorized"),
    authorizedAt: timestamp("authorized_at", { withTimezone: true }).notNull().defaultNow(),

    /* ── I2 consumption. Both NULL until I2 spends this authorization. ── */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    /** The invitation this authorization produced. Written by I2, never by I1. */
    consumedByInvitationId: uuid("consumed_by_invitation_id").references(() => invitations.id, {
      onDelete: "restrict",
    }),

    /* ── Revocation. DECLARED AND UNWRITTEN in I1, as G2.1 declared its own. ── */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 128 }),
  },
  (t) => [
    /*
     * THE DUPLICATE-AUTHORIZATION INVARIANT. At most one LIVE authorization may exist
     * per intended human per tenant. Partial, so consumed and revoked rows accumulate
     * as history and free the slot — the same shape as
     * `genesis_nominations_one_active_per_tenant_uq` and `invitations_pending_email_uq`.
     */
    uniqueIndex("membership_authorizations_one_active_per_email_uq")
      .on(t.tenantId, t.normalizedEmail)
      .where(sql`${t.status} = 'authorized'`),

    /** One Governance decision authorizes at most one onboarding. */
    uniqueIndex("membership_authorizations_decision_uq").on(t.governanceDecisionId),

    /**
     * THE CONSUMPTION INVARIANT. One invitation may spend at most one authorization.
     * Partial because the column is null until I2 acts.
     */
    uniqueIndex("membership_authorizations_consumed_invitation_uq")
      .on(t.consumedByInvitationId)
      .where(sql`${t.consumedByInvitationId} is not null`),

    /* Structural tenant binding for the chosen role. Reuses roles_tenant_id_id_uq —
     * "authorized into another tenant's role" is a database error, not a check
     * somebody can forget. Same pattern as invitations_tenant_role_fk. */
    foreignKey({
      name: "membership_authorizations_tenant_role_fk",
      columns: [t.tenantId, t.intendedRoleId],
      foreignColumns: [roles.tenantId, roles.id],
    }).onDelete("restrict"),

    index("membership_authorizations_tenant_status_idx").on(t.tenantId, t.status),

    /* The email must already be normalized. Identical to invitations' rule, so the two
     * tables cannot disagree about what "the same human" means. */
    check(
      "membership_authorizations_normalized_email_chk",
      sql`${t.normalizedEmail} = lower(btrim(${t.normalizedEmail})) and char_length(${t.normalizedEmail}) > 0`,
    ),

    /* HUMAN SUPREMACY, at the storage layer. Spec 49 §4 forbids an agent electing
     * itself into authority; admitting a human is the same class of act. */
    check(
      "membership_authorizations_human_authorizer_chk",
      sql`${t.authorizedByActorType} = 'human'`,
    ),

    /* Consumption is all-or-nothing: "consumed, but we do not know by which invitation"
     * is not a representable state. */
    check(
      "membership_authorizations_consumed_chk",
      sql`(${t.consumedAt} is null) = (${t.consumedByInvitationId} is null)`,
    ),
    /* Consumption evidence and the consumed status move together in both directions. */
    check(
      "membership_authorizations_consumed_status_chk",
      sql`(${t.status} = 'consumed') = (${t.consumedAt} is not null)`,
    ),
    /* A revoked authorization must say when and why. */
    check(
      "membership_authorizations_revoked_chk",
      sql`${t.status} <> 'revoked' or (${t.revokedAt} is not null and ${t.revocationReason} is not null and char_length(btrim(${t.revocationReason})) > 0)`,
    ),
  ],
);
