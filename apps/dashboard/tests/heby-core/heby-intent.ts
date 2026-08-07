import assert from "node:assert/strict";
import {
  CANONICAL_HEBY_IDENTITY,
  HEBY_INTENT_CAPABILITIES,
  HEBY_INTENT_NON_RESPONSIBILITIES,
  HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS,
  allHebyInterpretationDispositions,
  canonicalHebyRoutedIntentKey,
  groundHebyPresentation,
  hebyGroundedElementIdSet,
  hebyRoutesToGrounded,
  interpretHebyIntent,
  isHebyCapabilityWithinIdentity,
  isHebyInterpretationDisposition,
  normalizeHebyRoutedIntent,
  validateHebyIntentRequest,
  verifyHebyRoutedIntentFrozen,
} from "../../src/features/heby-core";
import type {
  HebyAdmittedInput,
  HebyCapability,
  HebyGroundedPresentation,
  HebyIntentRequest,
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
    elements: [element("el-a", "evidence", ["in-1"]), element("el-b", "interpretation", ["in-2"])],
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
    requestedCapability: "explain",
    routedElementRefs: ["el-a"],
    clarification: null,
    ...overrides,
  };
}

function request(overrides: Partial<HebyIntentRequest> = {}): HebyIntentRequest {
  return {
    identity: CANONICAL_HEBY_IDENTITY,
    grounded: groundedFixture(),
    utterance: { utteranceId: "utt-1", text: "why did throughput rise?" },
    proposed: proposed(),
    ...overrides,
  };
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Phase 5 structural integrity --------------------------------------------

run("phase 5 integrity: a well-formed resolved request validates and routes", () => {
  assert.deepEqual(validateHebyIntentRequest(request()), { ok: true });
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.disposition, "resolved");
    assert.equal(r.value.requestedCapability, "explain");
    assert.deepEqual(r.value.routedElementRefs, ["el-a"]);
  }
});

run("phase 5 integrity: dispositions are exactly declared in canonical order", () => {
  assert.deepEqual(allHebyInterpretationDispositions(), ["resolved", "clarify"]);
});

run("phase 5 integrity: a clarify intent routes no assumption", () => {
  const r = interpretHebyIntent({
    request: request({ proposed: proposed({ disposition: "clarify", requestedCapability: null, routedElementRefs: [], clarification: { question: "which quarter?", reason: "period ambiguous" } }) }),
  });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.disposition, "clarify");
    assert.equal(r.value.requestedCapability, null);
    assert.equal(r.value.routedElementRefs.length, 0);
    assert.ok(r.value.clarification && r.value.clarification.question === "which quarter?");
  }
});

// --- AI output never trusted / identity + grounding preserved ----------------

run("AI-untrusted: a capability outside Heby's identity fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ requestedCapability: "approve" as HebyCapability }) }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("outside Heby's identity")));
});

run("AI-untrusted: a non-responsibility masquerading as capability fails closed", () => {
  for (const bad of ["decide", "execute", "reject"]) {
    const r = interpretHebyIntent({ request: request({ proposed: proposed({ requestedCapability: bad as HebyCapability }) }) });
    assert.ok(!r.ok, `capability ${bad} must fail`);
  }
});

run("grounding preserved: routing to a non-grounded element fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ routedElementRefs: ["not-grounded"] }) }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("route")));
});

run("grounding preserved: routes only to grounded element ids", () => {
  const grounded = groundedFixture();
  const ids = hebyGroundedElementIdSet(grounded);
  assert.ok(hebyRoutesToGrounded(["el-a"], ids));
  assert.ok(!hebyRoutesToGrounded(["el-a", "phantom"], ids));
  assert.ok(!hebyRoutesToGrounded([], ids));
});

run("identity preserved: capability-in-identity check matches MAY set", () => {
  assert.ok(isHebyCapabilityWithinIdentity("explain", CANONICAL_HEBY_IDENTITY));
  assert.ok(isHebyCapabilityWithinIdentity("summarize", CANONICAL_HEBY_IDENTITY));
  assert.ok(!isHebyCapabilityWithinIdentity("approve" as HebyCapability, CANONICAL_HEBY_IDENTITY));
});

