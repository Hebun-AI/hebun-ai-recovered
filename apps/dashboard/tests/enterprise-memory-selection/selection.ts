import assert from "node:assert/strict";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import type { MemoryConfidenceLevel, MemorySensitivity } from "../../src/features/enterprise-memory";
import {
  createInMemoryMemoryRepository,
  createInMemoryMemoryUnitOfWork,
} from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import { selectMemory } from "../../src/features/enterprise-memory-selection";
import type { SelectionPolicy, SelectionResult } from "../../src/features/enterprise-memory-selection";

const ns = "enterprise-1";
const t1 = "2026-08-01T00:00:00.000Z";
const t2 = "2026-08-02T00:00:00.000Z";
const t3 = "2026-08-03T00:00:00.000Z";
const t4 = "2026-08-04T00:00:00.000Z";

function request(memoryId: string, level: MemoryConfidenceLevel, sensitivity: MemorySensitivity, storedAt: string): MemoryPersistenceRequest {
  return {
    memoryId,
    namespace: ns,
    content: { statement: memoryId, attributes: {} },
    classification: { category: "vendor", sensitivity, tags: [] },
    provenance: { method: "explicit-admission", derivedFrom: [], recordedAt: storedAt },
    authority: { authorityType: "director", admittedBy: { type: "director", id: "d-1" }, grantReference: "grant://1", admittedAt: storedAt },
    confidence: { level },
    source: { kind: "document", reference: "doc://1", originatedAt: storedAt },
    relationships: [],
    admissionReference: { grantReference: "grant://1", policySetId: "policy-set-1", decidedAt: storedAt },
    storedAt,
    concurrencyToken: "token-1",
  };
}

function ids(result: SelectionResult): string[] {
  return result.status === "Success" ? result.value.selected.map((r) => `${r.writeIdentity.memoryId}:${r.writeIdentity.version}`) : ["<not-success>"];
}

async function main(): Promise<void> {
  const repository = createInMemoryMemoryRepository();
  repository.storeApprovedMemory(request("memory-a", "high", "internal", t1));
  repository.storeApprovedMemory(request("memory-b", "verified", "internal", t2));
  repository.storeApprovedMemory(request("memory-c", "low", "confidential", t4));
  repository.supersedeMemory({ ...request("memory-a", "high", "internal", t3), expectedCurrentVersion: 1 });
  repository.archiveMemory("memory-c", ns, t4);

  const uow = createInMemoryMemoryUnitOfWork(repository, createInProcessEventBus());
  const select = (policy: SelectionPolicy) => selectMemory(uow, { namespace: ns }, policy);

  // No policy: all candidates, identity order, totalConsidered reported.
  const all = await select({});
  assert.deepEqual(ids(all), ["memory-a:1", "memory-a:2", "memory-b:1", "memory-c:1"]);
  assert.ok(all.status === "Success" && all.value.totalConsidered === 4);

  // requireCurrent: only current versions.
  assert.deepEqual(ids(await select({ requireCurrent: true })), ["memory-a:2", "memory-b:1"]);

  // confidence-desc prioritization: verified > high > low, identity tie-break.
  assert.deepEqual(ids(await select({ prioritize: ["confidence-desc"] })), ["memory-b:1", "memory-a:1", "memory-a:2", "memory-c:1"]);

  // current-first + limit: bounded context.
  assert.deepEqual(ids(await select({ prioritize: ["current-first"], limit: 2 })), ["memory-a:2", "memory-b:1"]);

  // minConfidenceLevel filter.
  assert.deepEqual(ids(await select({ minConfidenceLevel: "high" })), ["memory-a:1", "memory-a:2", "memory-b:1"]);

  // sensitivity filter.
  assert.deepEqual(ids(await select({ sensitivity: "confidential" })), ["memory-c:1"]);

  // limit 0: empty selection, candidates still counted.
  const none = await select({ limit: 0 });
  assert.ok(none.status === "Success" && none.value.selected.length === 0 && none.value.totalConsidered === 4);

  // Immutable outputs.
  const frozen = await select({ requireCurrent: true });
  assert.ok(frozen.status === "Success");
  if (frozen.status === "Success") {
    assert.equal(Object.isFrozen(frozen.value), true);
    assert.equal(Object.isFrozen(frozen.value.selected), true);
    assert.equal(Object.isFrozen(frozen.value.reasons), true);
    // Explainable reasons present per selected record.
    assert.equal(frozen.value.reasons.length, frozen.value.selected.length);
    assert.ok(frozen.value.reasons[0].reasons.some((r) => r.includes("current version required")));
  }

  // Deterministic repeat.
  const a = await select({ prioritize: ["confidence-desc"], limit: 3 });
  const b = await select({ prioritize: ["confidence-desc"], limit: 3 });
  assert.deepEqual(ids(a), ids(b));

  // Validation: contradictory / malformed policies fail explicitly.
  assert.equal((await select({ limit: -1 })).status, "ValidationFailure");
  assert.equal((await select({ requireCurrent: true, lifecycleState: "archived" })).status, "ValidationFailure");
  assert.equal((await select({ prioritize: ["version-asc", "version-desc"] })).status, "ValidationFailure");

  console.log("Enterprise Memory Selection checks passed");
}

void main();
