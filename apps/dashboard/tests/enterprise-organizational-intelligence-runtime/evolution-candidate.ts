import assert from "node:assert/strict";
import {
  EVOLUTION_CANDIDATE_CAPABILITIES,
  EVOLUTION_CANDIDATE_KINDS,
  EVOLUTION_CANDIDATE_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  awarenessSupportIndex,
  canonicalEvolutionCandidateSetKey,
  evolutionRequiresBasis,
  groundsInDeclaredAwareness,
  identifyEvolutionCandidates,
  isEvolutionCandidateKind,
  normalizeEvolutionCandidateSet,
  prepareAwarenessCandidates,
  prepareEvolutionCandidates,
  prepareLearningCandidates,
  prepareOptimizationCandidates,
  resolveSupportingAwareness,
  validateEvolutionCandidateRequest,
  validateEvolutionCandidateSet,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  AwarenessCandidate,
  CanonicalAwarenessCandidateSet,
  CanonicalLearningCandidateSet,
  CanonicalOptimizationCandidateSet,
  CanonicalRuntimeBundle,
  EvolutionCandidateRequest,
  EvolutionCandidateSeed,
  LearningCandidate,
  LearningCandidateSeed,
  LearningEvidence,
  OptimizationCandidateSeed,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

// --- Fixtures ----------------------------------------------------------------

function baseContext(): RuntimeContext {
  return {
    purpose: "identify attributable evolution candidates over learning, optimization, awareness and evidence",
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

function baseAwarenessSet(): CanonicalAwarenessCandidateSet {
  const prepared = prepareAwarenessCandidates({
    request: {
      requestId: "acreq-1",
      bundle: baseBundle(),
      learningSet: baseLearningSet(),
      optimizationSet: baseOptimizationSet(),
      evidence: baseEvidence(),
      seeds: [
        {
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
        },
      ],
    },
  });
  if (!prepared.ok) throw new Error("fixture awareness set failed to prepare");
  return prepared.value;
}

function evolutionSeed(overrides: Partial<EvolutionCandidateSeed> = {}): EvolutionCandidateSeed {
  return {
    candidateId: "ec-1",
    candidateKind: "evolution-readiness",
    statement: "the fulfilment domain shows readiness signals for a batching-oriented evolution",
    learningRefs: ["lc-1"],
    optimizationRefs: ["oc-1"],
    awarenessRefs: ["ac-1"],
    evidenceRefs: ["ev-1"],
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "evolution-candidate-runtime",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle: "qualified",
    },
    explainability: {
      basis: ["grounded in learning lc-1, optimization oc-1, awareness ac-1 and evidence ev-1"],
      assumptions: [],
      limitations: ["single domain observed"],
      uncertainty: ["non-authoritative, continuity not guaranteed"],
    },
    confidence: { level: "moderate", uncertainty: ["non-authoritative, continuity not guaranteed"] },
    supersedes: null,
    ...overrides,
  };
}

function pathwaySeed(): EvolutionCandidateSeed {
  return evolutionSeed({
    candidateId: "ec-2",
    candidateKind: "evolution-pathway",
    statement: "a non-authoritative pathway describing incremental batching adoption across domains",
  });
}

function baseRequest(overrides: Partial<EvolutionCandidateRequest> = {}): EvolutionCandidateRequest {
  return {
    requestId: "ecreq-1",
    bundle: baseBundle(),
    learningSet: baseLearningSet(),
    optimizationSet: baseOptimizationSet(),
    awarenessSet: baseAwarenessSet(),
    evidence: baseEvidence(),
    seeds: [evolutionSeed()],
    ...overrides,
  };
}

// --- Boundary sets are frozen and disjoint -----------------------------------

assert.equal(Object.isFrozen(EVOLUTION_CANDIDATE_CAPABILITIES), true);
assert.equal(Object.isFrozen(EVOLUTION_CANDIDATE_NON_RESPONSIBILITIES), true);
assert.equal(Object.isFrozen(EVOLUTION_CANDIDATE_KINDS), true);
for (const forbidden of [
  "assess-readiness",
  "assess-transformation",
  "predict",
  "forecast",
  "simulate",
  "plan-work",
  "generate-roadmap",
  "recommend-actions",
  "recommend-strategy",
  "prioritize",
  "execute",
  "run-workflow",
  "call-ai",
  "call-llm",
  "persist",
  "invoke-api",
  "modify-memory",
  "modify-reasoning",
  "modify-organization",
  "modify-learning",
  "modify-optimization",
  "modify-awareness",
  "approve",
  "decide",
  "bypass-director",
] as const) {
  assert.equal(EVOLUTION_CANDIDATE_NON_RESPONSIBILITIES.includes(forbidden), true, `missing prohibition: ${forbidden}`);
}
{
  const forbiddenSet = new Set<string>(EVOLUTION_CANDIDATE_NON_RESPONSIBILITIES);
  for (const capability of EVOLUTION_CANDIDATE_CAPABILITIES) {
    assert.equal(forbiddenSet.has(capability), false);
  }
}

// --- Evolution kinds and basis requirement -----------------------------------

assert.deepEqual([...EVOLUTION_CANDIDATE_KINDS], ["evolution-readiness", "evolution-pathway"]);
assert.equal(evolutionRequiresBasis("evolution-readiness"), true);
assert.equal(evolutionRequiresBasis("evolution-pathway"), true);
assert.equal(isEvolutionCandidateKind("evolution-readiness"), true);
assert.equal(isEvolutionCandidateKind("evolution-pathway"), true);
assert.equal(isEvolutionCandidateKind("awareness-signal"), false);

// --- Awareness-support index and grounding -----------------------------------

{
  const index = awarenessSupportIndex(baseAwarenessSet());
  assert.equal(index.has("ac-1"), true);
  assert.equal(groundsInDeclaredAwareness(["ac-1"], index), true);
  assert.equal(groundsInDeclaredAwareness(["ac-404"], index), false);
  assert.equal(groundsInDeclaredAwareness([], index), false);
  assert.deepEqual(
    resolveSupportingAwareness({ awarenessRefs: ["ac-1"] }, index).map((c: AwarenessCandidate) => c.candidateId),
    ["ac-1"],
  );
}

// --- Identification is deterministic and preserves both kinds ----------------

{
  const candidates = identifyEvolutionCandidates(baseRequest({ seeds: [evolutionSeed(), pathwaySeed()] }));
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].candidateKind, "evolution-readiness");
  assert.equal(candidates[1].candidateKind, "evolution-pathway");
}

