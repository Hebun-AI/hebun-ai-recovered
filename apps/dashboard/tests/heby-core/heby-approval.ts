import assert from "node:assert/strict";
import {
  CANONICAL_HEBY_IDENTITY,
  HEBY_APPROVAL_CAPABILITIES,
  HEBY_APPROVAL_NON_RESPONSIBILITIES,
  HEBY_DECISION_STATE_DESCRIPTORS,
  HEBY_PREPARATION_KIND_DESCRIPTORS,
  allHebyDecisionStates,
  allHebyPreparationKinds,
  canonicalHebyPreparedApprovalKey,
  groundHebyPresentation,
  hebyKindDistinctFromAdvice,
  hebyKindRequiresConsequences,
  hebySubjectsWithinRouting,
  interpretHebyIntent,
  isHebyDecisionState,
  isHebyDecisionStateAdmissible,
  isHebyPreparationKind,
  normalizeHebyPreparedApproval,
  prepareHebyApproval,
  validateHebyApprovalRequest,
  verifyHebyPreparedApprovalFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAdmittedInput,
  HebyApprovalRequest,
  HebyDecisionState,
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

function input(id: string, kind: HebyAdmittedInput["kind"]): HebyAdmittedInput {
  return {
    inputId: id,
    kind,
    sourceId: `src-${id}`,
    provenance: {
      source: "organizational-intelligence-runtime",
      attribution: "director-briefing-assembler",
      version: 1,
      effectivePeriod: "2026-08-06T00:00:00.000Z",
      lifecycle: "settled",
    },
    eligible: true,
  };
}

function element(id: string, kind: HebyPresentationElement["kind"], refs: readonly string[]): HebyPresentationElement {
  return { elementId: id, kind, statement: `${id} statement`, evidenceRefs: refs, confidence: "high", uncertainty: [], classification: "presentable" };
}

function presentationFixture(): HebyPresentation {
  return {
    presentationId: "pres-1",
    requestId: "req-1",
    context: {
      contextId: "ctx-1",
      role: "director",
      domain: "operations",
      subject: "Q2 review",
      authorityBasis: "director-governed",
      organizationId: "org-1",
      tenantId: "tenant-1",
      constraints: [{ constraintKind: "governance", constraintId: "c-1", statement: "director-governed" }],
    },
    inputs: [input("in-1", "runtime-output"), input("in-2", "reasoning-understanding")],
    elements: [element("el-a", "evidence", ["in-1"]), element("el-b", "recommendation", ["in-2"])],
    explanation: [{ facet: "why", statements: ["surfaced for review"], sourceRefs: ["in-1"] }],
  };
}

function groundedFixture(): HebyGroundedPresentation {
  const r = groundHebyPresentation({ request: { presentation: presentationFixture() } });
  if (!r.ok) throw new Error("fixture grounding failed");
  return r.value;
}

function proposed(overrides: Partial<HebyProposedIntent> = {}): HebyProposedIntent {
  return {
    intentId: "int-1",
    utteranceId: "utt-1",
    disposition: "resolved",
    requestedCapability: "prepare-information",
    routedElementRefs: ["el-a", "el-b"],
    clarification: null,
    ...overrides,
  };
}

function routedFixture(overrides: Partial<HebyProposedIntent> = {}): HebyRoutedIntent {
  const grounded = groundedFixture();
  const intentRequest: HebyIntentRequest = {
    identity: CANONICAL_HEBY_IDENTITY,
    grounded,
    utterance: { utteranceId: "utt-1", text: "prepare the Q2 spend for approval" },
    proposed: proposed(overrides),
  };
  const r = interpretHebyIntent({ request: intentRequest });
  if (!r.ok) throw new Error(`fixture intent failed: ${r.issues.join(", ")}`);
  return r.value;
}

function item(overrides: Partial<HebyPreparedItem> = {}): HebyPreparedItem {
  return {
    itemId: "item-1",
    kind: "approval",
    intentId: "int-1",
    subjectRefs: ["el-a"],
    decisionState: "pending",
    consequences: ["commits Q2 discretionary spend"],
    ...overrides,
  };
}

function request(overrides: Partial<HebyApprovalRequest> = {}): HebyApprovalRequest {
  return {
    identity: CANONICAL_HEBY_IDENTITY,
    grounded: groundedFixture(),
    routed: routedFixture(),
    items: [item()],
    ...overrides,
  };
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Phase 6 structural integrity --------------------------------------------

run("phase 6 integrity: a well-formed approval request validates and prepares", () => {
  assert.deepEqual(validateHebyApprovalRequest(request()), { ok: true });
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.presentationId, "pres-1");
    assert.equal(r.value.intentId, "int-1");
    assert.equal(r.value.items.length, 1);
    assert.equal(r.value.items[0].kind, "approval");
    assert.equal(r.value.items[0].decisionState, "pending");
    assert.equal(r.value.termination.terminatesAtDirector, true);
  }
});