// --- Ambiguity fails to clarification, not assumption ------------------------

run("fail-closed: a resolved intent with no capability fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ requestedCapability: null }) }) });
  assert.ok(!r.ok);
});

run("fail-closed: a resolved intent carrying a clarification fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ clarification: { question: "q", reason: "r" } }) }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("clarification")));
});

run("fail-closed: a clarify intent that assumes a routing fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ disposition: "clarify", requestedCapability: null, routedElementRefs: ["el-a"], clarification: { question: "q", reason: "r" } }) }) });
  assert.ok(!r.ok);
  if (!r.ok) assert.ok(r.issues.some((i) => i.includes("assume a routing")));
});

run("fail-closed: a clarify intent that assumes a capability fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ disposition: "clarify", requestedCapability: "explain", routedElementRefs: [], clarification: { question: "q", reason: "r" } }) }) });
  assert.ok(!r.ok);
});

run("fail-closed: a clarify intent with no clarification fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ disposition: "clarify", requestedCapability: null, routedElementRefs: [], clarification: null }) }) });
  assert.ok(!r.ok);
});

run("fail-closed: a proposal not referencing the utterance fails closed", () => {
  const r = interpretHebyIntent({ request: request({ proposed: proposed({ utteranceId: "other" }) }) });
  assert.ok(!r.ok);
});

run("fail-closed: an empty utterance fails closed", () => {
  const r = interpretHebyIntent({ request: request({ utterance: { utteranceId: "utt-1", text: "" } }) });
  assert.ok(!r.ok);
});

run("fail-closed: an invalid grounded presentation fails closed", () => {
  const grounded = groundedFixture();
  const broken = { ...grounded, groundedElements: [{ ...grounded.groundedElements[0], classification: "protected" as const }] };
  const r = interpretHebyIntent({ request: request({ grounded: broken }) });
  assert.ok(!r.ok);
});

// --- Boundary / capability integrity -----------------------------------------

run("boundary integrity: MAY set is interpretive/routing/preserving only", () => {
  const may: readonly string[] = HEBY_INTENT_CAPABILITIES;
  for (const cap of ["interpret-intent", "clarify-ambiguity", "route-to-grounded", "preserve-identity"]) assert.ok(may.includes(cap));
  for (const forbidden of ["call-ai", "trust-ai-output", "decide", "execute", "assume-ambiguous-intent"]) assert.ok(!may.includes(forbidden));
});

run("boundary integrity: MUST-NEVER forbids AI trust, assumption, authority expansion", () => {
  const mustNever: readonly string[] = HEBY_INTENT_NON_RESPONSIBILITIES;
  for (const req of ["call-ai", "trust-ai-output", "grant-ai-authority", "assume-ambiguous-intent", "invent-intent", "generate-candidate", "reason-as-authority", "expand-capability-beyond-identity", "route-to-ungrounded", "approve", "reject", "decide", "execute", "trigger-workflow", "orchestrate", "modify-runtime", "modify-memory", "modify-organization", "invoke-api", "bypass-director"]) {
    assert.ok(mustNever.includes(req), `missing ${req}`);
  }
});

run("boundary integrity: MAY and MUST-NEVER are disjoint", () => {
  const prohibited = new Set<string>(HEBY_INTENT_NON_RESPONSIBILITIES);
  for (const cap of HEBY_INTENT_CAPABILITIES) assert.ok(!prohibited.has(cap));
});

run("boundary integrity: membership guard agrees with the table", () => {
  assert.ok(isHebyInterpretationDisposition("resolved"));
  assert.ok(isHebyInterpretationDisposition("clarify"));
  assert.ok(!isHebyInterpretationDisposition("assume"));
});

// --- Preservation ------------------------------------------------------------

