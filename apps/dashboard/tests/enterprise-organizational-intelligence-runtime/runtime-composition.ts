import assert from "node:assert/strict";
import {
  RUNTIME_COMPOSITION_CAPABILITIES,
  RUNTIME_COMPOSITION_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  candidateBindingIds,
  composeRuntime,
  compositionIdentity,
  normalizeRuntimeComposition,
  prepareAwarenessCandidates,
  prepareDirectorBriefing,
  prepareEvolutionCandidates,
  prepareLearningCandidates,
  prepareOptimizationCandidates,
  prepareRuntimeBinding,
  runtimeCompositionKey,
  summarizeRuntimeComposition,
  validateRuntimeComposition,
  validateRuntimeCompositionRequest,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  CanonicalAwarenessCandidateSet,
  CanonicalDirectorBriefing,
  CanonicalEvolutionCandidateSet,
  CanonicalLearningCandidateSet,
  CanonicalOptimizationCandidateSet,
  CanonicalRuntimeBindingBundle,
  CanonicalRuntimeBundle,
  RuntimeCompositionRequest,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

// --- Fixtures ----------------------------------------------------------------

function baseContext(): RuntimeContext {
  return {
    purpose: "compose the settled Phase 1-8 outputs into one closed Runtime state",
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

function evolutionSeeds() {
  return [
    {
      candidateId: "ec-1",
      candidateKind: "evolution-readiness" as const,
      statement: "the fulfilment domain shows readiness signals",
      learningRefs: ["lc-1"],
      optimizationRefs: ["oc-1"],
      awarenessRefs: ["ac-1"],
      evidenceRefs: ["ev-1"],
      provenance: prov("evolution-candidate-runtime"),
      explainability: { basis: ["grounded in lc-1, oc-1, ac-1, ev-1"], assumptions: [], limitations: ["single domain"], uncertainty: ["non-authoritative"] },
      confidence: { level: "moderate" as const, uncertainty: ["non-authoritative"] },
      supersedes: null,
    },
    {
      candidateId: "ec-2",
      candidateKind: "evolution-pathway" as const,
      statement: "a non-authoritative pathway describing incremental adoption",
      learningRefs: ["lc-1"],
      optimizationRefs: ["oc-1"],
      awarenessRefs: ["ac-1"],
      evidenceRefs: ["ev-2"],
      provenance: prov("evolution-candidate-runtime"),
      explainability: { basis: ["grounded in lc-1, oc-1, ac-1, ev-2"], assumptions: [], limitations: ["single domain"], uncertainty: ["non-authoritative"] },
      confidence: { level: "low" as const, uncertainty: ["non-authoritative"] },
      supersedes: null,
    },
  ];
}

function baseEvolutionSet(reversed = false): CanonicalEvolutionCandidateSet {
  const seeds = evolutionSeeds();
  const prepared = prepareEvolutionCandidates({
    request: {
      requestId: "ecreq-1",
      bundle: baseBundle(),
      learningSet: baseLearningSet(),
      optimizationSet: baseOptimizationSet(),
      awarenessSet: baseAwarenessSet(),
      evidence: baseEvidence(),
      seeds: reversed ? [...seeds].reverse() : seeds,
    },
  });
  if (!prepared.ok) throw new Error("fixture evolution set failed");
  return prepared.value;
}

function baseBindingBundle(): CanonicalRuntimeBindingBundle {
  const prepared = prepareRuntimeBinding({
    request: {
      requestId: "breq-1",
      bundle: baseBundle(),
      learningSet: baseLearningSet(),
      optimizationSet: baseOptimizationSet(),
      awarenessSet: baseAwarenessSet(),
      evolutionSet: baseEvolutionSet(),
    },
  });
  if (!prepared.ok) throw new Error("fixture binding bundle failed");
  return prepared.value;
}

function baseBriefing(): CanonicalDirectorBriefing {
  const prepared = prepareDirectorBriefing({
    request: {
      requestId: "dbreq-1",
      bundle: baseBundle(),
      learningSet: baseLearningSet(),
      optimizationSet: baseOptimizationSet(),
      awarenessSet: baseAwarenessSet(),
      evolutionSet: baseEvolutionSet(),
      bindingBundle: baseBindingBundle(),
      governance: { constraints: ["gov-2", "gov-1"], heldImmutable: true, restrictions: ["escalate", "defer"] },
    },
  });
  if (!prepared.ok) throw new Error("fixture briefing failed");
  return prepared.value;
}

function baseRequest(overrides: Partial<RuntimeCompositionRequest> = {}): RuntimeCompositionRequest {
  return {
    requestId: "rcreq-1",
    bundle: baseBundle(),
    learningSet: baseLearningSet(),
    optimizationSet: baseOptimizationSet(),
    awarenessSet: baseAwarenessSet(),
    evolutionSet: baseEvolutionSet(),
    bindingBundle: baseBindingBundle(),
    briefing: baseBriefing(),
    ...overrides,
  };
}

// --- Boundary sets frozen and disjoint ---------------------------------------

assert.equal(Object.isFrozen(RUNTIME_COMPOSITION_CAPABILITIES), true);
assert.equal(Object.isFrozen(RUNTIME_COMPOSITION_NON_RESPONSIBILITIES), true);
for (const forbidden of [
  "generate-learning", "generate-optimization", "generate-awareness", "generate-evolution",
  "perform-reasoning", "infer-facts", "calculate-confidence", "recommend", "rank", "prioritize",
  "approve", "reject", "decide", "execute", "plan", "schedule", "orchestrate-external-work",
  "call-ai", "call-llm", "invoke-api", "persist", "mutate-memory", "mutate-reasoning",
  "mutate-organizational-intelligence", "mutate-candidate-sets", "mutate-bindings",
  "mutate-director-briefing", "bypass-director",
] as const) {
  assert.equal(RUNTIME_COMPOSITION_NON_RESPONSIBILITIES.includes(forbidden), true, `missing prohibition: ${forbidden}`);
}
{
  const forbiddenSet = new Set<string>(RUNTIME_COMPOSITION_NON_RESPONSIBILITIES);
  for (const cap of RUNTIME_COMPOSITION_CAPABILITIES) assert.equal(forbiddenSet.has(cap), false);
}

// --- Deterministic composition identity --------------------------------------

assert.equal(compositionIdentity("bundle-1", "dbreq-1"), "bundle-1::dbreq-1");

// --- candidateBindingIds derive Phase 7 identities ---------------------------

{
  const ids = candidateBindingIds(baseRequest());
  assert.deepEqual([...ids].sort(), [
    "awareness-signal::ac-1",
    "evolution-pathway::ec-2",
    "evolution-readiness::ec-1",
    "learning::lc-1",
    "optimization::oc-1",
  ]);
}

// --- Well-formed request validates -------------------------------------------

assert.deepEqual(validateRuntimeCompositionRequest(baseRequest()), { ok: true });

// --- Composition: validate, compose, preserve, canonicalize, freeze ----------

let reference: ReturnType<typeof composeRuntime> | undefined;
{
  const req = baseRequest();
  const result = composeRuntime({ request: req });
  reference = result;
  assert.equal(result.ok, true);
  if (result.ok) {
    const c = result.value;

    // Identity, approval, integrity, lifecycle.
    assert.equal(c.compositionId, "bundle-1::dbreq-1");
    assert.equal(c.approval.state, "pending-director");
    assert.equal(c.integrity, "verified");
    assert.equal(c.lifecycle, "qualified");

    // Summary tally.
    assert.deepEqual(c.summary, {
      learningCount: 1,
      optimizationCount: 1,
      awarenessCount: 1,
      evolutionCount: 2,
      candidateTotal: 5,
      boundArtifactCount: 5,
      briefingItemCount: 5,
      pendingDirectorDecisionCount: 5,
    });

    // Candidate / binding / briefing / governance preservation: every sub-output is the exact
    // settled input, carried through by reference UNCHANGED.
    assert.equal(c.bundle, req.bundle);
    assert.equal(c.learningSet, req.learningSet);
    assert.equal(c.optimizationSet, req.optimizationSet);
    assert.equal(c.awarenessSet, req.awarenessSet);
    assert.equal(c.evolutionSet, req.evolutionSet);
    assert.equal(c.bindingBundle, req.bindingBundle);
    assert.equal(c.briefing, req.briefing);
    assert.equal(c.governance, req.briefing.governance);
    assert.deepEqual(c.briefing.governance.constraints, ["gov-1", "gov-2"]);

    // Every candidate is bound and every bound artifact is briefed (bijection).
    const artifactIds = c.bindingBundle.artifacts.map((a) => a.bindingId);
    const itemIds = c.briefing.items.map((i) => i.bindingId);
    assert.deepEqual([...artifactIds].sort(), [...itemIds].sort());
    assert.deepEqual([...candidateBindingIds(req)].sort(), [...artifactIds].sort());

    // Deep freeze.
    assert.equal(Object.isFrozen(c), true);
    assert.equal(Object.isFrozen(c.summary), true);
    assert.equal(Object.isFrozen(c.bindingBundle), true);
    assert.equal(Object.isFrozen(c.briefing), true);
    assert.equal(Object.isFrozen(c.briefing.items), true);
    assert.equal(Object.isFrozen(c.learningSet), true);

    // Prepared composition re-validates.
    assert.deepEqual(validateRuntimeComposition(c), { ok: true });
  }
}

// --- Determinism: repeated composition is identical --------------------------

{
  const a = composeRuntime({ request: baseRequest() });
  const b = composeRuntime({ request: baseRequest() });
  assert.equal(a.ok && b.ok, true);
  if (a.ok && b.ok) {
    assert.equal(runtimeCompositionKey(a.value), runtimeCompositionKey(b.value));
    assert.deepEqual(a.value, b.value);
  }
}

// --- Shuffled inputs produce an identical canonical composition --------------

{
  const forward = composeRuntime({ request: baseRequest() });
  const shuffled = composeRuntime({ request: baseRequest({ evolutionSet: baseEvolutionSet(true) }) });
  assert.equal(forward.ok && shuffled.ok, true);
  if (forward.ok && shuffled.ok) {
    assert.equal(runtimeCompositionKey(forward.value), runtimeCompositionKey(shuffled.value));
    assert.deepEqual(forward.value, shuffled.value);
  }
}

// --- Idempotent normalization ------------------------------------------------

{
  const prepared = composeRuntime({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const once = normalizeRuntimeComposition(prepared.value);
    const twice = normalizeRuntimeComposition(once);
    assert.deepEqual(once, twice);
    assert.equal(runtimeCompositionKey(once), runtimeCompositionKey(twice));
  }
}

// --- summarize matches contents ----------------------------------------------

{
  const req = baseRequest();
  assert.deepEqual(summarizeRuntimeComposition(req), {
    learningCount: 1,
    optimizationCount: 1,
    awarenessCount: 1,
    evolutionCount: 2,
    candidateTotal: 5,
    boundArtifactCount: 5,
    briefingItemCount: 5,
    pendingDirectorDecisionCount: 5,
  });
}

// --- No input mutation -------------------------------------------------------

{
  const bundle = baseBundle();
  const learningSet = baseLearningSet();
  const optimizationSet = baseOptimizationSet();
  const awarenessSet = baseAwarenessSet();
  const evolutionSet = baseEvolutionSet();
  const bindingBundle = baseBindingBundle();
  const briefing = baseBriefing();
  const snapshots = [bundle, learningSet, optimizationSet, awarenessSet, evolutionSet, bindingBundle, briefing].map((x) => JSON.stringify(x));
  const result = composeRuntime({ request: { requestId: "rcreq-nm", bundle, learningSet, optimizationSet, awarenessSet, evolutionSet, bindingBundle, briefing } });
  assert.equal(result.ok, true);
  const after = [bundle, learningSet, optimizationSet, awarenessSet, evolutionSet, bindingBundle, briefing].map((x) => JSON.stringify(x));
  assert.deepEqual(after, snapshots);
}

// --- Fail-closed: empty requestId --------------------------------------------

assert.equal(validateRuntimeCompositionRequest(baseRequest({ requestId: "" })).ok, false);

// --- Fail-closed: missing candidate (candidate absent from set, still bound) --

{
  const emptyLearning: CanonicalLearningCandidateSet = { requestId: "lreq-1", candidates: [], approval: { state: "pending-director" } };
  const bad = composeRuntime({ request: baseRequest({ learningSet: emptyLearning }) });
  assert.equal(bad.ok, false);
}

// --- Fail-closed: missing binding (bound artifact removed) -------------------

{
  const full = baseBindingBundle();
  const trimmed: CanonicalRuntimeBindingBundle = { requestId: full.requestId, artifacts: full.artifacts.slice(1), approval: { state: "pending-director" } };
  const bad = composeRuntime({ request: baseRequest({ bindingBundle: trimmed }) });
  assert.equal(bad.ok, false);
}

// --- Fail-closed: missing briefing item -------------------------------------

{
  const full = baseBriefing();
  const trimmed: CanonicalDirectorBriefing = { requestId: full.requestId, items: full.items.slice(1), governance: full.governance, approval: { state: "pending-director" } };
  const bad = composeRuntime({ request: baseRequest({ briefing: trimmed }) });
  assert.equal(bad.ok, false);
}

// --- Fail-closed: duplicate candidate identity ------------------------------

{
  const full = baseLearningSet();
  const dup: CanonicalLearningCandidateSet = { requestId: full.requestId, candidates: [full.candidates[0], full.candidates[0]], approval: { state: "pending-director" } };
  const bad = composeRuntime({ request: baseRequest({ learningSet: dup }) });
  assert.equal(bad.ok, false);
}

// --- Fail-closed: dangling briefing item (item with no bound artifact) -------

{
  const briefing = baseBriefing();
  const extraItem = { ...briefing.items[0], bindingId: "learning::ghost", sourceCandidateId: "ghost" };
  const danglingItems = [...briefing.items, extraItem].slice().sort((l, r) => (l.bindingId < r.bindingId ? -1 : l.bindingId > r.bindingId ? 1 : 0));
  const pending = danglingItems.map((i) => i.bindingId).slice().sort();
  const dangling: CanonicalDirectorBriefing = {
    requestId: briefing.requestId,
    items: danglingItems,
    governance: { ...briefing.governance, pendingDirectorDecisions: pending },
    approval: { state: "pending-director" },
  };
  const bad = composeRuntime({ request: baseRequest({ briefing: dangling }) });
  assert.equal(bad.ok, false);
}

// --- JSON / UTF-8 stability of the canonical key -----------------------------

{
  assert.notEqual(reference, undefined);
  if (reference !== undefined && reference.ok) {
    const key = runtimeCompositionKey(reference.value);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
}

console.log("enterprise-organizational-intelligence-runtime: all Runtime composition Phase 9 checks passed");
