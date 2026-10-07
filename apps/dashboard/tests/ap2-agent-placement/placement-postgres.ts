/*
 * AP-2 — agent placement, proved against a REAL PostgreSQL.
 *
 * Every claim here is about a row or a lock, so this must be a database test:
 *
 *   · T1–T10 of the AP-2 contract, each through the released writer;
 *   · the writer changes ONLY `department_id` + provenance on the agent row (full-row diff);
 *   · a no-op writes nothing — no version, no `updated_at`, no audit row;
 *   · another tenant's / an absent / a malformed id are refused identically;
 *   · FIVE races, each with the interleaving FORCED — a test-only `afterLock` / `afterRead` seam
 *     holds one transaction open while `pg_stat_activity` proves the other is waiting on a lock.
 *     A plain `Promise.all` was measured (AGENT-ID-0.1) not to interleave at all.
 *   · placement grants nothing: proposer resolution and effective mandate read identically before
 *     and after, and no decision / permit / mandate / request / human-placement row is written.
 *
 * A disposable local database, dropped on exit. No production data.
 */
import assert from "node:assert/strict";
import { Client } from "pg";
import { seedGovernanceBootstrapRows } from "../helpers/agent-mandate-seed";
import { createDisposablePostgresHarness } from "../helpers/disposable-postgres";
import { createControlPlaneDb } from "../../src/db/client.server";
import { createDurableAgentIdentity } from "../../src/features/agent-identity/create-durable-agent-identity.server";
import { retireDurableAgentIdentity } from "../../src/features/agent-identity/retire-durable-agent-identity.server";
import { retireDepartment } from "../../src/features/organization-authority/write-structure.server";
import {
  setAgentPlacement,
  withdrawAgentPlacement,
} from "../../src/features/organization-authority/write-agent-placement.server";
import { readAgentPlacements } from "../../src/features/organization-authority/read-agent-placement.server";
import { AGENT_PLACEMENT_WRITABLE_COLUMNS } from "../../src/features/organization-authority/agent-placement-contracts";
import { resolveAgentProposer } from "../../src/features/action-authorization/agent-proposer.server";
import { readEffectiveAgentMandate } from "../../src/features/agent-mandate/read-agent-mandate.server";
import { asHumanTenantContext, type TenantContext } from "../../src/features/auth/tenant/tenant-context";

const TENANT_A = "10000000-0000-4000-8000-0000000a2001";
const TENANT_B = "10000000-0000-4000-8000-0000000a2002";
const OWNER_A = "20000000-0000-4000-8000-0000000a2001";
const OTHER_A = "20000000-0000-4000-8000-0000000a2003";
const OWNER_B = "20000000-0000-4000-8000-0000000a2002";
const DEPT_A1 = "40000000-0000-4000-8000-0000000a2001";
const DEPT_A2 = "40000000-0000-4000-8000-0000000a2002";
const DEPT_A3 = "40000000-0000-4000-8000-0000000a2003";
const DEPT_A4 = "40000000-0000-4000-8000-0000000a2004";
const DEPT_B1 = "40000000-0000-4000-8000-0000000b2001";
const ABSENT = "30000000-0000-4000-8000-00000000dead";
const NOW = new Date("2026-10-07T12:00:00.000Z");

function tenantContext(tenantId: string, userId: string): TenantContext {
  return asHumanTenantContext({
    tenantId,
    userId,
    authIdentityId: "auth-identity",
    membershipId: "membership",
    membershipVersion: 1,
    roleId: "role",
    sessionContextId: "session",
    provider: "local",
    assuranceLevel: "aal1",
    mfaVerified: false,
    requestId: "ap2-agent-placement",
    authenticatedAt: NOW.toISOString(),
  });
}

/** Tables a placement act must never touch. `audit_log` is counted separately. */
const MUST_STAY_UNTOUCHED = [
  "decision_records",
  "governance_sessions",
  "agent_mandates",
  "action_permits",
  "heby_action_requests",
  "action_execution_attempts",
  "department_placements",
  "memberships",
  "roles",
] as const;

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

