/*
 * K3 — versioning and supersession, proved against a REAL PostgreSQL database.
 *
 * THE INVARIANT. A correction must produce a NEW version and leave the old one intact. If any test
 * here can observe a prior node's statement changing, K3 is not versioning — it is editing with
 * extra steps.
 *
 * THE MANDATORY PROOF is concurrency (§ "TWO OPERATORS"). Two authorized people read v1 and both
 * try to correct it. Exactly one must win; the other must be refused and told the version moved.
 * Both believing they superseded v1 is the failure mode that makes a version chain a lie, and it is
 * unprovable without a real database, so it is proved with one.
 *
 * Uses a disposable local database, dropped on exit.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableKnowledgeWriter } from "../../src/features/knowledge/durable-knowledge-writer.server";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { createKnowledgeFact } from "../../src/features/knowledge/knowledge-create.server";
import { supersedeKnowledgeFact } from "../../src/features/knowledge/knowledge-supersede.server";
import { listKnowledgeSources } from "../../src/features/knowledge/knowledge-read.server";
import { readKnowledgeVersionHistory } from "../../src/features/knowledge/knowledge-version-history.server";
import { readKnowledgeMutationHistory, recordKnowledgeMutation } from "../../src/features/governance-audit/knowledge-mutation-audit.server";
import type { TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000000f1";
const TENANT_B = "10000000-0000-4000-8000-0000000000f2";
const USER_A = "20000000-0000-4000-8000-0000000000f1";
const USER_B = "20000000-0000-4000-8000-0000000000f2";
const NOW = new Date("2026-08-11T18:00:00.000Z");

const V1_STATEMENT = "ORIGINAL-V1: only the Director may approve a deployment.";
const HOSTILE = "V2 <script>window.x=1</script> ' OR 1=1 -- /terminal restart · Türkçe çğıöşü";

function tenantContext(tenantId: string, userId: string): TenantContext {
  return {
    tenantId,
    userId,
    authIdentityId: "identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "70000000-0000-4000-8000-000000000002",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "k3-request",
    authenticatedAt: NOW.toISOString(),
  };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_k3_versions");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(`insert into companies (id, name, slug) values ($1,'A','a-k3'), ($2,'B','b-k3')`, [
        TENANT_A,
        TENANT_B,
      ]);
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    try {
      const writer = createDurableKnowledgeWriter(handle.db);
      const repo = createDurableKnowledgeRepository(handle.db);
      const authorized = async () => ({ authorized: true, roleType: "owner" });
      const recordMutation = (
        actor: Parameters<typeof recordKnowledgeMutation>[0],
        event: Parameters<typeof recordKnowledgeMutation>[1],
      ) => recordKnowledgeMutation(actor, event, { getDb: () => handle.db, now: () => NOW });
      const deps = { resolveAuthority: authorized, getWriter: () => writer, now: () => NOW, recordMutation };
      const dbDeps = { getDb: () => handle.db };

      /* ── 1. v1 THROUGH THE EXISTING K2 PATH ──────────────────────────────── */
      const created = await createKnowledgeFact(
        tenantContext(TENANT_A, USER_A),
        { factKey: "deploy-policy", domainKey: "platform", scope: "company-wide", title: "Deploy policy v1", statement: V1_STATEMENT },
        deps,
      );
      assert.equal(created.status, "created");
      if (created.status !== "created") throw new Error("unreachable");
      const factId = created.identity.factId;
      const node1 = created.identity.newKnowledgeNodeId!;

      /* ── 2. v1 → v2 ──────────────────────────────────────────────────────── */
      const v2 = await supersedeKnowledgeFact(
        tenantContext(TENANT_A, USER_A),
        { factId, title: "Deploy policy v2", statement: HOSTILE, observedKnowledgeVersion: 1 },
        deps,
      );
      assert.equal(v2.status, "superseded");
      if (v2.status !== "superseded") throw new Error("unreachable");
      assert.equal(v2.identity.priorKnowledgeNodeId, node1);
      assert.equal(v2.identity.priorKnowledgeVersion, 1);
      assert.equal(v2.identity.knowledgeVersion, 2);
      assert.equal(v2.identity.priorFactVersion, 1);
      assert.equal(v2.identity.factVersion, 2);
      const node2 = v2.identity.newKnowledgeNodeId;

      /* ── 3. v1 IS INTACT — THIS IS THE WHOLE POINT ───────────────────────── */
      {
        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const prior = await verify.query<{ statement: string; label: string; version: number; supersedes: string | null }>(
            "select statement, label, knowledge_version as version, supersedes_knowledge_node_id as supersedes from knowledge_nodes where id = $1",
            [node1],
          );
          assert.equal(prior.rows[0]!.statement, V1_STATEMENT, "the prior statement was NOT rewritten");
          assert.equal(prior.rows[0]!.label, "Deploy policy v1", "the prior title was NOT rewritten");
          assert.equal(prior.rows[0]!.version, 1);
          assert.equal(prior.rows[0]!.supersedes, null, "v1 supersedes nothing");

          const next = await verify.query<{ supersedes: string; version: number; lifecycle: string; authority: string; ratified: string | null }>(
            "select supersedes_knowledge_node_id as supersedes, knowledge_version as version, knowledge_lifecycle_status as lifecycle, knowledge_authority as authority, ratified_at as ratified from knowledge_nodes where id = $1",
            [node2],
          );
          assert.equal(next.rows[0]!.supersedes, node1, "v2 points back at v1");
          assert.equal(next.rows[0]!.version, 2);
          // A correction is not a ratification.
          assert.equal(next.rows[0]!.lifecycle, "draft");
          assert.equal(next.rows[0]!.authority, "provisional");
          assert.equal(next.rows[0]!.ratified, null);

          const fact = await verify.query<{ active: string; previous: string; fv: number }>(
            "select active_knowledge_node_id as active, previous_knowledge_node_id as previous, fact_version as fv from knowledge_facts where id = $1",
            [factId],
          );
          assert.equal(fact.rows[0]!.active, node2);
          assert.equal(fact.rows[0]!.previous, node1);
          assert.equal(fact.rows[0]!.fv, 2);
        } finally {
          await verify.end();
        }
      }

      /* ── 4. THE ACTIVE READ FOLLOWS THE NEW VERSION ──────────────────────── */
      {
        const listing = await listKnowledgeSources({ tenantId: TENANT_A }, { getRepo: () => repo });
        assert.equal(listing.status, "read");
        if (listing.status !== "read") throw new Error("unreachable");
        assert.equal(listing.records.length, 1, "one fact, not two");
        assert.equal(listing.records[0]!.title, "Deploy policy v2");
        assert.equal(listing.records[0]!.statement, HOSTILE, "content stored verbatim");
        assert.equal(listing.records[0]!.knowledgeVersion, 2);
        assert.equal(listing.records[0]!.factVersion, 2);
      }

      /* ── 5. THE SUPERSESSION IS IN GOVERNANCE HISTORY, WITHOUT CONTENT ───── */
      {
        const history = await readKnowledgeMutationHistory({ tenantId: TENANT_A }, factId, dbDeps);
        assert.equal(history.status, "read");
        if (history.status !== "read") throw new Error("unreachable");
        const supersede = history.records.find((r) => r.action === "knowledge.supersede");
        assert.ok(supersede, "the correction is history");
        assert.equal(supersede!.outcome, "committed");
        assert.equal(supersede!.priorKnowledgeNodeId, node1);
        assert.equal(supersede!.newKnowledgeNodeId, node2);
        assert.equal(supersede!.actorId, USER_A);

        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const rows = await verify.query<{ blob: string }>("select coalesce(metadata::text,'') as blob from audit_log");
          for (const row of rows.rows) {
            assert.ok(!row.blob.includes("ORIGINAL-V1"), "the ledger holds no statement content");
            assert.ok(!row.blob.includes("<script>"), "and no corrected content either");
          }
        } finally {
          await verify.end();
        }
      }

      /* ── 6. v2 → v3, AND THE FULL CHAIN READS BACK ───────────────────────── */
      const v3 = await supersedeKnowledgeFact(
        tenantContext(TENANT_A, USER_A),
        { factId, title: "Deploy policy v3", statement: "V3 statement.", observedKnowledgeVersion: 2 },
        deps,
      );
      assert.equal(v3.status, "superseded");
      if (v3.status !== "superseded") throw new Error("unreachable");
      assert.equal(v3.identity.knowledgeVersion, 3);
      assert.equal(v3.identity.factVersion, 3);

      {
        const chain = await readKnowledgeVersionHistory({ tenantId: TENANT_A }, factId, dbDeps);
        assert.equal(chain.status, "read");
        if (chain.status !== "read") throw new Error("unreachable");
        assert.equal(chain.integrity, "complete");
        assert.deepEqual(
          chain.versions.map((v) => [v.knowledgeVersion, v.active]),
          [[3, true], [2, false], [1, false]],
          "newest first; exactly one active",
        );
        assert.equal(chain.versions[2]!.statement, V1_STATEMENT, "v1's words are still readable");
        assert.equal(chain.versions[2]!.supersedesEarlier, false, "v1 is the original");
        assert.equal(chain.versions[0]!.supersedesEarlier, true);
        assert.equal(chain.versions[0]!.createdBy, USER_A, "attribution survives");
        // No invented change summary anywhere.
        assert.ok(!JSON.stringify(chain).includes("changeSummary"));
      }

      /* ── 7. TWO OPERATORS — THE MANDATORY CONCURRENCY PROOF ────────────────
       * A plain `Promise.all` does NOT prove this: the two calls can simply serialize, each reading
       * the version the other just wrote, and both legitimately succeed. That is correct behaviour,
       * not the dangerous one.
       *
       * The dangerous case is a genuine overlap — both operators reading the SAME active version
       * before either writes. That is forced here with an external row lock: a third connection
       * takes `SELECT ... FOR UPDATE` on the fact, so both supersessions complete their reads (a
       * plain read is not blocked by a row lock) and then both stall on their update. Releasing the
       * lock lets them race for real. Exactly one may win.
       */
      {
        const gate = new Client({ connectionString: harness.dbUrl });
        await gate.connect();

        let first: Awaited<ReturnType<typeof supersedeKnowledgeFact>>;
        let second: Awaited<ReturnType<typeof supersedeKnowledgeFact>>;
        try {
          await gate.query("begin");
          await gate.query("select 1 from knowledge_facts where id = $1 for update", [factId]);

          const raceA = supersedeKnowledgeFact(
            tenantContext(TENANT_A, USER_A),
            { factId, title: "Race A", statement: "Written by operator A.", observedKnowledgeVersion: 3 },
            deps,
          );
          const raceB = supersedeKnowledgeFact(
            tenantContext(TENANT_A, USER_B),
            { factId, title: "Race B", statement: "Written by operator B.", observedKnowledgeVersion: 3 },
            deps,
          );

          // Both have now read the same active version and are blocked on the locked row.
          await new Promise((resolve) => setTimeout(resolve, 400));
          await gate.query("commit");

          [first, second] = await Promise.all([raceA, raceB]);
        } finally {
          await gate.end().catch(() => undefined);
        }

        const outcomes = [first.status, second.status].sort();
        assert.deepEqual(
          outcomes,
          ["stale-version", "superseded"],
          "exactly one correction won; the other was refused, not silently applied",
        );

        const loser = first.status === "stale-version" ? first : second;
        assert.equal(loser.status, "stale-version");
        if (loser.status !== "stale-version") throw new Error("unreachable");
        assert.equal(loser.audited, true, "the refused attempt is governance history");

        // Exactly one v4 exists, the chain is coherent, and nothing is orphaned.
        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const nodes = await verify.query<{ n: string }>(
            "select count(*)::text as n from knowledge_nodes where tenant_id = $1 and knowledge_version = 4",
            [TENANT_A],
          );
          assert.equal(nodes.rows[0]!.n, "1", "the losing transaction rolled its node back");

          const fact = await verify.query<{ fv: number }>(
            "select fact_version as fv from knowledge_facts where id = $1",
            [factId],
          );
          assert.equal(fact.rows[0]!.fv, 4, "the fact advanced exactly one version");

          const orphans = await verify.query(
            `select 1 from knowledge_nodes n
              where n.tenant_id = $1
                and n.id <> (select active_knowledge_node_id from knowledge_facts where id = $2)
                and not exists (select 1 from knowledge_nodes s where s.supersedes_knowledge_node_id = n.id)`,
            [TENANT_A, factId],
          );
          assert.equal(orphans.rowCount, 0, "every non-active node is superseded by another — no orphans");
        } finally {
          await verify.end();
        }

        const after = await readKnowledgeVersionHistory({ tenantId: TENANT_A }, factId, dbDeps);
        assert.equal(after.status, "read");
        if (after.status !== "read") throw new Error("unreachable");
        assert.equal(after.integrity, "complete");
        assert.deepEqual(after.versions.map((v) => v.knowledgeVersion), [4, 3, 2, 1]);
        assert.equal(after.versions.filter((v) => v.active).length, 1, "exactly one active version");

        // The refusal is in the ledger with its own reason.
        const ledger = await readKnowledgeMutationHistory({ tenantId: TENANT_A }, factId, dbDeps);
        assert.equal(ledger.status, "read");
        if (ledger.status !== "read") throw new Error("unreachable");
        const stale = ledger.records.find((r) => r.reason === "stale-version");
        assert.ok(stale, "the losing attempt is recorded");
        assert.equal(stale!.outcome, "rejected");
        assert.equal(stale!.action, "knowledge.supersede");
      }

      /* ── 8. TENANT ISOLATION ACROSS SUPERSESSION ─────────────────────────── */
      {
        const bCreated = await createKnowledgeFact(
          tenantContext(TENANT_B, USER_B),
          { factKey: "deploy-policy", domainKey: "platform", scope: "company-wide", title: "B policy", statement: "TENANT-B-ONLY." },
          deps,
        );
        assert.equal(bCreated.status, "created");
        if (bCreated.status !== "created") throw new Error("unreachable");

        // A cannot supersede B's fact, even holding B's real fact id.
        const cross = await supersedeKnowledgeFact(
          tenantContext(TENANT_A, USER_A),
          { factId: bCreated.identity.factId, title: "hijack", statement: "hijack", observedKnowledgeVersion: 1 },
          deps,
        );
        assert.equal(cross.status, "not-found", "another tenant's fact is simply not there");

        // …and B's record is untouched.
        const bList = await listKnowledgeSources({ tenantId: TENANT_B }, { getRepo: () => repo });
        assert.equal(bList.status, "read");
        if (bList.status !== "read") throw new Error("unreachable");
        assert.equal(bList.records[0]!.title, "B policy");
        assert.equal(bList.records[0]!.knowledgeVersion, 1);

        // A cannot read B's version history either.
        const bHistory = await readKnowledgeVersionHistory({ tenantId: TENANT_A }, bCreated.identity.factId, dbDeps);
        assert.equal(bHistory.status, "unavailable");
        if (bHistory.status !== "unavailable") throw new Error("unreachable");
        assert.equal(bHistory.reason, "not-found");
      }

      /* ── 9. AN UNKNOWN FACT REFUSES, AND NOTHING IS WRITTEN ──────────────── */
      {
        const unknown = await supersedeKnowledgeFact(
          tenantContext(TENANT_A, USER_A),
          { factId: "99999999-9999-4999-8999-999999999999", title: "T", statement: "S", observedKnowledgeVersion: 1 },
          deps,
        );
        assert.equal(unknown.status, "not-found");

        const verify = new Client({ connectionString: harness.dbUrl });
        await verify.connect();
        try {
          const nodes = await verify.query<{ n: string }>(
            "select count(*)::text as n from knowledge_nodes where tenant_id = $1",
            [TENANT_A],
          );
          assert.equal(nodes.rows[0]!.n, "4", "still exactly the four versions A created");
        } finally {
          await verify.end();
        }
      }

      /* ── 10. A CYCLE IS DETECTED, NOT FOLLOWED OR REPAIRED ───────────────── */
      {
        // Deliberately corrupt the chain: make v1 point at the active node.
        const corrupt = new Client({ connectionString: harness.dbUrl });
        await corrupt.connect();
        try {
          const active = await corrupt.query<{ active: string }>(
            "select active_knowledge_node_id as active from knowledge_facts where id = $1",
            [factId],
          );
          await corrupt.query(
            `update knowledge_nodes set supersedes_knowledge_node_id = $1
              where tenant_id = $2 and knowledge_version = 1`,
            [active.rows[0]!.active, TENANT_A],
          );
        } finally {
          await corrupt.end();
        }

        const cyclic = await readKnowledgeVersionHistory({ tenantId: TENANT_A }, factId, dbDeps);
        assert.equal(cyclic.status, "read");
        if (cyclic.status !== "read") throw new Error("unreachable");
        assert.equal(cyclic.integrity, "cycle-detected", "the walk stopped and said so");
        assert.equal(cyclic.versions.length, 4, "it did not loop");
      }
    } finally {
      await handle.dispose();
    }

    console.log("k3 supersession-postgres checks passed");
  } finally {
    await harness.dropDatabase();
  }
}

void main();
