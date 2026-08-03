import assert from "node:assert/strict";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import type { MemorySensitivity } from "../../src/features/enterprise-memory";
import {
  createInMemoryMemoryRepository,
  createInMemoryMemoryUnitOfWork,
} from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import { queryMemory } from "../../src/features/enterprise-memory-query";
import type { MemoryQuery } from "../../src/features/enterprise-memory-query";

const ns = "enterprise-1";
const t1 = "2026-08-01T00:00:00.000Z";
const t2 = "2026-08-02T00:00:00.000Z";
const t3 = "2026-08-03T00:00:00.000Z";
const t4 = "2026-08-04T00:00:00.000Z";
const t5 = "2026-08-05T00:00:00.000Z";

function request(memoryId: string, sensitivity: MemorySensitivity, category: string, storedAt: string): MemoryPersistenceRequest {
  return {
    memoryId,
    namespace: ns,
    content: { statement: memoryId, attributes: {} },
    classification: { category, sensitivity, tags: [] },
    provenance: { method: "explicit-admission", derivedFrom: [], recordedAt: storedAt },
    authority: { authorityType: "director", admittedBy: { type: "director", id: "d-1" }, grantReference: "grant://1", admittedAt: storedAt },
    confidence: { level: "high" },
    source: { kind: "document", reference: "doc://1", originatedAt: storedAt },
    relationships: [],
    admissionReference: { grantReference: "grant://1", policySetId: "policy-set-1", decidedAt: storedAt },
    storedAt,
    concurrencyToken: "token-1",
  };
}

function ids(result: { status: string; value?: readonly { writeIdentity: { memoryId: string; version: number } }[] }): string[] {
  return result.status === "Success" && result.value ? result.value.map((r) => `${r.writeIdentity.memoryId}:${r.writeIdentity.version}`) : ["<not-success>"];
}

async function main(): Promise<void> {
  const repository = createInMemoryMemoryRepository();
  repository.storeApprovedMemory(request("memory-a", "internal", "vendor", t1));
  repository.storeApprovedMemory(request("memory-b", "internal", "vendor", t2));
  repository.storeApprovedMemory(request("memory-c", "confidential", "policy", t3));
  repository.supersedeMemory({ ...request("memory-a", "internal", "vendor", t4), expectedCurrentVersion: 1 });
  repository.archiveMemory("memory-c", ns, t5);

  const uow = createInMemoryMemoryUnitOfWork(repository, createInProcessEventBus());
  const run = (query: MemoryQuery) => queryMemory(uow, query);

  // All records, deterministic order.
  assert.deepEqual(ids(await run({ namespace: ns })), ["memory-a:1", "memory-a:2", "memory-b:1", "memory-c:1"]);

  // currentOnly vs historical.
  assert.deepEqual(ids(await run({ namespace: ns, currentOnly: true })), ["memory-a:2", "memory-b:1"]);
  assert.deepEqual(ids(await run({ namespace: ns, historical: true })), ["memory-a:1", "memory-c:1"]);

  // Classification (sensitivity) + combination with currentOnly.
  assert.deepEqual(ids(await run({ namespace: ns, sensitivity: "internal" })), ["memory-a:1", "memory-a:2", "memory-b:1"]);
  assert.deepEqual(ids(await run({ namespace: ns, sensitivity: "internal", currentOnly: true })), ["memory-a:2", "memory-b:1"]);

  // Lifecycle + approvedOnly.
  assert.deepEqual(ids(await run({ namespace: ns, lifecycleState: "archived" })), ["memory-c:1"]);
  assert.deepEqual(ids(await run({ namespace: ns, approvedOnly: true })), ["memory-a:1", "memory-a:2", "memory-b:1"]);

  // Version + category + identity.
  assert.deepEqual(ids(await run({ namespace: ns, version: 1 })), ["memory-a:1", "memory-b:1", "memory-c:1"]);
  assert.deepEqual(ids(await run({ namespace: ns, category: "policy" })), ["memory-c:1"]);
  assert.deepEqual(ids(await run({ namespace: ns, memoryId: "memory-a" })), ["memory-a:1", "memory-a:2"]);

  // Time bounds (inclusive, stored time).
  assert.deepEqual(ids(await run({ namespace: ns, storedAfter: t2 })), ["memory-a:2", "memory-b:1", "memory-c:1"]);
  assert.deepEqual(ids(await run({ namespace: ns, storedBefore: t2 })), ["memory-a:1", "memory-b:1"]);

  // Empty result is a successful empty collection, not a failure.
  const empty = await run({ namespace: ns, sensitivity: "restricted" });
  assert.ok(empty.status === "Success" && empty.value.length === 0);

  // Immutable + deterministic repeat.
  const first = await run({ namespace: ns, sensitivity: "internal" });
  assert.ok(first.status === "Success" && Object.isFrozen(first.value));
  const second = await run({ namespace: ns, sensitivity: "internal" });
  assert.deepEqual(ids(first), ids(second));

  // Validation: contradictory queries fail explicitly with no execution.
  const contradiction = await run({ namespace: ns, currentOnly: true, historical: true });
  assert.equal(contradiction.status, "ValidationFailure");
  const badRange = await run({ namespace: ns, createdAfter: t4, createdBefore: t1 });
  assert.equal(badRange.status, "ValidationFailure");
  const badVersion = await run({ namespace: ns, version: 0 });
  assert.equal(badVersion.status, "ValidationFailure");

  console.log("Enterprise Memory Query checks passed");
}

void main();
