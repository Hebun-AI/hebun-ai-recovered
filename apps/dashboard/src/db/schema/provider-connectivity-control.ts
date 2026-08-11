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
 * so the Director control that gates them is platform-wide for this first slice.
 * `version` (rootColumns) carries optimistic-concurrency; `updatedBy` carries actor
 * attribution — both written on every change.
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
