/*
 * knowledge/knowledge-read.server.ts — the ONE Knowledge read orchestration (K1).
 *
 * Everything that wants to read Knowledge — the Heby `/knowledge` and `/source` commands, and
 * Heby's natural-language grounding — goes through here. There is deliberately one seam, so
 * "how is Knowledge read, and under whose authority" has exactly one answer.
 *
 * FAIL-CLOSED ORDER, and it is not negotiable:
 *   1. an authorized TenantContext must exist (the client never supplies one),
 *   2. durable persistence must be configured,
 *   3. only then is anything read, and only within that tenant.
 * Any gate that fails returns an honest unavailable state that names the missing thing. No
 * step degrades to the seeded knowledge-crud store, the mock knowledge graph, or a default
 * tenant — substituting any of those is exactly the fabrication K1 exists to prevent.
 *
 * Dependencies are injectable so the whole surface is provable with no database and no network.
 *
 * Server-only.
 */

import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import {
  resolveKnowledgeRepoOrNull,
  type DurableKnowledgeRepository,
  type KnowledgeScopeContext,
} from "./durable-knowledge-repository.server";
import {
  listKnowledgeCapabilities,
  type KnowledgeCapabilityStatus,
} from "./capability-map";
import {
  RETRIEVAL_TRIGRAM_MISSING,
  applySourceDiversity,
  normalizeQuery,
  partitionByEligibility,
  rankCandidates,
  resolveRetrievalLimit,
  toCandidate,
  type RetrievalCapability,
  type RetrievalRequest,
  type RetrievalResult,
} from "@/features/knowledge-retrieval";
import type {
  KnowledgeListing,
  KnowledgeSourceRead,
  KnowledgeSourceRecord,
} from "./contracts";

/** The narrow slice of a TenantContext a Knowledge read depends on. */
export type KnowledgeTenant = Pick<TenantContext, "tenantId">;

export interface KnowledgeReadDeps {
  /** Returns the durable repository, or null when persistence is not configured. */
  readonly getRepo?: () => DurableKnowledgeRepository | null;
  /** Injected clock, so freshness derivation is deterministic in tests. */
  readonly now?: () => Date;
}

function assertServerRuntime(): void {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge reads are server-only.");
  }
}

/** Resolve the gates common to every read. Returns the scope, or the honest failure. */
function openScope(
  tenant: KnowledgeTenant | null,
  deps: KnowledgeReadDeps,
):
  | { readonly ok: true; readonly scope: KnowledgeScopeContext; readonly repo: DurableKnowledgeRepository }
  | { readonly ok: false; readonly reason: "no-authorized-tenant-context" | "persistence-not-configured" } {
  if (!tenant?.tenantId) return { ok: false, reason: "no-authorized-tenant-context" };
  const repo = (deps.getRepo ?? resolveKnowledgeRepoOrNull)();
  if (!repo) return { ok: false, reason: "persistence-not-configured" };
  return { ok: true, scope: { tenantId: tenant.tenantId }, repo };
}

/**
 * List the knowledge the authorized tenant actually holds. Read-only, tenant-scoped, and
 * honest when empty: an empty organization returns an empty list, never a seeded one.
 */
export async function listKnowledgeSources(
  tenant: KnowledgeTenant | null,
  deps: KnowledgeReadDeps = {},
): Promise<KnowledgeListing> {
  assertServerRuntime();
  const opened = openScope(tenant, deps);
  if (!opened.ok) {
    return {
      status: "unavailable",
      reason: opened.reason,
      detail:
        opened.reason === "no-authorized-tenant-context"
          ? "No authorized organization context, so nothing was read."
          : "Durable persistence is not configured, so the canonical Knowledge tables cannot be read.",
    };
  }

  try {
    const result = await opened.repo.listFacts(opened.scope, (deps.now ?? (() => new Date()))());
    return {
      status: "read",
      records: result.records,
      incomplete: result.incomplete,
      truncated: result.truncated,
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "Knowledge read failed.",
    };
  }
}

/**
 * Read ONE named knowledge source, by canonical fact key, within the authorized tenant.
 *
 * The name is a LOOKUP KEY, never a location. It is not a path, not a URL, and not a
 * filesystem reference: it is matched as an exact value against `knowledge_facts.fact_key`
 * inside the tenant, so a traversal string, an absolute URL, or a script fragment simply
 * fails to match and nothing is fetched, opened, or executed.
 *
 * When a key exists in several domains/scopes, ALL candidates are returned as an honest
 * ambiguity — one is never silently picked.
 */
export async function readKnowledgeSourceByName(
  tenant: KnowledgeTenant | null,
  name: string,
  deps: KnowledgeReadDeps = {},
): Promise<KnowledgeSourceRead> {
  assertServerRuntime();
  const opened = openScope(tenant, deps);
  if (!opened.ok) {
    return {
      status: "unavailable",
      reason: opened.reason,
      detail:
        opened.reason === "no-authorized-tenant-context"
          ? "No authorized organization context, so nothing was read."
          : "Durable persistence is not configured, so the canonical Knowledge tables cannot be read.",
    };
  }

  try {
    const found = await opened.repo.findFactsByKey(
      opened.scope,
      name,
      (deps.now ?? (() => new Date()))(),
    );
    if (found.records.length > 1) {
      return { status: "ambiguous", candidates: found.records };
    }
    if (found.records.length === 1) {
      return { status: "found", record: found.records[0] };
    }
    if (found.incomplete.length > 0) {
      return { status: "incomplete", stub: found.incomplete[0] };
    }
    // A key owned by another tenant is indistinguishable from one that does not exist.
    return { status: "not-found" };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "Knowledge read failed.",
    };
  }
}

