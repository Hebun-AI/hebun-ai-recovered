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
  MAX_REPOSITORIES_PER_PAGE,
} from "@/features/provider-github/contracts";
import {
  discoverInstallationRepositories,
  type GitHubRepositoryDiscovery,
} from "@/features/provider-github/discover-installation-repositories.server";
import type { GitHubAuthorizedCallDeps, GitHubAuthorizedOutcome } from "@/features/provider-github/github-authorized-call.server";
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

/**
 * Why a provider read did not happen, in the operator's words.
 *
 * The seam's own refusal is carried across rather than re-derived: the capability authority already
 * distinguishes "nothing is connected", "the connection is not usable" and "what was granted does
 * not cover this", and a second interpretation here would be the two-interpreters defect one layer
 * down. Each sentence sends a person somewhere different, which is the whole reason they are not
 * one message.
 */
const REFUSAL_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "no-authorized-tenant-context": [
    "No organization is resolved for this request, so no connection could be consulted.",
  ],
  "connection-authority-unavailable": [
    "Hebun could not read your organization's connections, so it did not go on to contact GitHub.",
    "This says nothing about the state of your installation.",
  ],
  "capability-not-available": [
    "Reading repository activity is not available for your organization right now.",
    "That is one of three different situations: no GitHub installation is connected, the connection " +
      "is not currently usable, or what GitHub granted does not cover this read.",
    "The Integrations workspace shows which of the three applies, and offers the fix for it.",
  ],
  "no-github-connection": [
    "No GitHub connection was found for your organization, so there was nothing to read from.",
  ],
  "installation-identity-unavailable": [
    "The stored connection does not carry a usable GitHub installation identity, so no read was attempted.",
  ],
  "github-app-not-configured": [
    "This Hebun deployment is not configured with a GitHub App, so it cannot identify itself to GitHub.",
    "That is an operator configuration gap, not a problem with your organization's installation.",
  ],
});

/**
 * Why GitHub itself did not answer with a page.
 *
 * The classes are kept apart because they mean different things, and collapsing them is how a
 * provider outage gets reported to a tenant as a broken connection. NONE of these paths writes
 * anything: this module holds no connection writer, so a failure here leaves the stored lifecycle
 * exactly as it was.
 */
const FAILURE_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  auth: [
    "GitHub refused Hebun's own application credential, so no read happened.",
    "Nothing about your organization's installation is implicated by this.",
  ],
  installation: [
    "GitHub reports that the installation Hebun holds is gone, suspended, or not the one it expected.",
    "Only the Integrations workspace acts on that; this command changed nothing.",
  ],
  permission: [
    "The installation is live, and what it granted does not cover reading repositories.",
    "Re-consenting in the Integrations workspace is what widens it. Nothing was changed here.",
  ],
  identity: [
    "GitHub answered without an account identity Hebun could use, so nothing was read.",
  ],
  transport: [
    "GitHub did not answer: a rate limit, a server error, a timeout, or a network fault.",
    "NOTHING IS KNOWN about your installation from this — it may be perfectly fine.",
    "Nothing was retried, nothing was stored, and your connection was left untouched.",
  ],
  malformed: [
    "GitHub answered in a shape Hebun does not understand, so nothing was reported from it.",
    "Hebun would rather show you nothing than guess what a response meant.",
  ],
});

/** One repository, as one line, carrying its own stable reference. */
function repositoryLine(repository: GitHubRepositoryDiscovery["repositories"][number]): string {
  const flags: string[] = [repository.isPrivate ? "private" : "public"];
  if (repository.isArchived) flags.push("archived");
  if (repository.defaultBranch) flags.push(`default ${repository.defaultBranch}`);
  if (repository.updatedAt) flags.push(`updated ${repository.updatedAt}`);
  return `[${githubRepositoryRecordRef(repository.repositoryId)}] ${repository.fullName} — ${flags.join(" · ")}`;
}

/**
 * State the page bound truthfully, every time, in both directions.
 *
 * A BOUND IS NOT A TOTAL. When GitHub reports more than one page holds, the line says so and says
 * how many; when it does not report a count at all, the line says THAT rather than implying the
 * list is complete. Silence would read as completeness, which is the one thing a bounded read may
 * never imply.
 */
function boundaryLines(discovery: GitHubRepositoryDiscovery, shown: number): readonly string[] {
  const lines = [
    `Showing ${shown} repositor${shown === 1 ? "y" : "ies"} — one page, at most ` +
      `${GITHUB_PROVIDER_READ_BUDGET.maxRecords}. This command never asks for a second page.`,
  ];
  if (discovery.truncated) {
    lines.push(
      `PARTIAL, NOT COMPLETE: GitHub reports ${discovery.totalReportedByProvider ?? "more"} in total, ` +
        "so this page is not all of them.",
    );
  } else if (discovery.totalReportedByProvider === null) {
    lines.push(
      "GitHub reported no total for this installation, so Hebun cannot tell you whether this page is all of them.",
    );
  } else {
    lines.push(
      `GitHub reports ${discovery.totalReportedByProvider} in total for this installation, which this page covers.`,
    );
  }
  return lines;
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
