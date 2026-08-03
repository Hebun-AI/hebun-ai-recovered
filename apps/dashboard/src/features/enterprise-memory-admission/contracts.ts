/**
 * Enterprise Memory Admission — aggregate report contract.
 *
 * The Memory Evaluation Report is the immutable artifact that ties together the
 * authority used, the policy applied, the evaluation performed, and the decision
 * reached for a single candidate. It is a self-contained record: no persistence,
 * no history, no audit trail, and no linkage to prior reports. It captures a
 * single evaluation moment and nothing more.
 */

import type { MemoryTimestamp } from "@/features/enterprise-memory";
import type { AdmissionAuthority } from "@/features/enterprise-memory-admission/authority";
import type { MemoryAdmissionRequest } from "@/features/enterprise-memory-admission/boundaries";
import type { AdmissionDecision } from "@/features/enterprise-memory-admission/decisions";
import type { MemoryEvaluation } from "@/features/enterprise-memory-admission/evaluation";
import type { AdmissionPolicySet } from "@/features/enterprise-memory-admission/policies";

export type EvaluationReportId = string;

/** The identity of whoever produced the report. Recorded, not authenticated. */
export interface ReviewerIdentity {
  readonly reviewerId: string;
  readonly displayName: string;
}

/** A short, human-authored synopsis of the evaluation. Text only. */
export interface EvaluationSummary {
  readonly headline: string;
  readonly detail: string;
}

/**
 * The complete, immutable evaluation report for one admission request. Every
 * field is readonly; a report is never amended — a new report would supersede
 * it, but this phase models neither storage nor succession.
 */
export interface MemoryEvaluationReport {
  readonly reportId: EvaluationReportId;
  readonly request: MemoryAdmissionRequest;
  readonly summary: EvaluationSummary;
  readonly evaluation: MemoryEvaluation;
  readonly authorityUsed: AdmissionAuthority;
  readonly policyApplied: AdmissionPolicySet;
  readonly decision: AdmissionDecision;
  readonly reviewer: ReviewerIdentity;
  readonly producedAt: MemoryTimestamp;
}
