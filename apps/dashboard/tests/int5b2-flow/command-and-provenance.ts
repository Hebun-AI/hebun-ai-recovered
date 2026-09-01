/*
 * INT-5B2 — WHAT IS CHANGING IN OUR ENGINEERING REPOSITORIES.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "`/pull-requests` reads OPEN PULL-REQUEST METADATA live from the repositories this
 *    organization's own GitHub installation covers, through the seam GITHUB-4 released and nothing
 *    had ever consumed. It distinguishes a refusal, a provider fault, a timeout, an installation
 *    that covers nothing, a repository that answered with nothing, and a repository that could not
 *    be read — and it never renders any of the last five as any of the others. Every bound it hits
 *    is declared, and every line says what a pull request is NOT."
 *
 * The pins:
 *
 *   A PULL REQUEST  != ORGANIZATIONAL WORK      AN AUTHOR LOGIN != A MEMBER OF THIS ORGANIZATION
 *   OPEN            != ACTIVE, HEALTHY, AGREED  PROVIDER SILENCE != NOTHING IS HAPPENING
 *   UNAVAILABLE     != EMPTY                    A BOUNDED READ  != ALL ACTIVITY
 *   PROVIDER-DERIVED != ORGANIZATIONAL TRUTH    THE IDENTITY    != THE TITLE
 *
 * Pure: no network, no GitHub, no key, no database, no model. Every seam is injected.
 */
import assert from "node:assert/strict";
import {
  GITHUB_PULL_REQUEST_READ_BUDGET,
  GITHUB_PULL_REQUEST_READ_PROVENANCE,
  githubPullRequestRecordRef,
  githubRepositoryRecordRef,
  runHebyProviderReadCommand,
} from "../../src/features/heby-commands/provider-read-commands.server";
import { HEBY_COMMANDS, findHebyCommandById, validateHebyCommandRegistry } from "../../src/features/heby-commands/registry";
import {
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
  MAX_PULL_REQUESTS_PER_PAGE,
} from "../../src/features/provider-github/contracts";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT = { tenantId: "t-1", userId: "u-1" } as unknown as TenantContext;
const resolveTenant = async () => TENANT;

const repo = (repositoryId: number, fullName: string) => ({
  repositoryId,
  fullName,
  isPrivate: true,
  isArchived: false,
  defaultBranch: "main",
  updatedAt: null,
});

const discovery = (repositories: readonly ReturnType<typeof repo>[], extra: Partial<{ truncated: boolean; totalReportedByProvider: number | null }> = {}) =>
  ({
    ok: true as const,
    value: {
      repositories,
      totalReportedByProvider: extra.totalReportedByProvider ?? repositories.length,
      truncated: extra.truncated ?? false,
    },
  });

const pr = (number: number, title: string, extra: Partial<{ isDraft: boolean; authorLogin: string | null; updatedAt: string | null }> = {}) => ({
  number,
  title,
  state: "open" as const,
  isDraft: extra.isDraft ?? false,
  authorLogin: extra.authorLogin === undefined ? "octocat" : extra.authorLogin,
  createdAt: null,
  updatedAt: extra.updatedAt ?? "2026-09-01T10:00:00Z",
});

