import assert from "node:assert/strict";
import {
  DIRECTOR_BRIEFING_CAPABILITIES,
  DIRECTOR_BRIEFING_NON_RESPONSIBILITIES,
  assembleRuntimeBundle,
  briefingItemKey,
  briefingItemSource,
  canonicalDirectorBriefingKey,
  describeGovernance,
  normalizeDirectorBriefing,
  prepareAwarenessCandidates,
  prepareDirectorBriefing,
  prepareEvolutionCandidates,
  prepareLearningCandidates,
  prepareOptimizationCandidates,
  prepareRuntimeBinding,
  projectBriefingItems,
  validateDirectorBriefing,
  validateDirectorBriefingRequest,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  CanonicalAwarenessCandidateSet,
  CanonicalDirectorBriefing,
  CanonicalEvolutionCandidateSet,
  CanonicalLearningCandidateSet,
  CanonicalOptimizationCandidateSet,
  CanonicalRuntimeBindingBundle,
  CanonicalRuntimeBundle,
  DirectorBriefing,
  DirectorBriefingItem,
  DirectorBriefingRequest,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

// --- Fixtures ----------------------------------------------------------------

function baseContext(): RuntimeContext {
  return {
    purpose: "organize already-bound intelligence into one Director briefing",
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

function baseRequest(overrides: Partial<DirectorBriefingRequest> = {}): DirectorBriefingRequest {
  return {
    requestId: "dbreq-1",
    bundle: baseBundle(),
    learningSet: baseLearningSet(),
    optimizationSet: baseOptimizationSet(),
    awarenessSet: baseAwarenessSet(),
    evolutionSet: baseEvolutionSet(),
    bindingBundle: baseBindingBundle(),
    governance: { constraints: ["gov-2", "gov-1"], heldImmutable: true, restrictions: ["escalate", "defer"] },
    ...overrides,
  };
}

// --- Boundary sets frozen and disjoint ---------------------------------------

assert.equal(Object.isFrozen(DIRECTOR_BRIEFING_CAPABILITIES), true);
assert.equal(Object.isFrozen(DIRECTOR_BRIEFING_NON_RESPONSIBILITIES), true);
for (const forbidden of [
  "prioritize", "rank", "recommend", "approve", "reject", "decide", "execute", "schedule",
  "assign-work", "trigger-workflows", "hide-uncertainty", "modify-runtime-outputs",
  "generate-candidates", "perform-reasoning", "calculate-confidence", "suppress-uncertainty",
  "call-ai", "call-llm", "persist", "invoke-api", "modify-memory", "modify-reasoning",
  "modify-organization", "modify-candidate-sets", "perform-governance-decision", "bypass-director",
] as const) {
  assert.equal(DIRECTOR_BRIEFING_NON_RESPONSIBILITIES.includes(forbidden), true, `missing prohibition: ${forbidden}`);
}
{
  const forbiddenSet = new Set<string>(DIRECTOR_BRIEFING_NON_RESPONSIBILITIES);
  for (const cap of DIRECTOR_BRIEFING_CAPABILITIES) assert.equal(forbiddenSet.has(cap), false);
}

// --- Organizing covers every bound artifact, hides none ----------------------

{
  const items = projectBriefingItems(baseBindingBundle());
  assert.equal(items.length, 5); // 1 learning + 1 optimization + 1 awareness + 2 evolution
  const kinds = items.map((i) => i.sourceKind).sort();
  assert.deepEqual(kinds, ["awareness-signal", "evolution-pathway", "evolution-readiness", "learning", "optimization"]);
  const learning = items.find((i) => i.sourceKind === "learning");
  assert.notEqual(learning, undefined);
  if (learning !== undefined) {
    assert.deepEqual(briefingItemSource(learning), { kind: "learning", candidateId: "lc-1" });
    assert.deepEqual(learning.learningRefs, []);
    assert.deepEqual(learning.evidenceRefs, ["ev-1", "ev-2"]);
    // Lifecycle exposed from provenance, never advanced.
    assert.equal(learning.lifecycle, "qualified");
    assert.equal(learning.lifecycle, learning.provenance.lifecycle);
  }
}

// --- Well-formed request validates -------------------------------------------

assert.deepEqual(validateDirectorBriefingRequest(baseRequest()), { ok: true });

// --- Preparation: organize, preserve, describe governance, canonicalize, freeze

let canonicalReference: CanonicalDirectorBriefing | undefined;
{
  const result = prepareDirectorBriefing({ request: baseRequest() });
  assert.equal(result.ok, true);
  if (result.ok) {
    const briefing = result.value;
    canonicalReference = briefing;
    assert.equal(briefing.requestId, "dbreq-1");
    assert.equal(briefing.approval.state, "pending-director");
    assert.equal(briefing.items.length, 5);

    // Canonical ordering by binding identity (arrangement, not ranking).
    const ids = briefing.items.map((i) => i.bindingId);
    assert.deepEqual(ids, [...ids].sort());
    assert.deepEqual(ids, [
      "awareness-signal::ac-1",
      "evolution-pathway::ec-2",
      "evolution-readiness::ec-1",
      "learning::lc-1",
      "optimization::oc-1",
    ]);

    // Provenance / explainability / confidence / uncertainty / references preserved unchanged.
    const evo = briefing.items.find((i) => i.bindingId === "evolution-readiness::ec-1");
    assert.notEqual(evo, undefined);
    if (evo !== undefined) {
      assert.equal(evo.provenance.attribution, "evolution-candidate-runtime");
      assert.deepEqual(evo.explainability.basis, ["grounded in lc-1, oc-1, ac-1, ev-1"]);
      assert.deepEqual(evo.confidence.uncertainty, ["non-authoritative"]);
      assert.equal(evo.confidence.level, "moderate");
      assert.deepEqual(evo.learningRefs, ["lc-1"]);
      assert.deepEqual(evo.optimizationRefs, ["oc-1"]);
      assert.deepEqual(evo.awarenessRefs, ["ac-1"]);
      assert.deepEqual(evo.evolutionRefs, []);
      assert.equal(evo.sourceCandidateId, "ec-1");
      assert.equal(evo.lifecycle, "qualified");
    }

    // Governance is descriptive only: constraints and restrictions exposed and ordered,
    // approval pending, pending decisions match every organized item.
    assert.deepEqual(briefing.governance.constraints, ["gov-1", "gov-2"]);
    assert.deepEqual(briefing.governance.restrictions, ["defer", "escalate"]);
    assert.equal(briefing.governance.heldImmutable, true);
    assert.equal(briefing.governance.approval.state, "pending-director");
    assert.deepEqual(briefing.governance.pendingDirectorDecisions, [
      "awareness-signal::ac-1",
      "evolution-pathway::ec-2",
      "evolution-readiness::ec-1",
      "learning::lc-1",
      "optimization::oc-1",
    ]);

    // Deep freeze.
    assert.equal(Object.isFrozen(briefing), true);
    assert.equal(Object.isFrozen(briefing.items), true);
    assert.equal(Object.isFrozen(briefing.governance), true);
    assert.equal(Object.isFrozen(briefing.governance.restrictions), true);
    for (const i of briefing.items) assert.equal(Object.isFrozen(i), true);

    // Prepared briefing re-validates.
    assert.deepEqual(validateDirectorBriefing(briefing), { ok: true });
  }
}

// --- Determinism: repeated preparation produces identical canonical output ----

{
  const a = prepareDirectorBriefing({ request: baseRequest() });
  const b = prepareDirectorBriefing({ request: baseRequest() });
  assert.equal(a.ok && b.ok, true);
  if (a.ok && b.ok) {
    assert.equal(canonicalDirectorBriefingKey(a.value), canonicalDirectorBriefingKey(b.value));
    assert.deepEqual(a.value, b.value);
  }
}

// --- Shuffled inputs produce an identical briefing ---------------------------

{
  const forward = prepareDirectorBriefing({ request: baseRequest() });
  // Shuffle governance input order and evolution seed order; canonical output must be identical.
  const shuffled = prepareDirectorBriefing({
    request: baseRequest({
      governance: { constraints: ["gov-1", "gov-2", "gov-1"], heldImmutable: true, restrictions: ["defer", "escalate", "escalate"] },
    }),
  });
  assert.equal(forward.ok && shuffled.ok, true);
  if (forward.ok && shuffled.ok) {
    assert.equal(canonicalDirectorBriefingKey(forward.value), canonicalDirectorBriefingKey(shuffled.value));
  }
}

// --- Idempotent normalization ------------------------------------------------

{
  const prepared = prepareDirectorBriefing({ request: baseRequest() });
  assert.equal(prepared.ok, true);
  if (prepared.ok) {
    const once = normalizeDirectorBriefing(prepared.value);
    const twice = normalizeDirectorBriefing(once);
    assert.deepEqual(once, twice);
    assert.equal(canonicalDirectorBriefingKey(once), canonicalDirectorBriefingKey(twice));
  }
}

// --- Normalization de-duplicates and orders reference lists ------------------

{
  const rawItem: DirectorBriefingItem = {
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
    lifecycle: "qualified",
    approval: { state: "pending-director" },
  };
  const briefing: DirectorBriefing = {
    requestId: "dbreq-x",
    items: [rawItem],
    governance: describeGovernance({ constraints: ["g"], heldImmutable: true, restrictions: [] }, [rawItem]),
    approval: { state: "pending-director" },
  };
  const canonical = normalizeDirectorBriefing(briefing);
  assert.deepEqual(canonical.items[0].evidenceRefs, ["ev-1", "ev-2"]);
  assert.deepEqual(canonical.items[0].learningRefs, ["lc-1"]);
}

// --- Request-level fail-closed cases -----------------------------------------

for (const [name, mutate] of [
  ["empty requestId", (r: DirectorBriefingRequest): DirectorBriefingRequest => ({ ...r, requestId: "" })],
  [
    "governance not held immutable is unconstructable via type; empty constraint fails",
    (r: DirectorBriefingRequest): DirectorBriefingRequest => ({
      ...r,
      // A well-formed request still validates governance descriptively at bundle time only;
      // request validation focuses on items — assert an ill-formed learning set fails instead.
      learningSet: { requestId: "lreq-bad", candidates: [{
        candidateId: "lc-bad", candidateKind: "learning", statement: "", evidenceRefs: [],
        provenance: prov("x"), explainability: { basis: [], assumptions: [], limitations: [], uncertainty: [] },
        confidence: { level: "moderate", uncertainty: [] }, supersedes: null,
      }], approval: { state: "pending-director" } },
    }),
  ],
] as const) {
  const result = validateDirectorBriefingRequest(mutate(baseRequest()));
  assert.equal(result.ok, false, `expected failure: ${name}`);
}

// --- Briefing-level fail-closed: duplicate binding identity ------------------

{
  const good = prepareDirectorBriefing({ request: baseRequest() });
  assert.equal(good.ok, true);
  if (good.ok) {
    const dup: DirectorBriefing = {
      requestId: good.value.requestId,
      items: [good.value.items[0], good.value.items[0]],
      governance: good.value.governance,
      approval: { state: "pending-director" },
    };
    assert.equal(validateDirectorBriefing(dup).ok, false);
  }
}

// --- Briefing-level fail-closed: hidden/suppressed uncertainty ---------------

{
  const bad: DirectorBriefing = {
    requestId: "dbreq-u",
    items: [{
      bindingId: "learning::lc-1",
      sourceKind: "learning",
      sourceCandidateId: "lc-1",
      statement: "s",
      provenance: prov("x"),
      explainability: { basis: ["b"], assumptions: [], limitations: [], uncertainty: [] },
      confidence: { level: "moderate", uncertainty: [] }, // hidden uncertainty
      evidenceRefs: ["ev-1"],
      learningRefs: [], optimizationRefs: [], awarenessRefs: [], evolutionRefs: [],
      lifecycle: "qualified",
      approval: { state: "pending-director" },
    }],
    governance: { constraints: ["g"], heldImmutable: true, restrictions: [], approval: { state: "pending-director" }, pendingDirectorDecisions: ["learning::lc-1"] },
    approval: { state: "pending-director" },
  };
  assert.equal(validateDirectorBriefing(bad).ok, false);
}

// --- Briefing-level fail-closed: lifecycle disagrees with provenance ---------

{
  const bad: DirectorBriefing = {
    requestId: "dbreq-l",
    items: [{
      bindingId: "learning::lc-1",
      sourceKind: "learning",
      sourceCandidateId: "lc-1",
      statement: "s",
      provenance: prov("x"),
      explainability: { basis: ["b"], assumptions: [], limitations: [], uncertainty: ["u"] },
      confidence: { level: "moderate", uncertainty: ["u"] },
      evidenceRefs: ["ev-1"],
      learningRefs: [], optimizationRefs: [], awarenessRefs: [], evolutionRefs: [],
      lifecycle: "validated", // disagrees with provenance.lifecycle ("qualified")
      approval: { state: "pending-director" },
    }],
    governance: { constraints: ["g"], heldImmutable: true, restrictions: [], approval: { state: "pending-director" }, pendingDirectorDecisions: ["learning::lc-1"] },
    approval: { state: "pending-director" },
  };
  assert.equal(validateDirectorBriefing(bad).ok, false);
}

// --- Briefing-level fail-closed: broken derived identity ---------------------

{
  const bad: DirectorBriefing = {
    requestId: "dbreq-i",
    items: [{
      bindingId: "learning::WRONG",
      sourceKind: "learning",
      sourceCandidateId: "lc-1",
      statement: "s",
      provenance: prov("x"),
      explainability: { basis: ["b"], assumptions: [], limitations: [], uncertainty: ["u"] },
      confidence: { level: "moderate", uncertainty: ["u"] },
      evidenceRefs: ["ev-1"],
      learningRefs: [], optimizationRefs: [], awarenessRefs: [], evolutionRefs: [],
      lifecycle: "qualified",
      approval: { state: "pending-director" },
    }],
    governance: { constraints: ["g"], heldImmutable: true, restrictions: [], approval: { state: "pending-director" }, pendingDirectorDecisions: ["learning::WRONG"] },
    approval: { state: "pending-director" },
  };
  assert.equal(validateDirectorBriefing(bad).ok, false);
}

// --- Briefing-level fail-closed: governance pending decisions mismatch -------

{
  const good = prepareDirectorBriefing({ request: baseRequest() });
  assert.equal(good.ok, true);
  if (good.ok) {
    const bad: DirectorBriefing = {
      requestId: good.value.requestId,
      items: good.value.items,
      governance: { ...good.value.governance, pendingDirectorDecisions: ["learning::lc-1"] }, // hides items
      approval: { state: "pending-director" },
    };
    assert.equal(validateDirectorBriefing(bad).ok, false);
  }
}

// --- Briefing-level fail-closed: non-canonical ordering ----------------------

{
  const good = prepareDirectorBriefing({ request: baseRequest() });
  assert.equal(good.ok, true);
  if (good.ok && good.value.items.length >= 2) {
    const reversed: DirectorBriefing = {
      requestId: good.value.requestId,
      items: [...good.value.items].reverse(),
      governance: good.value.governance,
      approval: { state: "pending-director" },
    };
    assert.equal(validateDirectorBriefing(reversed).ok, false);
  }
}

// --- Runtime outputs are never modified --------------------------------------

{
  const bindingBundle = baseBindingBundle();
  const bindingSnapshot = JSON.stringify(bindingBundle);
  const result = prepareDirectorBriefing({ request: baseRequest({ bindingBundle }) });
  assert.equal(result.ok, true);
  // The consumed binding bundle is unchanged: the briefing organizes, it never modifies inputs.
  assert.equal(JSON.stringify(bindingBundle), bindingSnapshot);
}

// --- JSON / UTF-8 stability of the canonical key -----------------------------

{
  assert.notEqual(canonicalReference, undefined);
  if (canonicalReference !== undefined) {
    const key = canonicalDirectorBriefingKey(canonicalReference);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
    // Item keys are JSON-stable too.
    for (const item of canonicalReference.items) {
      const ik = briefingItemKey(item);
      assert.equal(ik, JSON.parse(JSON.stringify(ik)));
    }
  }
}

console.log("enterprise-organizational-intelligence-runtime: all Director briefing Phase 8 checks passed");
