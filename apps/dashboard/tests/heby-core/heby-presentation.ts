import assert from "node:assert/strict";
import {
  HEBY_CONFIDENCE_LEVEL_DESCRIPTORS,
  HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS,
  HEBY_EXPLANATION_FACET_DESCRIPTORS,
  HEBY_PRESENTATION_CAPABILITIES,
  HEBY_PRESENTATION_KIND_DESCRIPTORS,
  HEBY_PRESENTATION_NON_RESPONSIBILITIES,
  allHebyExplanationFacets,
  allHebyPresentationKinds,
  canonicalHebyPresentationKey,
  hebyElementsOfKind,
  isHebyElementHonestlyMarked,
  isHebyElementPresentable,
  isHebyPresentationKind,
  normalizeHebyPresentation,
  presentHebyMaterial,
  validateHebyPresentation,
  validateHebyPresentationRequest,
  verifyHebyPresentationFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAdmittedInput,
  HebyContextBinding,
  HebyExplanationEntry,
  HebyPresentationElement,
  HebyPresentationKind,
  HebyPresentationRequest,
} from "../../src/features/heby-core";

// --- Fixtures ----------------------------------------------------------------

function admittedInput(overrides: Partial<HebyAdmittedInput> = {}): HebyAdmittedInput {
  return {
    inputId: "in-1",
    kind: "runtime-output",
    sourceId: "ro-1",
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "director-briefing-assembler",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle: "settled",
    },
    eligible: true,
    ...overrides,
  };
}

function binding(): HebyContextBinding {
  return {
    requestId: "req-1",
    context: {
      contextId: "ctx-1",
      role: "director",
      domain: "operations",
      subject: "Q2 throughput briefing",
      authorityBasis: "director-governed",
      organizationId: "org-1",
      tenantId: "tenant-1",
      constraints: [{ constraintKind: "governance", constraintId: "c-1", statement: "director-governed" }],
    },
    inputs: [
      admittedInput({ inputId: "in-1", kind: "runtime-output", sourceId: "ro-1" }),
      admittedInput({ inputId: "in-2", kind: "reasoning-understanding", sourceId: "ru-1" }),
      admittedInput({ inputId: "in-3", kind: "memory-context", sourceId: "mc-1" }),
    ],
  };
}

function element(overrides: Partial<HebyPresentationElement> = {}): HebyPresentationElement {
  return {
    elementId: "el-ev",
    kind: "evidence",
    statement: "throughput rose in Q2",
    evidenceRefs: ["in-1"],
    confidence: "high",
    uncertainty: [],
    classification: "presentable",
    ...overrides,
  };
}

function elements(): HebyPresentationElement[] {
  return [
    element({ elementId: "el-ev", kind: "evidence", confidence: "high", evidenceRefs: ["in-1"] }),
    element({ elementId: "el-in", kind: "interpretation", statement: "process B is the driver", confidence: "moderate", evidenceRefs: ["in-2"] }),
    element({ elementId: "el-rec", kind: "recommendation", statement: "consider expanding process B", confidence: "low", evidenceRefs: ["in-1", "in-2"], uncertainty: ["depends on staffing"] }),
    element({ elementId: "el-un", kind: "uncertainty", statement: "staffing data is incomplete", confidence: "indeterminate", evidenceRefs: ["in-3"], uncertainty: ["records partial"] }),
    element({ elementId: "el-dec", kind: "decision", statement: "expansion decision pending Director", confidence: "high", evidenceRefs: ["in-1"] }),
  ];
}

function explanation(): HebyExplanationEntry[] {
  return [
    { facet: "why", statements: ["surfaced for Q2 review"], sourceRefs: ["in-1"] },
    { facet: "sources", statements: ["runtime output ro-1", "memory mc-1"], sourceRefs: ["in-1", "in-3"] },
    { facet: "uncertainty", statements: ["staffing partial"], sourceRefs: ["in-3"] },
  ];
}

function request(overrides: Partial<HebyPresentationRequest> = {}): HebyPresentationRequest {
  return {
    presentationId: "pres-1",
    binding: binding(),
    elements: elements(),
    explanation: explanation(),
    ...overrides,
  };
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Phase 3 integrity -------------------------------------------------------

run("phase 3 integrity: a well-formed presentation request validates", () => {
  assert.deepEqual(validateHebyPresentationRequest(request()), { ok: true });
});

run("phase 3 integrity: presentation composes and distinguishes the five kinds", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.value.elements.map((e) => e.kind), [
      "evidence",
      "interpretation",
      "recommendation",
      "uncertainty",
      "decision",
    ]);
  }
});

run("phase 3 integrity: the five presentation kinds are exactly declared in category order", () => {
  assert.deepEqual(allHebyPresentationKinds(), ["evidence", "interpretation", "recommendation", "uncertainty", "decision"]);
});

