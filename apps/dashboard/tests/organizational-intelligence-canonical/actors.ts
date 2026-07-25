import assert from "node:assert/strict";
import {
  AI_AGENT_CLASSIFICATIONS,
  ACTOR_TYPES,
  createAIAgent,
  createActor,
  createPerson,
  validateAIAgent,
  validateActor,
  validatePerson,
  type Person,
} from "../../src/features/organizational-intelligence/canonical";
import { actorInput, identityInput, inert } from "../helpers/oi-canonical";

function personInput(overrides: Record<string, unknown> = {}) {
  return {
    actor: actorInput({ actorType: "PERSON" }),
    legalEmployerReference: "le-1", organizationalUnitReferences: ["ou-1"], metadata: {}, ...inert, ...overrides,
  } as Parameters<typeof createPerson>[0];
}
function agentInput(overrides: Record<string, unknown> = {}) {
  return {
    actor: actorInput({ actorType: "AI_AGENT", actorId: "act-2", identity: identityInput({ canonicalId: "a-1", displayName: "Bot", normalizedName: "bot" }) }),
    classification: "autonomous" as const, runtimeIdentityReference: "runtime://act-2", modelReference: "model://opus", metadata: {}, ...inert, ...overrides,
  } as Parameters<typeof createAIAgent>[0];
}

/* ── Actor abstraction ─────────────────────────────────────────── */
function actor(): void {
  assert.deepEqual([...ACTOR_TYPES], ["PERSON", "AI_AGENT", "SERVICE_ACCOUNT", "EXTERNAL_CONTACT"]);
  const a = createActor(actorInput());
  assert.equal(validateActor(a).status, "valid");
  assert.equal(a.architectureVersion, "actor/v1");

  const v = (o: Record<string, unknown>, type?: Parameters<typeof validateActor>[1]) => validateActor(createActor(actorInput(o)), type);
  assert.equal(v({ actorId: "" }).error?.code, "INVALID_ACTOR_ID");
  assert.equal(v({ actorType: "ROBOT" as never }).error?.code, "INVALID_ACTOR_TYPE");
  assert.equal(v({ workspaceId: "" }).error?.code, "INVALID_WORKSPACE_SCOPE");
  assert.equal(v({ organizationReferences: ["a", "a"] }).error?.code, "INVALID_ORGANIZATION_REFERENCE");
  assert.equal(v({ capabilityReferences: ["c", "c"] }).error?.code, "INVALID_CAPABILITY_REFERENCE");
  // Expected-type mismatch.
  assert.equal(v({ actorType: "AI_AGENT" }, "PERSON").error?.code, "INVALID_ACTOR_TYPE");

  // Actor identity is NOT authentication identity.
  for (const field of ["password", "accessToken", "apiKey", "mfa", "credential", "login"]) {
    assert.equal(validateActor(createActor(actorInput({ metadata: { [field]: "x" } }))).error?.code, "AUTHENTICATION_FIELD_FORBIDDEN", `metadata.${field} must be refused`);
  }
}

/* ── Person specialization ─────────────────────────────────────── */
function person(): void {
  const p = createPerson(personInput());
  assert.equal(validatePerson(p).status, "valid");
  assert.equal(p.actor.actorType, "PERSON");
  assert.equal(p.architectureVersion, "person/v1");

  const v = (o: Record<string, unknown>) => validatePerson(createPerson(personInput(o)));
  assert.equal(v({ legalEmployerReference: null }).status, "valid");
  assert.equal(v({ legalEmployerReference: "  " }).error?.code, "INVALID_LEGAL_EMPLOYER_REFERENCE");
  assert.equal(v({ organizationalUnitReferences: ["u", "u"] }).error?.code, "INVALID_ORGANIZATIONAL_UNIT_REFERENCE");
  // createPerson pins actorType to PERSON regardless of the input actorType.
  const forced = createPerson(personInput({ actor: actorInput({ actorType: "AI_AGENT" }) }));
  assert.equal(forced.actor.actorType, "PERSON");
  // A hand-built Person carrying a non-PERSON actor is rejected: the specialization pins the type.
  const aiActor = createActor(actorInput({ actorType: "AI_AGENT" }));
  const mismatched = Object.freeze({
    actor: aiActor, legalEmployerReference: null, organizationalUnitReferences: Object.freeze([]),
    metadata: Object.freeze({}), architectureVersion: "person/v1" as const, ...inert,
  }) as unknown as Person;
  assert.equal(validatePerson(mismatched).error?.code, "INVALID_ACTOR");
  // No private personal data.
  for (const field of ["ssn", "salary", "dateOfBirth", "health", "bankAccount"]) {
    assert.equal(v({ metadata: { [field]: "x" } }).error?.code, "PERSONAL_DATA_FORBIDDEN", `metadata.${field} must be refused`);
  }
  // No auth data on the wrapper.
  assert.equal(v({ metadata: { password: "x" } }).error?.code, "AUTHENTICATION_FIELD_FORBIDDEN");
}

