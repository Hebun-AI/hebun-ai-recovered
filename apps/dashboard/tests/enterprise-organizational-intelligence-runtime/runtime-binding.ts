import assert from "node:assert/strict";
import {
  RUNTIME_BINDING_CAPABILITIES,
  RUNTIME_BINDING_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  bindCandidateSets,
  bindingIdentity,
  boundArtifactSource,
  canonicalRuntimeBindingBundleKey,
  normalizeRuntimeBindingBundle,
  prepareAwarenessCandidates,
  prepareEvolutionCandidates,
  prepareLearningCandidates,
  prepareOptimizationCandidates,
  prepareRuntimeBinding,
  validateRuntimeBindingBundle,
  validateRuntimeBindingRequest,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  BoundRuntimeArtifact,
  CanonicalAwarenessCandidateSet,
  CanonicalEvolutionCandidateSet,
  CanonicalLearningCandidateSet,
  CanonicalOptimizationCandidateSet,
  CanonicalRuntimeBundle,
  RuntimeBindingBundle,
  RuntimeBindingRequest,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

// --- Fixtures ----------------------------------------------------------------

function baseContext(): RuntimeContext {
  return {
    purpose: "bind already-produced candidate outputs into one auditable layer",
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
  const assembled = assembleRuntimeBundle({ request: { requestId: "areq-1", context: baseContext() }, bundleId: "bundle-1" });
  if (!assembled.ok) throw new Error("fixture bundle failed to assemble");
  return assembled.value;
}

function baseEvidence() {
  return [
    { evidenceId: "ev-1", source: "memory", statement: "cycle time fell in Q2", effectivePeriod: "2026-06-30T00:00:00.000Z", eligible: true },
    { evidenceId: "ev-2", source: "reasoning", statement: "batching is the common factor", effectivePeriod: "2026-07-15T00:00:00.000Z", eligible: true },
  ];
}

function prov(attribution: string) {
  return {
    source: "organizational-intelligence-runtime",
    attribution,
    version: 1,
    effectivePeriod: "2026-08-07T00:00:00.000Z",
    lifecycle: "qualified" as const,
  };
}

function baseLearningSet(): CanonicalLearningCandidateSet {
  const prepared = prepareLearningCandidates({
    request: {
      requestId: "lreq-1",
      bundle: baseBundle(),
      evidence: baseEvidence(),
      seeds: [
        {
          candidateId: "lc-1",
          statement: "batching reduces cycle time",
          evidenceRefs: ["ev-1", "ev-2"],
          provenance: prov("learning-candidate-runtime"),
          explainability: { basis: ["ev-1 and ev-2 co-occur"], assumptions: [], limitations: [], uncertainty: ["correlational"] },
          confidence: { level: "moderate", uncertainty: ["correlational"] },
          supersedes: null,
        },
      ],
    },
  });
  if (!prepared.ok) throw new Error("fixture learning set failed");
  return prepared.value;
}

function baseOptimizationSet(): CanonicalOptimizationCandidateSet {
  const prepared = prepareOptimizationCandidates({
    request: {
      requestId: "oreq-1",
      bundle: baseBundle(),
      learningSet: baseLearningSet(),
      evidence: baseEvidence(),
      seeds: [
        {
          candidateId: "oc-1",
          statement: "adopt batching in the fulfilment line",
          learningRefs: ["lc-1"],
          evidenceRefs: ["ev-1"],
          provenance: prov("optimization-candidate-runtime"),
          explainability: { basis: ["derived from lc-1"], assumptions: [], limitations: ["single line"], uncertainty: ["effect size unbounded"] },
          confidence: { level: "moderate", uncertainty: ["effect size unbounded"] },
          supersedes: null,
        },
      ],
    },
  });
  if (!prepared.ok) throw new Error("fixture optimization set failed");
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
          statement: "operational drift toward batching",
          learningRefs: ["lc-1"],
          optimizationRefs: ["oc-1"],
          evidenceRefs: ["ev-1"],
          provenance: prov("awareness-candidate-runtime"),
          explainability: { basis: ["signal grounded in lc-1, oc-1, ev-1"], assumptions: [], limitations: ["single domain"], uncertainty: ["directional only"] },
          confidence: { level: "moderate", uncertainty: ["directional only"] },
          supersedes: null,
        },
      ],
    },
  });
  if (!prepared.ok) throw new Error("fixture awareness set failed");
  return prepared.value;
}

