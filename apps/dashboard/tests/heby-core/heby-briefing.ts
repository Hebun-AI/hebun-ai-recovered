import assert from "node:assert/strict";
import {
  CANONICAL_HEBY_IDENTITY,
  HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS,
  HEBY_BRIEFING_CAPABILITIES,
  HEBY_BRIEFING_NON_RESPONSIBILITIES,
  HEBY_BRIEFING_SECTION_DESCRIPTORS,
  allHebyAuditSubjectKinds,
  allHebyBriefingSections,
  assembleHebyBriefing,
  canonicalHebyDirectorBriefingKey,
  hebyRefsWithinAdmitted,
  isHebyAuditSubjectKind,
  isHebyBriefingSection,
  normalizeHebyDirectorBriefing,
  validateHebyBriefingRequest,
  validateHebyDirectorBriefing,
  verifyHebyDirectorBriefingFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAuditEntry,
  HebyBriefingFinding,
  HebyBriefingHistory,
  HebyBriefingRequest,
  HebyBriefingSection,
  HebyCarriedQuestion,
  HebyConstraint,
  HebyDeclaredContext,
  HebyDirectorBriefing,
  HebyGatedPresentation,
  HebyPreparedItem,
  HebyPresentationElement,
  HebyRecordedDecision,
} from "../../src/features/heby-core";

// --- Fixtures ----------------------------------------------------------------

function element(id: string, kind: HebyPresentationElement["kind"], refs: readonly string[]): HebyPresentationElement {
  return { elementId: id, kind, statement: `${id} statement`, evidenceRefs: refs, confidence: "high", uncertainty: [], classification: "presentable" };
}

function item(id: string, subjectRefs: readonly string[]): HebyPreparedItem {
  return { itemId: id, kind: "approval", intentId: "int-1", subjectRefs, decisionState: "pending", consequences: ["a consequence"] };
}

const CONSTRAINT: HebyConstraint = { constraintKind: "governance", constraintId: "c-1", statement: "director-governed" };

function context(overrides: Partial<HebyDeclaredContext> = {}): HebyDeclaredContext {
  return { contextId: "ctx-1", role: "director", domain: "operations", subject: "Q2 review", authorityBasis: "director-governed", organizationId: "org-1", tenantId: "tenant-1", constraints: [CONSTRAINT], ...overrides };
}

function rawGated(overrides: Partial<HebyGatedPresentation> = {}): HebyGatedPresentation {
  return {
    presentationId: "pres-1",
    intentId: "int-1",
    scope: { tenantId: "tenant-1", organizationId: "org-1" },
    context: context(),
    constraints: [CONSTRAINT],
    admittedElements: [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-2"])],
    admittedItems: [item("item-1", ["el-a"])],
    blocks: [],
    ...overrides,
  };
}

function finding(overrides: Partial<HebyBriefingFinding> = {}): HebyBriefingFinding {
  return { findingId: "f-1", section: "evidence", statement: "throughput rose", subjectRefs: ["el-a"], sourceRefs: ["in-1"], ...overrides };
}

function history(overrides: Partial<HebyBriefingHistory> = {}): HebyBriefingHistory {
  return { historyId: "h-1", priorRef: "pres-0", statement: "prior throughput was lower", subjectRefs: ["el-a"], ...overrides };
}

function question(overrides: Partial<HebyCarriedQuestion> = {}): HebyCarriedQuestion {
  return { questionId: "q-1", question: "why did throughput rise?", subjectRefs: ["el-a"], ...overrides };
}

function decision(overrides: Partial<HebyRecordedDecision> = {}): HebyRecordedDecision {
  return { decisionId: "d-1", recordedState: "recorded-by-director", basisRefs: ["el-a"], supersedesRef: null, ...overrides };
}

function request(overrides: Partial<HebyBriefingRequest> = {}): HebyBriefingRequest {
  return { identity: CANONICAL_HEBY_IDENTITY, gated: rawGated(), findings: [finding()], history: [history()], questions: [question()], decisions: [decision()], ...overrides };
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Phase 8 structural integrity --------------------------------------------

run("phase 8 integrity: a well-formed request assembles a briefing", () => {
  assert.deepEqual(validateHebyBriefingRequest(request()), { ok: true });
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.presentationId, "pres-1");
    assert.equal(r.value.intentId, "int-1");
    assert.equal(r.value.elements.length, 2);
    assert.equal(r.value.items.length, 1);
    assert.equal(r.value.findings.length, 1);
    assert.equal(r.value.termination.terminatesAtDirector, true);
  }
});

