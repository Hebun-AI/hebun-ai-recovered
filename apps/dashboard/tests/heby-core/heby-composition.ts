import assert from "node:assert/strict";
import {
  CANONICAL_HEBY_IDENTITY,
  HEBY_COMPOSITION_CAPABILITIES,
  HEBY_COMPOSITION_NON_RESPONSIBILITIES,
  HEBY_COMPOSITION_PHASE_DESCRIPTORS,
  allHebyCompositionPhases,
  canonicalHebyCompositionKey,
  composeHebyInterface,
  isHebyCompositionPhase,
  normalizeHebyComposition,
  validateHebyComposition,
  verifyHebyCompositionFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAdmissionRequest,
  HebyAdmittedInput,
  HebyBriefingFinding,
  HebyBriefingHistory,
  HebyCarriedQuestion,
  HebyComposition,
  HebyCompositionRequest,
  HebyCompositionStage,
  HebyDeclaredContext,
  HebyExplanationEntry,
  HebyPreparedItem,
  HebyPresentationElement,
  HebyProposedIntent,
  HebyRecordedDecision,
  HebyUtterance,
} from "../../src/features/heby-core";

// --- Fixtures ----------------------------------------------------------------

function input(id: string, kind: HebyAdmittedInput["kind"], eligible = true): HebyAdmittedInput {
  return { inputId: id, kind, sourceId: `src-${id}`, provenance: { source: "organizational-intelligence-runtime", attribution: "director-briefing-assembler", version: 1, effectivePeriod: "2026-08-06T00:00:00.000Z", lifecycle: "settled" }, eligible };
}

function element(id: string, kind: HebyPresentationElement["kind"], refs: readonly string[]): HebyPresentationElement {
  return { elementId: id, kind, statement: `${id} statement`, evidenceRefs: refs, confidence: "high", uncertainty: [], classification: "presentable" };
}

function context(overrides: Partial<HebyDeclaredContext> = {}): HebyDeclaredContext {
  return { contextId: "ctx-1", role: "director", domain: "operations", subject: "Q2 review", authorityBasis: "director-governed", organizationId: "org-1", tenantId: "tenant-1", constraints: [{ constraintKind: "governance", constraintId: "c-1", statement: "director-governed" }], ...overrides };
}

function admission(overrides: Partial<HebyAdmissionRequest> = {}): HebyAdmissionRequest {
  return { requestId: "req-1", context: context(), inputs: [input("in-1", "runtime-output"), input("in-2", "reasoning-understanding")], ...overrides };
}

const ELEMENTS: readonly HebyPresentationElement[] = [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-2"])];
const EXPLANATION: readonly HebyExplanationEntry[] = [{ facet: "why", statements: ["surfaced for review"], sourceRefs: ["in-1"] }];
const UTTERANCE: HebyUtterance = { utteranceId: "utt-1", text: "prepare Q2 spend for approval" };

function proposed(overrides: Partial<HebyProposedIntent> = {}): HebyProposedIntent {
  return { intentId: "int-1", utteranceId: "utt-1", disposition: "resolved", requestedCapability: "prepare-information", routedElementRefs: ["el-a", "el-b"], clarification: null, ...overrides };
}

function item(overrides: Partial<HebyPreparedItem> = {}): HebyPreparedItem {
  return { itemId: "item-1", kind: "approval", intentId: "int-1", subjectRefs: ["el-a"], decisionState: "pending", consequences: ["commits Q2 spend"], ...overrides };
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

function request(overrides: Partial<HebyCompositionRequest> = {}): HebyCompositionRequest {
  return {
    identity: CANONICAL_HEBY_IDENTITY,
    admission: admission(),
    presentationId: "pres-1",
    elements: ELEMENTS,
    explanation: EXPLANATION,
    utterance: UTTERANCE,
    proposed: proposed(),
    items: [item()],
    findings: [finding()],
    history: [history()],
    questions: [question()],
    decisions: [decision()],
    ...overrides,
  };
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Full-path composition integrity -----------------------------------------

run("phase 9 integrity: the full path composes end-to-end", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok, r.ok ? "" : r.issues.join("; "));
  if (r.ok) {
    assert.equal(r.value.contextId, "ctx-1");
    assert.equal(r.value.presentationId, "pres-1");
    assert.equal(r.value.intentId, "int-1");
    assert.equal(r.value.scope.tenantId, "tenant-1");
    assert.equal(r.value.stages.length, 8);
    assert.equal(r.value.briefing.termination.terminatesAtDirector, true);
  }
});

run("phase 9 integrity: phases are exactly the eight boundary stages, canonical order", () => {
  assert.deepEqual(allHebyCompositionPhases(), ["identity", "context", "presentation", "grounding", "intent", "approval", "governance", "briefing"]);
});

run("full-path replay: the stage ledger records each phase's artifact identity", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const byPhase = new Map(r.value.stages.map((s) => [s.phase, s.artifactId]));
    assert.equal(byPhase.get("identity"), CANONICAL_HEBY_IDENTITY.identity);
    assert.equal(byPhase.get("context"), "ctx-1");
    assert.equal(byPhase.get("presentation"), "pres-1");
    assert.equal(byPhase.get("grounding"), "pres-1");
    assert.equal(byPhase.get("intent"), "int-1");
    assert.equal(byPhase.get("approval"), "int-1");
    assert.equal(byPhase.get("governance"), "pres-1");
    assert.equal(byPhase.get("briefing"), "pres-1");
  }
});

