/*
 * R7.1 — GOVERNANCE ACTIVITY OBSERVATION AGAINST REAL POSTGRES.
 *
 * THE SUCCESS CONDITION THIS FILE PROVES:
 *
 *   "The aggregate counts every row the observed tenant owns and no row any other tenant owns, its
 *    grouped tallies account for the whole ledger, and reading it changes nothing."
 *
 * Runs against a DISPOSABLE database that this file creates, migrates and drops. Canonical is never
 * opened: the harness claims `DATABASE_URL` for the duration and restores it on drop.
 *
 * ── WHY THE FIXTURE IS DELIBERATELY LARGER THAN ANY PLAUSIBLE ROW CAP ────────
 *
 * Tenant A is seeded with more ROWS than the 100-row bound the one existing tenant-scoped audit
 * read (`readKnowledgeMutationHistory`) carries. If the aggregate were ever reimplemented over a
 * bounded listing — the exact R6B defect — the totals below fall short and the completeness
 * assertion catches it. A fixture smaller than the cap could not, and the bite-proof confirmed it:
 * reimplementing the aggregate as a 100-row listing produced 100 against an expected 125.
 *
 * ── WHAT THIS FIXTURE DOES *NOT* CATCH, STATED HONESTLY ──────────────────────
 *
 * A `LIMIT` applied to the GROUPED statement bites at the number of GROUPS, not the number of rows.
 * Tenant A holds 125 rows but only five distinct actions, so a `.limit(100)` on the grouped query
 * truncates nothing and every assertion here still passes — the bite-proof confirmed that too.
 * What refuses that cap is the structural prohibition on `.limit(` in
 * `tests/r7-1-flow/boundaries-and-firewall.ts`, not this file.
 *
 * So the two checks are genuinely different, not redundant: this file catches a bound that
 * truncates real rows (verified at `.limit(3)`, which reported 4 against 125), and the structural
 * file catches a bound that has not truncated anything YET. Neither alone is sufficient, and
 * claiming this fixture covers both would be the kind of overclaim the record-integrity gate exists
 * to catch.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { observeGovernanceActivity } from "../../src/features/governance-activity/observe.server";
import { readGovernanceActivityTallies } from "../../src/features/governance-activity/read.server";
import { projectGovernanceActivity, sumActionCounts } from "../../src/features/governance-activity/observation";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import type { ControlPlaneDatabase } from "../../src/db/client.server";

const TENANT_A = "10000000-0000-4000-8000-00000000a001";
const TENANT_B = "10000000-0000-4000-8000-00000000b001";
const TENANT_EMPTY = "10000000-0000-4000-8000-00000000c001";
const ACTOR = "20000000-0000-4000-8000-000000000009";

/** Pinned so `generatedAt` and every timestamp comparison below is deterministic. */
const NOW = new Date("2026-08-18T12:00:00.000Z");

/** Above the 100-row bound the existing per-entity audit read carries. */
const A_INVITATIONS = 120;

let seq = 0;
const uuid = (): string => {
  seq += 1;
  return `30000000-0000-4000-8000-${String(seq).padStart(12, "0")}`;
};

async function seedCompany(client: Client, id: string, name: string): Promise<void> {
  await client.query(`insert into companies (id, name, slug) values ($1, $2, $3)`, [
    id,
    name,
    name.toLowerCase(),
  ]);
}

interface SeedAct {
  readonly tenantId: string;
  readonly action: string;
  readonly entityType: string;
  readonly occurredAt: string;
  readonly result?: string;
  readonly authoritySource?: string | null;
  readonly simulation?: boolean;
}

