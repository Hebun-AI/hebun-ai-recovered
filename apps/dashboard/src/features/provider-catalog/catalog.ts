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
 * ── ONE ENTRY, AND IT IS REAL ────────────────────────────────────────────────
 *
 * Through INT-1 and INT-2 this file was EMPTY, and that emptiness was the honest statement: no
 * credential store existed, no verifier existed, and listing a vendor would have offered a
 * connection no code could complete.
 *
 * INT-3 BUILT BOTH. `google-workspace` is added here because — and only because — a real OAuth
 * flow, a real credential store and a real verifier that contacts Google now exist. The rule has
 * not changed; the implementation caught up with it.
 *
 * The `architecture-fixture` entry that lived here during INT-1 implementation is still gone, for
 * the reason it was removed: every test injects its own catalog, so a production value retained
 * only to support tests is a fake fact about the deployment however well it is labelled.
 */
import type { ConnectionDefinition, ProviderCatalog } from "@/features/integration-authority/contracts";
/*
 * The capability key and its scope live with the provider that defines them, not here. This file
 * says WHICH capabilities a provider offers; `provider-google` says what they mean to Google.
 */
import {
  GOOGLE_DRIVE_METADATA_CAPABILITY,
  GOOGLE_DRIVE_METADATA_SCOPE,
} from "@/features/provider-google/contracts";
import {
  GITHUB_PROVIDER_KEY,
  GITHUB_REQUIRED_GRANTED_PERMISSIONS,
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  GITHUB_REPOSITORY_ACTIVITY_READ_PERMISSIONS,
  GITHUB_REPOSITORY_ACTIVITY_WRITE_PERMISSIONS,
} from "@/features/provider-github/contracts";

/**
 * THE CATALOG. Frozen at every level — a caller cannot push a definition into it at runtime any
 * more than a database row can add one.
 *
 * ── WHY `capabilityScopes` IS EMPTY, AND WHY THAT IS NOT AN OVERSIGHT ────────
 *
 * INT-3 connects and verifies. It reads no Drive file, no Calendar event and no directory entry,
 * because it requests no scope that would permit any of them. A capability listed here would make
 * the availability seam offer something Hebun cannot deliver — the exact false claim the seam
 * exists to prevent. Capabilities arrive in the phase that builds the reads they name.
 *
 * ── `minimumScopes` IS WRITTEN IN GOOGLE'S SPELLING ─────────────────────────
 *
 * A request for `email` comes back from the token endpoint as the full
 * `https://www.googleapis.com/auth/userinfo.email`. These are the values Google GRANTS, so a
 * comparison against a stored grant is comparing like with like rather than against what Hebun
 * happened to ask for.
 */