run("phase 8 integrity: sections are exactly the six advisory sections, canonical order", () => {
  assert.deepEqual(allHebyBriefingSections(), ["evidence", "reasoning", "risk", "opportunity", "option", "uncertainty"]);
});

run("phase 8 integrity: audit subject kinds are exactly declared in canonical order", () => {
  assert.deepEqual(allHebyAuditSubjectKinds(), ["element", "item", "finding", "history", "question", "decision"]);
});

// --- A presented finding is never an approval --------------------------------

run("finding is never approval: no section is approval or decision", () => {
  const sections: readonly string[] = allHebyBriefingSections();
  for (const forbidden of ["approval", "decision", "approve"]) assert.ok(!sections.includes(forbidden));
});

run("finding is never approval: an unknown section fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ findings: [finding({ section: "approval" as HebyBriefingSection })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("unknown section")));
});

// --- Full audit trail --------------------------------------------------------

run("full audit: the audit covers every carried subject exactly", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    // 2 elements + 1 item + 1 finding + 1 history + 1 question + 1 decision = 7
    assert.equal(r.value.audit.length, 7);
    const kinds = r.value.audit.map((a) => `${a.subjectKind}:${a.subjectId}`);
    for (const key of ["element:el-a", "element:el-b", "item:item-1", "finding:f-1", "history:h-1", "question:q-1", "decision:d-1"]) {
      assert.ok(kinds.includes(key), `audit missing ${key}`);
    }
  }
});

run("full audit: assembly builds the trail — a tampered incomplete trail fails post-validation", () => {
  // The boundary always builds a complete trail; prove the defensive validator rejects a gap.
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const gapped: HebyDirectorBriefing = { ...r.value, audit: r.value.audit.filter((a) => a.subjectId !== "el-b") };
    const v = validateHebyDirectorBriefing(gapped);
    assert.ok(!v.ok);
  }
});

// --- No path advances past a human decision ----------------------------------

run("no advance: the briefing terminates at the Director with visible authority", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.termination.terminatesAtDirector, true);
    assert.equal(r.value.termination.authorityBasis, "director-governed");
  }
});

run("no advance: a recorded decision is carried unchanged, not resolved by Heby", () => {
  const r = assembleHebyBriefing({ request: request({ decisions: [decision({ recordedState: "approved-by-director" })] }) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.decisions[0].recordedState, "approved-by-director");
});

// --- Recorded decisions: immutable except by attributable supersession -------

run("supersession: an attributable supersession is admitted", () => {
  const r = assembleHebyBriefing({ request: request({ decisions: [decision({ decisionId: "d-1" }), decision({ decisionId: "d-2", supersedesRef: "d-1" })] }) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.decisions.length, 2);
});

run("supersession: superseding an absent decision fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ decisions: [decision({ decisionId: "d-2", supersedesRef: "d-absent" })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("unattributable")));
});

run("supersession: a self-supersession fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ decisions: [decision({ decisionId: "d-1", supersedesRef: "d-1" })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("supersedes itself")));
});

run("supersession: superseding the same target twice fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ decisions: [decision({ decisionId: "d-1" }), decision({ decisionId: "d-2", supersedesRef: "d-1" }), decision({ decisionId: "d-3", supersedesRef: "d-1" })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("superseded more than once")));
});

// --- History: prior state immutable, never fabricated, never missing ---------

run("history: a history entry with no prior reference fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ history: [history({ priorRef: "" })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("no prior reference")));
});

run("history: a history entry on a non-admitted subject fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ history: [history({ subjectRefs: ["el-missing"] })] }) });
  assert.ok(!r.ok);
});

