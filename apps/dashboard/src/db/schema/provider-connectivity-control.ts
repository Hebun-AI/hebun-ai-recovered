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
 * `updatedBy` is written as NULL: deployment possession has no verified actor, and
 * naming one would be a claim no human made. `updatedByType` is likewise untouched —
 * actor-type provenance and the human-only constraint that would rest on it belong to a
 * later phase, and a type without an actor would be the fabrication it exists to prevent.
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
