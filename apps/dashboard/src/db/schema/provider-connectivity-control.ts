/*
 * Provider connectivity control — GLOBAL Director ON/OFF for a model provider's
 * Hebun → provider *model-generation* connectivity (World A: the Heby model seam;
 * NOT the execution/provider-invocation world). One row per provider key (e.g.
 * "claude").
 *
 * `directorEnabled` defaults to FALSE — fail closed. A missing/absent row is treated
 * as DISABLED by every reader, so the durable authority can never silently permit a
 * live request. This record expresses the Director's operational PERMISSION to attempt
 * connectivity; it is NOT a health/reachability claim, NOT a credential, and NOT any
 * control over the external Anthropic account. Toggling it never touches the API key.
 *
 * Global (rootColumns, no tenant): the credential and model config are server-global,
 * so the Director control that gates them is platform-wide. The unique index on
 * `providerKey` is what makes that concrete — exactly one row per provider exists for
 * the whole deployment, and every tenant reads it.
 *
 * ── WHO MAY WRITE IT (R5.1) ──────────────────────────────────────────────────
 *
 * The deployment-possession ceremony `npm run provider:connectivity`, and nothing else.
 * No code under `src/` can INSERT, UPDATE or DELETE this table.
 *
 * It used to be written by a server action gated on the acting membership's role. That
 * was the contradiction: `roles.tenantId` is NOT NULL, so an in-app authority is always
 * tenant-scoped, while this row is not — one tenant's owner could change what every
 * other tenant depends on.
 *
 * `version` (rootColumns) carries optimistic-concurrency and advances on every change.
 * It is NOT a transition count: the pre-R5.1 writer had no `where` predicate, so it also
 * advanced on writes that changed nothing. The ceremony's `is distinct from` predicate
 * makes it track real transitions only from R5.1 onward, and nothing records where the
 * two regimes meet.
 *
 * `updatedBy` is written as NULL: deployment possession has no verified actor, and naming
 * one would be a claim no human made. `updatedByType` is left NULL for the same reason —
 * TOGETHER with `updatedBy`, never alone.
 *
 * ── NO HUMAN-ONLY CONSTRAINT WILL BE ADDED (R5.2 Gate A) ─────────────────────
 *
 * Deployment possession is a SOURCE, not an ACTOR: it is authoritative for causing the
 * mutation without identifying the human who caused it. Hebun's actor invariant is
 * BOTH-OR-NEITHER — `(x_by_type IS NULL) = (x_by_id IS NULL)`, already enforced on
 * `auth_credentials`, `auth_identities`, `invitations`, `memberships` and
 * `role_permissions`. So `updated_by_type = 'human'` with `updated_by = NULL` is false
 * provenance, not partial attribution, and a `CHECK(updated_by_type = 'human')` would
 * additionally reject every ceremony write. Both are cancelled, not deferred.
 *
 * An `audit_log` row is blocked on the same fact: `actor_id` and `actor_type` are NOT NULL
 * and no enum value means "no verified actor". That waits on a real platform principal.
 *
 * ── `control_source` — BUILT, BECAUSE R5.1'S OWN TRIGGER FIRED ───────────────
 *
 * R5.1 designed this column and deliberately did not build it: "a nullable `control_source`
 * naming the ceremony, as `companies.provisioning_source` does. Nothing reads it today." It named
 * three conditions that would earn its implementation, one of which was *"production gains a
 * provider-control write path"*. That is exactly what the production ceremony does, so the column
 * is built here rather than deferred again.
 *
 * WHY IT IS PER-TRANSITION AND NOT CREATION-ONLY. `provisioning_source` records a CREATION fact —
 * a tenant is born once. This row is a SWITCH: the writer is an upsert that both creates and
 * transitions, and `updated_at`, `updated_by` and `version` are all per-transition. A
 * creation-only `control_source` would go stale the first time a different root flipped the
 * switch — a row created locally and then disabled from production would still name the local
 * root while production caused the state now in the row. That is false provenance, which is the
 * precise thing R5.2's correction cancelled `updated_by_type` to avoid. So this column answers
 * "WHICH ROOT PRODUCED THE STATE THIS ROW NOW HOLDS", and it is rewritten on every transition.
 *
 * WHY NULLABLE, AND WHY NO BACKFILL. Rows written before this column existed keep `NULL`, and
 * NULL means exactly one thing: *written before the column existed*. It does NOT mean "unknown
 * root" and must never be read as "local". Back-filling `'local-operator-ceremony'` would be true
 * in fact — local was the only writer that had ever run — and still fabricated, because it would
 * record an observation nobody made. Because every ceremony write from here on records its own
 * root, NULL stays unambiguous.
 *
 * THE VOCABULARY IS NOT THIS TABLE'S. It is the released ceremony vocabulary, shared verbatim with
 * `companies.provisioning_source` and `genesis_nominations.nomination_source`. No third spelling
 * of these roots exists, and the CHECK below names the literals INLINE for the same reason R4A
 * did: drizzle-kit renders an interpolated constant as a bind parameter, which is not valid inside
 * a CHECK in a migration file. A test asserts the literals and the constants stay in agreement.
 */
import { pgTable, boolean, check, text, uniqueIndex, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { rootColumns } from "./_base";

export const providerConnectivityControls = pgTable(
  "provider_connectivity_controls",
  {
    ...rootColumns,
    providerKey: text("provider_key").notNull(),
    directorEnabled: boolean("director_enabled").notNull().default(false),

    /**
     * Which ceremony root produced the state this row NOW holds. NULL only for rows written
     * before the column existed — never a synonym for "local". See the header.
     */
    controlSource: varchar("control_source", { length: 64 }),
  },
  (t) => [
    uniqueIndex("provider_connectivity_controls_provider_key_uq").on(t.providerKey),

    /*
     * Only roots that exist may be named, exactly as `companies_provisioning_source_chk` and
     * `genesis_nominations_source_chk` record for their own vocabularies. `is null or` is the
     * `companies` form, not the `genesis_nominations` form, because this table has rows that
     * predate the column and they are not being rewritten.
     */
    check(
      "provider_connectivity_controls_control_source_chk",
      sql`${t.controlSource} is null or ${t.controlSource} = 'local-operator-ceremony' or ${t.controlSource} = 'production-operator-ceremony'`,
    ),
  ],
);

/**
 * A local operator ceremony — possession of the LOCAL deployment. Shares its wording with
 * `COMPANY_PROVISIONING_SOURCE_LOCAL_OPERATOR` and `GENESIS_NOMINATION_SOURCE_LOCAL_OPERATOR`
 * because it names the same root and carries the same limitation: a SOURCE, never an ACTOR, and
 * no verified human.
 */
export const PROVIDER_CONTROL_SOURCE_LOCAL_OPERATOR = "local-operator-ceremony";

/**
 * A production operator ceremony — possession of the PRODUCTION deployment.
 *
 * It carries EXACTLY the limitation its local sibling carries and changes one morpheme for one
 * reason: it names a different deployment, never a different KIND of authority. Still possession,
 * still a SOURCE and not an ACTOR. NOT a platform admin, NOT a platform operator, NOT a Governance
 * authority, NOT a tenant role. No such principal exists in Hebun.
 */
export const PROVIDER_CONTROL_SOURCE_PRODUCTION_OPERATOR = "production-operator-ceremony";