// --- Attribution: everything rests on the admitted surface -------------------

run("attribution: a finding on a non-admitted subject fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ findings: [finding({ subjectRefs: ["el-missing"] })] }) });
  assert.ok(!r.ok);
});

run("attribution: a question on a non-admitted subject fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ questions: [question({ subjectRefs: ["el-missing"] })] }) });
  assert.ok(!r.ok);
});

run("attribution: a decision on a non-admitted basis fails closed", () => {
  const r = assembleHebyBriefing({ request: request({ decisions: [decision({ basisRefs: ["el-missing"] })] }) });
  assert.ok(!r.ok);
});

run("attribution: containment helper is fail-closed on empty and foreign refs", () => {
  const admitted = new Set(["el-a", "el-b"]);
  assert.ok(hebyRefsWithinAdmitted(["el-a"], admitted));
  assert.ok(!hebyRefsWithinAdmitted(["el-a", "x"], admitted));
  assert.ok(!hebyRefsWithinAdmitted([], admitted));
});

// --- Preservation ------------------------------------------------------------

run("preservation: context, authority, scope, constraints carried unchanged", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.context.role, "director");
    assert.equal(r.value.context.authorityBasis, "director-governed");
    assert.equal(r.value.scope.tenantId, "tenant-1");
    assert.equal(r.value.scope.organizationId, "org-1");
    assert.equal(r.value.constraints[0].constraintKind, "governance");
  }
});

run("preservation: element provenance/confidence/uncertainty carried unchanged", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const a = r.value.elements.find((e) => e.elementId === "el-a");
    assert.ok(a);
    assert.deepEqual(a.evidenceRefs, ["in-1"]);
    assert.equal(a.confidence, "high");
    assert.equal(a.classification, "presentable");
  }
});

// --- Boundary / capability integrity -----------------------------------------

run("boundary integrity: MAY set is assembling/presenting/carrying/preserving only", () => {
  const may: readonly string[] = HEBY_BRIEFING_CAPABILITIES;
  for (const cap of ["assemble-briefing", "present-finding", "carry-history", "carry-question", "carry-decision", "build-audit", "terminate-at-director"]) assert.ok(may.includes(cap));
  for (const forbidden of ["decide", "approve", "resolve-decision", "execute", "author-ui"]) assert.ok(!may.includes(forbidden));
});

