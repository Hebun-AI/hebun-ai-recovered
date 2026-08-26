/*
 * heby-commands/cross-source-commands.server.ts — INT-5C. THE CROSS-SOURCE EXECUTOR.
 *
 * ── WHAT IT IS ───────────────────────────────────────────────────────────────
 *
 * The one place where live provider evidence and the organization's own durable declarations meet.
 * It reads a bounded page of GitHub repositories through the RELEASED INT-5B1 seam, asks the
 * organization's own external-reference table which of those records a human has declared a
 * Knowledge relationship for, and reports both answers side by side without merging their standing.
 *
 * ── WHY IT IS A THIRD ROOT AND NOT A SECOND HANDLER ──────────────────────────
 *
 * `provider-read-commands.server.ts` is proved by INT-5B1's firewall to reach NO Knowledge module of
 * any kind. This command needs a Knowledge read. Adding it there would have meant relaxing that
 * pin — deleting a guarantee from `/repositories`, which never needed a Knowledge read — so the
 * command got its own kind and its own module instead. INT-5B1's root and its firewall are
 * untouched by this phase, and `provider-read` still means what it said.
 *
 * This is the same move made twice before: `propose` (R3A.1) so a read could not become a write by
 * changing one field, and `provider-read` (INT-5B1) so a read could not become a provider call by
 * changing one field. Here: so a provider read cannot acquire a Knowledge read by changing one.
 *
 * ── THE PROVIDER HALF IS NOT REIMPLEMENTED ───────────────────────────────────
 *
 * The budget, the refusal vocabulary, the fault vocabulary, the repository line and the page-bound
 * sentences are IMPORTED from the released provider-read module. A second wording of "GitHub rate
 * limited us" would be a second interpretation of one provider's answer, and the two would drift the
 * first time either was edited. There is one provider-failure vocabulary in this repository.
 *
 * ── WHAT IT STRUCTURALLY CANNOT DO ───────────────────────────────────────────
 *
 * It imports no model client, no Knowledge writer, no Governance writer, no integration lifecycle
 * writer, no credential accessor, no action authority, no execution runtime and no conversation
 * repository. It writes nothing, anywhere. The Knowledge side is reached only through
 * `external-reference-read.server.ts`, which holds no write authority at all.
 *
 * ── THE MODEL IS NOT INVOLVED, BY STRUCTURE ──────────────────────────────────
 *
 * The relationship is SQL equality on GitHub's own immutable numeric repository id. Nothing here
 * compares names, scores similarity, or asks anything to decide what relates to what. A model
 * cannot invent a link because no model is reachable, and it cannot select a record because the
 * command accepts no address.
 *
 * Server-only.
 */
import {
  GITHUB_PROVIDER_KEY,
  GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
} from "@/features/provider-github/contracts";
import {
  discoverInstallationRepositories,
  type GitHubRepositoryDiscovery,
} from "@/features/provider-github/discover-installation-repositories.server";
import type {
  GitHubAuthorizedCallDeps,
  GitHubAuthorizedOutcome,
} from "@/features/provider-github/github-authorized-call.server";
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  findKnowledgeRelationshipsForExternalRecords,
  type ExternalReferenceLookup,
} from "@/features/knowledge/external-reference-read.server";
import {
  GITHUB_PROVIDER_READ_BUDGET,
  githubRepositoryRecordRef,
} from "./provider-read-commands.server";
import { FAILURE_LINES, REFUSAL_LINES, boundaryLines } from "./provider-read-vocabulary";
import { findHebyCommandById } from "./registry";
import type { HebyCommandResult } from "./contracts";

/**
 * The record type this command joins on.
 *
 * It matches the segment INT-5B1 already puts in its evidence identity
 * (`…/<capability>/repository/<id>`), so the tuple a human declared through the Knowledge workspace
 * and the tuple this command looks up are the same four values, spelled once here.
 */
export const GITHUB_REPOSITORY_RECORD_TYPE = "repository";

/**
 * The join-side ceiling.
 *
 * ONE database round trip, never one per repository. Fifty sequential lookups would make the cost of
 * answering scale with a number GitHub chooses, and would give a slow database fifty chances to turn
 * a complete answer into a partial one. The read seam enforces the same ceiling itself and REFUSES
 * rather than truncating — a truncated lookup would turn "we did not ask about it" into "no
 * declaration exists for it", which is the confusion this whole phase exists to prevent.
 */
