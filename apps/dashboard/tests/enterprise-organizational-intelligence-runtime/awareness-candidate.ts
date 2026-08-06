import assert from "node:assert/strict";
import {
  AWARENESS_CANDIDATE_CAPABILITIES,
  AWARENESS_CANDIDATE_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  awarenessRequiresBasis,
  canonicalAwarenessCandidateSetKey,
  groundsInDeclaredOptimization,
  identifyAwarenessCandidates,
  normalizeAwarenessCandidateSet,
  optimizationSupportIndex,
  prepareAwarenessCandidates,
  prepareLearningCandidates,
  prepareOptimizationCandidates,
  resolveSupportingOptimization,
  validateAwarenessCandidateRequest,
  validateAwarenessCandidateSet,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  AwarenessCandidateRequest,
  AwarenessCandidateSeed,
  CanonicalLearningCandidateSet,
  CanonicalOptimizationCandidateSet,
  CanonicalRuntimeBundle,
  LearningCandidate,
  LearningCandidateSeed,
  LearningEvidence,
  OptimizationCandidate,
  OptimizationCandidateSeed,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

// --- Fixtures ----------------------------------------------------------------

function baseContext(): RuntimeContext {
  return {
    purpose: "identify attributable awareness signal candidates over learning, optimization and evidence",
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
    { evidenceId: "ev-1", source: "memory", statement: "cycle time fell in Q2", effectivePeriod: "2026-06-30T00:00:00.000Z", eligible: true },
    { evidenceId: "ev-2", source: "reasoning", statement: "batching is the common factor", effectivePeriod: "2026-07-15T00:00:00.000Z", eligible: true },
    { evidenceId: "ev-3", source: "memory", statement: "classified vendor note", effectivePeriod: "2026-07-20T00:00:00.000Z", eligible: false },
  ];
}

function learningSeed(): LearningCandidateSeed {
  return {
    candidateId: "lc-1",
    statement: "batching reduces cycle time",
    evidenceRefs: ["ev-1", "ev-2"],
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "learning-candidate-runtime",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle: "qualified",
    },
    explainability: { basis: ["ev-1 and ev-2 co-occur"], assumptions: [], limitations: [], uncertainty: ["correlational"] },
    confidence: { level: "moderate", uncertainty: ["correlational"] },
    supersedes: null,
  };
}

function baseLearningSet(): CanonicalLearningCandidateSet {
  const prepared = prepareLearningCandidates({
    request: { requestId: "lreq-1", bundle: baseBundle(), evidence: baseEvidence(), seeds: [learningSeed()] },
  });
  if (!prepared.ok) throw new Error("fixture learning set failed to prepare");
  return prepared.value;
}

function optimizationSeed(): OptimizationCandidateSeed {
  return {
    candidateId: "oc-1",
    statement: "adopt batching in the fulfilment line",
    learningRefs: ["lc-1"],
    evidenceRefs: ["ev-1"],
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "optimization-candidate-runtime",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle: "qualified",
    },
    explainability: {
      basis: ["derived from learning lc-1 and evidence ev-1"],
      assumptions: [],
      limitations: ["single line observed"],
      uncertainty: ["effect size unbounded"],
    },
    confidence: { level: "moderate", uncertainty: ["effect size unbounded"] },
    supersedes: null,
  };
}

function baseOptimizationSet(): CanonicalOptimizationCandidateSet {
  const prepared = prepareOptimizationCandidates({
    request: {
      requestId: "oreq-1",
      bundle: baseBundle(),
      learningSet: baseLearningSet(),
      evidence: baseEvidence(),
      seeds: [optimizationSeed()],
    },
  });
  if (!prepared.ok) throw new Error("fixture optimization set failed to prepare");
  return prepared.value;
}

function awarenessSeed(overrides: Partial<AwarenessCandidateSeed> = {}): AwarenessCandidateSeed {
  return {
    candidateId: "ac-1",
    statement: "operational drift toward batching across the fulfilment domain",
    learningRefs: ["lc-1"],
    optimizationRefs: ["oc-1"],
    evidenceRefs: ["ev-1"],
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "awareness-candidate-runtime",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle: "qualified",
    },
    explainability: {
      basis: ["signal grounded in learning lc-1, optimization oc-1 and evidence ev-1"],
      assumptions: [],
      limitations: ["single domain observed"],
      uncertainty: ["directional only"],
    },
    confidence: { level: "moderate", uncertainty: ["directional only"] },
    supersedes: null,
    ...overrides,
  };
}

function baseRequest(overrides: Partial<AwarenessCandidateRequest> = {}): AwarenessCandidateRequest {
  return {
    requestId: "acreq-1",
    bundle: baseBundle(),
    learningSet: baseLearningSet(),
    optimizationSet: baseOptimizationSet(),
    evidence: baseEvidence(),
    seeds: [awarenessSeed()],
    ...overrides,
  };
}

// --- Boundary sets are frozen and disjoint -----------------------------------

