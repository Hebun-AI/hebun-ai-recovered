import assert from "node:assert/strict";
import {
  LEARNING_CANDIDATE_CAPABILITIES,
  LEARNING_CANDIDATE_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  canonicalLearningCandidateSetKey,
  groundsInEligibleEvidence,
  identifyLearningCandidates,
  learningEvidenceIndex,
  learningRequiresBasis,
  normalizeLearningCandidateSet,
  prepareLearningCandidates,
  resolveCandidateEvidence,
  validateLearningCandidateRequest,
  validateLearningCandidateSet,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  CanonicalRuntimeBundle,
  LearningCandidateRequest,
  LearningCandidateSeed,
  LearningEvidence,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

// --- Fixtures ----------------------------------------------------------------

function baseContext(): RuntimeContext {
  return {
    purpose: "identify attributable learning candidates over the assembled context",
    scope: { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] },
    organizationId: "org-1",
    tenantId: "tenant-1",
    authorityBasis: "director-governed",
    dependencies: [
      { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
      { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
      { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
    ],
  };
}

function baseBundle(): CanonicalRuntimeBundle {
  const assembled = assembleRuntimeBundle({
    request: { requestId: "areq-1", context: baseContext() },
    bundleId: "bundle-1",
  });
  if (!assembled.ok) throw new Error("fixture bundle failed to assemble");
  return assembled.value;
}

function baseEvidence(): LearningEvidence[] {
  return [
    { evidenceId: "ev-1", source: "memory", statement: "throughput rose in Q2", effectivePeriod: "2026-06-30T00:00:00.000Z", eligible: true },
    { evidenceId: "ev-2", source: "reasoning", statement: "process B is the common factor", effectivePeriod: "2026-07-15T00:00:00.000Z", eligible: true },
    { evidenceId: "ev-3", source: "memory", statement: "classified staffing note", effectivePeriod: "2026-07-20T00:00:00.000Z", eligible: false },
  ];
}

function seed(overrides: Partial<LearningCandidateSeed> = {}): LearningCandidateSeed {
  return {
    candidateId: "lc-1",
    statement: "process B improves throughput",
    evidenceRefs: ["ev-1", "ev-2"],
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "learning-candidate-runtime",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle: "qualified",
    },
    explainability: {
      basis: ["ev-1 and ev-2 co-occur with the throughput rise"],
      assumptions: [],
      limitations: ["single period observed"],
      uncertainty: ["correlation, not established cause"],
    },
    confidence: { level: "moderate", uncertainty: ["correlation, not established cause"] },
    supersedes: null,
    ...overrides,
  };
}

function baseRequest(overrides: Partial<LearningCandidateRequest> = {}): LearningCandidateRequest {
  return {
    requestId: "lreq-1",
    bundle: baseBundle(),
    evidence: baseEvidence(),
    seeds: [seed()],
    ...overrides,
  };
}

// --- Boundary sets are frozen and disjoint -----------------------------------

assert.equal(Object.isFrozen(LEARNING_CANDIDATE_CAPABILITIES), true);
assert.equal(Object.isFrozen(LEARNING_CANDIDATE_NON_RESPONSIBILITIES), true);
for (const forbidden of [
  "modify-memory",
  "admit-knowledge",
  "create-fact",
  "decide",
  "approve-candidate",
  "execute-workflow",
  "call-ai",
  "call-llm",
  "orchestrate",
  "plan-work",
  "execute-action",
  "modify-organization",
  "bypass-director",
] as const) {
  assert.equal(LEARNING_CANDIDATE_NON_RESPONSIBILITIES.includes(forbidden), true);
}
{
  const forbiddenSet = new Set<string>(LEARNING_CANDIDATE_NON_RESPONSIBILITIES);
  for (const capability of LEARNING_CANDIDATE_CAPABILITIES) {
    assert.equal(forbiddenSet.has(capability), false);
  }
}

// --- Learning requires an evidence basis -------------------------------------

assert.equal(learningRequiresBasis(), true);

// --- Evidence index and eligibility ------------------------------------------

{
  const index = learningEvidenceIndex(baseEvidence());
  assert.equal(index.size, 3);
  assert.equal(groundsInEligibleEvidence(["ev-1", "ev-2"], index), true);
  // Missing reference fails closed.
  assert.equal(groundsInEligibleEvidence(["ev-1", "ev-404"], index), false);
  // Ineligible reference fails closed.
  assert.equal(groundsInEligibleEvidence(["ev-1", "ev-3"], index), false);
  // Empty basis fails closed.
  assert.equal(groundsInEligibleEvidence([], index), false);
  // Resolution is a read-only projection in declared order.
  assert.deepEqual(
    resolveCandidateEvidence({ evidenceRefs: ["ev-2", "ev-1"] }, index).map((item) => item.evidenceId),
    ["ev-2", "ev-1"],
  );
}

// --- Identification is deterministic and fixes the learning kind -------------

{
  const candidates = identifyLearningCandidates(baseRequest());
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].candidateKind, "learning");
  assert.equal(candidates[0].statement, "process B improves throughput");
}

// --- Validation: a well-formed request passes --------------------------------

assert.deepEqual(validateLearningCandidateRequest(baseRequest()), { ok: true });

// --- Validation: fail-closed cases -------------------------------------------