export const CROSS_SOURCE_JOIN_BUDGET = Object.freeze({
  /** One provider page in, one batched query out. */
  maxKnowledgeQueries: 1,
  /** Never more ids than the provider page ceiling this command already enforces. */
  maxRecordsPerQuery: GITHUB_PROVIDER_READ_BUDGET.maxRecords,
} as const);

/** The single client-controlled input. It carries NO authority and NO address. */
export interface HebyCrossSourceCommandInput {
  readonly commandId: string;
  readonly args: readonly string[];
}

export interface HebyCrossSourceCommandDeps {
  readonly resolveTenant: () => Promise<TenantContext | null>;
  /**
   * The released GitHub discovery seam. Injectable so the command is provable with no network, no
   * key and no database — never so a caller can supply a different provider.
   */
  readonly discover?: (
    tenant: TenantContext | null,
    deps: GitHubAuthorizedCallDeps,
  ) => Promise<GitHubAuthorizedOutcome<GitHubRepositoryDiscovery>>;
  /** The released Knowledge read seam. Injectable for the same reason, and for the same limit. */
  readonly lookup?: typeof findKnowledgeRelationshipsForExternalRecords;
  readonly totalTimeoutMs?: number;
}

export type HebyCrossSourceCommandResult =
  | { readonly status: "unauthorized" }
  /** The command id was not a runnable CROSS-SOURCE command. Nothing was contacted or queried. */
  | { readonly status: "rejected"; readonly reason: string }
  | { readonly status: "ok"; readonly result: HebyCommandResult };

/**
 * THE TWO STANDINGS, STATED IN ONE PLACE AND NEVER MERGED.
 *
 * The danger this sentence exists to prevent is a reader concluding that because Hebun joined two
 * things, the result is authoritative about both. It is authoritative about neither: the provider
 * half is an ephemeral observation, and the Knowledge half is authoritative ONLY for the fact that
 * somebody in the organization recorded the relationship — never for whether the provider record is
 * current, healthy, or still exists.
 */
export const CROSS_SOURCE_PROVENANCE =
  "Two sources, two standings, not merged. REPOSITORIES were read live from GitHub just now for the " +
  "installation your organization connected, scoped to your tenant (authoritative: false): a " +
  "provider-derived observation, not organizational truth, stored nowhere, re-read each time you " +
  "ask. KNOWLEDGE RELATIONSHIPS are your organization's own durable declarations, each recorded by " +
  "a human — authoritative only for the fact that the relationship was recorded, and never proof " +
  "that the repository is current, healthy or still present on GitHub. This joined view is derived " +
  "and non-authoritative, it is not Knowledge and not a Governance act, and nothing here was " +
  "stored, indexed or admitted anywhere.";

/**
 * The provenance for a path that obtained nothing. It must never read as an empty result.
 */
const NOTHING_OBTAINED_PROVENANCE =
  "No joined view was produced, so none is shown. This is NOT an empty result and NOT a statement " +
  "that your organization has recorded nothing: Hebun did not establish the answer. Nothing was " +
  "stored and nothing about your connection or your Knowledge was changed.";

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Heby cross-source commands are server-only.");
  }
}

function ok(command: string, title: string, lines: readonly string[]): HebyCrossSourceCommandResult {
  return {
    status: "ok",
    result: { command, title, lines, tone: "info", provenance: CROSS_SOURCE_PROVENANCE },
  };
}

/**
 * THIS IS THE `UNAVAILABLE != EMPTY` BOUNDARY for the cross-source command.
 *
 * Every path that failed to obtain either half comes through here, and none of them can produce a
 * list. It is rendered in an unavailable tone so it can never be mistaken for a result.
 */
function unavailable(
  command: string,
  title: string,
  lines: readonly string[],
): HebyCrossSourceCommandResult {
  return {
    status: "ok",
    result: { command, title, lines, tone: "unavailable", provenance: NOTHING_OBTAINED_PROVENANCE },
  };
}

