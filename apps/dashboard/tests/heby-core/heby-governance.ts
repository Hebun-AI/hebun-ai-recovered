import assert from "node:assert/strict";
import {
  CANONICAL_HEBY_IDENTITY,
  HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS,
  HEBY_GOVERNANCE_CAPABILITIES,
  HEBY_GOVERNANCE_NON_RESPONSIBILITIES,
  HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS,
  allHebyGovernanceBlockReasons,
  allHebyGovernanceSubjectKinds,
  canonicalHebyGatedPresentationKey,
  gateHebyPresentation,
  groundHebyPresentation,
  hebyGovernanceBlockReasonConstraintKind,
  hebyScopeMismatchReason,
  hebyScopesMatch,
  interpretHebyIntent,
  isHebyGovernanceBlockReason,
  isHebyGovernanceSubjectKind,
  normalizeHebyGatedPresentation,
  prepareHebyApproval,
  validateHebyGovernanceGateRequest,
  verifyHebyGatedPresentationFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAdmittedInput,
  HebyDeclaredContext,
  HebyGatedPresentation,
  HebyGovernanceBlock,
  HebyGovernanceGateRequest,
  HebyGroundedPresentation,
  HebyIntentRequest,
  HebyPreparedApproval,
  HebyPreparedItem,
  HebyPresentation,
  HebyPresentationElement,
  HebyProposedIntent,
  HebyRoutedIntent,
} from "../../src/features/heby-core";

// --- Fixtures ----------------------------------------------------------------

function input(id: string, kind: HebyAdmittedInput["kind"], eligible = true): HebyAdmittedInput {
  return {
    inputId: id,
    kind,
    sourceId: `src-${id}`,
    provenance: { source: "organizational-intelligence-runtime", attribution: "director-briefing-assembler", version: 1, effectivePeriod: "2026-08-06T00:00:00.000Z", lifecycle: "settled" },
    eligible,
  };
}

function element(id: string, kind: HebyPresentationElement["kind"], refs: readonly string[], classification: HebyPresentationElement["classification"] = "presentable"): HebyPresentationElement {
  return { elementId: id, kind, statement: `${id} statement`, evidenceRefs: refs, confidence: "high", uncertainty: [], classification };
}

function context(overrides: Partial<HebyDeclaredContext> = {}): HebyDeclaredContext {
  return {
    contextId: "ctx-1",
    role: "director",
    domain: "operations",
    subject: "Q2 review",
    authorityBasis: "director-governed",
    organizationId: "org-1",
    tenantId: "tenant-1",
    constraints: [{ constraintKind: "governance", constraintId: "c-1", statement: "director-governed" }],
    ...overrides,
  };
}

