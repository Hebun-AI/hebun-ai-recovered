import assert from "node:assert/strict";
import {
  CANONICAL_HEBY_IDENTITY,
  HEBY_CAPABILITIES,
  HEBY_CAPABILITY_DESCRIPTORS,
  HEBY_NON_IDENTITY_DESCRIPTORS,
  HEBY_NON_RESPONSIBILITIES,
  HEBY_NON_RESPONSIBILITY_DESCRIPTORS,
  allHebyCapabilities,
  allHebyNonIdentities,
  allHebyNonResponsibilities,
  canonicalHebyIdentityKey,
  hebyCapabilityOrder,
  isHebyCapability,
  isHebyNonResponsibility,
  normalizeHebyIdentity,
  resolveCanonicalHebyIdentity,
  resolveHebyIdentity,
  validateHebyIdentity,
  verifyHebyIdentityFrozen,
} from "../../src/features/heby-core";
import type {
  HebyCapability,
  HebyIdentity,
  HebyNonIdentity,
  HebyNonResponsibility,
} from "../../src/features/heby-core";

// --- Expected canonical vocabulary (fixed by the published documentation) -----

const EXPECTED_CAPABILITIES: readonly HebyCapability[] = [
  "explain",
  "summarize",
  "clarify",
  "navigate",
  "expose-runtime",
  "expose-director-briefing",
  "answer-director-question",
  "prepare-information",
];

const EXPECTED_NON_RESPONSIBILITIES: readonly HebyNonResponsibility[] = [
  "approve",
  "decide",
  "execute",
  "invent",
  "hallucinate",
  "modify-runtime",
  "modify-memory",
  "modify-reasoning",
  "modify-organizational-intelligence",
  "trigger-workflow",
  "invoke-api",
  "call-ai-independently",
  "bypass-director",
];

const EXPECTED_NON_IDENTITIES: readonly HebyNonIdentity[] = [
  "runtime",
  "memory",
  "reasoning",
  "organizational-intelligence",
  "workflow",
  "orchestrator",
  "agent",
  "decision-engine",
];

// --- Helpers -----------------------------------------------------------------

/** A deep, structurally identical clone of the canonical identity in a mutable shape. */
type MutableIdentity = { -readonly [K in keyof HebyIdentity]: HebyIdentity[K] };

function clonedIdentity(): MutableIdentity {
  return JSON.parse(JSON.stringify(CANONICAL_HEBY_IDENTITY)) as MutableIdentity;
}

function run(name: string, body: () => void): void {
  body();
  console.log(`ok — ${name}`);
}

// --- Identity integrity ------------------------------------------------------

run("identity integrity: canonical name, role, mission, and handle are fixed", () => {
  assert.equal(CANONICAL_HEBY_IDENTITY.name, "Heby");
  assert.equal(CANONICAL_HEBY_IDENTITY.role, "executive-intelligence-interface");
  assert.equal(CANONICAL_HEBY_IDENTITY.identity, "heby-core-identity");
  assert.ok(CANONICAL_HEBY_IDENTITY.mission.trim().length > 0);
  assert.ok(CANONICAL_HEBY_IDENTITY.approvalPhilosophy.trim().length > 0);
  assert.ok(CANONICAL_HEBY_IDENTITY.runtimeRelationship.trim().length > 0);
  assert.ok(CANONICAL_HEBY_IDENTITY.directorRelationship.trim().length > 0);
});

run("identity integrity: the canonical identity validates", () => {
  assert.deepEqual(validateHebyIdentity(CANONICAL_HEBY_IDENTITY), { ok: true });
});

run("identity integrity: resolving the canonical identity succeeds", () => {
  const result = resolveCanonicalHebyIdentity();
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.value, CANONICAL_HEBY_IDENTITY);
});

// --- Boundary integrity ------------------------------------------------------

run("boundary integrity: MAY set is exactly the eight capabilities in canonical order", () => {
  assert.deepEqual(HEBY_CAPABILITIES, EXPECTED_CAPABILITIES);
  assert.deepEqual(allHebyCapabilities(), EXPECTED_CAPABILITIES);
});

run("boundary integrity: MUST-NEVER set is exactly the thirteen non-responsibilities", () => {
  assert.deepEqual(HEBY_NON_RESPONSIBILITIES, EXPECTED_NON_RESPONSIBILITIES);
  assert.deepEqual(allHebyNonResponsibilities(), EXPECTED_NON_RESPONSIBILITIES);
});

