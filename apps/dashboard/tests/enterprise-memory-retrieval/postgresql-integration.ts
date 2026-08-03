import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, Pool } from "pg";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import type { MemorySensitivity } from "../../src/features/enterprise-memory";
import { createPostgresUnitOfWork } from "../../src/features/enterprise-unit-of-work";
import { createPostgresMemoryRepository } from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import {
  retrieveMemoriesByClassification,
  retrieveMemoriesByLifecycle,
  retrieveMemoryHistory,
} from "../../src/features/enterprise-memory-retrieval";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

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

function migrationStatements(): readonly string[] {
  const sql = readFileSync(
    join(process.cwd(), "src", "db", "migrations", "20260803120000_enterprise_memory_persistence.sql"),
    "utf8",
  );
  return sql.split("--> statement-breakpoint").map((s) => s.trim()).filter((s) => s.length > 0);
}

function ids(records: readonly { writeIdentity: { memoryId: string; version: number } }[]): string[] {
  return records.map((r) => `${r.writeIdentity.memoryId}:${r.writeIdentity.version}`);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_memory_retrieval");
  await harness.createDatabase();
  const pool = new Pool({ connectionString: harness.dbUrl, max: 2 });
  const observer = new Client({ connectionString: harness.dbUrl });

  try {
    await observer.connect();
    for (const statement of migrationStatements()) await observer.query(statement);

    const uow = createPostgresUnitOfWork(pool, (client) => createPostgresMemoryRepository(client), createInProcessEventBus());

    await uow.execute(async ({ resources }) => resources.storeApprovedMemory(request("memory-b", "internal", "vendor")));
    await uow.execute(async ({ resources }) => resources.storeApprovedMemory(request("memory-a", "internal", "vendor")));
    await uow.execute(async ({ resources }) => resources.storeApprovedMemory(request("memory-c", "confidential", "policy")));
    await uow.execute(async ({ resources }) => resources.supersedeMemory({ ...request("memory-a", "internal", "vendor"), expectedCurrentVersion: 1 }));
    await uow.execute(async ({ resources }) => resources.archiveMemory("memory-c", ns, at));

    // History ordered by version.
    const history = await retrieveMemoryHistory(uow, "memory-a", ns);
    assert.ok(history.status === "Success" && ids(history.value).join(",") === "memory-a:1,memory-a:2");

    // Classification: current internal records ordered by memory id; c excluded.
    const internal = await retrieveMemoriesByClassification(uow, { namespace: ns, sensitivity: "internal" });
    assert.ok(internal.status === "Success" && ids(internal.value).join(",") === "memory-a:2,memory-b:1");

    // Lifecycle approved ordered by id then version; archived excluded.
    const approved = await retrieveMemoriesByLifecycle(uow, { namespace: ns, lifecycleState: "approved" });
    assert.ok(approved.status === "Success" && ids(approved.value).join(",") === "memory-a:1,memory-a:2,memory-b:1");

    // Lifecycle archived: only memory-c.
    const archived = await retrieveMemoriesByLifecycle(uow, { namespace: ns, lifecycleState: "archived" });
    assert.ok(archived.status === "Success" && ids(archived.value).join(",") === "memory-c:1");

    console.log("Enterprise Memory Retrieval PostgreSQL integration checks passed");
  } finally {
    await observer.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

void main();
