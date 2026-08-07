import assert from "node:assert/strict";
import {
  HEBY_CONSTRAINT_KIND_DESCRIPTORS,
  HEBY_INPUT_CONTEXT_CAPABILITIES,
  HEBY_INPUT_CONTEXT_NON_RESPONSIBILITIES,
  HEBY_INPUT_KIND_DESCRIPTORS,
  HEBY_SOURCE_LIFECYCLE_DESCRIPTORS,
  admitHebyContext,
  allHebyConstraintKinds,
  allHebyInputKinds,
  canonicalHebyContextBindingKey,
  hebyInputIndex,
  hebyInputsOfKind,
  isHebyInputAdmissible,
  isHebyInputKind,
  isHebySourceLifecycleAdmissible,
  normalizeHebyContextBinding,
  validateHebyAdmissionRequest,
  validateHebyContextBinding,
  verifyHebyContextBindingFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAdmissionRequest,
  HebyAdmittedInput,
  HebyConstraint,
  HebyDeclaredContext,
  HebyInputKind,
  HebyProvenance,
} from "../../src/features/heby-core";

// --- Fixtures ----------------------------------------------------------------

function provenance(overrides: Partial<HebyProvenance> = {}): HebyProvenance {
  return {
    source: "organizational-intelligence-runtime",
    attribution: "director-briefing-assembler",
    version: 1,
    effectivePeriod: "2026-08-06T00:00:00.000Z",
    lifecycle: "settled",
    ...overrides,
  };
}

function input(overrides: Partial<HebyAdmittedInput> = {}): HebyAdmittedInput {
  return {
    inputId: "in-1",
    kind: "runtime-output",
    sourceId: "ro-1",
    provenance: provenance(),
    eligible: true,
    ...overrides,
  };
}

function constraint(overrides: Partial<HebyConstraint> = {}): HebyConstraint {
  return {
    constraintKind: "governance",
    constraintId: "c-1",
    statement: "director-governed",
    ...overrides,
  };
}

function context(overrides: Partial<HebyDeclaredContext> = {}): HebyDeclaredContext {
  return {
    contextId: "ctx-1",
    role: "director",
    domain: "operations",
    subject: "Q2 throughput briefing",
    authorityBasis: "director-governed",
    organizationId: "org-1",
    tenantId: "tenant-1",
    constraints: [constraint()],
    ...overrides,
  };
}

