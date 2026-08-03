import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, Pool } from "pg";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import type { MemorySensitivity } from "../../src/features/enterprise-memory";
import { createPostgresUnitOfWork } from "../../src/features/enterprise-unit-of-work";
import { createPostgresMemoryRepository } from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import { queryMemory } from "../../src/features/enterprise-memory-query";
import type { MemoryQuery } from "../../src/features/enterprise-memory-query";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

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

function migrationStatements(): readonly string[] {
  const sql = readFileSync(join(process.cwd(), "src", "db", "migrations", "20260803120000_enterprise_memory_persistence.sql"), "utf8");
  return sql.split("--> statement-breakpoint").map((s) => s.trim()).filter((s) => s.length > 0);
}

function ids(result: { status: string; value?: readonly { writeIdentity: { memoryId: string; version: number } }[] }): string {
  return result.status === "Success" && result.value ? result.value.map((r) => `${r.writeIdentity.memoryId}:${r.writeIdentity.version}`).join(",") : "<not-success>";
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_memory_query");
  await harness.createDatabase();
  const pool = new Pool({ connectionString: harness.dbUrl, max: 2 });
  const observer = new Client({ connectionString: harness.dbUrl });

  try {
    await observer.connect();
    for (const statement of migrationStatements()) await observer.query(statement);

    const uow = createPostgresUnitOfWork(pool, (client) => createPostgresMemoryRepository(client), createInProcessEventBus());
    await uow.execute(async ({ resources }) => resources.storeApprovedMemory(request("memory-a", "internal", "vendor", t1)));
    await uow.execute(async ({ resources }) => resources.storeApprovedMemory(request("memory-b", "internal", "vendor", t2)));
    await uow.execute(async ({ resources }) => resources.storeApprovedMemory(request("memory-c", "confidential", "policy", t3)));
    await uow.execute(async ({ resources }) => resources.supersedeMemory({ ...request("memory-a", "internal", "vendor", t4), expectedCurrentVersion: 1 }));
    await uow.execute(async ({ resources }) => resources.archiveMemory("memory-c", ns, t5));

    const run = (query: MemoryQuery) => queryMemory(uow, query);

    // PostgreSQL results match in-memory semantics and ordering.
    assert.equal(ids(await run({ namespace: ns })), "memory-a:1,memory-a:2,memory-b:1,memory-c:1");
    assert.equal(ids(await run({ namespace: ns, currentOnly: true })), "memory-a:2,memory-b:1");
    assert.equal(ids(await run({ namespace: ns, historical: true })), "memory-a:1,memory-c:1");
    assert.equal(ids(await run({ namespace: ns, sensitivity: "internal", currentOnly: true })), "memory-a:2,memory-b:1");
    assert.equal(ids(await run({ namespace: ns, lifecycleState: "archived" })), "memory-c:1");
    assert.equal(ids(await run({ namespace: ns, storedAfter: t2 })), "memory-a:2,memory-b:1,memory-c:1");
    assert.equal(ids(await run({ namespace: ns, memoryId: "memory-a" })), "memory-a:1,memory-a:2");

    const contradiction = await run({ namespace: ns, currentOnly: true, historical: true });
    assert.equal(contradiction.status, "ValidationFailure");

    console.log("Enterprise Memory Query PostgreSQL integration checks passed");
  } finally {
    await observer.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

void main();