assert.equal(Object.isFrozen(AWARENESS_CANDIDATE_CAPABILITIES), true);
assert.equal(Object.isFrozen(AWARENESS_CANDIDATE_NON_RESPONSIBILITIES), true);
for (const forbidden of [
  "assess",
  "monitor",
  "score",
  "recommend",
  "alert",
  "prioritize",
  "plan-work",
  "execute-work",
  "run-workflow",
  "call-ai",
  "call-llm",
  "persist",
  "invoke-api",
  "modify-memory",
  "modify-reasoning",
  "modify-organization",
  "modify-optimization",
  "change-learning",
  "approve",
  "decide",
  "execute",
  "bypass-director",
] as const) {
  assert.equal(AWARENESS_CANDIDATE_NON_RESPONSIBILITIES.includes(forbidden), true, `missing prohibition: ${forbidden}`);
}
{
  const forbiddenSet = new Set<string>(AWARENESS_CANDIDATE_NON_RESPONSIBILITIES);
  for (const capability of AWARENESS_CANDIDATE_CAPABILITIES) {
    assert.equal(forbiddenSet.has(capability), false);
  }
}

// --- Awareness requires a basis ----------------------------------------------

assert.equal(awarenessRequiresBasis(), true);

// --- Optimization-support index and grounding --------------------------------

{
  const index = optimizationSupportIndex(baseOptimizationSet());
  assert.equal(index.has("oc-1"), true);
  assert.equal(groundsInDeclaredOptimization(["oc-1"], index), true);
  assert.equal(groundsInDeclaredOptimization(["oc-404"], index), false);
  assert.equal(groundsInDeclaredOptimization([], index), false);
  assert.deepEqual(
    resolveSupportingOptimization({ optimizationRefs: ["oc-1"] }, index).map((c: OptimizationCandidate) => c.candidateId),
    ["oc-1"],
  );
}

// --- Identification is deterministic and fixes the awareness-signal kind ------

{
  const candidates = identifyAwarenessCandidates(baseRequest());
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].candidateKind, "awareness-signal");
  assert.equal(candidates[0].statement, "operational drift toward batching across the fulfilment domain");
}

// --- Validation: a well-formed request passes --------------------------------

assert.deepEqual(validateAwarenessCandidateRequest(baseRequest()), { ok: true });

// --- Validation: fail-closed cases -------------------------------------------

for (const [name, mutate] of [
  ["empty requestId", (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, requestId: "" })],
  [
    "learning absent from qualified set",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ learningRefs: ["lc-404"] })] }),
  ],
  [
    "empty supporting learning",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ learningRefs: [] })] }),
  ],
  [
    "optimization absent from qualified set",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ optimizationRefs: ["oc-404"] })] }),
  ],
  [
    "empty supporting optimization",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ optimizationRefs: [] })] }),
  ],
  [
    "missing evidence",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ evidenceRefs: ["ev-404"] })] }),
  ],
  [
    "ineligible evidence",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ evidenceRefs: ["ev-3"] })] }),
  ],
  [
    "empty supporting evidence",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ evidenceRefs: [] })] }),
  ],
  [
    "empty explanation basis",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({
      ...r,
      seeds: [awarenessSeed({ explainability: { basis: [], assumptions: [], limitations: [], uncertainty: [] } })],
    }),
  ],
  [
    "terminal lifecycle",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({
      ...r,
      seeds: [awarenessSeed({ provenance: { ...awarenessSeed().provenance, lifecycle: "closed" } })],
    }),
  ],
  [
    "briefed lifecycle reserved for later phase",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({
      ...r,
      seeds: [awarenessSeed({ provenance: { ...awarenessSeed().provenance, lifecycle: "briefed" } })],
    }),
  ],
  [
    "non-positive provenance version",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({
      ...r,
      seeds: [awarenessSeed({ provenance: { ...awarenessSeed().provenance, version: 0 } })],
    }),
  ],
  [
    "duplicate candidate id",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed(), awarenessSeed()] }),
  ],
  [
    "self supersession",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({ ...r, seeds: [awarenessSeed({ supersedes: "ac-1" })] }),
  ],
  [
    "duplicate evidence id in pool",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => ({
      ...r,
      evidence: [...baseEvidence(), { evidenceId: "ev-1", source: "x", statement: "y", effectivePeriod: "2026-06-30T00:00:00.000Z", eligible: true }],
    }),
  ],
  [
    "ill-formed supporting optimization set",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => {
      const brokenOptimization: OptimizationCandidate = {
        candidateId: "oc-9",
        candidateKind: "optimization",
        statement: "ungrounded",
        learningRefs: [],
        evidenceRefs: [],
        provenance: optimizationSeed().provenance,
        explainability: optimizationSeed().explainability,
        confidence: optimizationSeed().confidence,
        supersedes: null,
      };
      const brokenSet: CanonicalOptimizationCandidateSet = {
        requestId: "oreq-broken",
        candidates: [brokenOptimization],
        approval: { state: "pending-director" },
      };
      return { ...r, optimizationSet: brokenSet, seeds: [awarenessSeed({ optimizationRefs: ["oc-9"] })] };
    },
  ],
  [
    "ill-formed supporting learning set",
    (r: AwarenessCandidateRequest): AwarenessCandidateRequest => {
      const brokenLearning: LearningCandidate = {
        candidateId: "lc-9",
        candidateKind: "learning",
        statement: "ungrounded",
        evidenceRefs: [],
        provenance: learningSeed().provenance,
        explainability: learningSeed().explainability,
        confidence: learningSeed().confidence,
        supersedes: null,
      };
      const brokenSet: CanonicalLearningCandidateSet = {
        requestId: "lreq-broken",
        candidates: [brokenLearning],
        approval: { state: "pending-director" },
      };
      return { ...r, learningSet: brokenSet, seeds: [awarenessSeed({ learningRefs: ["lc-9"] })] };
    },
  ],
] as const) {
  const result = validateAwarenessCandidateRequest(mutate(baseRequest()));
  assert.equal(result.ok, false, `expected failure: ${name}`);
}

