/*
 * R6B — COMPANY UNDERSTANDING AGAINST A REAL POSTGRES DATABASE.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "Coverage is counted over EVERY fact the tenant holds, inside its own tenant, with standing
 *    preserved — and the areas Hebun cannot place are reported rather than erased."
 *
 * ── WHY THIS CANNOT BE A FAKE ────────────────────────────────────────────────
 *
 * The aggregate is `count(*) filter (where …)` over the effective window and the lifecycle enum.
 * Those are PostgreSQL behaviours: NULL handling in `is distinct from`, timestamptz comparison, and
 * `filter` semantics. A hand-written fake of them would only ever prove the fake — the same reason
 * KR3 refuses to fake ranking.
 *
 * The unbounded assertion (§6) is the reason the aggregate exists at all, and it needs > 50 real
 * rows to mean anything.
 *
 * Disposable database, dropped on exit. Canonical is never opened.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { createDurableKnowledgeRepository } from "../../src/features/knowledge/durable-knowledge-repository.server";
import { projectCompanyUnderstanding } from "../../src/features/knowledge/company-understanding";
import { listCompanyUnderstandingCategories } from "../../src/features/knowledge/company-understanding-taxonomy";
import { exclusionReasonFor } from "../../src/features/knowledge-retrieval";
import { deriveKnowledgeFreshness } from "../../src/features/knowledge/contracts";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const RATIFIER = "20000000-0000-4000-8000-00000000a009";

/** Pinned so every window comparison below is deterministic. */
const NOW = new Date("2026-08-18T12:00:00.000Z");

interface SeedFact {
  readonly tenantId: string;
  readonly factKey: string;
  readonly domainKey: string;
  readonly lifecycle?: string | null;
  readonly authority?: string | null;
  readonly effectiveFrom?: string | null;
  readonly effectiveUntil?: string | null;
  readonly nextReviewAt?: string | null;
  readonly ratified?: boolean;
  /** When true no node is written, so the fact's active node cannot resolve. */
  readonly orphan?: boolean;
}

let seq = 0;
function uuid(prefix: string): string {
  seq += 1;
  return `${prefix}${String(seq).padStart(12, "0")}`;
}

async function seedFact(client: Client, fact: SeedFact): Promise<void> {
  const factId = uuid("80000000-0000-4000-8000-");
  if (fact.orphan) {
    await client.query(
      `insert into knowledge_facts
         (id, tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
       values ($1, $2, $3, $4, 'company-wide', null, 1)`,
      [factId, fact.tenantId, fact.factKey, fact.domainKey],
    );
    return;
  }

  const nodeId = uuid("90000000-0000-4000-8000-");
  let decisionId: string | null = null;
  let sessionId: string | null = null;

  if (fact.ratified) {
    /*
     * After K4 "ratified" REQUIRES the Governance linkage, not a timestamp. Seeding the decision is
     * therefore not decoration — a bare `ratified_at` would read as unratified.
     */
    const session = await client.query<{ id: string }>(
      `insert into governance_sessions
         (tenant_id, governance_domain, decision_type, subject_type, proposer_actor_type, proposer_actor_id)
       values ($1, 'knowledge-ratification', 'ratify', 'knowledge_node', 'human', $2)
       returning id`,
      [fact.tenantId, RATIFIER],
    );
    sessionId = session.rows[0]!.id;
    const decision = await client.query<{ id: string }>(
      `insert into decision_records
         (tenant_id, session_id, decision_type, subject_type, subject_id, actor_type, actor_id,
          bootstrap, outcome, justification)
       values ($1, $2, 'ratify', 'knowledge_node', $3, 'human', $4, false, 'ratified',
               'Seeded: Governance approved this exact version.')
       returning id`,
      [fact.tenantId, sessionId, nodeId, RATIFIER],
    );
    decisionId = decision.rows[0]!.id;
  }

  await client.query(
    `insert into knowledge_nodes
       (id, tenant_id, type, label, statement, knowledge_lifecycle_status, knowledge_health,
        knowledge_scope, knowledge_authority, domain_key, effective_from, effective_until,
        next_review_at, knowledge_version, ratification_decision_id, governance_session_id,
        ratified_at, ratified_by_actor_type, ratified_by_actor_id)
     values ($1, $2, 'knowledge-statement', $3, 'Seeded statement.', $4, 'unknown',
             'company-wide', $5, $6, $7, $8, $9, 1, $10, $11, $12, $13, $14)`,
    [
      nodeId,
      fact.tenantId,
      `${fact.domainKey}/${fact.factKey}`,
      fact.lifecycle ?? "draft",
      fact.authority ?? "provisional",
      fact.domainKey,
      fact.effectiveFrom ?? null,
      fact.effectiveUntil ?? null,
      fact.nextReviewAt ?? null,
      decisionId,
      sessionId,
      fact.ratified ? "2026-01-01T00:00:00Z" : null,
      fact.ratified ? "human" : null,
      fact.ratified ? RATIFIER : null,
    ],
  );

  await client.query(
    `insert into knowledge_facts
       (id, tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
     values ($1, $2, $3, $4, 'company-wide', $5, 1)`,
    [factId, fact.tenantId, fact.factKey, fact.domainKey, nodeId],
  );
}

