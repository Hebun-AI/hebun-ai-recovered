/*
 * provider-github/read-repository-pull-requests.server.ts — BOUNDED OPEN PULL-REQUEST METADATA.
 *
 * ── THE RULE THIS FILE EXISTS FOR ────────────────────────────────────────────
 *
 *   A CALLER-SUPPLIED REPOSITORY ID IS A CLAIM. IT BECOMES AN ADDRESS ONLY AFTER GITHUB'S OWN
 *   INSTALLATION LISTING NAMES IT.
 *
 * That is the same discipline GITHUB-2 applied to `installation_id` arriving from a redirect, one
 * layer up. The `owner` and `repo` path segments are taken from the matched listing entry and
 * NEVER from the caller, so a caller cannot address a repository the installation does not cover —
 * not by guessing a name, not by passing one directly, because no parameter for one exists.
 *
 * ── ONE TOKEN, TWO CALLS ─────────────────────────────────────────────────────
 *
 * Discovery and the pull-request read happen inside a SINGLE authorization frame. Two frames would
 * mint two tokens for one logical read, and — worse — would let the listing that proved the
 * repository be older than the read that trusted it.
 *
 * ── METADATA, AND STRUCTURALLY NOTHING ELSE ──────────────────────────────────
 *
 * `GitHubPullRequestView` has no `patch`, no `diff`, no `body`, no `files`, no `commits` and no
 * `head.sha`. The shape has no hole for content, so a caller holding one cannot surface a line of
 * source code whatever the granted permission would have allowed. The transport pins the JSON
 * media type for the same reason: this endpoint returns a unified DIFF under a different Accept
 * header at IDENTICAL permission.
 *
 * `title` and `authorLogin` are UNTRUSTED PROVIDER TEXT. They are data on every surface that
 * renders them — never an instruction, never markup, never something to execute.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  MAX_PULL_REQUESTS_PER_PAGE,
  type GitHubPullRequestView,
  type GitHubRepositoryView,
} from "./contracts";
import {
  withGitHubInstallationToken,
  type GitHubAuthorizedCallDeps,
  type GitHubAuthorizedOutcome,
} from "./github-authorized-call.server";
import { listInstallationRepositories, listOpenPullRequests } from "./github-transport.server";

/** The capability this seam spends, named so the reachability gate can see it. */
export const PULL_REQUEST_CAPABILITY = GITHUB_REPOSITORY_ACTIVITY_CAPABILITY;

function str(body: Record<string, unknown>, key: string): string | null {
  const value = body[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function posInt(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

/**
 * ONE PULL REQUEST, NORMALIZED — or `null`, which drops it.
 *
 * `state` is narrowed to the two values Hebun's shape declares. GitHub returning something else is
 * a response this provider does not understand, and coercing it to `open` would be inventing a
 * fact about somebody's engineering work.
 */
function pullRequestFrom(raw: unknown): GitHubPullRequestView | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;

  const number = posInt(body["number"]);
  if (number === null) return null;

  const title = str(body, "title");
  if (title === null) return null;

  const state = str(body, "state");
  if (state !== "open" && state !== "closed") return null;

  const user = body["user"];
  const authorLogin =
    user && typeof user === "object" && !Array.isArray(user)
      ? str(user as Record<string, unknown>, "login")
      : null;

  return Object.freeze({
    number,
    title,
    state,
    isDraft: body["draft"] === true,
    authorLogin,
    createdAt: str(body, "created_at"),
    updatedAt: str(body, "updated_at"),
  });
}

function repositoryFrom(raw: unknown): { id: number; owner: string; repo: string; fullName: string } | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;

  const id = posInt(body["id"]);
  if (id === null) return null;

  const name = str(body, "name");
  const fullName = str(body, "full_name");
  if (name === null || fullName === null) return null;

  const ownerObject = body["owner"];
  const owner =
    ownerObject && typeof ownerObject === "object" && !Array.isArray(ownerObject)
      ? str(ownerObject as Record<string, unknown>, "login")
      : null;
  if (owner === null) return null;

  return { id, owner, repo: name, fullName };
}

export interface GitHubRepositoryActivity {
  /** The repository AS GITHUB NAMED IT — the caller's id is only ever a lookup key. */
  readonly repository: Pick<GitHubRepositoryView, "repositoryId" | "fullName">;
  readonly openPullRequests: readonly GitHubPullRequestView[];
  readonly truncated: boolean;
}

/**
 * READ ONE REPOSITORY'S OPEN PULL-REQUEST METADATA.
 *
 * `repositoryId` is a number the caller chose. It is proven against the live installation listing
 * before anything is addressed, and the refusal for an unknown id is deliberately the same whether
 * the repository does not exist, belongs to another organization, or was removed from the
 * installation five seconds ago: Hebun knows only that this installation does not cover it.
 */
export async function readRepositoryPullRequests(
  tenant: TenantContext | null,
  repositoryId: number,
  deps: GitHubAuthorizedCallDeps = {},
): Promise<GitHubAuthorizedOutcome<GitHubRepositoryActivity>> {
  if (!Number.isSafeInteger(repositoryId) || repositoryId <= 0) {
    return { ok: false, failure: "malformed", reason: "repository-id-not-a-positive-integer" };
  }

  return withGitHubInstallationToken<GitHubRepositoryActivity>(
    tenant,
    async ({ installationToken }) => {
      /* 1 · WHAT DOES THE INSTALLATION ACTUALLY COVER? Asked live, every time. */
      const listed = await listInstallationRepositories(installationToken, deps);
      if (!listed.ok) return listed;

      const listBody = listed.body;
      if (!listBody || typeof listBody !== "object" || Array.isArray(listBody)) {
        return { ok: false, failure: "malformed", reason: "github-response-not-an-object" };
      }
      const rawRepositories = (listBody as Record<string, unknown>)["repositories"];
      if (!Array.isArray(rawRepositories)) {
        return { ok: false, failure: "malformed", reason: "github-response-carried-no-repositories" };
      }

      /* 2 · IS THE CLAIMED REPOSITORY ONE OF THEM? Matched on the immutable id, never on a name. */
      const match = rawRepositories
        .map(repositoryFrom)
        .find((r): r is NonNullable<ReturnType<typeof repositoryFrom>> => r !== null && r.id === repositoryId);

      if (!match) {
        return { ok: false, failure: "permission", reason: "repository-outside-installation" };
      }

      /* 3 · ADDRESS IT WITH GITHUB'S OWN SEGMENTS. The caller never supplied these. */
      const fetched = await listOpenPullRequests(match.owner, match.repo, installationToken, deps);
      if (!fetched.ok) return fetched;

      if (!Array.isArray(fetched.body)) {
        return { ok: false, failure: "malformed", reason: "github-response-not-a-list" };
      }

      const bounded = fetched.body.slice(0, MAX_PULL_REQUESTS_PER_PAGE);
      const openPullRequests = bounded
        .map(pullRequestFrom)
        .filter((p): p is GitHubPullRequestView => p !== null);

      return {
        ok: true,
        value: Object.freeze({
          repository: Object.freeze({ repositoryId: match.id, fullName: match.fullName }),
          openPullRequests: Object.freeze(openPullRequests),
          /* A full page may mean there are more. Saying so is cheaper than implying a total. */
          truncated: fetched.body.length > bounded.length,
        }),
      };
    },
    deps,
  );
}
