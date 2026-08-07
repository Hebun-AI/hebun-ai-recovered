import assert from "node:assert/strict";
import {
  HEBY_GROUNDING_CAPABILITIES,
  HEBY_GROUNDING_NON_RESPONSIBILITIES,
  HEBY_GROUNDING_STATUS_DESCRIPTORS,
  HEBY_WITHHOLD_REASON_DESCRIPTORS,
  allHebyGroundingStatuses,
  allHebyWithholdReasons,
  canonicalHebyGroundedPresentationKey,
  classifyHebyElementGrounding,
  groundHebyPresentation,
  hebyAdmittedInputIndex,
  isHebyElementGrounded,
  isHebySettledSource,
  normalizeHebyGroundedPresentation,
  validateHebyGroundedPresentation,
  validateHebyGroundingRequest,
  verifyHebyGroundedPresentationFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAdmittedInput,
  HebyDeclaredContext,
  HebyExplanationEntry,
  HebyPresentation,
  HebyPresentationElement,
  HebySourceLifecycle,
} from "../../src/features/heby-core";

// --- Fixtures ----------------------------------------------------------------

function input(id: string, kind: HebyAdmittedInput["kind"], lifecycle: HebySourceLifecycle, eligible: boolean): HebyAdmittedInput {
  return {
    inputId: id,
    kind,
    sourceId: `src-${id}`,
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "director-briefing-assembler",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle,
    },
    eligible,
  };
}

function el(overrides: Partial<HebyPresentationElement> = {}): HebyPresentationElement {
  return {
    elementId: "el-1",
    kind: "evidence",
    statement: "throughput rose in Q2",
    evidenceRefs: ["in-1"],
    confidence: "high",
    uncertainty: [],
    classification: "presentable",
    ...overrides,
  };
}

function context(): HebyDeclaredContext {
  return {
    contextId: "ctx-1",
    role: "director",
    domain: "operations",
    subject: "Q2 review",
    authorityBasis: "director-governed",
    organizationId: "org-1",
    tenantId: "tenant-1",
    constraints: [{ constraintKind: "governance", constraintId: "c-1", statement: "director-governed" }],
  };
}

function inputs(): HebyAdmittedInput[] {
  return [
    input("in-1", "runtime-output", "settled", true),
    input("in-2", "reasoning-understanding", "settled", true),
    input("in-unsettled", "memory-context", "superseded", true),
    input("in-ineligible", "memory-context", "settled", false),
  ];
}

function elements(): HebyPresentationElement[] {
  return [
    el({ elementId: "el-grounded", kind: "evidence", evidenceRefs: ["in-1"] }),
    el({ elementId: "el-grounded-2", kind: "interpretation", statement: "process B drives it", confidence: "moderate", evidenceRefs: ["in-2"] }),
    el({ elementId: "el-nobasis", kind: "interpretation", statement: "unsupported claim", evidenceRefs: [] }),
    el({ elementId: "el-dangling", kind: "evidence", statement: "phantom", evidenceRefs: ["not-admitted"] }),
    el({ elementId: "el-unsettled", kind: "evidence", statement: "stale", evidenceRefs: ["in-unsettled"] }),
    el({ elementId: "el-ineligible", kind: "evidence", statement: "blocked", evidenceRefs: ["in-ineligible"] }),
    el({ elementId: "el-protected", kind: "evidence", statement: "secret", evidenceRefs: ["in-1"], classification: "protected" }),
  ];
}

function explanation(): HebyExplanationEntry[] {
  return [
    { facet: "why", statements: ["surfaced for review"], sourceRefs: ["in-1"] },
    { facet: "sources", statements: ["runtime in-1"], sourceRefs: ["in-1"] },
    { facet: "assumptions", statements: ["ungrounded"], sourceRefs: ["not-admitted"] },
  ];
}

function presentation(overrides: Partial<HebyPresentation> = {}): HebyPresentation {
  return {
    presentationId: "pres-1",
    requestId: "req-1",
    context: context(),
    inputs: inputs(),
    elements: elements(),
    explanation: explanation(),
    ...overrides,
  };
}

function ground(p: HebyPresentation = presentation()) {
  return groundHebyPresentation({ request: { presentation: p } });
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Phase 4 structural integrity --------------------------------------------

run("phase 4 integrity: a well-formed grounding request validates", () => {
  assert.deepEqual(validateHebyGroundingRequest({ presentation: presentation() }), { ok: true });
});

run("phase 4 integrity: grounding splits grounded and withheld", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value.groundedElements.map((e) => e.elementId), ["el-grounded", "el-grounded-2"]);
    assert.equal(r.value.withheld.length, 5);
  }
});