run("phase 6 integrity: preparation kinds are exactly declared in canonical order", () => {
  assert.deepEqual(allHebyPreparationKinds(), ["advice", "review", "approval"]);
});

run("phase 6 integrity: decision states are exactly declared in canonical order", () => {
  assert.deepEqual(allHebyDecisionStates(), ["pending", "resolved"]);
});

run("phase 6 integrity: advice, review, approval each prepare when well-formed", () => {
  for (const kind of ["advice", "review", "approval"] as const) {
    const consequences = kind === "advice" ? [] : ["a stated consequence"];
    const r = prepareHebyApproval({ request: request({ items: [item({ kind, consequences })] }) });
    assert.ok(r.ok, `kind ${kind} should prepare`);
  }
});

// --- Advice never presented as approval --------------------------------------

run("advice distinct from approval: only review and approval are visibly distinct from advice", () => {
  assert.equal(hebyKindDistinctFromAdvice("advice"), false);
  assert.equal(hebyKindDistinctFromAdvice("review"), true);
  assert.equal(hebyKindDistinctFromAdvice("approval"), true);
});

run("advice distinct from approval: the kind field carries the distinction unchanged", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ itemId: "adv", kind: "advice", consequences: [] })] }) });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.items[0].kind, "advice");
});

// --- No path advances past a human decision ----------------------------------

run("no decision: a resolved (decided) item fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ decisionState: "resolved" })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("pending at the Director")));
});

run("no decision: an unknown decision state fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ decisionState: "approved" as HebyDecisionState })] }) });
  assert.ok(!r.ok);
});

run("no decision: only a pending state is admissible", () => {
  assert.ok(isHebyDecisionStateAdmissible("pending"));
  assert.ok(!isHebyDecisionStateAdmissible("resolved"));
});

run("no decision: every prepared path terminates pending at the Director", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) for (const it of r.value.items) assert.equal(it.decisionState, "pending");
});

// --- Ambiguity terminates at a clarification, never at a prepared item --------

run("fail-closed: an unresolved (clarify) intent may prepare no items", () => {
  const clarifyRouted = routedFixture({ disposition: "clarify", requestedCapability: null, routedElementRefs: [], clarification: { question: "which spend?", reason: "subject ambiguous" } });
  const r = prepareHebyApproval({ request: request({ routed: clarifyRouted, items: [item()] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("unresolved intent")));
});

run("fail-closed: a resolved intent must prepare at least one item", () => {
  const r = prepareHebyApproval({ request: request({ items: [] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("at least one item")));
});

// --- Grounding preserved: subjects stay within the intent's routing ----------

run("grounding preserved: a subject outside the intent's routing fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ subjectRefs: ["not-routed"] })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("outside the intent's grounded routing")));
});

run("grounding preserved: an empty subject set fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ subjectRefs: [] })] }) });
  assert.ok(!r.ok);
});

run("grounding preserved: containment check matches the routing exactly", () => {
  assert.ok(hebySubjectsWithinRouting(["el-a"], ["el-a", "el-b"]));
  assert.ok(hebySubjectsWithinRouting(["el-a", "el-b"], ["el-a", "el-b"]));
  assert.ok(!hebySubjectsWithinRouting(["el-a", "phantom"], ["el-a", "el-b"]));
  assert.ok(!hebySubjectsWithinRouting([], ["el-a", "el-b"]));
});

run("derivation preserved: an item not deriving from the routed intent fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ intentId: "other" })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("derive from the routed intent")));
});

// --- Consequences understandable before confirmation -------------------------

run("consequences: review and approval require consequences", () => {
  assert.ok(hebyKindRequiresConsequences("approval"));
  assert.ok(hebyKindRequiresConsequences("review"));
  assert.ok(!hebyKindRequiresConsequences("advice"));
});

run("consequences: an approval item with no consequences fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ consequences: [] })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("no consequences")));
});