run("boundary integrity: Heby-is-NOT set is exactly the eight non-identities", () => {
  assert.deepEqual(allHebyNonIdentities(), EXPECTED_NON_IDENTITIES);
});

run("boundary integrity: MAY and MUST-NEVER sets are disjoint", () => {
  const prohibited = new Set<string>(HEBY_NON_RESPONSIBILITIES);
  for (const capability of HEBY_CAPABILITIES) assert.ok(!prohibited.has(capability));
});

run("boundary integrity: membership guards agree with the descriptor tables", () => {
  for (const capability of EXPECTED_CAPABILITIES) assert.ok(isHebyCapability(capability));
  for (const nonResponsibility of EXPECTED_NON_RESPONSIBILITIES) {
    assert.ok(isHebyNonResponsibility(nonResponsibility));
  }
  assert.ok(!isHebyCapability("approve"));
  assert.ok(!isHebyCapability("decide"));
  assert.ok(!isHebyCapability("execute"));
  assert.ok(!isHebyNonResponsibility("explain"));
});

// --- Capabilities / non-responsibilities preserved ---------------------------

run("capabilities preserved: the identity carries exactly the canonical capabilities", () => {
  assert.deepEqual(CANONICAL_HEBY_IDENTITY.capabilities, EXPECTED_CAPABILITIES);
});

run("non-responsibilities preserved: the identity carries exactly the canonical prohibitions", () => {
  assert.deepEqual(CANONICAL_HEBY_IDENTITY.nonResponsibilities, EXPECTED_NON_RESPONSIBILITIES);
});

run("non-identities preserved: the identity carries exactly what Heby is NOT", () => {
  assert.deepEqual(CANONICAL_HEBY_IDENTITY.nonIdentities, EXPECTED_NON_IDENTITIES);
});

// --- Communication / governance principles preserved -------------------------

run("communication principles preserved: kind fixed and statements non-empty", () => {
  const group = CANONICAL_HEBY_IDENTITY.communicationPrinciples;
  assert.equal(group.kind, "communication");
  assert.ok(group.statements.length > 0);
  for (const statement of group.statements) assert.ok(statement.trim().length > 0);
});

run("transparency principles preserved: kind fixed and statements non-empty", () => {
  const group = CANONICAL_HEBY_IDENTITY.transparencyPrinciples;
  assert.equal(group.kind, "transparency");
  assert.ok(group.statements.length > 0);
});

run("governance preserved: kind fixed and statements non-empty", () => {
  const group = CANONICAL_HEBY_IDENTITY.governancePrinciples;
  assert.equal(group.kind, "governance");
  assert.ok(group.statements.length > 0);
  for (const statement of group.statements) assert.ok(statement.trim().length > 0);
});

// --- Deep freeze -------------------------------------------------------------

run("deep freeze: the canonical identity and all its collections are frozen", () => {
  assert.deepEqual(verifyHebyIdentityFrozen(CANONICAL_HEBY_IDENTITY), { ok: true });
  assert.ok(Object.isFrozen(CANONICAL_HEBY_IDENTITY));
  assert.ok(Object.isFrozen(CANONICAL_HEBY_IDENTITY.capabilities));
  assert.ok(Object.isFrozen(CANONICAL_HEBY_IDENTITY.nonResponsibilities));
  assert.ok(Object.isFrozen(CANONICAL_HEBY_IDENTITY.nonIdentities));
  assert.ok(Object.isFrozen(CANONICAL_HEBY_IDENTITY.communicationPrinciples));
  assert.ok(Object.isFrozen(CANONICAL_HEBY_IDENTITY.communicationPrinciples.statements));
});

run("deep freeze: descriptor tables are frozen", () => {
  assert.ok(Object.isFrozen(HEBY_CAPABILITY_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_NON_RESPONSIBILITY_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_NON_IDENTITY_DESCRIPTORS));
  assert.ok(Object.isFrozen(HEBY_CAPABILITY_DESCRIPTORS.explain));
});

// --- Immutable outputs -------------------------------------------------------