async function seedAct(client: Client, act: SeedAct): Promise<void> {
  await client.query(
    `insert into audit_log
       (id, tenant_id, actor_type, actor_id, action, entity_type, entity_id,
        occurred_at, result, simulation, authority_source)
     values ($1, $2, 'human', $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      uuid(),
      act.tenantId,
      ACTOR,
      act.action,
      act.entityType,
      uuid(),
      act.occurredAt,
      act.result ?? "committed",
      act.simulation ?? false,
      act.authoritySource === undefined ? "membership" : act.authoritySource,
    ],
  );
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("hebun_r71_activity");
  await harness.createDatabase();
  harness.migrateDatabase();

  const client = new Client({ connectionString: harness.dbUrl });
  const pool = new Pool({ connectionString: harness.dbUrl });
  await client.connect();

  try {
    const db = drizzle(pool) as unknown as ControlPlaneDatabase;
    const getDb = () => db;

    await seedCompany(client, TENANT_A, "Acme");
    await seedCompany(client, TENANT_B, "Globex");
    await seedCompany(client, TENANT_EMPTY, "Initech");

    /* ── Tenant A: 120 invitations + a mixed tail, deliberately over any list cap ── */
    for (let index = 0; index < A_INVITATIONS; index += 1) {
      await seedAct(client, {
        tenantId: TENANT_A,
        action: "onboarding.invitation.issued",
        entityType: "invitation",
        /* Ascending minutes, so the newest is the last one written. */
        occurredAt: new Date(Date.UTC(2026, 7, 13, 0, index)).toISOString(),
      });
    }
    await seedAct(client, {
      tenantId: TENANT_A,
      action: "governance.membership.authorized",
      entityType: "governance_decision",
      occurredAt: "2026-08-14T09:00:00.000Z",
    });
    await seedAct(client, {
      tenantId: TENANT_A,
      action: "governance.membership.authorized",
      entityType: "governance_decision",
      occurredAt: "2026-08-14T10:00:00.000Z",
    });
    /* A refusal: history, not a failure. And the newest act tenant A holds. */
    await seedAct(client, {
      tenantId: TENANT_A,
      action: "governance.identity.enrollment.rejected",
      entityType: "identity_enrollment_request",
      occurredAt: "2026-08-15T13:25:43.977Z",
      result: "rejected",
    });
    /* One simulated act, and one recorded without an authority source. */
    await seedAct(client, {
      tenantId: TENANT_A,
      action: "governance.role.provisioned",
      entityType: "governance_decision",
      occurredAt: "2026-08-14T11:00:00.000Z",
      simulation: true,
    });
    await seedAct(client, {
      tenantId: TENANT_A,
      action: "governance.bootstrap.established",
      entityType: "governance_decision",
      occurredAt: "2026-08-13T08:00:00.000Z",
      authoritySource: null,
    });

    const A_TOTAL = A_INVITATIONS + 5;

    /* ── Tenant B: a different ledger the observation must never see ── */
    for (let index = 0; index < 7; index += 1) {
      await seedAct(client, {
        tenantId: TENANT_B,
        action: "knowledge.create",
        entityType: "knowledge_fact",
        occurredAt: "2026-08-19T23:00:00.000Z",
        result: "rolled-back",
        authoritySource: "platform-admin",
        simulation: true,
      });
    }

    /* ═════════════════════════════════════════════════════════════════════
     * 1. THE OBSERVATION IS COMPLETE AND CORRECT FOR THE OBSERVED TENANT.
     * ═══════════════════════════════════════════════════════════════════ */
    const observedA = await observeGovernanceActivity({ tenantId: TENANT_A }, { getDb, now: () => NOW });
    assert.equal(observedA.status, "observed");
    if (observedA.status !== "observed") throw new Error("unreachable");
    const a = observedA.observation;

    assert.equal(a.tenantId, TENANT_A);
    assert.equal(a.generatedAt, NOW.toISOString(), "generatedAt is the injected clock");
    assert.equal(a.totalRecordedActs, A_TOTAL, "every row tenant A owns is counted");

    /*
     * COMPLETENESS. `totalRecordedActs` came from an independent `count(*)`; the action tallies
     * came from a separate grouped statement. Their agreement is the proof that the grouping is
     * unbounded — a `LIMIT` on either one breaks this equality.
     */
    assert.equal(sumActionCounts(a), a.totalRecordedActs, "grouped actions account for every row");
    assert.equal(
      a.results.reduce((total, r) => total + r.count, 0),
      a.totalRecordedActs,
      "result buckets account for every row",
    );
    assert.equal(
      a.authoritySources.reduce((total, s) => total + s.count, 0),
      a.totalRecordedActs,
      "authority-source buckets account for every row, including the null one",
    );
    assert.equal(
      a.simulation.simulatedCount + a.simulation.nonSimulatedCount,
      a.totalRecordedActs,
      "the simulated split accounts for every row",
    );

    /* The 120-row group survives intact — the specific number a 100-row cap would have truncated. */
    const invitations = a.actions.find((t) => t.action === "onboarding.invitation.issued");
    assert.equal(invitations?.count, A_INVITATIONS, "the largest group is not capped");

    /* Action tallies, ordered count-desc then key-asc. */
    assert.deepEqual(
      a.actions.map((t) => [t.action, t.count]),
      [
        ["onboarding.invitation.issued", A_INVITATIONS],
        ["governance.membership.authorized", 2],
        ["governance.bootstrap.established", 1],
        ["governance.identity.enrollment.rejected", 1],
        ["governance.role.provisioned", 1],
      ],
    );

    /* Per-action recency is the max within that action, not the tenant-wide max. */
    assert.equal(
      a.actions.find((t) => t.action === "governance.membership.authorized")?.latestOccurredAt,
      "2026-08-14T10:00:00.000Z",
    );
    assert.equal(
      a.actions.find((t) => t.action === "onboarding.invitation.issued")?.latestOccurredAt,
      new Date(Date.UTC(2026, 7, 13, 0, A_INVITATIONS - 1)).toISOString(),
    );

    /* Tenant-wide recency is tenant A's newest act — never tenant B's later one. */
    assert.equal(a.latestOccurredAt, "2026-08-15T13:25:43.977Z");

    assert.deepEqual(
      a.results.map((t) => [t.result, t.count]),
      [["committed", A_TOTAL - 1], ["rejected", 1]],
    );
    assert.deepEqual(
      a.authoritySources.map((t) => [t.authoritySource, t.count]),
      [["membership", A_TOTAL - 1], [null, 1]],
    );
    assert.deepEqual(a.simulation, { simulatedCount: 1, nonSimulatedCount: A_TOTAL - 1 });

    /* ═════════════════════════════════════════════════════════════════════
     * 2. TENANT ISOLATION. Tenant B's ledger is invisible to tenant A.
     * ═══════════════════════════════════════════════════════════════════ */
    const observedB = await observeGovernanceActivity({ tenantId: TENANT_B }, { getDb, now: () => NOW });
    assert.equal(observedB.status, "observed");
    if (observedB.status !== "observed") throw new Error("unreachable");
    const b = observedB.observation;

    assert.equal(b.totalRecordedActs, 7, "tenant B sees exactly its own rows");
    assert.deepEqual(b.actions.map((t) => t.action), ["knowledge.create"]);
    assert.deepEqual(b.results.map((t) => t.result), ["rolled-back"]);
    assert.deepEqual(b.authoritySources.map((t) => t.authoritySource), ["platform-admin"]);
    assert.deepEqual(b.simulation, { simulatedCount: 7, nonSimulatedCount: 0 });
    assert.equal(b.latestOccurredAt, "2026-08-19T23:00:00.000Z");

    /*
     * The leak assertions, stated from A's side. If the tenant predicate were removed, A's total
     * would become A_TOTAL + 7, its action list would gain `knowledge.create`, its result list
     * `rolled-back`, its authority sources `platform-admin`, and its latest act would jump to
     * tenant B's later timestamp. Each of the five is asserted, so removing the predicate cannot
     * pass by coincidence.
     */
    assert.equal(a.totalRecordedActs, A_TOTAL, "A's total excludes B's rows");
    assert.ok(!a.actions.some((t) => t.action === "knowledge.create"), "A never sees B's actions");
    assert.ok(!a.results.some((t) => t.result === "rolled-back"), "A never sees B's results");
    assert.ok(
      !a.authoritySources.some((t) => t.authoritySource === "platform-admin"),
      "A never sees B's authority sources",
    );
    assert.ok(a.latestOccurredAt! < "2026-08-19T00:00:00.000Z", "A's recency is not B's");
    assert.equal(a.simulation.simulatedCount, 1, "A's simulated count excludes B's seven");

    /* ═════════════════════════════════════════════════════════════════════
     * 3. AN EMPTY TENANT IS AN HONEST ZERO, NOT AN ABSENCE.
     * ═══════════════════════════════════════════════════════════════════ */
    const observedEmpty = await observeGovernanceActivity(
      { tenantId: TENANT_EMPTY },
      { getDb, now: () => NOW },
    );
    assert.equal(observedEmpty.status, "observed", "a tenant with no rows still observes");
    if (observedEmpty.status !== "observed") throw new Error("unreachable");
    assert.equal(observedEmpty.observation.totalRecordedActs, 0);
    assert.equal(observedEmpty.observation.latestOccurredAt, null);
    assert.deepEqual(observedEmpty.observation.actions, []);
    assert.deepEqual(observedEmpty.observation.results, []);
    assert.deepEqual(observedEmpty.observation.authoritySources, []);
    assert.deepEqual(observedEmpty.observation.simulation, {
      simulatedCount: 0,
      nonSimulatedCount: 0,
    });

    /* ═════════════════════════════════════════════════════════════════════
     * 4. THE SQL AGGREGATE AND THE PURE PROJECTION AGREE.
     * ═══════════════════════════════════════════════════════════════════ */
    {
      const tallies = await readGovernanceActivityTallies(TENANT_A, { getDb });
      assert.ok(tallies, "the read produced tallies");
      const projected = projectGovernanceActivity(TENANT_A, tallies!, NOW);
      assert.deepEqual(projected, a, "the composed observation is exactly the pure projection");

      /* The raw tallies carry the same totals the view reports — the projection invents nothing. */
      assert.equal(tallies!.totalRecordedActs, a.totalRecordedActs);
      assert.equal(
        tallies!.actions.reduce((total, t) => total + t.count, 0),
        tallies!.totalRecordedActs,
      );
    }

    /* ═════════════════════════════════════════════════════════════════════
     * 5. FAIL-CLOSED. No tenant context is never an empty count.
     * ═══════════════════════════════════════════════════════════════════ */
    {
      const none = await observeGovernanceActivity(null, { getDb, now: () => NOW });
      assert.deepEqual(none, { status: "unavailable", reason: "no-authorized-tenant-context" });

      const blank = await observeGovernanceActivity({ tenantId: "" }, { getDb, now: () => NOW });
      assert.deepEqual(blank, { status: "unavailable", reason: "no-authorized-tenant-context" });

      /* A malformed id cannot name a tenant, and must not be answered with a zero observation. */
      const malformed = await observeGovernanceActivity(
        { tenantId: "not-a-uuid" },
        { getDb, now: () => NOW },
      );
      assert.deepEqual(malformed, { status: "unavailable", reason: "persistence-not-configured" });
      assert.equal(await readGovernanceActivityTallies("not-a-uuid", { getDb }), null);

      /* A well-formed id for a company that does not exist observes an honest zero. */
      const unknown = await observeGovernanceActivity(
        { tenantId: "10000000-0000-4000-8000-00000000f001" },
        { getDb, now: () => NOW },
      );
      assert.equal(unknown.status, "observed");
      if (unknown.status !== "observed") throw new Error("unreachable");
      assert.equal(unknown.observation.totalRecordedActs, 0);

      /* A read that throws surfaces as unavailable, never as a partial count. */
      const broken = await observeGovernanceActivity(
        { tenantId: TENANT_A },
        {
          getDb: () => {
            throw new Error("connection lost");
          },
          now: () => NOW,
        },
      );
      assert.equal(broken.status, "unavailable");
      if (broken.status !== "unavailable") throw new Error("unreachable");
      assert.equal(broken.reason, "read-failed");
    }

    /* ═════════════════════════════════════════════════════════════════════
     * 6. READING CHANGES NOTHING.
     * ═══════════════════════════════════════════════════════════════════ */
    {
      const countOf = async (table: string): Promise<number> =>
        Number((await client.query(`select count(*)::int as n from ${table}`)).rows[0].n);

      const before = {
        audit: await countOf("audit_log"),
        attempts: await countOf("action_execution_attempts"),
        permits: await countOf("action_permits"),
        requests: await countOf("heby_action_requests"),
        knowledgeNodes: await countOf("knowledge_nodes"),
        knowledgeFacts: await countOf("knowledge_facts"),
      };
      /* A digest of the whole ledger: proves no row was rewritten, not merely that none was added. */
      const digestBefore = (
        await client.query(
          `select md5(string_agg(id::text || action || result::text || occurred_at::text, '|' order by id)) as d from audit_log`,
        )
      ).rows[0].d;

      for (let index = 0; index < 3; index += 1) {
        await observeGovernanceActivity({ tenantId: TENANT_A }, { getDb, now: () => NOW });
        await observeGovernanceActivity({ tenantId: TENANT_B }, { getDb, now: () => NOW });
      }

      assert.equal(await countOf("audit_log"), before.audit, "observing appends no audit row");
      assert.equal(await countOf("action_execution_attempts"), before.attempts);
      assert.equal(await countOf("action_permits"), before.permits);
      assert.equal(await countOf("heby_action_requests"), before.requests);
      assert.equal(await countOf("knowledge_nodes"), before.knowledgeNodes);
      assert.equal(await countOf("knowledge_facts"), before.knowledgeFacts);
      assert.equal(
        (
          await client.query(
            `select md5(string_agg(id::text || action || result::text || occurred_at::text, '|' order by id)) as d from audit_log`,
          )
        ).rows[0].d,
        digestBefore,
        "and rewrites no existing row",
      );

      /* Repeated reads are identical apart from nothing: the clock is injected and pinned. */
      const again = await observeGovernanceActivity({ tenantId: TENANT_A }, { getDb, now: () => NOW });
      assert.deepEqual(again, observedA, "the observation is deterministic across reads");
    }

    /* R7.1 introduced no table of its own into the migrated schema. */
    {
      const rows = (
        await client.query(
          `select table_name from information_schema.tables
             where table_schema = 'public' and table_name like '%governance_activity%'`,
        )
      ).rows;
      assert.deepEqual(rows, [], "R7.1 created no table");
    }

    console.log("R7.1 governance activity observation (postgres): all assertions passed.");
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
