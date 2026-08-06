import assert from "node:assert/strict";
import {
  OPTIMIZATION_CANDIDATE_CAPABILITIES,
  OPTIMIZATION_CANDIDATE_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  canonicalOptimizationCandidateSetKey,
  groundsInDeclaredLearning,
  identifyOptimizationCandidates,
  learningSupportIndex,
  normalizeOptimizationCandidateSet,
  optimizationRequiresBasis,
  prepareLearningCandidates,
  prepareOptimizationCandidates,
  resolveSupportingLearning,
  validateOptimizationCandidateRequest,
  validateOptimizationCandidateSet,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  CanonicalLearningCandidateSet,
  CanonicalRuntimeBundle,
  LearningCandidate,
  LearningCandidateSeed,
  LearningEvidence,
  OptimizationCandidateRequest,
  OptimizationCandidateSeed,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

// --- Fixtures ----------------------------------------------------------------

function baseContext(): RuntimeContext {
  return {
    purpose: "identify attributable optimization candidates over learning and evidence",
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

function optimizationSeed(overrides: Partial<OptimizationCandidateSeed> = {}): OptimizationCandidateSeed {
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
    ...overrides,
  };
}

function baseRequest(overrides: Partial<OptimizationCandidateRequest> = {}): OptimizationCandidateRequest {
  return {
    requestId: "oreq-1",
    bundle: baseBundle(),
    learningSet: baseLearningSet(),
    evidence: baseEvidence(),
    seeds: [optimizationSeed()],
    ...overrides,
  };
}

// --- Boundary sets are frozen and disjoint -----------------------------------

assert.equal(Object.isFrozen(OPTIMIZATION_CANDIDATE_CAPABILITIES), true);
assert.equal(Object.isFrozen(OPTIMIZATION_CANDIDATE_NON_RESPONSIBILITIES), true);
for (const forbidden of [
  "decide",
  "prioritize",
  "plan",
  "orchestrate-workflow",
  "reorganize",
  "reassign-work",
  "execute",
  "call-ai",
  "call-llm",
  "modify-memory",
  "admit-knowledge",
  "modify-organization",
  "run-optimization-engine",
  "run-prioritization-algorithm",
  "persist",
  "invoke-api",
  "control-ui",
  "bypass-director",
] as const) {
  assert.equal(OPTIMIZATION_CANDIDATE_NON_RESPONSIBILITIES.includes(forbidden), true);
}
{
  const forbiddenSet = new Set<string>(OPTIMIZATION_CANDIDATE_NON_RESPONSIBILITIES);
  for (const capability of OPTIMIZATION_CANDIDATE_CAPABILITIES) {
    assert.equal(forbiddenSet.has(capability), false);
  }
}

// --- Optimization requires a basis -------------------------------------------

assert.equal(optimizationRequiresBasis(), true);

// --- Learning-support index and grounding ------------------------------------

{
  const index = learningSupportIndex(baseLearningSet());
  assert.equal(index.has("lc-1"), true);
  assert.equal(groundsInDeclaredLearning(["lc-1"], index), true);
  assert.equal(groundsInDeclaredLearning(["lc-404"], index), false);
  assert.equal(groundsInDeclaredLearning([], index), false);
  assert.deepEqual(
    resolveSupportingLearning({ learningRefs: ["lc-1"] }, index).map((c: LearningCandidate) => c.candidateId),
    ["lc-1"],
  );
}

// --- Identification is deterministic and fixes the optimization kind ---------

{
  const candidates = identifyOptimizationCandidates(baseRequest());
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].candidateKind, "optimization");
  assert.equal(candidates[0].statement, "adopt batching in the fulfilment line");
}

// --- Validation: a well-formed request passes --------------------------------

assert.deepEqual(validateOptimizationCandidateRequest(baseRequest()), { ok: true });

// --- Validation: fail-closed cases -------------------------------------------