for (const [name, mutate] of [
  ["empty requestId", (r: LearningCandidateRequest): LearningCandidateRequest => ({ ...r, requestId: "" })],
  [
    "ungrounded (missing) evidence",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({ ...r, seeds: [seed({ evidenceRefs: ["ev-404"] })] }),
  ],
  [
    "ineligible evidence",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({ ...r, seeds: [seed({ evidenceRefs: ["ev-3"] })] }),
  ],
  [
    "empty evidence basis",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({ ...r, seeds: [seed({ evidenceRefs: [] })] }),
  ],
  [
    "empty explanation basis",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({
      ...r,
      seeds: [seed({ explainability: { basis: [], assumptions: [], limitations: [], uncertainty: [] } })],
    }),
  ],
  [
    "terminal lifecycle",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({
      ...r,
      seeds: [seed({ provenance: { ...seed().provenance, lifecycle: "closed" } })],
    }),
  ],
  [
    "briefed lifecycle reserved for later phase",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({
      ...r,
      seeds: [seed({ provenance: { ...seed().provenance, lifecycle: "briefed" } })],
    }),
  ],
  [
    "non-positive provenance version",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({
      ...r,
      seeds: [seed({ provenance: { ...seed().provenance, version: 0 } })],
    }),
  ],
  [
    "duplicate candidate id",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({ ...r, seeds: [seed(), seed()] }),
  ],
  [
    "self supersession",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({ ...r, seeds: [seed({ supersedes: "lc-1" })] }),
  ],
  [
    "duplicate evidence id in pool",
    (r: LearningCandidateRequest): LearningCandidateRequest => ({
      ...r,
      evidence: [...baseEvidence(), { evidenceId: "ev-1", source: "x", statement: "y", effectivePeriod: "2026-06-30T00:00:00.000Z", eligible: true }],
    }),
  ],
] as const) {
  const result = validateLearningCandidateRequest(mutate(baseRequest()));
  assert.equal(result.ok, false, `expected failure: ${name}`);
}

// --- Preparation: validate, identify, preserve, freeze -----------------------

{
  const result = prepareLearningCandidates({ request: baseRequest() });
  assert.equal(result.ok, true);
  if (result.ok) {
    const set = result.value;
    assert.equal(set.requestId, "lreq-1");
    assert.equal(set.approval.state, "pending-director");
    assert.equal(set.candidates.length, 1);
    // Provenance / explainability / confidence preserved unchanged.
    const candidate = set.candidates[0];
    assert.equal(candidate.provenance.attribution, "learning-candidate-runtime");
    assert.deepEqual(candidate.explainability.limitations, ["single period observed"]);
    assert.deepEqual(candidate.confidence.uncertainty, ["correlation, not established cause"]);
    // Evidence refs de-duplicated and totally ordered.
    assert.deepEqual(candidate.evidenceRefs, ["ev-1", "ev-2"]);
    // Frozen throughout.
    assert.equal(Object.isFrozen(set), true);
    assert.equal(Object.isFrozen(set.candidates), true);
    assert.equal(Object.isFrozen(set.candidates[0]), true);
    // A prepared set passes set validation.
    assert.deepEqual(validateLearningCandidateSet(set), { ok: true });
  }
}

// --- Preparation fails closed on ineligible evidence -------------------------

{
  const bad = prepareLearningCandidates({ request: baseRequest({ seeds: [seed({ evidenceRefs: ["ev-3"] })] }) });
  assert.equal(bad.ok, false);
}

// --- Determinism: candidate order and canonical key are input-order-invariant -

{
  const a = seed({ candidateId: "lc-a", evidenceRefs: ["ev-2", "ev-1", "ev-2"] });
  const b = seed({ candidateId: "lc-b" });
  const forward = prepareLearningCandidates({ request: baseRequest({ seeds: [a, b] }) });
  const reverse = prepareLearningCandidates({ request: baseRequest({ seeds: [b, a] }) });
  assert.equal(forward.ok && reverse.ok, true);
  if (forward.ok && reverse.ok) {
    // Candidates ordered by identity regardless of input order.
    assert.deepEqual(forward.value.candidates.map((c) => c.candidateId), ["lc-a", "lc-b"]);
    assert.deepEqual(reverse.value.candidates.map((c) => c.candidateId), ["lc-a", "lc-b"]);
    // Duplicate evidence refs de-duplicated and ordered.
    assert.deepEqual(forward.value.candidates[0].evidenceRefs, ["ev-1", "ev-2"]);
    // Same canonical key regardless of input order.
    assert.equal(
      canonicalLearningCandidateSetKey(forward.value),
      canonicalLearningCandidateSetKey(reverse.value),
    );
  }
}

// --- Normalization is deterministic and idempotent ---------------------------

{
  const prepared = prepareLearningCandidates({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const once = normalizeLearningCandidateSet(prepared.value);
    const twice = normalizeLearningCandidateSet(once);
    assert.deepEqual(once, twice);
    assert.equal(canonicalLearningCandidateSetKey(once), canonicalLearningCandidateSetKey(twice));
  }
}

// --- Supersession preserves history ------------------------------------------

{
  const result = prepareLearningCandidates({
    request: baseRequest({ seeds: [seed({ candidateId: "lc-2", supersedes: "lc-1" })] }),
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.candidates[0].supersedes, "lc-1");
}

// --- UTF-8 / JSON stability of the canonical key -----------------------------

{
  const prepared = prepareLearningCandidates({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const key = canonicalLearningCandidateSetKey(prepared.value);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
}

console.log("enterprise-organizational-intelligence-runtime: all learning candidate Phase 3 checks passed");
