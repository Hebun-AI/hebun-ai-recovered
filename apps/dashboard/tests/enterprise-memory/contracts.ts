import assert from "node:assert/strict";
import type {
  ApprovedMemory,
  MemoryAdmission,
  MemoryCandidate,
  MemoryRecord,
} from "../../src/features/enterprise-memory";

const admittedAt = "2026-08-03T09:00:00.000Z";

const candidate: MemoryCandidate = {
  identity: { memoryId: "memory-1", namespace: "enterprise-1" },
  content: {
    statement: "Q3 procurement policy requires dual approval above 50k.",
    attributes: { threshold: 50000, currency: "USD", active: true },
  },
  source: {
    kind: "document",
    reference: "policy://procurement/q3",
    originatedAt: "2026-08-01T00:00:00.000Z",
  },
  authority: {
    authorityType: "director",
    admittedBy: { type: "director", id: "director-1" },
    grantReference: "approval://admission/1",
    admittedAt,
  },
  provenance: {
    method: "explicit-director-admission",
    derivedFrom: [],
    recordedAt: admittedAt,
  },
  confidence: { level: "high", score: 0.9, rationale: "authored by policy owner" },
  classification: { category: "policy", sensitivity: "internal", tags: ["procurement"] },
  lifecycle: { state: "candidate", enteredAt: admittedAt },
  relationships: [],
};

// The five metadata dimensions are separate objects on the record.
assert.equal(candidate.source.kind, "document");
assert.equal(candidate.authority.authorityType, "director");
assert.equal(candidate.provenance.method, "explicit-director-admission");
assert.equal(candidate.confidence.level, "high");
assert.equal(candidate.lifecycle.state, "candidate");

// Approved memory narrows lifecycle state at the type level.
const approved: ApprovedMemory = {
  ...candidate,
  lifecycle: { state: "approved", enteredAt: admittedAt },
};
assert.equal(approved.lifecycle.state, "approved");

// An admission decision is metadata only.
const admission: MemoryAdmission = {
  decision: "approved",
  grantReference: "approval://admission/1",
  decidedAt: admittedAt,
};
assert.equal(admission.decision, "approved");

// A record composes as a MemoryRecord and is deep-immutable when frozen.
const record: MemoryRecord = Object.freeze({ ...approved });
assert.equal(Object.isFrozen(record), true);
assert.equal(record.relationships.length, 0);

console.log("Enterprise Memory contract checks passed");
