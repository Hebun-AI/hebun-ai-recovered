/*
 * knowledge-retrieval — the PURE retrieval layer (KR3).
 *
 * Everything re-exported here is pure: types, the Turkish fold, the eligibility gate, the ranking
 * blend and the diversity cap. There is no database, no clock, no session, no model and no authority
 * in this module, which is what lets the whole of retrieval's decision-making be proven without a
 * database — and what keeps retrieval a computation rather than a second Knowledge system.
 *
 * The server seam that actually reads rows lives with the Knowledge read seam it extends
 * (`features/knowledge/knowledge-read.server.ts`), not here. Retrieval owns how candidates are
 * chosen, filtered, scored and bounded; Knowledge owns what a record IS.
 */

export {
  RETRIEVAL_CANDIDATE_POOL,
  RETRIEVAL_DEFAULT_LIMIT,
  RETRIEVAL_MAX_LIMIT,
  RETRIEVAL_MAX_PER_SOURCE,
  RETRIEVAL_PROVENANCE,
  RETRIEVAL_TRIGRAM_MISSING,
  RETRIEVAL_WEIGHTS,
  resolveRetrievalLimit,
  sourceDigestOf,
  type RetrievalCandidate,
  type RetrievalCapability,
  type RetrievalExclusion,
  type RetrievalExclusionReason,
  type RetrievalRequest,
  type RetrievalResult,
  type RetrievalScore,
} from "./contracts";

export {
  TURKISH_FOLD_FROM,
  TURKISH_FOLD_TO,
  foldSql,
  foldTurkish,
  normalizeQuery,
  type NormalizedQuery,
} from "./query-normalization";

export {
  exclusionReasonFor,
  isEligible,
  partitionByEligibility,
  type EligibilityPartition,
} from "./eligibility";

export {
  applySourceDiversity,
  combineScore,
  rankCandidates,
  squash,
  toCandidate,
  type DiversityOutcome,
  type ScoredRow,
} from "./ranking";