/* ── AIAgent specialization ────────────────────────────────────── */
function aiAgent(): void {
  const agent = createAIAgent(agentInput());
  assert.equal(validateAIAgent(agent).status, "valid");
  assert.equal(agent.actor.actorType, "AI_AGENT");
  assert.equal(agent.architectureVersion, "ai-agent/v1");

  const v = (o: Record<string, unknown>) => validateAIAgent(createAIAgent(agentInput(o)));
  for (const classification of AI_AGENT_CLASSIFICATIONS) {
    assert.equal(v({ classification }).status, "valid");
  }
  assert.equal(v({ classification: "sentient" as never }).error?.code, "INVALID_CLASSIFICATION");
  assert.equal(v({ runtimeIdentityReference: null }).status, "valid");
  assert.equal(v({ runtimeIdentityReference: "  " }).error?.code, "INVALID_RUNTIME_REFERENCE");
  assert.equal(v({ modelReference: "  " }).error?.code, "INVALID_MODEL_REFERENCE");
  // References are inert strings only — they name, they do not bind.
  assert.equal(typeof agent.runtimeIdentityReference, "string");
  assert.equal(typeof agent.modelReference, "string");

  // Declarative and execution-free: no execution or credential fields.
  for (const field of ["execute", "prompt", "tools", "apiKey", "endpoint", "callback", "schedule", "webhook"]) {
    assert.equal(v({ metadata: { [field]: "x" } }).error?.code, "EXECUTION_FIELD_FORBIDDEN", `metadata.${field} must be refused`);
  }
  assert.equal(v({ metadata: { token: "x" } }).error?.code, "AUTHENTICATION_FIELD_FORBIDDEN");
}

/* ── Immutability across Person/AIAgent ────────────────────────── */
function immutability(): void {
  const p = createPerson(personInput());
  assert.equal(Object.isFrozen(p), true);
  assert.equal(Object.isFrozen(p.actor), true);
  assert.equal(Object.isFrozen(p.actor.identity), true);
  assert.throws(() => { (p as unknown as { architectureVersion: string }).architectureVersion = "x"; });
  assert.throws(() => { (p.actor as unknown as { actorId: string }).actorId = "y"; });

  const agent = createAIAgent(agentInput());
  assert.equal(Object.isFrozen(agent), true);
  assert.equal(Object.isFrozen(agent.actor), true);
  // Deep-copy isolation: mutating source metadata afterward does not leak in.
  const srcMeta = { note: "ok" };
  const built = createAIAgent(agentInput({ metadata: srcMeta }));
  (srcMeta as { note: string }).note = "tampered";
  assert.equal((built.metadata as { note: string }).note, "ok");
}

/* ── Adversarial: no behaviour or shared mutable state ─────────── */
function adversarial(): void {
  const cases: readonly [string, () => unknown][] = [
    ["callback injection", () => createActor(actorInput({ metadata: { fn: () => 1 } }))],
    ["Promise injection", () => createActor(actorInput({ lifecycle: Promise.resolve() as never }))],
    ["Symbol injection", () => createActor(actorInput({ metadata: { tag: Symbol("s") } }))],
    ["bigint injection", () => createActor(actorInput({ metadata: { big: BigInt(1) } }))],
    ["non-finite number", () => createActor(actorInput({ metadata: { n: Number.POSITIVE_INFINITY } }))],
    ["class instance", () => createActor(actorInput({ lifecycle: new (class { status = "active"; })() as never }))],
    ["cyclic object", () => { const c: Record<string, unknown> = { ...inert }; c.self = c; return createActor(actorInput({ metadata: c })); }],
    ["shared mutable reference", () => { const shared = { v: 1 }; return createActor(actorInput({ metadata: { a: shared, b: shared } })); }],
    ["executable descriptor (person)", () => createPerson(personInput({ metadata: { run: () => undefined } }))],
    ["executable descriptor (agent)", () => createAIAgent(agentInput({ metadata: { execute: () => undefined } }))],
  ];
  for (const [name, run] of cases) {
    assert.throws(run, TypeError, `${name} must be rejected`);
  }
  const frozenShared = Object.freeze({ note: "ok" });
  assert.doesNotThrow(() => createActor(actorInput({ metadata: { a: frozenShared, b: frozenShared } })));
}

function main(): void {
  actor();
  person();
  aiAgent();
  immutability();
  adversarial();
  console.log("organizational-intelligence canonical actor checks passed");
}

main();
