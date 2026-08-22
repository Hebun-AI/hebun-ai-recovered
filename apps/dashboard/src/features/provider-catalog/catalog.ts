/*
 * provider-catalog/catalog.ts — WHICH PROVIDERS A TENANT MAY CONNECT TO (I1).
 *
 * ── A FROZEN CODE LITERAL, NOT A TABLE ───────────────────────────────────────
 *
 * The `providers` table exists, is dormant, and STAYS dormant. It is an FK/reference anchor and
 * nothing more. This file is the authority.
 *
 * The reasoning is already released, in `action-execution/adapter-registry.server.ts`: activating a
 * table to hold what may run creates "a row somebody could add to make a new external capability
 * appear without a migration, a review or a test". The same is true one layer earlier. If a
 * `providers` row could make a provider connectable, then INSERT privilege would be equivalent to
 * shipping a connector — and nothing in this repository grants a connector by INSERT.
 *
 * So: no database row can add a provider here, and a definition without a code change is
 * unrepresentable rather than merely discouraged.
 *
 * ── DEFINITIONS, NOT ADAPTERS ────────────────────────────────────────────────
 *
 * Every entry is PURE DATA. There is no adapter, no transport, no client, no endpoint, no URL, no
 * fetch and no function in this file or in the type it produces. A definition says what a provider
 * would need in order to be connected; it cannot connect to anything, and it cannot be executed.
 *
 * This is deliberately NOT a second destination or runtime registry. `adapter-registry.server.ts`
 * remains the sole authority on what may RUN, and it does not read this file. The two answer
 * different questions and neither can answer the other's.
 *
 * ── WHY THERE IS NO REAL PROVIDER HERE ───────────────────────────────────────
 *
 * A `connectable` definition claims Hebun can establish a real connection. That requires a
 * credential store, an encryption boundary, a key registry and a verifier. I1 builds NONE of them
 * — that is I2 — so the released catalog contains ZERO connectable entries, and
 * `catalog-honesty.ts` asserts it rather than trusting this paragraph.
 *
 * Listing `google-workspace` or `slack` here today would be the exact false claim this phase
 * exists to make impossible: a surface would offer a connection that no code can complete.
 *
 * ── THE RELEASED CATALOG IS EMPTY, AND THAT IS THE TRUTH BEING SHIPPED ───────
 *
 * NO ENTRIES AT ALL. Not one connectable provider, and not one fixture either.
 *
 * An `architecture-fixture` entry lived here through implementation, so the repository, the schema
 * and the state machine could be exercised against a real catalog value. It was removed before
 * release because it was never NEEDED here: every test that touches a definition already injects
 * its own catalog through the `catalog` dependency — `tenant-isolation-postgres` declares both a
 * `connectable` and a `fixture` entry, and `availability-seam` declares its own — and not one test
 * required this file to be non-empty. A production value retained only to support tests that do
 * not use it is a fake fact about the deployment, however well it is labelled.
 *
 * So the released count is the honest one: ZERO connectable providers, ZERO definitions, and a
 * `createConnection` call in production that can only ever refuse `unknown-provider`.
 */
import type { ConnectionDefinition, ProviderCatalog } from "@/features/integration-authority/contracts";

/**
 * THE CATALOG. EMPTY, and frozen — a caller cannot push a definition into it at runtime any more
 * than a database row can add one.
 *
 * When the first real provider arrives it is added HERE, in code, with a migration-free but
 * reviewable one-entry diff, and `catalog-honesty` in `boundaries-and-firewall` fails on that same
 * commit until the phase that adds it deliberately updates the count it asserts.
 */
export const PROVIDER_CATALOG: ProviderCatalog = Object.freeze([]);

/** The definition for a key, or `undefined`. A key with no entry is not a provider. */
export function findProviderDefinition(
  providerKey: string,
  catalog: ProviderCatalog = PROVIDER_CATALOG,
): ConnectionDefinition | undefined {
  return catalog.find((entry) => entry.providerKey === providerKey);
}

/**
 * The definitions a tenant may actually connect to. EMPTY for the whole of I1.
 *
 * The availability seam reads this and never the raw catalog, which is what keeps a fixture from
 * ever reaching a surface.
 */
export function listConnectableProviders(
  catalog: ProviderCatalog = PROVIDER_CATALOG,
): ProviderCatalog {
  return catalog.filter((entry) => entry.connectivity === "connectable");
}

/**
 * Every capability any connectable provider maps, de-duplicated and sorted.
 *
 * Sorted so the availability view has a stable order that does not depend on catalog authoring
 * order — an unstable list makes a surface diff on nothing.
 */
export function listConnectableCapabilities(
  catalog: ProviderCatalog = PROVIDER_CATALOG,
): readonly string[] {
  const capabilities = new Set<string>();
  for (const definition of listConnectableProviders(catalog)) {
    for (const capability of Object.keys(definition.capabilityScopes)) {
      capabilities.add(capability);
    }
  }
  return [...capabilities].sort();
}
