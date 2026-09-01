/*
 * heby-commands/provider-read-commands.server.ts — the server execution of PROVIDER-READ slash
 * commands (INT-5B1).
 *
 * ── A SIBLING OF THE READ EXECUTOR, AND DELIBERATELY A SEPARATE MODULE ───────
 *
 * `read-commands.server.ts` answers from sources this repository already holds. Its contract is
 * ZERO provider dispatch, a released firewall enforces it, and INT-5B1 does not touch either. This
 * module is the one place where a Heby command may leave the building.
 *
 * The split is the R3A.1 arrangement, applied to a second axis. There, a separate module exists so
 * "a read must never be one edited line away from becoming a write". Here, so a read must never be
 * one edited line away from becoming a PROVIDER CALL. Two files, two import graphs, two firewall
 * roots — instead of one file whose behaviour depends on which `case` a handler fell into.
 *
 * ── WHAT IT MAY DO, EXACTLY ──────────────────────────────────────────────────
 *
 * Read one bounded page of records from ONE connected external provider, tenant-scoped, after the
 * integration capability authority has said this organization may. That is the whole of it.
 *
 * ── WHAT IT STRUCTURALLY CANNOT DO ───────────────────────────────────────────
 *
 * It imports no model client and selects no transport, so a provider read cannot become a model
 * request. It imports no Knowledge module, so nothing it reads can become an organizational fact.
 * It imports no connection lifecycle writer, so a provider failure cannot end a tenant's grant. It
 * imports no action authorization and no execution surface. It imports no secret accessor: the
 * installation authorization is minted and spent inside the released seam's own callback frame and
 * never comes back out. A firewall walks the real import graph and proves each of these rather than
 * trusting this paragraph.
 *
 * ── THE RESULT IS AN OBSERVATION, NOT A RECORD HEBUN OWNS ────────────────────
 *
 * Every line it returns is provider-derived, read live at the moment of the command, and stored
 * nowhere. There is no table, no cache and no synchronization: an installation's coverage changes
 * on the provider's side without telling Hebun, so a kept copy would go on claiming a repository
 * the organization had removed.
 *
 * Server-only.
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  GITHUB_PROVIDER_KEY,
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  MAX_PULL_REQUESTS_PER_PAGE,
  MAX_REPOSITORIES_PER_PAGE,
  type GitHubRepositoryView,
} from "@/features/provider-github/contracts";
import {
  discoverInstallationRepositories,
  type GitHubRepositoryDiscovery,
} from "@/features/provider-github/discover-installation-repositories.server";
/*
 * INT-5B2. The seam GITHUB-4 built against the real GitHub API and that NOTHING consumed until
 * now. It is imported, never re-implemented: it owns the rule that a repository id is a CLAIM
 * until GitHub's own installation listing names it, and it owns the shape that has no field for a
 * diff, a patch, a body, a file or a commit. A second reader here would be a second interpreter of
 * both, which is the defect that seam exists to prevent.
 */
import {
  readRepositoryPullRequests,
  type GitHubRepositoryActivity,
} from "@/features/provider-github/read-repository-pull-requests.server";
import type { GitHubAuthorizedCallDeps, GitHubAuthorizedOutcome } from "@/features/provider-github/github-authorized-call.server";
/*
 * THE SHARED PROVIDER VOCABULARY (INT-5C).
 *
 * These sentences moved to their own module when a SECOND command began reading the same provider
 * seam. They did not change and they were not copied: one provider answer must produce one wording,
 * or the two commands would drift the first time either was edited. This module's own public
 * surface is unchanged by that move — the executor, the identity builder, the budget and the
 * provenance line are still what it offers.
 */
import { FAILURE_LINES, REFUSAL_LINES, boundaryLines } from "./provider-read-vocabulary";
import { findHebyCommandById } from "./registry";
import type { HebyCommandResult } from "./contracts";