run("boundary integrity: MUST-NEVER forbids decide, resolve, invent-causality, fabricate-history, ui", () => {
  const mustNever: readonly string[] = HEBY_BRIEFING_NON_RESPONSIBILITIES;
  for (const req of ["decide", "approve", "reject", "resolve-decision", "advance-past-director", "execute", "trigger-workflow", "orchestrate", "author-ui", "invent", "invent-causality", "fabricate-confidence", "fabricate-history", "suppress-uncertainty", "call-ai", "trust-ai-output", "modify-runtime", "modify-memory", "modify-reasoning", "modify-organization", "waive-governance", "reinterpret-security", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER are disjoint", () => {
  const prohibited = new Set<string>(HEBY_BRIEFING_NON_RESPONSIBILITIES);
  for (const cap of HEBY_BRIEFING_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

run("boundary integrity: membership guards agree with the tables", () => {
  assert.ok(isHebyBriefingSection("evidence"));
  assert.ok(isHebyBriefingSection("uncertainty"));
  assert.ok(!isHebyBriefingSection("approval"));
  assert.ok(isHebyAuditSubjectKind("decision"));
  assert.ok(!isHebyAuditSubjectKind("workflow"));
});

// --- Fail-closed on malformed request ----------------------------------------

run("fail-closed: a malformed identity fails the assembly", () => {
  const broken = { ...CANONICAL_HEBY_IDENTITY, name: "" as (typeof CANONICAL_HEBY_IDENTITY)["name"] };
  const r = assembleHebyBriefing({ request: request({ identity: broken }) });
  assert.ok(!r.ok);
});

run("fail-closed: duplicate finding ids fail closed", () => {
  const r = assembleHebyBriefing({ request: request({ findings: [finding({ findingId: "dup" }), finding({ findingId: "dup", section: "risk" })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("more than once")));
});

// --- Canonical ordering ------------------------------------------------------

run("canonical ordering: findings ordered by section then identity, arrangement only", () => {
  const findings = [finding({ findingId: "f-z", section: "uncertainty" }), finding({ findingId: "f-a", section: "evidence" }), finding({ findingId: "f-b", section: "evidence" })];
  const r = assembleHebyBriefing({ request: request({ findings }) });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.findings.map((f) => f.findingId), ["f-a", "f-b", "f-z"]);
});

run("canonical ordering: audit ordered by subject kind then identity", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const kinds = r.value.audit.map((a) => a.subjectKind);
    // element(s) before item before finding before history before question before decision
    assert.equal(kinds.indexOf("element") < kinds.indexOf("item"), true);
    assert.equal(kinds.indexOf("item") < kinds.indexOf("finding"), true);
    assert.equal(kinds.indexOf("finding") < kinds.indexOf("decision"), true);
  }
});

// --- Idempotent / deterministic ----------------------------------------------

run("idempotent normalization: normalizing a canonical briefing is a fixed point", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(normalizeHebyDirectorBriefing(r.value), r.value);
});

run("deterministic output: the same request always assembles the same value", () => {
  const a = assembleHebyBriefing({ request: request() });
  const b = assembleHebyBriefing({ request: request() });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("shuffled-input stability: reordered findings yield the same briefing", () => {
  const a = assembleHebyBriefing({ request: request({ findings: [finding({ findingId: "f-1" }), finding({ findingId: "f-2", section: "risk" })] }) });
  const b = assembleHebyBriefing({ request: request({ findings: [finding({ findingId: "f-2", section: "risk" }), finding({ findingId: "f-1" })] }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

// --- Deep freeze / immutable / no input mutation -----------------------------

run("deep freeze: briefing and its collections are frozen", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(verifyHebyDirectorBriefingFrozen(r.value), { ok: true });
    assert.ok(Object.isFrozen(r.value));
    assert.ok(Object.isFrozen(r.value.findings));
    assert.ok(Object.isFrozen(r.value.audit));
    assert.ok(Object.isFrozen(r.value.decisions));
    assert.ok(Object.isFrozen(r.value.termination));
  }
});

run("deep freeze: descriptor tables are frozen", () => {
  assert.ok(Object.isFrozen(HEBY_BRIEFING_SECTION_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_AUDIT_SUBJECT_KIND_DESCRIPTORS));
});

run("immutable outputs: mutating a frozen briefing throws", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.throws(() => { (r.value.audit as HebyAuditEntry[]).push({ subjectKind: "element", subjectId: "x" }); });
});

run("no input mutation: the source request is not mutated by assembly", () => {
  const req = request();
  const before = JSON.stringify(req);
  assembleHebyBriefing({ request: req });
  assert.equal(JSON.stringify(req), before);
});

// --- JSON / UTF-8 stability --------------------------------------------------

run("JSON stability: canonical key stable across finding orderings", () => {
  const a = assembleHebyBriefing({ request: request({ findings: [finding({ findingId: "f-1" }), finding({ findingId: "f-2", section: "risk" })] }) });
  const b = assembleHebyBriefing({ request: request({ findings: [finding({ findingId: "f-2", section: "risk" }), finding({ findingId: "f-1" })] }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.equal(canonicalHebyDirectorBriefingKey(a.value), canonicalHebyDirectorBriefingKey(b.value));
});

run("JSON stability: a briefing value round-trips through JSON", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const revived = JSON.parse(JSON.stringify(r.value)) as HebyDirectorBriefing;
    assert.deepEqual(normalizeHebyDirectorBriefing(revived), r.value);
  }
});

run("UTF-8 stability: canonical key survives a UTF-8 byte round-trip", () => {
  const r = assembleHebyBriefing({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const key = canonicalHebyDirectorBriefingKey(r.value);
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
});

console.log("\nheby-briefing: all checks passed.");