// --- Cross-phase identity / context integrity --------------------------------

run("identity integrity: the composition carries the immutable canonical identity", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.identity.identity, CANONICAL_HEBY_IDENTITY.identity);
    assert.ok(Object.isFrozen(r.value.identity));
  }
});

run("context integrity: context threads unchanged into the briefing", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.briefing.context.contextId, "ctx-1");
    assert.equal(r.value.briefing.context.authorityBasis, "director-governed");
    assert.equal(r.value.briefing.scope.organizationId, "org-1");
  }
});

// --- Fail-closed under named failure modes -----------------------------------

run("fail-closed: a malformed identity fails the whole composition", () => {
  const broken = { ...CANONICAL_HEBY_IDENTITY, name: "" as (typeof CANONICAL_HEBY_IDENTITY)["name"] };
  const r = composeHebyInterface({ request: request({ identity: broken }) });
  assert.ok(!r.ok);
});

run("fail-closed: an ineligible admitted input fails at the context stage", () => {
  const r = composeHebyInterface({ request: request({ admission: admission({ inputs: [input("in-1", "runtime-output", false), input("in-2", "reasoning-understanding")] }) }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.startsWith("context:")));
});

run("fail-closed: a capability outside identity fails at the intent stage", () => {
  const r = composeHebyInterface({ request: request({ proposed: proposed({ requestedCapability: "approve" as HebyProposedIntent["requestedCapability"] }) }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.startsWith("intent:")));
});

run("fail-closed: a prepared item outside the routing fails at the approval stage", () => {
  const r = composeHebyInterface({ request: request({ items: [item({ subjectRefs: ["el-unrouted"] })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.startsWith("approval:")));
});

run("fail-closed: a finding on a non-admitted subject fails at the briefing stage", () => {
  const r = composeHebyInterface({ request: request({ findings: [finding({ subjectRefs: ["el-missing"] })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.startsWith("briefing:")));
});

// --- Cross-phase inconsistency fails closed (defensive validators) -----------

run("fail-closed: a tampered contextId fails composition validation", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const tampered: HebyComposition = { ...r.value, contextId: "ctx-tampered" };
    assert.ok(!validateHebyComposition(tampered).ok);
  }
});

run("fail-closed: a tampered stage artifact identity fails composition validation", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const stages: HebyCompositionStage[] = r.value.stages.map((s) => (s.phase === "governance" ? { phase: s.phase, artifactId: "wrong" } : s));
    assert.ok(!validateHebyComposition({ ...r.value, stages }).ok);
  }
});

run("fail-closed: a dropped stage fails composition validation", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const stages = r.value.stages.filter((s) => s.phase !== "briefing");
    assert.ok(!validateHebyComposition({ ...r.value, stages }).ok);
  }
});

run("fail-closed: a tampered briefing scope fails composition validation", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const tampered: HebyComposition = { ...r.value, scope: { tenantId: "tenant-x", organizationId: "org-1" } };
    assert.ok(!validateHebyComposition(tampered).ok);
  }
});

// --- Audit completeness / recorded-decision preservation / termination -------

run("audit completeness: the composed briefing covers every carried subject", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.briefing.audit.length, 2 + 1 + 1 + 1 + 1 + 1);
});

run("recorded decision preservation: recorded state carried unchanged through composition", () => {
  const r = composeHebyInterface({ request: request({ decisions: [decision({ recordedState: "approved-by-director" })] }) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.briefing.decisions[0].recordedState, "approved-by-director");
});

run("human termination: the composition terminates at the Director", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.briefing.termination.terminatesAtDirector, true);
    assert.equal(r.value.briefing.termination.authorityBasis, "director-governed");
  }
});

// --- Preservation ------------------------------------------------------------

run("preservation: provenance/confidence/uncertainty preserved on composed elements", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const a = r.value.briefing.elements.find((e) => e.elementId === "el-a");
    assert.ok(a);
    assert.deepEqual(a.evidenceRefs, ["in-1"]);
    assert.equal(a.confidence, "high");
    assert.equal(a.classification, "presentable");
  }
});

