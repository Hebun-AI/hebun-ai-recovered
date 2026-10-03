/*
 * heby-answer/revision-generation-evidence.server.ts — the Knowledge evidence supplied to generation
 * of ONE EXACT revision, read back for its reviewer (KT-2). Server-only.
 *
 * ── THREE EXISTING READS, COMPOSED; NO NEW AUTHORITY ─────────────────────────
 *
 *   revision           `readRevisionProvenance`  — Work Artifact's own read, tenant-scoped, pair-checked
 *   recorded evidence  `listAnswerEvidence`      — Heby conversation persistence's own read, tenant-scoped
 *   replay             `fromStoredEvidence`      — the projection a reloaded answer already uses
 *
 * THE GATE IS THE REVISION. A reloaded conversation reaches its evidence only through a conversation
 * the tenant owns, and there is deliberately no standalone evidence endpoint (KR5). This keeps that
 * rule: the message id is never supplied by a caller. It is read from the revision row, which the
 * caller can reach only inside its own organization — so the evidence of a message is reachable only
 * through the exact revision that message generated.
 *
 * ── HISTORY, NOT A RE-RUN ────────────────────────────────────────────────────
 *
 * Every value is the one recorded at generation time. Current Knowledge is not read and retrieval is
 * not re-run: a record superseded or rejected since still shows exactly as it was supplied, because
 * that is what the model was given and what the reviewer needs to see.
 *
 * READ ONLY, and fail-closed: a read that fails is `unavailable`, never "nothing recorded".
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { fromStoredEvidence } from "@/features/heby-conversation/answer-evidence";
import {
  resolveConversationRepoOrNull,
  type DurableConversationRepository,
} from "@/features/heby-conversation/durable-conversation-repository.server";
import {
  readRevisionProvenance,
  type WorkArtifactReadDeps,
} from "@/features/work-artifacts/read-work-artifacts.server";
import type { RevisionGenerationEvidence } from "./revision-generation-evidence";

export interface RevisionGenerationEvidenceDeps extends WorkArtifactReadDeps {
  readonly getConversationRepo?: () => DurableConversationRepository | null;
}

export async function readRevisionGenerationEvidence(
  tenant: Pick<TenantContext, "tenantId"> | null,
  input: { readonly artifactId: string; readonly revisionId: string },
  deps: RevisionGenerationEvidenceDeps = {},
): Promise<RevisionGenerationEvidence> {
  if (typeof window !== "undefined") {
    throw new Error("Revision evidence reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "unauthorized" };

  const provenance = await readRevisionProvenance(
    tenant,
    { artifactId: input?.artifactId, revisionId: input?.revisionId },
    { getDb: deps.getDb },
  );
  if (provenance.status === "not-found") return { status: "revision-unresolvable" };
  if (provenance.status === "unavailable") return { status: "unavailable", reason: "persistence-unavailable" };

  const { revisionNo, sourceMessageId } = provenance.revision;
  if (!sourceMessageId) return { status: "no-generation-message", revisionNo };

  const repo = (deps.getConversationRepo ?? resolveConversationRepoOrNull)();
  if (!repo) return { status: "unavailable", reason: "persistence-unavailable" };

  let stored: Awaited<ReturnType<DurableConversationRepository["listAnswerEvidence"]>>;
  try {
    stored = await repo.listAnswerEvidence({ tenantId: tenant.tenantId }, [sourceMessageId]);
  } catch {
    return { status: "unavailable", reason: "provenance-unreadable" };
  }
  const set = stored.find((candidate) => candidate.messageId === sourceMessageId);
  if (!set) return { status: "no-retrieval-recorded", revisionNo };

  const replayed = fromStoredEvidence(set);
  return {
    status: "recorded",
    revisionNo,
    selection: {
      status: replayed.status,
      truncated: replayed.truncated,
      excludedCount: replayed.excludedCount,
      degradedReason: replayed.degradedReason,
      unavailableReason: replayed.unavailableReason,
    },
    items: replayed.items.map((item) => ({
      factKey: item.factKey,
      domainKey: item.domainKey,
      title: item.title,
      scope: item.scope,
      knowledgeNodeId: item.knowledgeNodeId,
      knowledgeVersion: item.knowledgeVersion,
      factVersion: item.factVersion,
      excerpt: item.excerpt,
      excerptTruncated: item.excerptTruncated,
      ratifiedAtGeneration: item.ratified,
      authorityClass: item.authorityClass,
      lifecycleStatus: item.lifecycleStatus,
      freshness: item.freshness,
      matchedTerms: item.explanation.matchedTerms,
    })),
  };
}
