import assert from "node:assert/strict";
import type {
  AdmissionAuthority,
  AdmissionDecision,
  AdmissionPolicy,
  AdmissionPolicySet,
  DimensionAssessment,
  MemoryAdmissionRequest,
  MemoryEvaluation,
  MemoryEvaluationReport,
} from "../../src/features/enterprise-memory-admission";

const at = "2026-08-03T10:00:00.000Z";

// Authority is a discriminated union; each kind is a distinct, separate shape.
const authorities: AdmissionAuthority[] = [
  { kind: "director", authorityId: "auth-d", assertedAt: at },
  { kind: "organization", authorityId: "auth-o", assertedAt: at, organizationScope: "org-1" },
  { kind: "department", authorityId: "auth-dep", assertedAt: at, organizationScope: "org-1", departmentScope: "dep-1" },
  { kind: "system", authorityId: "auth-s", assertedAt: at, mandateReference: "mandate://1" },
  { kind: "external", authorityId: "auth-e", assertedAt: at, externalReference: "ext://1" },
  { kind: "human", authorityId: "auth-h", assertedAt: at, subjectId: "person-1" },
];
assert.equal(new Set(authorities.map((a) => a.kind)).size, 6);

// Evaluation dimensions are independent — nine orthogonal assessments.
const assessments: DimensionAssessment[] = [
  { dimension: "truth", standing: "strong", evidence: [] },
  { dimension: "relevance", standing: "adequate", evidence: [] },
  { dimension: "business-value", standing: "adequate", measure: 0.7, evidence: [] },
  { dimension: "strategic-importance", standing: "weak", evidence: [] },
  { dimension: "confidence", standing: "strong", evidence: [] },
  { dimension: "evidence", standing: "adequate", evidence: [{ evidenceId: "e1", describedBy: "doc" }] },
  { dimension: "freshness", standing: "strong", evidence: [] },
  { dimension: "consistency", standing: "adequate", evidence: [] },
  { dimension: "source-reliability", standing: "strong", evidence: [] },
];
assert.equal(new Set(assessments.map((d) => d.dimension)).size, 9);
const evaluation: MemoryEvaluation = { assessedAt: at, dimensions: assessments };

// Policies are separate declarative contracts, one per kind.
const policies: AdmissionPolicy[] = [
  { kind: "required-evidence", minimumCount: 2, dimensions: ["evidence", "truth"] },
  { kind: "required-authority", acceptedAuthorities: ["director", "organization"] },
  { kind: "required-confidence", minimumLevel: "high", minimumStanding: "adequate" },
  { kind: "required-classification", acceptedSensitivities: ["internal", "confidential"] },
  { kind: "expiration", validForDays: 365 },
  { kind: "review", reviewEveryDays: 90, requiredReviewerAuthority: "director" },
];
assert.equal(new Set(policies.map((p) => p.kind)).size, 6);
const policySet: AdmissionPolicySet = { policySetId: "policy-set-1", policies };

// Decisions are separate immutable outcomes, one per outcome.
const decisions: AdmissionDecision[] = [
  { outcome: "approved", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1" },
  { outcome: "rejected", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", reason: "insufficient evidence" },
  { outcome: "deferred", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", pendingOn: ["evidence"] },
  { outcome: "needs-review", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", reviewNote: "escalate" },
  { outcome: "archived-candidate", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", archivedReason: "stale" },
];
assert.equal(new Set(decisions.map((d) => d.outcome)).size, 5);

// A request is an inbound claim carrying a claimed authority (not permission).
const request: MemoryAdmissionRequest = {
  requestId: "req-1",
  proposedFor: "memory-1",
  content: { statement: "Vendor SLA is 99.9%.", attributes: { uptime: 99.9 } },
  proposedClassification: { category: "vendor", sensitivity: "internal", tags: ["sla"] },
  claimedAuthority: authorities[0],
  offeredEvidence: [{ evidenceId: "e1", describedBy: "contract" }],
  submittedAt: at,
};

// The report ties authority + policy + evaluation + decision, immutably.
const report: MemoryEvaluationReport = Object.freeze({
  reportId: "report-1",
  request,
  summary: { headline: "Eligible", detail: "Meets policy set 1." },
  evaluation,
  authorityUsed: authorities[0],
  policyApplied: policySet,
  decision: decisions[0],
  reviewer: { reviewerId: "reviewer-1", displayName: "Director" },
  producedAt: at,
});

assert.equal(Object.isFrozen(report), true);
// The four dimensions are distinct objects — separation is structural.
assert.notEqual(report.authorityUsed as unknown, report.decision as unknown);
assert.notEqual(report.policyApplied as unknown, report.evaluation as unknown);
assert.equal(report.decision.outcome, "approved");
assert.equal(report.authorityUsed.kind, "director");

console.log("Enterprise Memory Admission contract checks passed");