// --- Preparation: validate, identify, preserve, freeze -----------------------

{
  const result = prepareAwarenessCandidates({ request: baseRequest() });
  assert.equal(result.ok, true);
  if (result.ok) {
    const set = result.value;
    assert.equal(set.requestId, "acreq-1");
    assert.equal(set.approval.state, "pending-director");
    assert.equal(set.candidates.length, 1);
    const candidate = set.candidates[0];
    assert.equal(candidate.candidateKind, "awareness-signal");
    // Supporting references preserved.
    assert.deepEqual(candidate.learningRefs, ["lc-1"]);
    assert.deepEqual(candidate.optimizationRefs, ["oc-1"]);
    assert.deepEqual(candidate.evidenceRefs, ["ev-1"]);
    // Provenance / explainability / confidence / uncertainty preserved unchanged.
    assert.equal(candidate.provenance.attribution, "awareness-candidate-runtime");
    assert.deepEqual(candidate.explainability.limitations, ["single domain observed"]);
    assert.deepEqual(candidate.confidence.uncertainty, ["directional only"]);
    // Frozen throughout.
    assert.equal(Object.isFrozen(set), true);
    assert.equal(Object.isFrozen(set.candidates), true);
    assert.equal(Object.isFrozen(set.candidates[0]), true);
    assert.deepEqual(validateAwarenessCandidateSet(set), { ok: true });
  }
}

// --- Preparation fails closed on ineligible evidence -------------------------

{
  const bad = prepareAwarenessCandidates({ request: baseRequest({ seeds: [awarenessSeed({ evidenceRefs: ["ev-3"] })] }) });
  assert.equal(bad.ok, false);
}

// --- Determinism: order and canonical key are input-order-invariant ----------

{
  const a = awarenessSeed({ candidateId: "ac-a", optimizationRefs: ["oc-1"], evidenceRefs: ["ev-2", "ev-1", "ev-2"] });
  const b = awarenessSeed({ candidateId: "ac-b" });
  const forward = prepareAwarenessCandidates({ request: baseRequest({ seeds: [a, b] }) });
  const reverse = prepareAwarenessCandidates({ request: baseRequest({ seeds: [b, a] }) });
  assert.equal(forward.ok && reverse.ok, true);
  if (forward.ok && reverse.ok) {
    assert.deepEqual(forward.value.candidates.map((c) => c.candidateId), ["ac-a", "ac-b"]);
    assert.deepEqual(reverse.value.candidates.map((c) => c.candidateId), ["ac-a", "ac-b"]);
    // Duplicate evidence refs de-duplicated and ordered.
    assert.deepEqual(forward.value.candidates[0].evidenceRefs, ["ev-1", "ev-2"]);
    assert.equal(
      canonicalAwarenessCandidateSetKey(forward.value),
      canonicalAwarenessCandidateSetKey(reverse.value),
    );
  }
}

// --- Normalization is deterministic and idempotent ---------------------------

{
  const prepared = prepareAwarenessCandidates({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const once = normalizeAwarenessCandidateSet(prepared.value);
    const twice = normalizeAwarenessCandidateSet(once);
    assert.deepEqual(once, twice);
    assert.equal(canonicalAwarenessCandidateSetKey(once), canonicalAwarenessCandidateSetKey(twice));
  }
}

// --- Supersession preserves history ------------------------------------------

{
  const result = prepareAwarenessCandidates({
    request: baseRequest({ seeds: [awarenessSeed({ candidateId: "ac-2", supersedes: "ac-1" })] }),
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.candidates[0].supersedes, "ac-1");
}

// --- UTF-8 / JSON stability of the canonical key -----------------------------

{
  const prepared = prepareAwarenessCandidates({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const key = canonicalAwarenessCandidateSetKey(prepared.value);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
}

console.log("enterprise-organizational-intelligence-runtime: all awareness candidate Phase 5 checks passed");
