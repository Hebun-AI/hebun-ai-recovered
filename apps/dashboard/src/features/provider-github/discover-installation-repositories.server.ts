/*
 * provider-github/discover-installation-repositories.server.ts — WHAT THIS INSTALLATION COVERS.
 *
 * ── THE QUESTION HEBUN COULD NOT ANSWER UNTIL NOW ────────────────────────────
 *
 * GITHUB-2 verified an installation and learned `repository_selection: "selected"` — that the
 * organization scoped the grant. It never learned WHICH repositories, because `GET
 * /app/installations/{id}` does not name them and the transport had no other address. The Stage T
 * closure recorded that as `SELECTED REPOSITORY IDENTITY: UNAVAILABLE`. This seam is the answer.
 *
 * ── LIVE, AND DELIBERATELY NOT STORED ────────────────────────────────────────
 *
 * Every call asks GitHub. There is no repositories table, no cache row and no Knowledge record,
 * and that is a correctness decision before it is a cost one: an installation's selection changes
 * on GitHub's side without telling Hebun, so a stored list would keep claiming a repository the
 * organization had removed. A provider observation is not an organizational fact.
 *
 * ── IDENTITY IS THE NUMBER ───────────────────────────────────────────────────
 *
 * `repositoryId` is GitHub's immutable numeric id. `full_name` changes on a rename and again on a
 * transfer, so it is display and addressing text — never identity, and never authority.
 *
 * ── FIELD BY FIELD, NEVER THE PROVIDER'S OBJECT ──────────────────────────────
 *
 * GitHub's repository resource carries permissions, owner records, clone URLs, licence bodies,
 * security-and-analysis settings and forty URL templates. Returning it would put every field
 * GitHub adds in future onto a Hebun surface without anybody deciding, so a `GitHubRepositoryView`
 * is built one field at a time and everything else is dropped.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  MAX_REPOSITORIES_PER_PAGE,
  type GitHubRepositoryView,
} from "./contracts";
import {
  withGitHubInstallationToken,
  type GitHubAuthorizedCallDeps,
  type GitHubAuthorizedOutcome,
} from "./github-authorized-call.server";
import { listInstallationRepositories } from "./github-transport.server";

/**
 * The capability this seam spends, named so the reachability gate can see it.
 *
 * Referenced rather than merely imported: the gate walks the import graph for a module that NAMES
 * the capability and can reach a transport, and a constant that is imported but unused would be
 * removed by the next reader.
 */
export const DISCOVERY_CAPABILITY = GITHUB_REPOSITORY_ACTIVITY_CAPABILITY;

/** A required string field from an untrusted provider body, or `null`. */
function str(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function bool(value: unknown): boolean {
  return value === true;
}

/** GitHub's numeric ids are positive safe integers. Anything else is not an identity. */
function posInt(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * ONE REPOSITORY, NORMALIZED — or `null`, which drops it.
 *
 * A repository Hebun cannot identify is not reported as a nameless row: an entry without a numeric
 * id or a full name is something this provider does not understand, and inventing a placeholder
 * would put a repository on a surface that no organization can act on.
 */
function repositoryFrom(raw: unknown): GitHubRepositoryView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;

  const repositoryId = posInt(body["id"]);
  if (repositoryId === null) return null;

  const fullName = str(body, "full_name");
  if (fullName === null) return null;

  return Object.freeze({
    repositoryId,
    fullName,
    isPrivate: bool(body["private"]),
    isArchived: bool(body["archived"]),
    defaultBranch: str(body, "default_branch"),
    updatedAt: str(body, "updated_at"),
  });
}

export interface GitHubRepositoryDiscovery {
  readonly repositories: readonly GitHubRepositoryView[];
  /** GitHub's own count for the installation, when it reports one. A bound is not a total. */
  readonly totalReportedByProvider: number | null;
  /** `true` when the provider reported more than one bounded page holds. */
  readonly truncated: boolean;
}

/**
 * DISCOVER THE REPOSITORIES THIS TENANT'S INSTALLATION COVERS.
 *
 * The tenant comes from an already-resolved server-side context. Nothing here accepts a tenant id,
 * an installation id, an owner or a repository name — there is no argument a caller could use to
 * point this read at somebody else's organization.
 */
export async function discoverInstallationRepositories(
  tenant: TenantContext | null,
  deps: GitHubAuthorizedCallDeps = {},
): Promise<GitHubAuthorizedOutcome<GitHubRepositoryDiscovery>> {
  return withGitHubInstallationToken<GitHubRepositoryDiscovery>(
    tenant,
    async ({ installationToken }) => {
      const fetched = await listInstallationRepositories(installationToken, deps);
      if (!fetched.ok) return fetched;

      const body = fetched.body;
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { ok: false, failure: "malformed", reason: "github-response-not-an-object" };
      }

      const raw = (body as Record<string, unknown>)["repositories"];
      if (!Array.isArray(raw)) {
        return { ok: false, failure: "malformed", reason: "github-response-carried-no-repositories" };
      }

      const repositories = raw
        .slice(0, MAX_REPOSITORIES_PER_PAGE)
        .map(repositoryFrom)
        .filter((r): r is GitHubRepositoryView => r !== null);

      const total = posInt((body as Record<string, unknown>)["total_count"]);

      return {
        ok: true,
        value: Object.freeze({
          repositories: Object.freeze(repositories),
          totalReportedByProvider: total,
          /* Stated rather than hidden: a bounded read that silently dropped rows would read as a total. */
          truncated: total !== null && total > repositories.length,
        }),
      };
    },
    deps,
  );
}