// --- Validation: a well-formed request passes (both kinds) -------------------

assert.deepEqual(validateEvolutionCandidateRequest(baseRequest()), { ok: true });
assert.deepEqual(validateEvolutionCandidateRequest(baseRequest({ seeds: [evolutionSeed(), pathwaySeed()] })), { ok: true });

// --- Validation: fail-closed cases -------------------------------------------

for (const [name, mutate] of [
  ["empty requestId", (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, requestId: "" })],
  [
    "non-evolution kind",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({
      ...r,
      seeds: [evolutionSeed({ candidateKind: "awareness-signal" as EvolutionCandidateSeed["candidateKind"] })],
    }),
  ],
  [
    "learning absent from qualified set",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ learningRefs: ["lc-404"] })] }),
  ],
  [
    "empty supporting learning",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ learningRefs: [] })] }),
  ],
  [
    "optimization absent from qualified set",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ optimizationRefs: ["oc-404"] })] }),
  ],
  [
    "empty supporting optimization",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ optimizationRefs: [] })] }),
  ],
  [
    "awareness absent from qualified set",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ awarenessRefs: ["ac-404"] })] }),
  ],
  [
    "empty supporting awareness",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ awarenessRefs: [] })] }),
  ],
  [
    "missing evidence",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ evidenceRefs: ["ev-404"] })] }),
  ],
  [
    "ineligible evidence",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ evidenceRefs: ["ev-3"] })] }),
  ],
  [
    "empty supporting evidence",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ evidenceRefs: [] })] }),
  ],
  [
    "empty explanation basis",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({
      ...r,
      seeds: [evolutionSeed({ explainability: { basis: [], assumptions: [], limitations: [], uncertainty: [] } })],
    }),
  ],
  [
    "terminal lifecycle",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({
      ...r,
      seeds: [evolutionSeed({ provenance: { ...evolutionSeed().provenance, lifecycle: "closed" } })],
    }),
  ],
  [
    "briefed lifecycle reserved for later phase",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({
      ...r,
      seeds: [evolutionSeed({ provenance: { ...evolutionSeed().provenance, lifecycle: "briefed" } })],
    }),
  ],
  [
    "non-positive provenance version",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({
      ...r,
      seeds: [evolutionSeed({ provenance: { ...evolutionSeed().provenance, version: 0 } })],
    }),
  ],
  [
    "duplicate candidate id",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed(), evolutionSeed()] }),
  ],
  [
    "self supersession",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({ ...r, seeds: [evolutionSeed({ supersedes: "ec-1" })] }),
  ],
  [
    "duplicate evidence id in pool",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => ({
      ...r,
      evidence: [...baseEvidence(), { evidenceId: "ev-1", source: "x", statement: "y", effectivePeriod: "2026-06-30T00:00:00.000Z", eligible: true }],
    }),
  ],
  [
    "ill-formed supporting awareness set",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => {
      const brokenAwareness: AwarenessCandidate = {
        candidateId: "ac-9",
        candidateKind: "awareness-signal",
        statement: "ungrounded",
        learningRefs: [],
        optimizationRefs: [],
        evidenceRefs: [],
        provenance: evolutionSeed().provenance,
        explainability: evolutionSeed().explainability,
        confidence: evolutionSeed().confidence,
        supersedes: null,
      };
      const brokenSet: CanonicalAwarenessCandidateSet = {
        requestId: "acreq-broken",
        candidates: [brokenAwareness],
        approval: { state: "pending-director" },
      };
      return { ...r, awarenessSet: brokenSet, seeds: [evolutionSeed({ awarenessRefs: ["ac-9"] })] };
    },
  ],
  [
    "ill-formed supporting learning set",
    (r: EvolutionCandidateRequest): EvolutionCandidateRequest => {
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
      return { ...r, learningSet: brokenSet, seeds: [evolutionSeed({ learningRefs: ["lc-9"] })] };
    },
  ],
] as const) {
  const result = validateEvolutionCandidateRequest(mutate(baseRequest()));
  assert.equal(result.ok, false, `expected failure: ${name}`);
}