async function main(): Promise<void> {
  const harness = createDisposablePostgresHarness("ap2_agent_placement");
  await harness.createDatabase();

  try {
    harness.migrateDatabase();

    const seed = new Client({ connectionString: harness.dbUrl });
    await seed.connect();
    try {
      await seed.query(
        `insert into companies (id, name, slug) values ($1, 'Tenant A', 'ap2-a'), ($2, 'Tenant B', 'ap2-b')`,
        [TENANT_A, TENANT_B],
      );
      await seed.query(
        `insert into users (id, email, name)
         values ($1, 'owner-a@example.com', 'Owner A'), ($2, 'other-a@example.com', 'Other A'),
                ($3, 'owner-b@example.com', 'Owner B')`,
        [OWNER_A, OTHER_A, OWNER_B],
      );
      await seedGovernanceBootstrapRows(seed, TENANT_A, OWNER_A);
      await seedGovernanceBootstrapRows(seed, TENANT_B, OWNER_B);
      await seed.query(
        `insert into departments (id, tenant_id, name, slug)
         values ($1, $5, 'Engineering', 'engineering'), ($2, $5, 'Research', 'research'),
                ($3, $5, 'Operations', 'operations'), ($4, $5, 'Support', 'support'),
                ($6, $7, 'B Engineering', 'engineering')`,
        [DEPT_A1, DEPT_A2, DEPT_A3, DEPT_A4, TENANT_A, DEPT_B1, TENANT_B],
      );
    } finally {
      await seed.end();
    }

    const handle = createControlPlaneDb(harness.dbUrl);
    const probe = new Client({ connectionString: harness.dbUrl });
    await probe.connect();

    try {
      const deps = { getDb: () => handle.db, now: () => NOW };
      const A = tenantContext(TENANT_A, OWNER_A);
      const A_OTHER = tenantContext(TENANT_A, OTHER_A);
      const B = tenantContext(TENANT_B, OWNER_B);

      const make = async (tenant: TenantContext, name: string): Promise<string> => {
        const made = await createDurableAgentIdentity(
          tenant,
          { name, justification: "Register this agent for the AP-2 placement suite." },
          { getDb: () => handle.db },
        );
        assert.equal(made.status, "established", `${name} is registered`);
        if (made.status !== "established") throw new Error("unreachable");
        return made.identity.agentId;
      };
      const AG1 = await make(A, "Atlas");
      const AG2 = await make(A, "Boreas");
      const AG3 = await make(A, "Calypso");
      const AG4 = await make(A, "Draco");
      const AG5 = await make(A, "Eos");
      const AG6 = await make(A, "Fornax");
      const AG_B = await make(B, "Atlas");

      const rowOf = async (agentId: string): Promise<Record<string, unknown>> => {
        const { rows } = await probe.query(`select * from agents where id = $1`, [agentId]);
        assert.equal(rows.length, 1);
        return rows[0] as Record<string, unknown>;
      };
      const countOf = async (table: string): Promise<number> => {
        const { rows } = await probe.query(`select count(*)::int as total from ${table}`);
        return rows[0].total as number;
      };
      const placementAudits = async (): Promise<number> => {
        const { rows } = await probe.query(
          `select count(*)::int as total from audit_log where action like 'organization.agent-placement.%'`,
        );
        return rows[0].total as number;
      };
      const changedColumns = (before: Record<string, unknown>, after: Record<string, unknown>) =>
        Object.keys(before)
          .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
          .sort();
      /** Resolves once at least `n` backends in this database are waiting on a lock. */
      const waitForLockWaiters = async (n: number): Promise<void> => {
        for (let i = 0; i < 200; i += 1) {
          const { rows } = await probe.query(
            `select count(*)::int as total from pg_stat_activity
              where datname = current_database() and wait_event_type = 'Lock'`,
          );
          if ((rows[0].total as number) >= n) return;
          await new Promise((r) => setTimeout(r, 25));
        }
        throw new Error("no backend ever waited on a lock — the interleaving was not forced");
      };
      const untouchedBefore: Record<string, number> = {};
      for (const table of MUST_STAY_UNTOUCHED) untouchedBefore[table] = await countOf(table);
      /* AG6 is read UNPLACED here and PLACED at the end (race 5). */
      const proposerBefore = await resolveAgentProposer(A, { getDb: () => handle.db }, { agentId: AG6 });
      const mandateBefore = await readEffectiveAgentMandate(A, AG6, { getDb: () => handle.db });

      /* ── GATE ─────────────────────────────────────────────────────────────── */
      assert.deepEqual(
        await setAgentPlacement(null, { agentId: AG1, departmentId: DEPT_A1, expectedDepartmentId: null }, deps),
        { status: "refused", reason: "no-authorized-tenant-context" },
      );
      assert.deepEqual(
        await setAgentPlacement(A_OTHER, { agentId: AG1, departmentId: DEPT_A1, expectedDepartmentId: null }, deps),
        { status: "refused", reason: "not-authorized" },
        "a member without Governance authority cannot place an agent",
      );

      /* ── INDISTINGUISHABILITY ─────────────────────────────────────────────── */
      for (const agentId of [AG_B, ABSENT, "not-a-uuid", ""]) {
        assert.deepEqual(
          await setAgentPlacement(A, { agentId, departmentId: DEPT_A1, expectedDepartmentId: null }, deps),
          { status: "refused", reason: "agent-unresolved" },
          `agent ${agentId || "(empty)"} is unresolved, indistinguishably`,
        );
        assert.deepEqual(
          await withdrawAgentPlacement(A, { agentId, expectedDepartmentId: null }, deps),
          { status: "refused", reason: "agent-unresolved" },
        );
      }
      for (const departmentId of [DEPT_B1, ABSENT, "not-a-uuid", ""]) {
        assert.deepEqual(
          await setAgentPlacement(A, { agentId: AG1, departmentId, expectedDepartmentId: null }, deps),
          { status: "refused", reason: "department-unresolved" },
          `department ${departmentId || "(empty)"} is unresolved, indistinguishably`,
        );
      }
      assert.equal((await rowOf(AG_B)).department_id, null, "B's agent was not touched by A");
      assert.equal(await placementAudits(), 0, "no refusal wrote an audit row");

      /* ── T1 unplaced → placed, column-scoped ──────────────────────────────── */
      const before1 = await rowOf(AG1);
      const t1 = await setAgentPlacement(A, { agentId: AG1, departmentId: DEPT_A1, expectedDepartmentId: null }, deps);
      assert.deepEqual(t1, {
        status: "recorded",
        placement: { agentId: AG1, previousDepartmentId: null, departmentId: DEPT_A1 },
      });
      const after1 = await rowOf(AG1);
      assert.deepEqual(
        changedColumns(before1, after1),
        [...AGENT_PLACEMENT_WRITABLE_COLUMNS].sort(),
        "exactly the writable columns moved, and every one of them did",
      );
      assert.equal(after1.version, (before1.version as number) + 1);
      assert.equal(after1.updated_by, OWNER_A);
      assert.equal(after1.updated_by_type, "human");
      const { rows: audit1 } = await probe.query(
        `select tenant_id, actor_type, actor_id, entity_type, entity_id, metadata, result
           from audit_log where action = 'organization.agent-placement.set'`,
      );
      assert.deepEqual(audit1, [
        {
          tenant_id: TENANT_A,
          actor_type: "human",
          actor_id: OWNER_A,
          entity_type: "agent",
          entity_id: AG1,
          metadata: { previousDepartmentId: null, departmentId: DEPT_A1 },
          result: "committed",
        },
      ]);

      /* ── T4 no-op writes nothing ──────────────────────────────────────────── */
      const auditsBeforeNoop = await placementAudits();
      assert.deepEqual(
        await setAgentPlacement(A, { agentId: AG1, departmentId: DEPT_A1, expectedDepartmentId: DEPT_A1 }, deps),
        { status: "refused", reason: "already-placed" },
      );
      assert.deepEqual(
        await withdrawAgentPlacement(A, { agentId: AG2, expectedDepartmentId: null }, deps),
        { status: "refused", reason: "not-placed" },
      );
      assert.deepEqual(await rowOf(AG1), after1, "no-op: AG1 row byte-identical (no version, no updated_at)");
      assert.equal((await rowOf(AG2)).version, 1, "no-op: AG2 version unchanged");
      assert.equal(await placementAudits(), auditsBeforeNoop, "no-op: no audit row");

      /* ── T9 a stale expectation is refused, never overwritten ─────────────── */
      assert.deepEqual(
        await setAgentPlacement(A, { agentId: AG1, departmentId: DEPT_A2, expectedDepartmentId: null }, deps),
        { status: "refused", reason: "placement-changed" },
      );
      assert.deepEqual(
        await withdrawAgentPlacement(A, { agentId: AG1, expectedDepartmentId: DEPT_A2 }, deps),
        { status: "refused", reason: "placement-changed" },
      );
      assert.deepEqual(await rowOf(AG1), after1, "a stale CAS changed nothing");

      /* ── T2 move, T6 retired target, T7 department retirement keeps it ───── */
      assert.equal(
        (await setAgentPlacement(A, { agentId: AG1, departmentId: DEPT_A2, expectedDepartmentId: DEPT_A1 }, deps)).status,
        "recorded",
      );
      const { rows: moveAudit } = await probe.query<{
        metadata: { previousDepartmentId: string | null; departmentId: string | null };
      }>(
        `select metadata from audit_log where entity_id = $1 and action = 'organization.agent-placement.set'`,
        [AG1],
      );
      assert.ok(
        moveAudit.some(
          (row) => row.metadata.previousDepartmentId === DEPT_A1 && row.metadata.departmentId === DEPT_A2,
        ),
        "a move records both sides",
      );
      assert.equal((await retireDepartment(A, { departmentId: DEPT_A3 }, { getDb: () => handle.db })).status, "recorded");
      assert.deepEqual(
        await setAgentPlacement(A, { agentId: AG1, departmentId: DEPT_A3, expectedDepartmentId: DEPT_A2 }, deps),
        { status: "refused", reason: "department-retired" },
      );
      assert.equal((await retireDepartment(A, { departmentId: DEPT_A2 }, { getDb: () => handle.db })).status, "recorded");
      assert.equal((await rowOf(AG1)).department_id, DEPT_A2, "T7: department retirement does not cascade");
      const read7 = await readAgentPlacements(A, { getDb: () => handle.db });
      assert.ok(read7.status === "available");
      assert.equal(read7.placements.find((p) => p.agentId === AG1)?.state, "placed-in-retired-department");

      /* ── T3 out of a retired department: move, then withdraw ─────────────── */
      assert.equal(
        (await setAgentPlacement(A, { agentId: AG1, departmentId: DEPT_A1, expectedDepartmentId: DEPT_A2 }, deps)).status,
        "recorded",
        "move out of a retired department",
      );
      assert.equal((await setAgentPlacement(A, { agentId: AG2, departmentId: DEPT_A4, expectedDepartmentId: null }, deps)).status, "recorded");
      assert.equal((await retireDepartment(A, { departmentId: DEPT_A4 }, { getDb: () => handle.db })).status, "recorded");
      assert.deepEqual(
        await withdrawAgentPlacement(A, { agentId: AG2, expectedDepartmentId: DEPT_A4 }, deps),
        { status: "withdrawn", placement: { agentId: AG2, previousDepartmentId: DEPT_A4, departmentId: null } },
        "withdraw out of a retired department",
      );
      assert.equal((await rowOf(AG2)).department_id, null);

      /* ── T5 / T8 retired agent: placement preserved, historical, frozen ──── */
      assert.equal((await retireDurableAgentIdentity(A, { agentId: AG1 }, { getDb: () => handle.db })).status, "retired");
      assert.equal((await rowOf(AG1)).department_id, DEPT_A1, "T8: retirement preserves the column");
      const read8 = await readAgentPlacements(A, { getDb: () => handle.db });
      assert.ok(read8.status === "available");
      const historical = read8.placements.find((p) => p.agentId === AG1);
      assert.equal(historical?.state, "historical");
      assert.equal(historical?.agentInService, false);
      assert.deepEqual(
        await setAgentPlacement(A, { agentId: AG1, departmentId: DEPT_A1, expectedDepartmentId: DEPT_A1 }, deps),
        { status: "refused", reason: "agent-retired" },
      );
      assert.deepEqual(
        await withdrawAgentPlacement(A, { agentId: AG1, expectedDepartmentId: DEPT_A1 }, deps),
        { status: "refused", reason: "agent-retired" },
      );

      /* ── RACE 1: placement holds the department; retirement must wait ───── */
      {
        const held = deferred();
        const entered = deferred();
        const placing = setAgentPlacement(
          A,
          { agentId: AG3, departmentId: DEPT_A1, expectedDepartmentId: null },
          { ...deps, afterLock: async () => { entered.resolve(); await held.promise; } },
        );
        await entered.promise;
        const retiring = retireDepartment(A, { departmentId: DEPT_A1 }, { getDb: () => handle.db });
        try {
          await waitForLockWaiters(1);
        } finally {
          held.resolve();
        }
        assert.equal((await placing).status, "recorded", "race 1: the placement that held the lock commits");
        assert.equal((await retiring).status, "recorded", "race 1: the retirement then commits");
        const read = await readAgentPlacements(A, { getDb: () => handle.db });
        assert.ok(read.status === "available");
        assert.equal(read.placements.find((p) => p.agentId === AG3)?.state, "placed-in-retired-department");
      }

      /* ── RACE 2: retirement commits first; the waiting placement is refused ─ */
      {
        /* DEPT_A2 was retired at T7; re-open it (fixture only) so this race starts in service. */
        await probe.query(`update departments set lifecycle_status = 'active', deleted_at = null where id = $1`, [DEPT_A2]);
        const holder = new Client({ connectionString: harness.dbUrl });
        await holder.connect();
        await holder.query("begin");
        await holder.query(`select id from departments where id = $1 for update`, [DEPT_A2]);
        await holder.query(`update departments set lifecycle_status = 'archived' where id = $1`, [DEPT_A2]);
        const before = await rowOf(AG4);
        const placing = setAgentPlacement(A, { agentId: AG4, departmentId: DEPT_A2, expectedDepartmentId: null }, deps);
        try {
          await waitForLockWaiters(1);
        } finally {
          await holder.query("commit");
          await holder.end();
        }
        assert.deepEqual(await placing, { status: "refused", reason: "department-retired" },
          "race 2: a retirement that committed while the placement waited is seen and refused");
        assert.deepEqual(await rowOf(AG4), before, "race 2: nothing written");
      }

      await probe.query(`update departments set lifecycle_status = 'active', deleted_at = null where id = $1`, [DEPT_A1]);

      /* ── RACE 3: agent retirement holds the row; the placement is refused ── */
      {
        const held = deferred();
        const entered = deferred();
        const retiring = retireDurableAgentIdentity(
          A,
          { agentId: AG4 },
          { getDb: () => handle.db, afterRead: async () => { entered.resolve(); await held.promise; } },
        );
        await entered.promise;
        const placing = setAgentPlacement(A, { agentId: AG4, departmentId: DEPT_A1, expectedDepartmentId: null }, deps);
        try {
          await waitForLockWaiters(1);
        } finally {
          held.resolve();
        }
        assert.equal((await retiring).status, "retired");
        assert.deepEqual(await placing, { status: "refused", reason: "agent-retired" },
          "race 3: a placement waiting behind retirement re-reads and refuses");
        assert.equal((await rowOf(AG4)).department_id, null);
      }

      /* ── RACE 4: placement holds the row; retirement waits, keeps it ─────── */
      {
        const held = deferred();
        const entered = deferred();
        const placing = setAgentPlacement(
          A,
          { agentId: AG5, departmentId: DEPT_A1, expectedDepartmentId: null },
          { ...deps, afterLock: async () => { entered.resolve(); await held.promise; } },
        );
        await entered.promise;
        const retiring = retireDurableAgentIdentity(A, { agentId: AG5 }, { getDb: () => handle.db });
        try {
          await waitForLockWaiters(1);
        } finally {
          held.resolve();
        }
        assert.equal((await placing).status, "recorded");
        assert.equal((await retiring).status, "retired");
        const read = await readAgentPlacements(A, { getDb: () => handle.db });
        assert.ok(read.status === "available");
        assert.equal(read.placements.find((p) => p.agentId === AG5)?.state, "historical",
          "race 4: placed, then retired — historical attribution");
      }

      /* ── RACE 5: two placements with the same expectation; one wins ──────── */
      {
        const held = deferred();
        const entered = deferred();
        const first = setAgentPlacement(
          A,
          { agentId: AG6, departmentId: DEPT_A1, expectedDepartmentId: null },
          { ...deps, afterLock: async () => { entered.resolve(); await held.promise; } },
        );
        await entered.promise;
        const auditsBefore = await placementAudits();
        const second = withdrawAgentPlacement(A, { agentId: AG6, expectedDepartmentId: null }, deps);
        const third = setAgentPlacement(A, { agentId: AG6, departmentId: DEPT_A3, expectedDepartmentId: null }, deps);
        try {
          await waitForLockWaiters(2);
        } finally {
          held.resolve();
        }
        assert.equal((await first).status, "recorded");
        assert.deepEqual(await second, { status: "refused", reason: "placement-changed" });
        assert.deepEqual(await third, { status: "refused", reason: "placement-changed" },
          "race 5: the loser is told the placement changed, never overwrites it");
        assert.equal((await rowOf(AG6)).department_id, DEPT_A1);
        assert.equal(await placementAudits(), auditsBefore + 1, "race 5: exactly one audit row");
      }

      /* ── PLACEMENT GRANTS NOTHING ─────────────────────────────────────────── */
      for (const table of MUST_STAY_UNTOUCHED) {
        assert.equal(await countOf(table), untouchedBefore[table], `${table} untouched by placement`);
      }
      assert.deepEqual(
        await resolveAgentProposer(A, { getDb: () => handle.db }, { agentId: AG6 }),
        proposerBefore,
        "proposer resolution reads the same for a placed agent as for an unplaced one",
      );
      assert.deepEqual(await readEffectiveAgentMandate(A, AG6, { getDb: () => handle.db }), mandateBefore,
        "the effective mandate reads the same for a placed agent as for an unplaced one");

      console.log("ap2-agent-placement/placement-postgres: T1–T10, column scope, no-op and five forced races hold");
    } finally {
      await probe.end();
      await handle.dispose();
    }
  } finally {
    await harness.dropDatabase();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