run("consequences: an approval item with an empty consequence fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ consequences: ["  "] })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("empty consequence")));
});

// --- Unknown kind fails closed -----------------------------------------------

run("fail-closed: an unknown preparation kind fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ kind: "commit" as HebyPreparedItem["kind"] })] }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("unknown kind")));
});

run("fail-closed: an item with no itemId fails closed", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ itemId: "" })] }) });
  assert.ok(!r.ok);
});

run("fail-closed: an invalid grounded presentation fails closed", () => {
  const grounded = groundedFixture();
  const broken = { ...grounded, groundedElements: [{ ...grounded.groundedElements[0], classification: "protected" as const }] };
  const r = prepareHebyApproval({ request: request({ grounded: broken }) });
  assert.ok(!r.ok);
});

run("fail-closed: a routed intent bound to another presentation fails closed", () => {
  const otherRouted = { ...routedFixture(), presentationId: "pres-2" };
  const r = prepareHebyApproval({ request: request({ routed: otherRouted }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("not bound to the grounded presentation")));
});

// --- Authority remains visible / Director boundary ---------------------------

run("authority visible: the authority basis is carried unchanged onto the termination", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.termination.authorityBasis, "director-governed");
    assert.equal(r.value.termination.terminatesAtDirector, true);
  }
});

run("Director boundary: bound context is carried unchanged onto the prepared approval", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.context.role, "director");
    assert.equal(r.value.context.authorityBasis, "director-governed");
    assert.equal(r.value.context.constraints[0].constraintKind, "governance");
  }
});

// --- Boundary / capability integrity -----------------------------------------

run("boundary integrity: MAY set is preparing/distinguishing/terminating/preserving only", () => {
  const may: readonly string[] = HEBY_APPROVAL_CAPABILITIES;
  for (const cap of ["prepare-item", "distinguish-advice-from-approval", "state-consequences", "terminate-at-director", "keep-pending"]) assert.ok(may.includes(cap));
  for (const forbidden of ["approve", "decide", "reject", "execute", "resolve-decision"]) assert.ok(!may.includes(forbidden));
});

