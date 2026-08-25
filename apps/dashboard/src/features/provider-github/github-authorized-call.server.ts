/*
 * provider-github/github-authorized-call.server.ts — SPEND AN INSTALLATION AUTHORIZATION, ONCE.
 *
 * ── WHY THIS EXISTS AS A SEPARATE FILE ───────────────────────────────────────
 *
 * Google's equivalent exists because its refresh ordering is the single most dangerous thing to
 * copy. GitHub's danger is different and just as worth stating once: the token this module mints
 * can read every repository the installation covers, it is created out of thin air on demand, and
 * the cheapest possible mistake is to keep one. So the rule is stated here and both seams run
 * through it.
 *
 * ── THE TOKEN NEVER LEAVES ───────────────────────────────────────────────────
 *
 * It is handed to the caller's callback and what comes back out is the callback's own result. The
 * generic is deliberately NOT `string`-shaped: A CALLER CANNOT ASK THIS FUNCTION FOR A TOKEN,
 * because it never returns one. It is not persisted, not cached, not logged, not audited, not put
 * in an error, and not reachable from any UI model — the surrounding architecture record lists all
 * seven, and every one of them is a test.
 *
 * ── WHY THERE IS NO CACHE IN v1 ─────────────────────────────────────────────
 *
 * A GitHub installation token lives an hour, so caching one would trade a single extra HTTP call
 * for holding a live credential in process memory across requests, plus a revocation question
 * nobody has answered. One mint per read is the honest cost of holding nothing.
 *
 * ── WHY IT IS NOT A CREDENTIAL ──────────────────────────────────────────────
 *
 * `integration-credentials` stores TENANT-HELD secrets: encrypted, rotated, revocable. A GitHub
 * installation token is DERIVED — re-mintable at any moment from the App key plus an installation
 * id Hebun already stores — and `integration_credential_kind` has no value that could hold one, so
 * storing it would require a migration for a value nothing needs to keep. Hebun's tenant gave
 * GitHub an installation, not a secret, and a credential row would say otherwise.
 *
 * ── IT ASKS THE AUTHORITY; IT DOES NOT DECIDE ────────────────────────────────
 *
 * There is no scope comparison here. `getCapabilityAvailability` owns the mapping, the catalog
 * owns which permissions a capability needs, and a second opinion in this file would be the
 * two-interpreters bug one layer down.
 *
 * ── IT WRITES NO LIFECYCLE ───────────────────────────────────────────────────
 *
 * A read that fails — a 429, a timeout, a refused mint — leaves the connection exactly as it was.
 * A provider outage is not a tenant losing their grant, and this module holds no connection writer
 * with which to say otherwise.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  getCapabilityAvailability,
  type CapabilityAvailabilityDeps,
} from "@/features/integration-authority/capability-availability.server";
/*
 * THE WRITER-FREE READ MODULE, NOT THE REPOSITORY (INT-5B1).
 *
 * `integration-repository.server.ts` re-exports this listing and also exports seven acts that
 * mutate the connection lifecycle, including the one that attaches a credential. Taking the listing
 * from there put every one of them into the import graph of a read — and INT-5B1 makes that graph
 * reachable from an operator command, where "no lifecycle writer is reachable" becomes a property a
 * firewall must be able to prove.
 *
 * INT-5A relocated the reads for exactly this purpose and left the signatures identical, so this is
 * a narrowing and not a behaviour change: it is the SAME `listConnections`, and there is still only
 * one of it in this repository.
 */
import { listConnections } from "@/features/integration-authority/integration-read.server";
import {
  GITHUB_PROVIDER_KEY,
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  type GitHubFailure,
} from "./contracts";
import { resolveGitHubAppEnvironment } from "./github-environment.server";
import { mintGitHubAppJwt } from "./github-app-jwt.server";
import { mintInstallationAccessToken, type GitHubTransportDeps } from "./github-transport.server";

/**
 * THE PERMISSIONS A MINTED TOKEN IS ASKED TO CARRY.
 *
 * GitHub's spelling, and exactly the two this capability declares. Narrowing may reduce a token
 * and can never widen it, so asking for these is asking for the least a repository-activity read
 * can work with.
 */
export const GITHUB_TOKEN_REQUESTED_PERMISSIONS: Readonly<Record<string, string>> = Object.freeze({
  metadata: "read",
  pull_requests: "read",
});

export interface GitHubAuthorizedCallDeps extends GitHubTransportDeps {
  /*
   * Borrowed from the authority that owns the handle rather than declared against `@/db` here: a
   * provider module has no business naming the database type, and this way it cannot drift from
   * the seam it is actually passed to.
   */
  readonly getDb?: CapabilityAvailabilityDeps["getDb"];
  readonly nowSeconds?: number;
}