export const PROVIDER_CATALOG: ProviderCatalog = Object.freeze([
  Object.freeze({
    providerKey: "google-workspace",
    label: "Google Workspace",
    authMethod: "oauth2",
    /*
     * A connection is bound to a Google ACCOUNT (`sub`), and `hd` is observed as a domain when the
     * account has one. Workspace CUSTOMER identity needs an Admin SDK scope this phase does not
     * request, so it is not claimed anywhere.
     */
    accountIdentity: "account",
    connectivity: "connectable",
    minimumScopes: Object.freeze([
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ]),
    /*
     * ── ONE CAPABILITY, ADDED BY INT-4 ──────────────────────────────────────
     *
     * Through INT-3 this was empty, and the header above said why: a capability listed here makes
     * the availability seam offer something Hebun cannot deliver. INT-4 built the Drive metadata
     * read, so the entry appears — the rule did not change, the implementation caught up with it.
     *
     * `write` IS DELIBERATELY EMPTY, and that now MEANS something. The availability seam treats an
     * empty write set as "no write capability exists" rather than "vacuously satisfied", so this
     * connection reports `writeCapable: false` however generous the tenant's grant becomes. Drive
     * write is not a scope away; it is a phase away.
     *
     * No content capability is listed, because `drive.metadata.readonly` cannot download a file.
     */
    capabilityScopes: Object.freeze({
      [GOOGLE_DRIVE_METADATA_CAPABILITY]: Object.freeze({
        read: Object.freeze([GOOGLE_DRIVE_METADATA_SCOPE]),
        write: Object.freeze([]),
      }),
    }),
  }) satisfies ConnectionDefinition,
  /*
   * ── GITHUB, AND `connectable` IS NOW TRUE ─────────────────────────────────
   *
   * GITHUB-1 wrote this entry and then DELETED it before release, for the reason this file's own
   * header states: "listing a vendor would have offered a connection no code could complete."
   * GitHub needed no credential store — nothing tenant-side is persisted — but it needed a
   * VERIFIER, and there was none. A `connectable` entry would have made `/integrations` offer a
   * connection and let a tenant create a `draft` row that could never progress.
   *
   * GITHUB-2 BUILT THE VERIFIER. `verify-installation.server.ts` asks GitHub, authenticated as the
   * App, what an installation id actually names; `connect-installation.server.ts` composes that
   * answer with the released lifecycle authority. The rule has not changed — the implementation
   * caught up with it, which is exactly what INT-3 recorded when `google-workspace` first appeared
   * here.
   *
   * ── WHAT IS STILL NOT CLAIMED ─────────────────────────────────────────────
   *
   * No GitHub App is registered in any deployment yet, so every tenant reads `not-connected` and
   * the start route fails closed on missing configuration. That is the connection lifecycle saying
   * so, not this comment: an entry here makes a provider CONNECTABLE, never CONNECTED.
   *
   * ── `github-organization`, NOT `github` ───────────────────────────────────
   *
   * `features/providers/github` is the SIMULATION provider and its id is the bare string `github`.
   * Sharing that literal would make a log line ambiguous and a firewall unwritable. The key also
   * records the Director decision it implements: this is an ORGANIZATIONAL provider.
   *
   * ── `minimumScopes` IS WRITTEN IN GITHUB'S SPELLING ───────────────────────
   *
   * GitHub grants a MAP, `{"metadata": "read"}`, where Google grants a list. Each entry is
   * flattened to `name:level` using GitHub's own property spelling — `pull_requests`, not
   * `pullRequests`. The column is an existing `jsonb` `string[]` and the availability seam compares
   * by exact membership, so this needs NO migration and NO new column.
   */
  Object.freeze({
    providerKey: GITHUB_PROVIDER_KEY,
    label: "GitHub",
    /*
     * NOT `oauth2`. There is no authorization-code exchange for the connection and no tenant-held
     * refresh token; see the vocabulary note on `ProviderAuthMethod`.
     */
    authMethod: "github_app",
    /*
     * A connection is bound to a GitHub ORGANIZATION account. A personal (`User`) installation is
     * refused by the verifier rather than tolerated.
     */
    accountIdentity: "organization",
    connectivity: "connectable",
    /*
     * ONE PERMISSION TO BE CONNECTED. An installation granting metadata and nothing else is a real
     * connection to a real organization; it simply cannot answer the capability below, and the
     * availability seam reports that as a scope gap rather than as "not connected".
     */
    minimumScopes: GITHUB_REQUIRED_GRANTED_PERMISSIONS,
    /*
     * ── ONE CAPABILITY, AND `write` IS EMPTY ON PURPOSE ─────────────────────
     *
     * The availability seam treats an empty write list as "no write capability exists" rather than
     * as vacuously satisfied, so this connection reports `writeCapable: false` however generous an
     * organization's installation becomes. No write permission is requested anywhere in this
     * repository.
     *
     * THE CAPABILITY IS DECLARED AND NOT YET EXECUTABLE. GITHUB-2 connects; it reads no repository
     * and no pull request, and the transport knows only the installation endpoint. The reachability
     * gate will therefore report this capability `NOT-IMPLEMENTED`, which is the truth.
     *
     * NO CONTENT CAPABILITY IS LISTED, and no permission requested here can list commits: GitHub
     * places `GET /repos/{owner}/{repo}/commits` under the SAME `contents` permission as
     * `GET /repos/{owner}/{repo}/contents/{path}`, so commit metadata is deferred rather than
     * bought together with source-file access.
     */
    capabilityScopes: Object.freeze({
      [GITHUB_REPOSITORY_ACTIVITY_CAPABILITY]: Object.freeze({
        read: GITHUB_REPOSITORY_ACTIVITY_READ_PERMISSIONS,
        write: GITHUB_REPOSITORY_ACTIVITY_WRITE_PERMISSIONS,
      }),
    }),
  }) satisfies ConnectionDefinition,
]);

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