/**
 * THE PROVIDER-READ BUDGET, owned by the command boundary.
 *
 * ── WHY IT IS NOT THE MODEL BUDGET ──────────────────────────────────────────
 *
 * `live-spend-budget.server.ts` bounds how many live model calls one PROCESS may make. It is an
 * Anthropic ceiling and defines no provider authority; reusing it would let a model budget silently
 * govern an organization's own GitHub quota, and exhausting one would refuse the other.
 *
 * ── WHY IT IS NOT A CROSS-PROVIDER FRAMEWORK ────────────────────────────────
 *
 * There is one provider-read command and one provider. A generic budget owner would be a shared
 * authority invented before a second consumer exists to disagree with it, which is how a seam ends
 * up shaped by its first caller and wrong for its second.
 *
 * Every number here is a CEILING this module enforces itself. The released seam already bounds its
 * own page at `MAX_REPOSITORIES_PER_PAGE`; stating the bound again at this boundary is what makes
 * the command's promise independent of a constant defined two features away.
 */
export const GITHUB_PROVIDER_READ_BUDGET = Object.freeze({
  /** One command may consult one provider. There is no cross-provider fan-out. */
  maxProviders: 1,
  /** The released seam spends exactly two: minting the installation authorization, then listing. */
  maxProviderCalls: 2,
  /** One page. A second page would be a data export wearing a command's clothes. */
  maxPages: 1,
  /** Never more rows than the released page bound, restated here on purpose. */
  maxRecords: MAX_REPOSITORIES_PER_PAGE,
  /** Per HTTP call, matching the transport's own released default. */
  providerTimeoutMs: 10_000,
  /** The whole command, including both calls. Bounds what the transport bounds individually. */
  totalTimeoutMs: 20_000,
  /** One provider request in flight at a time. Nothing here runs concurrently. */
  concurrency: 1,
} as const);

/**
 * THE PULL-REQUEST READ BUDGET (INT-5B2) — a SIBLING constant, never a widening of the one above.
 *
 * `/repositories` spends exactly two provider calls: minting the installation authorization, then
 * listing. This command spends more, and the ceiling says so out loud rather than quietly
 * inheriting a number written for a different command:
 *
 *     1 discovery call frame   mint + list                     which repositories exist
 *     N activity call frames   mint + list + pull requests      one per repository examined
 *
 * The re-listing inside each frame is NOT waste. It is the released seam's security property: the
 * listing that proves a repository is never older than the read that trusts it. Skipping it would
 * mean trusting a repository id proven a second ago, which is exactly what GITHUB-4 refused to do.
 *
 * `maxRepositoriesExamined` is what keeps that bounded, and it is DECLARED IN THE OUTPUT whenever
 * it bites. An organization with more repositories than this gets a truthful partial answer that
 * says it is partial — never a silent one.
 */
export const GITHUB_PULL_REQUEST_READ_BUDGET = Object.freeze({
  /** One command may consult one provider. There is no cross-provider fan-out. */
  maxProviders: 1,
  /** Repositories this command will look inside, at most. A ceiling, never a page size. */
  maxRepositoriesExamined: 3,
  /** Discovery (2) plus three activity frames (3 each). Stated, so it cannot drift unnoticed. */
  maxProviderCalls: 2 + 3 * 3,
  /** One page per repository. A second page would be a data export wearing a command's clothes. */
  maxPages: 1,
  /** Never more rows per repository than the released page bound, restated here on purpose. */
  maxRecordsPerRepository: MAX_PULL_REQUESTS_PER_PAGE,
  /** Per HTTP call, matching the transport's own released default. */
  providerTimeoutMs: 10_000,
  /** The whole command, including every frame. Wider than `/repositories`, and for a stated reason. */
  totalTimeoutMs: 45_000,
  /** One provider request in flight at a time. Nothing here runs concurrently. */
  concurrency: 1,
} as const);

/** The single client-controlled input. It carries NO authority. */
export interface HebyProviderReadCommandInput {
  /** A registry command id. Anything that is not an available provider-read command is refused. */
  readonly commandId: string;
  readonly args: readonly string[];
}

