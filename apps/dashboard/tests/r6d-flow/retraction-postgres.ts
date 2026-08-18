/*
 * R6D — SOURCE RETRACTION AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "One ingestion source is withdrawn from active Knowledge atomically, inside its own tenant,
 *    without deleting anything — and the readers that already existed stop serving it with no
 *    knowledge of retraction whatsoever."
 *
 * The last clause is the load-bearing one. R6D writes an EXISTING terminal lifecycle value, so KR3
 * retrieval and R6B coverage react through the semantics they already had. If either needed a
 * special case, the design would be wrong.
 *
 * Disposable database, dropped on exit. Canonical is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { retractKnowledgeSource } from "../../src/features/knowledge/retract-source.server";
import { projectCompanyUnderstanding } from "../../src/features/knowledge/company-understanding";
import { partitionByEligibility } from "../../src/features/knowledge-retrieval";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const ACTOR_A = "20000000-0000-4000-8000-00000000a002";
const ACTOR_B = "20000000-0000-4000-8000-00000000b002";
const RATIFIER = "20000000-0000-4000-8000-00000000a009";

const NOW = new Date("2026-08-18T12:00:00.000Z");

/** Digests are sha256-shaped: 64 lowercase hex. */
const DIGEST_ONE = "a".repeat(64);
const DIGEST_TWO = "b".repeat(64);
const DIGEST_RATIFIED = "c".repeat(64);
const DIGEST_ABSENT = "d".repeat(64);
const DIGEST_TENANT_B = "e".repeat(64);

let seq = 0;
const uuid = (prefix: string) => `${prefix}${String((seq += 1)).padStart(12, "0")}`;

function tenantOf(tenantId: string, userId: string): TenantContext {
  return { tenantId, userId, roleId: uuid("30000000-0000-4000-8000-") } as TenantContext;
}

/** The authority the act resolves. Injected, so no role rows are needed to prove the mutation. */
const AUTHORIZED = async () => ({ authorized: true, roleType: "owner" });
const FORBIDDEN = async () => ({ authorized: false, roleType: "member" });

interface SeedChunk {
  readonly tenantId: string;
  readonly digest: string | null;
  readonly domainKey: string;
  readonly factKey: string;
  readonly sourceTitle?: string;
  readonly ratified?: boolean;
  readonly lifecycle?: string;
}