/**
 * Why the Knowledge half did not answer, in the operator's words.
 *
 * EVERY ONE OF THESE SAYS THE SAME THING IN DIFFERENT WORDS: nothing is known about what this
 * organization declared. None of them may be shortened into "no declaration", which is the claim
 * this command makes only when the query actually ran.
 */
const LOOKUP_UNAVAILABLE_LINES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "no-tenant": [
    "No organization is resolved for this request, so your declarations were not read.",
  ],
  "no-database": [
    "Hebun could not reach its own records, so your organization's declarations were not read.",
  ],
  "too-many-records": [
    "GitHub returned more records than one Knowledge lookup may cover, so no lookup was made.",
    "Nothing was truncated and nothing was guessed — Hebun would rather ask nothing than ask about some.",
  ],
  "query-failed": [
    "Hebun's own records did not answer, so what your organization has declared is UNKNOWN here.",
  ],
});

/** The total-command ceiling, as an outcome rather than a thrown error. */
type Timed<T> = { readonly timedOut: false; readonly value: T } | { readonly timedOut: true };

async function withinTotalBudget<T>(work: Promise<T>, ms: number): Promise<Timed<T>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<Timed<T>>((resolve) => {
    timer = setTimeout(() => resolve({ timedOut: true }), ms);
  });
  try {
    return await Promise.race([work.then((value) => ({ timedOut: false, value }) as Timed<T>), ceiling]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runHebyCrossSourceCommand(
  input: HebyCrossSourceCommandInput,
  deps: HebyCrossSourceCommandDeps,
): Promise<HebyCrossSourceCommandResult> {
  assertServerRuntime();

  const tenant = await deps.resolveTenant();
  if (!tenant) return { status: "unauthorized" };

  const command = findHebyCommandById(input.commandId);
  if (!command) return { status: "rejected", reason: "unknown-command" };
  if (command.kind !== "cross-source-read") {
    return { status: "rejected", reason: "not-a-cross-source-command" };
  }
  if (command.availability !== "available") return { status: "rejected", reason: "not-available" };

  switch (command.handler) {
    case "repository-knowledge":
      return repositoryKnowledge(command.slash, tenant, deps);
    default:
      /* A cross-source command with no implementation joins nothing rather than joining anything. */
      return { status: "rejected", reason: "no-cross-source-handler" };
  }
}

/**
 * One line per repository, carrying its provider identity and what the organization declared.
 *
 * THE IDENTITY IS THE NUMERIC ID, in the line's own reference, exactly as INT-5B1 composes it. The
 * full name is display text that follows a rename; the number never moves. The join was performed
 * on the number, and this line shows the number so a reader can check that for themselves.
 */
function joinedLine(
  repository: GitHubRepositoryDiscovery["repositories"][number],
  declaration: { readonly factKey: string; readonly domainKey: string; readonly hasActiveKnowledgeNode: boolean } | undefined,
  lookupResolved: boolean,
): string {
  const ref = githubRepositoryRecordRef(repository.repositoryId);
  const head = `[${ref}] ${repository.fullName}`;

  if (!lookupResolved) {
    /*
     * THE LOOKUP DID NOT RUN. This line may not say "no declaration" — it says what is true, which
     * is that Hebun does not know.
     */
    return `${head} — KNOWLEDGE LOOKUP UNAVAILABLE: your declarations were not read for this record.`;
  }
  if (!declaration) {
    return `${head} — NO DECLARATION RECORDED: nobody in your organization has recorded a Knowledge relationship for this repository.`;
  }
  const node = declaration.hasActiveKnowledgeNode
    ? "the fact has an active Knowledge node"
    : "the fact currently has no active Knowledge node";
  return (
    `${head} — DECLARATION RECORDED: ${declaration.domainKey} / ${declaration.factKey} (${node}).`
  );
}

async function repositoryKnowledge(
  slash: string,
  tenant: TenantContext,
  deps: HebyCrossSourceCommandDeps,
): Promise<HebyCrossSourceCommandResult> {
  const discover = deps.discover ?? discoverInstallationRepositories;
  const lookup = deps.lookup ?? findKnowledgeRelationshipsForExternalRecords;
  const totalTimeoutMs = deps.totalTimeoutMs ?? GITHUB_PROVIDER_READ_BUDGET.totalTimeoutMs;

  /* 1 · THE PROVIDER HALF, through the released seam and under the released budget. */
  const timed = await withinTotalBudget(
    discover(tenant, { timeoutMs: GITHUB_PROVIDER_READ_BUDGET.providerTimeoutMs }),
    totalTimeoutMs,
  );

  if (timed.timedOut) {
    return unavailable(slash, "GitHub did not answer in time", [
      `The provider read is bounded at ${totalTimeoutMs} ms and GitHub had not answered, so Hebun stopped waiting.`,
      "NOTHING IS KNOWN about your installation from this, and no Knowledge lookup was made.",
    ]);
  }

  const outcome = timed.value;
  if (!outcome.ok) {
    /*
     * THE PROVIDER FAILED, SO THE JOIN DOES NOT HAPPEN — and the Knowledge side is not queried at
     * all. Reporting declarations for repositories Hebun could not confirm exist would be answering
     * a question nobody asked, with half the evidence missing.
     */
    if ("refusal" in outcome) {
      return unavailable(
        slash,
        "Repositories were not read, so nothing was joined",
        REFUSAL_LINES[outcome.refusal] ?? [
          "This organization cannot currently read repository activity, and no read was attempted.",
        ],
      );
    }
    return unavailable(
      slash,
      "GitHub did not answer, so nothing was joined",
      FAILURE_LINES[outcome.failure] ?? [
        "GitHub did not return a repository page, and Hebun will not present that as an empty list.",
      ],
    );
  }

  const discovery = outcome.value;
  /* The ceiling is enforced here as well as in the seam — see INT-5B1's reasoning, unchanged. */
  const shown = discovery.repositories.slice(0, GITHUB_PROVIDER_READ_BUDGET.maxRecords);

  if (shown.length === 0) {
    return ok(slash, "No repositories in this installation", [
      "GitHub answered, and this installation currently covers no repositories.",
      "There is therefore nothing to join, and your organization's declarations were not read.",
      "That is GitHub's answer, not a failed read: the installation exists and Hebun reached it.",
    ]);
  }

  /* 2 · THE KNOWLEDGE HALF — one batched, tenant-scoped query for the whole page. */
  const recordIds = shown.map((repository) => String(repository.repositoryId));
  const declarations: ExternalReferenceLookup = await lookup(
    tenant,
    {
      providerKey: GITHUB_PROVIDER_KEY,
      capability: GITHUB_REPOSITORY_ACTIVITY_CAPABILITY,
      recordType: GITHUB_REPOSITORY_RECORD_TYPE,
    },
    recordIds,
  );

  const resolved = declarations.status === "resolved";
  const byRecordId = new Map(
    resolved ? declarations.declarations.map((d) => [d.recordId, d] as const) : [],
  );

  /* 3 · THE JOIN, in memory, on the provider's own id. Exact equality, nothing inferred. */
  const lines = shown.map((repository) =>
    joinedLine(repository, byRecordId.get(String(repository.repositoryId)), resolved),
  );

  const summary: string[] = [];
  if (resolved) {
    const recorded = shown.filter((r) => byRecordId.has(String(r.repositoryId))).length;
    summary.push(
      `${recorded} of ${shown.length} repositor${shown.length === 1 ? "y" : "ies"} on this page has ` +
        `a recorded Knowledge relationship; ${shown.length - recorded} ${
          shown.length - recorded === 1 ? "does" : "do"
        } not.`,
      "A repository with no declaration means nobody recorded one — it does not mean Hebun looked " +
        "inside the repository and found nothing.",
    );
  } else {
    summary.push(
      "KNOWLEDGE LOOKUP UNAVAILABLE — the repositories below are real, but what your organization " +
        "has declared about them is UNKNOWN, not absent.",
      ...(LOOKUP_UNAVAILABLE_LINES[declarations.reason] ?? [
        "Hebun could not read your organization's declarations.",
      ]),
    );
  }

  return ok(slash, "Repository knowledge coverage", [
    ...lines,
    "",
    ...summary,
    "",
    ...boundaryLines(discovery, shown.length),
    "",
    "These are repository names, their coverage, and whether your organization recorded a Knowledge " +
      "relationship for them. This command reads no file, no source line, no commit content and no " +
      "message body — and it reads no Knowledge wording either, only which fact holds the relationship.",
  ]);
}