export interface HebyProviderReadCommandDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  /**
   * The released GitHub discovery seam. Injectable so the whole command is provable with no
   * network, no key and no database — never so a caller can supply a different provider.
   */
  readonly discover?: (
    tenant: TenantContext | null,
    deps: GitHubAuthorizedCallDeps,
  ) => Promise<GitHubAuthorizedOutcome<GitHubRepositoryDiscovery>>;
  /**
   * The released GitHub pull-request seam (GITHUB-4). Injectable for the same reason `discover` is:
   * so every branch — an answer, a refusal, a provider fault, a repository that vanished between
   * discovery and the read — is provable with no network and no key. Never so a caller can supply a
   * different provider, and never so a caller can supply a repository.
   */
  readonly readPullRequests?: (
    tenant: TenantContext | null,
    repositoryId: number,
    deps: GitHubAuthorizedCallDeps,
  ) => Promise<GitHubAuthorizedOutcome<GitHubRepositoryActivity>>;
  /** Injected only so the total-timeout ceiling is testable without waiting twenty seconds. */
  readonly totalTimeoutMs?: number;
}

export type HebyProviderReadCommandResult =
  | { readonly status: "unauthorized" }
  /** The command id was not a runnable PROVIDER-READ command. No provider was contacted. */
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "ok"; readonly result: HebyCommandResult };

/**
 * Named for what it is and for what it is not, so a reader of a rendered line cannot conclude that
 * Hebun now holds these repositories, or that anyone endorsed them by looking at them.
 */
export const GITHUB_REPOSITORY_READ_PROVENANCE =
  "Read live from GitHub just now, for the installation your organization connected, scoped to your " +
  "tenant (authoritative: false). Provider-derived observation, not organizational truth: nothing " +
  "was stored, indexed or admitted anywhere, and asking again re-reads it. GitHub decides what this " +
  "installation covers, and it can change there without telling Hebun.";

/**
 * THE EVIDENCE IDENTITY, joined from keys that are already owned elsewhere.
 *
 * `GITHUB_PROVIDER_KEY` is the catalog's key, the capability key is the provider module's, and the
 * repository id is GitHub's own immutable numeric id. INT-5B1 mints no identifier of its own.
 *
 * IT IS NEVER `full_name`. A repository's full name changes on a rename and again on a transfer, so
 * an identity built from it would silently follow the name rather than the repository. The number
 * is never reassigned; the name is display and addressing text.
 */
export function githubRepositoryRecordRef(repositoryId: number): string {
  return `integrations/${GITHUB_PROVIDER_KEY}/${GITHUB_REPOSITORY_ACTIVITY_CAPABILITY}/repository/${repositoryId}`;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Heby provider-read commands are server-only.");
  }
}

function ok(command: string, title: string, lines: readonly string[]): HebyProviderReadCommandResult {
  return {
    status: "ok",
    result: { command, title, lines, tone: "info", provenance: GITHUB_REPOSITORY_READ_PROVENANCE },
  };
}

/**
 * A refusal or a provider fault. It is rendered in an unavailable tone so it can NEVER be mistaken
 * for a result, and it carries its own provenance saying what did not happen.
 *
 * THIS IS THE `UNAVAILABLE != EMPTY` BOUNDARY. Every path that did not obtain a page comes through
 * here, and none of them can produce a list. A provider that did not answer has not told Hebun that
 * there is nothing there.
 */
function unavailable(
  command: string,
  title: string,
  lines: readonly string[],
): HebyProviderReadCommandResult {
  return {
    status: "ok",
    result: {
      command,
      title,
      lines,
      tone: "unavailable",
      provenance:
        "No repository list was obtained, so none is shown. This is not an empty result: Hebun is " +
        "not reporting that your organization has no repositories. Nothing was stored and nothing " +
        "about your connection was changed.",
    },
  };
}

/** One repository, as one line, carrying its own stable reference. */
function repositoryLine(repository: GitHubRepositoryDiscovery["repositories"][number]): string {
  const flags: string[] = [repository.isPrivate ? "private" : "public"];
  if (repository.isArchived) flags.push("archived");
  if (repository.defaultBranch) flags.push(`default ${repository.defaultBranch}`);
  if (repository.updatedAt) flags.push(`updated ${repository.updatedAt}`);
  return `[${githubRepositoryRecordRef(repository.repositoryId)}] ${repository.fullName} — ${flags.join(" · ")}`;
}

/** The total-command ceiling, as an outcome rather than a thrown error. */
type Timed<T> = { readonly timedOut: false; readonly value: T } | { readonly timedOut: true };