function request(overrides: Partial<HebyAdmissionRequest> = {}): HebyAdmissionRequest {
  return {
    requestId: "req-1",
    context: context(),
    inputs: [
      input({ inputId: "in-1", kind: "runtime-output", sourceId: "ro-1" }),
      input({ inputId: "in-2", kind: "reasoning-understanding", sourceId: "ru-1", provenance: provenance({ attribution: "reasoning" }) }),
      input({ inputId: "in-3", kind: "memory-context", sourceId: "mc-1", provenance: provenance({ attribution: "memory" }) }),
    ],
    ...overrides,
  };
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Context integrity -------------------------------------------------------

run("context integrity: a well-formed admission request validates", () => {
  assert.deepEqual(validateHebyAdmissionRequest(request()), { ok: true });
});

run("context integrity: admission binds inputs to the declared context", () => {
  const result = admitHebyContext({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.requestId, "req-1");
    assert.equal(result.value.context.contextId, "ctx-1");
    assert.equal(result.value.context.role, "director");
    assert.equal(result.value.context.authorityBasis, "director-governed");
    assert.equal(result.value.inputs.length, 3);
  }
});

run("context integrity: role/domain/subject/authority/constraints preserved", () => {
  const result = admitHebyContext({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const c = result.value.context;
    assert.equal(c.domain, "operations");
    assert.equal(c.subject, "Q2 throughput briefing");
    assert.equal(c.organizationId, "org-1");
    assert.equal(c.tenantId, "tenant-1");
    assert.equal(c.constraints.length, 1);
    assert.equal(c.constraints[0].constraintKind, "governance");
  }
});

// --- Provenance / source identity preservation -------------------------------

run("session integrity: provenance and source identity are preserved unchanged", () => {
  const result = admitHebyContext({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const ro = result.value.inputs.find((i) => i.inputId === "in-1");
    assert.ok(ro);
    if (ro) {
      assert.equal(ro.sourceId, "ro-1");
      assert.equal(ro.provenance.source, "organizational-intelligence-runtime");
      assert.equal(ro.provenance.version, 1);
      assert.equal(ro.provenance.lifecycle, "settled");
    }
  }
});

// --- Boundary integrity ------------------------------------------------------

run("boundary integrity: the three admissible input kinds are exactly declared", () => {
  assert.deepEqual(allHebyInputKinds(), ["runtime-output", "reasoning-understanding", "memory-context"]);
});

run("boundary integrity: constraint kinds are exactly declared in order", () => {
  assert.deepEqual(allHebyConstraintKinds(), ["governance", "security", "privacy", "classification"]);
});

run("boundary integrity: MAY set is presentation-free and stable", () => {
  const may: readonly string[] = HEBY_INPUT_CONTEXT_CAPABILITIES;
  assert.ok(may.includes("admit-runtime-output"));
  assert.ok(may.includes("bind-context"));
  assert.ok(may.includes("preserve-provenance"));
  // No reasoning/answering/deciding capability may appear in the MAY set.
  for (const forbidden of ["reason", "answer-question", "decide", "approve", "execute", "call-ai"]) {
    assert.ok(!may.includes(forbidden));
  }
});

run("boundary integrity: MUST-NEVER set forbids reasoning, answering, and mutation", () => {
  const mustNever: readonly string[] = HEBY_INPUT_CONTEXT_NON_RESPONSIBILITIES;
  for (const req of ["answer-question", "reason", "generate-response", "decide", "approve", "execute", "mutate-upstream", "modify-runtime", "modify-memory", "modify-organization", "call-ai", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER sets are disjoint", () => {
  const prohibited = new Set<string>(HEBY_INPUT_CONTEXT_NON_RESPONSIBILITIES);
  for (const cap of HEBY_INPUT_CONTEXT_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

run("boundary integrity: membership guards agree with the tables", () => {
  assert.ok(isHebyInputKind("runtime-output"));
  assert.ok(isHebyInputKind("memory-context"));
  assert.ok(!isHebyInputKind("session"));
  assert.ok(isHebySourceLifecycleAdmissible("settled"));
  assert.ok(!isHebySourceLifecycleAdmissible("superseded"));
  assert.ok(!isHebySourceLifecycleAdmissible("retired"));
});

// --- Fail-closed admission ---------------------------------------------------

run("fail-closed: an ineligible input blocks admission", () => {
  const result = admitHebyContext({ request: request({ inputs: [input({ eligible: false })] }) });
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.some((i) => i.includes("eligible")));
});

run("fail-closed: a non-settled (superseded) source blocks admission", () => {
  const result = admitHebyContext({
    request: request({ inputs: [input({ provenance: provenance({ lifecycle: "superseded" }) })] }),
  });
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.some((i) => i.includes("non-settled")));
});

run("fail-closed: an unknown input kind blocks admission", () => {
  const bad = { ...input(), kind: "session" } as unknown as HebyAdmittedInput;
  const result = admitHebyContext({ request: request({ inputs: [bad] }) });
  assert.ok(!result.ok);
});

run("fail-closed: missing provenance version blocks admission", () => {
  const result = admitHebyContext({
    request: request({ inputs: [input({ provenance: provenance({ version: 0 }) })] }),
  });
  assert.ok(!result.ok);
});

run("fail-closed: an unauthorized context (no authority basis) blocks admission", () => {
  const result = admitHebyContext({ request: request({ context: context({ authorityBasis: "" }) }) });
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.some((i) => i.includes("authority")));
});

run("fail-closed: duplicate input identity is rejected", () => {
  const result = admitHebyContext({
    request: request({ inputs: [input({ inputId: "dup" }), input({ inputId: "dup", kind: "memory-context" })] }),
  });
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.some((i) => i.includes("more than once")));
});

run("fail-closed: isHebyInputAdmissible rejects ineligible and stale inputs", () => {
  assert.ok(isHebyInputAdmissible(input()));
  assert.ok(!isHebyInputAdmissible(input({ eligible: false })));
  assert.ok(!isHebyInputAdmissible(input({ provenance: provenance({ lifecycle: "retired" }) })));
});

// --- Canonical ordering ------------------------------------------------------

run("canonical ordering: inputs are ordered by kind ordinal then identity", () => {
  const result = admitHebyContext({
    request: request({
      inputs: [
        input({ inputId: "z", kind: "memory-context", sourceId: "m" }),
        input({ inputId: "a", kind: "runtime-output", sourceId: "r" }),
        input({ inputId: "b", kind: "reasoning-understanding", sourceId: "u" }),
      ],
    }),
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.value.inputs.map((i) => i.kind), [
      "runtime-output",
      "reasoning-understanding",
      "memory-context",
    ]);
  }
});

run("canonical ordering: constraints are ordered by kind ordinal then identity", () => {
  const result = admitHebyContext({
    request: request({
      context: context({
        constraints: [
          constraint({ constraintKind: "classification", constraintId: "c-cl" }),
          constraint({ constraintKind: "governance", constraintId: "c-gov" }),
          constraint({ constraintKind: "privacy", constraintId: "c-pr" }),
        ],
      }),
    }),
  });
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.value.context.constraints.map((c) => c.constraintKind), [
      "governance",
      "privacy",
      "classification",
    ]);
  }
});

// --- Idempotent normalization ------------------------------------------------

run("idempotent normalization: normalizing a canonical binding yields an equal binding", () => {
  const first = admitHebyContext({ request: request() });
  assert.ok(first.ok);
  if (first.ok) {
    const once = first.value;
    const twice = normalizeHebyContextBinding(once);
    assert.deepEqual(twice, once);
  }
});

run("idempotent normalization: duplicate inputs are removed deterministically", () => {
  const dup = input({ inputId: "in-1", kind: "runtime-output" });
  const b = { requestId: "req-1", context: context(), inputs: [dup, dup] };
  const normalized = normalizeHebyContextBinding(b);
  assert.equal(normalized.inputs.length, 1);
});

// --- Deep freeze / immutable outputs -----------------------------------------

run("deep freeze: an admitted binding and all its collections are frozen", () => {
  const result = admitHebyContext({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(verifyHebyContextBindingFrozen(result.value), { ok: true });
    assert.ok(Object.isFrozen(result.value));
    assert.ok(Object.isFrozen(result.value.context));
    assert.ok(Object.isFrozen(result.value.context.constraints));
    assert.ok(Object.isFrozen(result.value.inputs));
    assert.ok(Object.isFrozen(result.value.inputs[0]));
    assert.ok(Object.isFrozen(result.value.inputs[0].provenance));
  }
});

run("deep freeze: descriptor tables are frozen", () => {
  assert.ok(Object.isFrozen(HEBY_INPUT_KIND_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_SOURCE_LIFECYCLE_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_CONSTRAINT_KIND_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_INPUT_KIND_DESCRIPTORS["runtime-output"]));
});

run("immutable outputs: mutating a frozen binding throws in strict mode", () => {
  const result = admitHebyContext({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.throws(() => {
      (result.value.inputs as HebyAdmittedInput[]).push(input({ inputId: "x" }));
    });
    assert.throws(() => {
      (result.value as { requestId: string }).requestId = "hacked";
    });
  }
});

// --- Conversation continuity (deterministic re-admission) --------------------

run("conversation continuity: the same request re-admits to an equal binding", () => {
  const a = admitHebyContext({ request: request() });
  const b = admitHebyContext({ request: request() });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("conversation continuity: reordered inputs yield the same canonical binding", () => {
  const forward = request();
  const reversed = request({ inputs: [...request().inputs].reverse() });
  const a = admitHebyContext({ request: forward });
  const b = admitHebyContext({ request: reversed });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

// --- Deterministic output ----------------------------------------------------

run("deterministic output: validation of a prepared binding is stable", () => {
  const result = admitHebyContext({ request: request() });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(validateHebyContextBinding(result.value), { ok: true });
});

// --- Projections -------------------------------------------------------------

run("projections: inputs index and per-kind filter are read-only and correct", () => {
  const inputs = request().inputs;
  const index = hebyInputIndex(inputs);
  assert.equal(index.size, 3);
  assert.equal(hebyInputsOfKind(inputs, "runtime-output" as HebyInputKind).length, 1);
});

// --- JSON stability ----------------------------------------------------------

run("JSON stability: the canonical key is stable across input orderings", () => {
  const forward = request();
  const reversed = request({ inputs: [...request().inputs].reverse() });
  assert.equal(canonicalHebyContextBindingKey(forward), canonicalHebyContextBindingKey(reversed));
});

run("JSON stability: an admitted binding round-trips through JSON", () => {
  const result = admitHebyContext({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const revived = JSON.parse(JSON.stringify(result.value)) as HebyAdmissionRequest;
    assert.deepEqual(normalizeHebyContextBinding(revived), result.value);
  }
});

// --- UTF-8 stability ---------------------------------------------------------

run("UTF-8 stability: the canonical key survives a UTF-8 byte round-trip", () => {
  const key = canonicalHebyContextBindingKey(request());
  assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
});

console.log("\nheby-input-context: all checks passed.");
