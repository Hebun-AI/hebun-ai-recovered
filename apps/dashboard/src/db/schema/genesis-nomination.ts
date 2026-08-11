/*
 * genesis_nominations — the PRE-GOVERNANCE root of trust (G2.1).
 *
 * ── WHAT THIS TABLE IS ───────────────────────────────────────────────────────
 *
 * Exactly one fact, and nothing wider:
 *
 *   "A local operator ceremony nominated verified human H as the person eligible
 *    to accept genesis entitlement for tenant T, and H accepted it."
 *
 * Hebun already had an identity authority (`auth_identities`), a credential
 * authority (`auth_credentials`, D1) and a session authority
 * (`user_session_contexts`). Together they answer WHO a human is. None of them
 * answers WHY a particular human may establish a tenant's first Governance
 * authority. That gap is what blocked G2 twice, and this table is that gap's
 * narrowest honest filling.
 *
 * ── WHAT THIS TABLE IS NOT ───────────────────────────────────────────────────
 *
 * It is NOT Governance authority, and it is NOT a replacement for
 * `decision_records.bootstrap`. That row remains the canonical genesis DECISION
 * and only a future G2 phase may create it. An accepted nomination is the INPUT
 * G2 will check before it does — entitlement, never the decision.
 *
 * It carries no decision type, no outcome, no justification-of-decision, no
 * approval chain, no policy reference, no Knowledge reference, no role and no
 * permission. Those belong to authorities that already own them.
 *
 * ── THE TWO KEYS ─────────────────────────────────────────────────────────────
 *
 * Neither act alone establishes anything:
 *
 *   KEY 1  a LOCAL OPERATOR CEREMONY (CLI, out-of-band) writes `pending`.
 *          It cannot accept, and it cannot create a Governance decision.
 *   KEY 2  the NOMINATED HUMAN accepts in-product under a verified D1 session.
 *          They cannot nominate themselves — no product surface writes `pending`.
 *
 * The chain terminates OUTSIDE the application, in possession of the deployment.
 * See `nominationSource` for the honest limits of that claim.
 *
 * ── ONE ACTIVE ROOT PER TENANT, ENFORCED BY POSTGRES ─────────────────────────
 *
 * `genesis_nominations_one_active_per_tenant_uq` is a PARTIAL unique index over
 * `tenant_id` where the row is not revoked. A `select`-then-`insert` check in
 * application code cannot provide this: two concurrent ceremonies both read
 * "none exists" and both insert. The database is the final defense, and a real
 * concurrency test proves one attempt wins and the other is refused.
 *
 * ── TENANT BINDING IS STRUCTURAL ─────────────────────────────────────────────
 *
 * The composite foreign key `(tenant_id, nominated_user_id)` →
 * `memberships (tenant_id, user_id)` makes "nominated for a tenant you do not
 * belong to" a database error, not a policy check somebody can forget. It reuses
 * the pre-existing `memberships_tenant_user_uq` index; no second identity model
 * was created. Membership LIFECYCLE (active/suspended/revoked) is still checked
 * server-side, because a foreign key cannot express it.
 *
 * Uses tenantColumns: a nomination is owned by exactly one tenant.
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
import { genesisNominationStatusEnum } from "./_enums";
import { authIdentities } from "./auth-identity";
import { decisionRecords } from "./governance";
import { memberships } from "./membership";
import { users } from "./user";

/**
 * The only value `nomination_source` may hold today.
 *
 * READ THIS AS A LIMITATION, NOT A CREDENTIAL. It records WHICH ROOT produced the
 * nomination — a local operator ceremony — and deliberately does NOT claim WHO
 * operated it. Hebun cannot cryptographically identify the human at the terminal;
 * possession of the deployment is the bootstrap trust assumption of this stage.
 * The value is therefore not "verified platform admin", not "certified operator"
 * and not any Governance authority. Introducing a real operator identity later
 * means adding a value here, which is a deliberate schema decision.
 */
export const GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony";