/**
 * Why an authorized GitHub call did not happen.
 *
 * `capability-not-available` is the one that is not a failure at all: the organization simply has
 * not granted what this capability needs, or the connection is not usable. It is separated from
 * every provider fault because it sends a human somewhere else entirely.
 */
export type GitHubAuthorizationRefusal =
  | "no-authorized-tenant-context"
  | "connection-authority-unavailable"
  | "capability-not-available"
  | "no-github-connection"
  | "installation-identity-unavailable"
  | "github-app-not-configured";

export type GitHubAuthorizedOutcome<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly refusal: GitHubAuthorizationRefusal }
  | GitHubFailure;

/** What the callback receives: an installation token, and the installation it belongs to. */
export interface GitHubInstallationAuthorization {
  readonly installationToken: string;
  readonly installationId: number;
  /** GitHub's own statement of what the minted token carries. Compared, never assumed. */
  readonly grantedTokenPermissions: Readonly<Record<string, unknown>>;
}

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("Authorized GitHub calls are server-only.");
  }
}

/** `external_account_id` holds the installation id, written by the verified connection writer. */
function installationIdFrom(raw: string | null): number | null {
  if (!raw || !/^[1-9][0-9]{0,17}$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * RESOLVE AUTHORITY, MINT, SPEND, DISCARD — in that order, and refusing before each step.
 *
 * The ordering is the security property. Nothing is minted until the availability authority has
 * said this tenant may spend the capability, so a tenant whose organization revoked a permission
 * cannot cause a token to exist at all.
 */
export async function withGitHubInstallationToken<T>(
  tenant: TenantContext | null,
  callback: (authorization: GitHubInstallationAuthorization) => Promise<GitHubAuthorizedOutcome<T>>,
  deps: GitHubAuthorizedCallDeps = {},
): Promise<GitHubAuthorizedOutcome<T>> {
  assertServerOnly();

  /* 1 · A TRUSTED TENANT. Never an argument a caller could shape — a resolved context or nothing. */
  if (!tenant?.tenantId) {
    return { ok: false, refusal: "no-authorized-tenant-context" };
  }

  /*
   * 2 · THE CAPABILITY AUTHORITY DECIDES. Lifecycle, health and the permissions GitHub actually
   * granted, all consulted by the seam that owns them. A refusal here costs nothing and reveals
   * nothing to the provider.
   */
  const availability = await getCapabilityAvailability(tenant, { getDb: deps.getDb });
  const entry = availability.capabilities.find(
    (c) => c.capability === GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  );
  const source = entry?.sources.find((s) => s.readAvailable && s.providerKey === GITHUB_PROVIDER_KEY);
  if (!entry || entry.state !== "available" || !source) {
    return { ok: false, refusal: "capability-not-available" };
  }

  /*
   * 3 · THE CONNECTION THIS TENANT OWNS. The listing is tenant-scoped by the authority itself, so
   * the row found here cannot belong to another tenant even if the availability view were wrong.
   */
  const listing = await listConnections(tenant, deps.getDb ? { getDb: deps.getDb } : {});
  if (listing.status !== "read") {
    return { ok: false, refusal: "connection-authority-unavailable" };
  }
  const connection = listing.connections.find(
    (c) => c.integrationId === source.integrationId && c.providerKey === GITHUB_PROVIDER_KEY,
  );
  if (!connection) {
    return { ok: false, refusal: "no-github-connection" };
  }

  /* 4 · THE INSTALLATION, from the verified connection row — never from a request. */
  const installationId = installationIdFrom(connection.externalAccountId);
  if (installationId === null) {
    return { ok: false, refusal: "installation-identity-unavailable" };
  }

  /* 5 · HEBUN'S OWN CREDENTIAL. Absent configuration is an operator problem, not a tenant one. */
  const config = resolveGitHubAppEnvironment();
  if (config.status !== "configured") {
    return { ok: false, refusal: "github-app-not-configured" };
  }

  const appJwt = mintGitHubAppJwt(config.appId, config.privateKey, deps.nowSeconds);

  /* 6 · MINT. The narrowed permission set is requested; what came back is reported, not assumed. */
  const minted = await mintInstallationAccessToken(
    installationId,
    appJwt,
    GITHUB_TOKEN_REQUESTED_PERMISSIONS,
    deps,
  );
  if (!minted.ok) return minted;

  /*
   * 7 · SPEND, INSIDE THE CALLBACK. The token is a local binding of this frame. When the callback
   * settles it is unreachable, and nothing in this module ever wrote it anywhere else.
   */
  return callback({
    installationToken: minted.token,
    installationId,
    grantedTokenPermissions: minted.permissions,
  });
}