/**
 * KR3 — the FIRST read in this repository where the user's question decides which rows come back.
 *
 * It sits BESIDE `listKnowledgeSources`, which is unchanged and still backs `/knowledge` and the
 * `/source` command. Listing answers "what does my organization hold"; retrieval answers "what in it
 * bears on this question". Those are different questions and both remain answerable.
 *
 * The same fail-closed order applies: authorized tenant, then persistence, then read. Nothing here
 * writes, and nothing it returns is persisted — a match score does not outlive the request.
 *
 * FOUR OUTCOMES, KEPT APART ON PURPOSE:
 *   empty-query   the question carried no searchable token.
 *   empty-corpus  the organization holds NO knowledge at all.
 *   no-match      the organization HOLDS knowledge; none of it matched this question.
 *   matched       candidates, plus what was excluded and why.
 * Collapsing `no-match` into `empty-corpus` would tell an operator their organization knows nothing
 * on the evidence that one question missed. That claim is false and this seam must never make it.
 */
export async function searchKnowledge(
  tenant: KnowledgeTenant | null,
  request: RetrievalRequest,
  deps: KnowledgeReadDeps = {},
): Promise<RetrievalResult> {
  assertServerRuntime();
  const opened = openScope(tenant, deps);
  if (!opened.ok) {
    return {
      status: "unavailable",
      reason: opened.reason,
      detail:
        opened.reason === "no-authorized-tenant-context"
          ? "No authorized organization context, so nothing was read."
          : "Durable persistence is not configured, so the canonical Knowledge tables cannot be read.",
    };
  }

  const now = (deps.now ?? (() => new Date()))();

  try {
    const trigramAvailable = await opened.repo.hasTrigram();
    const capability: RetrievalCapability = {
      lexical: true,
      trigram: trigramAvailable,
      degradedReason: trigramAvailable ? null : RETRIEVAL_TRIGRAM_MISSING,
    };

    const normalized = normalizeQuery(request.queryText);
    if (normalized.isEmpty) return { status: "empty-query", capability };

    const found = await opened.repo.searchFacts(
      opened.scope,
      normalized.orForm,
      normalized.raw,
      now,
      { domainKey: request.domainKey, scope: request.scope },
    );

    if (found.rows.length === 0) {
      /*
       * Nothing matched. Before saying so, establish WHICH truth this is — an organization with an
       * empty corpus and an organization whose corpus does not cover this question need different
       * sentences. One extra bounded read is the honest price of not guessing.
       */
      const listing = await opened.repo.listFacts(opened.scope, now);
      const holdsNothing = listing.records.length === 0 && listing.incomplete.length === 0;
      return holdsNothing
        ? { status: "empty-corpus", capability }
        : { status: "no-match", excluded: [], capability };
    }

    const { eligible, excluded } = partitionByEligibility(
      found.rows.map((row) => row.record),
      now,
    );
    const eligibleKeys = new Set(eligible.map((record) => record.factKey));
    const ranked = rankCandidates(
      found.rows
        .filter((row) => eligibleKeys.has(row.record.factKey))
        .map((row) => toCandidate(row)),
    );
    const diversity = applySourceDiversity(ranked);
    const limit = resolveRetrievalLimit(request.limit);
    const candidates = diversity.kept.slice(0, limit);

    /*
     * Every candidate was disqualified. That is still not an empty corpus, and it is not the same as
     * "nothing matched" either — records DID match, and the caller is told exactly why none survived.
     */
    if (candidates.length === 0) return { status: "no-match", excluded, capability };

    return {
      status: "matched",
      candidates,
      excluded,
      diversityPruned: diversity.pruned,
      truncated: found.truncated,
      capability,
    };
  } catch (error) {
    return {
      status: "unavailable",
      reason: "read-failed",
      detail: error instanceof Error ? error.message : "Knowledge retrieval failed.",
    };
  }
}

/**
 * The truthful Knowledge availability report: every capability stated SEPARATELY, plus the
 * tenant's real listing state. Deliberately never collapses into "Knowledge connected".
 */
export interface KnowledgeAvailabilityReport {
  readonly capabilities: readonly KnowledgeCapabilityStatus[];
  readonly listing: KnowledgeListing;
}

export async function readKnowledgeAvailability(
  tenant: KnowledgeTenant | null,
  deps: KnowledgeReadDeps = {},
): Promise<KnowledgeAvailabilityReport> {
  return {
    capabilities: listKnowledgeCapabilities(),
    listing: await listKnowledgeSources(tenant, deps),
  };
}

/**
 * Summarize a record for display in one line. Provenance and classification are PRESERVED:
 * authority class, lifecycle and freshness travel with the record and are never flattened
 * into a single "knowledge result".
 */
export function describeKnowledgeRecord(record: KnowledgeSourceRecord): string {
  const authority =
    record.authorityClass === null
      ? "authority not stated"
      : record.authorityClass === "authoritative"
        ? "authoritative"
        : "provisional (NOT settled truth)";
  const lifecycle = record.lifecycleStatus ?? "lifecycle not stated";
  const ratified = record.ratified ? "ratified" : "no ratification recorded";
  return `${record.factKey} — ${record.title} · ${record.domainKey} · ${record.scope} · ${authority} · ${lifecycle} · ${ratified} · freshness: ${record.freshness} · v${record.knowledgeVersion}`;
}