run("phase 3 integrity: the six explanation facets are exactly declared in order", () => {
  assert.deepEqual(allHebyExplanationFacets(), ["why", "evidence", "sources", "assumptions", "uncertainty", "what-changed"]);
});

// --- Input / provenance / source identity / authority / constraint preservation ---

run("input preservation: the bound context is carried unchanged", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.context.contextId, "ctx-1");
    assert.equal(result.value.requestId, "req-1");
  }
});

run("provenance preservation: admitted-input provenance travels with the presentation", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const ro = result.value.inputs.find((i) => i.inputId === "in-1");
    assert.ok(ro);
    if (ro) {
      assert.equal(ro.provenance.source, "organizational-intelligence-runtime");
      assert.equal(ro.provenance.version, 1);
      assert.equal(ro.provenance.lifecycle, "settled");
    }
  }
});

run("source identity preservation: carried input sourceIds are unchanged", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.value.inputs.map((i) => i.sourceId), ["ro-1", "ru-1", "mc-1"]);
  }
});

run("authority preservation: the authority basis is carried unchanged", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.value.context.authorityBasis, "director-governed");
});

run("constraint preservation: bound constraints are carried unchanged", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.context.constraints.length, 1);
    assert.equal(result.value.context.constraints[0].constraintKind, "governance");
  }
});

run("uncertainty preservation: marked uncertainty is carried on low/indeterminate elements", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const rec = result.value.elements.find((e) => e.elementId === "el-rec");
    const un = result.value.elements.find((e) => e.elementId === "el-un");
    assert.ok(rec && rec.uncertainty.includes("depends on staffing"));
    assert.ok(un && un.uncertainty.includes("records partial"));
  }
});

// --- Boundary / capability integrity -----------------------------------------

run("boundary integrity: MAY set is presentational and stable", () => {
  const may: readonly string[] = HEBY_PRESENTATION_CAPABILITIES;
  for (const cap of ["compose-explanation", "distinguish-uncertainty", "attach-provenance", "preserve-source-identity"]) {
    assert.ok(may.includes(cap));
  }
  for (const forbidden of ["decide", "approve", "reject", "execute", "reason", "invent-rationale", "call-ai"]) {
    assert.ok(!may.includes(forbidden));
  }
});

run("boundary integrity: MUST-NEVER set forbids invention, exposure, decision, and reasoning", () => {
  const mustNever: readonly string[] = HEBY_PRESENTATION_NON_RESPONSIBILITIES;
  for (const req of ["invent-rationale", "expose-protected-information", "prescribe-implementation", "assert-beyond-confidence", "decide", "approve", "reject", "execute", "reason", "modify-runtime", "modify-memory", "modify-organization", "call-ai", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER are disjoint", () => {
  const prohibited = new Set<string>(HEBY_PRESENTATION_NON_RESPONSIBILITIES);
  for (const cap of HEBY_PRESENTATION_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

run("boundary integrity: membership guards agree with the tables", () => {
  assert.ok(isHebyPresentationKind("evidence"));
  assert.ok(isHebyPresentationKind("decision"));
  assert.ok(!isHebyPresentationKind("verdict"));
});

// --- Fail-closed behavior ----------------------------------------------------

run("fail-closed: a protected element is never exposed", () => {
  const result = presentHebyMaterial({ request: request({ elements: [element({ classification: "protected" })] }) });
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.some((i) => i.includes("protected")));
});

run("fail-closed: an element not attributable to admitted inputs is blocked", () => {
  const result = presentHebyMaterial({ request: request({ elements: [element({ evidenceRefs: ["not-admitted"] })] }) });
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.some((i) => i.includes("attributable")));
});

run("fail-closed: an element with no evidence basis is blocked", () => {
  const result = presentHebyMaterial({ request: request({ elements: [element({ evidenceRefs: [] })] }) });
  assert.ok(!result.ok);
});

run("fail-closed: low confidence without marked uncertainty is blocked", () => {
  const result = presentHebyMaterial({ request: request({ elements: [element({ confidence: "low", uncertainty: [] })] }) });
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.some((i) => i.includes("confidence")));
});

run("fail-closed: an unknown presentation kind is blocked", () => {
  const bad = { ...element(), kind: "verdict" } as unknown as HebyPresentationElement;
  const result = presentHebyMaterial({ request: request({ elements: [bad] }) });
  assert.ok(!result.ok);
});

run("fail-closed: an explanation facet not attributable to admitted sources is blocked", () => {
  const result = presentHebyMaterial({
    request: request({ explanation: [{ facet: "why", statements: ["x"], sourceRefs: ["nope"] }] }),
  });
  assert.ok(!result.ok);
});

run("fail-closed: an invalid Phase 2 binding blocks the presentation", () => {
  const bad = binding();
  const result = presentHebyMaterial({
    request: request({ binding: { ...bad, inputs: [admittedInput({ eligible: false })] } }),
  });
  assert.ok(!result.ok);
});

run("fail-closed: helpers reject protected and dishonest elements", () => {
  assert.ok(isHebyElementPresentable(element()));
  assert.ok(!isHebyElementPresentable(element({ classification: "protected" })));
  assert.ok(isHebyElementHonestlyMarked(element({ confidence: "high", uncertainty: [] })));
  assert.ok(!isHebyElementHonestlyMarked(element({ confidence: "low", uncertainty: [] })));
});

// --- Canonical ordering (never ranking) --------------------------------------

run("canonical ordering: elements order by category then id, never by confidence", () => {
  // Two evidence elements with descending confidence; order must follow id, not confidence.
  const result = presentHebyMaterial({
    request: request({
      elements: [
        element({ elementId: "el-b", kind: "evidence", confidence: "low", uncertainty: ["u"] }),
        element({ elementId: "el-a", kind: "evidence", confidence: "high" }),
      ],
    }),
  });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.value.elements.map((e) => e.elementId), ["el-a", "el-b"]);
});

run("canonical ordering: explanation entries order by facet ordinal", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.value.explanation.map((e) => e.facet), ["why", "sources", "uncertainty"]);
});