async function seedChunk(client: Client, chunk: SeedChunk): Promise<{ factId: string; nodeId: string }> {
  const nodeId = uuid("90000000-0000-4000-8000-");
  const factId = uuid("80000000-0000-4000-8000-");
  let decisionId: string | null = null;
  let sessionId: string | null = null;

  if (chunk.ratified) {
    const session = await client.query<{ id: string }>(
      `insert into governance_sessions
         (tenant_id, governance_domain, decision_type, subject_type, proposer_actor_type, proposer_actor_id)
       values ($1, 'knowledge-ratification', 'ratify', 'knowledge_node', 'human', $2) returning id`,
      [chunk.tenantId, RATIFIER],
    );
    sessionId = session.rows[0]!.id;
    const decision = await client.query<{ id: string }>(
      `insert into decision_records
         (tenant_id, session_id, decision_type, subject_type, subject_id, actor_type, actor_id,
          bootstrap, outcome, justification)
       values ($1, $2, 'ratify', 'knowledge_node', $3, 'human', $4, false, 'ratified',
               'Seeded: Governance approved this exact version.') returning id`,
      [chunk.tenantId, sessionId, nodeId, RATIFIER],
    );
    decisionId = decision.rows[0]!.id;
  }

  /*
   * Provenance is shaped EXACTLY as `durable-knowledge-writer.server.ts` writes it for an ingested
   * chunk. A `null` digest is the hand-authored shape: the key is absent, not empty.
   */
  const provenance = chunk.digest
    ? {
        origin: "human-ingested",
        authoredThrough: "hebun-knowledge-workspace",
        submittedAt: NOW.toISOString(),
        textOriginUnverified: true,
        sourceType: "plain-text",
        sourceTitle: chunk.sourceTitle ?? "Seeded source",
        sourceDigest: chunk.digest,
        chunkIndex: 0,
        chunkCount: 1,
      }
    : {
        origin: "human-authored",
        authoredThrough: "hebun-knowledge-workspace",
        submittedAt: NOW.toISOString(),
        textOriginUnverified: true,
      };

  await client.query(
    `insert into knowledge_nodes
       (id, tenant_id, type, label, statement, knowledge_lifecycle_status, knowledge_health,
        knowledge_scope, knowledge_authority, domain_key, knowledge_version, provenance,
        ratification_decision_id, governance_session_id, ratified_at, ratified_by_actor_type,
        ratified_by_actor_id)
     values ($1, $2, 'knowledge-statement', $3, 'Seeded statement.', $4, 'unknown',
             'company-wide', 'provisional', $5, 1, $6, $7, $8, $9, $10, $11)`,
    [
      nodeId,
      chunk.tenantId,
      `${chunk.domainKey}/${chunk.factKey}`,
      chunk.lifecycle ?? "draft",
      chunk.domainKey,
      JSON.stringify(provenance),
      decisionId,
      sessionId,
      chunk.ratified ? NOW.toISOString() : null,
      chunk.ratified ? "human" : null,
      chunk.ratified ? RATIFIER : null,
    ],
  );
  await client.query(
    `insert into knowledge_facts
       (id, tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
     values ($1, $2, $3, $4, 'company-wide', $5, 1)`,
    [factId, chunk.tenantId, chunk.factKey, chunk.domainKey, nodeId],
  );
  return { factId, nodeId };
}

async function count(client: Client, table: string, where = ""): Promise<number> {
  const result = await client.query<{ n: string }>(
    `select count(*)::text as n from ${table} ${where}`,
  );
  return Number(result.rows[0]!.n);
}

/** The node columns these assertions read. Typed so a shape change breaks here, not silently. */
interface NodeRow extends Record<string, unknown> {
  readonly knowledge_lifecycle_status: string | null;
  readonly retired_at: Date | string | null;
  readonly updated_by: string | null;
  readonly updated_by_type: string | null;
  readonly statement: string | null;
  readonly knowledge_version: number;
  readonly provenance: { readonly sourceDigest?: string } | null;
}