function presentationFixture(): HebyPresentation {
  return {
    presentationId: "pres-1",
    requestId: "req-1",
    context: context(),
    inputs: [input("in-1", "runtime-output"), input("in-2", "reasoning-understanding")],
    elements: [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-2"])],
    explanation: [{ facet: "why", statements: ["surfaced for review"], sourceRefs: ["in-1"] }],
  };
}

function groundedFixture(): HebyGroundedPresentation {
  const r = groundHebyPresentation({ request: { presentation: presentationFixture() } });
  if (!r.ok) throw new Error(`fixture grounding failed: ${r.issues.join(", ")}`);
  return r.value;
}

function routedFixture(): HebyRoutedIntent {
  const proposed: HebyProposedIntent = { intentId: "int-1", utteranceId: "utt-1", disposition: "resolved", requestedCapability: "prepare-information", routedElementRefs: ["el-a", "el-b"], clarification: null };
  const intentRequest: HebyIntentRequest = { identity: CANONICAL_HEBY_IDENTITY, grounded: groundedFixture(), utterance: { utteranceId: "utt-1", text: "prepare Q2 spend for approval" }, proposed };
  const r = interpretHebyIntent({ request: intentRequest });
  if (!r.ok) throw new Error(`fixture intent failed: ${r.issues.join(", ")}`);
  return r.value;
}

function preparedFixture(): HebyPreparedApproval {
  const r = prepareHebyApproval({
    request: {
      identity: CANONICAL_HEBY_IDENTITY,
      grounded: groundedFixture(),
      routed: routedFixture(),
      items: [{ itemId: "item-1", kind: "approval", intentId: "int-1", subjectRefs: ["el-a"], decisionState: "pending", consequences: ["commits Q2 spend"] }],
    },
  });
  if (!r.ok) throw new Error(`fixture prepared failed: ${r.issues.join(", ")}`);
  return r.value;
}

// Raw constructors bypass earlier-phase boundaries so Phase 7 can be shown to re-enforce
// governance independently (defense-in-depth) rather than trusting upstream conclusions.
function rawGrounded(overrides: Partial<HebyGroundedPresentation> = {}): HebyGroundedPresentation {
  return { presentationId: "pres-1", requestId: "req-1", context: context(), inputs: [input("in-1", "runtime-output")], groundedElements: [element("el-a", "evidence", ["in-1"])], traces: [], withheld: [], explanation: [], ...overrides };
}

function rawItem(overrides: Partial<HebyPreparedItem> = {}): HebyPreparedItem {
  return { itemId: "item-1", kind: "approval", intentId: "int-1", subjectRefs: ["el-a"], decisionState: "pending", consequences: ["a consequence"], ...overrides };
}

function rawPrepared(overrides: Partial<HebyPreparedApproval> = {}): HebyPreparedApproval {
  return { presentationId: "pres-1", intentId: "int-1", context: context(), items: [rawItem()], termination: { authorityBasis: "director-governed", terminatesAtDirector: true }, ...overrides };
}

function request(overrides: Partial<HebyGovernanceGateRequest> = {}): HebyGovernanceGateRequest {
  return { identity: CANONICAL_HEBY_IDENTITY, grounded: groundedFixture(), prepared: preparedFixture(), ...overrides };
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Phase 7 structural integrity --------------------------------------------

run("phase 7 integrity: a clean surface gates with everything admitted and no blocks", () => {
  assert.deepEqual(validateHebyGovernanceGateRequest(request()), { ok: true });
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.presentationId, "pres-1");
    assert.equal(r.value.intentId, "int-1");
    assert.equal(r.value.admittedElements.length, 2);
    assert.equal(r.value.admittedItems.length, 1);
    assert.equal(r.value.blocks.length, 0);
  }
});

run("phase 7 integrity: subject kinds are exactly declared in canonical order", () => {
  assert.deepEqual(allHebyGovernanceSubjectKinds(), ["presentation", "element", "item"]);
});

run("phase 7 integrity: block reasons are exactly declared in canonical order", () => {
  assert.deepEqual(allHebyGovernanceBlockReasons(), ["cross-tenant", "cross-organization", "protected-classification", "ineligible-evidence", "unresolved-evidence", "blocked-subject"]);
});

// --- Isolation: no cross-tenant / cross-organization leakage ------------------

run("isolation: a cross-tenant surface stops the whole presentation and records a block", () => {
  const prepared = rawPrepared({ context: context({ tenantId: "tenant-2" }) });
  const r = gateHebyPresentation({ request: request({ grounded: rawGrounded(), prepared }) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.admittedElements.length, 0);
    assert.equal(r.value.admittedItems.length, 0);
    assert.equal(r.value.blocks.length, 1);
    assert.equal(r.value.blocks[0].subjectKind, "presentation");
    assert.equal(r.value.blocks[0].reason, "cross-tenant");
    assert.equal(r.value.blocks[0].constraintKind, "security");
  }
});

run("isolation: a cross-organization surface stops the whole presentation", () => {
  const prepared = rawPrepared({ context: context({ organizationId: "org-2" }) });
  const r = gateHebyPresentation({ request: request({ grounded: rawGrounded(), prepared }) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.admittedElements.length, 0);
    assert.equal(r.value.blocks[0].reason, "cross-organization");
  }
});

run("isolation: scope helpers agree tenant-before-organization, fail-closed", () => {
  assert.ok(hebyScopesMatch({ tenantId: "t", organizationId: "o" }, { tenantId: "t", organizationId: "o" }));
  assert.equal(hebyScopeMismatchReason({ tenantId: "t", organizationId: "o" }, { tenantId: "x", organizationId: "o" }), "cross-tenant");
  assert.equal(hebyScopeMismatchReason({ tenantId: "t", organizationId: "o" }, { tenantId: "t", organizationId: "x" }), "cross-organization");
  assert.equal(hebyScopeMismatchReason({ tenantId: "t", organizationId: "o" }, { tenantId: "t", organizationId: "o" }), null);
});