// --- Idempotent normalization / shuffled-input stability ---------------------

run("idempotent normalization: normalizing a canonical presentation is a fixed point", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(normalizeHebyPresentation(result.value), result.value);
});

run("shuffled-input stability: reordered elements yield the same canonical presentation", () => {
  const a = presentHebyMaterial({ request: request() });
  const b = presentHebyMaterial({ request: request({ elements: [...elements()].reverse(), explanation: [...explanation()].reverse() }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

// --- Deterministic output ----------------------------------------------------

run("deterministic output: the same request always presents the same value", () => {
  const a = presentHebyMaterial({ request: request() });
  const b = presentHebyMaterial({ request: request() });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("deterministic output: prepared presentation re-validates against admitted ids", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const ids = new Set(result.value.inputs.map((i) => i.inputId));
    assert.deepEqual(validateHebyPresentation(result.value, ids), { ok: true });
  }
});

// --- Deep freeze / immutable outputs / no input mutation ---------------------

run("deep freeze: presentation and all its collections are frozen", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(verifyHebyPresentationFrozen(result.value), { ok: true });
    assert.ok(Object.isFrozen(result.value.elements));
    assert.ok(Object.isFrozen(result.value.elements[0]));
    assert.ok(Object.isFrozen(result.value.elements[0].evidenceRefs));
    assert.ok(Object.isFrozen(result.value.inputs[0].provenance));
    assert.ok(Object.isFrozen(result.value.explanation[0]));
  }
});

run("deep freeze: descriptor tables are frozen", () => {
  assert.ok(Object.isFrozen(HEBY_PRESENTATION_KIND_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_CONFIDENCE_LEVEL_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_ELEMENT_CLASSIFICATION_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_EXPLANATION_FACET_DESCRIPTORS));
});

run("immutable outputs: mutating a frozen presentation throws in strict mode", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    assert.throws(() => {
      (result.value.elements as HebyPresentationElement[]).push(element({ elementId: "x" }));
    });
  }
});

run("no input mutation: the source request is not mutated by presentation", () => {
  const req = request();
  const before = JSON.stringify(req);
  presentHebyMaterial({ request: req });
  assert.equal(JSON.stringify(req), before);
});

// --- Projections -------------------------------------------------------------

run("projections: elements-of-kind filters correctly", () => {
  assert.equal(hebyElementsOfKind(elements(), "recommendation" as HebyPresentationKind).length, 1);
});

// --- JSON stability ----------------------------------------------------------

run("JSON stability: the canonical key is stable across element orderings", () => {
  const forward = presentHebyMaterial({ request: request() });
  const reversed = presentHebyMaterial({
    request: request({ elements: [...elements()].reverse(), explanation: [...explanation()].reverse() }),
  });
  assert.ok(forward.ok && reversed.ok);
  if (forward.ok && reversed.ok) {
    assert.equal(canonicalHebyPresentationKey(forward.value), canonicalHebyPresentationKey(reversed.value));
  }
});

run("JSON stability: a presented value round-trips through JSON", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const revived = JSON.parse(JSON.stringify(result.value)) as import("../../src/features/heby-core").HebyPresentation;
    assert.deepEqual(normalizeHebyPresentation(revived), result.value);
  }
});

// --- UTF-8 stability ---------------------------------------------------------

run("UTF-8 stability: the canonical key survives a UTF-8 byte round-trip", () => {
  const result = presentHebyMaterial({ request: request() });
  assert.ok(result.ok);
  if (result.ok) {
    const key = canonicalHebyPresentationKey(result.value);
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
});

console.log("\nheby-presentation: all checks passed.");