async function nodeRow(client: Client, nodeId: string): Promise<NodeRow> {
  const result = await client.query<NodeRow>(
    `select * from knowledge_nodes where id = $1`,
    [nodeId],
  );
  return result.rows[0]!;
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r6d_retraction");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const pool = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();
    await pool.connect();
    const db = drizzle(pool) as unknown as ControlPlaneDatabase;
    const repo = createDurableKnowledgeRepository(db);
    const deps = { getDb: () => db, resolveAuthority: AUTHORIZED, now: () => NOW };
    const tenantA = tenantOf(TENANT_A, ACTOR_A);

    await client.query(
      `insert into companies (id, name, slug) values ($1,'Tenant A','tenant-a'), ($2,'Tenant B','tenant-b')`,
      [TENANT_A, TENANT_B],
    );

    /* Source ONE: five chunks under `policies`. Source TWO: three under `systems`. */
    const sourceOne = [];
    for (let index = 0; index < 5; index += 1) {
      sourceOne.push(
        await seedChunk(client, {
          tenantId: TENANT_A,
          digest: DIGEST_ONE,
          domainKey: "policies",
          factKey: `one-${index}`,
          sourceTitle: "Handbook",
        }),
      );
    }
    const sourceTwo = [];
    for (let index = 0; index < 3; index += 1) {
      sourceTwo.push(
        await seedChunk(client, {
          tenantId: TENANT_A,
          digest: DIGEST_TWO,
          domainKey: "systems",
          factKey: `two-${index}`,
          sourceTitle: "Tooling",
        }),
      );
    }
    /* A hand-authored fact with NO source digest — it must be untouchable by a source-level act. */
    const authored = await seedChunk(client, {
      tenantId: TENANT_A,
      digest: null,
      domainKey: "policies",
      factKey: "hand-authored",
    });

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. THE SOURCE LISTING SEES INGESTED SOURCES ONLY.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const sources = await repo.listIngestedSources({ tenantId: TENANT_A });
      assert.equal(sources.length, 2, "the hand-authored fact is not a source");
      const one = sources.find((source) => source.sourceDigest === DIGEST_ONE)!;
      assert.equal(one.liveFactCount, 5);
      assert.equal(one.ratifiedFactCount, 0);
      assert.equal(one.retiredFactCount, 0);
      assert.deepEqual(one.sourceTitles, ["Handbook"]);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. GATES REFUSE BEFORE ANY MUTATION, IN ORDER.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = await count(client, "audit_log");

      assert.equal(
        (await retractKnowledgeSource(null, { sourceDigest: DIGEST_ONE }, deps)).status,
        "refused",
      );
      const forbidden = await retractKnowledgeSource(tenantA, { sourceDigest: DIGEST_ONE }, {
        ...deps,
        resolveAuthority: FORBIDDEN,
      });
      assert.equal(forbidden.status === "refused" && forbidden.reason, "forbidden");

      /* A malformed identity is refused BEFORE a statement runs, not turned into an empty lookup. */
      for (const bad of ["", "not-a-digest", "A".repeat(64), "a".repeat(63)]) {
        const result = await retractKnowledgeSource(tenantA, { sourceDigest: bad }, deps);
        assert.equal(
          result.status === "refused" && result.reason,
          "invalid-source-identity",
          `"${bad}" must be refused as malformed`,
        );
      }

      const absent = await retractKnowledgeSource(tenantA, { sourceDigest: DIGEST_ABSENT }, deps);
      assert.equal(absent.status === "refused" && absent.reason, "source-not-found");

      assert.equal(await count(client, "audit_log"), before, "a refused attempt writes no audit row");
      assert.equal(
        await count(client, "knowledge_nodes", `where knowledge_lifecycle_status = 'retired'`),
        0,
        "and mutates nothing",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. TENANT ISOLATION — another tenant's digest is indistinguishable from absent.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const bFact = await seedChunk(client, {
        tenantId: TENANT_B,
        digest: DIGEST_TENANT_B,
        domainKey: "policies",
        factKey: "b-one",
        sourceTitle: "Tenant B handbook",
      });

      const crossed = await retractKnowledgeSource(
        tenantA,
        { sourceDigest: DIGEST_TENANT_B },
        deps,
      );
      assert.equal(
        crossed.status === "refused" && crossed.reason,
        "source-not-found",
        "tenant A cannot retract tenant B's source, and cannot tell it exists",
      );
      const row = await nodeRow(client, bFact.nodeId);
      assert.equal(row.knowledge_lifecycle_status, "draft", "tenant B's node is untouched");
      assert.equal(row.retired_at, null);

      /* And tenant A's own digest is equally invisible to tenant B. */
      const reverse = await retractKnowledgeSource(
        tenantOf(TENANT_B, ACTOR_B),
        { sourceDigest: DIGEST_ONE },
        deps,
      );
      assert.equal(reverse.status === "refused" && reverse.reason, "source-not-found");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. THE RETRACTION ITSELF — atomic, complete, and not a deletion.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const nodesBefore = await count(client, "knowledge_nodes");
      const factsBefore = await count(client, "knowledge_facts");
      const auditBefore = await count(client, "audit_log");
      const untouchedBefore = JSON.stringify(await nodeRow(client, sourceTwo[0]!.nodeId));
      const authoredBefore = JSON.stringify(await nodeRow(client, authored.nodeId));

      const result = await retractKnowledgeSource(tenantA, { sourceDigest: DIGEST_ONE }, deps);
      assert.equal(result.status, "retracted");
      if (result.status !== "retracted") throw new Error("unreachable");
      assert.equal(result.source.retractedFactCount, 5, "every chunk of the source moved together");

      /* NOTHING WAS DELETED. Row counts are unchanged; only a lifecycle moved. */
      assert.equal(await count(client, "knowledge_nodes"), nodesBefore, "no node was deleted");
      assert.equal(await count(client, "knowledge_facts"), factsBefore, "no fact was deleted");

      for (const seeded of sourceOne) {
        const row = await nodeRow(client, seeded.nodeId);
        assert.equal(row.knowledge_lifecycle_status, "retired");
        assert.equal(new Date(row.retired_at as string).toISOString(), NOW.toISOString());
        assert.equal(row.updated_by, ACTOR_A, "the acting human is recorded");
        assert.equal(row.updated_by_type, "human");
        assert.ok(row.statement, "the statement is preserved, not blanked");
        assert.equal(row.knowledge_version, 1, "the version counter is not disturbed");
        assert.equal(row.provenance?.sourceDigest, DIGEST_ONE, "provenance survives");
      }

      /* The fact still points at its node, so history stays reachable. */
      const stillSelected = await client.query<{ n: string }>(
        `select count(*)::text as n from knowledge_facts f
          join knowledge_nodes n on n.id = f.active_knowledge_node_id
         where n.provenance->>'sourceDigest' = $1`,
        [DIGEST_ONE],
      );
      assert.equal(Number(stillSelected.rows[0]!.n), 5, "the selection is intact; only standing moved");

      /* UNRELATED KNOWLEDGE IS BYTE-IDENTICAL. */
      assert.equal(JSON.stringify(await nodeRow(client, sourceTwo[0]!.nodeId)), untouchedBefore);
      assert.equal(JSON.stringify(await nodeRow(client, authored.nodeId)), authoredBefore);

      /* AUDIT: exactly one committed `knowledge.retract` per fact, and nothing else. */
      assert.equal(await count(client, "audit_log"), auditBefore + 5, "one event per fact");
      const events = await client.query<{
        action: string;
        result: string;
        actor_id: string;
        actor_type: string;
        tenant_id: string;
        metadata: Record<string, unknown>;
      }>(`select action, result, actor_id, actor_type, tenant_id, metadata from audit_log
           where action = 'knowledge.retract'`);
      assert.equal(events.rows.length, 5);
      for (const event of events.rows) {
        assert.equal(event.result, "committed");
        assert.equal(event.actor_type, "human");
        assert.equal(event.actor_id, ACTOR_A, "never a fabricated actor");
        assert.equal(event.tenant_id, TENANT_A);
        assert.equal(event.metadata.retractedSourceDigest, DIGEST_ONE);
        assert.equal(event.metadata.retractedFactCount, 5);
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. REPEATING IT IS DETERMINISTIC AND WRITES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const auditBefore = await count(client, "audit_log");
      const again = await retractKnowledgeSource(tenantA, { sourceDigest: DIGEST_ONE }, deps);
      assert.equal(
        again.status === "refused" && again.reason,
        "source-not-found",
        "a fully retracted source has nothing live left to withdraw",
      );
      assert.equal(await count(client, "audit_log"), auditBefore, "and files no second mutation");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. THE READERS REACT WITHOUT KNOWING RETRACTION EXISTS.
     *
     * KR3 excludes `retired` as terminal; R6B counts it as withdrawn. Neither was changed by R6D,
     * and that is the whole argument for reusing the existing lifecycle value.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const listed = await repo.listFacts({ tenantId: TENANT_A }, NOW);
      const retracted = listed.records.filter((record) => record.factKey.startsWith("one-"));
      assert.equal(retracted.length, 5, "the records are still readable in history");
      assert.ok(
        retracted.every((record) => record.lifecycleStatus === "retired"),
        "and they state their own withdrawn standing",
      );

      /* Heby's retrieval path drops them, and REPORTS the exclusion rather than hiding it. */
      const { eligible, excluded } = partitionByEligibility(listed.records, NOW);
      assert.ok(
        eligible.every((record) => !record.factKey.startsWith("one-")),
        "no retracted record survives retrieval eligibility",
      );
      assert.equal(
        excluded.filter((entry) => entry.reason === "lifecycle-retired").length,
        5,
        "each is excluded for the real reason",
      );

      /* R6B: the category the source held up alone becomes MISSING. */
      const view = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      const policies = view.categories.find((category) => category.key === "policies")!;
      assert.equal(
        policies.recordCount,
        1,
        "only the hand-authored fact remains in force under policies",
      );
      assert.equal(policies.withdrawnCount, 5, "the retracted records are reported, not erased");
      assert.equal(policies.state, "covered", "one surviving fact still covers the area");

      const systems = view.categories.find((category) => category.key === "systems")!;
      assert.equal(systems.recordCount, 3, "an unrelated category is unchanged");
      assert.equal(systems.state, "covered");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. RETRACTING THE LAST SOURCE IN A CATEGORY TURNS IT MISSING.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      ).categories.find((category) => category.key === "systems")!;
      assert.equal(before.state, "covered");

      const result = await retractKnowledgeSource(tenantA, { sourceDigest: DIGEST_TWO }, deps);
      assert.equal(result.status, "retracted");

      const after = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      ).categories.find((category) => category.key === "systems")!;
      assert.equal(after.state, "missing", "covered → missing, with no R6B change whatsoever");
      assert.equal(after.recordCount, 0);
      assert.equal(after.withdrawnCount, 3);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. A RATIFIED SOURCE IS REFUSED — ALL OF IT, INCLUDING THE UNRATIFIED PART.
     *
     * The Governance boundary. A partial retraction would leave the operator believing the source
     * was withdrawn while some of it stayed in service, so one ratified fact refuses the whole act.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const plain = await seedChunk(client, {
        tenantId: TENANT_A,
        digest: DIGEST_RATIFIED,
        domainKey: "goals",
        factKey: "ratified-src-0",
        sourceTitle: "Strategy",
      });
      const blessed = await seedChunk(client, {
        tenantId: TENANT_A,
        digest: DIGEST_RATIFIED,
        domainKey: "goals",
        factKey: "ratified-src-1",
        sourceTitle: "Strategy",
        ratified: true,
      });

      const auditBefore = await count(client, "audit_log");
      const result = await retractKnowledgeSource(tenantA, { sourceDigest: DIGEST_RATIFIED }, deps);
      assert.equal(
        result.status === "refused" && result.reason,
        "source-contains-ratified-knowledge",
        "the authoring band may not withdraw what Governance approved",
      );

      /* PARTIALLY RATIFIED: the unratified sibling is untouched too. All or nothing. */
      for (const seeded of [plain, blessed]) {
        const row = await nodeRow(client, seeded.nodeId);
        assert.equal(row.knowledge_lifecycle_status, "draft");
        assert.equal(row.retired_at, null);
      }
      assert.equal(await count(client, "audit_log"), auditBefore, "a refusal files no mutation");

      /* The listing surfaces WHY, so the operator is not left guessing. */
      const sources = await repo.listIngestedSources({ tenantId: TENANT_A });
      const strategy = sources.find((source) => source.sourceDigest === DIGEST_RATIFIED)!;
      assert.equal(strategy.ratifiedFactCount, 1);
      assert.equal(strategy.liveFactCount, 2);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. ROLLBACK — a failure midway leaves every affected row unchanged.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const seeded = [];
      for (let index = 0; index < 4; index += 1) {
        seeded.push(
          await seedChunk(client, {
            tenantId: TENANT_A,
            digest: "f".repeat(64),
            domainKey: "customers",
            factKey: `rollback-${index}`,
            sourceTitle: "Segments",
          }),
        );
      }
      const auditBefore = await count(client, "audit_log");

      const failed = await retractKnowledgeSource(
        tenantA,
        { sourceDigest: "f".repeat(64) },
        { ...deps, failAfterFact: 1 },
      );
      assert.equal(failed.status === "refused" && failed.reason, "write-failed");

      for (const row of seeded) {
        const node = await nodeRow(client, row.nodeId);
        assert.equal(
          node.knowledge_lifecycle_status,
          "draft",
          "no chunk stays retired after a mid-transaction failure",
        );
        assert.equal(node.retired_at, null);
      }
      assert.equal(await count(client, "audit_log"), auditBefore, "and no audit row survives either");

      /* And the same source retracts cleanly once the failure seam is gone. */
      const clean = await retractKnowledgeSource(tenantA, { sourceDigest: "f".repeat(64) }, deps);
      assert.equal(clean.status, "retracted");
      assert.equal(clean.status === "retracted" && clean.source.retractedFactCount, 4);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. ALREADY-SUPERSEDED CHUNKS: only the ACTIVE version is withdrawn.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const digest = "1".repeat(64);
      const original = await seedChunk(client, {
        tenantId: TENANT_A,
        digest,
        domainKey: "markets",
        factKey: "superseded-src",
        sourceTitle: "Markets",
      });
      /* A hand-authored correction takes over the fact; the ingested node becomes history. */
      const corrected = uuid("90000000-0000-4000-8000-");
      await client.query(
        `insert into knowledge_nodes
           (id, tenant_id, type, label, statement, knowledge_lifecycle_status, knowledge_scope,
            knowledge_authority, domain_key, knowledge_version, supersedes_knowledge_node_id, provenance)
         values ($1,$2,'knowledge-statement','Markets v2','Corrected.','draft','company-wide',
                 'provisional','markets',2,$3,$4)`,
        [
          corrected,
          TENANT_A,
          original.nodeId,
          JSON.stringify({ origin: "human-authored", textOriginUnverified: true }),
        ],
      );
      await client.query(
        `update knowledge_facts set active_knowledge_node_id = $1, previous_knowledge_node_id = $2,
             fact_version = fact_version + 1 where id = $3`,
        [corrected, original.nodeId, original.factId],
      );

      /*
       * The source's node is no longer any fact's ACTIVE node, so a source-level retraction finds
       * nothing to withdraw. The correction already replaced it — retracting history would be the
       * rollback K3 refuses to build.
       */
      const result = await retractKnowledgeSource(tenantA, { sourceDigest: digest }, deps);
      assert.equal(
        result.status === "refused" && result.reason,
        "source-not-found",
        "a superseded ingested node is history, not a retraction target",
      );
      const row = await nodeRow(client, original.nodeId);
      assert.equal(row.knowledge_lifecycle_status, "draft", "history is left exactly as it was");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. NOTHING ELSE MOVED — no execution substrate, no provider, no hard delete.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      for (const table of [
        "action_permits",
        "action_execution_attempts",
        "heby_action_requests",
        "provider_connectivity_controls",
        "documents",
      ]) {
        assert.equal(await count(client, table), 0, `${table} is untouched by retraction`);
      }
      /* Every audit row this suite produced is a retraction; none is a delete. */
      const actions = await client.query<{ action: string }>(
        `select distinct action from audit_log`,
      );
      assert.deepEqual(
        actions.rows.map((row) => row.action).sort(),
        ["knowledge.retract"],
        "retraction files exactly one action class, and it is not a deletion",
      );
    }

    console.log("R6D retraction (postgres): all assertions passed.");
  } finally {
    await client.end().catch(() => undefined);
    await pool.end().catch(() => undefined);
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
