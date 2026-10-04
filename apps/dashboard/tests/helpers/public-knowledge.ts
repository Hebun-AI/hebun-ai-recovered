/*
 * KNOWLEDGE TRUST PHASE 5 — a stand-in public Knowledge universe for suites that prepare a content
 * draft and are about something else (authorship, brief, provenance, observation). It runs the REAL
 * public resolver over one ratified + allowed fact that the question never matches, so the
 * preparation proceeds exactly as an organization with cleared Knowledge but no relevant fact would.
 * The gate itself is proven in tests/knowledge-trust-phase-5.
 */
import { resolvePublicKnowledgeEvidence } from "../../src/features/heby-answer/knowledge-evidence.server";
import type { KnowledgeSourceRecord } from "../../src/features/knowledge/contracts";
import type { DurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import type { KnowledgeTenant } from "../../src/features/knowledge/knowledge-read.server";

const NODE = "00000000-0000-4000-8000-0000000000c5";
const CLEARED = {
  factId: "00000000-0000-4000-8000-0000000000f5", factKey: "cleared-fact", domainKey: "company", scope: "organization",
  title: "A cleared fact", statement: "A cleared fact.", lifecycleStatus: "ratified", authorityClass: null, health: null,
  ratified: true, ratifiedAt: null, ratificationDecisionId: "d", governanceSessionId: null, ratifiedByActorId: null,
  activeKnowledgeNodeId: NODE, effectiveFrom: null, effectiveUntil: null, nextReviewAt: null, knowledgeVersion: 1,
} as unknown as KnowledgeSourceRecord;

export const publicKnowledgeNoMatch = (tenant: KnowledgeTenant, query: string) =>
  resolvePublicKnowledgeEvidence(tenant, query, {
    getRepo: () =>
      ({
        listFacts: async () => ({ records: [CLEARED], incomplete: [], truncated: false }),
        searchFacts: async () => ({ rows: [], incomplete: [], truncated: false, trigramAvailable: false }),
        hasTrigram: async () => false,
      }) as unknown as DurableKnowledgeRepository,
    readRejectedKnowledgeVersions: async () => ({ status: "read", rejectedNodeIds: new Set() }),
    readPublicUse: async () => ({ status: "read", states: new Map([[NODE, "allowed"]]) }),
  });

/**
 * An injected resolution standing for Knowledge that IS ratified + public-use allowed. Like the KR4
 * rule for any injected resolver, there is no retrieval behind it, so no evidence set is invented.
 */
export const publicKnowledgeResolved = (resolution: import("../../src/features/heby-runtime").SourceResolution) => ({
  status: "resolved" as const,
  universeCount: 1,
  resolution,
  evidence: undefined as never,
});