run("phase 4 integrity: statuses and reasons are exactly declared", () => {
  assert.deepEqual(allHebyGroundingStatuses(), ["grounded", "withheld"]);
  assert.deepEqual(allHebyWithholdReasons(), ["no-basis", "dangling-reference", "unsettled-source", "ineligible-source", "protected"]);
});

// --- Grounding integrity: every grounded element has a settled-source trace ---

run("grounding integrity: every grounded element carries a non-empty settled-source trace", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    const traced = new Set(r.value.traces.map((t) => t.elementId));
    for (const e of r.value.groundedElements) {
      assert.ok(traced.has(e.elementId));
      const t = r.value.traces.find((x) => x.elementId === e.elementId);
      assert.ok(t && t.settledSourceRefs.length > 0);
    }
  }
});

run("grounding integrity: withheld reasons are correct and fail-closed", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    const byId = new Map(r.value.withheld.map((w) => [w.element.elementId, w.reason]));
    assert.equal(byId.get("el-nobasis"), "no-basis");
    assert.equal(byId.get("el-dangling"), "dangling-reference");
    assert.equal(byId.get("el-unsettled"), "unsettled-source");
    assert.equal(byId.get("el-ineligible"), "ineligible-source");
    assert.equal(byId.get("el-protected"), "protected");
  }
});

run("grounding integrity: protected information is never in the grounded set", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    for (const e of r.value.groundedElements) assert.equal(e.classification, "presentable");
    assert.ok(!r.value.groundedElements.some((e) => e.elementId === "el-protected"));
  }
});

run("grounding integrity: dangling references never enter the grounded set", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) assert.ok(!r.value.groundedElements.some((e) => e.elementId === "el-dangling"));
});

run("grounding integrity: grounded and withheld sets are disjoint", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    const g = new Set(r.value.groundedElements.map((e) => e.elementId));
    for (const w of r.value.withheld) assert.ok(!g.has(w.element.elementId));
  }
});

// --- Preservation ------------------------------------------------------------

run("input preservation: context/role/domain/subject/authority preserved unchanged", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.context.role, "director");
    assert.equal(r.value.context.domain, "operations");
    assert.equal(r.value.context.subject, "Q2 review");
    assert.equal(r.value.context.authorityBasis, "director-governed");
  }
});

run("constraint preservation: bound constraints preserved unchanged", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.context.constraints[0].constraintKind, "governance");
});

run("provenance / source identity preservation: settled inputs carried unchanged", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    const i1 = r.value.inputs.find((i) => i.inputId === "in-1");
    assert.ok(i1);
    if (i1) {
      assert.equal(i1.sourceId, "src-in-1");
      assert.equal(i1.provenance.version, 1);
      assert.equal(i1.provenance.lifecycle, "settled");
    }
  }
});

run("confidence / uncertainty preservation: grounded element carries its confidence unchanged", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    const e = r.value.groundedElements.find((x) => x.elementId === "el-grounded-2");
    assert.ok(e && e.confidence === "moderate");
  }
});

run("attribution integrity: grounded explanation drops ungrounded facets", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value.explanation.map((e) => e.facet), ["why", "sources"]);
    assert.ok(!r.value.explanation.some((e) => e.facet === "assumptions"));
  }
});

// --- Boundary / capability integrity -----------------------------------------

run("boundary integrity: MAY set is verify/bind/mark/preserve only", () => {
  const may: readonly string[] = HEBY_GROUNDING_CAPABILITIES;
  for (const cap of ["verify-grounding", "trace-to-settled-source", "withhold-unsupported", "preserve-source-identity"]) {
    assert.ok(may.includes(cap));
  }
  for (const forbidden of ["reason", "infer", "retrieve", "generate-content", "inflate-confidence", "decide"]) {
    assert.ok(!may.includes(forbidden));
  }
});

