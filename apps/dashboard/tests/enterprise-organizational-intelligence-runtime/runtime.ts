import assert from "node:assert/strict";
import {
  RUNTIME_APPROVAL_STATE_DESCRIPTORS,
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_CAPABILITIES,
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_DEPENDENCY_KIND_DESCRIPTORS,
  RUNTIME_FAILURE_KIND_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
  RUNTIME_NON_RESPONSIBILITIES,
  RUNTIME_RESTRICTION_DESCRIPTORS,
  RUNTIME_STAGE_DESCRIPTORS,
  RUNTIME_STATUS_DESCRIPTORS,
  canonicalRuntimeRequestKey,
  normalizeRuntimeRequest,
  prepareRuntimeRequest,
  runtimeArtifactsOf,
  runtimeFailureIsFailClosed,
  runtimeReachesRequiredDependencies,
  runtimeRequiredDependencyKinds,
  runtimeSummaryOf,
  validateRuntimeRequest,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  RuntimeCandidate,
  RuntimeRequest,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

function baseRequest(overrides: Partial<RuntimeRequest> = {}): RuntimeRequest {
  return {
    requestId: "req-1",
    context: {
      purpose: "assemble organizational intelligence briefing",
      scope: { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] },
      organizationId: "org-1",
      tenantId: "tenant-1",
      authorityBasis: "director-governed",
      dependencies: [
        { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
        { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
        { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
      ],
    },
    targets: ["learning", "optimization"],
    stages: ["input", "context", "output"],
    ...overrides,
  };
}

// --- Descriptor tables are frozen and immutable ------------------------------

for (const table of [
  RUNTIME_STAGE_DESCRIPTORS,
  RUNTIME_LIFECYCLE_STATE_DESCRIPTORS,
  RUNTIME_STATUS_DESCRIPTORS,
  RUNTIME_CANDIDATE_KIND_DESCRIPTORS,
  RUNTIME_DEPENDENCY_KIND_DESCRIPTORS,
  RUNTIME_FAILURE_KIND_DESCRIPTORS,
  RUNTIME_RESTRICTION_DESCRIPTORS,
  RUNTIME_CONFIDENCE_LEVEL_DESCRIPTORS,
  RUNTIME_APPROVAL_STATE_DESCRIPTORS,
]) {
  assert.equal(Object.isFrozen(table), true);
}
assert.equal(Object.isFrozen(RUNTIME_STAGE_DESCRIPTORS.input), true);
assert.equal(Object.isFrozen(RUNTIME_CANDIDATE_KIND_DESCRIPTORS.learning), true);
assert.equal(Object.isFrozen(RUNTIME_CAPABILITIES), true);
assert.equal(Object.isFrozen(RUNTIME_NON_RESPONSIBILITIES), true);

// --- Canonical ordering is contiguous and unique -----------------------------

function assertContiguousOrders(orders: readonly number[]): void {
  const sorted = [...orders].sort((left, right) => left - right);
  for (let index = 0; index < sorted.length; index += 1) {
    assert.equal(sorted[index], index);
  }
}
assertContiguousOrders(Object.values(RUNTIME_STAGE_DESCRIPTORS).map((descriptor) => descriptor.order));
assertContiguousOrders(Object.values(RUNTIME_LIFECYCLE_STATE_DESCRIPTORS).map((descriptor) => descriptor.order));
assertContiguousOrders(Object.values(RUNTIME_STATUS_DESCRIPTORS).map((descriptor) => descriptor.order));
assertContiguousOrders(Object.values(RUNTIME_CANDIDATE_KIND_DESCRIPTORS).map((descriptor) => descriptor.order));
assertContiguousOrders(Object.values(RUNTIME_DEPENDENCY_KIND_DESCRIPTORS).map((descriptor) => descriptor.order));
assertContiguousOrders(Object.values(RUNTIME_FAILURE_KIND_DESCRIPTORS).map((descriptor) => descriptor.order));

// --- Non-responsibilities model every prohibited capability ------------------

for (const forbidden of [
  "decide",
  "approve",
  "execute",
  "change-memory",
  "change-reasoning",
  "change-organization",
  "plan-work",
  "trigger-workflow",
  "call-ai",
  "call-llm",
  "schedule-job",
  "invoke-api",
  "modify-persistence",
  "control-ui",
  "act-autonomously",
] as const) {
  assert.equal(RUNTIME_NON_RESPONSIBILITIES.includes(forbidden), true);
}
// No capability the Runtime MAY do overlaps a capability it MUST NEVER do.
const forbiddenSet = new Set<string>(RUNTIME_NON_RESPONSIBILITIES);
for (const capability of RUNTIME_CAPABILITIES) {
  assert.equal(forbiddenSet.has(capability), false);
}
// The approval boundary: the Runtime can only ever represent a pending Director decision.
assert.deepEqual(Object.keys(RUNTIME_APPROVAL_STATE_DESCRIPTORS), ["pending-director"]);

// --- Every candidate kind requires an evidence basis -------------------------

for (const descriptor of Object.values(RUNTIME_CANDIDATE_KIND_DESCRIPTORS)) {
  assert.equal(descriptor.requiresBasis, true);
  assert.equal(descriptor.sourcePhase >= 44 && descriptor.sourcePhase <= 47, true);
}

// --- Every failure kind is fail-closed ---------------------------------------

for (const descriptor of Object.values(RUNTIME_FAILURE_KIND_DESCRIPTORS)) {
  assert.equal(runtimeFailureIsFailClosed(descriptor.failureKind), true);
}

// --- Required dependencies ---------------------------------------------------

assert.deepEqual(runtimeRequiredDependencyKinds(), [
  "memory-context",
  "reasoning-understanding",
  "organization-assembly",
]);
assert.equal(runtimeReachesRequiredDependencies(baseRequest()), true);

// --- Validation: a well-formed request passes --------------------------------

assert.deepEqual(validateRuntimeRequest(baseRequest()), { ok: true });

// --- Validation: missing required dependency fails closed --------------------

{
  const result = validateRuntimeRequest(
    baseRequest({
      context: {
        ...baseRequest().context,
        dependencies: [{ dependencyKind: "memory-context", referenceId: "mc-1", version: 1 }],
      },
    }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.issues.some((issue) => issue.includes("omits required dependencies")),
      true,
    );
  }
}

// --- Validation: duplicate dependency kind is rejected -----------------------

{
  const result = validateRuntimeRequest(
    baseRequest({
      context: {
        ...baseRequest().context,
        dependencies: [
          { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
          { dependencyKind: "memory-context", referenceId: "mc-2", version: 2 },
          { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
          { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
        ],
      },
    }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.issues.some((issue) => issue.includes("declared more than once")), true);
  }
}

// --- Validation: empty required fields fail closed ---------------------------

for (const mutate of [
  (request: RuntimeRequest): RuntimeRequest => ({ ...request, requestId: "" }),
  (request: RuntimeRequest): RuntimeRequest => ({
    ...request,
    context: { ...request.context, purpose: "  " },
  }),
  (request: RuntimeRequest): RuntimeRequest => ({
    ...request,
    context: { ...request.context, organizationId: "" },
  }),
  (request: RuntimeRequest): RuntimeRequest => ({ ...request, targets: [] }),
  (request: RuntimeRequest): RuntimeRequest => ({ ...request, stages: [] }),
]) {
  assert.equal(validateRuntimeRequest(mutate(baseRequest())).ok, false);
}

// --- Validation: non-positive-integer version fails closed -------------------

{
  const result = validateRuntimeRequest(
    baseRequest({
      context: {
        ...baseRequest().context,
        dependencies: [
          { dependencyKind: "memory-context", referenceId: "mc-1", version: 0 },
          { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
          { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
        ],
      },
    }),
  );
  assert.equal(result.ok, false);
}

// --- Normalization: canonical ordering + de-duplication ----------------------

{
  const shuffled = baseRequest({
    context: {
      ...baseRequest().context,
      scope: { scopeId: "scope-1", statement: "full", domains: ["dom-fin", "dom-ops", "dom-fin"] },
      dependencies: [
        { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
        { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
        { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
      ],
    },
    targets: ["optimization", "learning", "optimization"],
    stages: ["output", "input", "context", "input"],
  });
  const canonical = normalizeRuntimeRequest(shuffled);

  // Dependencies ordered by canonical dependency order.
  assert.deepEqual(
    canonical.context.dependencies.map((dependency) => dependency.dependencyKind),
    ["memory-context", "reasoning-understanding", "organization-assembly"],
  );
  // Domains de-duplicated and totally ordered.
  assert.deepEqual(canonical.context.scope.domains, ["dom-fin", "dom-ops"]);
  // Targets de-duplicated and canonically ordered.
  assert.deepEqual(canonical.targets, ["learning", "optimization"]);
  // Stages de-duplicated and canonically ordered.
  assert.deepEqual(canonical.stages, ["input", "context", "output"]);

  // Frozen throughout.
  assert.equal(Object.isFrozen(canonical), true);
  assert.equal(Object.isFrozen(canonical.context), true);
  assert.equal(Object.isFrozen(canonical.context.scope), true);
}

// --- Normalization is deterministic and idempotent ---------------------------

{
  const once = normalizeRuntimeRequest(baseRequest());
  const twice = normalizeRuntimeRequest(once);
  assert.deepEqual(once, twice);
  assert.equal(canonicalRuntimeRequestKey(once), canonicalRuntimeRequestKey(twice));
}

// --- Boundary: prepare validates then canonicalizes --------------------------

{
  const ok = prepareRuntimeRequest({ request: baseRequest() });
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.requestId, "req-1");
    assert.equal(Object.isFrozen(ok.value), true);
  }

  const bad = prepareRuntimeRequest({ request: baseRequest({ requestId: "" }) });
  assert.equal(bad.ok, false);
}

// --- Summary + artifacts: deterministic projections --------------------------

{
  const provenance = {
    source: "runtime",
    attribution: "org-intelligence-runtime",
    version: 1,
    effectivePeriod: "2026-08-06T00:00:00.000Z",
    lifecycle: "qualified" as const,
  };
  const explainability = { basis: ["ev-1"], assumptions: [], limitations: [], uncertainty: ["bounded"] };
  const confidence = { level: "moderate" as const, uncertainty: ["bounded"] };
  const candidates: readonly RuntimeCandidate[] = [
    { candidateId: "c-1", candidateKind: "learning", statement: "a", provenance, explainability, confidence },
    { candidateId: "c-2", candidateKind: "learning", statement: "b", provenance, explainability, confidence },
    { candidateId: "c-3", candidateKind: "optimization", statement: "c", provenance, explainability, confidence },
  ];
  const summary = runtimeSummaryOf(candidates);
  assert.equal(summary.total, 3);
  assert.equal(summary.counts.learning, 2);
  assert.equal(summary.counts.optimization, 1);
  assert.equal(summary.counts["evolution-pathway"], 0);

  const artifacts = runtimeArtifactsOf(normalizeRuntimeRequest(baseRequest()), candidates);
  assert.equal(artifacts.filter((artifact) => artifact.kind === "dependency").length, 3);
  assert.equal(artifacts.filter((artifact) => artifact.kind === "candidate").length, 3);
}

// --- UTF-8 / JSON stability of the canonical key -----------------------------

{
  const canonical = normalizeRuntimeRequest(baseRequest());
  const key = canonicalRuntimeRequestKey(canonical);
  assert.equal(key, JSON.parse(JSON.stringify(key)));
  assert.equal(key.includes(" "), false);
  assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
}

console.log("enterprise-organizational-intelligence-runtime: all runtime Phase 1 checks passed");