run("preservation: constraints carried unchanged through composition", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.briefing.constraints.length, 1);
    assert.equal(r.value.briefing.constraints[0].constraintId, "c-1");
  }
});

// --- Boundary / capability integrity -----------------------------------------

run("boundary integrity: MAY set is composing/verifying/recording/preserving only", () => {
  const may: readonly string[] = HEBY_COMPOSITION_CAPABILITIES;
  for (const cap of ["compose-interface", "replay-path", "verify-cross-phase", "record-stage-ledger", "terminate-at-director"]) assert.ok(may.includes(cap));
  for (const forbidden of ["decide", "approve", "execute", "introduce-execution-path", "gain-autonomy"]) assert.ok(!may.includes(forbidden));
});

run("boundary integrity: MUST-NEVER forbids new authority, execution, hidden state, autonomy", () => {
  const mustNever: readonly string[] = HEBY_COMPOSITION_NON_RESPONSIBILITIES;
  for (const req of ["approve", "reject", "decide", "resolve-decision", "advance-past-director", "execute", "introduce-execution-path", "trigger-workflow", "orchestrate", "hold-hidden-state", "gain-autonomy", "regenerate-phase-output", "reinterpret-phase-output", "invent", "fabricate-confidence", "suppress-uncertainty", "waive-governance", "reinterpret-security", "call-ai", "trust-ai-output", "modify-runtime", "modify-memory", "modify-reasoning", "modify-organization", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER are disjoint", () => {
  const prohibited = new Set<string>(HEBY_COMPOSITION_NON_RESPONSIBILITIES);
  for (const cap of HEBY_COMPOSITION_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

run("boundary integrity: membership guard agrees with the table", () => {
  assert.ok(isHebyCompositionPhase("identity"));
  assert.ok(isHebyCompositionPhase("briefing"));
  assert.ok(!isHebyCompositionPhase("execution"));
});

// --- Idempotent / deterministic / replayable ---------------------------------

run("idempotent normalization: normalizing a canonical composition is a fixed point", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(normalizeHebyComposition(r.value), r.value);
});

run("replayable: the same request always composes the same value", () => {
  const a = composeHebyInterface({ request: request() });
  const b = composeHebyInterface({ request: request() });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("shuffled-input stability: reordered elements yield the same composition", () => {
  const a = composeHebyInterface({ request: request({ elements: [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-2"])] }) });
  const b = composeHebyInterface({ request: request({ elements: [element("el-b", "recommendation", ["in-2"]), element("el-a", "evidence", ["in-1"])] }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("canonical ordering: normalization orders a shuffled stage ledger by phase", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const reversed: HebyComposition = { ...r.value, stages: [...r.value.stages].reverse() };
    const normalized = normalizeHebyComposition(reversed);
    assert.deepEqual(normalized.stages.map((s) => s.phase), ["identity", "context", "presentation", "grounding", "intent", "approval", "governance", "briefing"]);
  }
});

// --- Deep freeze / immutable / no input mutation -----------------------------

run("deep freeze: composition and its ledger are frozen", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(verifyHebyCompositionFrozen(r.value), { ok: true });
    assert.ok(Object.isFrozen(r.value));
    assert.ok(Object.isFrozen(r.value.stages));
    assert.ok(Object.isFrozen(r.value.scope));
    assert.ok(Object.isFrozen(r.value.briefing));
  }
});

run("deep freeze: phase descriptor table is frozen", () => {
  assert.ok(Object.isFrozen(HEBY_COMPOSITION_PHASE_DESCRIPTORS));
});

run("immutable outputs: mutating a frozen composition ledger throws", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.throws(() => { (r.value.stages as HebyCompositionStage[]).push({ phase: "identity", artifactId: "x" }); });
});

run("no input mutation: the source request is not mutated by composition", () => {
  const req = request();
  const before = JSON.stringify(req);
  composeHebyInterface({ request: req });
  assert.equal(JSON.stringify(req), before);
});

// --- JSON / UTF-8 stability --------------------------------------------------

run("JSON stability: canonical key stable across element orderings", () => {
  const a = composeHebyInterface({ request: request({ elements: [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-2"])] }) });
  const b = composeHebyInterface({ request: request({ elements: [element("el-b", "recommendation", ["in-2"]), element("el-a", "evidence", ["in-1"])] }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.equal(canonicalHebyCompositionKey(a.value), canonicalHebyCompositionKey(b.value));
});

run("reconstruction: a composition value round-trips through JSON", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const revived = JSON.parse(JSON.stringify(r.value)) as HebyComposition;
    assert.deepEqual(normalizeHebyComposition(revived), r.value);
  }
});

run("UTF-8 stability: canonical key survives a UTF-8 byte round-trip", () => {
  const r = composeHebyInterface({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const key = canonicalHebyCompositionKey(r.value);
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
});

console.log("\nheby-composition: all checks passed.");
