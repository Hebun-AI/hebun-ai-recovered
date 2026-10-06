/*
 * knowledge-grounding/read-grounding-universe.server.ts — WF-3A: read the complete eligible
 * Knowledge grounding universe for the trusted tenant.
 *
 * Filter order:
 *   A. trusted tenant (server context only, never a client value)
 *   B. the authoritative listing of active versions — unavailable or truncated → refused
 *   C. retrieval eligibility (lifecycle, effective window, Governance rejection) — the released gate
 *   D. a non-empty statement
 *   E. SCI-2B facts + `agent-record-work-grounding` evaluation, per version
 *   F. any unavailable authoritative read → refused whole
 *   G. complete-universe bound, H. deterministic order, I. aliases — in `assembleKnowledgeGroundingUniverse`
 *
 * `revalidateKnowledgeReferences` re-reads the versions a model REFERENCED, just before filing.
 *
 * READ ONLY. Server-only. Called by agent origination's explicit Knowledge mode (WF-3C).
 */
import type { TenantContext } from "@/features/auth/tenant/tenant-context";
import { listKnowledgeSources, type KnowledgeReadDeps } from "@/features/knowledge/knowledge-read.server";
import { readRejectedKnowledgeVersions } from "@/features/governance-decision/knowledge-rejection-read.server";
import { partitionByEligibility } from "@/features/knowledge-retrieval/eligibility";
import {
  readKnowledgeAdmissibilityFacts,
  type KnowledgeAdmissibilityFactsDeps,
} from "@/features/secure-content-admissibility/knowledge-facts.server";
import {
  assembleKnowledgeGroundingUniverse,
  hasGroundingStatement,
  judgeKnowledgeRevalidation,
  type KnowledgeGroundingCandidate,
  type KnowledgeGroundingUniverse,
  type KnowledgeRevalidation,
} from "./contracts";

export interface KnowledgeGroundingReadDeps extends KnowledgeReadDeps {
  readonly admissibility?: KnowledgeAdmissibilityFactsDeps;
}

const UNAVAILABLE: KnowledgeGroundingUniverse = { status: "refused", reason: "authoritative-facts-unavailable" };

export async function readKnowledgeGroundingUniverse(
  tenant: Pick<TenantContext, "tenantId"> | null,
  deps: KnowledgeGroundingReadDeps = {},
): Promise<KnowledgeGroundingUniverse> {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge grounding reads are server-only.");
  }
  if (!tenant?.tenantId) return UNAVAILABLE;

  const [listing, rejection] = await Promise.all([
    listKnowledgeSources(tenant, deps).catch(() => null),
    (deps.readRejectedKnowledgeVersions ?? readRejectedKnowledgeVersions)(tenant).catch(() => null),
  ]);
  // A capped listing cannot prove the universe complete.
  if (listing?.status !== "read" || listing.truncated || rejection?.status !== "read") return UNAVAILABLE;

  const now = (deps.now ?? (() => new Date()))();
  const records = partitionByEligibility(listing.records, now, rejection.rejectedNodeIds).eligible.filter(
    (record) => hasGroundingStatement(record) && record.activeKnowledgeNodeId !== null,
  );

  // ponytail: one SCI read per version (≤ 50 by the listing cap); a batch reader if the cap grows.
  const entries = await Promise.all(
    records.map(async (record) => ({
      record,
      facts: await readKnowledgeAdmissibilityFacts(tenant, record.activeKnowledgeNodeId!, now, deps.admissibility).catch(
        () => ({ status: "unavailable" }) as const,
      ),
    })),
  );
  return assembleKnowledgeGroundingUniverse(tenant.tenantId, entries);
}

/** Re-read Governance's rejections and SCI-2B's facts for exactly the referenced versions. */
export async function revalidateKnowledgeReferences(
  tenant: Pick<TenantContext, "tenantId"> | null,
  referenced: readonly KnowledgeGroundingCandidate[],
  deps: KnowledgeGroundingReadDeps = {},
): Promise<KnowledgeRevalidation> {
  if (typeof window !== "undefined") {
    throw new Error("Knowledge grounding reads are server-only.");
  }
  if (!tenant?.tenantId) return { status: "refused", reason: "authoritative-facts-unavailable" };
  const rejection = await (deps.readRejectedKnowledgeVersions ?? readRejectedKnowledgeVersions)(tenant).catch(() => null);
  if (rejection?.status !== "read") return { status: "refused", reason: "authoritative-facts-unavailable" };
  const now = (deps.now ?? (() => new Date()))();
  const facts = await Promise.all(
    referenced.map((c) =>
      readKnowledgeAdmissibilityFacts(tenant, c.knowledgeNodeId, now, deps.admissibility).catch(() => ({ status: "unavailable" }) as const),
    ),
  );
  return judgeKnowledgeRevalidation(tenant.tenantId, referenced, rejection.rejectedNodeIds, facts);
}