run("immutable outputs: mutating a frozen collection throws in strict mode", () => {
  assert.throws(() => {
    (CANONICAL_HEBY_IDENTITY.capabilities as HebyCapability[]).push("explain");
  });
  assert.throws(() => {
    (CANONICAL_HEBY_IDENTITY as { name: string }).name = "NotHeby";
  });
});

// --- Canonical ordering ------------------------------------------------------

run("canonical ordering: capabilities follow their fixed descriptor ordinals", () => {
  for (let i = 0; i < HEBY_CAPABILITIES.length; i += 1) {
    assert.equal(hebyCapabilityOrder(HEBY_CAPABILITIES[i]), i);
  }
});

run("canonical ordering: a shuffled identity normalizes to canonical order", () => {
  const shuffled = clonedIdentity();
  shuffled.capabilities = EXPECTED_CAPABILITIES.slice().reverse();
  shuffled.nonResponsibilities = EXPECTED_NON_RESPONSIBILITIES.slice().reverse();
  const normalized = normalizeHebyIdentity(shuffled);
  assert.deepEqual(normalized.capabilities, EXPECTED_CAPABILITIES);
  assert.deepEqual(normalized.nonResponsibilities, EXPECTED_NON_RESPONSIBILITIES);
});

// --- Idempotent normalization ------------------------------------------------

run("idempotent normalization: normalizing a canonical identity yields an equal identity", () => {
  const once = normalizeHebyIdentity(clonedIdentity());
  const twice = normalizeHebyIdentity(once);
  assert.deepEqual(twice, once);
  assert.deepEqual(once, CANONICAL_HEBY_IDENTITY);
});

run("idempotent normalization: duplicates are removed deterministically", () => {
  const withDupes = clonedIdentity();
  const dupes: readonly HebyCapability[] = [
    ...EXPECTED_CAPABILITIES,
    "explain",
    "explain",
    "summarize",
  ];
  withDupes.capabilities = dupes;
  const normalized = normalizeHebyIdentity(withDupes);
  assert.deepEqual(normalized.capabilities, EXPECTED_CAPABILITIES);
});

// --- Deterministic output ----------------------------------------------------

run("deterministic output: the same input always resolves to the same value", () => {
  const a = resolveHebyIdentity(clonedIdentity());
  const b = resolveHebyIdentity(clonedIdentity());
  assert.ok(a.ok && b.ok);
  if (a.ok && b.ok) assert.deepEqual(a.value, b.value);
});

run("deterministic output: an incomplete identity fails closed with issues", () => {
  const broken = clonedIdentity();
  const onlyOne: readonly HebyCapability[] = ["explain"];
  broken.capabilities = onlyOne;
  const result = resolveHebyIdentity(broken);
  assert.ok(!result.ok);
  if (!result.ok) assert.ok(result.issues.length > 0);
});

run("deterministic output: a non-canonical name fails closed", () => {
  const broken = clonedIdentity();
  (broken as { name: string }).name = "Hebby";
  const result = resolveHebyIdentity(broken);
  assert.ok(!result.ok);
});

// --- JSON stability ----------------------------------------------------------

run("JSON stability: the canonical key is stable across equal inputs and orderings", () => {
  const keyA = canonicalHebyIdentityKey(CANONICAL_HEBY_IDENTITY);
  const keyB = canonicalHebyIdentityKey(clonedIdentity());
  assert.equal(keyA, keyB);

  const reordered = clonedIdentity();
  reordered.capabilities = EXPECTED_CAPABILITIES.slice().reverse();
  reordered.nonResponsibilities = EXPECTED_NON_RESPONSIBILITIES.slice().reverse();
  assert.equal(canonicalHebyIdentityKey(reordered), keyA);
});

run("JSON stability: re-serializing the canonical identity round-trips", () => {
  const serialized = JSON.stringify(CANONICAL_HEBY_IDENTITY);
  const revived = JSON.parse(serialized) as HebyIdentity;
  assert.deepEqual(normalizeHebyIdentity(revived), CANONICAL_HEBY_IDENTITY);
});

// --- UTF-8 stability ---------------------------------------------------------

run("UTF-8 stability: the canonical key survives a UTF-8 byte round-trip", () => {
  const key = canonicalHebyIdentityKey(CANONICAL_HEBY_IDENTITY);
  const roundTripped = Buffer.from(key, "utf8").toString("utf8");
  assert.equal(roundTripped, key);
});

console.log("\nheby-identity: all checks passed.");