// --- No secret exposure: protected classification ----------------------------

run("no-secret-exposure: a protected element is blocked and recorded, others admitted", () => {
  const grounded = rawGrounded({ groundedElements: [element("el-a", "evidence", ["in-1"]), element("el-secret", "evidence", ["in-1"], "protected")] });
  const r = gateHebyPresentation({ request: request({ grounded, prepared: rawPrepared() }) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(r.value.admittedElements.some((e) => e.elementId === "el-a"));
    assert.ok(!r.value.admittedElements.some((e) => e.elementId === "el-secret"));
    const block = r.value.blocks.find((b) => b.subjectId === "el-secret");
    assert.ok(block);
    assert.equal(block.reason, "protected-classification");
    assert.equal(block.constraintKind, "classification");
  }
});

// --- Evidence eligibility ----------------------------------------------------

run("evidence eligibility: an element resting on an ineligible input is blocked", () => {
  const grounded = rawGrounded({ inputs: [input("in-1", "runtime-output", false)], groundedElements: [element("el-a", "evidence", ["in-1"])] });
  const r = gateHebyPresentation({ request: request({ grounded, prepared: rawPrepared() }) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.admittedElements.length, 0);
    const block = r.value.blocks.find((b) => b.subjectId === "el-a");
    assert.ok(block && block.reason === "ineligible-evidence" && block.constraintKind === "governance");
  }
});

run("evidence eligibility: an element resting on unresolved evidence is blocked", () => {
  const grounded = rawGrounded({ inputs: [input("in-1", "runtime-output")], groundedElements: [element("el-a", "evidence", ["in-missing"])] });
  const r = gateHebyPresentation({ request: request({ grounded, prepared: rawPrepared() }) });
  assert.ok(r.ok);
  if (r.ok) {
    const block = r.value.blocks.find((b) => b.subjectId === "el-a");
    assert.ok(block && block.reason === "unresolved-evidence");
  }
});

run("evidence eligibility: an element with no evidence is blocked as unresolved", () => {
  const grounded = rawGrounded({ groundedElements: [element("el-a", "evidence", [])] });
  const r = gateHebyPresentation({ request: request({ grounded, prepared: rawPrepared() }) });
  assert.ok(r.ok);
  if (r.ok) assert.ok(r.value.blocks.some((b) => b.subjectId === "el-a" && b.reason === "unresolved-evidence"));
});

// --- Item cascade: an item resting on a blocked element cannot pass -----------

run("item cascade: a prepared item resting on a blocked element is blocked", () => {
  const grounded = rawGrounded({ groundedElements: [element("el-a", "evidence", ["in-1"]), element("el-bad", "evidence", [], "presentable")] });
  const prepared = rawPrepared({ items: [rawItem({ itemId: "item-bad", subjectRefs: ["el-bad"] })] });
  const r = gateHebyPresentation({ request: request({ grounded, prepared }) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.ok(!r.value.admittedItems.some((i) => i.itemId === "item-bad"));
    assert.ok(r.value.blocks.some((b) => b.subjectKind === "item" && b.subjectId === "item-bad" && b.reason === "blocked-subject"));
  }
});

run("item cascade: an item resting only on admitted elements passes", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.ok(r.value.admittedItems.some((i) => i.itemId === "item-1"));
});

// --- Classification rides every rendered element -----------------------------

run("classification rides: every admitted element carries a presentable classification", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) for (const e of r.value.admittedElements) assert.equal(e.classification, "presentable");
});

// --- Constraints held immutable / preserved ----------------------------------

run("constraints immutable: applicable constraints are carried unchanged from context", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.constraints.length, 1);
    assert.equal(r.value.constraints[0].constraintKind, "governance");
    assert.equal(r.value.constraints[0].constraintId, "c-1");
  }
});

run("block records constraint kind: every reason records the constraint it enforces", () => {
  for (const reason of allHebyGovernanceBlockReasons()) {
    assert.equal(HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS[reason].constraintKind, hebyGovernanceBlockReasonConstraintKind(reason));
  }
});

// --- Preservation ------------------------------------------------------------