run("context/authority/constraints preservation: carried unchanged", () => {
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.value.context.role, "director");
    assert.equal(r.value.context.domain, "operations");
    assert.equal(r.value.context.subject, "Q2 review");
    assert.equal(r.value.context.authorityBasis, "director-governed");
    assert.equal(r.value.context.constraints[0].constraintKind, "governance");
    assert.equal(r.value.presentationId, "pres-1");
  }
});

run("utterance preservation: utterance identity preserved on the routed intent", () => {
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.value.utteranceId, "utt-1");
});

// --- Canonical ordering / idempotent / deterministic -------------------------

run("canonical ordering: routed refs are ordered by identity, arrangement only", () => {
  const grounded = groundedFixture();
  const r = interpretHebyIntent({ request: { ...request({ grounded }), proposed: proposed({ routedElementRefs: ["el-b", "el-a"] }) } });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(r.value.routedElementRefs, ["el-a", "el-b"]);
});

run("idempotent normalization: normalizing a canonical routed intent is a fixed point", () => {
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(normalizeHebyRoutedIntent(r.value), r.value);
});

run("shuffled-input stability: reordered routed refs yield the same routed intent", () => {
  const a = interpretHebyIntent({ request: request({ proposed: proposed({ routedElementRefs: ["el-a", "el-b"] }) }) });
  const b = interpretHebyIntent({ request: request({ proposed: proposed({ routedElementRefs: ["el-b", "el-a"] }) }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("deterministic output: the same request always routes to the same value", () => {
  const a = interpretHebyIntent({ request: request() });
  const b = interpretHebyIntent({ request: request() });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("deterministic output: routed intent re-validates against identity and grounded ids", () => {
  const grounded = groundedFixture();
  const r = interpretHebyIntent({ request: request({ grounded }) });
  assert.ok(r.ok);
  if (r.ok) assert.deepEqual(verifyHebyRoutedIntentFrozen(r.value), { ok: true });
});

// --- Deep freeze / immutable / no input mutation -----------------------------

run("deep freeze: routed intent and its collections are frozen", () => {
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(verifyHebyRoutedIntentFrozen(r.value), { ok: true });
    assert.ok(Object.isFrozen(r.value));
    assert.ok(Object.isFrozen(r.value.routedElementRefs));
    assert.ok(Object.isFrozen(r.value.context));
  }
});

run("deep freeze: descriptor table is frozen", () => {
  assert.ok(Object.isFrozen(HEBY_INTERPRETATION_DISPOSITION_DESCRIPTORS));
});

run("immutable outputs: mutating a frozen routed intent throws", () => {
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    assert.throws(() => {
      (r.value.routedElementRefs as string[]).push("x");
    });
  }
});

run("no input mutation: the source request is not mutated by interpretation", () => {
  const req = request();
  const before = JSON.stringify(req);
  interpretHebyIntent({ request: req });
  assert.equal(JSON.stringify(req), before);
});

// --- JSON / UTF-8 stability --------------------------------------------------

run("JSON stability: canonical key stable across routed-ref orderings", () => {
  const a = interpretHebyIntent({ request: request({ proposed: proposed({ routedElementRefs: ["el-a", "el-b"] }) }) });
  const b = interpretHebyIntent({ request: request({ proposed: proposed({ routedElementRefs: ["el-b", "el-a"] }) }) });
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.equal(canonicalHebyRoutedIntentKey(a.value), canonicalHebyRoutedIntentKey(b.value));
});

run("JSON stability: a routed value round-trips through JSON", () => {
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const revived = JSON.parse(JSON.stringify(r.value)) as HebyRoutedIntent;
    assert.deepEqual(normalizeHebyRoutedIntent(revived), r.value);
  }
});

run("UTF-8 stability: canonical key survives a UTF-8 byte round-trip", () => {
  const r = interpretHebyIntent({ request: request() });
  assert.ok(r.ok);
  if (r.ok) {
    const key = canonicalHebyRoutedIntentKey(r.value);
    assert.equal(Buffer.from(key, "utf8").toString("utf8"), key);
  }
});

console.log("\nheby-intent: all checks passed.");