const activity = (repositoryId: number, fullName: string, openPullRequests: readonly ReturnType<typeof pr>[], truncated = false) =>
  ({
    ok: true as const,
    value: { repository: { repositoryId, fullName }, openPullRequests, truncated },
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
const run = (deps: Record<string, unknown>) =>
  runHebyProviderReadCommand({ commandId: "pull-requests", args: [] }, { resolveTenant, ...deps } as any);

async function main(): Promise<void> {
  /* ═════════════════════════════════════════════════════════════════════════
   * 1. THE COMMAND IS REGISTERED, DECLARES ITS REACH, AND ADDS NO NEW KIND.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.deepEqual(validateHebyCommandRegistry(), [], "the registry invariants hold with it in");

  const command = findHebyCommandById("pull-requests");
  assert.ok(command, "`/pull-requests` is registered");
  assert.equal(command!.slash, "/pull-requests");
  assert.equal(command!.kind, "provider-read", "the SAME kind as `/repositories` — no new axis");
  assert.equal(command!.reachesProvider, true, "it says out loud that it leaves the building");
  assert.equal(command!.requiresModel, false, "it asks no model anything");
  assert.equal(command!.requiresExecution, false, "it executes nothing");
  assert.deepEqual([...command!.args], [], "IT TAKES NO ARGUMENTS — no address crosses the boundary");
  assert.equal(command!.availability, "available", "the seam behind it is released, not planned");

  const kinds = new Set(HEBY_COMMANDS.map((c) => c.kind));
  assert.equal(kinds.has("provider-read"), true);
  assert.equal(
    HEBY_COMMANDS.filter((c) => c.kind === "provider-read").length,
    2,
    "exactly two provider-read commands: repositories, and this one",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 2. THE BUDGET IS ITS OWN, AND SAYS WHY IT DIFFERS.
   * ═══════════════════════════════════════════════════════════════════════ */
  assert.equal(GITHUB_PULL_REQUEST_READ_BUDGET.maxProviders, 1, "one provider, never two");
  assert.equal(GITHUB_PULL_REQUEST_READ_BUDGET.maxPages, 1, "one page per repository");
  assert.equal(GITHUB_PULL_REQUEST_READ_BUDGET.concurrency, 1, "nothing runs concurrently");
  assert.equal(
    GITHUB_PULL_REQUEST_READ_BUDGET.maxRecordsPerRepository,
    MAX_PULL_REQUESTS_PER_PAGE,
    "the released page bound, restated at the command boundary",
  );
  assert.ok(GITHUB_PULL_REQUEST_READ_BUDGET.maxRepositoriesExamined >= 1);
  assert.equal(
    GITHUB_PULL_REQUEST_READ_BUDGET.maxProviderCalls,
    2 + 3 * GITHUB_PULL_REQUEST_READ_BUDGET.maxRepositoriesExamined,
    "the call ceiling is DERIVED from the fan-out, so it cannot drift from what the command does",
  );

  /* ═════════════════════════════════════════════════════════════════════════
   * 3. THE IDENTITY IS THE PROVIDER'S NUMBERS, NEVER THE TITLE OR THE NAME.
   * ═══════════════════════════════════════════════════════════════════════ */
  const ref = githubPullRequestRecordRef(1300480452, 7);
  assert.equal(
    ref,
    `${githubRepositoryRecordRef(1300480452)}/pull-request/7`,
    "THE IDENTITY IS THE REPOSITORY'S REFERENCE PLUS GITHUB'S OWN NUMBER, composed and never altered",
  );
  assert.ok(ref.includes(GITHUB_REPOSITORY_ACTIVITY_CAPABILITY), "the capability key is the provider module's");
  assert.notEqual(githubPullRequestRecordRef(1, 7), githubPullRequestRecordRef(2, 7),
    "the same number in two repositories is two different records");
  assert.notEqual(githubPullRequestRecordRef(1, 7), githubPullRequestRecordRef(1, 8));

  /* ═════════════════════════════════════════════════════════════════════════
   * 4. A REAL ANSWER CARRIES EVERY FACT AND EVERY DENIAL.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const outcome = await run({
      discover: async () => discovery([repo(1300480452, "Hebun-AI/hebun-ai-recovered")]),
      readPullRequests: async () =>
        activity(1300480452, "Hebun-AI/hebun-ai-recovered", [
          pr(7, "Record which department a human works in"),
          pr(8, "Draft: people register", { isDraft: true }),
        ]),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    const text = outcome.result.lines.join("\n");

    assert.equal(outcome.result.tone, "info");
    assert.equal(outcome.result.title, "2 open pull requests", "the count is measured");
    assert.match(text, /\[integrations\/github-organization\/github\.repository\.activity\.read\/repository\/1300480452\/pull-request\/7\]/,
      "every line carries a stable reference the model can never invent");
    assert.match(text, /#7 Record which department a human works in/, "the number and title are shown");
    assert.match(text, /opened by octocat on GitHub/, "the author is named AS A GITHUB IDENTITY");
    assert.match(text, /draft/, "a draft says so");
    assert.match(text, /no diff, no patch, no file, no commit and no comment/,
      "the surface states what it did NOT read");
    assert.match(text, /NOT this organization's recorded work/, "A PULL REQUEST != ORGANIZATIONAL WORK");
    assert.match(text, /not a member of your organization/, "AN AUTHOR LOGIN != A MEMBER");
    assert.match(text, /Looked inside 1 repository/, "the fan-out bound is declared even when it did not bite");

    /* THE PROVENANCE IS NOT THE REPOSITORY COMMAND'S. */
    assert.equal(outcome.result.provenance, GITHUB_PULL_REQUEST_READ_PROVENANCE);
    assert.match(GITHUB_PULL_REQUEST_READ_PROVENANCE, /authoritative: false/,
      "PROVIDER-DERIVED != ORGANIZATIONAL TRUTH");
    assert.match(GITHUB_PULL_REQUEST_READ_PROVENANCE, /nothing was stored, indexed or admitted anywhere/i);
    assert.match(GITHUB_PULL_REQUEST_READ_PROVENANCE, /not a complete account of engineering activity/);
    assert.match(GITHUB_PULL_REQUEST_READ_PROVENANCE, /GITHUB IDENTITY/);
  }

  /* An author GitHub did not report is NOT invented. */
  {
    const outcome = await run({
      discover: async () => discovery([repo(1, "acme/one")]),
      readPullRequests: async () => activity(1, "acme/one", [pr(1, "Untitled work", { authorLogin: null })]),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.match(outcome.result.lines.join("\n"), /no author reported/, "UNKNOWN REMAINS UNKNOWN");
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 5. THE FIVE ABSENCES, AND NONE OF THEM RENDER AS ANOTHER.
   * ═══════════════════════════════════════════════════════════════════════ */

  /* 5a · A repository that answered with nothing — a REAL answer, `info`. */
  {
    const outcome = await run({
      discover: async () => discovery([repo(1, "acme/quiet")]),
      readPullRequests: async () => activity(1, "acme/quiet", []),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.equal(outcome.result.tone, "info", "GitHub answered, so this is not an outage");
    assert.equal(outcome.result.title, "No open pull requests in what was read");
    assert.match(outcome.result.lines.join("\n"), /GitHub answered, and no pull request is open/);
  }

  /* 5b · An installation covering nothing — also a REAL answer. */
  {
    const outcome = await run({
      discover: async () => discovery([]),
      readPullRequests: async () => {
        throw new Error("must not be called when there is nowhere to look");
      },
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.equal(outcome.result.tone, "info");
    assert.match(outcome.result.lines.join("\n"), /nowhere for a pull request to be/);
    assert.match(outcome.result.lines.join("\n"), /not a failed read/);
  }

  /* 5c · A refusal — `unavailable`, and it never becomes a list. */
  for (const refusal of [
    "capability-not-available",
    "no-github-connection",
    "github-app-not-configured",
    "connection-authority-unavailable",
  ] as const) {
    const outcome = await run({
      discover: async () => ({ ok: false as const, refusal }),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.equal(outcome.result.tone, "unavailable", `${refusal} is an unavailable, never a result`);
    assert.match(outcome.result.provenance, /This is not an empty result/,
      "UNAVAILABLE != EMPTY, said on the refusal itself");
  }

  /* 5d · A provider fault — `unavailable`, and the classes stay apart. */
  for (const failure of ["transport", "permission", "installation", "auth", "malformed", "identity"] as const) {
    const outcome = await run({
      discover: async () => ({ ok: false as const, failure, reason: "x" }),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.equal(outcome.result.tone, "unavailable", `a ${failure} fault is never an empty list`);
  }

  /* 5e · The command's own ceiling — `unavailable`, and it says nothing is known. */
  {
    const outcome = await run({
      discover: () => new Promise(() => {}),
      totalTimeoutMs: 20,
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.equal(outcome.result.tone, "unavailable");
    assert.match(outcome.result.lines.join("\n"), /NOTHING IS KNOWN/);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 6. A PARTIAL FAN-OUT IS REPORTED AS PARTIAL. THE DEFECT THIS SECTION EXISTS FOR.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const outcome = await run({
      discover: async () => discovery([repo(1, "acme/one"), repo(2, "acme/two")]),
      readPullRequests: async (_t: unknown, id: number) =>
        id === 1
          ? activity(1, "acme/one", [pr(3, "A change")])
          : ({ ok: false as const, failure: "transport" as const, reason: "rate-limited" }),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    const text = outcome.result.lines.join("\n");
    assert.match(text, /acme\/one — 1 open/, "the repository that answered is reported");
    assert.match(text, /NOT READ, and therefore not answered for/, "and the one that did not is NAMED");
    assert.match(text, /acme\/two: GitHub did not answer \(transport\)/, "with its own reason");
    assert.match(text, /this is not an absence of pull requests/i,
      "A REPOSITORY THAT COULD NOT BE READ != A REPOSITORY WITH NOTHING OPEN");
  }

  /* Not one repository readable — that is `unavailable`, not an empty answer. */
  {
    const outcome = await run({
      discover: async () => discovery([repo(1, "acme/one")]),
      readPullRequests: async () => ({ ok: false as const, refusal: "capability-not-available" as const }),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.equal(
      outcome.result.tone,
      "unavailable",
      "NOT ONE READABLE REPOSITORY IS AN UNAVAILABLE, never an empty answer",
    );
    assert.match(outcome.result.lines.join("\n"), /THIS IS NOT AN EMPTY RESULT/);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 7. EVERY BOUND DECLARES ITSELF, IN BOTH DIRECTIONS.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const many = Array.from({ length: GITHUB_PULL_REQUEST_READ_BUDGET.maxRepositoriesExamined + 2 }, (_, i) =>
      repo(i + 1, `acme/repo-${i + 1}`),
    );
    const outcome = await run({
      discover: async () => discovery(many, { truncated: true, totalReportedByProvider: 99 }),
      readPullRequests: async (_t: unknown, id: number) => activity(id, `acme/repo-${id}`, []),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    const text = outcome.result.lines.join("\n");
    assert.match(text, /PARTIAL, NOT COMPLETE: this installation covers/,
      "looking inside only the first few says so");
    assert.match(text, /AND THE REPOSITORY LIST ITSELF WAS PARTIAL: GitHub reports 99/,
      "and a truncated repository page says so too");
  }

  /* A repository whose own pull-request page was truncated says so, per repository. */
  {
    const outcome = await run({
      discover: async () => discovery([repo(1, "acme/busy")]),
      readPullRequests: async () => activity(1, "acme/busy", [pr(1, "One of many")], true),
    });
    assert.equal(outcome.status, "ok");
    if (outcome.status !== "ok") throw new Error("unreachable");
    assert.match(outcome.result.lines.join("\n"), /PARTIAL, NOT COMPLETE: GitHub had more open pull requests/);
  }

  /* ═════════════════════════════════════════════════════════════════════════
   * 8. THE COMMAND CANNOT BE POINTED ANYWHERE, AND REFUSES WHAT IT IS NOT.
   * ═══════════════════════════════════════════════════════════════════════ */
  {
    const unauthorized = await runHebyProviderReadCommand(
      { commandId: "pull-requests", args: [] },
      { resolveTenant: async () => null },
    );
    assert.equal(unauthorized.status, "unauthorized", "no tenant, no read");

    const notProviderRead = await runHebyProviderReadCommand(
      { commandId: "summary", args: [] },
      { resolveTenant },
    );
    assert.equal(notProviderRead.status, "rejected");

    const unknown = await runHebyProviderReadCommand(
      { commandId: "pull-requests-of/../etc", args: [] },
      { resolveTenant },
    );
    assert.equal(unknown.status, "rejected");
    assert.equal(unknown.status === "rejected" && unknown.reason, "unknown-command");
  }

  /*
   * ARGUMENTS ARE INERT. Even if a client sends one, no code path reads it: the seam is called with
   * ids that came from GitHub's own listing, never from the caller.
   */
  {
    const askedFor: number[] = [];
    const outcome = await runHebyProviderReadCommand(
      { commandId: "pull-requests", args: ["999999", "acme/somebody-elses-repo"] },
      {
        resolveTenant,
        discover: async () => discovery([repo(1, "acme/one")]),
        readPullRequests: async (_t: unknown, id: number) => {
          askedFor.push(id);
          return activity(id, "acme/one", []);
        },
      } as any,
    );
    assert.equal(outcome.status, "ok");
    assert.deepEqual(askedFor, [1], "the argument was never used as an address");
  }

  console.log("PASS int5b2-flow/command-and-provenance");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