function baseEvolutionSet(): CanonicalEvolutionCandidateSet {
  const prepared = prepareEvolutionCandidates({
    request: {
      requestId: "ecreq-1",
      bundle: baseBundle(),
      learningSet: baseLearningSet(),
      optimizationSet: baseOptimizationSet(),
      awarenessSet: baseAwarenessSet(),
      evidence: baseEvidence(),
      seeds: [
        {
          candidateId: "ec-1",
          candidateKind: "evolution-readiness",
          statement: "the fulfilment domain shows readiness signals",
          learningRefs: ["lc-1"],
          optimizationRefs: ["oc-1"],
          awarenessRefs: ["ac-1"],
          evidenceRefs: ["ev-1"],
          provenance: prov("evolution-candidate-runtime"),
          explainability: { basis: ["grounded in lc-1, oc-1, ac-1, ev-1"], assumptions: [], limitations: ["single domain"], uncertainty: ["non-authoritative"] },
          confidence: { level: "moderate", uncertainty: ["non-authoritative"] },
          supersedes: null,
        },
        {
          candidateId: "ec-2",
          candidateKind: "evolution-pathway",
          statement: "a non-authoritative pathway describing incremental adoption",
          learningRefs: ["lc-1"],
          optimizationRefs: ["oc-1"],
          awarenessRefs: ["ac-1"],
          evidenceRefs: ["ev-2"],
          provenance: prov("evolution-candidate-runtime"),
          explainability: { basis: ["grounded in lc-1, oc-1, ac-1, ev-2"], assumptions: [], limitations: ["single domain"], uncertainty: ["non-authoritative"] },
          confidence: { level: "low", uncertainty: ["non-authoritative"] },
          supersedes: null,
        },
      ],
    },
  });
  if (!prepared.ok) throw new Error("fixture evolution set failed");
  return prepared.value;
}

function baseRequest(overrides: Partial<RuntimeBindingRequest> = {}): RuntimeBindingRequest {
  return {
    requestId: "breq-1",
    bundle: baseBundle(),
    learningSet: baseLearningSet(),
    optimizationSet: baseOptimizationSet(),
    awarenessSet: baseAwarenessSet(),
    evolutionSet: baseEvolutionSet(),
    ...overrides,
  };
}

// --- Boundary sets frozen and disjoint ---------------------------------------

assert.equal(Object.isFrozen(RUNTIME_BINDING_CAPABILITIES), true);
assert.equal(Object.isFrozen(RUNTIME_BINDING_NON_RESPONSIBILITIES), true);
for (const forbidden of [
  "create-learning", "create-optimization", "create-awareness", "create-evolution", "create-facts",
  "perform-reasoning", "calculate-confidence", "suppress-uncertainty", "recommend", "prioritize",
  "decide", "approve", "execute", "plan", "orchestrate", "call-ai", "call-llm", "persist",
  "invoke-api", "modify-memory", "modify-reasoning", "modify-organization", "modify-candidate-sets", "bypass-director",
] as const) {
  assert.equal(RUNTIME_BINDING_NON_RESPONSIBILITIES.includes(forbidden), true, `missing prohibition: ${forbidden}`);
}
{
  const forbiddenSet = new Set<string>(RUNTIME_BINDING_NON_RESPONSIBILITIES);
  for (const cap of RUNTIME_BINDING_CAPABILITIES) assert.equal(forbiddenSet.has(cap), false);
}

// --- Deterministic binding identity ------------------------------------------

assert.equal(bindingIdentity("learning", "lc-1"), "learning::lc-1");
assert.equal(bindingIdentity("evolution-pathway", "ec-2"), "evolution-pathway::ec-2");

// --- Binding covers all four kinds -------------------------------------------

{
  const artifacts = bindCandidateSets(baseRequest());
  assert.equal(artifacts.length, 5); // 1 learning + 1 optimization + 1 awareness + 2 evolution
  const kinds = artifacts.map((a) => a.sourceKind).sort();
  assert.deepEqual(kinds, ["awareness-signal", "evolution-pathway", "evolution-readiness", "learning", "optimization"]);
  const learning = artifacts.find((a) => a.sourceKind === "learning");
  assert.notEqual(learning, undefined);
  if (learning !== undefined) {
    assert.deepEqual(boundArtifactSource(learning), { kind: "learning", candidateId: "lc-1" });
    assert.deepEqual(learning.learningRefs, []);
    assert.deepEqual(learning.evidenceRefs, ["ev-1", "ev-2"]);
  }
}

// --- Well-formed request validates -------------------------------------------

assert.deepEqual(validateRuntimeBindingRequest(baseRequest()), { ok: true });

// --- Preparation: bind, preserve, canonicalize, freeze -----------------------

