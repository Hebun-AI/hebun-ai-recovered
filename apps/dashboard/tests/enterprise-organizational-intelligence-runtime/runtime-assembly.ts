import assert from "node:assert/strict";
import {
  RUNTIME_ASSEMBLY_CAPABILITIES,
  RUNTIME_ASSEMBLY_NON_RESPONSIBILITIES,
  RUNTIME_FOUNDATION_KIND_DESCRIPTORS,
  assembleRuntimeBundle,
  canonicalRuntimeBundleKey,
  normalizeRuntimeAssembly,
  normalizeRuntimeBundle,
  normalizeRuntimeFoundationSources,
  openRuntimeAssemblySession,
  resolveRuntimeFoundationSources,
  runtimeFoundationDependencyKindOf,
  runtimeReachesAllFoundations,
  runtimeRequiredFoundationKinds,
  validateRuntimeAssemblyRequest,
  validateRuntimeBundle,
} from "../../src/features/enterprise-organizational-intelligence-runtime";
import type {
  RuntimeAssemblyRequest,
  RuntimeBundle,
  RuntimeContext,
} from "../../src/features/enterprise-organizational-intelligence-runtime";

function baseContext(overrides: Partial<RuntimeContext> = {}): RuntimeContext {
  return {
    purpose: "assemble the three published foundations into one runtime context",
    scope: { scopeId: "scope-1", statement: "full", domains: ["dom-ops", "dom-fin"] },
    organizationId: "org-1",
    tenantId: "tenant-1",
    authorityBasis: "director-governed",
    dependencies: [
      { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
      { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
      { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
    ],
    ...overrides,
  };
}

function baseRequest(overrides: Partial<RuntimeAssemblyRequest> = {}): RuntimeAssemblyRequest {
  return { requestId: "areq-1", context: baseContext(), ...overrides };
}

// --- Foundation descriptor table is frozen and immutable ---------------------

assert.equal(Object.isFrozen(RUNTIME_FOUNDATION_KIND_DESCRIPTORS), true);
assert.equal(Object.isFrozen(RUNTIME_FOUNDATION_KIND_DESCRIPTORS["enterprise-memory"]), true);
assert.equal(Object.isFrozen(RUNTIME_ASSEMBLY_CAPABILITIES), true);
assert.equal(Object.isFrozen(RUNTIME_ASSEMBLY_NON_RESPONSIBILITIES), true);

// --- Canonical ordering is contiguous and unique -----------------------------

{
  const orders = Object.values(RUNTIME_FOUNDATION_KIND_DESCRIPTORS)
    .map((descriptor) => descriptor.order)
    .sort((left, right) => left - right);
  for (let index = 0; index < orders.length; index += 1) assert.equal(orders[index], index);
}

// --- The three foundations map one-to-one onto the three dependency kinds -----

assert.deepEqual(runtimeRequiredFoundationKinds(), [
  "enterprise-memory",
  "enterprise-memory-reasoning",
  "enterprise-organizational-intelligence",
]);
assert.equal(runtimeFoundationDependencyKindOf("enterprise-memory"), "memory-context");
assert.equal(runtimeFoundationDependencyKindOf("enterprise-memory-reasoning"), "reasoning-understanding");
assert.equal(
  runtimeFoundationDependencyKindOf("enterprise-organizational-intelligence"),
  "organization-assembly",
);
{
  const dependencyKinds = new Set(
    runtimeRequiredFoundationKinds().map((kind) => runtimeFoundationDependencyKindOf(kind)),
  );
  assert.equal(dependencyKinds.size, 3);
}

// --- Non-responsibilities model every prohibited capability ------------------

for (const forbidden of [
  "reason",
  "learn",
  "optimize",
  "assess-awareness",
  "evolve",
  "orchestrate",
  "decide",
  "approve",
  "execute",
  "plan-work",
  "trigger-workflow",
  "call-ai",
  "call-llm",
  "schedule-job",
  "invoke-api",
  "modify-persistence",
  "control-ui",
  "change-foundation",
  "act-autonomously",
] as const) {
  assert.equal(RUNTIME_ASSEMBLY_NON_RESPONSIBILITIES.includes(forbidden), true);
}
// No capability the assembly MAY do overlaps a capability it MUST NEVER do.
{
  const forbiddenSet = new Set<string>(RUNTIME_ASSEMBLY_NON_RESPONSIBILITIES);
  for (const capability of RUNTIME_ASSEMBLY_CAPABILITIES) {
    assert.equal(forbiddenSet.has(capability), false);
  }
}

// --- Dependency resolution ---------------------------------------------------

{
  const sources = resolveRuntimeFoundationSources(baseContext());
  assert.deepEqual(
    sources.map((source) => source.foundationKind),
    ["enterprise-memory", "enterprise-memory-reasoning", "enterprise-organizational-intelligence"],
  );
  // Each source is pinned, unchanged, to the dependency it resolved from.
  assert.deepEqual(sources.map((source) => source.referenceId), ["mc-1", "ru-1", "oa-1"]);
  assert.equal(runtimeReachesAllFoundations(baseContext()), true);
}

// Resolution is order-independent: shuffled dependencies resolve to canonical order.
{
  const shuffled = baseContext({
    dependencies: [
      { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 3 },
      { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
      { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 2 },
    ],
  });
  assert.deepEqual(
    resolveRuntimeFoundationSources(shuffled).map((source) => source.foundationKind),
    ["enterprise-memory", "enterprise-memory-reasoning", "enterprise-organizational-intelligence"],
  );
}

// A missing foundation does not resolve.
{
  const partial = baseContext({
    dependencies: [{ dependencyKind: "memory-context", referenceId: "mc-1", version: 1 }],
  });
  assert.equal(resolveRuntimeFoundationSources(partial).length, 1);
  assert.equal(runtimeReachesAllFoundations(partial), false);
}

// --- Validation: a well-formed request passes --------------------------------

assert.deepEqual(validateRuntimeAssemblyRequest(baseRequest()), { ok: true });

// --- Validation: missing required foundation fails closed --------------------

{
  const result = validateRuntimeAssemblyRequest(
    baseRequest({
      context: baseContext({
        dependencies: [
          { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
          { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
        ],
      }),
    }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(
      result.issues.some((issue) => issue.includes("omits required foundations")),
      true,
    );
  }
}

// --- Validation: duplicate dependency kind is rejected -----------------------

{
  const result = validateRuntimeAssemblyRequest(
    baseRequest({
      context: baseContext({
        dependencies: [
          { dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
          { dependencyKind: "memory-context", referenceId: "mc-2", version: 2 },
          { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
          { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
        ],
      }),
    }),
  );
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.issues.some((issue) => issue.includes("declared more than once")), true);
  }
}

// --- Validation: empty required fields and bad versions fail closed ----------

for (const mutate of [
  (request: RuntimeAssemblyRequest): RuntimeAssemblyRequest => ({ ...request, requestId: "" }),
  (request: RuntimeAssemblyRequest): RuntimeAssemblyRequest => ({
    ...request,
    context: { ...request.context, purpose: "  " },
  }),
  (request: RuntimeAssemblyRequest): RuntimeAssemblyRequest => ({
    ...request,
    context: { ...request.context, organizationId: "" },
  }),
  (request: RuntimeAssemblyRequest): RuntimeAssemblyRequest => ({
    ...request,
    context: {
      ...request.context,
      scope: { ...request.context.scope, domains: [] },
    },
  }),
  (request: RuntimeAssemblyRequest): RuntimeAssemblyRequest => ({
    ...request,
    context: {
      ...request.context,
      dependencies: [
        { dependencyKind: "memory-context", referenceId: "mc-1", version: 0 },
        { dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
        { dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
      ],
    },
  }),
]) {
  assert.equal(validateRuntimeAssemblyRequest(mutate(baseRequest())).ok, false);
}

// --- Assembly: boundary validates, resolves, composes, freezes ---------------

{
  const result = assembleRuntimeBundle({ request: baseRequest(), bundleId: "bundle-1" });
  assert.equal(result.ok, true);
  if (result.ok) {
    const bundle = result.value;
    assert.equal(bundle.bundleId, "bundle-1");
    assert.equal(bundle.lifecycle, "bound");
    // Exactly the three foundations, canonically ordered.
    assert.deepEqual(
      bundle.assembly.sources.map((source) => source.foundationKind),
      ["enterprise-memory", "enterprise-memory-reasoning", "enterprise-organizational-intelligence"],
    );
    // Assembly is bound to the same organization / tenant / scope as its context.
    assert.equal(bundle.assembly.organizationId, bundle.context.organizationId);
    assert.equal(bundle.assembly.tenantId, bundle.context.tenantId);
    assert.equal(bundle.assembly.scope.scopeId, bundle.context.scope.scopeId);
    // A built bundle passes bundle validation.
    assert.deepEqual(validateRuntimeBundle(bundle), { ok: true });
    // Frozen throughout.
    assert.equal(Object.isFrozen(bundle), true);
    assert.equal(Object.isFrozen(bundle.context), true);
    assert.equal(Object.isFrozen(bundle.context.scope), true);
    assert.equal(Object.isFrozen(bundle.assembly), true);
    assert.equal(Object.isFrozen(bundle.assembly.scope), true);
  }
}

// --- Assembly: an ill-formed request yields issues and no bundle -------------

{
  const bad = assembleRuntimeBundle({ request: baseRequest({ requestId: "" }), bundleId: "bundle-x" });
  assert.equal(bad.ok, false);
}

// --- Normalization: canonical ordering + de-duplication ----------------------

{
  const sources = normalizeRuntimeFoundationSources([
    { foundationKind: "enterprise-organizational-intelligence", dependencyKind: "organization-assembly", referenceId: "oa-1", version: 1 },
    { foundationKind: "enterprise-memory", dependencyKind: "memory-context", referenceId: "mc-1", version: 1 },
    { foundationKind: "enterprise-memory", dependencyKind: "memory-context", referenceId: "mc-2", version: 2 },
    { foundationKind: "enterprise-memory-reasoning", dependencyKind: "reasoning-understanding", referenceId: "ru-1", version: 1 },
  ]);
  // De-duplicated by foundation kind (first wins), canonically ordered.
  assert.deepEqual(sources.map((source) => source.referenceId), ["mc-1", "ru-1", "oa-1"]);

  const assembly = normalizeRuntimeAssembly({
    organizationId: "org-1",
    tenantId: "tenant-1",
    scope: { scopeId: "scope-1", statement: "full", domains: ["dom-fin", "dom-ops", "dom-fin"] },
    sources: resolveRuntimeFoundationSources(baseContext()),
  });
  assert.deepEqual(assembly.scope.domains, ["dom-fin", "dom-ops"]);
}

// --- Normalization is deterministic and idempotent ---------------------------

{
  const assembled = assembleRuntimeBundle({ request: baseRequest(), bundleId: "bundle-1" });
  assert.equal(assembled.ok, true);
  if (assembled.ok) {
    const once = normalizeRuntimeBundle(assembled.value);
    const twice = normalizeRuntimeBundle(once);
    assert.deepEqual(once, twice);
    assert.equal(canonicalRuntimeBundleKey(once), canonicalRuntimeBundleKey(twice));
  }
}

// --- Bundle validation: a tampered bundle fails closed -----------------------

{
  const base = assembleRuntimeBundle({ request: baseRequest(), bundleId: "bundle-1" });
  assert.equal(base.ok, true);
  if (base.ok) {
    // Assembly organization drifts from its context.
    const drifted: RuntimeBundle = {
      ...base.value,
      assembly: { ...base.value.assembly, organizationId: "org-2" },
    };
    const driftResult = validateRuntimeBundle(drifted);
    assert.equal(driftResult.ok, false);
    if (!driftResult.ok) {
      assert.equal(driftResult.issues.some((issue) => issue.includes("does not match its context")), true);
    }
    // Wrong lifecycle state.
    const unbound: RuntimeBundle = { ...base.value, lifecycle: "declared" };
    assert.equal(validateRuntimeBundle(unbound).ok, false);
    // A missing foundation source.
    const short: RuntimeBundle = {
      ...base.value,
      assembly: { ...base.value.assembly, sources: base.value.assembly.sources.slice(0, 2) },
    };
    assert.equal(validateRuntimeBundle(short).ok, false);
  }
}

// --- Session: a freshly opened session is declared and pending ---------------

{
  const session = openRuntimeAssemblySession("sess-1", baseRequest());
  assert.equal(session.sessionId, "sess-1");
  assert.equal(session.requestId, "areq-1");
  assert.equal(session.status, "pending");
  assert.equal(session.lifecycle, "declared");
  assert.equal(Object.isFrozen(session), true);
}

// --- UTF-8 / JSON stability of the canonical key -----------------------------

{
  const assembled = assembleRuntimeBundle({ request: baseRequest(), bundleId: "bundle-1" });
  assert.equal(assembled.ok, true);
  if (assembled.ok) {
    const key = canonicalRuntimeBundleKey(assembled.value);
    assert.equal(key, JSON.parse(JSON.stringify(key)));
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
}

console.log("enterprise-organizational-intelligence-runtime: all runtime assembly Phase 2 checks passed");