async function countRows(client: Client, table: string): Promise<number> {
  const result = await client.query<{ n: string }>(`select count(*)::text as n from ${table}`);
  return Number(result.rows[0]!.n);
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r6b_coverage");
  await harness.createDatabase();
  const client = new Client({ connectionString: harness.dbUrl });
  const pool = new Client({ connectionString: harness.dbUrl });

  try {
    harness.migrateDatabase();
    await client.connect();
    await pool.connect();
    const db = drizzle(pool) as unknown as ControlPlaneDatabase;
    const repo = createDurableKnowledgeRepository(db);

    await client.query(
      `insert into companies (id, name, slug) values ($1, 'Tenant A', 'tenant-a'), ($2, 'Tenant B', 'tenant-b')`,
      [TENANT_A, TENANT_B],
    );

    /* ═══════════════════════════════════════════════════════════════════════
     * 1. AN EMPTY TENANT REPORTS EVERY DECLARED AREA MISSING — and no score.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const empty = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      assert.equal(empty.categories.length, 10, "every declared area appears, covered or not");
      assert.ok(
        empty.categories.every((category) => category.state === "missing"),
        "an organization holding nothing is missing everywhere — that is its real state",
      );
      assert.equal(empty.uncategorized.length, 0);
      assert.equal(empty.truncated, false);
      /*
       * No percentage, anywhere. Asserted over the SERIALIZED view rather than by naming fields, so
       * a future field cannot smuggle one in under a different name.
       */
      const serialized = JSON.stringify(empty);
      for (const forbidden of ["percent", "score", "confidence", "understood", "health"]) {
        assert.ok(
          !serialized.toLowerCase().includes(forbidden),
          `the view must carry no ${forbidden} — Hebun computes none`,
        );
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 2. STANDING IS PRESERVED, NOT SUMMARISED.
     *
     * `covered` must not imply ratified, and ratified must not imply authoritative — after K4 the
     * ratification path writes the decision linkage and deliberately leaves `knowledge_authority`
     * alone, so a ratified record is still `provisional`. That exact truth is asserted here.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await seedFact(client, { tenantId: TENANT_A, factKey: "p1", domainKey: "policies" });
      await seedFact(client, { tenantId: TENANT_A, factKey: "p2", domainKey: "policies" });
      /* Ratified, and STILL provisional — the K4 semantics, seeded exactly as the runtime writes. */
      await seedFact(client, {
        tenantId: TENANT_A,
        factKey: "p3",
        domainKey: "policies",
        ratified: true,
        authority: "provisional",
      });

      const view = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      const policies = view.categories.find((category) => category.key === "policies")!;
      assert.equal(policies.state, "covered");
      assert.equal(policies.recordCount, 3);
      assert.equal(policies.ratifiedCount, 1, "only the record with a bound decision counts");
      assert.equal(
        policies.provisionalCount,
        3,
        "ratification does not make a record authoritative — K4 leaves knowledge_authority alone",
      );

      const goals = view.categories.find((category) => category.key === "goals")!;
      assert.equal(goals.state, "missing", "a covered area does not cover its neighbours");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 3. COVERED ≠ RATIFIED — an area held up entirely by unapproved drafts is covered.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await seedFact(client, { tenantId: TENANT_A, factKey: "c1", domainKey: "customers" });
      const view = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      const customers = view.categories.find((category) => category.key === "customers")!;
      assert.equal(customers.state, "covered");
      assert.equal(customers.ratifiedCount, 0, "covered with nothing ratified is a real state");
      assert.equal(customers.provisionalCount, 1);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 4. STALE IS COVERED; EXPIRED IS NOT. Two different things to be told.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await seedFact(client, {
        tenantId: TENANT_A,
        factKey: "s1",
        domainKey: "systems",
        nextReviewAt: "2026-01-01T00:00:00Z", // past → review-overdue
      });
      await seedFact(client, {
        tenantId: TENANT_A,
        factKey: "s2",
        domainKey: "systems",
        effectiveUntil: "2026-02-01T00:00:00Z", // past → expired
      });
      await seedFact(client, {
        tenantId: TENANT_A,
        factKey: "s3",
        domainKey: "systems",
        effectiveFrom: "2027-01-01T00:00:00Z", // future → not yet effective
      });
      await seedFact(client, {
        tenantId: TENANT_A,
        factKey: "s4",
        domainKey: "systems",
        lifecycle: "archived",
      });
      await seedFact(client, { tenantId: TENANT_A, factKey: "s5", domainKey: "systems", orphan: true });

      const view = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      const systems = view.categories.find((category) => category.key === "systems")!;
      assert.equal(systems.state, "covered", "a stale record still holds the area");
      assert.equal(systems.recordCount, 1, "only the review-overdue record is in force");
      assert.equal(systems.staleCount, 1);
      assert.equal(systems.expiredCount, 1, "expired is reported, never counted as coverage");
      assert.equal(systems.notYetEffectiveCount, 1);
      assert.equal(
        systems.withdrawnCount,
        2,
        "archived and unreadable are both withdrawn — neither is dropped",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 5. TENANT ISOLATION. Tenant B's facts never reach tenant A's counts.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await seedFact(client, { tenantId: TENANT_B, factKey: "b1", domainKey: "markets" });
      await seedFact(client, { tenantId: TENANT_B, factKey: "b2", domainKey: "markets" });

      const a = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      const b = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_B }, NOW),
        NOW,
      );

      assert.equal(
        a.categories.find((category) => category.key === "markets")!.state,
        "missing",
        "tenant B's markets knowledge is invisible to tenant A",
      );
      assert.equal(b.categories.find((category) => category.key === "markets")!.recordCount, 2);
      assert.equal(
        b.categories.find((category) => category.key === "policies")!.state,
        "missing",
        "and tenant A's policies are invisible to tenant B",
      );

      /* A cross-tenant ACTIVE NODE must not resolve either — the join is scoped on both sides. */
      const nodeB = await client.query<{ id: string }>(
        `select id from knowledge_nodes where tenant_id = $1 limit 1`,
        [TENANT_B],
      );
      const crossFact = uuid("80000000-0000-4000-8000-");
      await client.query(
        `insert into knowledge_facts
           (id, tenant_id, fact_key, domain_key, knowledge_scope, active_knowledge_node_id, fact_version)
         values ($1, $2, 'cross-tenant', 'partners', 'company-wide', $3, 1)`,
        [crossFact, TENANT_A, nodeB.rows[0]!.id],
      );
      const crossed = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      const partners = crossed.categories.find((category) => category.key === "partners")!;
      assert.equal(
        partners.state,
        "missing",
        "a fact pointing at another tenant's node resolves to nothing, never to that node",
      );
      assert.equal(partners.withdrawnCount, 1, "it is reported as unreadable, not silently dropped");
      await client.query(`delete from knowledge_facts where id = $1`, [crossFact]);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 6. THE UNBOUNDED PROOF — why this aggregate exists.
     *
     * `listFacts` is capped at 50 and ordered by `(domain_key, fact_key)`. Seeding 60 facts under
     * `aaa-*` domains pushes every real category past the cap, so a coverage view built on the
     * listing would report them missing. The aggregate must not.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      for (let index = 0; index < 60; index += 1) {
        await seedFact(client, {
          tenantId: TENANT_A,
          factKey: `bulk-${index}`,
          domainKey: `aaa-bulk-${String(index).padStart(3, "0")}`,
        });
      }

      const view = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      );
      /* `systems` and `policies` sort after every `aaa-*` domain, so the cap would have hidden them. */
      assert.equal(
        view.categories.find((category) => category.key === "systems")!.state,
        "covered",
        "an alphabetically late area survives past the 50-record listing bound",
      );
      assert.equal(
        view.categories.find((category) => category.key === "policies")!.state,
        "covered",
      );
      assert.equal(view.uncategorized.length, 60, "and every bulk domain is reported, not truncated");
      assert.equal(view.truncated, false);

      /* The listing genuinely IS truncated at this point — the two seams differ, as designed. */
      const listed = await repo.listFacts({ tenantId: TENANT_A }, NOW);
      assert.equal(listed.truncated, true, "the listing seam is bounded; the aggregate is not");
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 7. CASE-INSENSITIVE MAPPING, AND THE TURKISH FOLD PINNED.
     *
     * Canonical holds `Security` capitalised. A Turkish key is asserted against the DOCUMENTED
     * fold — not because the taxonomy speaks Turkish, but so a future change to the fold cannot
     * silently reinterpret one.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      await seedFact(client, { tenantId: TENANT_B, factKey: "sec", domainKey: "Security" });
      await seedFact(client, { tenantId: TENANT_B, factKey: "izin", domainKey: "İZİN" });
      await seedFact(client, { tenantId: TENANT_B, factKey: "izin2", domainKey: "izin" });

      const view = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_B }, NOW),
        NOW,
      );
      const policies = view.categories.find((category) => category.key === "policies")!;
      assert.equal(policies.state, "covered", "`Security` maps to policies despite the capital S");
      assert.deepEqual(policies.matchedDomainKeys, ["Security"]);

      /*
       * `İZİN` and `izin` are DIFFERENT rows — `domain_key` is case-sensitive in the database and
       * R6B rewrites nothing — but the fold places both in the same uncategorized bucket key. Both
       * appear; neither is dropped, and neither is guessed into a category.
       */
      const turkish = view.uncategorized.filter((domain) =>
        ["İZİN", "izin"].includes(domain.domainKey),
      );
      assert.equal(turkish.length, 2, "both Turkish domains are surfaced as stored");
      assert.ok(
        view.categories.every((category) => !category.matchedDomainKeys.some((key) => /zin/i.test(key))),
        "the English taxonomy does not guess a Turkish domain into a category",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 8. SUPERSEDED VERSIONS CANNOT REAPPEAR.
     *
     * Not a filter — the join is on `active_knowledge_node_id`, so a superseded node is not a
     * candidate at all. Proved by moving a fact's selection and watching the count stay at one.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      ).categories.find((category) => category.key === "customers")!;
      assert.equal(before.recordCount, 1);

      const supersedingNode = uuid("90000000-0000-4000-8000-");
      await client.query(
        `insert into knowledge_nodes
           (id, tenant_id, type, label, statement, knowledge_lifecycle_status, knowledge_health,
            knowledge_scope, knowledge_authority, domain_key, knowledge_version)
         values ($1, $2, 'knowledge-statement', 'customers/c1 v2', 'Corrected.', 'draft', 'unknown',
                 'company-wide', 'provisional', 'customers', 2)`,
        [supersedingNode, TENANT_A],
      );
      await client.query(
        `update knowledge_facts
            set previous_knowledge_node_id = active_knowledge_node_id,
                active_knowledge_node_id = $1,
                fact_version = fact_version + 1
          where tenant_id = $2 and fact_key = 'c1'`,
        [supersedingNode, TENANT_A],
      );

      const after = projectCompanyUnderstanding(
        await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW),
        NOW,
      ).categories.find((category) => category.key === "customers")!;
      assert.equal(
        after.recordCount,
        1,
        "a correction replaces the selection; the superseded version is not a second record",
      );
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 9. THE SQL BUCKETS AGREE WITH THE PURE FUNCTIONS.
     *
     * The aggregate reproduces `exclusionReasonFor` and `deriveKnowledgeFreshness` in SQL so it can
     * count without fetching every row. A comment promising they match would rot; this asserts it
     * against the same seeded rows, so a change to either side breaks here.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const listed = await repo.listFacts({ tenantId: TENANT_B }, NOW);
      const counts = await repo.countFactsByDomain({ tenantId: TENANT_B }, NOW);

      for (const record of listed.records) {
        const row = counts.find((entry) => entry.domainKey === record.domainKey);
        assert.ok(row, `the aggregate reported ${record.domainKey}`);
        const eligible = exclusionReasonFor(record, NOW) === null;
        assert.equal(
          eligible,
          row!.inForce > 0,
          `SQL and exclusionReasonFor disagree about ${record.domainKey}`,
        );
        const freshness = deriveKnowledgeFreshness(record, NOW);
        if (freshness === "review-overdue") {
          assert.ok(
            row!.reviewOverdue > 0,
            `SQL missed a review-overdue record deriveKnowledgeFreshness found in ${record.domainKey}`,
          );
        }
      }
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 10. THE READ WRITES NOTHING.
     *
     * Asserted as a DELTA across one projection, not against zero: seeding legitimately audits in
     * other fixtures, and a `= 0` claim would turn a true statement into a false failure later.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      const before = {
        audit: await countRows(client, "audit_log"),
        nodes: await countRows(client, "knowledge_nodes"),
        facts: await countRows(client, "knowledge_facts"),
        permits: await countRows(client, "action_permits"),
        attempts: await countRows(client, "action_execution_attempts"),
        requests: await countRows(client, "heby_action_requests"),
      };
      await repo.countFactsByDomain({ tenantId: TENANT_A }, NOW);
      assert.equal(await countRows(client, "audit_log"), before.audit, "a read files no audit event");
      assert.equal(await countRows(client, "knowledge_nodes"), before.nodes);
      assert.equal(await countRows(client, "knowledge_facts"), before.facts);
      assert.equal(await countRows(client, "action_permits"), before.permits);
      assert.equal(await countRows(client, "action_execution_attempts"), before.attempts);
      assert.equal(await countRows(client, "heby_action_requests"), before.requests);
    }

    /* ═══════════════════════════════════════════════════════════════════════
     * 11. A MALFORMED TENANT ID QUERIES NOTHING.
     * ═════════════════════════════════════════════════════════════════════ */
    {
      assert.deepEqual(await repo.countFactsByDomain({ tenantId: "not-a-uuid" }, NOW), []);
      assert.deepEqual(await repo.countFactsByDomain({ tenantId: "" }, NOW), []);
    }

    /* Every declared category key was reachable in this fixture's vocabulary. */
    assert.equal(listCompanyUnderstandingCategories().length, 10);

    console.log("R6B coverage (postgres): all assertions passed.");
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