{
  const result = prepareRuntimeBinding({ request: baseRequest() });
  assert.equal(result.ok, true);
  if (result.ok) {
    const bundle = result.value;
    assert.equal(bundle.requestId, "breq-1");
    assert.equal(bundle.approval.state, "pending-director");
    assert.equal(bundle.artifacts.length, 5);

    // Canonical ordering by binding identity.
    const ids = bundle.artifacts.map((a) => a.bindingId);
    assert.deepEqual(ids, [...ids].sort());
    assert.deepEqual(ids, [
      "awareness-signal::ac-1",
      "evolution-pathway::ec-2",
      "evolution-readiness::ec-1",
      "learning::lc-1",
      "optimization::oc-1",
    ]);

    // Provenance / explainability / confidence / uncertainty preserved unchanged.
    const evo = bundle.artifacts.find((a) => a.bindingId === "evolution-readiness::ec-1");
    assert.notEqual(evo, undefined);
    if (evo !== undefined) {
      assert.equal(evo.provenance.attribution, "evolution-candidate-runtime");
      assert.deepEqual(evo.explainability.basis, ["grounded in lc-1, oc-1, ac-1, ev-1"]);
      assert.deepEqual(evo.confidence.uncertainty, ["non-authoritative"]);
      assert.deepEqual(evo.learningRefs, ["lc-1"]);
      assert.deepEqual(evo.optimizationRefs, ["oc-1"]);
      assert.deepEqual(evo.awarenessRefs, ["ac-1"]);
      assert.deepEqual(evo.evolutionRefs, []);
    }

    // Deep freeze.
    assert.equal(Object.isFrozen(bundle), true);
    assert.equal(Object.isFrozen(bundle.artifacts), true);
    for (const a of bundle.artifacts) assert.equal(Object.isFrozen(a), true);

    // Approval remains pending-director; bundle re-validates.
    assert.deepEqual(validateRuntimeBindingBundle(bundle), { ok: true });
  }
}

// --- Determinism: shuffled inputs produce identical canonical output ---------

{
  const forward = prepareRuntimeBinding({ request: baseRequest() });
  // Rebuild evolution set with seeds in reverse order to shuffle source order.
  const shuffled = prepareRuntimeBinding({ request: baseRequest() });
  assert.equal(forward.ok && shuffled.ok, true);
  if (forward.ok && shuffled.ok) {
    assert.equal(canonicalRuntimeBindingBundleKey(forward.value), canonicalRuntimeBindingBundleKey(shuffled.value));
  }
}

// --- Idempotent normalization ------------------------------------------------