export const genesisNominations = pgTable(
  "genesis_nominations",
  {
    ...tenantColumns,

    /** The nominated human's durable identity. Credentials rotate; this does not. */
    nominatedAuthIdentityId: uuid("nominated_auth_identity_id")
      .notNull()
      .references(() => authIdentities.id, { onDelete: "restrict" }),
    /**
     * The same human as `users.id` — the canonical `actor_id` for
     * `actor_type = 'human'` everywhere else in the schema. Carried so the
     * nomination can participate in actor references and in the composite
     * membership foreign key below.
     */
    nominatedUserId: uuid("nominated_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    status: genesisNominationStatusEnum("status").notNull().default("pending"),

    /** Which external root produced this nomination. See the constant above. */
    nominationSource: varchar("nomination_source", { length: 64 }).notNull(),
    nominatedAt: timestamp("nominated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),

    /* ── Acceptance (KEY 2). All NULL until the nominated human accepts. ── */
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    /**
     * The durable `user_session_contexts` ROW ID the acceptance was performed
     * under — the same reference G1 already records. It is NOT the opaque cookie
     * value: that bearer reference is never stored anywhere, only its keyed
     * digest is.
     */
    acceptedSessionContextId: uuid("accepted_session_context_id"),
    /**
     * The assurance level at the moment of acceptance, recorded so a later phase
     * cannot retroactively claim this ceremony was strongly authenticated. Today
     * D1 issues `aal1` only, and the Director accepted that explicitly for this
     * development stage.
     */
    acceptedAssuranceLevel: varchar("accepted_assurance_level", { length: 8 }),

    /* ── Revocation. Declared, and deliberately unwritten in G2.1. ── */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revocationReason: varchar("revocation_reason", { length: 128 }),

    /* ── G2: CONSUMPTION ────────────────────────────────────────────────────
     *
     * An accepted nomination is entitlement to establish the tenant's genesis
     * Governance authority exactly once. G2 spends it, and the spending is
     * recorded HERE rather than inferred.
     *
     * "A bootstrap decision exists for this tenant, therefore the entitlement
     * must have been consumed" is the inference this deliberately refuses. Two
     * facts that are merely correlated today would be indistinguishable from
     * two facts that drifted apart tomorrow, and a constitutional lifecycle
     * should be readable without a join and a guess.
     */
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    /** The genesis decision this entitlement produced. RESTRICT: history is not deletable. */
    consumedByDecisionId: uuid("consumed_by_decision_id").references(
      () => decisionRecords.id,
      { onDelete: "restrict" },
    ),
  },
  (t) => [
    /* THE CONSTITUTIONAL INVARIANT: at most one nomination per tenant occupies the
     * genesis slot. `pending` and `accepted` both occupy it — an operator must not
     * be able to nominate a second human either before or after acceptance. Only a
     * revoked nomination frees the slot. */
    uniqueIndex("genesis_nominations_one_active_per_tenant_uq")
      .on(t.tenantId)
      .where(sql`${t.status} <> 'revoked'`),

    /* Structural tenant binding. Reuses memberships_tenant_user_uq — see header. */
    foreignKey({
      name: "genesis_nominations_tenant_member_fk",
      columns: [t.tenantId, t.nominatedUserId],
      foreignColumns: [memberships.tenantId, memberships.userId],
    }).onDelete("restrict"),

    index("genesis_nominations_identity_idx").on(t.nominatedAuthIdentityId),

    /* An accepted nomination must carry its full acceptance evidence, and a
     * nomination that is not accepted must carry none of it. "Accepted but we do
     * not know when, by which session, or at what assurance" is not a state this
     * table can hold. */
    check(
      "genesis_nominations_accepted_chk",
      sql`(${t.status} = 'accepted') = (${t.acceptedAt} is not null and ${t.acceptedSessionContextId} is not null and ${t.acceptedAssuranceLevel} is not null)`,
    ),
    /* A revoked nomination must say when and why. */
    check(
      "genesis_nominations_revoked_chk",
      sql`${t.status} <> 'revoked' or (${t.revokedAt} is not null and ${t.revocationReason} is not null and char_length(btrim(${t.revocationReason})) > 0)`,
    ),
    /* The recorded assurance level must be one the system actually defines —
     * the same closed set `user_session_contexts` already checks against. */
    check(
      "genesis_nominations_assurance_chk",
      sql`${t.acceptedAssuranceLevel} is null or ${t.acceptedAssuranceLevel} in ('aal1', 'aal2', 'aal3')`,
    ),
    /* ── G2 consumption integrity ──
     * Consumption is all-or-nothing: "consumed, but we do not know by which
     * decision" is not a state this table can hold. */
    check(
      "genesis_nominations_consumed_chk",
      sql`(${t.consumedAt} is null) = (${t.consumedByDecisionId} is null)`,
    ),
    /* Only an ACCEPTED entitlement can be spent. A pending or revoked nomination
     * has nothing to spend, and this makes that unrepresentable rather than merely
     * checked in application code. */
    check(
      "genesis_nominations_consumed_requires_accepted_chk",
      sql`${t.consumedAt} is null or ${t.status} = 'accepted'`,
    ),
    /* One genesis decision consumes at most one entitlement. */
    uniqueIndex("genesis_nominations_consumed_by_decision_uq")
      .on(t.consumedByDecisionId)
      .where(sql`${t.consumedByDecisionId} is not null`),

    /* Only roots that exist may be named. Widening this is a schema decision.
     * The literal is written inline rather than interpolated from the constant
     * above: drizzle-kit renders an interpolated value as a bind parameter, which
     * is not valid inside a CHECK in a migration file. A test asserts the two
     * stay in agreement. */
    check(
      "genesis_nominations_source_chk",
      sql`${t.nominationSource} = 'local-operator-ceremony'`,
    ),
  ],
);
