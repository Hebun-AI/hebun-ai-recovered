import assert from "node:assert/strict";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import type { MemorySensitivity } from "../../src/features/enterprise-memory";
import {
  createInMemoryMemoryRepository,
  createInMemoryMemoryUnitOfWork,
} from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import { assembleMemoryContext } from "../../src/features/enterprise-memory-context";
import type { AssemblyPolicy, AssemblyResult } from "../../src/features/enterprise-memory-context";

const ns = "enterprise-1";
const t1 = "2026-08-01T00:00:00.000Z";
const t2 = "2026-08-02T00:00:00.000Z";
const t3 = "2026-08-03T00:00:00.000Z";
const t4 = "2026-08-04T00:00:00.000Z";

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

/** Flattens a result into "key=[id:ver,...]" per group, in group order. */
function shape(result: AssemblyResult): string[] {
  if (result.status !== "Success") return ["<not-success>"];
  return result.value.groups.map(
    (g) => `${g.key}=[${g.entries.map((e) => `${e.record.writeIdentity.memoryId}:${e.record.writeIdentity.version}`).join(",")}]`,
  );
}

async function main(): Promise<void> {
  const repository = createInMemoryMemoryRepository();
  repository.storeApprovedMemory(request("memory-a", "internal", "vendor", t1));
  repository.storeApprovedMemory(request("memory-b", "internal", "vendor", t2));
  repository.storeApprovedMemory(request("memory-c", "confidential", "policy", t3));
  repository.supersedeMemory({ ...request("memory-a", "internal", "vendor", t4), expectedCurrentVersion: 1 });
  repository.archiveMemory("memory-c", ns, t4);

  const uow = createInMemoryMemoryUnitOfWork(repository, createInProcessEventBus());
  const assemble = (policy: AssemblyPolicy) => assembleMemoryContext(uow, { namespace: ns }, {}, policy);

  // Default: single "all" group, selection order preserved.
  assert.deepEqual(shape(await assemble({})), ["all=[memory-a:1,memory-a:2,memory-b:1,memory-c:1]"]);

  // Dedup by-memory-latest: one record per memory, highest version.
  assert.deepEqual(shape(await assemble({ dedup: "by-memory-latest" })), ["all=[memory-a:2,memory-b:1,memory-c:1]"]);
  // Dedup by-memory-first: earliest version per memory.
  assert.deepEqual(shape(await assemble({ dedup: "by-memory-first" })), ["all=[memory-a:1,memory-b:1,memory-c:1]"]);

  // Grouping by sensitivity: groups in ascending key order, c excluded from internal.
  assert.deepEqual(shape(await assemble({ groupBy: "sensitivity" })), [
    "confidential=[memory-c:1]",
    "internal=[memory-a:1,memory-a:2,memory-b:1]",
  ]);
  // Grouping by lifecycle.
  assert.deepEqual(shape(await assemble({ groupBy: "lifecycle" })), [
    "approved=[memory-a:1,memory-a:2,memory-b:1]",
    "archived=[memory-c:1]",
  ]);

  // Ordering version-desc.
  assert.deepEqual(shape(await assemble({ order: "version-desc" })), ["all=[memory-a:2,memory-a:1,memory-b:1,memory-c:1]"]);
  // Ordering stored-newest (a:2 t4 > c:1 t3 > b:1 t2 > a:1 t1).
  assert.deepEqual(shape(await assemble({ order: "stored-newest" })), ["all=[memory-a:2,memory-c:1,memory-b:1,memory-a:1]"]);

  // Bounded context.
  assert.deepEqual(shape(await assemble({ order: "version-desc", limit: 2 })), ["all=[memory-a:2,memory-a:1]"]);

  // Combined: dedup latest + group by memory-id + order memory-id-asc.
  assert.deepEqual(shape(await assemble({ dedup: "by-memory-latest", groupBy: "memory-id", order: "memory-id-asc" })), [
    "memory-a=[memory-a:2]",
    "memory-b=[memory-b:1]",
    "memory-c=[memory-c:1]",
  ]);

  // Immutable outputs + metadata + explanation preserved.
  const frozen = await assemble({ dedup: "by-memory-latest" });
  assert.ok(frozen.status === "Success");
  if (frozen.status === "Success") {
    assert.equal(Object.isFrozen(frozen.value), true);
    assert.equal(Object.isFrozen(frozen.value.groups), true);
    assert.equal(Object.isFrozen(frozen.value.groups[0].entries), true);
    assert.equal(frozen.value.sourceSelectionSize, 4);
    assert.equal(frozen.value.totalRecords, 3);
    const entry = frozen.value.groups[0].entries[0];
    assert.ok(entry.record.metadata !== undefined); // metadata preserved
    assert.ok(entry.selectionReason !== undefined && entry.selectionReason.reasons.length > 0); // explanation preserved
  }

  // Validation: negative limit.
  assert.equal((await assemble({ limit: -1 })).status, "ValidationFailure");

  // Deterministic repeat.
  const a = await assemble({ dedup: "by-memory-latest", groupBy: "sensitivity", order: "memory-id-asc" });
  const b = await assemble({ dedup: "by-memory-latest", groupBy: "sensitivity", order: "memory-id-asc" });
  assert.deepEqual(shape(a), shape(b));

  console.log("Enterprise Memory Context assembly checks passed");
}

void main();
