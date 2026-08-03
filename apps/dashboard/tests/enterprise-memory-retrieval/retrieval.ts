import assert from "node:assert/strict";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import type { MemorySensitivity } from "../../src/features/enterprise-memory";
import {
  createInMemoryMemoryRepository,
  createInMemoryMemoryUnitOfWork,
} from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import {
  retrieveCurrentMemory,
  retrieveMemoriesByClassification,
  retrieveMemoriesByLifecycle,
  retrieveMemoryHistory,
  retrieveMemoryVersion,
} from "../../src/features/enterprise-memory-retrieval";

const at = "2026-08-03T13:00:00.000Z";
const ns = "enterprise-1";

function request(memoryId: string, sensitivity: MemorySensitivity, category: string): MemoryPersistenceRequest {
  return {
    memoryId,
    namespace: ns,
    content: { statement: `record ${memoryId}`, attributes: {} },
    classification: { category, sensitivity, tags: [] },
    provenance: { method: "explicit-admission", derivedFrom: [], recordedAt: at },
    authority: { authorityType: "director", admittedBy: { type: "director", id: "d-1" }, grantReference: "grant://1", admittedAt: at },
    confidence: { level: "high" },
    source: { kind: "document", reference: "doc://1", originatedAt: at },
    relationships: [],
    admissionReference: { grantReference: "grant://1", policySetId: "policy-set-1", decidedAt: at },
    storedAt: at,
    concurrencyToken: "token-1",
  };
}

function ids(records: readonly { writeIdentity: { memoryId: string; version: number } }[]): string[] {
  return records.map((r) => `${r.writeIdentity.memoryId}:${r.writeIdentity.version}`);
}

async function main(): Promise<void> {
  const repository = createInMemoryMemoryRepository();
  // Insert out of id order to prove deterministic ordering is applied, not insertion order.
  repository.storeApprovedMemory(request("memory-b", "internal", "vendor"));
  repository.storeApprovedMemory(request("memory-a", "internal", "vendor"));
  repository.storeApprovedMemory(request("memory-c", "confidential", "policy"));
  repository.supersedeMemory({ ...request("memory-a", "internal", "vendor"), expectedCurrentVersion: 1 });
  repository.archiveMemory("memory-c", ns, at);

  const uow = createInMemoryMemoryUnitOfWork(repository, createInProcessEventBus());

  // Current + specific version.
  const current = await retrieveCurrentMemory(uow, "memory-a", ns);
  assert.ok(current.status === "Success" && current.value.writeIdentity.version === 2);
  const v1 = await retrieveMemoryVersion(uow, "memory-a", ns, 1);
  assert.ok(v1.status === "Success" && v1.value.metadata.isCurrent === false);

  // History ordered ascending by version.
  const history = await retrieveMemoryHistory(uow, "memory-a", ns);
  assert.ok(history.status === "Success");
  if (history.status === "Success") {
    assert.deepEqual(ids(history.value), ["memory-a:1", "memory-a:2"]);
    assert.equal(Object.isFrozen(history.value), true);
  }

  // Classification: current internal records, ordered by memory id (a before b); c excluded.
  const internal = await retrieveMemoriesByClassification(uow, { namespace: ns, sensitivity: "internal" });
  assert.ok(internal.status === "Success");
  if (internal.status === "Success") {
    assert.deepEqual(ids(internal.value), ["memory-a:2", "memory-b:1"]);
  }

  // Classification with category filter.
  const vendor = await retrieveMemoriesByClassification(uow, { namespace: ns, sensitivity: "internal", category: "vendor" });
  assert.ok(vendor.status === "Success" && vendor.value.length === 2);

  // Lifecycle approved: all approved records ordered by id then version; archived excluded.
  const approved = await retrieveMemoriesByLifecycle(uow, { namespace: ns, lifecycleState: "approved" });
  assert.ok(approved.status === "Success");
  if (approved.status === "Success") {
    assert.deepEqual(ids(approved.value), ["memory-a:1", "memory-a:2", "memory-b:1"]);
  }

  // Lifecycle archived: only memory-c.
  const archived = await retrieveMemoriesByLifecycle(uow, { namespace: ns, lifecycleState: "archived" });
  assert.ok(archived.status === "Success");
  if (archived.status === "Success") {
    assert.deepEqual(ids(archived.value), ["memory-c:1"]);
  }

  // Deterministic: repeated retrieval yields identical ordering.
  const repeat = await retrieveMemoriesByLifecycle(uow, { namespace: ns, lifecycleState: "approved" });
  assert.ok(repeat.status === "Success" && approved.status === "Success");
  if (repeat.status === "Success" && approved.status === "Success") {
    assert.deepEqual(ids(repeat.value), ids(approved.value));
  }

  console.log("Enterprise Memory Retrieval checks passed");
}

void main();
