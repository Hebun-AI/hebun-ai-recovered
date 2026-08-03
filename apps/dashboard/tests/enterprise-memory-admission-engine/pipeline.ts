import assert from "node:assert/strict";
import type { MemoryCandidate } from "../../src/features/enterprise-memory";
import type {
  AdmissionAuthority,
  AdmissionPolicy,
  MemoryEvaluation,
} from "../../src/features/enterprise-memory-admission";
import {
  PIPELINE_STAGES,
  createAdmissionEngine,
  runAdmissionPipeline,
} from "../../src/features/enterprise-memory-admission-engine";
import type { AdmissionEngineInput } from "../../src/features/enterprise-memory-admission-engine";

const at = "2026-08-03T11:00:00.000Z";

function candidate(overrides: Partial<MemoryCandidate> = {}): MemoryCandidate {
  return {
    identity: { memoryId: "memory-1", namespace: "enterprise-1" },
    content: { statement: "SLA is 99.9%.", attributes: { uptime: 99.9 } },
    source: { kind: "document", reference: "doc://1", originatedAt: at },
    authority: {
      authorityType: "director",
      admittedBy: { type: "director", id: "director-1" },
      grantReference: "grant://1",
      admittedAt: at,
    },
    provenance: { method: "explicit-admission", derivedFrom: [], recordedAt: at },
    confidence: { level: "high" },
    classification: { category: "vendor", sensitivity: "internal", tags: ["sla"] },
    lifecycle: { state: "candidate", enteredAt: at },
    relationships: [],
    ...overrides,
  };
}

const director: AdmissionAuthority = { kind: "director", authorityId: "auth-d", assertedAt: at };
const human: AdmissionAuthority = { kind: "human", authorityId: "auth-h", assertedAt: at, subjectId: "p-1" };

function evaluation(confidenceStanding: "unassessed" | "adequate" | "strong" = "strong"): MemoryEvaluation {
  return {
    assessedAt: at,
    dimensions: [
      { dimension: "confidence", standing: confidenceStanding, evidence: [{ evidenceId: "e1", describedBy: "doc" }] },
    ],
  };
}

function input(policies: readonly AdmissionPolicy[], overrides: Partial<AdmissionEngineInput> = {}): AdmissionEngineInput {
  return {
    candidate: candidate(),
    evaluation: evaluation(),
    authority: director,
    policySet: { policySetId: "policy-set-1", policies },
    reviewer: { reviewerId: "r-1", displayName: "Director" },
    evaluatedAt: at,
    ...overrides,
  };
}

const engine = createAdmissionEngine();

// Pipeline order is fixed and exposed.
assert.deepEqual(
  [...engine.stages],
  ["evaluation-assessment", "policy-evaluation", "authority-evaluation", "decision", "result-assembly"],
);
assert.deepEqual([...engine.stages], [...PIPELINE_STAGES]);

// Approved: all required policies satisfied, no review policy.
const approved = engine.admit(input([
  { kind: "required-authority", acceptedAuthorities: ["director"] },
  { kind: "required-confidence", minimumLevel: "high", minimumStanding: "adequate" },
  { kind: "required-classification", acceptedSensitivities: ["internal"] },
]));
assert.equal(approved.decision.outcome, "approved");

// Rejected by authority: claimed authority not accepted, never elevated.
const rejectedAuthority = engine.admit(input(
  [{ kind: "required-authority", acceptedAuthorities: ["director"] }],
  { authority: human },
));
assert.equal(rejectedAuthority.decision.outcome, "rejected");
assert.equal(rejectedAuthority.authorityCheck.accepted, false);

// Rejected by policy: confidence below the required level.
const rejectedPolicy = engine.admit(input([
  { kind: "required-confidence", minimumLevel: "verified", minimumStanding: "adequate" },
]));
assert.equal(rejectedPolicy.decision.outcome, "rejected");

// Deferred: a required dimension carries no assessment.
const deferred = engine.admit(input([
  { kind: "required-evidence", minimumCount: 1, dimensions: ["truth"] },
]));
assert.equal(deferred.decision.outcome, "deferred");
assert.deepEqual(
  deferred.decision.outcome === "deferred" ? deferred.decision.pendingOn : null,
  ["truth"],
);

// NeedsReview: everything required is satisfied but a review policy applies.
const needsReview = engine.admit(input([
  { kind: "required-authority", acceptedAuthorities: ["director"] },
  { kind: "review", reviewEveryDays: 90, requiredReviewerAuthority: "director" },
]));
assert.equal(needsReview.decision.outcome, "needs-review");

// Results are immutable.
assert.equal(Object.isFrozen(approved), true);
assert.equal(Object.isFrozen(approved.reasons), true);
assert.equal(Object.isFrozen(approved.policyChecks), true);

// Repeated execution is consistent — same input, identical result.
const firstRun = runAdmissionPipeline(input([{ kind: "required-authority", acceptedAuthorities: ["director"] }]));
const secondRun = runAdmissionPipeline(input([{ kind: "required-authority", acceptedAuthorities: ["director"] }]));
assert.deepEqual(firstRun, secondRun);

// Policy checks preserve policy order.
const ordered = engine.admit(input([
  { kind: "required-authority", acceptedAuthorities: ["director"] },
  { kind: "expiration", validForDays: 365 },
]));
assert.deepEqual(ordered.policyChecks.map((check) => check.policy.kind), ["required-authority", "expiration"]);

console.log("Enterprise Memory Admission Engine pipeline checks passed");