for (const [name, mutate] of [
  ["empty requestId", (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, requestId: "" })],
  [
    "learning absent from qualified set",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, seeds: [optimizationSeed({ learningRefs: ["lc-404"] })] }),
  ],
  [
    "empty supporting learning",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, seeds: [optimizationSeed({ learningRefs: [] })] }),
  ],
  [
    "missing evidence",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, seeds: [optimizationSeed({ evidenceRefs: ["ev-404"] })] }),
  ],
  [
    "ineligible evidence",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, seeds: [optimizationSeed({ evidenceRefs: ["ev-3"] })] }),
  ],
  [
    "empty supporting evidence",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, seeds: [optimizationSeed({ evidenceRefs: [] })] }),
  ],
  [
    "empty explanation basis",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({
      ...r,
      seeds: [optimizationSeed({ explainability: { basis: [], assumptions: [], limitations: [], uncertainty: [] } })],
    }),
  ],
  [
    "terminal lifecycle",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({
      ...r,
      seeds: [optimizationSeed({ provenance: { ...optimizationSeed().provenance, lifecycle: "closed" } })],
    }),
  ],
  [
    "briefed lifecycle reserved for later phase",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({
      ...r,
      seeds: [optimizationSeed({ provenance: { ...optimizationSeed().provenance, lifecycle: "briefed" } })],
    }),
  ],
  [
    "non-positive provenance version",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({
      ...r,
      seeds: [optimizationSeed({ provenance: { ...optimizationSeed().provenance, version: 0 } })],
    }),
  ],
  [
    "duplicate candidate id",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, seeds: [optimizationSeed(), optimizationSeed()] }),
  ],
  [
    "self supersession",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({ ...r, seeds: [optimizationSeed({ supersedes: "oc-1" })] }),
  ],
  [
    "duplicate evidence id in pool",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => ({
      ...r,
      evidence: [...baseEvidence(), { evidenceId: "ev-1", source: "x", statement: "y", effectivePeriod: "2026-06-30T00:00:00.000Z", eligible: true }],
    }),
  ],
  [
    "ill-formed supporting learning set",
    (r: OptimizationCandidateRequest): OptimizationCandidateRequest => {
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
      return { ...r, learningSet: brokenSet, seeds: [optimizationSeed({ learningRefs: ["lc-9"] })] };
    },
  ],
] as const) {
  const result = validateOptimizationCandidateRequest(mutate(baseRequest()));
  assert.equal(result.ok, false, `expected failure: ${name}`);
}

// --- Preparation: validate, identify, preserve, freeze -----------------------

{
  const result = prepareOptimizationCandidates({ request: baseRequest() });
  assert.equal(result.ok, true);
  if (result.ok) {
    const set = result.value;
    assert.equal(set.requestId, "oreq-1");
    assert.equal(set.approval.state, "pending-director");
    assert.equal(set.candidates.length, 1);
    const candidate = set.candidates[0];
    assert.equal(candidate.candidateKind, "optimization");
    // Supporting references preserved.
    assert.deepEqual(candidate.learningRefs, ["lc-1"]);
    assert.deepEqual(candidate.evidenceRefs, ["ev-1"]);
    // Provenance / explainability / confidence / uncertainty preserved unchanged.
    assert.equal(candidate.provenance.attribution, "optimization-candidate-runtime");
    assert.deepEqual(candidate.explainability.limitations, ["single line observed"]);
    assert.deepEqual(candidate.confidence.uncertainty, ["effect size unbounded"]);
    // Frozen throughout.
    assert.equal(Object.isFrozen(set), true);
    assert.equal(Object.isFrozen(set.candidates), true);
    assert.equal(Object.isFrozen(set.candidates[0]), true);
    assert.deepEqual(validateOptimizationCandidateSet(set), { ok: true });
  }
}

// --- Preparation fails closed on ineligible evidence -------------------------

{
  const bad = prepareOptimizationCandidates({ request: baseRequest({ seeds: [optimizationSeed({ evidenceRefs: ["ev-3"] })] }) });
  assert.equal(bad.ok, false);
}

// --- Determinism: order and canonical key are input-order-invariant ----------

{
  const a = optimizationSeed({ candidateId: "oc-a", learningRefs: ["lc-1"], evidenceRefs: ["ev-2", "ev-1", "ev-2"] });
  const b = optimizationSeed({ candidateId: "oc-b" });
  const forward = prepareOptimizationCandidates({ request: baseRequest({ seeds: [a, b] }) });
  const reverse = prepareOptimizationCandidates({ request: baseRequest({ seeds: [b, a] }) });
  assert.equal(forward.ok && reverse.ok, true);
  if (forward.ok && reverse.ok) {
    assert.deepEqual(forward.value.candidates.map((c) => c.candidateId), ["oc-a", "oc-b"]);
    assert.deepEqual(reverse.value.candidates.map((c) => c.candidateId), ["oc-a", "oc-b"]);
    // Duplicate evidence refs de-duplicated and ordered.
    assert.deepEqual(forward.value.candidates[0].evidenceRefs, ["ev-1", "ev-2"]);
    assert.equal(
      canonicalOptimizationCandidateSetKey(forward.value),
      canonicalOptimizationCandidateSetKey(reverse.value),
    );
  }
}

// --- Normalization is deterministic and idempotent ---------------------------

{
  const prepared = prepareOptimizationCandidates({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const once = normalizeOptimizationCandidateSet(prepared.value);
    const twice = normalizeOptimizationCandidateSet(once);
    assert.deepEqual(once, twice);
    assert.equal(canonicalOptimizationCandidateSetKey(once), canonicalOptimizationCandidateSetKey(twice));
  }
}

// --- Supersession preserves history ------------------------------------------

{
  const result = prepareOptimizationCandidates({
    request: baseRequest({ seeds: [optimizationSeed({ candidateId: "oc-2", supersedes: "oc-1" })] }),
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.candidates[0].supersedes, "oc-1");
}

// --- UTF-8 / JSON stability of the canonical key -----------------------------

{
  const prepared = prepareOptimizationCandidates({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const key = canonicalOptimizationCandidateSetKey(prepared.value);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
}

console.log("enterprise-organizational-intelligence-runtime: all optimization candidate Phase 4 checks passed");