async function withinTotalBudget<T>(work: Promise<T>, ms: number): Promise<Timed<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<Timed<T>>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  try {
    return await Promise.race([work.then((value) => ({ timedOut: false as const, value })), ceiling]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * RUN ONE PROVIDER-READ COMMAND.
 *
 * The tenant is resolved SERVER-SIDE, exactly as the answer flow and the read executor do. The
 * client supplies only a command id and its arguments; it cannot supply a tenant, an integration, an
 * installation, an account, or anything that could be spent. The command id is a lookup key into a
 * closed registry, so it can never select behaviour the registry does not declare.
 *
 * THE CAPABILITY GATE IS NOT RE-IMPLEMENTED HERE. `withGitHubInstallationToken`, inside the released
 * seam, consults the integration capability authority BEFORE it mints anything and refuses on its
 * own terms. Asking the same question a second time in this module would be a second interpreter of
 * connection state, which is precisely the defect that seam exists to prevent.
 */
export async function runHebyProviderReadCommand(
  input: HebyProviderReadCommandInput,
  deps: HebyProviderReadCommandDeps,
): Promise<HebyProviderReadCommandResult> {
  assertServerRuntime();

  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "unauthorized" };

  const command = findHebyCommandById(input.commandId);
  if (!command) return { status: "rejected", reason: "unknown-command" };
  if (command.kind !== "provider-read") {
    return { status: "rejected", reason: "not-a-provider-read-command" };
  }
  if (command.availability !== "available") return { status: "rejected", reason: "not-available" };

  const slash = command.slash;

  switch (command.handler) {
    case "repositories":
      return readRepositories(slash, tenant, deps);
    case "pull-requests":
      return readPullRequests(slash, tenant, deps);
    default:
      /* A provider-read command with no implementation reads nothing rather than reading anything. */
      return { status: "rejected", reason: "no-provider-read-handler" };
  }
}

async function readRepositories(
  slash: string,
  tenant: TenantContext,
  deps: HebyProviderReadCommandDeps,
): Promise<HebyProviderReadCommandResult> {
  const discover = deps.discover ?? discoverInstallationRepositories;
  const totalTimeoutMs = deps.totalTimeoutMs ?? GITHUB_PROVIDER_READ_BUDGET.totalTimeoutMs;

  const timed = await withinTotalBudget(
    discover(tenant, { timeoutMs: GITHUB_PROVIDER_READ_BUDGET.providerTimeoutMs }),
    totalTimeoutMs,
  );

  if (timed.timedOut) {
    return unavailable(slash, "GitHub did not answer in time", [
      `The whole command is bounded at ${totalTimeoutMs} ms and GitHub had not answered, so Hebun stopped waiting.`,
      "NOTHING IS KNOWN about your installation from this, and this is not an empty list.",
    ]);
  }

  const outcome = timed.value;

  if (!outcome.ok) {
    if ("refusal" in outcome) {
      return unavailable(
        slash,
        "Repositories were not read",
        REFUSAL_LINES[outcome.refusal] ?? [
          "This organization cannot currently read repository activity, and no read was attempted.",
        ],
      );
    }
    return unavailable(
      slash,
      "GitHub did not answer",
      FAILURE_LINES[outcome.failure] ?? [
        "GitHub did not return a repository page, and Hebun will not present that as an empty list.",
      ],
    );
  }

  const discovery = outcome.value;
  /*
   * THE BUDGET IS ENFORCED HERE, not merely declared. The released seam already bounds its page and
   * this restates the ceiling at the command boundary, so the promise this command makes does not
   * depend on a constant defined two features away staying what it is today.
   */
  const shown = discovery.repositories.slice(0, GITHUB_PROVIDER_READ_BUDGET.maxRecords);

  if (shown.length === 0) {
    /*
     * A REAL, GROUNDED ANSWER — and the one case that is genuinely empty. Every other path above
     * came through `unavailable`, so an operator seeing this sentence is being told something
     * GitHub actually said, not something Hebun failed to find out.
     */
    return ok(slash, "No repositories in this installation", [
      "GitHub answered, and this installation currently covers no repositories.",
      "That is GitHub's answer, not a failed read: the installation exists and Hebun reached it.",
      "Which repositories an installation covers is chosen on GitHub, in the installation's settings.",
    ]);
  }

  return ok(slash, `Repositories in your GitHub installation`, [
    ...shown.map(repositoryLine),
    "",
    ...boundaryLines(discovery, shown.length),
    "",
    "These are repository names and their coverage, and nothing inside them. This command reads no " +
      "file, no source line, no commit content and no message body — the shape it returns has no " +
      "field for any of them.",
  ]);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * INT-5B2 — WHAT IS CHANGING IN OUR ENGINEERING REPOSITORIES
 *
 * The second provider-read handler, and the first consumer the GITHUB-4 seam has ever had. It
 * reads OPEN PULL-REQUEST METADATA for the repositories this organization's own installation
 * covers, and it says — on every path — what that is not.
 *
 *     A PULL REQUEST     != ORGANIZATIONAL WORK   (WORK-1 owns work; this is GitHub's record)
 *     AN AUTHOR LOGIN    != A PERSON IN THIS ORGANIZATION  (OSA-4 owns who is here)
 *     OPEN               != ACTIVE, HEALTHY, ON TRACK OR AGREED
 *     A BOUNDED READ     != ALL ACTIVITY
 *     PROVIDER SILENCE   != NOTHING IS HAPPENING
 * ═════════════════════════════════════════════════════════════════════════ */

/**
 * The provenance for a pull-request read. Its own constant, and deliberately not the repository
 * one: the two commands report different things, and one sentence covering both would end up
 * describing neither. Every clause is a fact about HOW this was obtained.
 */
export const GITHUB_PULL_REQUEST_READ_PROVENANCE =
  "Read live from GitHub just now, for the installation your organization connected, scoped to your " +
  "tenant (authoritative: false). Provider-derived observation, not organizational truth: nothing " +
  "was stored, indexed or admitted anywhere, and asking again re-reads it. These are OPEN pull " +
  "requests as GitHub reported them at this moment — not this organization's recorded work, not a " +
  "statement that anything is on track, and not a complete account of engineering activity. An " +
  "author login is a GITHUB IDENTITY and says nothing about who is a member of your organization.";

/**
 * THE EVIDENCE IDENTITY FOR ONE PULL REQUEST — the repository's released reference, extended.
 *
 * It builds on `githubRepositoryRecordRef` rather than beside it, so the repository a pull request
 * belongs to is readable from the reference itself. The NUMBER is GitHub's own per-repository
 * pull-request number, which is never reused within a repository — and it is never the title, for
 * the reason a repository's reference is never its full name.
 */
export function githubPullRequestRecordRef(repositoryId: number, number: number): string {
  return `${githubRepositoryRecordRef(repositoryId)}/pull-request/${number}`;
}

/** One pull request, as one line, carrying its own stable reference. Untrusted provider text. */
function pullRequestLine(
  repositoryId: number,
  pullRequest: GitHubRepositoryActivity["openPullRequests"][number],
): string {
  const flags: string[] = [];
  if (pullRequest.isDraft) flags.push("draft");
  flags.push(pullRequest.authorLogin ? `opened by ${pullRequest.authorLogin} on GitHub` : "no author reported");
  if (pullRequest.updatedAt) flags.push(`updated ${pullRequest.updatedAt}`);
  return (
    `[${githubPullRequestRecordRef(repositoryId, pullRequest.number)}] ` +
    `#${pullRequest.number} ${pullRequest.title} — ${flags.join(" · ")}`
  );
}

/**
 * READ OPEN PULL REQUESTS ACROSS THE INSTALLATION'S REPOSITORIES.
 *
 * ── IT TAKES NO ARGUMENTS, AND THAT IS A SECURITY POSTURE, NOT A LIMITATION ──
 *
 * The released seam accepts a repository id and proves it against a live listing, so an addressed
 * command WOULD be safe. This one still takes none, because a command that accepts no address
 * cannot be pointed anywhere at all — the installation decides what is visible, exactly as it does
 * for `/repositories`. No repository address crosses the client boundary, which keeps INT-5B1's
 * released statement about this action's payload true word for word.
 *
 * ── A PARTIAL FAN-OUT IS REPORTED AS PARTIAL ─────────────────────────────────
 *
 * Each repository is read in its own authorization frame, so one repository failing is not the
 * command failing. What must never happen is a repository that could not be read disappearing from
 * the answer as though it had no open pull requests — so every unread repository is NAMED, with
 * its own reason, beside the ones that answered.
 */
async function readPullRequests(
  slash: string,
  tenant: TenantContext,
  deps: HebyProviderReadCommandDeps,
): Promise<HebyProviderReadCommandResult> {
  const discover = deps.discover ?? discoverInstallationRepositories;
  const readActivity = deps.readPullRequests ?? readRepositoryPullRequests;
  const totalTimeoutMs = deps.totalTimeoutMs ?? GITHUB_PULL_REQUEST_READ_BUDGET.totalTimeoutMs;

  /**
   * THE WHOLE FAN-OUT, INSIDE ONE CEILING.
   *
   * ONE clock, owned by `withinTotalBudget`, and this module reads no clock of its own — a released
   * assertion forbids it from naming `Date.now(` at all, because a module that must mint no
   * identifier has no business holding a clock either. A per-repository deadline computed here
   * would have been exactly that.
   *
   * The cost is that a ceiling reached mid-fan-out reports the whole command as unanswered rather
   * than returning what it had. That is the correct trade: a partial list under a timeout is the
   * shape most likely to be read as complete.
   */
  const timed = await withinTotalBudget(
    (async () => {
      const discovered = await discover(tenant, {
        timeoutMs: GITHUB_PULL_REQUEST_READ_BUDGET.providerTimeoutMs,
      });
      if (!discovered.ok) return { discovery: discovered } as const;

      const examined = discovered.value.repositories.slice(
        0,
        GITHUB_PULL_REQUEST_READ_BUDGET.maxRepositoriesExamined,
      );
      const activities: {
        readonly repository: GitHubRepositoryView;
        readonly outcome: GitHubAuthorizedOutcome<GitHubRepositoryActivity>;
      }[] = [];
      /* SEQUENTIAL, matching the budget's own `concurrency: 1`. Nothing here runs in parallel. */
      for (const repository of examined) {
        activities.push({
          repository,
          outcome: await readActivity(tenant, repository.repositoryId, {
            timeoutMs: GITHUB_PULL_REQUEST_READ_BUDGET.providerTimeoutMs,
          }),
        });
      }
      return { discovery: discovered, discovered: discovered.value, examined, activities } as const;
    })(),
    totalTimeoutMs,
  );

  if (timed.timedOut) {
    return unavailable(slash, "GitHub did not answer in time", [
      `The whole command is bounded at ${totalTimeoutMs} ms and GitHub had not answered, so Hebun stopped waiting.`,
      "NOTHING IS KNOWN about your repositories from this, and this is not an empty list.",
    ]);
  }

  const outcome = timed.value.discovery;
  if (!outcome.ok) {
    if ("refusal" in outcome) {
      return unavailable(
        slash,
        "Pull requests were not read",
        REFUSAL_LINES[outcome.refusal] ?? [
          "This organization cannot currently read repository activity, and no read was attempted.",
        ],
      );
    }
    return unavailable(
      slash,
      "GitHub did not answer",
      FAILURE_LINES[outcome.failure] ?? [
        "GitHub did not return a repository page, and Hebun will not present that as an absence of pull requests.",
      ],
    );
  }

  const discovery = timed.value.discovered!;
  const examined = timed.value.examined!;

  if (examined.length === 0) {
    /*
     * A REAL, GROUNDED ANSWER. GitHub answered and the installation covers nothing, so there is
     * nowhere for a pull request to be. Every other empty-looking path came through `unavailable`.
     */
    return ok(slash, "No repositories in this installation", [
      "GitHub answered, and this installation currently covers no repositories.",
      "There is therefore nowhere for a pull request to be — this is GitHub's answer, not a failed read.",
      "Which repositories an installation covers is chosen on GitHub, in the installation's settings.",
    ]);
  }

  const answered: {
    readonly repository: string;
    readonly lines: readonly string[];
    readonly open: number;
    readonly truncated: boolean;
  }[] = [];
  const unread: { readonly repository: string; readonly why: string }[] = [];

  for (const { repository, outcome: activity } of timed.value.activities!) {
    if (!activity.ok) {
      /*
       * NAMED, NEVER DROPPED. A repository Hebun could not read is not a repository with no open
       * pull requests, and the two must never render the same.
       */
      unread.push({
        repository: repository.fullName,
        why:
          "refusal" in activity
            ? `the read was refused (${activity.refusal})`
            : `GitHub did not answer (${activity.failure})`,
      });
      continue;
    }

    const value = activity.value;
    const shown = value.openPullRequests.slice(
      0,
      GITHUB_PULL_REQUEST_READ_BUDGET.maxRecordsPerRepository,
    );
    answered.push({
      repository: value.repository.fullName,
      open: shown.length,
      truncated: value.truncated || shown.length < value.openPullRequests.length,
      lines: shown.map((pullRequest) => pullRequestLine(value.repository.repositoryId, pullRequest)),
    });
  }

  if (answered.length === 0) {
    /*
     * DISCOVERY WORKED AND NOT ONE REPOSITORY COULD BE READ. That is an unavailable result, not an
     * empty one, and it names each repository and its own reason rather than collapsing them.
     */
    return unavailable(slash, "No repository could be read", [
      "GitHub named this installation's repositories, and none of them could then be read.",
      ...unread.map((entry) => `${entry.repository}: ${entry.why}.`),
      "THIS IS NOT AN EMPTY RESULT: Hebun is not reporting that there are no open pull requests.",
    ]);
  }

  const totalOpen = answered.reduce((sum, entry) => sum + entry.open, 0);
  const lines: string[] = [];

  for (const entry of answered) {
    lines.push(
      entry.open === 0
        ? `${entry.repository} — GitHub answered, and no pull request is open.`
        : `${entry.repository} — ${entry.open} open:`,
    );
    lines.push(...entry.lines);
    if (entry.truncated) {
      lines.push(
        `PARTIAL, NOT COMPLETE: GitHub had more open pull requests than one page holds for ` +
          `${entry.repository}, so this is not all of them.`,
      );
    }
    lines.push("");
  }

  /* THE BOUNDS, STATED IN BOTH DIRECTIONS, ALWAYS. Silence would read as completeness. */
  lines.push(
    `Looked inside ${examined.length} repositor${examined.length === 1 ? "y" : "ies"} — at most ` +
      `${GITHUB_PULL_REQUEST_READ_BUDGET.maxRepositoriesExamined} per command, and at most ` +
      `${GITHUB_PULL_REQUEST_READ_BUDGET.maxRecordsPerRepository} open pull requests in each.`,
  );
  if (discovery.repositories.length > examined.length) {
    lines.push(
      `PARTIAL, NOT COMPLETE: this installation covers ${discovery.repositories.length} repositories ` +
        "on the page GitHub returned, and this command looked inside only the first few.",
    );
  }
  if (discovery.truncated) {
    lines.push(
      `AND THE REPOSITORY LIST ITSELF WAS PARTIAL: GitHub reports ` +
        `${discovery.totalReportedByProvider ?? "more"} repositories in total for this installation.`,
    );
  }
  if (unread.length > 0) {
    lines.push("");
    lines.push("NOT READ, and therefore not answered for — this is not an absence of pull requests:");
    lines.push(...unread.map((entry) => `${entry.repository}: ${entry.why}.`));
  }
  lines.push("");
  lines.push(
    "These are pull-request titles, numbers, authors and timestamps, and nothing inside them. This " +
      "command reads no diff, no patch, no file, no commit and no comment — the shape it returns " +
      "has no field for any of them.",
  );
  lines.push(
    "An open pull request is GitHub's record of a proposed change. It is NOT this organization's " +
      "recorded work, and an author login is a GitHub identity, not a member of your organization.",
  );

  return {
    status: "ok",
    result: {
      command: slash,
      title:
        totalOpen === 0
          ? "No open pull requests in what was read"
          : `${totalOpen} open pull request${totalOpen === 1 ? "" : "s"}`,
      lines,
      tone: "info",
      provenance: GITHUB_PULL_REQUEST_READ_PROVENANCE,
    },
  };
}
