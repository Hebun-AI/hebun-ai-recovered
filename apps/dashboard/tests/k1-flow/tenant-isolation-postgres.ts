/*
 * K1 — tenant isolation proved against a REAL PostgreSQL database.
 *
 * The fake-repository proofs show the read service never leaks a tenant it was given. This file
 * proves the thing they cannot: that the actual SQL, run against the actual migrated schema with
 * real rows for two organizations, keeps them apart — including the join to the active knowledge
 * node, which is scoped on BOTH sides so a fact can never resolve its content through another
 * tenant's row.
 *
 * It also proves the read is genuinely a READ of the canonical model: rows inserted directly into
 * knowledge_facts / knowledge_nodes come back with their governance metadata intact, which is only
 * possible because K1 reads the authority that already exists rather than a store of its own.
 *
 * Uses a disposable local database, dropped on exit. No production data is touched.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import {
  listKnowledgeSources,
  readKnowledgeSourceByName,
} from "../../src/features/knowledge/knowledge-read.server";

const TENANT_A = "10000000-0000-4000-8000-0000000000a1";
const TENANT_B = "10000000-0000-4000-8000-0000000000b1";
const NODE_A = "90000000-0000-4000-8000-0000000000a1";
const NODE_B = "90000000-0000-4000-8000-0000000000b1";
const FACT_A = "80000000-0000-4000-8000-0000000000a1";
const FACT_B = "80000000-0000-4000-8000-0000000000b1";
const ORPHAN_FACT = "80000000-0000-4000-8000-0000000000c1";

const NOW = new Date("2026-08-11T00:00:00.000Z");

async function seed(client: Client): Promise<void> {
  await client.query(
    `insert into companies (id, name, slug)
     values ($1, 'Tenant A', 'tenant-a'), ($2, 'Tenant B', 'tenant-b')`,
    [TENANT_A, TENANT_B],
  );

  // Two knowledge nodes: one per tenant, with real governance metadata.
  await client.query(
    `insert into knowledge_nodes
       (id, tenant_id, type, label, statement, knowledge_lifecycle_status, knowledge_health,
        knowledge_scope, knowledge_authority, domain_key, ratified_at, next_review_at,
        knowledge_version)
     values
       ($1, $2, 'policy', 'Tenant A security policy',
        'Provider execution authority belongs to the Director.',
        'ratified', 'current', 'company-wide', 'authoritative', 'security',
        '2026-01-01T00:00:00Z', '2026-12-01T00:00:00Z', 3),
       ($3, $4, 'policy', 'Tenant B security policy',
        'TENANT B PRIVATE — this string must never reach tenant A.',
        'draft', 'unknown', 'company-wide', 'provisional', 'security',
        null, null, 1)`,
    [NODE_A, TENANT_A, NODE_B, TENANT_B],
  );

  // Both tenants use the SAME fact key, which is exactly the collision isolation must survive.
  await client.query(
    `insert into knowledge_facts
       (id, tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
     values
       ($1, $2, 'security-policy', 'security', 'company-wide', $3, 1),
       ($4, $5, 'security-policy', 'security', 'company-wide', $6, 1)`,
    [FACT_A, TENANT_A, NODE_A, FACT_B, TENANT_B, NODE_B],
  );

  // A fact for tenant A whose active node is missing — it must surface as incomplete, not as a
  // record with an invented title.
  await client.query(
    `insert into knowledge_facts
       (id, tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
     values ($1, $2, 'orphan-fact', 'operations', 'domain', null, 1)`,
    [ORPHAN_FACT, TENANT_A],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_k1_knowledge");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const client = new Client({ connectionString: harness.dbUrl });
    await client.connect();
    try {
      await seed(client);
    } finally {
      await client.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    try {
      const repo = createDurableKnowledgeRepository(handle.db);
      const deps = { getRepo: () => repo, now: () => NOW };

      /* ── 31. EACH TENANT SEES ONLY ITS OWN KNOWLEDGE ───────────────────── */
      const listA = await listKnowledgeSources({ tenantId: TENANT_A }, deps);
      assert.equal(listA.status, "read");
      if (listA.status !== "read") throw new Error("unreachable");

      assert.equal(listA.records.length, 1, "tenant A sees exactly its own readable fact");
      const a = listA.records[0]!;
      assert.equal(a.factKey, "security-policy");
      assert.equal(a.title, "Tenant A security policy");
      assert.equal(a.authorityClass, "authoritative");
      assert.equal(a.lifecycleStatus, "ratified");
      assert.equal(a.ratified, true, "ratification is read from the record, not inferred");
      assert.equal(a.knowledgeVersion, 3, "the record's own version is preserved");
      assert.equal(a.freshness, "within-cadence", "freshness is derived from the real review date");
      assert.ok(
        !JSON.stringify(listA).includes("TENANT B PRIVATE"),
        "tenant B's statement never appears in tenant A's read",
      );

      // The orphan fact is reported apart from readable records, never merged into them.
      assert.equal(listA.incomplete.length, 1, "the orphaned fact is reported separately");
      assert.equal(listA.incomplete[0]!.factKey, "orphan-fact");
      assert.equal(listA.incomplete[0]!.reason, "active-node-missing");
      assert.equal(listA.truncated, false);

      const listB = await listKnowledgeSources({ tenantId: TENANT_B }, deps);
      assert.equal(listB.status, "read");
      if (listB.status !== "read") throw new Error("unreachable");
      assert.equal(listB.records.length, 1);
      assert.equal(listB.records[0]!.title, "Tenant B security policy");
      // Tenant B's own record keeps its honest, unflattering standing.
      assert.equal(listB.records[0]!.authorityClass, "provisional");
      assert.equal(listB.records[0]!.ratified, false, "no ratification recorded means no ratification");
      assert.equal(listB.records[0]!.freshness, "unknown", "no review date means unknown freshness");

      /* ── 32. THE SAME FACT KEY RESOLVES PER TENANT, NEVER ACROSS ───────── */
      const readA = await readKnowledgeSourceByName({ tenantId: TENANT_A }, "security-policy", deps);
      assert.equal(readA.status, "found");
      if (readA.status !== "found") throw new Error("unreachable");
      assert.equal(readA.record.title, "Tenant A security policy");
      assert.ok(
        !readA.record.statement!.includes("TENANT B PRIVATE"),
        "the tenant-scoped join never crosses into tenant B's node",
      );

      const readB = await readKnowledgeSourceByName({ tenantId: TENANT_B }, "security-policy", deps);
      assert.equal(readB.status, "found");
      if (readB.status !== "found") throw new Error("unreachable");
      assert.equal(readB.record.title, "Tenant B security policy");

      /* ── 33. AN UNKNOWN TENANT READS NOTHING ───────────────────────────── */
      const stranger = { tenantId: "10000000-0000-4000-8000-0000000000ff" };
      const listStranger = await listKnowledgeSources(stranger, deps);
      assert.equal(listStranger.status, "read");
      if (listStranger.status !== "read") throw new Error("unreachable");
      assert.equal(listStranger.records.length, 0, "an unknown tenant sees no knowledge");
      assert.equal(listStranger.incomplete.length, 0);

      const readStranger = await readKnowledgeSourceByName(stranger, "security-policy", deps);
      assert.equal(readStranger.status, "not-found", "and cannot read a fact key it does not own");

      // A malformed tenant identifier fails closed rather than erroring into a wider query.
      const malformed = await listKnowledgeSources({ tenantId: "not-a-uuid" }, deps);
      assert.equal(malformed.status, "read");
      if (malformed.status !== "read") throw new Error("unreachable");
      assert.equal(malformed.records.length, 0, "a non-uuid tenant matches nothing");

      /* ── 34. AN ORPHANED FACT IS INCOMPLETE, NOT INVENTED ──────────────── */
      const orphan = await readKnowledgeSourceByName({ tenantId: TENANT_A }, "orphan-fact", deps);
      assert.equal(orphan.status, "incomplete");
      if (orphan.status !== "incomplete") throw new Error("unreachable");
      assert.equal(orphan.stub.domainKey, "operations");
      assert.equal(orphan.stub.scope, "domain");

      /* ── 35. K1 WROTE NOTHING ──────────────────────────────────────────── */
      const verify = new Client({ connectionString: harness.dbUrl });
      await verify.connect();
      try {
        const counts = await verify.query<{ facts: string; nodes: string }>(
          `select (select count(*)::text from knowledge_facts) as facts,
                  (select count(*)::text from knowledge_nodes) as nodes`,
        );
        assert.equal(counts.rows[0]?.facts, "3", "no fact was created or removed by the reads");
        assert.equal(counts.rows[0]?.nodes, "2", "no node was created or removed by the reads");
      } finally {
        await verify.end();
      }
    } finally {
      await handle.dispose();
    }

    console.log("k1 tenant-isolation-postgres checks passed");
  } finally {
    await harness.dropDatabase();
  }
}

void main();
