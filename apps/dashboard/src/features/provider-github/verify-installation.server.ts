/*
 * provider-github/verify-installation.server.ts — TURNING A CLAIM INTO A FACT.
 *
 * ── THE ONE SENTENCE THIS MODULE EXISTS FOR ──────────────────────────────────
 *
 *   AN `installation_id` FROM A REDIRECT IS A CLAIM. THIS IS WHERE IT BECOMES A FACT, OR DOES NOT.
 *
 * GitHub's own Setup URL documentation says a bad actor can hit that URL with a spoofed id. The
 * only thing that establishes what an installation id names is asking GitHub, authenticated as the
 * App. That is all this module does.
 *
 * ── WHAT IT OWNS, AND WHAT IT REFUSES TO OWN ─────────────────────────────────
 *
 *   OWNS      provider confirmation: does this installation exist, whose is it, what account type,
 *             which repositories, which permissions, is it suspended.
 *   REFUSES   the connection lifecycle. It writes no row, opens no transaction, and imports no
 *             repository. `connect-installation.server.ts` composes this with the integration
 *             authority; neither becomes the other.
 *
 * ── NORMALISED, NEVER RAW ────────────────────────────────────────────────────
 *
 * GitHub's installation object carries `app_id`, `app_slug`, `events`, `access_tokens_url`,
 * `repositories_url`, `html_url`, `single_file_name`, timestamps and more. Returning it would put
 * every field GitHub adds in future onto a Hebun surface without anybody deciding, so a
 * `GitHubInstallationIdentity` is built field by field and everything else is dropped.
 *
 * Server-only.
 */
import {
  GITHUB_ORGANIZATION_ACCOUNT_TYPE,
  type GitHubFailure,
  type GitHubInstallationIdentity,
  type GitHubInstallationOutcome,
  type GitHubRepositorySelection,
  normalizeGrantedPermissions,
} from "./contracts";
import { resolveGitHubAppEnvironment } from "./github-environment.server";
import { mintGitHubAppJwt } from "./github-app-jwt.server";
import { fetchInstallation, type GitHubTransportDeps } from "./github-transport.server";

function assertServerOnly(): void {
  if (typeof window !== "undefined") {
    throw new Error("GitHub installation verification is server-only.");
  }
}

function fail(failure: GitHubFailure["failure"], reason: string): GitHubFailure {
  return { ok: false, failure, reason };
}

/** A required string field from an untrusted provider body, or `null`. */
function str(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** A required positive integer from an untrusted provider body, or `null`. */
function posInt(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * BUILD THE IDENTITY, OR REFUSE — every field is parsed out of an untrusted object.
 *
 * A missing or unusable field is `identity`, not `malformed`: the response parsed fine, GitHub
 * simply did not describe something Hebun can bind a connection to. Those are different operator
 * problems and the classes stay apart.
 */
function identityFrom(body: Record<string, unknown>): GitHubInstallationOutcome {
  const installationId = posInt(body["id"]);
  if (installationId === null) return fail("identity", "installation-id-missing");

  const account = body["account"];
  if (!account || typeof account !== "object" || Array.isArray(account)) {
    return fail("identity", "installation-account-missing");
  }
  const accountObj = account as Record<string, unknown>;

  const accountId = posInt(accountObj["id"]);
  if (accountId === null) return fail("identity", "account-id-missing");

  const accountLogin = str(accountObj, "login");
  if (accountLogin === null) return fail("identity", "account-login-missing");

  /*
   * ── THE ORGANIZATION-ONLY GATE ────────────────────────────────────────────
   *
   * GitHub's own field description says `account.type` "designates whether the installation
   * applies to an Organization or User account". `target_type` carries the same fact at the top
   * level, and BOTH are required to agree: a mismatch is not something to resolve in the
   * permissive direction, it is a response Hebun does not understand.
   *
   * A personal installation is REFUSED, not tolerated. Hebun's GitHub provider is organizational
   * by released Director decision, and an organizational provider that silently accepted a
   * personal account would bind a company's tenant to one individual's repositories.
   */
  const accountType = str(accountObj, "type");
  const targetType = str(body, "target_type");
  if (accountType === null || targetType === null) {
    return fail("identity", "account-type-missing");
  }
  if (accountType !== targetType) {
    return fail("identity", "account-type-disagrees-with-target-type");
  }
  if (accountType !== GITHUB_ORGANIZATION_ACCOUNT_TYPE) {
    /*
     * `identity` and not `permission`: nothing is wrong with what was granted. The installation is
     * real and perfectly valid at GitHub — it is simply not a thing this provider connects to.
     */
    return fail("identity", "installation-is-not-an-organization");
  }

  /*
   * `all` is accepted INTO the identity and refused LATER, by the connection authority. The
   * verifier's job is to report what GitHub said; deciding that an all-repository installation
   * does not meet Hebun's policy is a connection decision, and putting it here would make the
   * verifier unable to describe an installation it disapproves of.
   */
  const repositorySelection = str(body, "repository_selection");
  if (repositorySelection !== "selected" && repositorySelection !== "all") {
    return fail("identity", "repository-selection-unrecognized");
  }

  /*
   * GRANTED, NEVER REQUESTED. This is GitHub's own statement of what it gave, normalised to the
   * `name:level` form the released `integrations.scopes` column already holds. An unrecognised
   * level or a non-string value is dropped rather than invented — see the normaliser.
   */
  const permissions = body["permissions"];
  const grantedPermissions = normalizeGrantedPermissions(
    permissions && typeof permissions === "object" && !Array.isArray(permissions)
      ? (permissions as Record<string, unknown>)
      : null,
  );

  /*
   * SUSPENSION IS CARRIED, NOT SWALLOWED. GitHub suspends an installation without uninstalling it;
   * the row still exists and still answers this endpoint. A suspended installation grants nothing,
   * and the connection authority refuses it — but the verifier must be able to SAY so, or the
   * refusal would have to be inferred from an absence.
   */
  const suspendedAt = body["suspended_at"];
  const suspended = typeof suspendedAt === "string" && suspendedAt.length > 0;

  const identity: GitHubInstallationIdentity = Object.freeze({
    installationId,
    accountId,
    accountLogin,
    accountType: GITHUB_ORGANIZATION_ACCOUNT_TYPE,
    repositorySelection: repositorySelection as GitHubRepositorySelection,
    grantedPermissions,
    suspended,
  });

  return { ok: true, identity };
}

export interface VerifyInstallationDeps extends GitHubTransportDeps {
  /** Injected so a test can assert JWT claim arithmetic without a moving clock. */
  readonly nowSeconds?: number;
}

/**
 * Verify one installation id against GitHub.
 *
 * FAILS CLOSED ON CONFIGURATION. An unconfigured deployment cannot mint an App JWT, so it cannot
 * establish anything — and reports that as its own class rather than as a GitHub failure, because
 * "we are not set up" and "GitHub said no" send an operator to different places.
 */
export async function verifyGitHubInstallation(
  installationId: number,
  deps: VerifyInstallationDeps = {},
): Promise<GitHubInstallationOutcome> {
  assertServerOnly();

  const config = resolveGitHubAppEnvironment();
  if (config.status !== "configured") {
    return fail("auth", "github-app-not-configured");
  }

  const jwt = mintGitHubAppJwt(config.appId, config.privateKey, deps.nowSeconds);

  const fetched = await fetchInstallation(installationId, jwt, deps);
  if (!fetched.ok) return fetched;

  return identityFrom(fetched.body);
}