run("boundary integrity: MUST-NEVER forbids invention, inference, retrieval, inflation, decision", () => {
  const mustNever: readonly string[] = HEBY_GROUNDING_NON_RESPONSIBILITIES;
  for (const req of ["generate-content", "alter-meaning", "invent-evidence", "invent-provenance", "dress-unsupported-as-grounded", "reason", "infer", "retrieve", "orchestrate-retrieval", "inflate-confidence", "generate-recommendation", "generate-decision", "decide", "approve", "reject", "execute", "modify-runtime", "modify-memory", "modify-organization", "call-ai", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER are disjoint", () => {
  const prohibited = new Set<string>(HEBY_GROUNDING_NON_RESPONSIBILITIES);
  for (const cap of HEBY_GROUNDING_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

// --- Fail-closed -------------------------------------------------------------

run("fail-closed: an unauthorized context (no authority) blocks grounding", () => {
  const p = presentation({ context: { ...context(), authorityBasis: "" } });
  const r = ground(p);
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("authority")));
});

run("fail-closed: a missing presentationId blocks grounding", () => {
  const r = ground(presentation({ presentationId: "" }));
  assert.ok(!r.ok);
});

run("fail-closed: classify rejects protected/dangling/unsettled/ineligible/no-basis", () => {
  const index = hebyAdmittedInputIndex(inputs());
  assert.equal(classifyHebyElementGrounding(el({ classification: "protected" }), index).status, "withheld");
  assert.equal(classifyHebyElementGrounding(el({ evidenceRefs: [] }), index).status, "withheld");
  assert.equal(classifyHebyElementGrounding(el({ evidenceRefs: ["nope"] }), index).status, "withheld");
  assert.equal(classifyHebyElementGrounding(el({ evidenceRefs: ["in-unsettled"] }), index).status, "withheld");
  assert.equal(classifyHebyElementGrounding(el({ evidenceRefs: ["in-ineligible"] }), index).status, "withheld");
  assert.equal(classifyHebyElementGrounding(el({ evidenceRefs: ["in-1"] }), index).status, "grounded");
});

run("fail-closed: settled-source and grounded helpers agree", () => {
  const index = hebyAdmittedInputIndex(inputs());
  assert.ok(isHebySettledSource(input("x", "runtime-output", "settled", true)));
  assert.ok(!isHebySettledSource(input("x", "runtime-output", "superseded", true)));
  assert.ok(!isHebySettledSource(input("x", "runtime-output", "settled", false)));
  assert.ok(isHebyElementGrounded(el({ evidenceRefs: ["in-1"] }), index));
  assert.ok(!isHebyElementGrounded(el({ evidenceRefs: ["in-unsettled"] }), index));
});

// --- Canonical ordering (arrangement only) -----------------------------------

run("canonical ordering: grounded elements order by category then id, never by confidence", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.groundedElements.map((e) => e.elementId), ["el-grounded", "el-grounded-2"]);
});

run("canonical ordering: withheld order by reason ordinal then id", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value.withheld.map((w) => w.reason), ["no-basis", "dangling-reference", "unsettled-source", "ineligible-source", "protected"]);
  }
});

// --- Idempotent / shuffled-input stability -----------------------------------

run("idempotent normalization: normalizing a canonical grounded presentation is a fixed point", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(normalizeHebyGroundedPresentation(r.value), r.value);
});

run("shuffled-input stability: reordered elements/inputs yield the same grounded presentation", () => {
  const a = ground();
  const b = ground(presentation({ elements: [...elements()].reverse(), inputs: [...inputs()].reverse(), explanation: [...explanation()].reverse() }));
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

// --- Deterministic output ----------------------------------------------------

run("deterministic output: the same request always grounds to the same value", () => {
  const a = ground();
  const b = ground();
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("deterministic output: prepared grounded presentation re-validates", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(validateHebyGroundedPresentation(r.value), { ok: true });
});

// --- Deep freeze / immutable / no input mutation -----------------------------

run("deep freeze: grounded presentation and all collections are frozen", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(verifyHebyGroundedPresentationFrozen(r.value), { ok: true });
    assert.ok(Object.isFrozen(r.value.groundedElements));
    assert.ok(Object.isFrozen(r.value.traces));
    assert.ok(Object.isFrozen(r.value.withheld));
    assert.ok(Object.isFrozen(r.value.inputs[0].provenance));
  }
});

run("deep freeze: descriptor tables are frozen", () => {
  assert.ok(Object.isFrozen(HEBY_GROUNDING_STATUS_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_WITHHOLD_REASON_DESCRIPTORS));
});

run("immutable outputs: mutating a frozen grounded presentation throws", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    assert.throws(() => {
      (r.value.groundedElements as HebyPresentationElement[]).push(el({ elementId: "x" }));
    });
  }
});

run("no input mutation: the source request is not mutated by grounding", () => {
  const p = presentation();
  const before = JSON.stringify(p);
  ground(p);
  assert.equal(JSON.stringify(p), before);
});

// --- JSON / UTF-8 stability --------------------------------------------------

run("JSON stability: canonical key stable across element/input orderings", () => {
  const a = ground();
  const b = ground(presentation({ elements: [...elements()].reverse(), inputs: [...inputs()].reverse() }));
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) {
    assert.equal(canonicalHebyGroundedPresentationKey(a.value), canonicalHebyGroundedPresentationKey(b.value));
  }
});

run("JSON stability: a grounded value round-trips through JSON", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    const revived = JSON.parse(JSON.stringify(r.value)) as import("../../src/features/heby-core").HebyGroundedPresentation;
    assert.deepEqual(normalizeHebyGroundedPresentation(revived), r.value);
  }
});

run("UTF-8 stability: canonical key survives a UTF-8 byte round-trip", () => {
  const r = ground();
  assert.ok(r.ok);
  if (r.ok) {
    const key = canonicalHebyGroundedPresentationKey(r.value);
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
});

console.log("\nheby-grounding: all checks passed.");
