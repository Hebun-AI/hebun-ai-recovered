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
 * A truthful alternative exists and is deliberately NOT built: a nullable `control_source`
 * naming the ceremony, as `companies.provisioning_source` does. Nothing reads it today.
 */
import { pgTable, boolean, text, uniqueIndex } from "drizzle-orm/pg-core";
import { rootColumns } from "./_base";

export const providerConnectivityControls = pgTable(
  "provider_connectivity_controls",
  {
    ...rootColumns,
    providerKey: text("provider_key").notNull(),
    directorEnabled: boolean("director_enabled").notNull().default(false),
  },
  (t) => [
    uniqueIndex("provider_connectivity_controls_provider_key_uq").on(t.providerKey),
  ],
);