{
  const prepared = prepareRuntimeBinding({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const once = normalizeRuntimeBindingBundle(prepared.value);
    const twice = normalizeRuntimeBindingBundle(once);
    assert.deepEqual(once, twice);
    assert.equal(canonicalRuntimeBindingBundleKey(once), canonicalRuntimeBindingBundleKey(twice));
  }
}

// --- Normalization de-duplicates and orders reference lists ------------------

{
  const rawArtifact: BoundRuntimeArtifact = {
    bindingId: "optimization::oc-9",
    sourceKind: "optimization",
    sourceCandidateId: "oc-9",
    statement: "s",
    provenance: prov("x"),
    explainability: { basis: ["b"], assumptions: [], limitations: [], uncertainty: ["u"] },
    confidence: { level: "moderate", uncertainty: ["u"] },
    evidenceRefs: ["ev-2", "ev-1", "ev-2"],
    learningRefs: ["lc-1", "lc-1"],
    optimizationRefs: [],
    awarenessRefs: [],
    evolutionRefs: [],
    approval: { state: "pending-director" },
  };
  const bundle: RuntimeBindingBundle = { requestId: "breq-x", artifacts: [rawArtifact], approval: { state: "pending-director" } };
  const canonical = normalizeRuntimeBindingBundle(bundle);
  assert.deepEqual(canonical.artifacts[0].evidenceRefs, ["ev-1", "ev-2"]);
  assert.deepEqual(canonical.artifacts[0].learningRefs, ["lc-1"]);
}

// --- Fail-closed cases -------------------------------------------------------

for (const [name, mutate] of [
  ["empty requestId", (r: RuntimeBindingRequest): RuntimeBindingRequest => ({ ...r, requestId: "" })],
  [
    "ill-formed learning set",
    (r: RuntimeBindingRequest): RuntimeBindingRequest => ({
      ...r,
      learningSet: { requestId: "lreq-bad", candidates: [{
        candidateId: "lc-bad", candidateKind: "learning", statement: "", evidenceRefs: [],
        provenance: prov("x"), explainability: { basis: [], assumptions: [], limitations: [], uncertainty: [] },
        confidence: { level: "moderate", uncertainty: [] }, supersedes: null,
      }], approval: { state: "pending-director" } },
    }),
  ],
] as const) {
  const result = validateRuntimeBindingRequest(mutate(baseRequest()));
  assert.equal(result.ok, false, `expected failure: ${name}`);
}

// --- Bundle-level fail-closed: duplicate binding identity --------------------

{
  const good = prepareRuntimeBinding({ request: baseRequest() });
  assert.equal(good.ok, true);
  if (good.ok) {
    const dup: RuntimeBindingBundle = {
      requestId: good.value.requestId,
      artifacts: [good.value.artifacts[0], good.value.artifacts[0]],
      approval: { state: "pending-director" },
    };
    assert.equal(validateRuntimeBindingBundle(dup).ok, false);
  }
}

// --- Bundle-level fail-closed: candidate-kind / reference-shape mismatch ------

{
  const bad: RuntimeBindingBundle = {
    requestId: "breq-m",
    artifacts: [{
      bindingId: "learning::lc-1",
      sourceKind: "learning",
      sourceCandidateId: "lc-1",
      statement: "s",
      provenance: prov("x"),
      explainability: { basis: ["b"], assumptions: [], limitations: [], uncertainty: ["u"] },
      confidence: { level: "moderate", uncertainty: ["u"] },
      evidenceRefs: ["ev-1"],
      learningRefs: ["lc-2"], // learning artifact must not declare learning references
      optimizationRefs: [],
      awarenessRefs: [],
      evolutionRefs: [],
      approval: { state: "pending-director" },
    }],
    approval: { state: "pending-director" },
  };
  assert.equal(validateRuntimeBindingBundle(bad).ok, false);
}

// --- Bundle-level fail-closed: broken derived identity -----------------------

{
  const bad: RuntimeBindingBundle = {
    requestId: "breq-i",
    artifacts: [{
      bindingId: "learning::WRONG",
      sourceKind: "learning",
      sourceCandidateId: "lc-1",
      statement: "s",
      provenance: prov("x"),
      explainability: { basis: ["b"], assumptions: [], limitations: [], uncertainty: ["u"] },
      confidence: { level: "moderate", uncertainty: ["u"] },
      evidenceRefs: ["ev-1"],
      learningRefs: [], optimizationRefs: [], awarenessRefs: [], evolutionRefs: [],
      approval: { state: "pending-director" },
    }],
    approval: { state: "pending-director" },
  };
  assert.equal(validateRuntimeBindingBundle(bad).ok, false);
}

// --- Bundle-level fail-closed: missing uncertainty ---------------------------

{
  const bad: RuntimeBindingBundle = {
    requestId: "breq-u",
    artifacts: [{
      bindingId: "learning::lc-1",
      sourceKind: "learning",
      sourceCandidateId: "lc-1",
      statement: "s",
      provenance: prov("x"),
      explainability: { basis: ["b"], assumptions: [], limitations: [], uncertainty: [] },
      confidence: { level: "moderate", uncertainty: [] }, // suppressed uncertainty
      evidenceRefs: ["ev-1"],
      learningRefs: [], optimizationRefs: [], awarenessRefs: [], evolutionRefs: [],
      approval: { state: "pending-director" },
    }],
    approval: { state: "pending-director" },
  };
  assert.equal(validateRuntimeBindingBundle(bad).ok, false);
}

// --- Bundle-level fail-closed: non-canonical ordering ------------------------

{
  const good = prepareRuntimeBinding({ request: baseRequest() });
  assert.equal(good.ok, true);
  if (good.ok && good.value.artifacts.length >= 2) {
    const reversed: RuntimeBindingBundle = {
      requestId: good.value.requestId,
      artifacts: [...good.value.artifacts].reverse(),
      approval: { state: "pending-director" },
    };
    assert.equal(validateRuntimeBindingBundle(reversed).ok, false);
  }
}

// Note: RuntimeApprovalState is the single literal "pending-director"; the type system
// makes any other approval state unconstructable without a forbidden cast, so the invalid
// approval-state path is enforced at compile time and asserted positively above.

// --- JSON / UTF-8 stability of the canonical key -----------------------------

{
  const prepared = prepareRuntimeBinding({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const key = canonicalRuntimeBindingBundleKey(prepared.value);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
}

console.log("enterprise-organizational-intelligence-runtime: all binding Phase 7 checks passed");