run("preservation: context, authority, and scope carried unchanged", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.context.role, "director");
    assert.equal(r.value.context.authorityBasis, "director-governed");
    assert.equal(r.value.scope.tenantId, "tenant-1");
    assert.equal(r.value.scope.organizationId, "org-1");
    assert.equal(r.value.context.constraints[0].constraintKind, "governance");
  }
});

// --- Boundary / capability integrity -----------------------------------------

run("boundary integrity: MAY set is holding/gating/recording/preserving only", () => {
  const may: readonly string[] = HEBY_GOVERNANCE_CAPABILITIES;
  for (const cap of ["hold-constraint-immutable", "gate-presentation", "block-violation", "record-block", "enforce-tenant-isolation", "carry-classification"]) assert.ok(may.includes(cap));
  for (const forbidden of ["approve", "waive", "author-constraint", "reinterpret-constraint", "decide", "execute"]) assert.ok(!may.includes(forbidden));
});

run("boundary integrity: MUST-NEVER forbids approve, waive, author, reinterpret, expose-secret", () => {
  const mustNever: readonly string[] = HEBY_GOVERNANCE_NON_RESPONSIBILITIES;
  for (const req of ["approve", "waive", "author-constraint", "reinterpret-constraint", "reject", "decide", "resolve-decision", "advance-past-director", "execute", "trigger-workflow", "orchestrate", "call-ai", "trust-ai-output", "invent", "fabricate-confidence", "suppress-uncertainty", "expose-secret", "modify-runtime", "modify-memory", "modify-reasoning", "modify-organization", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER are disjoint", () => {
  const prohibited = new Set<string>(HEBY_GOVERNANCE_NON_RESPONSIBILITIES);
  for (const cap of HEBY_GOVERNANCE_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

run("boundary integrity: membership guards agree with the tables", () => {
  assert.ok(isHebyGovernanceSubjectKind("presentation"));
  assert.ok(isHebyGovernanceSubjectKind("element"));
  assert.ok(!isHebyGovernanceSubjectKind("workflow"));
  assert.ok(isHebyGovernanceBlockReason("cross-tenant"));
  assert.ok(isHebyGovernanceBlockReason("protected-classification"));
  assert.ok(!isHebyGovernanceBlockReason("waived"));
});

// --- Fail-closed on malformed request ----------------------------------------

run("fail-closed: a malformed identity fails the gate", () => {
  const broken = { ...CANONICAL_HEBY_IDENTITY, name: "" as (typeof CANONICAL_HEBY_IDENTITY)["name"] };
  const r = gateHebyPresentation({ request: request({ identity: broken }) });
  assert.ok(!r.ok);
});

run("fail-closed: a non-pending prepared item fails the gate", () => {
  const prepared = rawPrepared({ items: [rawItem({ decisionState: "resolved" })] });
  const r = gateHebyPresentation({ request: request({ grounded: rawGrounded(), prepared }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("not pending")));
});

run("fail-closed: a prepared surface that does not terminate at the Director fails", () => {
  const prepared = rawPrepared({ termination: { authorityBasis: "director-governed", terminatesAtDirector: true } });
  const tampered = { ...prepared, termination: { ...prepared.termination, terminatesAtDirector: false as unknown as true } };
  const r = gateHebyPresentation({ request: request({ grounded: rawGrounded(), prepared: tampered }) });
  assert.ok(!r.ok);
});

// --- Canonical ordering ------------------------------------------------------

run("canonical ordering: admitted elements are ordered by kind then identity, arrangement only", () => {
  const grounded = rawGrounded({ inputs: [input("in-1", "runtime-output")], groundedElements: [element("z-rec", "recommendation", ["in-1"]), element("a-ev", "evidence", ["in-1"])] });
  const prepared = rawPrepared({ items: [rawItem({ subjectRefs: ["a-ev"] })] });
  const r = gateHebyPresentation({ request: request({ grounded, prepared }) });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.admittedElements.map((e) => e.elementId), ["a-ev", "z-rec"]);
});

run("canonical ordering: blocks are ordered by subject kind then reason then identity", () => {
  const grounded = rawGrounded({ inputs: [input("in-1", "runtime-output")], groundedElements: [element("el-a", "evidence", ["in-1"]), element("el-p", "evidence", ["in-1"], "protected"), element("el-u", "evidence", [])] });
  const prepared = rawPrepared({ items: [rawItem({ itemId: "item-x", subjectRefs: ["el-p"] })] });
  const r = gateHebyPresentation({ request: request({ grounded, prepared }) });
  assert.ok(r.ok);
  if (r.ok) {
    const kinds = r.value.blocks.map((b) => b.subjectKind);
    // all element blocks precede item blocks
    assert.equal(kinds.indexOf("item") > kinds.lastIndexOf("element"), true);
    const elementReasons = r.value.blocks.filter((b) => b.subjectKind === "element").map((b) => b.reason);
    assert.deepEqual(elementReasons, ["protected-classification", "unresolved-evidence"]);
  }
});

// --- Idempotent / deterministic ----------------------------------------------

run("idempotent normalization: normalizing a canonical gated presentation is a fixed point", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(normalizeHebyGatedPresentation(r.value), r.value);
});

run("deterministic output: the same request always gates to the same value", () => {
  const a = gateHebyPresentation({ request: request() });
  const b = gateHebyPresentation({ request: request() });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("shuffled-input stability: reordered elements yield the same gated presentation", () => {
  const g1 = rawGrounded({ inputs: [input("in-1", "runtime-output")], groundedElements: [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-1"])] });
  const g2 = rawGrounded({ inputs: [input("in-1", "runtime-output")], groundedElements: [element("el-b", "recommendation", ["in-1"]), element("el-a", "evidence", ["in-1"])] });
  const prepared = rawPrepared({ items: [rawItem({ subjectRefs: ["el-a"] })] });
  const a = gateHebyPresentation({ request: request({ grounded: g1, prepared }) });
  const b = gateHebyPresentation({ request: request({ grounded: g2, prepared }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

// --- Deep freeze / immutable / no input mutation -----------------------------

run("deep freeze: gated presentation and its collections are frozen", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(verifyHebyGatedPresentationFrozen(r.value), { ok: true });
    assert.ok(Object.isFrozen(r.value));
    assert.ok(Object.isFrozen(r.value.scope));
    assert.ok(Object.isFrozen(r.value.context));
    assert.ok(Object.isFrozen(r.value.constraints));
    assert.ok(Object.isFrozen(r.value.admittedElements));
    assert.ok(Object.isFrozen(r.value.admittedItems));
    assert.ok(Object.isFrozen(r.value.blocks));
  }
});

run("deep freeze: descriptor tables are frozen", () => {
  assert.ok(Object.isFrozen(HEBY_GOVERNANCE_SUBJECT_KIND_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_GOVERNANCE_BLOCK_REASON_DESCRIPTORS));
});

run("immutable outputs: mutating a frozen gated presentation throws", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.throws(() => { (r.value.blocks as HebyGovernanceBlock[]).push({ subjectKind: "element", subjectId: "x", reason: "cross-tenant", constraintKind: "security" }); });
});

run("no input mutation: the source request is not mutated by gating", () => {
  const req = request();
  const before = JSON.stringify(req);
  gateHebyPresentation({ request: req });
  assert.equal(JSON.stringify(req), before);
});

// --- JSON / UTF-8 stability --------------------------------------------------

run("JSON stability: canonical key stable across element orderings", () => {
  const g1 = rawGrounded({ inputs: [input("in-1", "runtime-output")], groundedElements: [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-1"])] });
  const g2 = rawGrounded({ inputs: [input("in-1", "runtime-output")], groundedElements: [element("el-b", "recommendation", ["in-1"]), element("el-a", "evidence", ["in-1"])] });
  const prepared = rawPrepared({ items: [rawItem({ subjectRefs: ["el-a"] })] });
  const a = gateHebyPresentation({ request: request({ grounded: g1, prepared }) });
  const b = gateHebyPresentation({ request: request({ grounded: g2, prepared }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.equal(canonicalHebyGatedPresentationKey(a.value), canonicalHebyGatedPresentationKey(b.value));
});

run("JSON stability: a gated value round-trips through JSON", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const revived = JSON.parse(JSON.stringify(r.value)) as HebyGatedPresentation;
    assert.deepEqual(normalizeHebyGatedPresentation(revived), r.value);
  }
});

run("UTF-8 stability: canonical key survives a UTF-8 byte round-trip", () => {
  const r = gateHebyPresentation({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const key = canonicalHebyGatedPresentationKey(r.value);
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
});

console.log("\nheby-governance: all checks passed.");
