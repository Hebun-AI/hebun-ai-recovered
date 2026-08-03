/**
 * Enterprise Memory Persistence — application persistence gate.
 *
 * The gate is the only path from an admission result to storage. It accepts a
 * successfully approved admission result and nothing else: rejected, deferred,
 * needs-review, and archived-candidate results are refused before any write. The
 * gate never recomputes admission — it narrows the decision by its discriminant
 * (no unsafe cast) and preserves the admission reference into the stored record.
 */

import type { MemoryCandidate } from "@/features/enterprise-memory";
import type { MemoryAdmissionResult } from "@/features/enterprise-memory-admission-engine";
import type { UnitOfWork } from "@/features/enterprise-unit-of-work";
import type {
  MemoryPersistenceRequest,
  MemoryPersistenceResult,
} from "@/features/enterprise-memory-persistence/contracts";
import type { MemoryRepository } from "@/features/enterprise-memory-persistence/port";

/** Injected storage bookkeeping. Kept explicit so persistence stays deterministic. */
export interface MemoryPersistenceContext {
  readonly storedAt: string;
  readonly concurrencyToken: string;
}

/** Builds the neutral persistence request from an approved candidate. */
function buildRequest(
  candidate: MemoryCandidate,
  policySetId: string,
  decidedAt: string,
  context: MemoryPersistenceContext,
): MemoryPersistenceRequest {
  return {
    memoryId: candidate.identity.memoryId,
    namespace: candidate.identity.namespace,
    content: candidate.content,
    classification: candidate.classification,
    provenance: candidate.provenance,
    authority: candidate.authority,
    confidence: candidate.confidence,
    source: candidate.source,
    relationships: candidate.relationships,
    admissionReference: {
      grantReference: candidate.authority.grantReference,
      policySetId,
      decidedAt,
    },
    storedAt: context.storedAt,
    concurrencyToken: context.concurrencyToken,
  };
}

/**
 * Persists an approved admission result through the given unit of work. Returns a
 * ValidationFailure — never a write — when the result is not an approval.
 */
export async function persistApprovedMemory(
  unitOfWork: UnitOfWork<MemoryRepository>,
  result: MemoryAdmissionResult,
  context: MemoryPersistenceContext,
): Promise<MemoryPersistenceResult> {
  if (result.decision.outcome !== "approved") {
    return {
      status: "ValidationFailure",
      issues: [`admission outcome "${result.decision.outcome}" is not approved; persistence refused`],
    };
  }

  const request = buildRequest(
    result.candidate,
    result.decision.appliedPolicySet,
    result.decision.decidedAt,
    context,
  );

  const outcome = await unitOfWork.execute(async ({ resources: repository }) => {
    return repository.storeApprovedMemory(request);
  });
  return outcome.value;
}