// --- Preparation: validate, identify, preserve, freeze -----------------------

{
  const result = prepareEvolutionCandidates({ request: baseRequest({ seeds: [evolutionSeed(), pathwaySeed()] }) });
  assert.equal(result.ok, true);
  if (result.ok) {
    const set = result.value;
    assert.equal(set.requestId, "ecreq-1");
    assert.equal(set.approval.state, "pending-director");
    assert.equal(set.candidates.length, 2);
    const readiness = set.candidates.find((c) => c.candidateId === "ec-1");
    assert.notEqual(readiness, undefined);
    if (readiness !== undefined) {
      assert.equal(readiness.candidateKind, "evolution-readiness");
      // Supporting references preserved.
      assert.deepEqual(readiness.learningRefs, ["lc-1"]);
      assert.deepEqual(readiness.optimizationRefs, ["oc-1"]);
      assert.deepEqual(readiness.awarenessRefs, ["ac-1"]);
      assert.deepEqual(readiness.evidenceRefs, ["ev-1"]);
      // Provenance / explainability / confidence / uncertainty preserved unchanged.
      assert.equal(readiness.provenance.attribution, "evolution-candidate-runtime");
      assert.deepEqual(readiness.explainability.limitations, ["single domain observed"]);
      assert.deepEqual(readiness.confidence.uncertainty, ["non-authoritative, continuity not guaranteed"]);
    }
    // Frozen throughout.
    assert.equal(Object.isFrozen(set), true);
    assert.equal(Object.isFrozen(set.candidates), true);
    assert.equal(Object.isFrozen(set.candidates[0]), true);
    assert.deepEqual(validateEvolutionCandidateSet(set), { ok: true });
  }
}

// --- Preparation fails closed on ineligible evidence -------------------------

{
  const bad = prepareEvolutionCandidates({ request: baseRequest({ seeds: [evolutionSeed({ evidenceRefs: ["ev-3"] })] }) });
  assert.equal(bad.ok, false);
}

// --- Determinism: order and canonical key are input-order-invariant ----------

{
  const a = evolutionSeed({ candidateId: "ec-a", awarenessRefs: ["ac-1"], evidenceRefs: ["ev-2", "ev-1", "ev-2"] });
  const b = pathwaySeed();
  const forward = prepareEvolutionCandidates({ request: baseRequest({ seeds: [a, b] }) });
  const reverse = prepareEvolutionCandidates({ request: baseRequest({ seeds: [b, a] }) });
  assert.equal(forward.ok && reverse.ok, true);
  if (forward.ok && reverse.ok) {
    assert.deepEqual(forward.value.candidates.map((c) => c.candidateId), ["ec-2", "ec-a"]);
    assert.deepEqual(reverse.value.candidates.map((c) => c.candidateId), ["ec-2", "ec-a"]);
    // Duplicate evidence refs de-duplicated and ordered on ec-a.
    const ecA = forward.value.candidates.find((c) => c.candidateId === "ec-a");
    assert.notEqual(ecA, undefined);
    if (ecA !== undefined) assert.deepEqual(ecA.evidenceRefs, ["ev-1", "ev-2"]);
    assert.equal(
      canonicalEvolutionCandidateSetKey(forward.value),
      canonicalEvolutionCandidateSetKey(reverse.value),
    );
  }
}

// --- Normalization is deterministic and idempotent ---------------------------

{
  const prepared = prepareEvolutionCandidates({ request: baseRequest({ seeds: [evolutionSeed(), pathwaySeed()] }) });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const once = normalizeEvolutionCandidateSet(prepared.value);
    const twice = normalizeEvolutionCandidateSet(once);
    assert.deepEqual(once, twice);
    assert.equal(canonicalEvolutionCandidateSetKey(once), canonicalEvolutionCandidateSetKey(twice));
  }
}

// --- Supersession preserves history ------------------------------------------

{
  const result = prepareEvolutionCandidates({
    request: baseRequest({ seeds: [evolutionSeed({ candidateId: "ec-3", supersedes: "ec-1" })] }),
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.value.candidates[0].supersedes, "ec-1");
}

// --- UTF-8 / JSON stability of the canonical key -----------------------------

{
  const prepared = prepareEvolutionCandidates({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const key = canonicalEvolutionCandidateSetKey(prepared.value);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
}

console.log("enterprise-organizational-intelligence-runtime: all evolution candidate Phase 6 checks passed");
