import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Client, Pool } from "pg";
import { createInProcessEventBus } from "../../src/features/enterprise-event-bus";
import { createPostgresUnitOfWork } from "../../src/features/enterprise-unit-of-work";
import { createPostgresMemoryRepository } from "../../src/features/enterprise-memory-persistence";
import type { MemoryPersistenceRequest } from "../../src/features/enterprise-memory-persistence";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";

const at = "2026-08-03T12:00:00.000Z";

function request(memoryId: string): MemoryPersistenceRequest {
  return {
    memoryId,
    namespace: "enterprise-1",
    content: { statement: "SLA is 99.9%.", attributes: { uptime: 99.9 } },
    classification: { category: "vendor", sensitivity: "internal", tags: ["sla"] },
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
  return sql.split("--> statement-breakpoint").map((statement) => statement.trim()).filter((statement) => statement.length > 0);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_memory_persistence");
  await harness.createDatabase();
  const pool = new Pool({ connectionString: harness.dbUrl, max: 2 });
  const observer = new Client({ connectionString: harness.dbUrl });

  try {
    await observer.connect();
    for (const statement of migrationStatements()) await observer.query(statement);

    const unitOfWork = createPostgresUnitOfWork(
      pool,
      (client) => createPostgresMemoryRepository(client),
      createInProcessEventBus(),
    );

    // Store an approved memory inside a transaction; it commits and is readable.
    const stored = await unitOfWork.execute(async ({ resources: repository }) => repository.storeApprovedMemory(request("memory-1")));
    assert.equal(stored.value.status, "Success");
    const committed = await observer.query<{ count: string }>(
      "select count(*)::text as count from enterprise_memory_records where memory_id = $1",
      ["memory-1"],
    );
    assert.equal(committed.rows[0]?.count, "1");

    // Transaction rollback leaves no persisted memory.
    await assert.rejects(
      unitOfWork.execute(async ({ resources: repository }) => {
        const result = await repository.storeApprovedMemory(request("memory-rollback"));
        assert.equal(result.status, "Success");
        throw new Error("rollback requested");
      }),
      /rollback requested/,
    );
    const rolledBack = await observer.query<{ count: string }>(
      "select count(*)::text as count from enterprise_memory_records where memory_id = $1",
      ["memory-rollback"],
    );
    assert.equal(rolledBack.rows[0]?.count, "0");

    // Append-and-supersede across transactions; prior version remains available.
    const superseded = (await unitOfWork.execute(async ({ resources: repository }) =>
      repository.supersedeMemory({ ...request("memory-1"), expectedCurrentVersion: 1 }),
    )).value;
    assert.ok(superseded.status === "Success" && superseded.value.writeIdentity.version === 2);

    const currentVersion = (await unitOfWork.execute(async ({ resources: repository }) =>
      repository.loadCurrentMemoryVersion("memory-1", "enterprise-1"),
    )).value;
    assert.ok(currentVersion.status === "Success" && currentVersion.value.writeIdentity.version === 2);

    const priorVersion = (await unitOfWork.execute(async ({ resources: repository }) =>
      repository.loadMemoryById("memory-1", "enterprise-1", 1),
    )).value;
    assert.ok(priorVersion.status === "Success" && priorVersion.value.metadata.isCurrent === false);

    // Stale supersession is an explicit version conflict.
    const conflict = await unitOfWork.execute(async ({ resources: repository }) =>
      repository.supersedeMemory({ ...request("memory-1"), expectedCurrentVersion: 1 }),
    );
    assert.equal(conflict.value.status, "Conflict");

    console.log("Enterprise Memory Persistence PostgreSQL integration checks passed");
  } finally {
    await observer.end();
    await pool.end();
    await harness.dropDatabase();
  }
}

void main();