run("boundary integrity: MUST-NEVER forbids approval, decision, and authority", () => {
  const mustNever: readonly string[] = HEBY_APPROVAL_NON_RESPONSIBILITIES;
  for (const req of ["approve", "decide", "reject", "resolve-decision", "imply-authority", "treat-advice-as-approval", "treat-utterance-as-decision", "advance-past-director", "trigger-workflow", "orchestrate", "execute", "call-ai", "trust-ai-output", "invent", "modify-runtime", "modify-memory", "modify-reasoning", "modify-organization", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER are disjoint", () => {
  const prohibited = new Set<string>(HEBY_APPROVAL_NON_RESPONSIBILITIES);
  for (const cap of HEBY_APPROVAL_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

run("boundary integrity: membership guards agree with the tables", () => {
  assert.ok(isHebyPreparationKind("advice"));
  assert.ok(isHebyPreparationKind("approval"));
  assert.ok(!isHebyPreparationKind("commit"));
  assert.ok(isHebyDecisionState("pending"));
  assert.ok(isHebyDecisionState("resolved"));
  assert.ok(!isHebyDecisionState("approved"));
});

// --- Canonical ordering / idempotent / deterministic -------------------------

run("canonical ordering: items are ordered by kind then identity, arrangement only", () => {
  const items = [
    item({ itemId: "b-approval", kind: "approval", consequences: ["c"] }),
    item({ itemId: "a-advice", kind: "advice", consequences: [] }),
    item({ itemId: "a-approval", kind: "approval", consequences: ["c"] }),
  ];
  const r = prepareHebyApproval({ request: request({ items }) });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.items.map((it) => it.itemId), ["a-advice", "a-approval", "b-approval"]);
});

run("canonical ordering: subject refs and consequences are ordered, arrangement only", () => {
  const r = prepareHebyApproval({ request: request({ items: [item({ subjectRefs: ["el-b", "el-a"], consequences: ["z", "a"] })] }) });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.value.items[0].subjectRefs, ["el-a", "el-b"]);
    assert.deepEqual(r.value.items[0].consequences, ["a", "z"]);
  }
});

run("idempotent normalization: normalizing a canonical prepared approval is a fixed point", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(normalizeHebyPreparedApproval(r.value), r.value);
});

run("shuffled-input stability: reordered items yield the same prepared approval", () => {
  const a = prepareHebyApproval({ request: request({ items: [item({ itemId: "x", consequences: ["c"] }), item({ itemId: "y", consequences: ["c"] })] }) });
  const b = prepareHebyApproval({ request: request({ items: [item({ itemId: "y", consequences: ["c"] }), item({ itemId: "x", consequences: ["c"] })] }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("deterministic output: the same request always prepares the same value", () => {
  const a = prepareHebyApproval({ request: request() });
  const b = prepareHebyApproval({ request: request() });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

// --- Deep freeze / immutable / no input mutation -----------------------------

run("deep freeze: prepared approval and its collections are frozen", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(verifyHebyPreparedApprovalFrozen(r.value), { ok: true });
    assert.ok(Object.isFrozen(r.value));
    assert.ok(Object.isFrozen(r.value.items));
    assert.ok(Object.isFrozen(r.value.items[0]));
    assert.ok(Object.isFrozen(r.value.items[0].subjectRefs));
    assert.ok(Object.isFrozen(r.value.items[0].consequences));
    assert.ok(Object.isFrozen(r.value.termination));
    assert.ok(Object.isFrozen(r.value.context));
  }
});

run("deep freeze: descriptor tables are frozen", () => {
  assert.ok(Object.isFrozen(HEBY_PREPARATION_KIND_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_DECISION_STATE_DESCRIPTORS));
});

run("immutable outputs: mutating a frozen prepared approval throws", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.throws(() => {
      (r.value.items as HebyPreparedItem[]).push(item());
    });
  }
});

run("no input mutation: the source request is not mutated by preparation", () => {
  const req = request();
  const before = JSON.stringify(req);
  prepareHebyApproval({ request: req });
  assert.equal(JSON.stringify(req), before);
});

// --- JSON / UTF-8 stability --------------------------------------------------

run("JSON stability: canonical key stable across item orderings", () => {
  const a = prepareHebyApproval({ request: request({ items: [item({ itemId: "x", consequences: ["c"] }), item({ itemId: "y", consequences: ["c"] })] }) });
  const b = prepareHebyApproval({ request: request({ items: [item({ itemId: "y", consequences: ["c"] }), item({ itemId: "x", consequences: ["c"] })] }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.equal(canonicalHebyPreparedApprovalKey(a.value), canonicalHebyPreparedApprovalKey(b.value));
});

run("JSON stability: a prepared value round-trips through JSON", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const revived = JSON.parse(JSON.stringify(r.value)) as HebyPreparedApproval;
    assert.deepEqual(normalizeHebyPreparedApproval(revived), r.value);
  }
});

run("UTF-8 stability: canonical key survives a UTF-8 byte round-trip", () => {
  const r = prepareHebyApproval({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const key = canonicalHebyPreparedApprovalKey(r.value);
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
});

console.log("\nheby-approval: all checks passed.");
