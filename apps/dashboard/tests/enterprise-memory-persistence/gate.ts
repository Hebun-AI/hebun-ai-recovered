import assert from "node:assert/strict";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import type { MemoryCandidate } from "../../src/features/enterprise-memory";
import type { AdmissionAuthority, AdmissionPolicy, MemoryEvaluation } from "../../src/features/enterprise-memory-admission";
import { createAdmissionEngine } from "../../src/features/enterprise-memory-admission-engine";
import type { MemoryAdmissionResult } from "../../src/features/enterprise-memory-admission-engine";
import type { AdmissionEngineInput } from "../../src/features/enterprise-memory-admission-engine";
import {
  createInMemoryMemoryPersistence,
  createInMemoryMemoryRepository,
  persistApprovedMemory,
} from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";

const at = "2026-08-03T12:00:00.000Z";

function candidate(): MemoryCandidate {
  return {
    identity: { memoryId: "memory-1", namespace: "enterprise-1" },
    content: { statement: "SLA is 99.9%.", attributes: { uptime: 99.9 } },
    source: { kind: "document", reference: "doc://1", originatedAt: at },
    authority: { authorityType: "director", admittedBy: { type: "director", id: "d-1" }, grantReference: "grant://1", admittedAt: at },
    provenance: { method: "explicit-admission", derivedFrom: [], recordedAt: at },
    confidence: { level: "high" },
    classification: { category: "vendor", sensitivity: "internal", tags: ["sla"] },
    lifecycle: { state: "candidate", enteredAt: at },
    relationships: [],
  };
}

const director: AdmissionAuthority = { kind: "director", authorityId: "auth-d", assertedAt: at };
const evaluation: MemoryEvaluation = {
  assessedAt: at,
  dimensions: [{ dimension: "confidence", standing: "strong", evidence: [{ evidenceId: "e1", describedBy: "doc" }] }],
};

function input(policies: readonly AdmissionPolicy[]): AdmissionEngineInput {
  return {
    candidate: candidate(),
    evaluation,
    authority: director,
    policySet: { policySetId: "policy-set-1", policies },
    reviewer: { reviewerId: "r-1", displayName: "Director" },
    evaluatedAt: at,
  };
}

const engine = createAdmissionEngine();
const approved = engine.admit(input([
  { kind: "required-authority", acceptedAuthorities: ["director"] },
  { kind: "required-classification", acceptedSensitivities: ["internal"] },
  { kind: "required-confidence", minimumLevel: "high", minimumStanding: "adequate" },
]));
assert.equal(approved.decision.outcome, "approved");

function withDecision(outcome: MemoryAdmissionResult["decision"]): MemoryAdmissionResult {
  return { ...approved, decision: outcome };
}

async function main(): Promise<void> {
  const context = { storedAt: at, concurrencyToken: "token-1" };

  // Approved persists; admission reference, provenance, and authority preserved.
  const persistence = createInMemoryMemoryPersistence(createInProcessEventBus());
  const stored = await persistApprovedMemory(persistence.unitOfWork, approved, context);
  assert.equal(stored.status, "Success");
  if (stored.status === "Success") {
    assert.equal(stored.value.record.lifecycle.state, "approved");
    assert.equal(stored.value.admissionReference.grantReference, "grant://1");
    assert.equal(stored.value.admissionReference.policySetId, "policy-set-1");
    assert.equal(stored.value.record.provenance.method, "explicit-admission");
    assert.equal(stored.value.record.authority.authorityType, "director");
    assert.equal(Object.isFrozen(stored.value), true);
    assert.equal(stored.value.metadata.isCurrent, true);
  }

  // Non-approved outcomes are refused before any write.
  const refusedOutcomes: MemoryAdmissionResult["decision"][] = [
    { outcome: "rejected", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", reason: "x" },
    { outcome: "deferred", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", pendingOn: ["truth"] },
    { outcome: "needs-review", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", reviewNote: "n" },
    { outcome: "archived-candidate", decidedBy: "auth-d", decidedAt: at, appliedPolicySet: "policy-set-1", archivedReason: "r" },
  ];
  for (const decision of refusedOutcomes) {
    const fresh = createInMemoryMemoryPersistence(createInProcessEventBus());
    const result = await persistApprovedMemory(fresh.unitOfWork, withDecision(decision), context);
    assert.equal(result.status, "ValidationFailure", `${decision.outcome} must not persist`);
  }

  console.log("Enterprise Memory Persistence gate checks passed");
}

// Direct repository: identity, version, duplicate, conflict, supersede, archive.
function request(overrides: Partial<MemoryPersistenceRequest> = {}): MemoryPersistenceRequest {
  const base = candidate();
  return {
    memoryId: base.identity.memoryId,
    namespace: base.identity.namespace,
    content: base.content,
    classification: base.classification,
    provenance: base.provenance,
    authority: base.authority,
    confidence: base.confidence,
    source: base.source,
    relationships: base.relationships,
    admissionReference: { grantReference: "grant://1", policySetId: "policy-set-1", decidedAt: at },
    storedAt: at,
    concurrencyToken: "token-1",
    ...overrides,
  };
}

function versionSemantics(): void {
  const repo = createInMemoryMemoryRepository();

  const first = repo.storeApprovedMemory(request());
  assert.equal(first instanceof Promise ? "async" : first.status, "Success");

  // Duplicate store is a conflict, not a second version.
  const duplicate = repo.storeApprovedMemory(request());
  assert.equal(duplicate instanceof Promise ? "async" : duplicate.status, "Conflict");

  // Supersede appends v2 and keeps v1 available (superseded, not deleted).
  const superseded = repo.supersedeMemory({ ...request(), expectedCurrentVersion: 1 });
  assert.ok(!(superseded instanceof Promise) && superseded.status === "Success" && superseded.value.writeIdentity.version === 2);

  const current = repo.loadCurrentMemoryVersion("memory-1", "enterprise-1");
  assert.ok(!(current instanceof Promise) && current.status === "Success" && current.value.writeIdentity.version === 2);

  const previous = repo.loadMemoryById("memory-1", "enterprise-1", 1);
  assert.ok(!(previous instanceof Promise) && previous.status === "Success" && previous.value.metadata.isCurrent === false);
  assert.ok(!(previous instanceof Promise) && previous.status === "Success" && previous.value.supersededBy?.supersededByVersion === 2);

  // Stale supersession is a version conflict.
  const conflict = repo.supersedeMemory({ ...request(), expectedCurrentVersion: 1 });
  assert.ok(!(conflict instanceof Promise) && conflict.status === "Conflict");

  // Archive retires the current version; it is no longer active but remains stored.
  const archived = repo.archiveMemory("memory-1", "enterprise-1", at);
  assert.ok(!(archived instanceof Promise) && archived.status === "Success" && archived.value.record.lifecycle.state === "archived");
  const afterArchive = repo.loadCurrentMemoryVersion("memory-1", "enterprise-1");
  assert.ok(!(afterArchive instanceof Promise) && afterArchive.status === "NotFound");
  const stillThere = repo.loadMemoryById("memory-1", "enterprise-1", 2);
  assert.ok(!(stillThere instanceof Promise) && stillThere.status === "Success");
}

versionSemantics();
void main();
